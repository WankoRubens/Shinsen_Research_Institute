import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
EFFECTS = ROOT / "src" / "lib" / "battleSkillEffects.ts"
SIMULATOR = ROOT / "src" / "lib" / "battleSimulator.ts"


EXPECTED_SKILLS = {
    "御旗楯無", "七十二の計", "乱世の華", "所向無敵", "草木皆兵", "疾風怒濤", "乗勝追撃",
    "先手必勝", "剛の武者", "形影相弔", "死中求活", "月華鶴影", "境目奮戦", "献身",
    "鬼小島", "洞察反撃", "陣形崩し", "楼岸一番", "先制攻撃", "一念乱志", "鉄砲猛撃",
    "覇王の右筆", "岐阜侍従", "鈴鳴り", "先制先登", "鬼玄蕃", "援護射撃", "一刀両断",
    "矢石飛交", "秋水一色", "槍の鈴", "妖怪退治", "驍勇善戦", "甲州流軍学", "忠勤励行",
    "一六勝負", "攻守兼備", "反撃", "神出鬼没", "威風凛凛", "伝馬疾馳", "鬼義重",
    "荷駄崩", "一力当先", "火攻め", "奇策縦横", "攻其不備", "三楽犬", "城盗り",
    "電光石火", "同討", "薙ぎ払い", "不屈の精神", "不退転", "勇猛無比", "連戦",
}


class DirectDamageHandcraftedSkillsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.effects = EFFECTS.read_text(encoding="utf-8")
        cls.simulator = SIMULATOR.read_text(encoding="utf-8")

    def test_exported_target_list_is_complete(self):
        match = re.search(
            r"export const DIRECT_DAMAGE_HANDCRAFTED_SKILL_NAMES = \[(.*?)\] as const",
            self.effects,
            re.S,
        )
        self.assertIsNotNone(match)
        exported = set(re.findall(r"'([^']+)'", match.group(1)))
        self.assertEqual(EXPECTED_SKILLS, exported)

    def test_every_target_has_exactly_one_manual_case(self):
        manual_source = self.effects.split("// DB戦法:", 1)[0]
        for name in EXPECTED_SKILLS:
            with self.subTest(name=name):
                self.assertEqual(1, len(re.findall(rf"case '{re.escape(name)}':", manual_source)))
                self.assertEqual(1, len(re.findall(rf"case '{re.escape(name)}':", self.effects)))

    def test_excluded_skill_conditions_are_not_in_target_list(self):
        excluded = {
            "追い崩し",  # 制御状態を付与
            "紅蓮の炎",  # 継続状態を付与
            "伊達の粋",  # 大将条件を含む
            "竜騎兵",  # 特定武将の装備条件を含む
            "赤備え隊",  # 特定武将の装備条件を含む
        }
        self.assertTrue(EXPECTED_SKILLS.isdisjoint(excluded))

    def test_cross_fighter_triggers_are_connected_to_simulator(self):
        for watcher in (
            "TEAM_AFTER_NORMAL_ATTACK_SKILL_NAMES",
            "TEAM_DAMAGE_RECEIVED_SKILL_NAMES",
            "ENEMY_STRATEGY_DAMAGE_RECEIVED_SKILL_NAMES",
            "TEAM_BEFORE_ACTION_SKILL_NAMES",
            "ENEMY_AFTER_ACTION_SKILL_NAMES",
        ):
            with self.subTest(watcher=watcher):
                self.assertGreaterEqual(self.simulator.count(watcher), 2)
        self.assertIn("fireDamageWatcherSkills", self.simulator)

    def test_decimal_rates_are_normalized_to_percent(self):
        for key in ("damage_rate", "dmg_rate", "extra_damage_rate", "damage_1", "damage_2"):
            with self.subTest(key=key):
                self.assertRegex(self.effects, rf"toPercent\(h\.varNumber\(ctx\.skill, '{key}'")

    def test_onikojima_penalty_only_changes_onikojima(self):
        self.assertIn("specialState['activationRatePenalty:鬼小島']", self.effects)
        self.assertNotIn("ctx.caster.buffs.activationRate = (ctx.caster.buffs.activationRate ?? 0) - 5", self.effects)
        self.assertIn("activationRatePenalty:${resolvedSkillName}", self.simulator)

    def test_border_struggle_healing_reduction_does_not_stack(self):
        start = self.effects.index("case '境目奮戦': {")
        end = self.effects.index("\n    case '", start + 1)
        effect = self.effects[start:end]
        self.assertIn("addTimedModifier(ctx, target, 'healingReceived', -30, 1, 1)", effect)


if __name__ == "__main__":
    unittest.main()
