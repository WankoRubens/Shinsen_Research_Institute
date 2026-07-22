import sys
import unittest
from pathlib import Path

from bs4 import BeautifulSoup

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "script"))

from crawl_sanguo_zhi_heroes import discover_article_links, extract_hero_article


SAMPLE_HTML = """
<html><body>
  <h1>【信長の野望真戦】佐竹義重の解説＆編成例【PK/S4】</h1>
  <h2>PKシーズン武将：佐竹義重</h2>
  <h2>武将基本情報</h2>
  <table>
    <tr><th>項目</th><th>内容</th></tr>
    <tr><td>勢力</td><td>群雄</td></tr>
    <tr><td>家門</td><td>佐竹家</td></tr>
    <tr><td>コスト</td><td>7</td></tr>
    <tr><td>武勇</td><td>88（+2.31）</td></tr>
    <tr><td>統率</td><td>88（+1.68）</td></tr>
    <tr><td>政務</td><td>86（+1.72）</td></tr>
    <tr><td>知略</td><td>83（+1.37）</td></tr>
    <tr><td>速度</td><td>61（+0.94）</td></tr>
    <tr><td>魅力</td><td>91（+2.01）</td></tr>
  </table>
  <h2>武将特性</h2>
  <table>
    <tr><th>凸数</th><th>特性名</th><th>効果</th><th>重要度</th></tr>
    <tr><td>無凸</td><td>坂東太郎</td><td>武勇が増加する</td><td>☆☆☆☆</td></tr>
    <tr><td>1凸</td><td>弓砲術Ⅱ</td><td>弓兵・鉄砲レベルが2増加</td><td>☆☆☆☆</td></tr>
  </table>
  <h2>固有戦法：鬼義重（能動戦法・発動確率35％）</h2>
  <h2>戦法伝授：威風凜々（突撃戦法・発動確率35％）</h2>
</body></html>
"""


class ExtractHeroArticleTest(unittest.TestCase):
    def test_extracts_individual_hero_article(self):
        result = extract_hero_article(
            BeautifulSoup(SAMPLE_HTML, "html.parser"),
            "https://www.sanguo-zhi.com/entry/satake-yoshishige/",
        )

        self.assertIsNotNone(result)
        assert result is not None
        self.assertEqual(result["name"], "佐竹義重")
        self.assertEqual(result["faction"], "群雄")
        self.assertEqual(result["clan"], "佐竹家")
        self.assertEqual(result["cost"], 7)
        self.assertEqual(result["level1_stats"]["val"], 88)
        self.assertEqual(result["growth"]["val"], 2.31)
        self.assertEqual(result["unique_skill"], "鬼義重")
        self.assertEqual(result["teachable_skill"], "威風凜々")
        self.assertEqual(
            [trait["name"] for trait in result["traits"]],
            ["坂東太郎", "弓砲術Ⅱ"],
        )

    def test_ignores_non_hero_article(self):
        soup = BeautifulSoup(
            "<h1>【信長の野望真戦】ダメージ検証</h1><p>本文</p>",
            "html.parser",
        )
        self.assertIsNone(
            extract_hero_article(soup, "https://www.sanguo-zhi.com/entry/damage-01/"),
        )

    def test_extracts_traits_from_legacy_paragraphs(self):
        soup = BeautifulSoup(
            """
            <h1>【信長の野望真戦】立花誾千代の解説＆編成例</h1>
            <h2>シーズン3限定武将：立花誾千代</h2>
            <h3>武将特性</h3>
            <p>無凸：<strong>近衛斉射</strong> 通常攻撃後、対象を麻痺にする</p>
            <p>1凸：<strong>姫家督</strong> 兵力を回復する</p>
            <h3>固有戦法：疾風迅雷</h3>
            """,
            "html.parser",
        )
        result = extract_hero_article(
            soup,
            "https://www.sanguo-zhi.com/entry/tachibana-gintiyo/",
        )

        self.assertIsNotNone(result)
        assert result is not None
        self.assertEqual(result["name"], "立花誾千代")
        self.assertEqual(result["traits"][0]["name"], "近衛斉射")
        self.assertEqual(result["traits"][0]["unlock"], "無凸")
        self.assertEqual(result["traits"][0]["description"], "通常攻撃後、対象を麻痺にする")

    def test_stops_category_paging_at_404(self):
        class Response:
            status_code = 404

        class Session:
            def get(self, *_args, **_kwargs):
                error = __import__("requests").HTTPError("not found")
                error.response = Response()
                raise error

        self.assertEqual(
            discover_article_links(
                Session(),
                "https://www.sanguo-zhi.com/entry/category/sample/",
                max_pages=20,
                timeout=1,
            ),
            [],
        )


if __name__ == "__main__":
    unittest.main()
