import sys
import unittest
from pathlib import Path

from bs4 import BeautifulSoup

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "script"))

from crawl_slgsim_bingxue import (  # noqa: E402
    DIRECTIONS,
    extract_hero_bingxue,
    extract_hero_links,
    extract_wiki_hero_names,
    normalize_bingxue_directions,
)


def _direction_html(direction: str) -> str:
    major = "".join(
        f'<div><span class="option">{direction}奇{i}</span><div>説明</div></div>'
        for i in range(1, 4)
    )
    minor = "".join(
        f'<div><span class="option">{direction}正{i}</span><div>説明</div></div>'
        for i in range(1, 7)
    )
    return f"""
      <div>
        <h4>{direction}</h4>
        <div class="space-y-2">
          <div class="flex items-start gap-2">
            <span>奇</span><div>{major}</div>
          </div>
          <div class="flex items-start gap-2">
            <span>正</span><div>{minor}</div>
          </div>
        </div>
      </div>
    """


class SlgSimBingxueCrawlerTest(unittest.TestCase):
    def test_extracts_index_links_by_visible_hero_name(self):
        soup = BeautifulSoup(
            """
            <a href="hero/takenakahanbee.html"><h3>竹中半兵衛</h3></a>
            <a href="/skills"><h3>戦法</h3></a>
            """,
            "html.parser",
        )
        self.assertEqual(
            extract_hero_links(soup),
            {"竹中半兵衛": "https://slgsim.com/hero/takenakahanbee.html"},
        )

    def test_extracts_all_four_validated_directions(self):
        html = (
            "<h1>確認武将</h1><section><h2>兵学</h2>"
            + "".join(_direction_html(direction) for direction in DIRECTIONS)
            + "</section>"
        )
        name, bingxue = extract_hero_bingxue(BeautifulSoup(html, "html.parser"))

        self.assertEqual(name, "確認武将")
        self.assertEqual(set(bingxue), set(DIRECTIONS))
        for direction in DIRECTIONS:
            self.assertEqual(len(bingxue[direction]["major"]), 3)
            self.assertEqual(len(bingxue[direction]["minor"]), 6)

    def test_extracts_hero_names_from_sanguo_zhi_wiki(self):
        soup = BeautifulSoup(
            """
            <a href="/wiki/general/takenakahanbee/">T3 竹中半兵衛</a>
            <a href="/wiki/general/horinaomasa/">堀直政</a>
            <a href="/wiki/general/?kana=ハ">ハ</a>
            """,
            "html.parser",
        )
        self.assertEqual(
            extract_wiki_hero_names(soup),
            {"竹中半兵衛", "堀直政"},
        )

    def test_normalizes_a_known_option_to_its_verified_direction(self):
        normalized = normalize_bingxue_directions({
            "臨戦": {
                "major": ["離間の計"],
                "minor": [],
            },
        })
        self.assertEqual(normalized["機略"]["major"], ["離間の計"])
        self.assertEqual(normalized["臨戦"]["major"], [])


if __name__ == "__main__":
    unittest.main()
