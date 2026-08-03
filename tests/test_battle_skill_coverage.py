import json
import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class BattleSkillCoverageTest(unittest.TestCase):
    def setUp(self):
        self.skills = json.loads((ROOT / ".build" / "skills.json").read_text(encoding="utf-8"))
        self.effects_source = (ROOT / "src" / "lib" / "battleSkillEffects.ts").read_text(encoding="utf-8")

    def test_every_skill_has_a_japanese_description(self):
        missing = [skill["name"] for skill in self.skills if not str(skill.get("description_jp") or "").strip()]
        self.assertEqual([], missing)

    def test_every_skill_has_an_individual_case(self):
        case_names = set(re.findall(r"case '([^']+)'", self.effects_source))
        missing = [
            skill["name"]
            for skill in self.skills
            if skill.get("name") not in case_names and skill.get("name_jp") not in case_names
        ]
        self.assertEqual([], missing)

    def test_structured_battle_definitions_use_the_interpreter(self):
        structured_count = sum(1 for skill in self.skills if skill.get("battle"))
        self.assertGreater(structured_count, 0)
        self.assertIn("applyStructuredBattleSkillEffect", self.effects_source)
        self.assertIn("structuredBattleTriggers", self.effects_source)


if __name__ == "__main__":
    unittest.main()
