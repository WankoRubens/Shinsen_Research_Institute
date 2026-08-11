import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class ChokkanKankoSkillTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.effects = (ROOT / "src/lib/battleSkillEffects.ts").read_text(encoding="utf-8")
        cls.simulator = (ROOT / "src/lib/battleSimulator.ts").read_text(encoding="utf-8")
        start = cls.effects.index("case '直諫敢行': {")
        end = cls.effects.index("\n    case '", start + 1)
        cls.case = cls.effects[start:end]

    def test_uses_only_the_handcrafted_before_action_trigger(self):
        self.assertIn(
            "直諫敢行: defineBattleSkillMeta({ type: '能動', triggers: ['beforeAction'], replaceStructuredTriggers: true })",
            self.effects,
        )
        precise_start = self.effects.index("const PRECISE_HANDCRAFTED_SKILLS = new Set([")
        precise_end = self.effects.index("\n])", precise_start)
        self.assertIn("'直諫敢行'", self.effects[precise_start:precise_end])
        self.assertIn("replacesStructuredBattleTriggers(skill) ? []", self.simulator)

    def test_applies_intelligence_scaled_reduction_to_two_allies(self):
        self.assertIn("aliveRandom(ctx.allies, ctx.rng, ctx).slice(0, 2)", self.case)
        self.assertIn("attributeDependentValue(26, [h.statOf(ctx.caster, 'int')])", self.case)
        self.assertIn("addTimedModifier(ctx, target, 'damageTaken', -reduction, 2, 2)", self.case)
        self.assertNotIn("applyDatabaseBuffs", self.case)

    def test_logs_japanese_effect_and_total_reduction(self):
        self.assertIn("effect: '直諫敢行'", self.case)
        self.assertIn("の被ダメージを${reduction.toFixed(2)}%低下", self.case)
        self.assertIn("合計${totalReduction.toFixed(2)}%・2ターン", self.case)

    def test_first_turn_only_doubles_external_skill_bonus(self):
        self.assertIn("resolvedSkillName === '直諫敢行' && turn === 1", self.simulator)
        self.assertIn("externalSkillBonus * 2", self.simulator)
        self.assertIn("activationRateOf(caster, skill, turn)", self.simulator)


if __name__ == "__main__":
    unittest.main()
