import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class StrategyCriticalTest(unittest.TestCase):
    def test_josui_stacks_raise_strategy_critical_chance_not_flat_damage(self):
        source = (ROOT / "src" / "lib" / "battleSkillEffects.ts").read_text(encoding="utf-8")
        josui = source[source.index("case '如水': {"):source.index("case '比翼連理': {")]

        self.assertIn("setSpecialStateContribution(", josui)
        self.assertIn("'josuiStrategyCriticalChance'", josui)
        self.assertIn("nextStacks * 5", josui)
        self.assertNotIn("buffs.strategyDamageDealt", josui)

    def test_strategy_critical_chance_uses_the_final_damage_multiplier(self):
        source = (ROOT / "src" / "lib" / "battleBingxueEffects.ts").read_text(encoding="utf-8")

        self.assertIn("attacker.specialState.strategyCriticalChance ?? 0", source)
        self.assertIn("const criticalMultiplier = critical ? 1.5 + criticalBonus : 1", source)
        self.assertIn("Math.min(1, criticalChance)", source)

    def test_seventy_two_stratagem_adds_rate_and_critical_damage(self):
        source = (ROOT / "src" / "lib" / "battleSkillEffects.ts").read_text(encoding="utf-8")
        effect = source[source.index("case '七十二の計': {"):source.index("case '軍神': {")]

        self.assertIn("ctx.trigger !== 'preparationTurn'", effect)
        self.assertIn("'seventyTwoStrategyCriticalChance'", effect)
        self.assertIn("'seventyTwoStrategyCriticalDamageBonus'", effect)
        self.assertIn("seventyTwoCriticalHits = 0", effect)
        self.assertIn("seventyTwoBurstTriggered = 0", effect)
        self.assertNotIn("dealSkillDamage", effect)

    def test_seventh_critical_hit_triggers_one_enemy_wide_attack(self):
        source = (ROOT / "src" / "lib" / "battleSimulator.ts").read_text(encoding="utf-8")
        resolver = source[
            source.index("function resolveSeventyTwoCriticalDamage("):
            source.index("const addHealingStock = (")
        ]

        self.assertIn("kind !== 'strategy' || !critical", resolver)
        self.assertIn("criticalHits < 7", resolver)
        self.assertIn("seventyTwoBurstTriggered = 1", resolver)
        self.assertIn("dealSkillDamage(burstContext, enemy, 120, 'strategy')", resolver)

    def test_seventy_two_bonus_is_added_to_strategy_critical_multiplier(self):
        source = (ROOT / "src" / "lib" / "battleBingxueEffects.ts").read_text(encoding="utf-8")

        self.assertIn("attacker.specialState.strategyCriticalDamageBonus ?? 0", source)
        self.assertIn("bingxueLevel(attacker, '奇謀') + skillCriticalDamageBonus", source)


if __name__ == "__main__":
    unittest.main()
