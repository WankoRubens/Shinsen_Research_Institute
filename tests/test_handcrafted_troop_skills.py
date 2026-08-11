import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
EFFECTS = ROOT / "src" / "lib" / "battleSkillEffects.ts"
SIMULATOR = ROOT / "src" / "lib" / "battleSimulator.ts"
REPORT = ROOT / "docs" / "generic-battle-skills.md"

TROOP_SKILLS = {
    "伊賀忍者",
    "越後先手組",
    "甲斐弓騎兵",
    "薩摩鉄砲兵",
    "三河弓兵隊",
    "赤備え隊",
    "僧兵",
    "大太刀力士隊",
    "鉄砲僧兵",
    "母衣武者",
}


class HandcraftedTroopSkillsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.effects = EFFECTS.read_text(encoding="utf-8")
        cls.simulator = SIMULATOR.read_text(encoding="utf-8")
        cls.report = REPORT.read_text(encoding="utf-8")
        cls.manual = cls.effects.split("// DB戦法:", 1)[0]

    def test_all_troop_skills_have_one_manual_case(self):
        for name in TROOP_SKILLS:
            with self.subTest(name=name):
                self.assertEqual(1, len(re.findall(rf"case '{re.escape(name)}':", self.manual)))
                self.assertEqual(1, len(re.findall(rf"case '{re.escape(name)}':", self.effects)))

    def test_each_manual_case_documents_troop_type(self):
        for name in TROOP_SKILLS:
            with self.subTest(name=name):
                start = self.manual.index(f"case '{name}': {{")
                next_case = self.manual.find("\n    case '", start + 1)
                block = self.manual[start:next_case if next_case >= 0 else None]
                self.assertIn("// 戦法タイプ: 兵種", block)

    def test_team_wide_trigger_sets_include_reactive_skills(self):
        for name in ("伊賀忍者", "越後先手組", "僧兵", "鉄砲僧兵", "母衣武者"):
            self.assertRegex(self.effects, rf"TEAM_ACTION_BATTLE_SKILL_NAMES[\s\S]*?'{name}'")
        self.assertRegex(self.effects, r"TEAM_DAMAGE_RECEIVED_SKILL_NAMES[^\n]*三河弓兵隊")
        self.assertRegex(self.effects, r"TEAM_NORMAL_ATTACK_RECEIVED_SKILL_NAMES[^\n]*大太刀力士隊")

    def test_engine_contains_troop_specific_damage_hooks(self):
        for marker in (
            "activationRateBonus:${resolvedSkillName}",
            "satsumaStrategyNormalRate",
            "resolveRedArmorCriticalHit",
            "odachiReductionPercent",
            "monkNonBurnDotImmune",
        ):
            with self.subTest(marker=marker):
                self.assertIn(marker, self.simulator)

    def test_iga_speed_is_snapshotted_for_action_logs(self):
        self.assertIn("setPermanentBuffContribution(ally, 'spd', 'igaNinjaSpeed', 10)", self.effects)
        self.assertIn("const actionActorSpeed = statOf(actor, 'spd')", self.simulator)
        self.assertIn("entry.actionActorSpeed = actionActorSpeed", self.simulator)

    def test_kai_cavalry_logs_owner_and_final_activation_rate(self):
        start = self.manual.index("case '甲斐弓騎兵': {")
        next_case = self.manual.find("\n    case '", start + 1)
        block = self.manual[start:next_case if next_case >= 0 else None]
        self.assertIn("const beforeRate = h.activationRateOf(ally, firstActive)", block)
        self.assertIn("const afterRate = h.activationRateOf(ally, firstActive)", block)
        self.assertIn("${ally.name}の「${firstActiveName}」発動率", block)

    def test_completed_troop_skills_are_removed_from_generic_report(self):
        for name in TROOP_SKILLS:
            with self.subTest(name=name):
                self.assertNotIn(f"<strong>{name}</strong>", self.report)
        self.assertNotIn("## 兵種（", self.report)


if __name__ == "__main__":
    unittest.main()
