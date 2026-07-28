"""
Collect complete, per-hero bingxue choices from SLGSIM.

The other maintained sources are still used to identify and cross-check heroes:
- Game8 documents the bingxue rules and option counts.
- sanguo-zhi.com/wiki provides the current 137-hero roster.
- sanguo-zhi.com/entry articles provide recommended choices for some heroes.
- The originally supplied Shinsei-Lineup repository covers verified PK heroes.

SLGSIM provides the full per-hero table for the S1-S3 roster. Each collected
entry records its source URL, and unavailable tables are listed under
``unresolved`` instead of being guessed.

Usage:
    python script/crawl_slgsim_bingxue.py
    python script/crawl_slgsim_bingxue.py --force-all
"""

from __future__ import annotations

import argparse
import json
import re
import time
import unicodedata
from pathlib import Path
from urllib.parse import urljoin

import requests
import yaml
from bs4 import BeautifulSoup

from bingxue_categories import canonical_bingxue_direction
from paths import HEROES_JSON, SLGSIM_BINGXUE_HEROES_YAML


BASE_URL = "https://slgsim.com/"
INDEX_URL = urljoin(BASE_URL, "generals")
SANGUO_ZHI_WIKI_URL = "https://www.sanguo-zhi.com/wiki/"
SANGUO_ZHI_WIKI_HERO_INDEX_URL = urljoin(SANGUO_ZHI_WIKI_URL, "general/")
GAME8_BINGXUE_URL = "https://game8.jp/nobunaga-shinsen/764614"
SANGUO_ZHI_BINGXUE_URL = "https://www.sanguo-zhi.com/entry/nobunaga-heigaku/"
ORIGINAL_REPOSITORY_URL = "https://github.com/davidjaw/Shinsei-Lineup"
ORIGINAL_OVERRIDES_URL = (
    "https://raw.githubusercontent.com/davidjaw/"
    "Shinsei-Lineup/main/data/overrides.yaml"
)

DIRECTIONS = ("武略", "機略", "陣立", "臨戦")
GROUP_LABELS = {"奇": "major", "正": "minor"}
EXPECTED_GROUP_SIZES = {"major": 3, "minor": 6}

# Normalize common old/new glyph differences used by the source sites.
_NAME_TRANSLATION = str.maketrans({
    "實": "実",
    "黑": "黒",
    "德": "徳",
    "濱": "浜",
    "髙": "高",
    "﨑": "崎",
    "邊": "辺",
    "邉": "辺",
    "齋": "斎",
    "國": "国",
})


def normalize_name(value: object) -> str:
    text = unicodedata.normalize("NFKC", str(value or "")).translate(_NAME_TRANSLATION)
    return "".join(text.split())


def make_session() -> requests.Session:
    session = requests.Session()
    session.headers.update({
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"
        ),
        "Accept-Language": "ja,en;q=0.8",
    })
    return session


def fetch_soup(session: requests.Session, url: str, timeout: float = 20) -> BeautifulSoup:
    response = session.get(url, timeout=timeout)
    response.raise_for_status()
    return BeautifulSoup(response.text, "html.parser")


def extract_hero_links(soup: BeautifulSoup) -> dict[str, str]:
    """Return normalized hero name -> absolute detail URL."""
    links: dict[str, str] = {}
    for anchor in soup.find_all("a", href=True):
        href = anchor.get("href", "")
        if "hero/" not in href:
            continue
        name_node = anchor.find("h3")
        if name_node is None:
            name_node = anchor.find("img", alt=True)
        name = (
            name_node.get_text(" ", strip=True)
            if name_node and name_node.name != "img"
            else name_node.get("alt", "") if name_node else ""
        )
        key = normalize_name(name)
        if key:
            links.setdefault(key, urljoin(BASE_URL, href))
    return links


def extract_wiki_hero_names(soup: BeautifulSoup) -> set[str]:
    """Return hero names listed in the user-specified Japanese Wiki."""
    names: set[str] = set()
    for anchor in soup.find_all("a", href=True):
        href = anchor.get("href", "")
        if not re.search(r"/wiki/general/[^/?#]+/?$", href):
            continue
        label = re.sub(r"^T\d+\s*", "", anchor.get_text(" ", strip=True))
        key = normalize_name(label)
        if key:
            names.add(key)
    return names


