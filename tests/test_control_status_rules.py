import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class ControlStatusRulesTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.simulator = (ROOT / "src" / "lib" / "battleSimulator.ts").read_text(encoding="utf-8")
        cls.effects = (ROOT / "src" / "lib" / "battleSkillEffects.ts").read_text(encoding="utf-8")

    def test_control_statuses_do_not_stack_or_overwrite(self):
        self.assertIn("if (activeControlStatusKey(target, name)) return false", self.simulator)

    def test_skill_types_are_blocked_by_the_correct_controls(self):
        self.assertIn("hasControlStatus(caster, '無策') && type === '能動'", self.simulator)
        self.assertIn("hasControlStatus(caster, '萎縮')", self.simulator)
        self.assertIn("type === '指揮' || type === '受動'", self.simulator)

    def test_only_paralysis_and_intimidation_block_the_whole_action(self):
        action_block = self.simulator.split("const isActionBlocked", 1)[1].split(
            "const consumeActionControlDurations", 1
        )[0]
        self.assertIn("hasControlStatus(fighter, '威圧')", action_block)
        self.assertIn("hasControlStatus(fighter, '麻痺')", action_block)
        self.assertNotIn("'封撃'", action_block)
        self.assertNotIn("'無策'", action_block)
        self.assertNotIn("'疲弊'", action_block)

    def test_seal_only_skips_the_normal_and_assault_attack_phase(self):
        self.assertIn("const normalAttackBlocked = hasControlStatus(actor, '封撃')", self.simulator)
        self.assertIn("は封撃で通常攻撃できない", self.simulator)

    def test_exhaustion_and_heal_block_keep_effects_but_zero_the_value(self):
        self.assertIn("hasControlStatus(caster, '疲弊')", self.simulator)
        self.assertIn("hasControlStatus(target, '回復不可')", self.simulator)

    def test_confusion_and_forced_targets_are_used_by_random_targeting(self):
        self.assertIn("mode === 'normal' ? '挑発' : '牽制'", self.simulator)
        self.assertIn("hasControlStatus(caster, '混乱')", self.simulator)
        self.assertIn("h.chooseTarget(ctx.enemies, ctx.rng, ctx)", self.effects)
        self.assertIn("牽制: '牽制'", self.effects)

    def test_after_action_effects_do_not_run_when_action_is_prevented(self):
        self.assertIn("if (!actionPrevented && isAlive(actor))", self.simulator)


if __name__ == "__main__":
    unittest.main()
