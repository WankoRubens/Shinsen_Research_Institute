import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class DotActionOrderTest(unittest.TestCase):
    def test_dots_run_at_each_fighter_action_start_before_other_effects(self):
        source = (ROOT / "src" / "lib" / "battleSimulator.ts").read_text(encoding="utf-8")
        battle_loop = source[source.index("for (let turn = 1;"):source.index("turnStats.push(turnStat)")]
        action_loop = battle_loop[battle_loop.index("for (const actor of order)"):]

        self.assertEqual(1, battle_loop.count("processDots("))
        self.assertLess(action_loop.index("processDots(actor"), action_loop.index("runBingxueTurnStart"))
        self.assertLess(action_loop.index("processDots(actor"), action_loop.index("processPendingSkills(actor"))
        self.assertLess(action_loop.index("processDots(actor"), action_loop.index("fireTriggeredSkills(actor, 'turnStart'"))
        self.assertLess(action_loop.index("processDots(actor"), action_loop.index("isActionBlocked(actor"))

    def test_dot_source_uses_fighter_id_before_name(self):
        simulator = (ROOT / "src" / "lib" / "battleSimulator.ts").read_text(encoding="utf-8")
        effects = (ROOT / "src" / "lib" / "battleSkillEffects.ts").read_text(encoding="utf-8")

        self.assertIn("sourceActorId?: string", simulator)
        self.assertIn("candidate.id === status.sourceActorId", simulator)
        self.assertIn("sourceActorId: caster.id", simulator)
        self.assertIn("sourceActorId: ctx.caster.id", effects)


if __name__ == "__main__":
    unittest.main()
