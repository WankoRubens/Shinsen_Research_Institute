import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class MockBattleLogToneTest(unittest.TestCase):
    def test_same_named_enemy_target_is_not_colored_as_the_actor(self):
        source = (ROOT / "src" / "views" / "MockBattle.vue").read_text(encoding="utf-8")

        self.assertIn("isActor && isTarget && entry.side !== entry.targetSide", source)
        self.assertIn("message.startsWith(`${name}の`, offset)", source)
        self.assertIn("sideNameTone(entry.targetSide!)", source)
        self.assertIn("message.matchAll(tokenPattern)", source)


if __name__ == "__main__":
    unittest.main()
