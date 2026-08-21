import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class BattleDescriptionAlignmentTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.effects = (ROOT / "src/lib/battleSkillEffects.ts").read_text(encoding="utf-8")
        cls.unique_effects = (ROOT / "src/lib/battleUniqueSkillEffects.ts").read_text(encoding="utf-8")
        cls.simulator = (ROOT / "src/lib/battleSimulator.ts").read_text(encoding="utf-8")

    def test_fixed_heal_does_not_roll_the_normal_healing_formula_again(self):
        block = re.search(r"case '一切皆空': \{(?P<body>.*?)\n\s*return true", self.unique_effects, re.S)
        self.assertIsNotNone(block)
        self.assertIn("total * 0.25 / factionAllies.length", block.group("body"))
        self.assertIn("h.healFixedBySkill", block.group("body"))
        self.assertNotIn("h.healBySkill", block.group("body"))
        self.assertIn("const healFixedBySkill", self.simulator)
        self.assertIn("return resolveSkillHealing(ctx, target, Math.max(0, amount))", self.simulator)

    def test_kokon_counter_runs_normal_attack_follow_ups(self):
        block = re.search(r"case '古今独歩': \{(?P<body>.*?)\n\s*return true", self.unique_effects, re.S)
        self.assertIsNotNone(block)
        self.assertIn("h.triggerNormalAttackFollowUps(ctx, ctx.target)", block.group("body"))
        self.assertIn("fireTriggeredSkillList(\n    ctx.caster,", self.simulator)
        self.assertIn("'afterNormalAttack'", self.simulator)

    def test_takeda_red_penalty_is_reserved_until_the_next_normal_attack(self):
        block = re.search(r"case '武田之赤備': \{(?P<body>.*?)(?=\n\s*case ')", self.unique_effects, re.S)
        self.assertIsNotNone(block)
        self.assertIn("takedaRedLeadershipPenaltyTurn = ctx.turn + 1", block.group("body"))
        self.assertNotIn("h.addTimedModifier", block.group("body"))
        self.assertIn("const applyPendingTakedaLeadershipPenalty", self.simulator)
        self.assertIn("trigger: 'afterNormalAttack'", self.simulator)

    def test_damage_shoulder_effects_use_the_recorded_enemy_or_ally(self):
        self.assertIn("damageShoulderEnemyRole", self.simulator)
        self.assertIn("damageShoulderEffect === 1 ? '表裏比興' : '樽俎折衝'", self.simulator)
        self.assertIn("damageShoulderEffect === 3 ? '捨て身の義' : '勇志不抜'", self.simulator)
        self.assertIn("ally.specialState.damageShoulderEffect = 3", self.effects)

    def test_penetration_reduces_leadership_instead_of_adding_final_damage(self):
        self.assertIn("const defenseStat = rawDefenseStat * (1 - physicalPenetration)", self.simulator)
        self.assertIn("stat === 'lea' ? 1 - physicalPenetration : 1", self.simulator)
        self.assertNotIn("conditionalMultiplier *= 1 + Math.max(0, caster.specialState.physicalPenetration", self.simulator)

    def test_actual_action_order_and_randomization_are_stable(self):
        self.assertIn("fighter.specialState.lastCompletedActionTurn === ctx.turn", self.effects)
        self.assertIn("actor.specialState.lastCompletedActionTurn = turn", self.simulator)
        self.assertIn("const shuffled = <T>", self.simulator)
        self.assertNotIn("sort(() => rng() - 0.5)", self.simulator)
        self.assertIn("const initiativeTieBreak = new Map", self.simulator)


if __name__ == "__main__":
    unittest.main()
