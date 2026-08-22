import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class RequestedBattleEffectCorrectionsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.skills = (ROOT / "src/lib/battleSkillEffects.ts").read_text(encoding="utf-8")
        cls.unique = (ROOT / "src/lib/battleUniqueSkillEffects.ts").read_text(encoding="utf-8")
        cls.bingxue = (ROOT / "src/lib/battleBingxueEffects.ts").read_text(encoding="utf-8")
        cls.traits = (ROOT / "src/lib/battleTraitEffects.ts").read_text(encoding="utf-8")
        cls.simulator = (ROOT / "src/lib/battleSimulator.ts").read_text(encoding="utf-8")

    def test_skill_chances_and_target_labels_are_data_driven(self):
        self.assertIn("NANBAN_HEAL_BONUS_LABELS", self.skills)
        self.assertIn("ally.labels.some", self.skills)
        self.assertIn("attributeDependentChance(0.52", self.skills)
        self.assertIn("attributeDependentChance(0.45", self.skills)
        self.assertIn("h.statOf(ctx.caster, 'spd')", self.skills)
        self.assertIn("? 0.6", self.simulator)

    def test_temporary_skill_effects_have_expiry_or_clear_rules(self):
        self.assertIn("matazaIronWallCharges", self.simulator)
        self.assertIn("ittetsuIronWallUntil", self.unique)
        self.assertIn("buddhaActiveSkillActivationRateUntil", self.unique)
        self.assertIn("nextDamagePenaltyUntil", self.unique)
        self.assertIn("if (healed >= missingBefore)", self.unique)

    def test_bingxue_target_weights_and_limits(self):
        self.assertIn("return 1.2", self.bingxue)
        self.assertIn("doubleAttackUntil", self.bingxue)
        self.assertIn("bingxueRetaliationUses", self.bingxue)
        self.assertIn("friends[Math.floor(rng() * friends.length)]", self.bingxue)

    def test_named_traits_use_requested_rules(self):
        self.assertIn("commanderSkillEnabled", self.traits)
        self.assertIn("hasBattleTrait(target, '義の将')", self.traits)
        self.assertIn("helpers.heal(owner, owner, 200", self.traits)
        self.assertIn("traitControlResistanceCharges", self.traits)
        self.assertIn("bandoStackSequence", self.traits)
        self.assertIn("target.clan.replace", self.simulator)

    def test_removed_basic_skills_are_absent_from_frontend_data(self):
        skills = json.loads((ROOT / ".build/skills.json").read_text(encoding="utf-8"))
        names = {item.get("name_jp") or item.get("name") for item in skills}
        removed = {
            "臨時槍の鈴", "初級鼓舞", "初期激昂", "初級圧制", "初級撹乱",
            "初級治療", "勇武", "固陣", "速戦",
        }
        self.assertTrue(removed.isdisjoint(names))


if __name__ == "__main__":
    unittest.main()
