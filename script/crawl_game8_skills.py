"""
Fetch and parse the Game8 tactic list page.

Source: https://game8.jp/nobunaga-shinsen/746982
Output: data/game8/skills_index.json

The parser stores compact, structured fields used by build_frontend_data.py:
name, rarity, activation_rate, category, description, kind, and related heroes.
"""

from __future__ import annotations

import html
import json
import re
import urllib.request
from html.parser import HTMLParser

from paths import GAME8_SKILLS_INDEX_JSON

DEFAULT_URL = "https://game8.jp/nobunaga-shinsen/746982"


class TableParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.in_tr = False
        self.in_cell = False
        self.current_row: list[str] = []
        self.current_cell: list[str] = []
        self.rows: list[list[str]] = []

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag == "tr":
            self.in_tr = True
            self.current_row = []
        elif self.in_tr and tag in {"td", "th"}:
            self.in_cell = True
            self.current_cell = []
        elif self.in_cell and tag in {"br", "hr"}:
            self.current_cell.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if self.in_cell and tag in {"td", "th"}:
            text = re.sub(r"[ \t\r\f\v]+", " ", "".join(self.current_cell))
            text = re.sub(r"\n\s*", "\n", text).strip()
            self.current_row.append(text)
            self.in_cell = False
        elif self.in_tr and tag == "tr":
            if self.current_row:
                self.rows.append(self.current_row)
            self.in_tr = False

    def handle_data(self, data: str) -> None:
        if self.in_cell:
            self.current_cell.append(data)


def fetch(url: str = DEFAULT_URL) -> str:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
            ),
            "Accept-Language": "ja,en;q=0.8",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8")


def clean(text: str) -> str:
    text = html.unescape(text)
    text = re.sub(r"\n{2,}", "\n", text)
    return text.strip()


def parse(html_text: str) -> list[dict]:
    parser = TableParser()
    parser.feed(html_text)
    out: list[dict] = []
    for row in parser.rows:
        if len(row) < 2:
            continue
        name_cell, effect_cell = row[0], row[1]
        if "戦法）" not in name_cell or "【戦法詳細】" not in effect_cell:
            continue
        name_match = re.search(r"^(.+?)（([SABC])戦法）", name_cell.replace("\n", " "))
        if not name_match:
            continue
        body = clean(effect_cell)
        rate = ""
        rate_match = re.search(r"【発動確率】(.+?)(?:\n|【戦法詳細】)", body, re.S)
        if rate_match:
            rate = clean(rate_match.group(1))
        detail_match = re.search(r"【戦法詳細】\s*(兵種|指揮|突撃|受動|能動)?\s*(.+?)(?:\n?【戦法種類】|$)", body, re.S)
        category = clean(detail_match.group(1) or "") if detail_match else ""
        description = clean(detail_match.group(2)) if detail_match else ""
        kind_match = re.search(r"【戦法種類】\s*(.+)$", body, re.S)
        kind_block = clean(kind_match.group(1)) if kind_match else ""
        related = re.findall(r"([一-龯ぁ-んァ-ヶーA-Za-z0-9]+)", kind_block)
        out.append({
            "name": clean(name_match.group(1)),
            "rarity": name_match.group(2),
            "activation_rate": rate,
            "category": category,
            "description": description,
            "kind": kind_block.split("\n", 1)[0] if kind_block else "",
            "related_heroes": related,
            "source_url": DEFAULT_URL,
        })
    return out


def main() -> None:
    rows = parse(fetch())
    GAME8_SKILLS_INDEX_JSON.parent.mkdir(parents=True, exist_ok=True)
    GAME8_SKILLS_INDEX_JSON.write_text(
        json.dumps(rows, ensure_ascii=False, indent=2),
        "utf-8",
    )
    print(f"[done] {len(rows)} Game8 skills -> {GAME8_SKILLS_INDEX_JSON}")


if __name__ == "__main__":
    main()
