import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "script"))

from trait_affinity import infer_troop_affinity  # noqa: E402


class TraitAffinityTest(unittest.TestCase):
    def test_single_troop_level(self):
        self.assertEqual(
            infer_troop_affinity("部隊の騎兵レベルが2増加"),
            {"troop_types": ["騎兵"], "level": 2, "level_cap_bonus": 0},
        )

    def test_multiple_troop_types_with_plus_notation(self):
        self.assertEqual(
            infer_troop_affinity("弓兵・鉄砲レベル+2"),
            {"troop_types": ["弓兵", "鉄砲"], "level": 2, "level_cap_bonus": 0},
        )

    def test_level_and_cap_bonus(self):
        self.assertEqual(
            infer_troop_affinity("部隊の足軽レベルが3、レベル上限が2増加"),
            {"troop_types": ["足軽"], "level": 3, "level_cap_bonus": 2},
        )

    def test_cap_only_trait(self):
        self.assertEqual(
            infer_troop_affinity("部隊の弓兵レベル上限+2"),
            {"troop_types": ["弓兵"], "level": 0, "level_cap_bonus": 2},
        )

    def test_chinese_template_vars_and_aliases(self):
        self.assertEqual(
            infer_troop_affinity(
                "部隊鐵炮等級增加{var:lv_up}，等級上限增加{var:cap_up}",
                {"lv_up": 3, "cap_up": 1},
            ),
            {"troop_types": ["鉄砲"], "level": 3, "level_cap_bonus": 1},
        )

    def test_unrelated_level_text_is_ignored(self):
        self.assertIsNone(infer_troop_affinity("10回レベルアップするごとに属性ポイントを獲得"))


if __name__ == "__main__":
    unittest.main()
