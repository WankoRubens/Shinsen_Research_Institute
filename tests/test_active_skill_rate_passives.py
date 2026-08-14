import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class ActiveSkillRatePassivesTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.effects = (ROOT / "src/lib/battleSkillEffects.ts").read_text(encoding="utf-8")
        cls.simulator = (ROOT / "src/lib/battleSimulator.ts").read_text(encoding="utf-8")

    def test_both_passives_run_once_during_the_preparation_turn(self):
        for name in ("一上一下", "一行三昧"):
            with self.subTest(name=name):
                self.assertIn(
                    f"{name}: defineBattleSkillMeta({{ type: '受動', triggers: ['preparationTurn'], replaceStructuredTriggers: true }})",
                    self.effects,
                )

    def test_each_skill_uses_its_max_level_bonus(self):
        cases = {"一上一下": 12, "一行三昧": 14}
        for name, bonus in cases.items():
            with self.subTest(name=name):
                start = self.effects.index(f"case '{name}': {{")
                end = self.effects.index("\n    case '", start + 1)
                effect = self.effects[start:end]
                self.assertIn(f"addActiveSkillActivationRateBonus(ctx, {bonus})", effect)
                self.assertNotIn("applyDatabaseSkillEffect", effect)

    def test_bonus_is_only_added_to_active_skills(self):
        self.assertIn("const activeSkillPassiveBonus = skillType === '能動'", self.simulator)
        self.assertIn("caster.specialState.activeSkillActivationRateBonus", self.simulator)
        self.assertIn("+ activeSkillPassiveBonus", self.simulator)

    def test_skill_database_marks_both_as_precisely_implemented(self):
        precise = self.effects.split("const PRECISE_HANDCRAFTED_SKILLS = new Set([", 1)[1].split("])", 1)[0]
        self.assertIn("'一上一下'", precise)
        self.assertIn("'一行三昧'", precise)


if __name__ == "__main__":
    unittest.main()
