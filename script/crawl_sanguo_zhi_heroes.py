"""Crawl Japanese hero details used only when the primary Game8 data is absent.

The category contains guides and verification articles as well as hero pages.
Only articles with a recognizable hero information or trait table are emitted.
The build pipeline treats this output as a missing-field fallback and never lets
it overwrite an existing Game8, manual override, or cfg value.
"""

from __future__ import annotations

import argparse
import json
import random
import re
import time
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
import yaml
from bs4 import BeautifulSoup
from tqdm import tqdm

from paths import CRAWL_CACHE_DIR, SANGUO_ZHI_HEROES_YAML


DEFAULT_CATEGORY_URL = (
    "https://www.sanguo-zhi.com/entry/category/"
    "%e4%bf%a1%e9%95%b7%e3%81%ae%e9%87%8e%e6%9c%9b%e7%9c%9f%e6%88%a6/"
)
DEFAULT_TIMEOUT = 20
SOURCE_HOST = "www.sanguo-zhi.com"
STAT_KEYS = {
    "統率": "lea",
    "武勇": "val",
    "知略": "int",
    "政務": "pol",
    "魅力": "cha",
    "速度": "spd",
}
HERO_TITLE_PATTERNS = (
    re.compile(r"(?:PKシーズン|シーズン\d+限定)?武将[：:]\s*([^｜|]+)$"),
    re.compile(r"[】」]\s*(.+?)(?:の解説|を詳細解説)"),
)
SKILL_HEADING_PATTERNS = {
    "unique_skill": re.compile(r"^固有戦法[：:]\s*([^（(｜|]+)"),
    "teachable_skill": re.compile(r"^(?:戦法伝授|伝授戦法)[：:]\s*([^（(｜|]+)"),
}


def validate_source_url(url: str) -> str:
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise ValueError(f"Invalid scheme: {parsed.scheme}")
    if parsed.netloc != SOURCE_HOST:
        raise ValueError(f"Unexpected host: {parsed.netloc}, expected {SOURCE_HOST}")
    if not parsed.path.startswith("/entry/"):
        raise ValueError(f"Unexpected path: {parsed.path}")
    return url


def fetch_page(
    session: requests.Session,
    url: str,
    *,
    timeout: float = DEFAULT_TIMEOUT,
) -> BeautifulSoup:
    validate_source_url(url)
    response = session.get(
        url,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/126.0 Safari/537.36"
            ),
            "Accept-Language": "ja,en;q=0.7",
        },
        timeout=timeout,
    )
    response.raise_for_status()
    return BeautifulSoup(response.text, "html.parser")


def _clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def _page_url(category_url: str, page: int) -> str:
    if page <= 1:
        return category_url
    return urljoin(category_url.rstrip("/") + "/", f"page/{page}/")


def extract_article_links(soup: BeautifulSoup) -> list[str]:
    """Return only article cards rendered by the requested category page.

    Hatena also renders recent posts and navigation links on category pages.
    Restricting the selector to the category's post-list cards guarantees that
    fallback data never comes from another category.
    """
    links: list[str] = []
    seen: set[str] = set()
    for anchor in soup.select("a.p-postList__link[href]"):
        href = anchor.get("href", "")
        parsed = urlparse(href)
        if parsed.netloc != SOURCE_HOST or not parsed.path.startswith("/entry/"):
            continue
        if parsed.path.startswith("/entry/category/"):
            continue
        clean = href.split("#", 1)[0]
        if clean not in seen:
            seen.add(clean)
            links.append(clean)
    return links


def discover_article_links(
    session: requests.Session,
    category_url: str,
    *,
    max_pages: int,
    timeout: float,
) -> list[str]:
    links: list[str] = []
    seen: set[str] = set()
    for page in range(1, max_pages + 1):
        try:
            soup = fetch_page(session, _page_url(category_url, page), timeout=timeout)
        except requests.HTTPError as error:
            if error.response is not None and error.response.status_code == 404:
                break
            raise
        page_links = extract_article_links(soup)
        new_links = [link for link in page_links if link not in seen]
        if not new_links:
            break
        links.extend(new_links)
        seen.update(new_links)
    return links


