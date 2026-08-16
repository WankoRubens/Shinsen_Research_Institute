import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class NamedBattleTraitEffectsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.effects = (ROOT / "src/lib/battleTraitEffects.ts").read_text(encoding="utf-8")
        cls.simulator = (ROOT / "src/lib/battleSimulator.ts").read_text(encoding="utf-8")

    def test_normal_target_weights_use_requested_percentages(self):
        for name, multiplier in (
            ("剛猛I", "1.1"),
            ("剛猛II", "1.2"),
            ("剛猛III", "1.3"),
            ("忍耐I", "0.9"),
            ("忍耐II", "0.8"),
            ("忍耐III", "0.7"),
        ):
            self.assertIn(f"{name}: {multiplier}", self.effects)
        self.assertIn("if (mode === 'normal')", self.simulator)
        self.assertIn("traitNormalTargetWeight(fighter)", self.simulator)

    def test_casualty_traits_reduce_immediate_death_rate(self):
        self.assertIn("hasBattleTrait(fighter, '不死身')", self.effects)
        self.assertIn("hasBattleTrait(fighter, '無傷の誇り')", self.effects)
        self.assertIn("? 0.08 : 0.1", self.effects)
        self.assertIn("traitImmediateDeathRate(target)", self.simulator)

    def test_requested_flat_stat_traits_are_preparation_effects(self):
        self.assertIn("case '算盤勘定'", self.effects)
        self.assertIn("fighter.buffs.val = (fighter.buffs.val ?? 0) + 16", self.effects)
        self.assertIn("case '築城名手'", self.effects)
        self.assertIn("fighter.buffs.lea = (fighter.buffs.lea ?? 0) + 24", self.effects)

    def test_domestic_only_traits_remain_outside_battle_logic(self):
        for name in ("甲斐の虎", "立身出世", "禄寿応穏"):
            self.assertIn(f"'{name}'", self.effects)


if __name__ == "__main__":
    unittest.main()
