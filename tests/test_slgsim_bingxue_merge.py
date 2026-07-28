import sys
import tempfile
import unittest
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "script"))

import build_frontend_data  # noqa: E402


class SlgSimBingxueMergeTest(unittest.TestCase):
    def test_fills_missing_and_preserves_existing_bingxue(self):
        fallback_bingxue = {
            "武略": {"major": ["舟中敵国"], "minor": ["剛力"]},
        }
        source = {
            "heroes": {
                "未設定武将": {
                    "name": "未設定武将",
                    "source_url": "https://slgsim.com/hero/missing",
                    "bingxue": fallback_bingxue,
                },
                "設定済武将": {
                    "name": "設定済武将",
                    "source_url": "https://slgsim.com/hero/existing",
                    "bingxue": fallback_bingxue,
                },
            }
        }
        existing_bingxue = {
            "臨戦": {"major": ["達人大観"], "minor": ["協同"]},
        }
        heroes = [
            {"name": "未設定武将", "name_jp": "未設定武将", "bingxue": None},
            {"name": "設定済武将", "name_jp": "設定済武将", "bingxue": existing_bingxue},
        ]

        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "bingxue_heroes.yaml"
            path.write_text(yaml.safe_dump(source, allow_unicode=True), "utf-8")
            original = build_frontend_data.SLGSIM_BINGXUE_HEROES_YAML
            build_frontend_data.SLGSIM_BINGXUE_HEROES_YAML = path
            try:
                merged, stats = build_frontend_data._merge_slgsim_bingxue_fallbacks(heroes)
            finally:
                build_frontend_data.SLGSIM_BINGXUE_HEROES_YAML = original

        self.assertEqual(merged[0]["bingxue"], fallback_bingxue)
        self.assertEqual(merged[1]["bingxue"], existing_bingxue)
        self.assertEqual(stats["filled"], 1)
        self.assertEqual(stats["preserved"], 1)


if __name__ == "__main__":
    unittest.main()
