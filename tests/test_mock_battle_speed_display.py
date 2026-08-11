import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MOCK_BATTLE = ROOT / "src" / "views" / "MockBattle.vue"


class MockBattleSpeedDisplayTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = MOCK_BATTLE.read_text(encoding="utf-8")

    def test_action_block_uses_runtime_speed_snapshot(self):
        self.assertIn("speed: entry.actionActorSpeed", self.source)

    def test_speed_is_formatted_to_two_decimal_places(self):
        self.assertIn("block.speed.toFixed(2)", self.source)
        self.assertIn("role?.stats.spd ?? 0).toFixed(2)", self.source)


if __name__ == "__main__":
    unittest.main()
