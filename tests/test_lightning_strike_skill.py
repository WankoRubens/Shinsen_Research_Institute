import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
EFFECTS = ROOT / "src" / "lib" / "battleSkillEffects.ts"


class LightningStrikeSkillTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        source = EFFECTS.read_text(encoding="utf-8")
        start = source.index("case '霹靂一撃': {")
        end = source.index("\n    case '", start + 1)
        cls.skill_case = source[start:end]

    def test_uses_an_explicit_enemy_target_instead_of_database_targets(self):
        self.assertIn("h.chooseTarget(ctx.enemies, ctx.rng, ctx)", self.skill_case)
        self.assertIn("ctx.target.side !== ctx.caster.side", self.skill_case)
        self.assertNotIn("databaseTargets", self.skill_case)

    def test_applies_damage_and_paralysis_to_the_same_enemy(self):
        self.assertIn("h.dealSkillDamage(ctx, target, 228, 'physical')", self.skill_case)
        self.assertIn("h.addControl(ctx, target, '麻痺', 2)", self.skill_case)

    def test_grants_critical_chance_only_when_target_was_already_paralyzed(self):
        self.assertIn("const wasAlreadyParalyzed = (target.statuses['麻痺'] ?? 0) > 0", self.skill_case)
        self.assertIn("if (wasAlreadyParalyzed)", self.skill_case)
        self.assertIn(
            "h.addTimedModifier(ctx, ctx.caster, 'physicalCriticalChance', 50, 2)",
            self.skill_case,
        )
        self.assertLess(
            self.skill_case.index("const wasAlreadyParalyzed"),
            self.skill_case.index("h.addControl(ctx, target, '麻痺', 2)"),
        )


if __name__ == "__main__":
    unittest.main()
