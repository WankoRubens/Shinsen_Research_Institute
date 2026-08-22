import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class BattleSimulatorLineupPersistenceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = (ROOT / "src/views/BattleSimulator.vue").read_text(encoding="utf-8")

    def test_simulator_lineup_is_saved_and_restored(self):
        self.assertIn("BATTLE_LINEUP_STORAGE_KEY", self.source)
        self.assertIn("serializer.serializeLineup(simTeam)", self.source)
        self.assertIn("hydrateShareableTeam(saved", self.source)
        self.assertIn("restoreBattleSimulatorLineup()", self.source)

    def test_all_saved_groups_are_available_for_import(self):
        self.assertIn("groups.flatMap", self.source)
        self.assertIn("保存した編成を呼び出す", self.source)
        self.assertIn("保存した編成（共存編成・自由編成）", self.source)
        self.assertIn("copyLineupIntoSimulator(option.lineup)", self.source)

    def test_direct_entry_restores_group_storage(self):
        self.assertIn("restoreFromLocalStorage()", self.source)
        self.assertIn("enableAutosave()", self.source)


if __name__ == "__main__":
    unittest.main()
