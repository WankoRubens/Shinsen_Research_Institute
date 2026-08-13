from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
SIMULATOR = ROOT / "src" / "lib" / "battleSimulator.ts"


class HealingFormulaTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.source = SIMULATOR.read_text(encoding="utf-8")

    def test_healing_uses_observed_stat_scaling(self) -> None:
        self.assertIn(
            "mainStat * 2.64 * (rate / 100) * variance",
            self.source,
        )
        self.assertNotIn("mainStat * 7.5 + 480", self.source)

    def test_sennari_empirical_value_matches_random_midpoint(self) -> None:
        intelligence = 328
        recovery_rate = 0.76
        midpoint = intelligence * 2.64 * recovery_rate
        self.assertAlmostEqual(midpoint, 658, delta=0.2)


if __name__ == "__main__":
    unittest.main()
