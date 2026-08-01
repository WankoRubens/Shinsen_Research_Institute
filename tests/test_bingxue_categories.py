import sys
import re
import unittest
from pathlib import Path

import yaml


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

    def test_battle_engine_registers_every_bingxue_option(self):
        source = (ROOT / "src" / "lib" / "battleBingxueEffects.ts").read_text(encoding="utf-8")
        registered_block = source.split("IMPLEMENTED_BINGXUE_NAMES = new Set([", 1)[1].split("])", 1)[0]
        registered = set(re.findall(r"'([^']+)'", registered_block))
        self.assertEqual(registered, set(BINGXUE_OPTION_TO_DIRECTION))

    def test_counterattack_strategy_uses_control_hook_without_use_limit(self):
        source = (ROOT / "src" / "lib" / "battleBingxueEffects.ts").read_text(encoding="utf-8")
        effect_block = source.split("// 返り討ちの計:", 1)[1].split("// 不惑:", 1)[0]
        self.assertIn("roll(rng, 0.9)", effect_block)
        self.assertIn("'val') > helpers.statOf(target, 'int')", effect_block)
        self.assertNotIn("bingxueCounterUses", effect_block)

    def test_morale_break_reduces_attacker_stats_for_one_turn(self):
        source = (ROOT / "src" / "lib" / "battleBingxueEffects.ts").read_text(encoding="utf-8")
        effect_block = source.split("// 気勢崩し:", 1)[1].split("// 戦法による回復", 1)[0]
        self.assertIn("roll(rng, 0.5)", effect_block)
        self.assertIn("'val', -12, turn + 1", effect_block)
        self.assertIn("'int', -12, turn + 1", effect_block)

    def test_date_masamune_has_requested_major_options(self):
        overrides = yaml.safe_load((ROOT / "data" / "overrides.yaml").read_text(encoding="utf-8"))
        bingxue = overrides["heroes"]["伊達政宗"]["bingxue"]
        self.assertEqual(bingxue["武略"]["major"], ["舟中敵国", "当意即妙", "智勇兼備"])
        self.assertEqual(bingxue["陣立"]["major"], ["気勢崩し", "返り討ちの計", "生々流転"])
        self.assertEqual(bingxue["臨戦"]["major"], ["搦手の策", "心頭滅却", "達人大観"])
        self.assertEqual(bingxue["機略"]["major"], ["離間の計", "詭計百出", "破陣の勢い"])
        self.assertEqual(bingxue["武略"]["minor"], ["剛力", "豪勇", "妙策", "突貫", "胆力", "活路"])
        self.assertEqual(bingxue["陣立"]["minor"], ["慧眼", "俊才", "兵心", "乱戦", "逆境", "恩顧"])
        self.assertEqual(bingxue["臨戦"]["minor"], ["協同", "地利", "天時", "機動", "明鏡", "不惑"])
        self.assertEqual(bingxue["機略"]["minor"], ["神算", "鬼気", "早駆", "神秘", "多謀", "強靭"])


if __name__ == "__main__":
    unittest.main()