def _extract_option_names(row, group_label: str) -> list[str]:
    label = row.find("span", recursive=False)
    if label is None or label.get_text(strip=True) != group_label:
        return []
    container = label.find_next_sibling("div")
    if container is None:
        return []

    names: list[str] = []
    for wrapper in container.find_all("div", recursive=False):
        visible_label = wrapper.find("span", recursive=False)
        if visible_label is None:
            continue
        name = visible_label.get_text(" ", strip=True)
        if name and name not in names:
            names.append(name)
    return names


def normalize_bingxue_directions(bingxue: dict) -> dict:
    """Re-group options by the verified Japanese category map."""
    result = {
        direction: {"major": [], "minor": []}
        for direction in DIRECTIONS
    }
    for source_direction, groups in (bingxue or {}).items():
        for group in ("major", "minor"):
            for option_name in groups.get(group, []) or []:
                direction = canonical_bingxue_direction(
                    option_name,
                    source_direction,
                )
                bucket = result[direction][group]
                if option_name not in bucket:
                    bucket.append(option_name)
    return result


def validate_bingxue(hero_name: str, bingxue: dict) -> None:
    if set(bingxue) != set(DIRECTIONS):
        raise ValueError(
            f"{hero_name}: expected directions {DIRECTIONS}, got {tuple(bingxue)}"
        )
    for direction in DIRECTIONS:
        groups = bingxue[direction]
        for group, expected_size in EXPECTED_GROUP_SIZES.items():
            actual = groups.get(group) or []
            if len(actual) != expected_size or len(set(actual)) != expected_size:
                raise ValueError(
                    f"{hero_name}/{direction}/{group}: "
                    f"expected {expected_size} unique options, got {actual}"
                )


def extract_hero_bingxue(soup: BeautifulSoup) -> tuple[str, dict]:
    hero_heading = soup.find("h1")
    hero_name = hero_heading.get_text(" ", strip=True) if hero_heading else ""
    heading = next(
        (h for h in soup.find_all("h2") if h.get_text(" ", strip=True) == "兵学"),
        None,
    )
    if heading is None:
        raise ValueError(f"{hero_name or 'unknown hero'}: bingxue section not found")

    section = heading.find_parent("section")
    if section is None:
        raise ValueError(f"{hero_name}: bingxue section container not found")

    result: dict[str, dict[str, list[str]]] = {}
    for direction_heading in section.find_all("h4"):
        direction = direction_heading.get_text(" ", strip=True)
        if direction not in DIRECTIONS:
            continue
        panel = direction_heading.parent
        groups = {"major": [], "minor": []}
        for row in panel.select("div.space-y-2 > div.flex.items-start.gap-2"):
            label = row.find("span", recursive=False)
            label_text = label.get_text(strip=True) if label else ""
            group = GROUP_LABELS.get(label_text)
            if group:
                groups[group] = _extract_option_names(row, label_text)
        result[direction] = groups

    result = normalize_bingxue_directions(result)
    validate_bingxue(hero_name, result)
    return hero_name, result


def extract_upstream_bingxue(payload: dict) -> dict[str, dict]:
    """Read complete PK-season tables from the originally supplied repository."""
    hero_entries = payload.get("heroes", payload)
    result: dict[str, dict] = {}
    for source_name, hero in (hero_entries or {}).items():
        bingxue = hero.get("bingxue") if isinstance(hero, dict) else None
        if not bingxue:
            continue
        display_name = hero.get("name_jp") or hero.get("name") or source_name
        normalized = normalize_bingxue_directions(bingxue)
        validate_bingxue(display_name, normalized)
        result[normalize_name(display_name)] = {
            "source_name": display_name,
            "bingxue": normalized,
        }
    return result


def _target_heroes(heroes_path: Path, force_all: bool) -> list[dict]:
    heroes = json.loads(heroes_path.read_text("utf-8"))
    return [
        hero
        for hero in heroes
        if int(hero.get("rarity") or 0) >= 4
        and (force_all or not hero.get("bingxue"))
    ]


