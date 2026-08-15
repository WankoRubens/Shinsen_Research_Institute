import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class SixHandcraftedSkillsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.effects = (ROOT / "src/lib/battleSkillEffects.ts").read_text(encoding="utf-8")
        cls.simulator = (ROOT / "src/lib/battleSimulator.ts").read_text(encoding="utf-8")

    def skill_case(self, name: str) -> str:
        start = self.effects.index(f"case '{name}': {{")
        end = self.effects.index("\n    case '", start + 1)
        return self.effects[start:end]

    def test_new_life_uses_setup_turn_end_and_action_heal(self):
        case = self.skill_case("新生")
        self.assertIn("triggers: ['preparationTurn', 'turnEnd', 'beforeAction']", self.effects)
        self.assertIn("attributeDependentValue(14", case)
        self.assertIn("enemyHp / Math.max(1, enemyMaxHp) <= 0.7", case)
        self.assertIn("healBySkill(ctx, ctx.caster, 65, 'strategy')", case)
        self.assertIn("'turnEnd'", self.simulator)

    def test_time_is_now_keeps_the_five_dots_separate(self):
        case = self.skill_case("時は今")
        self.assertIn("TIME_IS_NOW_DOT_NAMES", case)
        self.assertIn("statusName === '潰走' ? 'physical' : 'strategy'", case)
        self.assertIn("dotRate: 56", case)
        self.assertIn("timeIsNowDotCleanseLock", case)
        self.assertIn("timeIsNowDotsLocked", self.effects)

    def test_lightning_thunder_is_limited_and_uses_paralysis_branch(self):
        case = self.skill_case("電光雷轟")
        self.assertIn("maxPerTurn: 1", self.effects)
        self.assertIn("targetAlreadyParalyzed", case)
        self.assertIn("ctx.caster.role === 'main' ? 60 : 52", case)
        self.assertIn("h.addControl(ctx, normalAttackTarget, '麻痺', 2)", case)
        self.assertNotIn("'威圧'", case)

    def test_jio_hachiman_uses_one_stat_scaled_control_roll_per_target(self):
        case = self.skill_case("地黄八幡")
        self.assertIn("h.dealSkillDamage(ctx, target, 174, 'physical')", case)
        self.assertIn("ctx.caster.role === 'main' ? 0.44 : 0.36", case)
        self.assertIn("attributeDependentChance(baseChance", case)
        self.assertIn("h.addControl(ctx, target, '封撃', 1)", case)
        self.assertIn("h.addControl(ctx, target, '無策', 1)", case)

    def test_sagami_lion_grants_timed_iron_wall_or_attacks(self):
        case = self.skill_case("相模の獅子")
        self.assertIn("h.roll(ctx.rng, 0.85)", case)
        self.assertIn("sagamiIronWallCharges", case)
        self.assertIn("sagamiIronWallUntil", case)
        self.assertIn("h.dealSkillDamage(ctx, enemy, 178, 'strategy')", case)
        self.assertIn("h.healBySkill(ctx, ally, 40, 'strategy')", case)
        self.assertIn("turn > (fighter.specialState.sagamiIronWallUntil", self.simulator)

    def test_woodpecker_uses_two_attackers_and_commander_repeat(self):
        case = self.skill_case("啄木鳥")
        self.assertIn("h.dealSkillDamage(ctx, target, 156, 'strategy')", case)
        self.assertIn("highestByStat(ctx.allies, 'val')", case)
        self.assertIn("attackStats: ['val', 'spd']", case)
        self.assertIn("attributeDependentChance(0.35", case)
        self.assertIn("ctx.caster.role === 'main' && h.roll(ctx.rng, 0.1)", case)


if __name__ == "__main__":
    unittest.main()
