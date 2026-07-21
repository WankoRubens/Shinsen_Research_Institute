#!/usr/bin/env python3
"""Back up recommendation tables to a private Supabase Storage bucket."""

from __future__ import annotations

import gzip
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo


TABLES = (
    "proposals",
    "proposal_votes",
    "team_variants",
    "variant_contributors",
    "variant_votes",
)
BUCKET = "recommendation-backups"
PAGE_SIZE = 1000
DEFAULT_RETENTION_DAYS = 14


class BackupError(RuntimeError):
    """Raised when a Supabase backup operation fails."""


def _response_json(request: Request) -> Any:
    try:
        with urlopen(request, timeout=30) as response:
            raw = response.read()
    except HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")[:500]
        raise BackupError(f"Supabase returned HTTP {error.code}: {detail}") from error
    except URLError as error:
        raise BackupError(f"Unable to reach Supabase: {error.reason}") from error

    if not raw:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError as error:
        raise BackupError("Supabase returned an invalid JSON response") from error


class SupabaseBackupClient:
    def __init__(self, base_url: str, service_role_key: str) -> None:
        self.base_url = base_url.rstrip("/")
        self.headers = {
            "apikey": service_role_key,
            "Authorization": f"Bearer {service_role_key}",
        }

    def _json_request(
        self,
        path: str,
        *,
        method: str = "GET",
        body: Any | None = None,
        headers: dict[str, str] | None = None,
    ) -> Any:
        payload = None if body is None else json.dumps(body).encode("utf-8")
        request_headers = {**self.headers, **(headers or {})}
        if payload is not None:
            request_headers["Content-Type"] = "application/json"
        return _response_json(Request(
            f"{self.base_url}{path}",
            data=payload,
            headers=request_headers,
            method=method,
        ))

    def fetch_table(self, table: str) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        offset = 0
        while True:
            query = urlencode({"select": "*"})
            page = self._json_request(
                f"/rest/v1/{quote(table)}?{query}",
                headers={
                    "Range-Unit": "items",
                    "Range": f"{offset}-{offset + PAGE_SIZE - 1}",
                },
            )
            if not isinstance(page, list):
                raise BackupError(f"Unexpected response while reading {table}")
            rows.extend(page)
            if len(page) < PAGE_SIZE:
                return rows
            offset += PAGE_SIZE

    def ensure_private_bucket(self) -> None:
        buckets = self._json_request("/storage/v1/bucket")
        if not isinstance(buckets, list):
            raise BackupError("Unable to list Supabase Storage buckets")

        existing = next((item for item in buckets if item.get("id") == BUCKET), None)
        if existing is not None:
            if existing.get("public") is True:
                raise BackupError(f"Storage bucket {BUCKET} must be private")
            return

        self._json_request(
            "/storage/v1/bucket",
            method="POST",
            body={
                "id": BUCKET,
                "name": BUCKET,
                "public": False,
                "allowed_mime_types": ["application/gzip"],
            },
        )

    def upload(self, name: str, content: bytes) -> None:
        request = Request(
            f"{self.base_url}/storage/v1/object/{BUCKET}/{quote(name)}",
            data=content,
            headers={
                **self.headers,
                "Content-Type": "application/gzip",
                "x-upsert": "false",
            },
            method="POST",
        )
        _response_json(request)

    def list_backups(self) -> list[dict[str, Any]]:
        objects = self._json_request(
            f"/storage/v1/object/list/{BUCKET}",
            method="POST",
            body={
                "prefix": "",
                "limit": 1000,
                "offset": 0,
                "sortBy": {"column": "created_at", "order": "asc"},
            },
        )
        if not isinstance(objects, list):
            raise BackupError("Unable to list recommendation backups")
        return objects

    def remove(self, names: list[str]) -> None:
        if not names:
            return
        self._json_request(
            f"/storage/v1/object/{BUCKET}",
            method="DELETE",
            body={"prefixes": names},
        )


def _parse_timestamp(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def build_backup(client: SupabaseBackupClient, generated_at: datetime) -> bytes:
    tables: dict[str, list[dict[str, Any]]] = {}
    for table in TABLES:
        tables[table] = client.fetch_table(table)
        print(f"Fetched {table}: {len(tables[table])} rows")

    payload = {
        "schema_version": 1,
        "generated_at": generated_at.astimezone(timezone.utc).isoformat(),
        "generated_at_jst": generated_at.astimezone(ZoneInfo("Asia/Tokyo")).isoformat(),
        "row_counts": {table: len(rows) for table, rows in tables.items()},
        "tables": tables,
    }
    serialized = json.dumps(
        payload,
        ensure_ascii=False,
        separators=(",", ":"),
    ).encode("utf-8")
    return gzip.compress(serialized, compresslevel=9, mtime=0)


def prune_expired_backups(
    client: SupabaseBackupClient,
    now: datetime,
    retention_days: int,
) -> list[str]:
    cutoff = now.astimezone(timezone.utc) - timedelta(days=retention_days)
    expired: list[str] = []
    for item in client.list_backups():
        name = item.get("name")
        created_at = item.get("created_at")
        if not isinstance(name, str) or not isinstance(created_at, str):
            continue
        if _parse_timestamp(created_at).astimezone(timezone.utc) < cutoff:
            expired.append(name)
    client.remove(expired)
    return expired


def main() -> int:
    base_url = os.environ.get("SUPABASE_URL", "").strip()
    service_role_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    retention_days = int(os.environ.get("BACKUP_RETENTION_DAYS", DEFAULT_RETENTION_DAYS))

    if not base_url or not service_role_key:
        print(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required",
            file=sys.stderr,
        )
        return 2
    if retention_days < 1:
        print("BACKUP_RETENTION_DAYS must be at least 1", file=sys.stderr)
        return 2

    now = datetime.now(timezone.utc)
    client = SupabaseBackupClient(base_url, service_role_key)
    client.ensure_private_bucket()

    compressed = build_backup(client, now)
    filename = f"recommendations-{now.strftime('%Y%m%dT%H%M%SZ')}.json.gz"
    client.upload(filename, compressed)
    print(f"Uploaded {filename}: {len(compressed)} bytes")

    expired = prune_expired_backups(client, now, retention_days)
    print(f"Removed {len(expired)} backups older than {retention_days} days")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
