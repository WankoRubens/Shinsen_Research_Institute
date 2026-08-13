import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class BattleTraitEffectsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.effects = (ROOT / "src/lib/battleTraitEffects.ts").read_text(encoding="utf-8")
        cls.simulator = (ROOT / "src/lib/battleSimulator.ts").read_text(encoding="utf-8")
        cls.mock_battle = (ROOT / "src/views/MockBattle.vue").read_text(encoding="utf-8")

    def test_simple_stat_and_damage_series_are_registered(self):
        for name in (
            "武威", "知恵", "統帥", "急速", "破敵", "血気", "知謀", "攻勢",
            "猛攻", "謀攻", "牢固", "防護", "看破", "守勢", "固守", "堅固",
        ):
            self.assertIn(f"{name}:", self.effects)

    def test_attribute_percent_uses_battle_start_base_stat(self):
        self.assertIn("target.baseStats[effect.stat]", self.effects)
        self.assertIn("percentOfBaseStat: true", self.effects)

    def test_only_breakthrough_unlocked_traits_are_passed_to_battle(self):
        self.assertIn("role.breakthrough >= TRAIT_UNLOCK[index]", self.simulator)

    def test_traits_run_before_bingxue_and_preparation_skills(self):
        trait_call = self.simulator.index("fighters.forEach((fighter) => initializeTraitBattle(")
        bingxue_call = self.simulator.index("fighters.forEach((fighter) => initializeBingxueBattle(")
        preparation_call = self.simulator.index("fireTriggeredSkills(\n      fighter,\n      'preparationTurn'")
        self.assertLess(trait_call, bingxue_call)
        self.assertLess(trait_call, preparation_call)

    def test_preparation_log_has_separate_trait_section(self):
        self.assertIn("{ title: '特性の影響'", self.mock_battle)
        self.assertIn("entry.effect === '特性'", self.mock_battle)


if __name__ == "__main__":
    unittest.main()
