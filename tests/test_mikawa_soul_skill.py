import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class MikawaSoulSkillTest(unittest.TestCase):
    def test_generated_skill_data_has_verified_values(self):
        skills = json.loads((ROOT / ".build" / "skills.json").read_text(encoding="utf-8"))
        skill = next(item for item in skills if item.get("name_jp") == "三河魂")

        self.assertEqual("onNormalAttackReceived", skill["trigger"])
        self.assertEqual(0.025, skill["vars"]["stat_reduction_rate"]["max"])
        self.assertEqual(8, skill["vars"]["max_stacks"])
        self.assertEqual(0.8, skill["vars"]["guard_chance"]["max"])
        self.assertEqual(1, skill["vars"]["guard_duration"])

    def test_team_reaction_and_guard_redirection_are_connected(self):
        effects = (ROOT / "src" / "lib" / "battleSkillEffects.ts").read_text(encoding="utf-8")
        simulator = (ROOT / "src" / "lib" / "battleSimulator.ts").read_text(encoding="utf-8")

        self.assertIn("三河魂: defineBattleSkillMeta({ type: '指揮', triggers: ['onNormalAttackReceived'] })", effects)
        watcher_line = next(
            line for line in effects.splitlines()
            if "TEAM_NORMAL_ATTACK_RECEIVED_SKILL_NAMES = new Set" in line
        )
        self.assertIn("'三河魂'", watcher_line)
        self.assertIn("'月華鶴影'", watcher_line)
        self.assertIn("case '三河魂': {", effects)
        self.assertIn("attacked.id !== ctx.caster.id", effects)
        self.assertIn("stacks >= maxStacks", effects)
        self.assertIn("ctx.caster.role === 'main'", effects)
        self.assertIn("ctx.caster.statuses['援護']", effects)
        self.assertIn("redirectGuardedNormalAttack", simulator)
        self.assertIn("TEAM_NORMAL_ATTACK_RECEIVED_SKILL_NAMES.has", simulator)


if __name__ == "__main__":
    unittest.main()
