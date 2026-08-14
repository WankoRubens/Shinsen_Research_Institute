import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class JyuuouChitotsuSkillTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.effects = (ROOT / "src/lib/battleSkillEffects.ts").read_text(encoding="utf-8")
        cls.simulator = (ROOT / "src/lib/battleSimulator.ts").read_text(encoding="utf-8")
        cls.overrides = (ROOT / "data/overrides.yaml").read_text(encoding="utf-8")

    def test_skill_has_a_manual_before_action_effect(self):
        self.assertIn(
            "縦横馳突: defineBattleSkillMeta({ type: '能動', triggers: ['beforeAction'], replaceStructuredTriggers: true })",
            self.effects,
        )
        start = self.effects.index("case '縦横馳突': {")
        end = self.effects.index("\n    case '", start + 1)
        effect = self.effects[start:end]
        self.assertIn("specialState.doubleAttackUntil", effect)
        self.assertIn("specialState['controlImmunityUntil:封撃']", effect)
        self.assertNotIn("h.addControl", effect)

    def test_combo_repeats_the_complete_normal_attack_sequence(self):
        self.assertIn(
            "const normalAttackCount = (actor.specialState.doubleAttackUntil ?? 0) >= turn ? 2 : 1",
            self.simulator,
        )
        self.assertIn(
            "normalAttackIndex < normalAttackCount",
            self.simulator,
        )

    def test_seal_immunity_blocks_new_seal_and_ignores_existing_seal(self):
        self.assertIn("hasControlImmunity(target, name, ctx.turn)", self.simulator)
        self.assertIn("!hasControlImmunity(actor, '封撃', turn)", self.simulator)

    def test_max_level_activation_rate_is_used(self):
        self.assertRegex(self.overrides, r"縦横馳突:\s+#[^\n]+\s+probability: 0\.4")


if __name__ == "__main__":
    unittest.main()