def _table_rows(table) -> list[list[str]]:
    rows: list[list[str]] = []
    for row in table.select("tr"):
        cells = [_clean_text(cell.get_text(" ", strip=True)) for cell in row.select("th,td")]
        if cells:
            rows.append(cells)
    return rows


def _pairs_from_basic_table(rows: list[list[str]]) -> dict[str, str]:
    values: dict[str, str] = {}
    for row in rows:
        if len(row) == 2 and row[0] != "項目":
            values[row[0]] = row[1]
        elif len(row) > 2:
            for index in range(0, len(row) - 1, 2):
                if row[index] != "項目":
                    values[row[index]] = row[index + 1]
    return values


def _parse_stat(value: str) -> tuple[float | None, float | None]:
    match = re.search(
        r"(-?\d+(?:\.\d+)?)\s*(?:[（(]\s*[+＋]\s*(-?\d+(?:\.\d+)?)\s*[）)])?",
        value,
    )
    if not match:
        return None, None
    base = float(match.group(1))
    growth = float(match.group(2)) if match.group(2) else None
    return base, growth


def extract_basic_info(soup: BeautifulSoup) -> dict:
    for table in soup.select("table"):
        rows = _table_rows(table)
        values = _pairs_from_basic_table(rows)
        stat_hits = sum(1 for label in STAT_KEYS if label in values)
        if "コスト" not in values or stat_hits < 3:
            continue

        info: dict = {}
        for source, target in (("勢力", "faction"), ("家門", "clan")):
            if values.get(source):
                info[target] = values[source]
        if re.fullmatch(r"\d+", values.get("コスト", "")):
            info["cost"] = int(values["コスト"])

        level1: dict[str, float] = {}
        growth: dict[str, float] = {}
        for label, key in STAT_KEYS.items():
            base, per_level = _parse_stat(values.get(label, ""))
            if base is not None:
                level1[key] = base
            if per_level is not None:
                growth[key] = per_level
        if level1:
            info["level1_stats"] = level1
        if growth:
            info["growth"] = growth
        return info
    return {}


def extract_traits(soup: BeautifulSoup) -> list[dict]:
    for table in soup.select("table"):
        rows = _table_rows(table)
        header_index = next(
            (
                index
                for index, row in enumerate(rows)
                if "特性名" in row and "効果" in row and "凸数" in row
            ),
            None,
        )
        if header_index is None:
            continue
        headers = rows[header_index]
        traits: list[dict] = []
        for row in rows[header_index + 1 :]:
            if len(row) < len(headers):
                continue
            record = dict(zip(headers, row))
            name = record.get("特性名", "").strip()
            description = record.get("効果", "").strip()
            if not name or not description:
                continue
            trait = {
                "name": name,
                "description": description,
                "unlock": record.get("凸数", ""),
            }
            if record.get("重要度"):
                trait["importance"] = record["重要度"]
            traits.append(trait)
        return traits

    heading = next(
        (
            node
            for node in soup.select("h2,h3,h4")
            if _clean_text(node.get_text(" ", strip=True)) == "武将特性"
        ),
        None,
    )
    if heading is None:
        return []

    traits: list[dict] = []
    for sibling in heading.next_siblings:
        tag_name = getattr(sibling, "name", None)
        if tag_name in ("h1", "h2", "h3", "h4"):
            break
        if tag_name != "p":
            continue
        text = _clean_text(sibling.get_text(" ", strip=True))
        unlock_match = re.match(r"^(無凸|\d+凸)[：:]\s*", text)
        name_node = sibling.find("strong")
        name = _clean_text(name_node.get_text(" ", strip=True)) if name_node else ""
        if not unlock_match or not name:
            continue
        remainder = text[unlock_match.end() :]
        if remainder.startswith(name):
            remainder = remainder[len(name) :].strip(" 　:：-")
        if not remainder:
            continue
        traits.append(
            {
                "name": name,
                "description": remainder,
                "unlock": unlock_match.group(1),
            }
        )
    return traits


