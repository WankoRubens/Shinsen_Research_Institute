import sys
import tempfile
import unittest
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "script"))

import build_frontend_data


class SanguoZhiMergeTest(unittest.TestCase):
    def test_fills_only_missing_profile_fields(self):
        source = {
            "明智光秀": {
                "name": "明智光秀",
                "source_url": "https://www.sanguo-zhi.com/entry/akechi/",
                "faction": "ブログ勢力",
                "gender": "男",
                "assembly_skill": "桔梗の政",
                "bingxue": {"武略": {"major": ["当意即妙"], "minor": []}},
                "traits": [],
            }
        }
        heroes = [
            {
                "name": "明智光秀",
                "name_jp": "明智光秀",
                "faction": "織田",
                "gender": "",
                "assembly_skill": None,
                "bingxue": None,
                "detail_url": "",
                "traits": [],
            }
        ]

        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "heroes.yaml"
            path.write_text(yaml.safe_dump(source, allow_unicode=True), "utf-8")
            original = build_frontend_data.SANGUO_ZHI_HEROES_YAML
            build_frontend_data.SANGUO_ZHI_HEROES_YAML = path
            try:
                merged, _stats = build_frontend_data._merge_sanguo_zhi_hero_fallbacks(heroes)
            finally:
                build_frontend_data.SANGUO_ZHI_HEROES_YAML = original

        self.assertEqual(merged[0]["faction"], "織田")
        self.assertEqual(merged[0]["gender"], "男")
        self.assertEqual(merged[0]["assembly_skill"], "桔梗の政")
        self.assertEqual(merged[0]["bingxue"]["武略"]["major"], ["当意即妙"])

    def test_matches_translated_traits_by_unlock_order(self):
        source = {
            "柿崎景家": {
                "name": "柿崎景家",
                "source_url": "https://www.sanguo-zhi.com/entry/s3-kakizaki/",
                "traits": [
                    {"name": "騎兵大将", "description": "日本語1", "unlock": "無凸"},
                    {"name": "先駆け", "description": "日本語2", "unlock": "1凸"},
                ],
            }
        }
        heroes = [
            {
                "name": "柿崎景家",
                "name_jp": "柿崎景家",
                "detail_url": "",
                "traits": [
                    {"name": "騎兵大將", "description": "繁体字1"},
                    {"name": "先驅", "description": "繁体字2"},
                ],
            }
        ]

        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "heroes.yaml"
            path.write_text(yaml.safe_dump(source, allow_unicode=True), "utf-8")
            original = build_frontend_data.SANGUO_ZHI_HEROES_YAML
            build_frontend_data.SANGUO_ZHI_HEROES_YAML = path
            try:
                merged, stats = build_frontend_data._merge_sanguo_zhi_hero_fallbacks(heroes)
            finally:
                build_frontend_data.SANGUO_ZHI_HEROES_YAML = original

        traits = merged[0]["traits"]
        self.assertEqual(len(traits), 2)
        self.assertEqual(traits[0]["name"], "騎兵大將")
        self.assertEqual(traits[0]["name_jp"], "騎兵大将")
        self.assertEqual(traits[0]["description_jp"], "日本語1")
        self.assertEqual(traits[0]["unlock"], "無凸")
        self.assertEqual(stats["traits_added"], 0)


if __name__ == "__main__":
    unittest.main()
