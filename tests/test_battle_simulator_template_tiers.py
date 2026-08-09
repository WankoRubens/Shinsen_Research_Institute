import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class BattleSimulatorTemplateTierTest(unittest.TestCase):
    def test_only_tier_zero_and_zero_point_five_are_simulated(self):
        source = (ROOT / "src" / "views" / "BattleSimulator.vue").read_text(encoding="utf-8")

        self.assertIn("new Set(['tier0', 'tier05'])", source)
        self.assertIn("const TEMPLATE_SIM_RUNS = 300", source)
        self.assertIn("const battleEnemyFormations = computed", source)
        self.assertIn("battleEnemyFormations.value.map((formation)", source)
        self.assertIn("battleEnemyFormations.value.length > 0", source)
        self.assertNotIn("matchupRows.value = enemyFormations.value.map", source)

    def test_enemy_formation_type_exposes_tier(self):
        source = (ROOT / "src" / "composables" / "useData.ts").read_text(encoding="utf-8")
        formation = source[source.index("export interface EnemyFormation {"):]

        self.assertIn("tier?: string", formation)


if __name__ == "__main__":
    unittest.main()
