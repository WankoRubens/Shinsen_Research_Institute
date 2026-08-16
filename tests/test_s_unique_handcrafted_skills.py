import json
import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class SUniqueHandcraftedSkillsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.effects = (ROOT / "src/lib/battleSkillEffects.ts").read_text(encoding="utf-8")
        cls.unique_effects = (ROOT / "src/lib/battleUniqueSkillEffects.ts").read_text(encoding="utf-8")
        cls.simulator = (ROOT / "src/lib/battleSimulator.ts").read_text(encoding="utf-8")
        cls.skills = json.loads((ROOT / ".build/skills.json").read_text(encoding="utf-8"))

    def test_every_s_unique_skill_has_an_individual_case(self):
        sources = self.effects + self.unique_effects
        cases = set(re.findall(r"case '([^']+)'", sources))
        expected = {
            skill.get("name_jp") or skill.get("name")
            for skill in self.skills
            if skill.get("rarity") == "S" and skill.get("is_unique")
        }
        self.assertEqual([], sorted(expected - cases))

    def test_new_s_unique_cases_replace_generic_battle_nodes(self):
        self.assertIn("...S_UNIQUE_HANDCRAFTED_META", self.effects)
        self.assertIn("...S_UNIQUE_HANDCRAFTED_SKILL_NAMES", self.effects)
        self.assertIn("const uniqueResult = applySUniqueSkillEffect(ctx, h)", self.effects)
        self.assertIn("replaceStructuredTriggers: true", self.unique_effects)

    def test_cross_fighter_events_are_connected_to_the_simulator(self):
        for watcher in (
            "S_UNIQUE_ENEMY_ACTIVE_SKILL_WATCHERS",
            "S_UNIQUE_OWN_SKILL_WATCHERS",
            "S_UNIQUE_TEAM_DAMAGE_WATCHERS",
            "S_UNIQUE_TEAM_NORMAL_ATTACK_WATCHERS",
            "S_UNIQUE_TEAM_SKILL_WATCHERS",
        ):
            self.assertIn(watcher, self.simulator)

    def test_assault_skills_keep_their_own_activation_roll(self):
        self.assertIn("海道一: meta('突撃', ['afterNormalAttack'])", self.unique_effects)
        self.assertIn("天下御免: meta('突撃', ['afterNormalAttack'])", self.unique_effects)
        self.assertIn("鬼十河: meta('突撃', ['afterNormalAttack'])", self.unique_effects)
        self.assertIn("followUpTriggers: TriggerEvent[] = []", self.unique_effects)

    def test_named_cases_keep_explanatory_comments(self):
        case_count = len(re.findall(r"case '([^']+)'", self.unique_effects))
        comment_count = len(re.findall(r"\n\s*//", self.unique_effects))
        self.assertEqual(64, case_count)
        self.assertGreaterEqual(comment_count, case_count)


if __name__ == "__main__":
    unittest.main()
