import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class SkillSlotOrderTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.simulator = (ROOT / "src/lib/battleSimulator.ts").read_text(encoding="utf-8")

    def test_role_skills_start_in_unique_then_learned_slot_order(self):
        self.assertIn("const list = [uniqueSkill, role.skill1, role.skill2]", self.simulator)

    def test_same_type_uses_original_slot_index_instead_of_name(self):
        helper_start = self.simulator.index("const orderBattleItemsByTypeAndSlot")
        helper_end = self.simulator.index("\n\nconst findSkillByName", helper_start)
        helper = self.simulator[helper_start:helper_end]
        self.assertIn("a.slotIndex - b.slotIndex", helper)
        self.assertNotIn("localeCompare", helper)

    def test_normal_and_prepared_skills_share_slot_ordering(self):
        self.assertIn("orderBattleItemsByTypeAndSlot(skills, (skill) => skill)", self.simulator)
        self.assertIn("orderBattleItemsByTypeAndSlot(ready, (pending) => pending.skill)", self.simulator)


if __name__ == "__main__":
    unittest.main()
