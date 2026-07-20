"""Fetch and normalize Codomo's public S3 formation template list."""

from __future__ import annotations

import argparse
import json
import re
import urllib.request
from pathlib import Path

from bs4 import BeautifulSoup

from paths import S3_CODOMO_TEMPLATES_JSON


SOURCE_URL = "https://www.sanguo-zhi.com/entry/s3-template/"
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"
)
HEIGAKU_DIRECTIONS = {
    "cat-buryaku": "武略",
    "cat-kiryaku": "機略",
    "cat-jindate": "陣立",
    "cat-rinsen": "臨戦",
}
SKILL_NAME_ALIASES = {
    "雷神切り": "雷神斬り",
    "赤備え": "赤備え隊",
    "三河弓兵": "三河弓兵隊",
    "薩摩鉄砲隊": "薩摩鉄砲兵",
}


def _fetch_html() -> str:
    request = urllib.request.Request(
        SOURCE_URL,
        headers={"User-Agent": USER_AGENT, "Accept-Language": "ja,en;q=0.8"},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read().decode("utf-8-sig")


def _clean_text(node) -> str:
    return re.sub(r"\s+", " ", node.get_text(" ", strip=True)).strip() if node else ""


def _parse_minor(name: str) -> dict:
    match = re.search(r"([12])$", name)
    return {
        "name": re.sub(r"[12]$", "", name),
        "level": int(match.group(1)) if match else 1,
    }


def _heigaku_direction(row) -> str | None:
    main = row.select_one(".s3tpl-heigaku-main")
    if not main:
        return None
    for class_name in main.get("class", []):
        if class_name in HEIGAKU_DIRECTIONS:
            return HEIGAKU_DIRECTIONS[class_name]
    return None


def _breakthrough(card) -> int:
    badge = card.select_one(".s3tpl-header [class*='toh-']")
    if not badge:
        return 0
    match = re.search(r"toh-(\d+)", " ".join(badge.get("class", [])))
    return int(match.group(1)) if match else 0


def parse_templates(html: str) -> dict:
    soup = BeautifulSoup(html, "html.parser")
    cards = soup.select("#s3tplList .s3tpl-card")
    if not cards:
        raise RuntimeError("S3 template cards were not found; the source layout may have changed")

    formations = []
    for index, card in enumerate(cards, start=1):
        members = []
        for row_index, row in enumerate(card.select("table.s3tpl-table tbody tr")):
            hero_name = _clean_text(row.select_one(".col-busho"))
            skills = [
                SKILL_NAME_ALIASES.get(_clean_text(node), _clean_text(node))
                for node in row.select(".s3tpl-senpo")
            ]
            if not hero_name or len(skills) != 2 or not all(skills):
                raise RuntimeError(
                    f"template {index} row {row_index + 1} is incomplete: "
                    f"hero={hero_name!r}, skills={skills!r}"
                )
            main_heigaku = _clean_text(row.select_one(".s3tpl-heigaku-main")) or None
            sub_heigaku = [
                _parse_minor(_clean_text(node))
                for node in row.select(".s3tpl-heigaku-sub")
                if _clean_text(node)
            ]
            stat_focus = _clean_text(row.select_one(".s3tpl-stat-multi, td:last-child"))
            members.append({
                "role": "main" if row_index == 0 else f"vice{row_index}",
                "hero_name": hero_name,
                "skill1_name": skills[0],
                "skill2_name": skills[1],
                "stat_focus": stat_focus,
                "bingxue": {
                    "direction": _heigaku_direction(row),
                    "major": main_heigaku,
                    "minors": sub_heigaku,
                },
            })

        if len(members) != 3:
            raise RuntimeError(f"template {index} has {len(members)} members instead of 3")

        tier = card.get("data-tier", "")
        tier_label = _clean_text(card.select_one(".s3tpl-badge[class*='tier-']"))
        faction = card.get("data-faction", "")
        troop_types = [part for part in card.get("data-btype", "").split(",") if part]
        troop_label = _clean_text(card.select_one(".s3tpl-badge.btype"))
        hero_names = "・".join(member["hero_name"] for member in members)
        formations.append({
            "id": f"s3-codomo-{index:03d}",
            "name": " ".join(part for part in (tier_label, faction, troop_label, hero_names) if part),
            "tier": tier,
            "faction": faction,
            "troop_types": troop_types,
            "leader": members[0]["hero_name"],
            "recommended_breakthrough": _breakthrough(card),
            "comment": _clean_text(card.select_one(".s3tpl-comment")),
            "members": members,
        })

    modified = soup.select_one('meta[property="article:modified_time"]')
    return {
        "season": "S3",
        "source": "こどもんの真戦ブログ",
        "source_url": SOURCE_URL,
        "source_modified_at": modified.get("content", "") if modified else "",
        "formations": formations,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, help="Parse a previously downloaded HTML file")
    parser.add_argument("--output", type=Path, default=S3_CODOMO_TEMPLATES_JSON)
    args = parser.parse_args()

    html = args.input.read_text("utf-8-sig") if args.input else _fetch_html()
    data = parse_templates(html)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", "utf-8")
    print(f"[done] {len(data['formations'])} S3 templates -> {args.output}")


if __name__ == "__main__":
    main()