def extract_hero_name(soup: BeautifulSoup) -> str:
    headings = [
        _clean_text(node.get_text(" ", strip=True))
        for node in soup.select("h2,h1,h3")
    ]
    for pattern in HERO_TITLE_PATTERNS:
        for heading in headings:
            match = pattern.search(heading)
            if match:
                name = _clean_text(match.group(1)).strip("【】[] ")
                if "＆" not in name and "&" not in name:
                    return name
    return ""


def extract_skill_names(soup: BeautifulSoup) -> dict:
    result: dict[str, str] = {}
    for node in soup.select("h2,h3,h4"):
        heading = _clean_text(node.get_text(" ", strip=True))
        for key, pattern in SKILL_HEADING_PATTERNS.items():
            match = pattern.search(heading)
            if match and key not in result:
                result[key] = _clean_text(match.group(1))
    return result


def extract_hero_article(soup: BeautifulSoup, source_url: str) -> dict | None:
    basic = extract_basic_info(soup)
    traits = extract_traits(soup)
    if not basic and not traits:
        return None

    name = extract_hero_name(soup)
    if not name:
        return None

    return {
        "name": name,
        "source_url": source_url,
        **basic,
        **extract_skill_names(soup),
        "traits": traits,
    }


def _cache_path(url: str) -> Path:
    slug = urlparse(url).path.strip("/").replace("/", "_")
    return CRAWL_CACHE_DIR / f"sanguo_zhi_{slug}.json"


def _load_cache(url: str) -> dict | None:
    path = _cache_path(url)
    if not path.exists():
        return None
    return json.loads(path.read_text("utf-8"))


def _save_cache(url: str, data: dict | None) -> None:
    CRAWL_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    _cache_path(url).write_text(
        json.dumps({"result": data}, ensure_ascii=False, indent=2),
        "utf-8",
    )


def crawl(
    *,
    category_url: str = DEFAULT_CATEGORY_URL,
    output_path: Path = SANGUO_ZHI_HEROES_YAML,
    max_pages: int = 20,
    timeout: float = DEFAULT_TIMEOUT,
    force: bool = False,
    name_filter: str | None = None,
) -> dict[str, dict]:
    category_url = validate_source_url(category_url)
    session = requests.Session()
    links = discover_article_links(
        session,
        category_url,
        max_pages=max_pages,
        timeout=timeout,
    )
    tqdm.write(f"[sanguo-zhi] Found {len(links)} category articles")

    heroes: dict[str, dict] = {}
    for url in tqdm(links, desc="sanguo-zhi", unit="article"):
        cached = None if force else _load_cache(url)
        if cached is not None:
            result = cached.get("result")
        else:
            soup = fetch_page(session, url, timeout=timeout)
            result = extract_hero_article(soup, url)
            _save_cache(url, result)
            time.sleep(random.random() * 0.35 + 0.25)

        if not result or (name_filter and name_filter not in result["name"]):
            continue
        heroes[result["name"]] = result

    # A targeted refresh must not erase previously crawled category heroes.
    # Full refreshes still mirror the currently discoverable category pages.
    if name_filter and output_path.exists():
        existing = yaml.safe_load(output_path.read_text("utf-8")) or {}
        existing.update(heroes)
        heroes = existing

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        yaml.safe_dump(heroes, allow_unicode=True, sort_keys=False),
        "utf-8",
    )
    tqdm.write(f"[sanguo-zhi] Saved {len(heroes)} heroes -> {output_path}")
    return heroes


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Crawl missing-field hero data from sanguo-zhi.com",
    )
    parser.add_argument("--url", default=DEFAULT_CATEGORY_URL, help="Category URL")
    parser.add_argument("--out", type=Path, default=SANGUO_ZHI_HEROES_YAML)
    parser.add_argument("--max-pages", type=int, default=20)
    parser.add_argument("--timeout", type=float, default=DEFAULT_TIMEOUT)
    parser.add_argument("--force", action="store_true", help="Ignore article cache")
    parser.add_argument("--name", help="Write only heroes containing this name")
    args = parser.parse_args()
    crawl(
        category_url=args.url,
        output_path=args.out,
        max_pages=args.max_pages,
        timeout=args.timeout,
        force=args.force,
        name_filter=args.name,
    )


if __name__ == "__main__":
    main()
