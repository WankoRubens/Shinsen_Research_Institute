import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
EFFECTS = ROOT / "src" / "lib" / "battleSkillEffects.ts"
UNIQUE_EFFECTS = ROOT / "src" / "lib" / "battleUniqueSkillEffects.ts"


class ExplicitNamedSkillTargetsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.effects = EFFECTS.read_text(encoding="utf-8")
        cls.unique_effects = UNIQUE_EFFECTS.read_text(encoding="utf-8")
        marker = "// DB戦法: ここから下"
        cls.named_database_cases = cls.effects[cls.effects.index(marker):]

    def test_named_database_cases_do_not_infer_targets_from_descriptions(self):
        self.assertNotIn("databaseTargets(ctx, h", self.named_database_cases)

    def test_unique_skill_cases_do_not_use_database_targets(self):
        self.assertNotIn("databaseTargets", self.unique_effects)

    def test_representative_cases_keep_explicit_targets_and_comments(self):
        for snippet in (
            "living(ctx.enemies).forEach((target) => {",
            "explicitEnemyTargets(ctx, h, 2)",
            "explicitAllyTargets(ctx, h, 2)",
            "const attacker = ctx.target",
            "const damaged = ctx.eventSubject",
        ):
            self.assertIn(snippet, self.named_database_cases)
        self.assertIn("// 戦法タイプ:", self.named_database_cases)


if __name__ == "__main__":
    unittest.main()
