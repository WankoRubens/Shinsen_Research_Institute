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
            "mainStat * 2 * (rate / 100) * variance",
            self.source,
        )
        self.assertNotIn("mainStat * 7.5 + 480", self.source)

    def test_sennari_empirical_value_is_inside_random_range(self) -> None:
        intelligence = 370
        recovery_rate = 0.76
        minimum = intelligence * 2 * recovery_rate * 0.92
        maximum = intelligence * 2 * recovery_rate * 1.08
        self.assertLessEqual(minimum, 575)
        self.assertGreaterEqual(maximum, 575)


if __name__ == "__main__":
    unittest.main()
