import gzip
import json
import unittest
from datetime import datetime, timedelta, timezone

from script.backup_recommendations import TABLES, build_backup, prune_expired_backups


class FakeClient:
    def __init__(self, now: datetime) -> None:
        self.now = now
        self.removed: list[str] = []

    def fetch_table(self, table: str):
        return [{"table": table}]

    def list_backups(self):
        return [
            {
                "name": "expired.json.gz",
                "created_at": (self.now - timedelta(days=15)).isoformat(),
            },
            {
                "name": "retained.json.gz",
                "created_at": (self.now - timedelta(days=13)).isoformat(),
            },
        ]

    def remove(self, names: list[str]) -> None:
        self.removed.extend(names)


class BackupRecommendationsTest(unittest.TestCase):
    def setUp(self) -> None:
        self.now = datetime(2026, 7, 21, 15, 0, tzinfo=timezone.utc)
        self.client = FakeClient(self.now)

    def test_build_backup_contains_every_table(self) -> None:
        compressed = build_backup(self.client, self.now)
        payload = json.loads(gzip.decompress(compressed))

        self.assertEqual(set(payload["tables"]), set(TABLES))
        self.assertEqual(payload["row_counts"], {table: 1 for table in TABLES})
        self.assertEqual(payload["generated_at_jst"], "2026-07-22T00:00:00+09:00")

    def test_prune_removes_only_files_older_than_retention(self) -> None:
        expired = prune_expired_backups(self.client, self.now, 14)

        self.assertEqual(expired, ["expired.json.gz"])
        self.assertEqual(self.client.removed, ["expired.json.gz"])


if __name__ == "__main__":
    unittest.main()
