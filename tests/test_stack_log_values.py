import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class StackLogValueTest(unittest.TestCase):
    def test_stack_logs_show_cumulative_values_instead_of_counts(self):
        source = (ROOT / "src" / "lib" / "battleSkillEffects.ts").read_text(encoding="utf-8")

        self.assertIn("武勇+${totalValorIncrease.toFixed(2)}", source)
        self.assertIn("知略+${totalIntelligenceIncrease.toFixed(2)}", source)
        self.assertIn("計略ダメージで武勇+${totalValorIncrease}", source)
        self.assertIn("兵刃ダメージで知略+${totalIntelligenceIncrease}", source)
        self.assertIn("計略与ダメージ+${nextStacks * 5}%", source)
        self.assertNotRegex(source, re.compile(r"\$\{next(?:Buff)?Stacks\}/(?:4|5|8)"))


if __name__ == "__main__":
    unittest.main()
