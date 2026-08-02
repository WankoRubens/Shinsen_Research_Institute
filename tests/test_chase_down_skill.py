import unittest
from pathlib import Path

import yaml


ROOT = Path(__file__).resolve().parents[1]


class ChaseDownSkillTest(unittest.TestCase):
    def test_skill_data_uses_japanese_name_and_existing_flinch_status(self):
        overrides = yaml.safe_load((ROOT / "data" / "overrides.yaml").read_text(encoding="utf-8"))
        skill = overrides["skills"]["追亡逐北"]

        self.assertEqual(skill["name_jp"], "追い崩し")
        self.assertEqual(skill["activation_rate"], "35%")
        self.assertEqual(skill["battle"]["rate"], 0.35)
        self.assertEqual(skill["battle"]["do"][0]["do"][1]["status"], "畏縮")

    def test_named_effect_and_flinch_activation_block_are_connected(self):
        effects = (ROOT / "src" / "lib" / "battleSkillEffects.ts").read_text(encoding="utf-8")
        simulator = (ROOT / "src" / "lib" / "battleSimulator.ts").read_text(encoding="utf-8")

        effect_block = effects.split("case '追い崩し':", 1)[1].split("case '伊達風采':", 1)[0]
        self.assertIn("h.dealSkillDamage(ctx, target, 146, 'strategy')", effect_block)
        self.assertIn("h.addControl(ctx, target, '畏縮', 1)", effect_block)
        self.assertIn("resolvedSkillType === '指揮' || resolvedSkillType === '受動'", simulator)
        self.assertIn("は畏縮で発動できない", simulator)
        self.assertIn("if (key === '畏縮') return", simulator)
        self.assertIn("actor.statuses['畏縮'] -= 1", simulator)


if __name__ == "__main__":
    unittest.main()
