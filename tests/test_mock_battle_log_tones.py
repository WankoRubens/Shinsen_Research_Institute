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

    def test_status_logs_include_the_target_side(self):
        effects = (ROOT / "src" / "lib" / "battleSkillEffects.ts").read_text(encoding="utf-8")
        simulator = (ROOT / "src" / "lib" / "battleSimulator.ts").read_text(encoding="utf-8")

        self.assertIn("target: target?.name", effects)
        self.assertIn("targetSide: target?.side", effects)
        self.assertIn("`${target.name}に${ctx.skill.dot_name}(${turns}T)`, target", effects)
        self.assertIn("target: target.name", simulator)
        self.assertIn("targetSide: target.side", simulator)

    def test_old_status_logs_infer_the_opposing_side_and_color_the_status(self):
        source = (ROOT / "src" / "views" / "MockBattle.vue").read_text(encoding="utf-8")

        self.assertIn("const harmfulStatusPattern", source)
        self.assertIn("isHarmfulStatusTarget(name, offset, message)", source)
        self.assertIn("entry.side === 'ally' ? 'enemy' : 'ally'", source)
        self.assertIn("tone: 'status'", source)
        self.assertIn(".log-part--status", source)


if __name__ == "__main__":
    unittest.main()
