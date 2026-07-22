import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "script"))

from bingxue_categories import (  # noqa: E402
    BINGXUE_CATEGORY_OPTIONS,
    BINGXUE_OPTION_TO_DIRECTION,
)
from build_frontend_data import normalize_hero_bingxue  # noqa: E402


class BingxueCategoryTest(unittest.TestCase):
    def test_verified_list_has_60_unique_options(self):
        options = [
            option
            for category_options in BINGXUE_CATEGORY_OPTIONS.values()
            for option in category_options
        ]
        self.assertEqual(len(options), 60)
        self.assertEqual(len(set(options)), 60)

    def test_key_options_match_their_verified_categories(self):
        self.assertEqual(BINGXUE_OPTION_TO_DIRECTION["詭計百出"], "機略")
        self.assertEqual(BINGXUE_OPTION_TO_DIRECTION["手当の心得"], "臨戦")

    def test_hero_options_are_regrouped_by_name(self):
        source = {
            "臨戦": {"major": ["詭計百出"], "minor": ["多謀"]},
            "機略": {"major": ["手当の心得"], "minor": ["仁愛"]},
        }

        self.assertEqual(
            normalize_hero_bingxue(source),
            {
                "機略": {"major": ["詭計百出"], "minor": ["多謀"]},
                "臨戦": {"major": ["手当の心得"], "minor": ["仁愛"]},
            },
        )


if __name__ == "__main__":
    unittest.main()
