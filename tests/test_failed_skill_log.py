import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class FailedSkillLogTest(unittest.TestCase):
    def setUp(self):
        source = (ROOT / "src" / "lib" / "battleSimulator.ts").read_text(encoding="utf-8")
        self.try_skill = source[source.index("const trySkill = ("):source.index("const processPendingSkills = (")]

    def test_active_and_assault_logs_show_the_current_activation_rate(self):
        self.assertIn("resolvedSkillType === '能動' || resolvedSkillType === '突撃'", self.try_skill)
        self.assertIn(
            "message: `不発（${activationRateText(activationRate)}）`",
            self.try_skill,
        )
        self.assertIn(
            "message: `発動（${activationRateText(activationRate)}）`",
            self.try_skill,
        )

    def test_activation_log_keeps_the_skill_name_for_the_effect_column(self):
        self.assertIn("effect: resolvedSkillName", self.try_skill)

    def test_non_active_skill_types_do_not_emit_common_activation_rows(self):
        self.assertIn("if (!followUp && shouldLogActivation && logs !== NO_LOGS)", self.try_skill)


if __name__ == "__main__":
    unittest.main()
