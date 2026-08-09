import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class JosuiTriggerGuardTest(unittest.TestCase):
    def test_ignored_heals_are_filtered_before_activation_is_recorded(self):
        source = (ROOT / "src" / "lib" / "battleSimulator.ts").read_text(encoding="utf-8")
        try_skill = source[source.index("const trySkill = ("):source.index("const processPendingSkills = (")]

        self.assertIn("trigger === 'onHealed'", try_skill)
        self.assertIn("resolvedSkillName === '如水'", try_skill)
        self.assertIn("turn <= 0", try_skill)
        self.assertIn("caster.specialState.josuiHealTurn === turn", try_skill)
        self.assertLess(
            try_skill.index("caster.specialState.josuiHealTurn === turn"),
            try_skill.index("recordActivation(stats, caster, skill)"),
        )


if __name__ == "__main__":
    unittest.main()
