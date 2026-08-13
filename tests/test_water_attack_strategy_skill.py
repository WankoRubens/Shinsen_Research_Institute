from pathlib import Path
import json
import unittest

import yaml


ROOT = Path(__file__).resolve().parents[1]
EFFECTS = ROOT / "src" / "lib" / "battleSkillEffects.ts"


class WaterAttackStrategySkillTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        source = EFFECTS.read_text(encoding="utf-8")
        cls.effect = source.split("case '水攻干計': {", 1)[1].split("case '時は今':", 1)[0]

    def test_healing_block_lasts_two_turns(self) -> None:
        self.assertIn("h.addControl(ctx, target, '回復不可', 2)", self.effect)

    def test_named_effect_is_registered_as_active_before_action_skill(self) -> None:
        source = EFFECTS.read_text(encoding="utf-8")
        self.assertIn(
            "水攻干計: defineBattleSkillMeta({ type: '能動', triggers: ['beforeAction'] })",
            source,
        )
        precise = source.split("const PRECISE_HANDCRAFTED_SKILLS = new Set([", 1)[1].split("])", 1)[0]
        self.assertIn("'水攻干計'", precise)

    def test_water_attack_is_strategy_dot_for_two_turns(self) -> None:
        self.assertIn("name: '水攻め'", self.effect)
        self.assertIn("turns: 2", self.effect)
        self.assertIn("dotRate: 98", self.effect)
        self.assertIn("dotType: 'strategy'", self.effect)

    def test_broken_one_turn_database_dot_is_not_used(self) -> None:
        self.assertNotIn("durationFromDatabase(ctx.skill, 1)", self.effect)
        self.assertNotIn("applyDatabaseDot(ctx, h)", self.effect)

    def test_generated_skill_data_keeps_both_effects_for_two_turns(self) -> None:
        overrides = yaml.safe_load((ROOT / "data" / "overrides.yaml").read_text(encoding="utf-8"))
        self.assertEqual(overrides["skills"]["水攻干計"]["dot_turns"], 2)
        self.assertEqual(overrides["skills"]["水攻干計"]["control_turns"], 2)

        skills = json.loads((ROOT / ".build" / "skills.json").read_text(encoding="utf-8"))
        skill = next(item for item in skills if item.get("name_jp") == "水攻干計")
        self.assertEqual(skill["dot_turns"], 2)
        self.assertEqual(skill["control_turns"], 2)


if __name__ == "__main__":
    unittest.main()
