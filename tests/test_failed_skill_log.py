import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class FailedSkillLogTest(unittest.TestCase):
    def test_failed_skill_log_keeps_the_skill_name_for_the_effect_column(self):
        source = (ROOT / "src" / "lib" / "battleSimulator.ts").read_text(encoding="utf-8")
        try_skill = source[source.index("const trySkill = ("):source.index("const processPendingSkills = (")]

        self.assertIn("effect: resolvedSkillName", try_skill)
        self.assertIn("message: `${resolvedSkillName}は不発`", try_skill)


if __name__ == "__main__":
    unittest.main()