def _hero_lookup_keys(hero: dict) -> set[str]:
    values: list[object] = [hero.get("name"), hero.get("name_jp")]
    aliases = hero.get("aliases") or []
    values.extend(aliases if isinstance(aliases, list) else [aliases])
    return {normalize_name(value) for value in values if normalize_name(value)}


def crawl_missing_bingxue(
    heroes_path: Path = HEROES_JSON,
    output_path: Path = SLGSIM_BINGXUE_HEROES_YAML,
    force_all: bool = False,
    delay: float = 0.12,
    strict: bool = False,
) -> dict:
    targets = _target_heroes(heroes_path, force_all)
    session = make_session()
    source_links = extract_hero_links(fetch_soup(session, INDEX_URL))
    wiki_hero_names = extract_wiki_hero_names(
        fetch_soup(session, SANGUO_ZHI_WIKI_HERO_INDEX_URL)
    )
    upstream_response = session.get(ORIGINAL_OVERRIDES_URL, timeout=30)
    upstream_response.raise_for_status()
    upstream_tables = extract_upstream_bingxue(
        yaml.safe_load(upstream_response.text) or {}
    )

    output: dict[str, dict] = {}
    unmatched: list[str] = []
    for index, hero in enumerate(targets, start=1):
        lookup_keys = _hero_lookup_keys(hero)
        display_name = hero.get("name_jp") or hero.get("name")
        wiki_verified = any(key in wiki_hero_names for key in lookup_keys)
        if not wiki_verified:
            raise RuntimeError(
                f"{display_name}: not found in {SANGUO_ZHI_WIKI_HERO_INDEX_URL}"
            )

        matched_key = next((key for key in lookup_keys if key in source_links), None)
        upstream_key = next((key for key in lookup_keys if key in upstream_tables), None)
        if matched_key is not None:
            source_url = source_links[matched_key]
            source_name, bingxue = extract_hero_bingxue(
                fetch_soup(session, source_url)
            )
        elif upstream_key is not None:
            upstream = upstream_tables[upstream_key]
            source_url = ORIGINAL_OVERRIDES_URL
            source_name = upstream["source_name"]
            bingxue = upstream["bingxue"]
        else:
            unmatched.append(display_name)
            continue

        output[display_name] = {
            "name": display_name,
            "source_name": source_name,
            "source_url": source_url,
            "wiki_verified": True,
            "bingxue": bingxue,
        }
        print(f"[{index}/{len(targets)}] {display_name}")
        if delay:
            time.sleep(delay)

    payload = {
        "sources": {
            "roster": SANGUO_ZHI_WIKI_HERO_INDEX_URL,
            "rules": [GAME8_BINGXUE_URL, SANGUO_ZHI_BINGXUE_URL],
            "full_tables": [INDEX_URL, ORIGINAL_REPOSITORY_URL],
        },
        "unresolved": unmatched,
        "heroes": output,
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        yaml.safe_dump(payload, allow_unicode=True, sort_keys=False),
        "utf-8",
    )
    if unmatched:
        print(f"[warn] unresolved heroes: {', '.join(unmatched)}")
        if strict:
            raise RuntimeError(f"unmatched heroes: {', '.join(unmatched)}")
    if len(output) + len(unmatched) != len(targets):
        raise RuntimeError(
            f"expected {len(targets)} heroes, handled "
            f"{len(output) + len(unmatched)}"
        )
    print(f"[done] {len(output)} hero bingxue tables -> {output_path}")
    return payload


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--heroes", type=Path, default=HEROES_JSON)
    parser.add_argument("--output", type=Path, default=SLGSIM_BINGXUE_HEROES_YAML)
    parser.add_argument("--force-all", action="store_true")
    parser.add_argument("--delay", type=float, default=0.12)
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Fail after writing when a complete table cannot be verified.",
    )
    args = parser.parse_args()
    crawl_missing_bingxue(
        args.heroes,
        args.output,
        args.force_all,
        args.delay,
        args.strict,
    )


if __name__ == "__main__":
    main()
