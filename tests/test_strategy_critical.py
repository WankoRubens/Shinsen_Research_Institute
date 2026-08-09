import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class StrategyCriticalTest(unittest.TestCase):
    def test_josui_stacks_raise_strategy_critical_chance_not_flat_damage(self):
        source = (ROOT / "src" / "lib" / "battleSkillEffects.ts").read_text(encoding="utf-8")
        josui = source[source.index("case '如水': {"):source.index("case '比翼連理': {")]

        self.assertIn("specialState.strategyCriticalChance = nextStacks * 5", josui)
        self.assertNotIn("buffs.strategyDamageDealt", josui)

    def test_strategy_critical_chance_uses_the_final_damage_multiplier(self):
        source = (ROOT / "src" / "lib" / "battleBingxueEffects.ts").read_text(encoding="utf-8")

        self.assertIn("attacker.specialState.strategyCriticalChance ?? 0", source)
        self.assertIn("const criticalMultiplier = critical ? 1.5 + criticalBonus : 1", source)
        self.assertIn("Math.min(1, criticalChance)", source)


if __name__ == "__main__":
    unittest.main()
