import type { Skill, Stat, StructuredBattleNode, TriggerEvent } from '../composables/useData'
import type { BattleFighter, BattleLogEntry, SkillResolveContext } from './battleSimulator'
import skillsData from '../../.build/skills.json'
import {
  S_UNIQUE_HANDCRAFTED_META,
  S_UNIQUE_HANDCRAFTED_SKILL_NAMES,
  applySUniqueSkillEffect,
  recordSUniqueDamageEvent,
} from './battleUniqueSkillEffects'

export {
  S_UNIQUE_ENEMY_ACTIVE_SKILL_WATCHERS,
  S_UNIQUE_OWN_SKILL_WATCHERS,
  S_UNIQUE_TEAM_DAMAGE_WATCHERS,
  S_UNIQUE_TEAM_NORMAL_ATTACK_WATCHERS,
  S_UNIQUE_TEAM_SKILL_WATCHERS,
  recordSUniqueDamageEvent,
} from './battleUniqueSkillEffects'

export const HEAL_STOCK_DAMAGE_SKILL_NAMES = ['比翼連理']
// 知者楽水の大将技をダメージ確定処理から参照する共通キー。
export const WISE_WATER_SHARE_UNTIL_KEY = 'wiseWaterDamageShareUntil'

export type BattleSkillType = '受動' | '兵種' | '指揮' | '陣法' | '能動' | '突撃'
export type BattleSkillTypeInput = BattleSkillType | '被動' | '主動' | '兵种' | '阵法' | '突擊' | '突击' | 'passive' | 'troop' | 'command' | 'formation' | 'active' | 'assault'
export const BATTLE_SKILL_TYPE_PRIORITY: BattleSkillType[] = ['受動', '兵種', '指揮', '陣法', '能動', '突撃']

const normalizeBattleSkillType = (text?: string | null): BattleSkillType | null => {
  if (!text) return null
  if (/兵種|兵种|troop/i.test(text)) return '兵種'
  if (/陣法|陣形|阵法|formation/i.test(text)) return '陣法'
  if (/指揮|指挥|command/i.test(text)) return '指揮'
  if (/突撃|突擊|突击|assault/i.test(text)) return '突撃'
  if (/受動|被動|被动|passive/i.test(text)) return '受動'
  if (/能動|主動|主动|active/i.test(text)) return '能動'
  return null
}

export interface BattleSkillEffectMeta {
  type?: BattleSkillTypeInput
  triggers?: TriggerEvent[]
  // データ側に回数制限がない個別戦法の、1ターン内の最大発動回数。
  maxPerTurn?: number
  // 個別 case の triggers だけを使い、skills.json の構造化 trigger を購読しない。
  replaceStructuredTriggers?: boolean
  // 初回発動で予約済みの後続効果。ここでは発動率を再抽選しない。
  followUpTriggers?: TriggerEvent[]
}

const defineBattleSkillMeta = (meta: BattleSkillEffectMeta): BattleSkillEffectMeta => meta

// 個別 case の戦法タイプや複数タイミングはここで指定する。
// type は発動優先度や兵種/陣法の重複チェックにも使うため、case 実行前に読めるメタ情報として持つ。
export const BATTLE_SKILL_EFFECT_META: Record<string, BattleSkillEffectMeta> = {
  回天転運: defineBattleSkillMeta({ type: '能動' }),
  千成瓢箪: defineBattleSkillMeta({ type: '指揮', triggers: ['beforeAction'] }),
  水攻干計: defineBattleSkillMeta({ type: '能動', triggers: ['beforeAction'] }),
  如水: defineBattleSkillMeta({ type: '受動', triggers: ['beforeAction', 'onHealed'] }),
  七十二の計: defineBattleSkillMeta({ type: '受動', triggers: ['preparationTurn'] }),
  比翼連理: defineBattleSkillMeta({ type: '指揮', triggers: ['afterAction'] }),
  奇策縦横: defineBattleSkillMeta({ type: '能動' }),
  南蛮渡来: defineBattleSkillMeta({ type: '能動' }),
  一舟軒: defineBattleSkillMeta({ type: '能動' }),
  弾嵐雨霰: defineBattleSkillMeta({ type: '能動' }),
  直諫敢行: defineBattleSkillMeta({ type: '能動', triggers: ['beforeAction'], replaceStructuredTriggers: true }),
  越後二天: defineBattleSkillMeta({ type: '突撃' }),
  疾風迅雷: defineBattleSkillMeta({ type: '指揮' }),
  恵風和雨: defineBattleSkillMeta({
    type: '指揮',
    triggers: ['preparationTurn', 'turnStart'],
    replaceStructuredTriggers: true,
    followUpTriggers: ['turnStart'],
  }),
  会盟の陣: defineBattleSkillMeta({
    type: '陣法',
    triggers: ['preparationTurn', 'beforeAction'],
    replaceStructuredTriggers: true,
    followUpTriggers: ['beforeAction'],
  }),
  知者楽水: defineBattleSkillMeta({
    type: '指揮',
    triggers: ['preparationTurn'],
    replaceStructuredTriggers: true,
  }),
  新生: defineBattleSkillMeta({
    type: '指揮',
    triggers: ['preparationTurn', 'turnEnd', 'beforeAction'],
    replaceStructuredTriggers: true,
    followUpTriggers: ['turnEnd', 'beforeAction'],
  }),
  時は今: defineBattleSkillMeta({ type: '能動', triggers: ['beforeAction'], replaceStructuredTriggers: true }),
  電光雷轟: defineBattleSkillMeta({
    type: '突撃',
    triggers: ['afterNormalAttack'],
    replaceStructuredTriggers: true,
    maxPerTurn: 1,
  }),
  地黄八幡: defineBattleSkillMeta({ type: '能動', triggers: ['beforeAction'], replaceStructuredTriggers: true }),
  相模の獅子: defineBattleSkillMeta({ type: '能動', triggers: ['beforeAction'], replaceStructuredTriggers: true }),
  啄木鳥: defineBattleSkillMeta({ type: '能動', triggers: ['beforeAction'], replaceStructuredTriggers: true }),
  表裏比興: defineBattleSkillMeta({
    type: '能動',
    triggers: ['beforeAction', 'enemyAfterNormalAttack'],
    replaceStructuredTriggers: true,
    followUpTriggers: ['enemyAfterNormalAttack'],
  }),
  瞬息万変: defineBattleSkillMeta({ type: '能動' }),
  沈魚落雁: defineBattleSkillMeta({ type: '受動', triggers: ['onNormalAttackReceived'] }),
  毘沙門天: defineBattleSkillMeta({ type: '受動', triggers: ['afterAction'], replaceStructuredTriggers: true }),
  所領役帳: defineBattleSkillMeta({
    type: '能動',
    triggers: ['beforeAction', 'onPhysicalDamageReceived', 'onStrategyDamageReceived'],
    replaceStructuredTriggers: true,
    followUpTriggers: ['onPhysicalDamageReceived', 'onStrategyDamageReceived'],
  }),
  以戦養戦: defineBattleSkillMeta({
    type: '受動',
    triggers: ['preparationTurn', 'turnStart'],
    replaceStructuredTriggers: true,
    followUpTriggers: ['turnStart'],
  }),
  戦意消沈: defineBattleSkillMeta({
    type: '指揮',
    triggers: ['turnStart'],
    replaceStructuredTriggers: true,
    followUpTriggers: ['turnStart'],
  }),
  按甲休兵: defineBattleSkillMeta({
    type: '受動',
    triggers: ['turnStart'],
    replaceStructuredTriggers: true,
    followUpTriggers: ['turnStart'],
  }),
  気炎万丈: defineBattleSkillMeta({
    type: '指揮',
    triggers: ['turnStart'],
    replaceStructuredTriggers: true,
    followUpTriggers: ['turnStart'],
  }),
  懐柔: defineBattleSkillMeta({
    type: '指揮',
    triggers: ['turnStart'],
    replaceStructuredTriggers: true,
    followUpTriggers: ['turnStart'],
  }),
  休養: defineBattleSkillMeta({
    type: '受動',
    triggers: ['turnStart'],
    replaceStructuredTriggers: true,
    followUpTriggers: ['turnStart'],
  }),
  腹中鱗甲: defineBattleSkillMeta({ type: '受動', triggers: ['onNormalAttackReceived'], replaceStructuredTriggers: true }),
  魚目混珠: defineBattleSkillMeta({
    type: '受動',
    triggers: ['preparationTurn', 'turnStart'],
    replaceStructuredTriggers: true,
    followUpTriggers: ['turnStart'],
  }),
  金城湯池: defineBattleSkillMeta({
    type: '能動',
    triggers: ['beforeAction', 'turnStart'],
    replaceStructuredTriggers: true,
    followUpTriggers: ['turnStart'],
  }),
  大器の萌芽: defineBattleSkillMeta({
    type: '指揮',
    triggers: ['turnStart'],
    replaceStructuredTriggers: true,
    followUpTriggers: ['turnStart'],
  }),
  雷神斬り: defineBattleSkillMeta({
    type: '受動',
    triggers: ['turnStart'],
    replaceStructuredTriggers: true,
    followUpTriggers: ['turnStart'],
  }),
  疑心暗鬼: defineBattleSkillMeta({
    type: '受動',
    triggers: ['preparationTurn', 'ownSkillActivated'],
    replaceStructuredTriggers: true,
    followUpTriggers: ['ownSkillActivated'],
  }),
  戮力同心: defineBattleSkillMeta({
    type: '指揮',
    triggers: ['turnStart'],
    replaceStructuredTriggers: true,
    followUpTriggers: ['turnStart'],
  }),
  罵詈雑言: defineBattleSkillMeta({
    type: '指揮',
    triggers: ['preparationTurn', 'turnStart'],
    replaceStructuredTriggers: true,
    followUpTriggers: ['turnStart'],
  }),
  三河魂: defineBattleSkillMeta({ type: '指揮', triggers: ['onNormalAttackReceived'] }),
  軍神: defineBattleSkillMeta({
    type: '受動',
    triggers: ['preparationTurn', 'beforeAction', 'afterNormalAttack', 'allyNormalAttack', 'allySkillActivated'],
    replaceStructuredTriggers: true,
    followUpTriggers: ['beforeAction', 'afterNormalAttack', 'allyNormalAttack', 'allySkillActivated'],
  }),
  伊達の粋: defineBattleSkillMeta({ type: '指揮', triggers: ['preparationTurn', 'beforeAction'] }),
  文武両道: defineBattleSkillMeta({ type: '受動', triggers: ['onPhysicalDamageDealt', 'onStrategyDamageDealt'] }),
  竜騎兵: defineBattleSkillMeta({ type: '兵種', triggers: ['beforeAction', 'afterAction'] }),
  龍騎兵: defineBattleSkillMeta({ type: '兵種', triggers: ['beforeAction', 'afterAction'] }),
  伊賀忍者: defineBattleSkillMeta({ type: '兵種', triggers: ['preparationTurn', 'afterNormalAttack'], followUpTriggers: ['afterNormalAttack'] }),
  越後先手組: defineBattleSkillMeta({ type: '兵種', triggers: ['preparationTurn', 'beforeAction', 'afterNormalAttack'], followUpTriggers: ['beforeAction', 'afterNormalAttack'] }),
  甲斐弓騎兵: defineBattleSkillMeta({ type: '兵種', triggers: ['preparationTurn'] }),
  薩摩鉄砲兵: defineBattleSkillMeta({ type: '兵種', triggers: ['preparationTurn'] }),
  三河弓兵隊: defineBattleSkillMeta({ type: '兵種', triggers: ['preparationTurn', 'onPhysicalDamageReceived', 'onStrategyDamageReceived'], followUpTriggers: ['onPhysicalDamageReceived', 'onStrategyDamageReceived'] }),
  赤備え隊: defineBattleSkillMeta({ type: '兵種', triggers: ['preparationTurn'] }),
  僧兵: defineBattleSkillMeta({ type: '兵種', triggers: ['preparationTurn', 'beforeAction'], followUpTriggers: ['beforeAction'] }),
  大太刀力士隊: defineBattleSkillMeta({ type: '兵種', triggers: ['preparationTurn', 'onNormalAttackReceived'], followUpTriggers: ['onNormalAttackReceived'] }),
  鉄砲僧兵: defineBattleSkillMeta({ type: '兵種', triggers: ['preparationTurn', 'beforeAction'], followUpTriggers: ['beforeAction'] }),
  母衣武者: defineBattleSkillMeta({ type: '兵種', triggers: ['preparationTurn', 'afterNormalAttack'], followUpTriggers: ['afterNormalAttack'] }),
  盤石耽々: defineBattleSkillMeta({ type: '受動', triggers: ['preparationTurn', 'turnStart'], replaceStructuredTriggers: true, followUpTriggers: ['turnStart'] }),
  運勝の鼻: defineBattleSkillMeta({ type: '受動', triggers: ['preparationTurn'], replaceStructuredTriggers: true }),
  独立独歩: defineBattleSkillMeta({ type: '受動', triggers: ['preparationTurn'], replaceStructuredTriggers: true }),
  一領具足: defineBattleSkillMeta({ type: '指揮', triggers: ['preparationTurn', 'beforeAction'], replaceStructuredTriggers: true, followUpTriggers: ['beforeAction'] }),
  静動自在: defineBattleSkillMeta({ type: '能動', triggers: ['beforeAction'], replaceStructuredTriggers: true }),
  気勢衝天: defineBattleSkillMeta({ type: '指揮', triggers: ['turnStart'], replaceStructuredTriggers: true, followUpTriggers: ['turnStart'] }),
  大智不智: defineBattleSkillMeta({ type: '能動', triggers: ['beforeAction'], replaceStructuredTriggers: true }),
  前後挟撃: defineBattleSkillMeta({ type: '能動', triggers: ['beforeAction'], replaceStructuredTriggers: true }),
  深慮遠謀: defineBattleSkillMeta({ type: '指揮', triggers: ['preparationTurn'], replaceStructuredTriggers: true }),
  百戦錬磨: defineBattleSkillMeta({ type: '受動', triggers: ['preparationTurn'], replaceStructuredTriggers: true }),
  剛毅果断: defineBattleSkillMeta({ type: '能動', triggers: ['beforeAction'], replaceStructuredTriggers: true }),
  金鼓連天: defineBattleSkillMeta({ type: '能動', triggers: ['beforeAction'], replaceStructuredTriggers: true }),
  戦意崩壊: defineBattleSkillMeta({ type: '突撃', triggers: ['afterNormalAttack'], replaceStructuredTriggers: true }),
  嚢沙之計: defineBattleSkillMeta({ type: '能動', triggers: ['beforeAction'], replaceStructuredTriggers: true }),
  全力戦闘: defineBattleSkillMeta({ type: '受動', triggers: ['turnStart'], replaceStructuredTriggers: true, followUpTriggers: ['turnStart'] }),
  荒切: defineBattleSkillMeta({ type: '突撃', triggers: ['afterNormalAttack'], replaceStructuredTriggers: true }),
  奮戦: defineBattleSkillMeta({ type: '能動', triggers: ['beforeAction'], replaceStructuredTriggers: true }),
  後方支援: defineBattleSkillMeta({ type: '指揮', triggers: ['preparationTurn', 'turnStart'], replaceStructuredTriggers: true, followUpTriggers: ['turnStart'] }),
  祓除: defineBattleSkillMeta({ type: '能動', triggers: ['beforeAction'], replaceStructuredTriggers: true }),
  奪気: defineBattleSkillMeta({ type: '能動', triggers: ['beforeAction'], replaceStructuredTriggers: true }),
  捨て身の義: defineBattleSkillMeta({ type: '指揮', triggers: ['preparationTurn', 'onPhysicalDamageReceived', 'onStrategyDamageReceived'], replaceStructuredTriggers: true, followUpTriggers: ['onPhysicalDamageReceived', 'onStrategyDamageReceived'] }),
  百錬成鋼: defineBattleSkillMeta({ type: '受動', triggers: ['preparationTurn'], replaceStructuredTriggers: true }),
  融通自在: defineBattleSkillMeta({ type: '能動', triggers: ['beforeAction'], replaceStructuredTriggers: true }),
  警戒周到: defineBattleSkillMeta({ type: '指揮', triggers: ['preparationTurn'], replaceStructuredTriggers: true }),
  弓調馬服: defineBattleSkillMeta({ type: '能動', triggers: ['beforeAction'], replaceStructuredTriggers: true }),
  参謀の助言: defineBattleSkillMeta({ type: '指揮', triggers: ['preparationTurn'], replaceStructuredTriggers: true }),
  刺突: defineBattleSkillMeta({ type: '能動', triggers: ['beforeAction'], replaceStructuredTriggers: true }),
  救援: defineBattleSkillMeta({
    type: '能動',
    triggers: ['beforeAction', 'onPhysicalDamageReceived', 'onStrategyDamageReceived'],
    replaceStructuredTriggers: true,
    followUpTriggers: ['onPhysicalDamageReceived', 'onStrategyDamageReceived'],
  }),
  水計: defineBattleSkillMeta({ type: '能動', triggers: ['beforeAction'], replaceStructuredTriggers: true }),
  猛撃: defineBattleSkillMeta({ type: '突撃', triggers: ['afterNormalAttack'], replaceStructuredTriggers: true }),
  看破: defineBattleSkillMeta({ type: '能動', triggers: ['beforeAction'], replaceStructuredTriggers: true }),
  火計: defineBattleSkillMeta({ type: '能動', triggers: ['beforeAction'], replaceStructuredTriggers: true }),
  奮起: defineBattleSkillMeta({ type: '受動', triggers: ['preparationTurn'], replaceStructuredTriggers: true }),
  殿軍: defineBattleSkillMeta({ type: '能動', triggers: ['beforeAction'], replaceStructuredTriggers: true }),
  破甲: defineBattleSkillMeta({ type: '突撃', triggers: ['afterNormalAttack'], replaceStructuredTriggers: true }),
  威圧: defineBattleSkillMeta({ type: '能動', triggers: ['beforeAction'], replaceStructuredTriggers: true }),
  姻戚同盟: defineBattleSkillMeta({ type: '能動', triggers: ['beforeAction'], replaceStructuredTriggers: true }),
  出奇制勝: defineBattleSkillMeta({ type: '受動', triggers: ['preparationTurn', 'ownSkillActivated'], replaceStructuredTriggers: true, followUpTriggers: ['ownSkillActivated'] }),
  士気高揚: defineBattleSkillMeta({ type: '能動', triggers: ['beforeAction'], replaceStructuredTriggers: true }),
  攻其不備: defineBattleSkillMeta({ type: '能動', triggers: ['beforeAction'] }),
  追い崩し: defineBattleSkillMeta({ type: '能動', triggers: ['beforeAction'] }),
  追亡逐北: defineBattleSkillMeta({ type: '能動', triggers: ['beforeAction'] }),
  縦横馳突: defineBattleSkillMeta({ type: '能動', triggers: ['beforeAction'], replaceStructuredTriggers: true }),
  一行三昧: defineBattleSkillMeta({ type: '受動', triggers: ['preparationTurn'], replaceStructuredTriggers: true }),
  一上一下: defineBattleSkillMeta({ type: '受動', triggers: ['preparationTurn'], replaceStructuredTriggers: true }),
  乱世の華: defineBattleSkillMeta({ type: '突撃', triggers: ['afterNormalAttack'] }),
  御旗楯無: defineBattleSkillMeta({ type: '受動', triggers: ['preparationTurn', 'onNormalAttackReceived'], followUpTriggers: ['onNormalAttackReceived'] }),
  所向無敵: defineBattleSkillMeta({ type: '能動' }),
  草木皆兵: defineBattleSkillMeta({ type: '能動' }),
  疾風怒濤: defineBattleSkillMeta({ type: '能動' }),
  乗勝追撃: defineBattleSkillMeta({ type: '突撃', triggers: ['afterNormalAttack'] }),
  先手必勝: defineBattleSkillMeta({ type: '能動' }),
  剛の武者: defineBattleSkillMeta({ type: '突撃', triggers: ['afterNormalAttack'] }),
  形影相弔: defineBattleSkillMeta({ type: '能動' }),
  死中求活: defineBattleSkillMeta({ type: '受動', triggers: ['onPhysicalDamageReceived', 'turnStart'] }),
  月華鶴影: defineBattleSkillMeta({ type: '指揮', triggers: ['onNormalAttackReceived'] }),
  境目奮戦: defineBattleSkillMeta({ type: '突撃', triggers: ['afterNormalAttack'] }),
  献身: defineBattleSkillMeta({ type: '指揮', triggers: ['beforeAction', 'afterNormalAttack'], followUpTriggers: ['afterNormalAttack'] }),
  鬼小島: defineBattleSkillMeta({ type: '突撃', triggers: ['afterNormalAttack'] }),
  洞察反撃: defineBattleSkillMeta({ type: '能動', triggers: ['beforeAction', 'onNormalAttackReceived'], followUpTriggers: ['onNormalAttackReceived'] }),
  陣形崩し: defineBattleSkillMeta({ type: '能動' }),
  楼岸一番: defineBattleSkillMeta({ type: '突撃', triggers: ['afterNormalAttack'] }),
  先制攻撃: defineBattleSkillMeta({ type: '能動' }),
  一念乱志: defineBattleSkillMeta({ type: '受動', triggers: ['turnStart'] }),
  鉄砲猛撃: defineBattleSkillMeta({ type: '能動' }),
  覇王の右筆: defineBattleSkillMeta({ type: '指揮', triggers: ['afterNormalAttack'] }),
  岐阜侍従: defineBattleSkillMeta({ type: '能動' }),
  鈴鳴り: defineBattleSkillMeta({ type: '受動', triggers: ['turnStart'] }),
  先制先登: defineBattleSkillMeta({ type: '能動' }),
  鬼玄蕃: defineBattleSkillMeta({ type: '能動' }),
  援護射撃: defineBattleSkillMeta({ type: '能動', triggers: ['beforeAction', 'onPhysicalDamageReceived', 'onStrategyDamageReceived'], followUpTriggers: ['onPhysicalDamageReceived', 'onStrategyDamageReceived'] }),
  一刀両断: defineBattleSkillMeta({ type: '突撃', triggers: ['afterNormalAttack'] }),
  矢石飛交: defineBattleSkillMeta({ type: '能動' }),
  秋水一色: defineBattleSkillMeta({ type: '能動' }),
  槍の鈴: defineBattleSkillMeta({ type: '突撃', triggers: ['afterNormalAttack'] }),
  妖怪退治: defineBattleSkillMeta({ type: '能動' }),
  驍勇善戦: defineBattleSkillMeta({ type: '能動' }),
  甲州流軍学: defineBattleSkillMeta({ type: '能動' }),
  忠勤励行: defineBattleSkillMeta({ type: '能動' }),
  一六勝負: defineBattleSkillMeta({ type: '能動' }),
  攻守兼備: defineBattleSkillMeta({ type: '能動' }),
  反撃: defineBattleSkillMeta({ type: '能動', triggers: ['beforeAction', 'onNormalAttackReceived'], followUpTriggers: ['onNormalAttackReceived'] }),
  神出鬼没: defineBattleSkillMeta({ type: '能動', triggers: ['beforeAction', 'afterNormalAttack'], followUpTriggers: ['afterNormalAttack'] }),
  威風凛凛: defineBattleSkillMeta({ type: '突撃', triggers: ['afterNormalAttack'] }),
  伝馬疾馳: defineBattleSkillMeta({ type: '能動', triggers: ['beforeAction', 'turnStart', 'allyBeforeAction'], followUpTriggers: ['turnStart', 'allyBeforeAction'] }),
  鬼義重: defineBattleSkillMeta({ type: '能動' }),
  荷駄崩: defineBattleSkillMeta({ type: '能動' }),
  一力当先: defineBattleSkillMeta({ type: '能動', triggers: ['beforeAction', 'afterNormalAttack'], followUpTriggers: ['afterNormalAttack'] }),
  火攻め: defineBattleSkillMeta({ type: '能動' }),
  三楽犬: defineBattleSkillMeta({ type: '能動', triggers: ['beforeAction', 'enemyAfterAction'], followUpTriggers: ['enemyAfterAction'] }),
  城盗り: defineBattleSkillMeta({ type: '能動', triggers: ['beforeAction', 'onStrategyDamageReceived'], followUpTriggers: ['onStrategyDamageReceived'] }),
  電光石火: defineBattleSkillMeta({ type: '能動' }),
  同討: defineBattleSkillMeta({ type: '能動' }),
  薙ぎ払い: defineBattleSkillMeta({ type: '能動' }),
  不屈の精神: defineBattleSkillMeta({ type: '能動', triggers: ['beforeAction', 'onNormalAttackReceived'], followUpTriggers: ['onNormalAttackReceived'] }),
  不退転: defineBattleSkillMeta({ type: '突撃', triggers: ['afterNormalAttack'] }),
  勇猛無比: defineBattleSkillMeta({ type: '能動' }),
  連戦: defineBattleSkillMeta({ type: '突撃', triggers: ['afterNormalAttack'] }),
  三河武士: defineBattleSkillMeta({
    type: '兵種',
    triggers: ['preparationTurn', 'onNormalAttackReceived', 'turnStart'],
    replaceStructuredTriggers: true,
    followUpTriggers: ['onNormalAttackReceived', 'turnStart'],
  }),
  風林火山: defineBattleSkillMeta({
    type: '指揮',
    triggers: ['preparationTurn', 'turnStart'],
    replaceStructuredTriggers: true,
    followUpTriggers: ['turnStart'],
  }),
  無想掃討: defineBattleSkillMeta({ type: '能動' }),
  ...S_UNIQUE_HANDCRAFTED_META,
}

export const BATTLE_SKILL_EFFECT_TRIGGERS: Record<string, TriggerEvent[]> = Object.fromEntries(
  Object.entries(BATTLE_SKILL_EFFECT_META)
    .filter(([, meta]) => Boolean(meta.triggers?.length))
    .map(([name, meta]) => [name, meta.triggers ?? []]),
)

const battleSkillEffectMeta = (skill: Skill): BattleSkillEffectMeta | null =>
  BATTLE_SKILL_EFFECT_META[skill.name_jp || '']
  ?? BATTLE_SKILL_EFFECT_META[skill.name]
  ?? null

export const replacesStructuredBattleTriggers = (skill: Skill): boolean =>
  battleSkillEffectMeta(skill)?.replaceStructuredTriggers ?? false

export const isBattleSkillFollowUpTrigger = (skill: Skill, trigger: TriggerEvent): boolean =>
  battleSkillEffectMeta(skill)?.followUpTriggers?.includes(trigger) ?? false

export const battleSkillMaxPerTurn = (skill: Skill): number | null =>
  battleSkillEffectMeta(skill)?.maxPerTurn ?? skill.maxPerTurn ?? null

export const battleSkillType = (skill: Skill): BattleSkillType =>
  normalizeBattleSkillType(battleSkillEffectMeta(skill)?.type)
  ?? normalizeBattleSkillType(skill.battle?.type)
  ?? normalizeBattleSkillType(skill.type)
  ?? normalizeBattleSkillType(skill.category)
  ?? normalizeBattleSkillType(skill.category_jp)
  ?? normalizeBattleSkillType(skill.game8_kind)
  ?? normalizeBattleSkillType([skill.description_jp, skill.description].filter(Boolean).join(' '))
  ?? '能動'

export const battleSkillTypePriority = (skill: Skill): number =>
  BATTLE_SKILL_TYPE_PRIORITY.indexOf(battleSkillType(skill))

export const compareBattleSkillPriority = (a: Skill, b: Skill): number =>
  battleSkillTypePriority(a) - battleSkillTypePriority(b)

export const isExclusiveTeamSkillType = (skill: Skill): boolean =>
  ['兵種', '陣法'].includes(battleSkillType(skill))

const NAMED_BATTLE_SKILL_NAMES = [
  '千成瓢箪',
  '回天転運',
  '如水',
  '七十二の計',
  '比翼連理',
  '奇策縦横',
  '南蛮渡来',
  '一舟軒',
  '弾嵐雨霰',
  '直諫敢行',
  '一行三昧',
  '一上一下',
  '越後二天',
  '疾風迅雷',
  '表裏比興',
  '瞬息万変',
  '三河魂',
  '縦横馳突',
  '千軍辟易',
  '恵風和雨',
  '会盟の陣',
  '知者楽水',
  '新生',
  '時は今',
  '電光雷轟',
  '地黄八幡',
  '相模の獅子',
  '啄木鳥',
  '軍神',
  '三河武士',
  '風林火山',
  '無想掃討',
  ...HEAL_STOCK_DAMAGE_SKILL_NAMES,
]

// 所持者だけでなく、部隊内の各武将の行動を起点に発動する兵種戦法。
export const TEAM_ACTION_BATTLE_SKILL_NAMES = new Set([
  '竜騎兵',
  '龍騎兵',
  '伊賀忍者',
  '越後先手組',
  '僧兵',
  '鉄砲僧兵',
  '母衣武者',
])

// 所持者本人ではなく、同じ部隊の友軍が通常攻撃を受けた時にも反応する戦法。
export const TEAM_NORMAL_ATTACK_RECEIVED_SKILL_NAMES = new Set(['三河魂', '月華鶴影', '大太刀力士隊', '三河武士'])

// 友軍の通常攻撃や被ダメージ、敵軍の行動を監視する個別戦法。
export const TEAM_AFTER_NORMAL_ATTACK_SKILL_NAMES = new Set(['覇王の右筆', '献身'])
export const TEAM_DAMAGE_RECEIVED_SKILL_NAMES = new Set(['援護射撃', '三河弓兵隊', '所領役帳', '救援'])
export const ENEMY_STRATEGY_DAMAGE_RECEIVED_SKILL_NAMES = new Set(['城盗り'])
export const TEAM_BEFORE_ACTION_SKILL_NAMES = new Set(['伝馬疾馳'])
export const ENEMY_AFTER_ACTION_SKILL_NAMES = new Set(['三楽犬'])
// 相手の通常攻撃終了を監視する個別戦法。
export const ENEMY_AFTER_NORMAL_ATTACK_SKILL_NAMES = new Set(['表裏比興'])
// 所持者本人の能動・突撃戦法発動を監視する個別戦法。
export const OWN_SKILL_ACTIVATION_SKILL_NAMES = new Set(['出奇制勝'])
// 友軍の通常攻撃・能動戦法・突撃戦法の発動を監視する受動戦法。
export const TEAM_MILITARY_GOD_SKILL_NAMES = new Set(['軍神'])

// 制御・継続状態と大将/特定武将条件を持たない、個別実装対象のダメージ戦法。
export const DIRECT_DAMAGE_HANDCRAFTED_SKILL_NAMES = [
  '御旗楯無', '七十二の計', '乱世の華', '所向無敵', '草木皆兵', '疾風怒濤', '乗勝追撃',
  '先手必勝', '剛の武者', '形影相弔', '死中求活', '月華鶴影', '境目奮戦', '献身',
  '鬼小島', '洞察反撃', '陣形崩し', '楼岸一番', '先制攻撃', '一念乱志', '鉄砲猛撃',
  '覇王の右筆', '岐阜侍従', '鈴鳴り', '先制先登', '鬼玄蕃', '援護射撃', '一刀両断',
  '矢石飛交', '秋水一色', '槍の鈴', '妖怪退治', '驍勇善戦', '甲州流軍学', '忠勤励行',
  '一六勝負', '攻守兼備', '反撃', '神出鬼没', '威風凛凛', '伝馬疾馳', '鬼義重',
  '荷駄崩', '一力当先', '火攻め', '奇策縦横', '攻其不備', '三楽犬', '城盗り',
  '電光石火', '同討', '薙ぎ払い', '不屈の精神', '不退転', '勇猛無比', '連戦',
] as const

const DESCRIPTION_BASED_BATTLE_SKILL_NAMES = (skillsData as unknown as Skill[])
  .flatMap((skill) => [skill.name_jp, skill.name])
  .filter((name): name is string => Boolean(name))

// 個別 case が未作成の戦法も、battleSimulator.ts 側の説明文ベース汎用処理で動かす。
// 精度を上げたい戦法だけ、このファイルの switch に case を追加して上書きする。
export const IMPLEMENTED_BATTLE_SKILL_NAMES = new Set([
  ...DESCRIPTION_BASED_BATTLE_SKILL_NAMES,
  ...NAMED_BATTLE_SKILL_NAMES,
])

const normalizeStructuredTrigger = (trigger?: string): TriggerEvent => {
  if (trigger === 'battleStart') return 'preparationTurn'
  if (trigger === 'afterAttack') return 'afterNormalAttack'
  if (trigger === 'onHeal') return 'onHealed'
  if (trigger === 'onDamaged') return 'onPhysicalDamageReceived'
  return trigger || 'beforeAction'
}

const collectStructuredTriggers = (nodes: StructuredBattleNode[], output: TriggerEvent[]) => {
  nodes.forEach((node) => {
    if (node.trigger) output.push(normalizeStructuredTrigger(node.trigger))
    collectStructuredTriggers(node.do ?? [], output)
    collectStructuredTriggers(node.steps ?? [], output)
    collectStructuredTriggers(node.actions ?? [], output)
    collectStructuredTriggers(node.on_true ?? [], output)
    collectStructuredTriggers(node.on_false ?? [], output)
    collectStructuredTriggers(node.on_success ?? [], output)
    collectStructuredTriggers(node.on_failure ?? [], output)
  })
}

// battle.do 内の複数タイミングを、戦闘エンジンが事前に購読できる形へ展開する。
export const structuredBattleTriggers = (skill: Skill): TriggerEvent[] => {
  if (!skill.battle) return []
  const triggers: TriggerEvent[] = []
  const rootTrigger = normalizeStructuredTrigger(skill.battle.trigger)
  if (rootTrigger !== 'always') triggers.push(rootTrigger)
  if (rootTrigger === 'always' && (skill.battle.do ?? []).some((node) => !node.trigger)) {
    triggers.push('preparationTurn')
  }
  collectStructuredTriggers(skill.battle.do ?? [], triggers)
  return [...new Set(triggers)]
}

export interface BattleSkillEffectHelpers {
  skillDisplayName: (skill: Skill) => string
  chooseTarget: (candidates: BattleFighter[], rng: () => number, ctx?: SkillResolveContext) => BattleFighter | null
  resolveTargets: (ctx: SkillResolveContext) => BattleFighter[]
  varNumber: (skill: Skill, key: string, fallback: number) => number
  aliveRandom: (fighters: BattleFighter[], rng: () => number, ctx?: SkillResolveContext) => BattleFighter[]
  weakest: (fighters: BattleFighter[], count: number) => BattleFighter[]
  roll: (rng: () => number, chance: number) => boolean
  dealSkillDamage: (
    ctx: SkillResolveContext,
    target: BattleFighter,
    rate: number,
    kind?: 'physical' | 'strategy',
    statRule?: SkillDamageStatRule,
  ) => number
  healBySkill: (
    ctx: SkillResolveContext,
    target: BattleFighter,
    rate: number,
    kind?: 'bravery' | 'strategy' | 'leadership',
  ) => number
  // ダメージ量の一定割合など、乱数を掛け直さない固定量の戦法回復に使う。
  healFixedBySkill: (
    ctx: SkillResolveContext,
    target: BattleFighter,
    amount: number,
  ) => number
  // 反撃が「通常攻撃効果と突撃を発動可能」な場合に、攻撃後効果をまとめて解決する。
  triggerNormalAttackFollowUps: (
    ctx: SkillResolveContext,
    target: BattleFighter,
  ) => void
  addControl: (ctx: SkillResolveContext, target: BattleFighter, name: string, duration: number) => void
  addTimedModifier: (
    ctx: SkillResolveContext,
    target: BattleFighter,
    stat: Stat,
    value: number,
    duration: number,
    maxStacks?: number,
    remainingUses?: number,
  ) => void
  // 内助の賢など、発動者に付与された継続時間補正を適用する。
  extendDotDuration: (ctx: SkillResolveContext, duration: number) => number
  statOf: (fighter: BattleFighter, stat: Stat) => number
  activationRateOf: (fighter: BattleFighter, skill: Skill) => number
}

export interface SkillDamageStatRule {
  attackStats: Stat[]
  defenseStats: Stat[]
  coefficient: number
}

const DEBUFF_NAMES = [
  '無策',
  '封撃',
  '麻痺',
  '混乱',
  '挑発',
  '牽制',
  '畏縮',
  '萎縮',
  '疲弊',
  '威圧',
  '回復不可',
  '火傷',
  '水攻',
  '水攻め',
  '中毒',
  '消沈',
  '潰走',
]
const CONTINUOUS_DAMAGE_NAMES = new Set(['火傷', '水攻', '水攻め', '中毒', '消沈', '潰走'])
const TIME_IS_NOW_DOT_NAMES = ['火傷', '水攻め', '中毒', '消沈', '潰走'] as const

// 時は今の大将技は、対象が5種類すべてを所持している間だけ継続状態の浄化を禁止する。
const timeIsNowDotsLocked = (fighter: BattleFighter): boolean =>
  (fighter.specialState.timeIsNowDotCleanseLock ?? 0) > 0
  && TIME_IS_NOW_DOT_NAMES.every((name) => fighter.timedStatuses.some((status) => status.name === name))

// 弱体効果を指定数まで解除する。戦法コメントからそのまま呼べるようにしておく。
export const removeDebuffs = (fighter: BattleFighter, count: number): string[] => {
  const removed: string[] = []
  const dotsLocked = timeIsNowDotsLocked(fighter)
  for (const name of DEBUFF_NAMES) {
    if (removed.length >= count) break
    if ((fighter.statuses[name] ?? 0) <= 0) continue
    delete fighter.statuses[name]
    delete fighter.controlSources[name]
    removed.push(name)
  }
  fighter.timedStatuses = fighter.timedStatuses.filter((status) => {
    if (removed.length >= count) return true
    if (!DEBUFF_NAMES.includes(status.name)) return true
    // 5種類が揃っている間は、時は今の大将技により継続状態を取り除けない。
    if (dotsLocked && CONTINUOUS_DAMAGE_NAMES.has(status.name)) return true
    removed.push(status.name)
    return false
  })
  return removed
}

const DATE_IKI_SKILL_NAMES = new Set(['伊達の粋', '伊達風采'])
const dateIkiSkill = (fighter: BattleFighter): Skill | null =>
  fighter.skills.find((skill) => DATE_IKI_SKILL_NAMES.has(skill.name_jp || skill.name)) ?? null

// 伊達の粋は、自身の戦法以外で与えた兵刃・計略ダメージも属性上昇の回数へ含める。
const recordDateIkiDamageHit = (
  fighter: BattleFighter,
  kind: 'physical' | 'strategy',
  turn: number,
  logs: BattleLogEntry[],
) => {
  const skill = dateIkiSkill(fighter)
  if (!skill) return

  const hitKey = kind === 'physical' ? 'dateIkiPhysicalHits' : 'dateIkiStrategyHits'
  fighter.specialState[hitKey] = (fighter.specialState[hitKey] ?? 0) + 1

  while (
    (fighter.specialState.dateIkiPhysicalHits ?? 0) >= 2
    && (fighter.specialState.dateIkiStrategyHits ?? 0) >= 2
  ) {
    fighter.specialState.dateIkiPhysicalHits -= 2
    fighter.specialState.dateIkiStrategyHits -= 2

    const buffStacks = fighter.specialState.dateIkiBuffStacks ?? 0
    if (buffStacks < 4) {
      const valorIncrease = Number(((fighter.baseStats.val ?? 0) * 0.05).toFixed(2))
      const intelligenceIncrease = Number(((fighter.baseStats.int ?? 0) * 0.05).toFixed(2))
      fighter.buffs.val = (fighter.buffs.val ?? 0) + valorIncrease
      fighter.buffs.int = (fighter.buffs.int ?? 0) + intelligenceIncrease

      const nextBuffStacks = buffStacks + 1
      fighter.specialState.dateIkiBuffStacks = nextBuffStacks
      if (hasCommanderSkill(fighter) && nextBuffStacks === 4) {
        fighter.specialState.dateIkiCommanderReady = 1
      }
      // ログには「何回目」ではなく、伊達の粋だけで現在上昇している累計値を表示する。
      const totalValorIncrease = Number((valorIncrease * nextBuffStacks).toFixed(2))
      const totalIntelligenceIncrease = Number((intelligenceIncrease * nextBuffStacks).toFixed(2))
      logs.push({
        turn,
        side: fighter.side,
        actor: fighter.name,
        actorHp: fighter.hp,
        effect: '伊達の粋',
        message: `伊達の粋: 武勇+${totalValorIncrease.toFixed(2)}、知略+${totalIntelligenceIncrease.toFixed(2)}`,
      })
      continue
    }

    fighter.specialState.dateIkiStacks = (fighter.specialState.dateIkiStacks ?? 0) + 1
    logs.push({
      turn,
      side: fighter.side,
      actor: fighter.name,
      actorHp: fighter.hp,
      effect: '伊達の粋',
      message: `伊達の粋: 属性上昇が最大のため粋を1獲得(残り${fighter.specialState.dateIkiStacks})`,
    })
  }
}

const BUNBU_SKILL_NAMES = new Set(['文武両道', '文武雙全'])
const hasBunbuSkill = (fighter: BattleFighter): boolean =>
  fighter.skills.some((skill) => BUNBU_SKILL_NAMES.has(skill.name_jp || skill.name))

const recordBunbuDamageHit = (
  fighter: BattleFighter,
  kind: 'physical' | 'strategy',
  turn: number,
  logs: BattleLogEntry[],
) => {
  if (!hasBunbuSkill(fighter)) return

  const stackKey = kind === 'strategy' ? 'bunbuStrategyStacks' : 'bunbuPhysicalStacks'
  const stacks = fighter.specialState[stackKey] ?? 0
  if (stacks >= 5) return

  const nextStacks = stacks + 1
  fighter.specialState[stackKey] = nextStacks
  if (kind === 'strategy') {
    fighter.buffs.val = (fighter.buffs.val ?? 0) + 30
    // 回数ではなく、文武両道による現在の累計上昇値を表示する。
    const totalValorIncrease = nextStacks * 30
    logs.push({
      turn,
      side: fighter.side,
      actor: fighter.name,
      actorHp: fighter.hp,
      effect: '文武両道',
      message: `文武両道: 計略ダメージで武勇+${totalValorIncrease}`,
    })
    return
  }

  fighter.buffs.int = (fighter.buffs.int ?? 0) + 30
  // 回数ではなく、文武両道による現在の累計上昇値を表示する。
  const totalIntelligenceIncrease = nextStacks * 30
  logs.push({
    turn,
    side: fighter.side,
    actor: fighter.name,
    actorHp: fighter.hp,
    effect: '文武両道',
    message: `文武両道: 兵刃ダメージで知略+${totalIntelligenceIncrease}`,
  })
}

// ダメージを与えた時に反応する受動戦法を、すべてのダメージ経路から同じ順序で処理する。
export const recordDamageDealtSkillEffects = (
  fighter: BattleFighter,
  kind: 'physical' | 'strategy',
  turn: number,
  logs: BattleLogEntry[],
  critical = false,
) => {
  recordDateIkiDamageHit(fighter, kind, turn, logs)
  recordBunbuDamageHit(fighter, kind, turn, logs)
  recordSUniqueDamageEvent(fighter, kind, critical, turn, logs)

  // 威風凛凛の各層は、対象がダメージを与えるたびに残り回数を1消費する。
  // 同時に存在する層はすべて同じ与ダメージへ作用するため、各層をまとめて減算する。
  const consumedModifiers = fighter.timedModifiers.filter((modifier) =>
    modifier.sourceSkill === '威風凛凛' && (modifier.remainingUses ?? 0) > 0)
  consumedModifiers.forEach((modifier) => {
    modifier.remainingUses = Math.max(0, (modifier.remainingUses ?? 0) - 1)
    if ((modifier.remainingUses ?? 0) > 0) return
    fighter.buffs[modifier.stat] = (fighter.buffs[modifier.stat] ?? 0) - modifier.value
    fighter.timedModifiers = fighter.timedModifiers.filter((active) => active !== modifier)
  })
}

const log = (logs: BattleLogEntry[], ctx: SkillResolveContext, message: string, target?: BattleFighter) => {
  logs.push({
    turn: ctx.turn,
    side: ctx.caster.side,
    actor: ctx.caster.name,
    actorHp: ctx.caster.hp,
    target: target?.name,
    targetSide: target?.side,
    message,
  })
}

// 戦闘中ずっと有効な「能動戦法だけ」の発動率上昇を加算する。
const addActiveSkillActivationRateBonus = (ctx: SkillResolveContext, bonus: number) => {
  const key = 'activeSkillActivationRateBonus'
  const total = (ctx.caster.specialState[key] ?? 0) + bonus
  ctx.caster.specialState[key] = total
  log(
    ctx.logs,
    ctx,
    `${ctx.caster.name}の能動戦法発動率が${bonus}%上昇(合計+${total}%)`,
  )
}

// 複数の戦法が同じ特殊効果へ加算できるよう、効果元ごとの差分だけを合計値へ反映する。
const setSpecialStateContribution = (
  fighter: BattleFighter,
  totalKey: string,
  sourceKey: string,
  value: number,
) => {
  const previous = fighter.specialState[sourceKey] ?? 0
  fighter.specialState[sourceKey] = value
  fighter.specialState[totalKey] = Math.max(
    0,
    (fighter.specialState[totalKey] ?? 0) - previous + value,
  )
}

// 準備ターンの永続能力上昇を、再適用しても二重加算しない形で保存する。
const setPermanentBuffContribution = (
  fighter: BattleFighter,
  stat: Stat,
  sourceKey: string,
  value: number,
) => {
  const previous = fighter.specialState[sourceKey] ?? 0
  fighter.specialState[sourceKey] = value
  fighter.buffs[stat] = (fighter.buffs[stat] ?? 0) - previous + value
}

// 「確率（能力依存）」は基礎確率へ、能力100を超えた平均値1につき0.1%を加算する。
const attributeDependentChance = (baseChance: number, stats: number[]): number => {
  const average = stats.reduce((sum, value) => sum + value, 0) / Math.max(1, stats.length)
  return Math.min(0.95, baseChance + Math.max(0, average - 100) * 0.001)
}

// 数値効果の「能力依存」は、能力100を基準に100超過分1につき0.1%だけ効果量を伸ばす。
// 発動確率とは違い、3%などの効果値へ相対倍率を掛けるため過大な上昇にならない。
const attributeDependentValue = (baseValue: number, stats: number[]): number => {
  const average = stats.reduce((sum, value) => sum + value, 0) / Math.max(1, stats.length)
  return baseValue * (1 + Math.max(0, average - 100) * 0.001)
}

// 軍神の1スタック分は実測値（武勇391.80で16.82%、武勇435で17.89%）から線形補間する。
const militaryGodStackBonus = (valor: number): number => {
  const slope = (17.89 - 16.82) / (435 - 391.8)
  return Math.max(0, 16.82 + (valor - 391.8) * slope)
}

// 軍神の溜めを1つ加算し、その時点の武勇に応じた通常攻撃専用ボーナスを保存する。
const gainMilitaryGodCharge = (
  ctx: SkillResolveContext,
  h: BattleSkillEffectHelpers,
  reason: string,
) => {
  const stacks = ctx.caster.specialState.militaryGodCharges ?? 0
  if (stacks >= 12) return

  const nextStacks = stacks + 1
  const stackBonus = militaryGodStackBonus(h.statOf(ctx.caster, 'val'))
  // 12回目は各スタック分に加え、160%相当（1スタック分の16倍）の追加上昇を得る。
  const maximumBonus = nextStacks === 12 ? stackBonus * 16 : 0
  const totalBonus = (ctx.caster.specialState.militaryGodNormalAttackBonus ?? 0) + stackBonus + maximumBonus
  ctx.caster.specialState.militaryGodCharges = nextStacks
  ctx.caster.specialState.militaryGodNormalAttackBonus = Number(totalBonus.toFixed(4))
  const gainedBonus = stackBonus + maximumBonus

  log(
    ctx.logs,
    ctx,
    `軍神: ${reason}で溜めを獲得、${ctx.caster.name}の通常攻撃与ダメージが${gainedBonus.toFixed(2)}%上昇（${(100 + totalBonus).toFixed(2)}%）`,
  )
}

const fighterHasSkill = (fighter: BattleFighter, names: string[]): boolean =>
  fighter.skills.some((skill) => names.includes(skill.name_jp || skill.name) || names.includes(skill.name))

const textOfSkill = (skill: Skill): string =>
  [
    skill.name,
    skill.name_jp,
    skill.type,
    skill.category,
    skill.category_jp,
    skill.description_jp,
    skill.description,
    skill.target_jp,
    skill.target,
    skill.tags?.join('/'),
    skill.battle_tags?.join('/'),
  ].filter(Boolean).join(' ')

const toPercent = (value: number): number => Math.abs(value) <= 3 ? value * 100 : value
const toChance = (value: number): number => Math.abs(value) > 1 ? value / 100 : value

const varValue = (skill: Skill, key: string): number | null => {
  const raw = skill.vars?.[key]
  if (typeof raw === 'number') return raw
  if (raw && typeof raw === 'object') {
    if (typeof raw.max === 'number') return raw.max
    if (typeof raw.base === 'number') return raw.base
  }
  return null
}

const firstVar = (skill: Skill, keys: string[]): number | null => {
  for (const key of keys) {
    const value = varValue(skill, key)
    if (value !== null) return value
  }
  return null
}

const rateValues = (skill: Skill, direct: number | null | undefined, keys: string[]): number[] => {
  const values: number[] = []
  if (typeof direct === 'number' && Number.isFinite(direct)) values.push(toPercent(direct))
  keys.forEach((key) => {
    const value = varValue(skill, key)
    if (value !== null) values.push(toPercent(value))
  })
  return values.filter((value, index, all) => Number.isFinite(value) && value > 0 && all.indexOf(value) === index)
}

const chanceFrom = (skill: Skill, keys: string[], fallback = 1): number => {
  const value = firstVar(skill, keys)
  return value === null ? fallback : Math.max(0, Math.min(1, toChance(value)))
}

const databaseDamageKind = (skill: Skill): 'physical' | 'strategy' => {
  const text = textOfSkill(skill)
  if (skill.damage_type === '計略' || skill.battle_type === 'strategy' || /計略|謀略|智略|知略依存/.test(text)) return 'strategy'
  return 'physical'
}

const databaseHealKind = (skill: Skill): 'bravery' | 'strategy' => {
  const text = textOfSkill(skill)
  if (skill.battle_type === 'bravery' && !/知略|智略/.test(text)) return 'bravery'
  return 'strategy'
}

const living = (fighters: BattleFighter[]) => fighters.filter((fighter) => fighter.hp > 0)
// 玄謀で選ばれた武将は、配置を変えず大将技の条件だけを満たす。
const hasCommanderSkill = (fighter: BattleFighter): boolean =>
  fighter.role === 'main' || (fighter.specialState.commanderSkillEnabled ?? 0) > 0
// 南蛮渡来の強化回復を受ける武将ラベル。
const NANBAN_HEAL_BONUS_LABELS = new Set(['南蛮', '黄巾', '南蛮好尚', '南蛮信奉'])
const roleCode = (fighter: BattleFighter): number => fighter.role === 'main' ? 1 : fighter.role === 'vice1' ? 2 : 3
const highestByStat = (fighters: BattleFighter[], stat: Stat): BattleFighter | null =>
  [...living(fighters)].sort((a, b) => (b.baseStats[stat] + (b.buffs[stat] ?? 0)) - (a.baseStats[stat] + (a.buffs[stat] ?? 0)))[0] ?? null
const lowestByStat = (fighters: BattleFighter[], stat: Stat): BattleFighter | null =>
  [...living(fighters)].sort((a, b) => (a.baseStats[stat] + (a.buffs[stat] ?? 0)) - (b.baseStats[stat] + (b.buffs[stat] ?? 0)))[0] ?? null
const randomLiving = (ctx: SkillResolveContext, h: BattleSkillEffectHelpers, fighters: BattleFighter[]): BattleFighter | null =>
  h.aliveRandom(fighters, ctx.rng, ctx)[0] ?? null
const expiresAfterTurns = (turn: number, duration: number): number => Math.max(1, turn) + Math.max(1, duration) - 1

// 個別戦法では説明文から対象を推測せず、戦法仕様で決まった陣営と人数を直接指定する。
const explicitEnemyTarget = (ctx: SkillResolveContext, h: BattleSkillEffectHelpers): BattleFighter | null => {
  // 突撃戦法などで攻撃対象が渡されている場合は、その生存中の敵を優先する。
  if (ctx.target && ctx.target.hp > 0 && ctx.target.side !== ctx.caster.side) return ctx.target
  // 対象が渡されていない能動戦法は、生存中の敵からランダムに1名選ぶ。
  return randomLiving(ctx, h, ctx.enemies)
}

const explicitEnemyTargets = (
  ctx: SkillResolveContext,
  h: BattleSkillEffectHelpers,
  count: number,
): BattleFighter[] => h.aliveRandom(ctx.enemies, ctx.rng, ctx).slice(0, count)

const explicitAllyTargets = (
  ctx: SkillResolveContext,
  h: BattleSkillEffectHelpers,
  count: number,
  excludeCaster = false,
): BattleFighter[] => h.aliveRandom(
  excludeCaster ? ctx.allies.filter((ally) => ally.id !== ctx.caster.id) : ctx.allies,
  ctx.rng,
  ctx,
).slice(0, count)

const applyExplicitContinuousDamage = (
  ctx: SkillResolveContext,
  h: BattleSkillEffectHelpers,
  target: BattleFighter,
  name: string,
  turns: number,
  rate: number,
  kind: 'physical' | 'strategy',
) => {
  // 僧兵の耐性がある武将には、火傷以外の継続状態を付与しない。
  if (
    (target.specialState.monkNonBurnDotImmune ?? 0) > 0
    && CONTINUOUS_DAMAGE_NAMES.has(name)
    && name !== '火傷'
  ) return

  const sourceSkill = h.skillDisplayName(ctx.skill)
  const appliedTurns = h.extendDotDuration(ctx, turns)
  // 同じ発動者・同じ戦法による同名状態は重複させず、持続時間と威力を更新する。
  const existing = target.timedStatuses.find((status) =>
    status.name === name
    && status.sourceSkill === sourceSkill
    && status.sourceActorId === ctx.caster.id)
  if (existing) {
    existing.turns = appliedTurns
    existing.dotRate = rate
    existing.dotType = kind
  } else {
    target.timedStatuses.push({
      name,
      turns: appliedTurns,
      sourceSkill,
      sourceActorId: ctx.caster.id,
      sourceActor: ctx.caster.name,
      dotRate: rate,
      dotType: kind,
    })
  }
  log(ctx.logs, ctx, `${target.name}に${name}(${appliedTurns}T)`, target)
}

const removeOnePositiveEffect = (target: BattleFighter): string | null => {
  const modifier = [...target.timedModifiers].reverse().find((item) => item.value > 0)
  if (modifier) {
    target.buffs[modifier.stat] = (target.buffs[modifier.stat] ?? 0) - modifier.value
    target.timedModifiers = target.timedModifiers.filter((item) => item !== modifier)
    return modifier.sourceSkill
  }
  const status = ['先攻', '必中', '洞察', '回避', '会心', '奇策', '連撃', '援護']
    .find((name) => (target.statuses[name] ?? 0) > 0)
  if (!status) return null
  delete target.statuses[status]
  return status
}

const hasEnemyTargetText = (skill: Skill) => /敵軍|敵方|敵/.test(textOfSkill(skill))
const hasAllyTargetText = (skill: Skill) => /自軍|我軍|友軍|自身|自分|味方/.test(textOfSkill(skill))

const databaseTargets = (
  ctx: SkillResolveContext,
  h: BattleSkillEffectHelpers,
  purpose: 'damage' | 'heal' | 'buff' | 'debuff' | 'control' | 'dot',
): BattleFighter[] => {
  const resolved = h.resolveTargets(ctx).filter((fighter) => fighter.hp > 0)
  if (purpose === 'heal') return resolved.length > 0 ? resolved : h.weakest(ctx.allies, 1)
  if (purpose === 'damage' || purpose === 'control' || purpose === 'dot') {
    if (resolved.length > 0) return resolved
    const fallback = h.chooseTarget(ctx.enemies, ctx.rng, ctx)
    return fallback ? [fallback] : []
  }
  if (purpose === 'debuff') return resolved.length > 0 ? resolved : living(ctx.enemies)
  if (/自身|自分/.test(textOfSkill(ctx.skill))) return [ctx.caster]
  if (hasAllyTargetText(ctx.skill) && !hasEnemyTargetText(ctx.skill)) return resolved.length > 0 ? resolved : living(ctx.allies)
  return resolved.length > 0 ? resolved : [ctx.caster]
}

const controlNamesFromDatabase = (skill: Skill): string[] => {
  const text = textOfSkill(skill)
  const inferred = [
    '無策',
    '封撃',
    '麻痺',
    '混乱',
    '挑発',
    '牽制',
    '畏縮',
    '萎縮',
    '疲弊',
    '威圧',
    '回復不可',
  ].filter((name) => text.includes(name))
  const direct = String(skill.control_type ?? '').split('/').map((name) => name.trim()).filter(Boolean)
  return [...direct, ...inferred].filter((name, index, all) => all.indexOf(name) === index)
}

const durationFromDatabase = (skill: Skill, fallback = 1): number =>
  Math.max(1, Math.round(firstVar(skill, ['duration', 'status_duration', 'debuff_duration', 'buff_duration', 'dur']) ?? skill.control_turns ?? fallback))

const PRECISE_HANDCRAFTED_SKILLS = new Set([
  ...DIRECT_DAMAGE_HANDCRAFTED_SKILL_NAMES,
  // 個別戦法の登録一覧を共有し、追加したcaseを戦法一覧でも実装済みとして扱う。
  ...NAMED_BATTLE_SKILL_NAMES,
  ...S_UNIQUE_HANDCRAFTED_SKILL_NAMES,
  ...Object.keys(BATTLE_SKILL_EFFECT_META),
  '回天転運',
  '千成瓢箪',
  '水攻干計',
  '如水',
  '七十二の計',
  '比翼連理',
  '奇策縦横',
  '南蛮渡来',
  '一舟軒',
  '弾嵐雨霰',
  '直諫敢行',
  '一行三昧',
  '一上一下',
  '越後二天',
  '疾風迅雷',
  '表裏比興',
  '瞬息万変',
  '沈魚落雁',
  '伊達の粋',
  '伊達風采',
  '文武両道',
  '竜騎兵',
  '龍騎兵',
  '攻其不備',
  '乱世の華',
  '追い崩し',
  '追亡逐北',
  '三河武士',
  '伊賀忍者',
  '越後先手組',
  '甲斐弓騎兵',
  '薩摩鉄砲兵',
  '三河弓兵隊',
  '赤備え隊',
  '僧兵',
  '大太刀力士隊',
  '鉄砲僧兵',
  '母衣武者',
  '軍神',
  // DB展開後に個別caseへ書き直した戦法。ここへ登録して構造化共通処理よりcaseを優先する。
  '紅蓮の炎',
  '霹靂一撃',
  '血戦奮闘',
  '理非曲直',
  '五里霧中',
  '奇謀独断',
  '罵詈雑言',
  '帰還の凱歌',
  '生死一顧',
  '先陣の勇',
  '闇討ち',
  '殿軍奮戦',
  '敵陣攪乱',
  '不意打ち',
  '有備無患',
  '一触即発',
  '回山倒海',
  '嘲罵',
  '対話',
  '離心の計',
  '機に乗ず',
  '自立の志',
  '専横専断',
  '家中整序',
  '破天の轟',
  '重農主義',
])

export type BattleSkillImplementationStatus = 'implemented' | 'partial' | 'unimplemented'

export interface BattleSkillImplementation {
  status: BattleSkillImplementationStatus
  detail: string
}

// 戦法一覧では、個別caseと説明文ベースの共通処理を区別して進捗を表示する。
export const battleSkillImplementation = (skill: Skill): BattleSkillImplementation => {
  const names = [skill.name_jp, skill.name].filter((name): name is string => Boolean(name))
  if (names.some((name) => PRECISE_HANDCRAFTED_SKILLS.has(name))) {
    return { status: 'implemented', detail: '個別戦法ロジック' }
  }

  if (names.some((name) => IMPLEMENTED_BATTLE_SKILL_NAMES.has(name))) {
    return {
      status: 'partial',
      detail: skill.battle ? '構造化データによる共通処理' : '戦法説明ベースの共通処理',
    }
  }

  return { status: 'unimplemented', detail: '戦闘ロジック未実装' }
}

const structuredArray = (value: unknown): StructuredBattleNode[] =>
  Array.isArray(value) ? value.filter((item): item is StructuredBattleNode => Boolean(item && typeof item === 'object')) : []

const structuredNumber = (skill: Skill, value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return fallback
  const source = value.trim()
  const variableMatch = source.match(/^(-?)\$([\w\u3040-\u30ff\u3400-\u9fff]+)$/)
  if (variableMatch) {
    const resolved = varValue(skill, variableMatch[2] ?? '') ?? fallback
    return variableMatch[1] === '-' ? -resolved : resolved
  }
  const numeric = Number(source.replace(/%$/, ''))
  if (!Number.isFinite(numeric)) return fallback
  return source.endsWith('%') ? numeric / 100 : numeric
}

const normalizeStructuredStatus = (name: string): string => ({
  封擊: '封撃',
  混亂: '混乱',
  威壓: '威圧',
  消沉: '消沈',
  挑釁: '挑発',
  牽制: '牽制',
  閃避: '回避',
  會心: '会心',
  謀略: '無策',
}[name] ?? name)

const normalizeStackKey = (name: string): string => ({
  彈丸: 'dragonCavalryAmmo',
  弾丸: 'dragonCavalryAmmo',
  風采: 'dateIkiStacks',
  屬性提升: 'dateIkiBuffStacks',
  傷害計數: 'dateIkiDamageHits',
}[name] ?? `skillStack:${name}`)

const structuredStat = (name: string): Stat | null => {
  if (/^武勇$|^武力$/.test(name)) return 'val'
  if (/^知略$|^智略$/.test(name)) return 'int'
  if (/^統率$/.test(name)) return 'lea'
  if (/^速度$|move_speed/.test(name)) return 'spd'
  if (/謀略傷害|計略傷害|strategy/.test(name)) return 'strategyDamageDealt'
  if (/兵刃傷害|通常攻撃|attack/.test(name)) return 'attackDamage'
  if (/damage_reduction/.test(name)) return 'damageTaken'
  if (/damage_output|outgoing_damage|^damage$/.test(name)) return 'damageDealt'
  if (/heal_received/.test(name)) return 'healingReceived'
  if (/activation_rate/.test(name)) return 'activationRate'
  return null
}

const structuredScaleStats = (scale: unknown): Stat[] => {
  const text = Array.isArray(scale) ? scale.join(',') : String(scale ?? '')
  const stats: Stat[] = []
  if (/武勇|武力/.test(text)) stats.push('val')
  if (/知略|智略/.test(text)) stats.push('int')
  if (/統率/.test(text)) stats.push('lea')
  if (/速度/.test(text)) stats.push('spd')
  return stats
}

const structuredChance = (
  ctx: SkillResolveContext,
  h: BattleSkillEffectHelpers,
  rawChance: unknown,
  scale?: unknown,
): number => {
  const chance = Math.max(0, Math.min(1, toChance(structuredNumber(ctx.skill, rawChance, 1))))
  const stats = structuredScaleStats(scale).map((stat) => h.statOf(ctx.caster, stat))
  return stats.length > 0 ? attributeDependentChance(chance, stats) : chance
}

const structuredCondition = (
  ctx: SkillResolveContext,
  h: BattleSkillEffectHelpers,
  raw: unknown,
  target?: BattleFighter,
): boolean => {
  if (raw === undefined || raw === null || raw === '') return true
  const text = String(raw).trim().replace(/^\((.*)\)$/, '$1')
  const orParts = text.split(/\s*\|\|\s*/)
  if (orParts.length > 1) return orParts.some((part) => structuredCondition(ctx, h, part, target))
  const andParts = text.split(/\s*(?:&&|\bAND\b)\s*/i)
  if (andParts.length > 1) return andParts.every((part) => structuredCondition(ctx, h, part, target))
  if (/^not\s+/i.test(text)) return !structuredCondition(ctx, h, text.replace(/^not\s+/i, ''), target)

  const turnComparison = text.match(/^turn\s*(>=|<=|==|>|<)\s*(\d+)$/)
  if (turnComparison) {
    const value = Number(turnComparison[2])
    if (turnComparison[1] === '>=') return ctx.turn >= value
    if (turnComparison[1] === '<=') return ctx.turn <= value
    if (turnComparison[1] === '>') return ctx.turn > value
    if (turnComparison[1] === '<') return ctx.turn < value
    return ctx.turn === value
  }
  const turnModulo = text.match(/^turn\s*%\s*(\d+)\s*==\s*(\d+)$/)
  if (turnModulo) return ctx.turn % Number(turnModulo[1]) === Number(turnModulo[2])

  const statusMatch = text.match(/^(?:target_)?has_status[_(]([^\s)]+)\)?$/)
  if (statusMatch) return Boolean(target && (target.statuses[normalizeStructuredStatus(statusMatch[1] ?? '')] ?? 0) > 0)
  const selfStatusMatch = text.match(/^self_has_status[_(]([^\s)]+)\)?$/)
  if (selfStatusMatch) return (ctx.caster.statuses[normalizeStructuredStatus(selfStatusMatch[1] ?? '')] ?? 0) > 0

  const stackMatch = text.match(/^stack(?:\(([^)]+)\)|_([^\s]+))\s*(>=|<=|==|>|<)\s*(\$?[\w\u3040-\u30ff\u3400-\u9fff]+)$/)
  if (stackMatch) {
    const current = ctx.caster.specialState[normalizeStackKey(stackMatch[1] ?? stackMatch[2] ?? '')] ?? 0
    const expected = structuredNumber(ctx.skill, stackMatch[4], 0)
    if (stackMatch[3] === '>=') return current >= expected
    if (stackMatch[3] === '<=') return current <= expected
    if (stackMatch[3] === '>') return current > expected
    if (stackMatch[3] === '<') return current < expected
    return current === expected
  }
  if (/^(?:ammo|has_intel_stack)\s*>\s*0$/.test(text)) {
    const key = text.startsWith('ammo') ? 'dragonCavalryAmmo' : 'skillStack:密報'
    return (ctx.caster.specialState[key] ?? 0) > 0
  }
  if (/^ammo\s*==\s*0$/.test(text)) return (ctx.caster.specialState.dragonCavalryAmmo ?? 0) === 0
  if (text === 'self_not_lowest_hp') {
    const lowest = Math.min(...living(ctx.allies).map((ally) => ally.hp / Math.max(1, ally.maxHp)))
    return ctx.caster.hp / Math.max(1, ctx.caster.maxHp) > lowest
  }
  if (text === 'target_hp > other_deputy_hp' && target) {
    const other = living(ctx.allies).find((ally) => ally.role !== 'main' && ally.id !== target.id)
    return !other || target.hp > other.hp
  }
  if (/leader\s*==\s*伊達政宗/.test(text)) return ctx.allies.some((ally) => ally.role === 'main' && ally.name === '伊達政宗')
  if (/ability_type|skill_type/.test(text)) return ['beforeAction', 'afterNormalAttack'].includes(ctx.trigger)
  if (/ability_triggered_success/.test(text)) return true
  if (/is_prep_active_strategy/.test(text)) return ctx.trigger === 'beforeAction'
  if (/commander_strategy_type/.test(text)) return hasCommanderSkill(ctx.caster)
  if (/all_three_affiliations_different|is_assembly_member|target_is_barbarian|prev_turn_attacked_by_normal/.test(text)) return true

  // 未知の付帯条件だけを理由に戦法全体を無効化せず、既知の効果は実行する。
  return true
}

const structuredTargets = (
  ctx: SkillResolveContext,
  h: BattleSkillEffectHelpers,
  node: StructuredBattleNode,
  inherited: BattleFighter[],
): BattleFighter[] => {
  const destination = String(node.to ?? node.target ?? '')
  let candidates: BattleFighter[]
  if (!destination) candidates = inherited.length > 0 ? inherited : [ctx.caster]
  else if (destination === 'self') candidates = [ctx.caster]
  else if (/^ally/.test(destination)) candidates = living(ctx.allies)
  else if (/^enemy/.test(destination)) candidates = living(ctx.enemies)
  else candidates = inherited.length > 0 ? inherited : [ctx.caster]

  if (node.targetRole === 'commander') candidates = candidates.filter((fighter) => fighter.role === 'main')
  if (node.targetRole === 'deputy') candidates = candidates.filter((fighter) => fighter.role !== 'main')
  if (node.order_by) {
    const stat = structuredStat(String(node.order_by))
    if (stat) candidates = [...candidates].sort((a, b) => h.statOf(b, stat) - h.statOf(a, stat))
  }
  if (/All$/.test(destination)) return candidates

  const min = Math.max(1, Math.round(structuredNumber(ctx.skill, node.countMin ?? node.count_min ?? node.count, 1)))
  const max = Math.max(min, Math.round(structuredNumber(ctx.skill, node.countMax ?? node.count_max ?? node.count, min)))
  const count = min + Math.floor(ctx.rng() * (max - min + 1))
  if (candidates.length <= count) return candidates
  return h.aliveRandom(candidates, ctx.rng, ctx).slice(0, count)
}

const applyStructuredModifier = (
  ctx: SkillResolveContext,
  h: BattleSkillEffectHelpers,
  node: StructuredBattleNode,
  targets: BattleFighter[],
  debuff: boolean,
) => {
  const rawStat = String(node.stat ?? '')
  const stat = structuredStat(rawStat)
  if (!stat) return
  let value = toPercent(structuredNumber(ctx.skill, node.value, 0))
  if (debuff) value *= -1
  if (!debuff && stat === 'damageTaken' && /damage_reduction/.test(rawStat)) value *= -1
  const duration = structuredNumber(ctx.skill, node.duration, 0)
  const maxStacks = Math.max(1, Math.round(structuredNumber(ctx.skill, node.maxStacks ?? node.max_stacks, Number.POSITIVE_INFINITY)))
  targets.forEach((target) => {
    if (duration > 0 && duration < 999) h.addTimedModifier(ctx, target, stat, value, duration, maxStacks)
    else target.buffs[stat] = (target.buffs[stat] ?? 0) + value
    const direction = value >= 0 ? '上昇' : '低下'
    log(ctx.logs, ctx, `${target.name}の${rawStat}が${Math.abs(value).toFixed(2)}${direction}${duration > 0 && duration < 999 ? `(${Math.round(duration)}T)` : ''}`, target)
  })
}

const executeStructuredNodes = (
  ctx: SkillResolveContext,
  h: BattleSkillEffectHelpers,
  nodes: StructuredBattleNode[],
  inheritedTargets: BattleFighter[],
): boolean => {
  let applied = false
  nodes.forEach((node) => {
    if (node.trigger && normalizeStructuredTrigger(node.trigger) !== ctx.trigger) return
    const targets = structuredTargets(ctx, h, node, inheritedTargets)
    const condition = node.condition ?? node.when
    const type = String(node.type ?? '')
    if (type !== 'conditional' && !structuredCondition(ctx, h, condition, targets[0])) return

    if (!type && node.do) {
      applied = executeStructuredNodes(ctx, h, node.do, targets) || applied
      return
    }
    if (type === 'sequence') {
      applied = executeStructuredNodes(ctx, h, structuredArray(node.do ?? node.steps ?? node.actions), targets) || applied
      return
    }
    if (type === 'conditional') {
      const branch = structuredCondition(ctx, h, node.condition ?? node.when, targets[0])
        ? node.on_true ?? node.do
        : node.on_false
      applied = executeStructuredNodes(ctx, h, structuredArray(branch), targets) || applied
      return
    }
    if (type === 'roll') {
      const success = h.roll(ctx.rng, structuredChance(ctx, h, node.chance, node.scale))
      applied = executeStructuredNodes(ctx, h, structuredArray(success ? node.on_success : node.on_failure), targets) || applied
      return
    }
    if (type === 'damage') {
      const rate = toPercent(structuredNumber(ctx.skill, node.value, 0))
      const damageType = String(node.damage_type ?? '')
      const kind = /謀略|計略|strategy/.test(damageType) ? 'strategy' : 'physical'
      const damageTargets = node.target_type ? structuredTargets(ctx, h, { ...node, to: String(node.target_type) }, targets) : targets
      damageTargets.forEach((target) => h.dealSkillDamage(ctx, target, rate, kind))
      applied = true
      return
    }
    if (type === 'heal') {
      const rate = toPercent(structuredNumber(ctx.skill, node.value, 0))
      const healTargets = node.target ? structuredTargets(ctx, h, { ...node, to: String(node.target) }, targets) : targets
      healTargets.forEach((target) => h.healBySkill(ctx, target, rate, /武勇/.test(String(node.scale ?? '')) ? 'bravery' : 'strategy'))
      applied = true
      return
    }
    if (type === 'buff' || type === 'debuff') {
      applyStructuredModifier(ctx, h, node, targets, type === 'debuff')
      applied = true
      return
    }
    if (type === 'applyStatus') {
      const status = normalizeStructuredStatus(String(node.status ?? ''))
      const duration = Math.max(1, Math.round(structuredNumber(ctx.skill, node.duration, 1)))
      const chance = structuredChance(ctx, h, node.chance, node.scale)
      targets.forEach((target) => {
        if (
          (target.specialState.monkNonBurnDotImmune ?? 0) > 0
          && CONTINUOUS_DAMAGE_NAMES.has(status)
          && status !== '火傷'
        ) return
        if (!h.roll(ctx.rng, chance)) return
        if (DEBUFF_NAMES.includes(status)) h.addControl(ctx, target, status, duration)
        else {
          target.statuses[status] = Math.max(target.statuses[status] ?? 0, duration)
          const strength = structuredNumber(ctx.skill, node.value, 0)
          if (strength) target.specialState[`statusValue:${status}`] = toPercent(strength)
          log(ctx.logs, ctx, `${target.name}に${status}(${duration}T)`, target)
        }
        const dotRate = structuredNumber(ctx.skill, node.damage_rate, 0)
        if (dotRate > 0) target.timedStatuses.push({
          name: status,
          turns: h.extendDotDuration(ctx, duration),
          sourceSkill: h.skillDisplayName(ctx.skill),
          sourceActorId: ctx.caster.id,
          sourceActor: ctx.caster.name,
          dotRate: toPercent(dotRate),
          dotType: 'strategy',
        })
      })
      applied = true
      return
    }
    if (type === 'addStack' || type === 'applyStack') {
      const name = String(node.stack_name ?? node.stack ?? '')
      const key = normalizeStackKey(name)
      const value = structuredNumber(ctx.skill, node.value ?? node.count, 1)
      ctx.caster.specialState[key] = Math.max(0, (ctx.caster.specialState[key] ?? 0) + value)
      log(ctx.logs, ctx, `${name}: ${value >= 0 ? '+' : ''}${value}(合計${ctx.caster.specialState[key]})`)
      applied = true
      return
    }
    if (type === 'resetCounter') {
      ctx.caster.specialState[normalizeStackKey(String(node.counter ?? ''))] = 0
      applied = true
      return
    }
    if (node.do) applied = executeStructuredNodes(ctx, h, node.do, targets) || applied
  })
  return applied
}

const applyStructuredBattleSkillEffect = (ctx: SkillResolveContext, h: BattleSkillEffectHelpers): boolean => {
  const battle = ctx.skill.battle
  if (!battle) return false
  const rootTrigger = normalizeStructuredTrigger(battle.trigger)
  const rootMatches = rootTrigger === ctx.trigger || (rootTrigger === 'always' && ctx.trigger === 'preparationTurn')
  if (!structuredCondition(ctx, h, battle.condition ?? battle.when, ctx.target ?? undefined)) return true

  const directNodes = (battle.do ?? []).filter((node) => node.trigger || rootMatches)
  executeStructuredNodes(ctx, h, directNodes, [ctx.caster])

  if (rootMatches && hasCommanderSkill(ctx.caster) && battle.bonus && typeof battle.bonus === 'object') {
    const commander = (battle.bonus as Record<string, unknown>).commander
    if (commander && typeof commander === 'object') {
      executeStructuredNodes(ctx, h, structuredArray((commander as Record<string, unknown>).do), [ctx.caster])
    }
  }
  // 構造化定義がある戦法は、効果が条件不成立でも旧汎用推定へ二重実行させない。
  return true
}

const applyDatabaseBuffs = (ctx: SkillResolveContext, h: BattleSkillEffectHelpers): boolean => {
  const text = textOfSkill(ctx.skill)
  const durationText = text.match(/(\d+)\s*ターン(?:持続|の間)?/)
  const duration = firstVar(ctx.skill, ['duration', 'buff_duration', 'debuff_duration', 'status_duration'])
    ?? (durationText ? Number(durationText[1]) : null)
  const maxStacks = Math.max(1, Math.round(firstVar(ctx.skill, ['max_stacks', 'stack_max', 'buff_stack_max']) ?? Number.POSITIVE_INFINITY))
  const changeStat = (target: BattleFighter, stat: Stat, value: number) => {
    if (duration !== null && duration > 0 && duration < 999) {
      h.addTimedModifier(ctx, target, stat, value, duration, maxStacks)
    } else {
      target.buffs[stat] = (target.buffs[stat] ?? 0) + value
    }
  }
  const buffValue = firstVar(ctx.skill, [
    'stat_buff',
    'stat_inc',
    'leadership_buff',
    'intelligence_buff',
    'valor_buff_at_threshold',
    'speed_buff',
    'valor_speed_buff',
    'ally_valor_speed_buff',
  ])
  const damageBuff = firstVar(ctx.skill, [
    'damage_buff',
    'damage_buff_base',
    'dmg_boost',
    'strategy_rate_buff',
    'higher_hp_damage_buff',
    'lower_hp_damage_buff',
  ])
  const reduction = firstVar(ctx.skill, [
    'dmg_reduce',
    'damage_reduction',
    'dmg_red',
    'higher_hp_damage_reduction',
    'lower_hp_damage_reduction',
  ])
  const debuffValue = firstVar(ctx.skill, ['stat_debuff', 'leadership_debuff', 'damage_debuff'])
  let applied = false

  const buffTargets = databaseTargets(ctx, h, 'buff')
  const debuffTargets = databaseTargets(ctx, h, 'debuff')

  if (buffValue !== null) {
    const value = toPercent(buffValue)
    buffTargets.forEach((target) => {
      if (/武勇|武力/.test(text)) changeStat(target, 'val', value)
      if (/知略|智略/.test(text)) changeStat(target, 'int', value)
      if (/統率|防御|防禦/.test(text)) changeStat(target, 'lea', value)
      if (/速度/.test(text)) changeStat(target, 'spd', value)
    })
    applied = true
  }

  if (damageBuff !== null) {
    const value = toPercent(damageBuff)
    buffTargets.forEach((target) => {
      if (/計略|謀略/.test(text)) changeStat(target, 'strategyDamageDealt', value)
      else if (/通常攻撃|普通攻撃|兵刃/.test(text)) changeStat(target, 'attackDamage', value)
      else changeStat(target, 'damageDealt', value)
    })
    applied = true
  }

  if (reduction !== null) {
    const value = toPercent(reduction)
    buffTargets.forEach((target) => {
      changeStat(target, 'damageTaken', -value)
    })
    applied = true
  }

  if (debuffValue !== null) {
    const value = toPercent(debuffValue)
    debuffTargets.forEach((target) => {
      if (/武勇|武力/.test(text)) changeStat(target, 'val', -value)
      if (/知略|智略/.test(text)) changeStat(target, 'int', -value)
      if (/統率|防御|防禦/.test(text)) changeStat(target, 'lea', -value)
      if (/速度/.test(text)) changeStat(target, 'spd', -value)
      if (/与ダメ|造成傷害|ダメージ/.test(text)) changeStat(target, 'damageDealt', -value)
    })
    applied = true
  }

  return applied
}

const applyDatabaseDot = (ctx: SkillResolveContext, h: BattleSkillEffectHelpers): boolean => {
  if (!ctx.skill.dot_name || !ctx.skill.dot_rate_max) return false
  const turns = h.extendDotDuration(ctx, Math.max(1, Math.round(ctx.skill.dot_turns ?? durationFromDatabase(ctx.skill, 1))))
  const rate = toPercent(ctx.skill.dot_rate_max)
  databaseTargets(ctx, h, 'dot').forEach((target) => {
    if (
      (target.specialState.monkNonBurnDotImmune ?? 0) > 0
      && CONTINUOUS_DAMAGE_NAMES.has(ctx.skill.dot_name!)
      && ctx.skill.dot_name !== '火傷'
    ) return
    target.timedStatuses.push({
      name: ctx.skill.dot_name!,
      turns,
      sourceSkill: h.skillDisplayName(ctx.skill),
      sourceActorId: ctx.caster.id,
      sourceActor: ctx.caster.name,
      dotRate: rate,
      dotType: databaseDamageKind(ctx.skill),
    })
    log(ctx.logs, ctx, `${target.name}に${ctx.skill.dot_name}(${turns}T)`, target)
  })
  return true
}

// 旧データ検証用の汎用処理。個別caseからは呼ばず、比較テストだけが必要に応じて利用する。
export const applyDatabaseSkillEffect = (ctx: SkillResolveContext, h: BattleSkillEffectHelpers): boolean => {
  const damageRates = rateValues(ctx.skill, ctx.skill.damage_rate_max, [
    'damage_rate',
    'dmg_rate',
    'dmg',
    'dmg1',
    'damage_1',
    'damage',
    'prep_strategy_rate',
    'strategy_rate',
    'counter_damage_rate',
    'normal_atk_dmg',
    'fire_damage_rate',
    'commander_dmg_rate',
  ])
  const extraDamageRates = rateValues(ctx.skill, null, ['damage_2', 'dmg2', 'extra_damage_rate'])
  const healRates = rateValues(ctx.skill, ctx.skill.heal_rate_max, ['heal_rate', 'heal', 'recovery_rate', 'enhanced_heal_rate'])
  const controls = controlNamesFromDatabase(ctx.skill)
  const hasDot = Boolean(ctx.skill.dot_name && ctx.skill.dot_rate_max)
  const hasBuff = applyDatabaseBuffs(ctx, h)
  let applied = hasBuff

  if (damageRates.length > 0) {
    const targets = databaseTargets(ctx, h, 'damage')
    const hitsMin = Math.round(firstVar(ctx.skill, ['hits_min']) ?? 1)
    const hitsMax = Math.round(firstVar(ctx.skill, ['hits_max']) ?? hitsMin)
    const hits = hitsMin + Math.floor(ctx.rng() * Math.max(1, hitsMax - hitsMin + 1))
    const skillText = textOfSkill(ctx.skill)
    const kinds: Array<'physical' | 'strategy'> = /兵刃ダメージ/.test(skillText) && /(?:計略|謀略)ダメージ/.test(skillText)
      ? ['physical', 'strategy']
      : [databaseDamageKind(ctx.skill)]
    for (let hit = 0; hit < hits; hit += 1) {
      targets.forEach((target) => kinds.forEach((kind) => h.dealSkillDamage(ctx, target, damageRates[0], kind)))
    }
    damageRates.slice(1).forEach((rate) => {
      if (h.roll(ctx.rng, chanceFrom(ctx.skill, ['extra_trigger_chance', 'extra_prob', 'extra_chance'], 1))) {
        const target = h.aliveRandom(ctx.enemies, ctx.rng, ctx).find((enemy) => !targets.some((base) => base.id === enemy.id)) ?? targets[0]
        if (target) h.dealSkillDamage(ctx, target, rate, kinds[0])
      }
    })
    extraDamageRates.forEach((rate) => {
      if (h.roll(ctx.rng, chanceFrom(ctx.skill, ['extra_trigger_chance', 'extra_prob', 'extra_chance'], 1))) {
        const target = h.chooseTarget(ctx.enemies, ctx.rng, ctx)
        if (target) h.dealSkillDamage(ctx, target, rate, kinds[0])
      }
    })
    applied = true
  }

  if (healRates.length > 0) {
    const targets = databaseTargets(ctx, h, 'heal')
    const kind = databaseHealKind(ctx.skill)
    targets.forEach((target) => h.healBySkill(ctx, target, healRates[0], kind))
    applied = true
  }

  if (controls.length > 0) {
    const chance = chanceFrom(ctx.skill, ['status_chance', 'debuff_rate', 'random_rate', 'pressure_rate', 'fatigue_rate'], 1)
    const duration = durationFromDatabase(ctx.skill, 1)
    databaseTargets(ctx, h, 'control').forEach((target) => {
      controls.forEach((name) => {
        if (h.roll(ctx.rng, chance)) h.addControl(ctx, target, name, duration)
      })
    })
    applied = true
  }

  if (hasDot) applied = applyDatabaseDot(ctx, h) || applied

  return applied
}

// 個別戦法の実装場所。true を返した戦法は、後段の汎用推定ロジックを通さない。
export const applyNamedSkillEffect = (
  ctx: SkillResolveContext,
  h: BattleSkillEffectHelpers,
): boolean => {
  const name = h.skillDisplayName(ctx.skill)
  const currentTarget = ctx.target && ctx.target.hp > 0 ? ctx.target : h.chooseTarget(ctx.enemies, ctx.rng, ctx)

  // S固有戦法は専用ファイルの個別caseを最優先し、下の委譲ラベルへ二重に流さない。
  const uniqueResult = applySUniqueSkillEffect(ctx, h)
  if (uniqueResult !== null) return uniqueResult

  // 精密な個別caseがない戦法は、skills.json の battle.do を説明通りに実行する。
  // battle定義側が条件不成立を返した場合も、旧来の単一効果へ二重実行しない。
  if (
    ctx.skill.battle
    && !S_UNIQUE_HANDCRAFTED_SKILL_NAMES.includes(name as typeof S_UNIQUE_HANDCRAFTED_SKILL_NAMES[number])
    && !S_UNIQUE_HANDCRAFTED_SKILL_NAMES.includes(ctx.skill.name as typeof S_UNIQUE_HANDCRAFTED_SKILL_NAMES[number])
    && !PRECISE_HANDCRAFTED_SKILLS.has(name)
    && !PRECISE_HANDCRAFTED_SKILLS.has(ctx.skill.name)
  ) {
    return applyStructuredBattleSkillEffect(ctx, h)
  }

  switch (name) {
    // S固有戦法は、対象・条件・重ねがけを個別case化した専用ファイルへ処理を委譲する。
    // ここに戦法名を明示しておくことで、個別実装の所在と網羅性をソース上で確認できる。
    case '武田之赤備':
    case '百万一心':
    case '海道一':
    case '鬼若子':
    case '梟雄の計':
    case '一切皆空':
    case '古今独歩':
    case '冷徹無情':
    case '破陣乱舞':
    case '風姿綽約':
    case '同気連枝':
    case '末世の道者':
    case '豊後の戦陣':
    case '天下御免':
    case '鬼美濃':
    case 'かかれ柴田':
    case '掃疑平乱':
    case '槍の又左':
    case '破竹の勢い':
    case '死灰復然':
    case '十面埋伏':
    case '東国無双の麗':
    case '帰蝶の舞':
    case '越後流軍学':
    case '甲山猛虎':
    case '陣前無我':
    case '湖水渡り':
    case '内助の賢':
    case '七本槍筆頭':
    case '勇志不抜':
    case '尼御台':
    case '信義貫徹':
    case '旋乾転坤':
    case '怪力無双':
    case '積水成淵':
    case '諸行無常':
    case '先陣鼓舞':
    case '斗星北天':
    case '一心一徳':
    case '非常の器':
    case '耐苦鍛錬':
    case '密報通暁':
    case '夜叉美濃':
    case '一徹の意志':
    case '攻めの三左':
    case '仏の高力':
    case '綱紀粛正':
    case '傲岸不遜':
    case '満ちゆく月':
    case '鬼十河':
    case '津田流砲術':
    case '仁者の沈勇':
    case '諏訪の光':
    case '笹の才蔵':
    case '落花啼鳥':
    case '夢幻泡影':
    case '槍弾正':
    case '剛毅木訥':
    case '松柏之操':
    case '樽俎折衝':
    case '風流武者':
    case '上州の黄斑':
    case '股肱の臣':
    case '天神山残照':
      return applySUniqueSkillEffect(ctx, h) ?? true

    case '回天転運': {
      // 戦法タイプ: 能動
      // 兵力の1番少ない味方1人に
      h.weakest(ctx.allies, 1).forEach((ally) => {
        // 弱体効果を2つ解除
        const removed = removeDebuffs(ally, 2)
        if (removed.length > 0) log(ctx.logs, ctx, `${ally.name}の弱体効果を${removed.join('、')}解除`, ally)

        // 260％(知略)の回復
        h.healBySkill(ctx, ally, 260, 'strategy')
      })
      return true
    }

    case '千成瓢箪': {
      // 戦法タイプ: 指揮
      // 自身が大将なら70%、それ以外なら35%
      const allHealChance = hasCommanderSkill(ctx.caster) ? 0.7 : 0.35

      // 上の確率で自軍全体を回復
      if (h.roll(ctx.rng, allHealChance)) {
        ctx.allies.forEach((ally) => {
          if (ally.hp > 0) h.healBySkill(ctx, ally, 76, 'strategy')
        })
      } else {
        // 生きている自軍からランダムな2人を76%で回復する。
        explicitAllyTargets(ctx, h, 2).forEach((ally) => {
          h.healBySkill(ctx, ally, 76, 'strategy')
        })
      }
      return true
    }

    case '如水': {
      // 戦法タイプ: 受動
      const gainKisaku = (reason: string) => {
        // 現在の奇策スタック数を取得
        const stacks = ctx.caster.specialState.josuiKisakuStacks ?? 0
        // 最大8回までなので、8以上なら加算しない
        if (stacks >= 8) return
        // 基本48%、知略100超過分で上昇、上限90%
        const chance = Math.min(0.9, 0.48 + Math.max(0, h.statOf(ctx.caster, 'int') - 100) * 0.001)
        // 確率判定に失敗したら何もしない
        if (!h.roll(ctx.rng, chance)) return

        // 奇策スタックを1つ増やす
        const nextStacks = Math.min(8, stacks + 1)
        ctx.caster.specialState.josuiKisakuStacks = nextStacks
        // 奇策1スタックにつき、計略ダメージが最終的に150%になる確率を5%上げる。
        setSpecialStateContribution(
          ctx.caster,
          'strategyCriticalChance',
          'josuiStrategyCriticalChance',
          nextStacks * 5,
        )
        // 回数ではなく、如水による現在の奇策率を表示する。
        log(ctx.logs, ctx, `如水: ${reason}で奇策を獲得（奇策率${nextStacks * 5}%）`)
      }

      // 効果1: 毎ターン自分の行動開始前に奇策獲得判定
      if (ctx.trigger === 'beforeAction') {
        gainKisaku('行動前')
      }

      // 効果2: 毎ターン初めて戦法回復を受けた時に奇策獲得判定
      if (ctx.trigger === 'onHealed' && ctx.caster.specialState.josuiHealTurn !== ctx.turn) {
        ctx.caster.specialState.josuiHealTurn = ctx.turn
        gainKisaku('このターン初めて戦法回復を受けた時')
      }

      // 効果3: 毎ターン自分の行動開始前に敵軍単体へ計略ダメージ判定
      if (ctx.trigger === 'beforeAction') {
        // 自身が大将なら75%、それ以外なら60%
        const damageChance = hasCommanderSkill(ctx.caster) ? 0.75 : 0.6
        if (currentTarget && h.roll(ctx.rng, damageChance)) {
          // 敵軍単体に計略ダメージを1～2回
          const hits = 1 + Math.floor(ctx.rng() * 2)
          for (let i = 0; i < hits; i += 1) h.dealSkillDamage(ctx, currentTarget, 88, 'strategy')
        }
      }
      return true
    }

    case '比翼連理': {
      // 戦法タイプ: 指揮
      // 戦闘中に蓄積された回復量がなければ何もしない。
      const stock = ctx.caster.specialState.healingStock ?? 0
      if (stock <= 0) return true

      // 自軍大将の行動終了時、80%で敵軍1～2名に計略ダメージ
      if (h.roll(ctx.rng, 0.8)) {
        const targetCount = 1 + Math.floor(ctx.rng() * 2)
        const damageRate = 92 + Math.min(180, Math.floor(stock / 200))
        h.aliveRandom(ctx.enemies, ctx.rng, ctx)
          .slice(0, targetCount)
          .forEach((enemy) => h.dealSkillDamage(ctx, enemy, damageRate, 'strategy'))
      }

      // 発動判定後、蓄積された回復量をリセット
      log(ctx.logs, ctx, `回復蓄積をリセット(${stock})`)
      ctx.caster.specialState.healingStock = 0
      return true
    }

    case '伊達の粋': {
      // 戦法タイプ: 指揮
      // 効果1: 戦闘開始時に粋を5スタック獲得
      if (ctx.trigger === 'preparationTurn') {
        ctx.caster.specialState.dateIkiStacks = 5
        ctx.caster.specialState.dateIkiPhysicalHits = 0
        ctx.caster.specialState.dateIkiStrategyHits = 0
        ctx.caster.specialState.dateIkiBuffStacks = 0
        ctx.caster.specialState.dateIkiCommanderReady = 0
        log(ctx.logs, ctx, '伊達の粋: 粋を5獲得(残り5)')
        return true
      }

      // 効果2: 行動開始時以外は粋を消費しない
      if (ctx.trigger !== 'beforeAction') return true
      const stacks = ctx.caster.specialState.dateIkiStacks ?? 0
      if (stacks <= 0) return true

      // 大将追加攻撃は、属性上昇4回到達後の「次の粋消費」時に予約分を使う
      const useCommanderExtra = hasCommanderSkill(ctx.caster)
        && (ctx.caster.specialState.dateIkiCommanderReady ?? 0) > 0
      if (useCommanderExtra) ctx.caster.specialState.dateIkiCommanderReady = 0

      // 粋を1スタック消費
      ctx.caster.specialState.dateIkiStacks = stacks - 1
      log(ctx.logs, ctx, `伊達の粋: 粋を1消費(残り${ctx.caster.specialState.dateIkiStacks})`)

      // ランダムな敵軍単体に92%の兵刃・計略ダメージをそれぞれ与える
      const aliveEnemies = ctx.enemies.filter((enemy) => enemy.hp > 0)
      const target = aliveEnemies[Math.floor(ctx.rng() * aliveEnemies.length)]
      if (target) {
        h.dealSkillDamage(ctx, target, 92, 'physical')
        h.dealSkillDamage(ctx, target, 92, 'strategy')
      }

      // 大将時、属性上昇4回到達後の次の粋消費で134%の兵刃・計略ダメージを追加
      if (useCommanderExtra) {
        const extraEnemies = ctx.enemies.filter((enemy) => enemy.hp > 0)
        const extraTarget = extraEnemies[Math.floor(ctx.rng() * extraEnemies.length)]
        if (extraTarget) {
          log(ctx.logs, ctx, '伊達の粋: 大将効果の追加攻撃')
          h.dealSkillDamage(ctx, extraTarget, 134, 'physical')
          h.dealSkillDamage(ctx, extraTarget, 134, 'strategy')
        }
      }
      return true
    }

    case '竜騎兵':
    case '龍騎兵': {
      // 戦法タイプ: 兵種
      // このcaseのcasterは戦法所持者ではなく、現在行動している自軍武将を指す。
      const ammoKey = 'dragonCavalryAmmo'

      // 効果1・2: 各武将の行動開始時に、装填と弾丸攻撃を順番に処理する。
      if (ctx.trigger === 'beforeAction') {
        let ammo = ctx.caster.specialState[ammoKey] ?? 0

        // 弾丸を持っていない場合は1発、武勇と速度依存の25%判定に成功すると2発装填する。
        if (ammo <= 0) {
          const doubleAmmoChance = attributeDependentChance(0.25, [
            h.statOf(ctx.caster, 'val'),
            h.statOf(ctx.caster, 'spd'),
          ])
          const loadedAmmo = h.roll(ctx.rng, doubleAmmoChance) ? 2 : 1
          ammo = loadedAmmo
          ctx.caster.specialState[ammoKey] = ammo
          log(ctx.logs, ctx, `竜騎兵: 弾丸を${loadedAmmo}発装填(残り${ammo})`)
        }

        // 弾丸を持っている場合、速度依存の70%判定に成功すると1発消費して攻撃する。
        const fireChance = attributeDependentChance(0.7, [h.statOf(ctx.caster, 'spd')])
        if (ammo > 0 && h.roll(ctx.rng, fireChance)) {
          ammo -= 1
          ctx.caster.specialState[ammoKey] = ammo
          log(ctx.logs, ctx, `竜騎兵: 弾丸を1発消費(残り${ammo})`)

          // 武勇と知略を比較し、高い能力に対応する種類で104%ダメージを与える。
          const damageKind = h.statOf(ctx.caster, 'val') >= h.statOf(ctx.caster, 'int')
            ? 'physical'
            : 'strategy'
          const aliveEnemies = ctx.enemies.filter((enemy) => enemy.hp > 0)
          const target = aliveEnemies[Math.floor(ctx.rng() * aliveEnemies.length)]
          if (target) h.dealSkillDamage(ctx, target, 104, damageKind)
        }
        return true
      }

      // 効果3: 伊達政宗本人に竜騎兵がセットされていれば、各武将の行動後に40%で1発装填する。
      if (ctx.trigger === 'afterAction') {
        const dateMasamuneHasDragonCavalry = ctx.allies.some(
          (ally) => ally.name === '伊達政宗' && ally.skills.some(
            (skill) => TEAM_ACTION_BATTLE_SKILL_NAMES.has(skill.name_jp || skill.name)
              || TEAM_ACTION_BATTLE_SKILL_NAMES.has(skill.name),
          ),
        )
        if (!dateMasamuneHasDragonCavalry) return true

        const reloadChance = attributeDependentChance(0.4, [
          h.statOf(ctx.caster, 'val'),
          h.statOf(ctx.caster, 'int'),
        ])
        if (h.roll(ctx.rng, reloadChance)) {
          const nextAmmo = (ctx.caster.specialState[ammoKey] ?? 0) + 1
          ctx.caster.specialState[ammoKey] = nextAmmo
          log(ctx.logs, ctx, `竜騎兵: 伊達政宗の装備効果で弾丸を1発装填(残り${nextAmmo})`)
        }
        return true
      }

      return true
    }

    case '奇策縦横': {
      // 戦法タイプ: 能動
      // 敵軍全体に近い複数(最大3人)へ254%の計略ダメージ
      h.aliveRandom(ctx.enemies, ctx.rng, ctx).slice(0, 3).forEach((enemy) => h.dealSkillDamage(ctx, enemy, 254, 'strategy'))
      return true
    }

    case '南蛮渡来': {
      // 戦法タイプ: 能動
      // 生きている自軍からランダムな2～3人を選ぶ。
      const count = 2 + Math.floor(ctx.rng() * 2)
      explicitAllyTargets(ctx, h, count).forEach((ally) => {
        // 対象自身が南蛮・黄巾・南蛮信奉タグを持つ場合だけ、その対象の回復率を172%へ上げる。
        const rate = ally.labels.some((label) => NANBAN_HEAL_BONUS_LABELS.has(label)) ? 172 : 144
        h.healBySkill(ctx, ally, rate, 'strategy')
      })
      return true
    }

    case '一舟軒': {
      // 戦法タイプ: 能動
      // 生きている自軍からランダムな2人を152%で回復する。
      explicitAllyTargets(ctx, h, 2).forEach((ally) => {
        h.healBySkill(ctx, ally, 152, 'strategy')

        // 知略依存の52%判定に成功した対象へ、2ターン有効な鉄壁を1回付与する。
        const chance = attributeDependentChance(0.52, [h.statOf(ctx.caster, 'int')])
        if (h.roll(ctx.rng, chance)) {
          ally.specialState.ironWallCharges = (ally.specialState.ironWallCharges ?? 0) + 1
          ally.specialState.isshukenIronWallCharges = (ally.specialState.isshukenIronWallCharges ?? 0) + 1
          ally.specialState.isshukenIronWallUntil = expiresAfterTurns(ctx.turn, 2)
        }
      })
      return true
    }

    case '弾嵐雨霰': {
      // 戦法タイプ: 能動
      if (!currentTarget) return true

      // 敵単体へ2～3回の兵刃ダメージ
      const hitsMin = Math.round(h.varNumber(ctx.skill, 'hits_min', 2))
      const hitsMax = Math.round(h.varNumber(ctx.skill, 'hits_max', 3))
      const hits = hitsMin + Math.floor(ctx.rng() * Math.max(1, hitsMax - hitsMin + 1))
      for (let i = 0; i < hits; i += 1) h.dealSkillDamage(ctx, currentTarget, 126, 'physical')

      // 継続性弱体状態があれば付与率を15%加算する。
      const hasContinuousDebuff = currentTarget.timedStatuses.some((status) =>
        CONTINUOUS_DAMAGE_NAMES.has(status.name))
      const statusChance = Math.min(1, 0.75 + (hasContinuousDebuff ? 0.15 : 0))
      if (h.roll(ctx.rng, statusChance)) {
        // まだ付与されていない無策・封撃を優先し、両方未付与ならランダムに選ぶ。
        const statuses = ['無策', '封撃'].filter((status) => (currentTarget.statuses[status] ?? 0) <= 0)
        const pool = statuses.length > 0 ? statuses : ['無策', '封撃']
        const status = pool[Math.floor(ctx.rng() * pool.length)]!
        h.addControl(ctx, currentTarget, status, Math.round(h.varNumber(ctx.skill, 'duration', 1)))
      }

      // 発動後は1ターン冷却
      ctx.caster.skillCooldowns[ctx.skill.id || ctx.skill.name] = Math.max(
        ctx.caster.skillCooldowns[ctx.skill.id || ctx.skill.name] ?? 0,
        Math.round(h.varNumber(ctx.skill, 'cooldown', 1)),
      )
      return true
    }

    case '越後二天': {
      // 戦法タイプ: 突撃
      if (!currentTarget) return true

      // 通常攻撃対象へ108%の兵刃ダメージを与える。
      const wasSilenced = (currentTarget.statuses['無策'] ?? 0) > 0
      h.dealSkillDamage(ctx, currentTarget, 108, 'physical')

      // 無策付与率は基礎40%。この戦法の過去の発動1回につき10%、最大3回分上昇する。
      const activationStacks = Math.min(3, ctx.caster.specialState.echigoTwoHeavensActivations ?? 0)
      const silenceChance = 0.4 + activationStacks * 0.1
      if (h.roll(ctx.rng, silenceChance)) h.addControl(ctx, currentTarget, '無策', 1)

      // 発動前から対象が無策中だった場合、自身を116%・武勇依存で回復する。
      if (wasSilenced) h.healBySkill(ctx, ctx.caster, 116, 'bravery')

      // 大将なら70%、それ以外は50%で別の敵へ98%の兵刃ダメージを追加する。
      if (h.roll(ctx.rng, hasCommanderSkill(ctx.caster) ? 0.7 : 0.5)) {
        const extra = h.aliveRandom(ctx.enemies, ctx.rng, ctx).find((enemy) => enemy.id !== currentTarget.id) ?? currentTarget
        h.dealSkillDamage(ctx, extra, 98, 'physical')
      }
      // 今回の発動を、次回以降の無策付与率へ反映する。
      ctx.caster.specialState.echigoTwoHeavensActivations = Math.min(3, activationStacks + 1)
      return true
    }

    case '疾風迅雷': {
      // 戦法タイプ: 指揮
      // 武勇依存の45%で発動する。
      const triggerChance = attributeDependentChance(0.45, [h.statOf(ctx.caster, 'val')])
      if (!h.roll(ctx.rng, triggerChance)) return true

      // 敵軍複数に76%の兵刃ダメージ
      h.aliveRandom(ctx.enemies, ctx.rng, ctx).slice(0, Math.round(h.varNumber(ctx.skill, 'target_count', 2))).forEach((enemy) => {
        const wasParalyzed = (enemy.statuses['麻痺'] ?? 0) > 0
        h.dealSkillDamage(ctx, enemy, 76, 'physical')

        // 武勇依存の50%で麻痺を付与する。
        const statusChance = attributeDependentChance(0.5, [h.statOf(ctx.caster, 'val')])
        if (h.roll(ctx.rng, statusChance)) h.addControl(ctx, enemy, '麻痺', Math.round(h.varNumber(ctx.skill, 'status_duration', 1)))

        // すでに麻痺だった場合、兵力の低い味方1人を回復
        if (wasParalyzed) {
          const ally = h.weakest(ctx.allies, 1)[0]
          if (ally) h.healBySkill(ctx, ally, 96, 'bravery')
        }
      })
      return true
    }

    case '表裏比興': {
      // 戦法タイプ: 能動
      if (ctx.trigger === 'beforeAction') {
        if (!currentTarget) return true
        // 敵軍単体へ142%・知略依存の計略ダメージを与える。
        const wasConfused = (currentTarget.statuses['混乱'] ?? 0) > 0
        h.dealSkillDamage(ctx, currentTarget, 142, 'strategy')
        // 同じ対象へ混乱を1ターン付与し、次の初回通常攻撃を監視する。
        h.addControl(ctx, currentTarget, '混乱', 1)
        currentTarget.specialState.doubleDealerWatcherRole = roleCode(ctx.caster)
        currentTarget.specialState.doubleDealerWatcherUntil = ctx.turn + 1
        currentTarget.specialState.doubleDealerWatcherConsumed = 0

        // 大将時は、混乱を付与した敵へ自身の被ダメージを3%（知略依存）肩代わりさせる。
        if (hasCommanderSkill(ctx.caster)) {
          ctx.caster.specialState.damageShoulderEnemyRole = roleCode(currentTarget)
          ctx.caster.specialState.damageShoulderPercent = attributeDependentValue(3, [h.statOf(ctx.caster, 'int')])
          ctx.caster.specialState.damageShoulderUntil = expiresAfterTurns(ctx.turn, 1)
          ctx.caster.specialState.damageShoulderEffect = 1
        }

        if (wasConfused) {
          // 既に混乱中なら、元の対象の友軍を優先して別の敵へ192%の計略ダメージを与える。
          const extra = h.aliveRandom(ctx.enemies, ctx.rng, ctx).find((enemy) => enemy.id !== currentTarget.id) ?? currentTarget
          h.dealSkillDamage(ctx, extra, 192, 'strategy')
        }
        return true
      }

      const attacker = ctx.eventSubject
      const attacked = ctx.target
      // 表裏比興を受けた敵の、次の初回通常攻撃だけに反応する。
      if (
        !attacker
        || !attacked
        || attacker.specialState.doubleDealerWatcherRole !== roleCode(ctx.caster)
        || (attacker.specialState.doubleDealerWatcherUntil ?? 0) < ctx.turn
        || (attacker.specialState.doubleDealerWatcherConsumed ?? 0) > 0
      ) return true
      attacker.specialState.doubleDealerWatcherConsumed = 1

      if (attacked.side === ctx.caster.side) {
        // 混乱した敵が自軍を攻撃した場合、その攻撃対象を90%・知略依存で回復する。
        h.healBySkill(ctx, attacked, 90, 'strategy')
      } else {
        // 混乱した敵が敵軍を攻撃した場合、その敵自身へ90%の計略ダメージを与える。
        h.dealSkillDamage(ctx, attacker, 90, 'strategy')
      }
      return true
    }

    case '瞬息万変': {
      // 戦法タイプ: 能動
      if (!currentTarget) return true

      // 敵単体に162%の計略ダメージ
      const wasConfused = (currentTarget.statuses['混乱'] ?? 0) > 0
      h.dealSkillDamage(ctx, currentTarget, 162, 'strategy')

      // 混乱を付与
      h.addControl(ctx, currentTarget, '混乱', Math.round(h.varNumber(ctx.skill, 'dur', 1)))

      // 既に混乱していれば、味方同士の攻撃として追加ダメージを発生させる
      if (wasConfused) {
        const attacker = h.aliveRandom(ctx.enemies, ctx.rng, ctx).find((enemy) => enemy.id !== currentTarget.id)
        if (attacker) {
          const kind = h.statOf(attacker, 'int') >= h.statOf(attacker, 'val') ? 'strategy' : 'physical'
          h.dealSkillDamage({ ...ctx, caster: attacker }, currentTarget, 158, kind)
        }
      }
      return true
    }

    case '三河武士': {
      // 戦法タイプ: 兵種
      if (ctx.trigger === 'preparationTurn') {
        // 戦闘開始時の統率上昇は一度だけ。徳川家康装備時は自身の統率依存で増加する。
        const baseBuff = h.varNumber(ctx.skill, 'stat_buff', 16)
        const statBuff = ctx.caster.name === '徳川家康'
          ? attributeDependentValue(baseBuff, [h.statOf(ctx.caster, 'lea')])
          : baseBuff
        ctx.allies.forEach((ally) => {
          ally.buffs.lea = (ally.buffs.lea ?? 0) + statBuff
        })
        ctx.caster.specialState.mikawaWarriorActive = 1
        ctx.caster.specialState.mikawaWarriorRequiredHits = 3
        log(ctx.logs, ctx, `三河武士: 自軍全体の統率が${statBuff.toFixed(2)}上昇`)
        return true
      }

      if (ctx.trigger === 'onNormalAttackReceived') {
        // 不屈を予約済み、または4回発動済みなら新しい被弾を数えない。
        if (
          (ctx.caster.specialState.mikawaWarriorActive ?? 0) <= 0
          || (ctx.caster.specialState.mikawaWarriorPendingTurn ?? 0) > 0
          || (ctx.caster.specialState.mikawaWarriorUnyieldingCount ?? 0) >= 4
        ) return true
        const hits = (ctx.caster.specialState.mikawaWarriorNormalHits ?? 0) + 1
        const required = ctx.caster.specialState.mikawaWarriorRequiredHits ?? 3
        ctx.caster.specialState.mikawaWarriorNormalHits = hits
        if (hits >= required) {
          ctx.caster.specialState.mikawaWarriorPendingTurn = ctx.turn + 1
          log(ctx.logs, ctx, `三河武士: 通常攻撃を累計${hits}回受け、次ターンの不屈を予約`)
        }
        return true
      }

      // 予約された次ターン開始時だけ不屈を発動する。
      if ((ctx.caster.specialState.mikawaWarriorPendingTurn ?? 0) !== ctx.turn) return true
      const count = Math.min(4, (ctx.caster.specialState.mikawaWarriorUnyieldingCount ?? 0) + 1)
      ctx.caster.specialState.mikawaWarriorUnyieldingCount = count
      ctx.caster.specialState.mikawaWarriorPendingTurn = 0
      ctx.caster.specialState.mikawaWarriorNormalHits = 0

      // 不屈の発動時は、自軍全体を60%・統率依存で回復する。
      living(ctx.allies).forEach((ally) => h.healBySkill(ctx, ally, 60, 'leadership'))
      log(ctx.logs, ctx, `三河武士: 不屈を発動（${count}回目）`)

      if (count === 4) {
        // 4回目は各武将が、ランダムな敵単体へ高い方の属性で82%ダメージを与える。
        living(ctx.allies).forEach((ally) => {
          const target = randomLiving({ ...ctx, caster: ally }, h, ctx.enemies)
          if (!target) return
          const kind = h.statOf(ally, 'val') >= h.statOf(ally, 'int') ? 'physical' : 'strategy'
          h.dealSkillDamage({ ...ctx, caster: ally }, target, 82, kind)
        })
        ctx.caster.specialState.mikawaWarriorActive = 0
      } else {
        // 次回の不屈に必要な通常攻撃被弾数を1回ずつ増やす。
        ctx.caster.specialState.mikawaWarriorRequiredHits = 3 + count
      }
      return true
    }

    case '風林火山': {
      // 戦法タイプ: 指揮
      if (ctx.trigger === 'preparationTurn') {
        // 初回の旗は、自身の最高属性（速度=風、知略=林、武勇=火、統率=山）で決める。
        const stats: Array<{ stat: Stat, phase: number }> = [
          { stat: 'spd', phase: 0 },
          { stat: 'int', phase: 1 },
          { stat: 'val', phase: 2 },
          { stat: 'lea', phase: 3 },
        ]
        ctx.caster.specialState.furinInitialPhase = [...stats]
          .sort((a, b) => h.statOf(ctx.caster, b.stat) - h.statOf(ctx.caster, a.stat))[0]!.phase
        return true
      }
      // 旗は1・3・5・7ターン目に切り替わり、初回位置から風・林・火・山の順に巡回する。
      if (ctx.turn < 1 || ctx.turn % 2 === 0) return true
      const phase = ((ctx.caster.specialState.furinInitialPhase ?? 0) + Math.floor((ctx.turn - 1) / 2)) % 4
      // 通常は2名。大将時は対象人数増加率を25%加算し、75%で3名にする。
      const targetCount = h.roll(ctx.rng, hasCommanderSkill(ctx.caster) ? 0.75 : 0.5) ? 3 : 2

      if (phase === 0) {
        // 風: 自軍2～3名の兵刃与ダメージを速度依存で2ターン最大22%上昇させる。
        const bonus = attributeDependentValue(22, [h.statOf(ctx.caster, 'spd')])
        explicitAllyTargets(ctx, h, targetCount).forEach((ally) => {
          h.addTimedModifier(ctx, ally, 'attackDamage', bonus, 2, 1)
        })
      } else if (phase === 1) {
        // 林: 敵軍2～3名へ92%・知略依存の計略ダメージを与える。
        explicitEnemyTargets(ctx, h, targetCount).forEach((enemy) => h.dealSkillDamage(ctx, enemy, 92, 'strategy'))
      } else if (phase === 2) {
        // 火: ランダムな敵軍単体へ156%の兵刃ダメージを1～2回与える。
        const hits = 1 + Math.floor(ctx.rng() * 2)
        for (let i = 0; i < hits; i += 1) {
          const enemy = h.chooseTarget(ctx.enemies, ctx.rng, ctx)
          if (enemy) h.dealSkillDamage(ctx, enemy, 156, 'physical')
        }
      } else {
        // 山: 自軍2～3名の兵刃被ダメージを統率依存で2ターン最大22%低下させる。
        const reduction = attributeDependentValue(22, [h.statOf(ctx.caster, 'lea')])
        explicitAllyTargets(ctx, h, targetCount).forEach((ally) => {
          h.addTimedModifier(ctx, ally, 'physicalDamageTaken', -reduction, 2, 1)
        })
      }
      return true
    }

    case '無想掃討': {
      // 戦法タイプ: 能動
      if (!currentTarget) return true

      // 対象へ102%の兵刃ダメージ
      h.dealSkillDamage(ctx, currentTarget, 102, 'physical')

      // 50%を基礎として速度依存で、別対象にも同じダメージを与える。
      const extra = h.aliveRandom(ctx.enemies, ctx.rng, ctx).find((enemy) => enemy.id !== currentTarget.id)
      if (extra && h.roll(ctx.rng, attributeDependentChance(0.5, [h.statOf(ctx.caster, 'spd')]))) {
        h.dealSkillDamage(ctx, extra, 102, 'physical')
      }

      // このターンに実際に自身より先に行動を完了した武将数に応じ、
      // 兵刃与ダメージ上昇量を10%ずつ減らす。速度だけ高くても行動不能なら数えない。
      const actedEarlier = [...ctx.allies, ...ctx.enemies]
        .filter((fighter) => fighter.id !== ctx.caster.id && fighter.specialState.lastCompletedActionTurn === ctx.turn).length
      // 大将時は減少回数を最大2回、それ以外は実人数分まで反映する。
      const reductions = hasCommanderSkill(ctx.caster) ? Math.min(2, actedEarlier) : actedEarlier
      const bonus = Math.max(0, 50 - reductions * 10)
      h.addTimedModifier(ctx, ctx.caster, 'attackDamage', bonus, 2, 1)
      return true
    }

    case '追い崩し':
    case '追亡逐北': {
      // 戦法タイプ: 能動。発動率35%の判定は battleSimulator.ts の trySkill で行う。
      // 説明通り、残兵割合などで偏らせず生存中の敵から1名を無作為に選ぶ。
      const target = h.aliveRandom(ctx.enemies, ctx.rng, ctx)[0]
      if (!target) return true

      // 対象へ146%（知略依存）の計略ダメージを与える。
      h.dealSkillDamage(ctx, target, 146, 'strategy')
      // 同じ対象へ、指揮・受動戦法を発動不能にする畏縮を1ターン付与する。
      h.addControl(ctx, target, '畏縮', 1)
      return true
    }

    case '三河魂': {
      // 戦法タイプ: 指揮。通常攻撃を受けた武将はeventSubject、攻撃者はtargetで受け取る。
      const attacked = ctx.eventSubject ?? ctx.caster
      const attacker = ctx.target
      if (!attacker || attacker.side === ctx.caster.side) return true

      if (attacked.id !== ctx.caster.id) {
        // 所持者本人を除く友軍が受撃した時だけ、攻撃者へ全属性低下を積む。
        const stackKey = `mikawaSoulStacks:${ctx.caster.id}`
        const stacks = attacker.specialState[stackKey] ?? 0
        const maxStacks = Math.round(h.varNumber(ctx.skill, 'max_stacks', 8))
        if (stacks >= maxStacks) return true

        // 最大レベルの2.5%へ、所持者の統率依存補正を加える。
        const leadershipScale = 1 + Math.max(0, h.statOf(ctx.caster, 'lea') - 100) * 0.001
        const reductionRate = h.varNumber(ctx.skill, 'stat_reduction_rate', 0.025) * leadershipScale
        const allStats: Stat[] = ['lea', 'val', 'int', 'pol', 'cha', 'spd']
        allStats.forEach((stat) => {
          const reduction = Number(((attacker.baseStats[stat] ?? 0) * reductionRate).toFixed(2))
          attacker.buffs[stat] = (attacker.buffs[stat] ?? 0) - reduction
        })
        attacker.specialState[stackKey] = stacks + 1
        const totalPercent = Number((reductionRate * 100 * (stacks + 1)).toFixed(2))
        log(ctx.logs, ctx, `三河魂: ${attacker.name}の全属性が累計${totalPercent}%低下`, attacker)
        return true
      }

      // 大将本人が受撃した時は80%で、武勇が最も高い生存友軍へ援護を依頼する。
      if (hasCommanderSkill(ctx.caster) && h.roll(ctx.rng, h.varNumber(ctx.skill, 'guard_chance', 0.8))) {
        const guardian = living(ctx.allies)
          .filter((ally) => ally.id !== ctx.caster.id)
          .sort((a, b) => h.statOf(b, 'val') - h.statOf(a, 'val'))[0]
        if (guardian) {
          const duration = Math.max(1, Math.round(h.varNumber(ctx.skill, 'guard_duration', 1)))
          ctx.caster.statuses['援護'] = Math.max(ctx.caster.statuses['援護'] ?? 0, duration)
          ctx.caster.specialState.mikawaGuardianRole = guardian.role === 'vice1' ? 1 : 2
          log(ctx.logs, ctx, `三河魂: ${guardian.name}が${ctx.caster.name}を援護(${duration}T)`)
        }
      }
      return true
    }

    case '御旗楯無': {
      // 戦法タイプ: 受動。戦闘開始時に被ダメージ軽減判定を有効化する。
      if (ctx.trigger === 'preparationTurn') {
        ctx.caster.specialState.mihataPassive = 1
        return true
      }
      // 通常攻撃を受けた時、統率依存の確率で友軍単体が攻撃者へ94%の兵刃ダメージを与える。
      const attacker = ctx.target
      if (!attacker || attacker.side === ctx.caster.side) return true
      const chance = attributeDependentChance(0.4, [h.statOf(ctx.caster, 'lea')])
      if (!h.roll(ctx.rng, chance)) return true
      const helper = h.aliveRandom(ctx.allies.filter((ally) => ally.id !== ctx.caster.id), ctx.rng, ctx)[0]
      if (helper) h.dealSkillDamage({ ...ctx, caster: helper }, attacker, 94, 'physical')
      return true
    }

    case '七十二の計': {
      // 戦法タイプ: 受動。奇策率50%、奇策最終倍率への加算30%を戦闘中有効にする。
      if (ctx.trigger !== 'preparationTurn') return true
      setSpecialStateContribution(ctx.caster, 'strategyCriticalChance', 'seventyTwoStrategyCriticalChance', 50)
      setSpecialStateContribution(ctx.caster, 'strategyCriticalDamageBonus', 'seventyTwoStrategyCriticalDamageBonus', 30)
      ctx.caster.specialState.seventyTwoCriticalHits = 0
      ctx.caster.specialState.seventyTwoBurstTriggered = 0
      log(ctx.logs, ctx, '七十二の計: 奇策率50%、奇策発動時の最終ダメージ180%を獲得')
      return true
    }

    case '乱世の華': {
      // 戦法タイプ: 突撃。通常攻撃対象へ兵刃・計略を各158%で与える。
      if (!currentTarget) return true
      h.dealSkillDamage(ctx, currentTarget, 158, 'physical', {
        attackStats: ['val'], defenseStats: ['lea'], coefficient: 1.37,
      })
      h.dealSkillDamage(ctx, currentTarget, 158, 'strategy', {
        attackStats: ['int'], defenseStats: ['spd'], coefficient: 1.37,
      })
      return true
    }

    case '所向無敵': {
      // 戦法タイプ: 能動。1ターン準備後、敵軍全体へ254%の兵刃ダメージ。
      living(ctx.enemies).forEach((enemy) => h.dealSkillDamage(ctx, enemy, 254, 'physical'))
      return true
    }

    case '草木皆兵': {
      // 戦法タイプ: 能動。1ターン準備後、敵2名へ142%計略ダメージ。
      h.aliveRandom(ctx.enemies, ctx.rng, ctx).slice(0, 2)
        .forEach((enemy) => h.dealSkillDamage(ctx, enemy, 142, 'strategy'))
      // 同時にランダムな自軍2名を106%で回復する。
      explicitAllyTargets(ctx, h, 2).forEach((ally) => h.healBySkill(ctx, ally, 106, 'strategy'))
      return true
    }

    case '疾風怒濤': {
      // 戦法タイプ: 能動。自身と友軍1名へ会心45%を2ターン付与する。
      const friend = randomLiving(ctx, h, ctx.allies.filter((ally) => ally.id !== ctx.caster.id))
      ;[ctx.caster, friend].filter(Boolean).forEach((ally) => {
        h.addTimedModifier(ctx, ally!, 'physicalCriticalChance', 45, 2)
      })
      // 敵軍2名へ102%の兵刃ダメージ。
      h.aliveRandom(ctx.enemies, ctx.rng, ctx).slice(0, 2)
        .forEach((enemy) => h.dealSkillDamage(ctx, enemy, 102, 'physical'))
      return true
    }

    case '乗勝追撃': {
      // 戦法タイプ: 突撃。通常攻撃後、敵軍全体へ136%の兵刃ダメージ。
      living(ctx.enemies).forEach((enemy) => h.dealSkillDamage(ctx, enemy, 136, 'physical'))
      return true
    }

    case '先手必勝': {
      // 戦法タイプ: 能動。敵軍2名へ134%の計略ダメージ。
      h.aliveRandom(ctx.enemies, ctx.rng, ctx).slice(0, 2).forEach((enemy) => {
        h.dealSkillDamage(ctx, enemy, 134, 'strategy')
        // 対象が次に受ける能動戦法ダメージを52%上昇させる。
        enemy.specialState.nextActiveDamageTaken = 52
      })
      return true
    }

    case '剛の武者': {
      // 戦法タイプ: 突撃。通常攻撃対象へ246%の兵刃ダメージ。
      if (!currentTarget) return true
      h.dealSkillDamage(ctx, currentTarget, 246, 'physical')
      // 対象の計略与ダメージを2ターン90%低下させる。
      h.addTimedModifier(ctx, currentTarget, 'strategyDamageDealt', -90, 2)
      return true
    }

    case '形影相弔': {
      // 戦法タイプ: 能動。自身がランダムな敵へ192%の計略ダメージ。
      const firstTarget = randomLiving(ctx, h, ctx.enemies)
      if (firstTarget) h.dealSkillDamage(ctx, firstTarget, 192, 'strategy')
      // 知略最高の敵も攻撃し、6ターン目以降だけ対象を自軍へ変更する。
      const enemyCaster = highestByStat(ctx.enemies, 'int')
      const secondPool = ctx.turn >= 6 ? ctx.allies : ctx.enemies.filter((enemy) => enemy.id !== enemyCaster?.id)
      const secondTarget = randomLiving(ctx, h, secondPool)
      if (enemyCaster && secondTarget) h.dealSkillDamage({ ...ctx, caster: enemyCaster }, secondTarget, 192, 'strategy')
      return true
    }

    case '死中求活': {
      // 戦法タイプ: 受動。兵刃ダメージを受けるたび武勇+5、最大10回。
      if (ctx.trigger === 'onPhysicalDamageReceived') {
        const stacks = ctx.caster.specialState.desperateValorStacks ?? 0
        if (stacks < 10) {
          ctx.caster.specialState.desperateValorStacks = stacks + 1
          ctx.caster.buffs.val = (ctx.caster.buffs.val ?? 0) + 5
          log(ctx.logs, ctx, `死中求活: 武勇+${(stacks + 1) * 5}`)
        }
        return true
      }
      // 5ターン目に、重ね数に応じて125%+12%×重ね数の全体攻撃。
      if (ctx.trigger === 'turnStart' && ctx.turn === 5) {
        const rate = 125 + (ctx.caster.specialState.desperateValorStacks ?? 0) * 12
        living(ctx.enemies).forEach((enemy) => h.dealSkillDamage(ctx, enemy, rate, 'physical'))
      }
      return true
    }

    case '月華鶴影': {
      // 戦法タイプ: 指揮。友軍が通常攻撃を受けるたび受撃回数を記録する。
      const attacked = ctx.eventSubject ?? ctx.caster
      const attacker = ctx.target
      if (!attacker || attacked.id === ctx.caster.id || attacker.side === ctx.caster.side) return true
      const hits = (ctx.caster.specialState.moonNormalHits ?? 0) + 1
      ctx.caster.specialState.moonNormalHits = hits
      // 35%で敵軍2名へ102%の兵刃ダメージ。
      if (h.roll(ctx.rng, 0.35)) {
        h.aliveRandom(ctx.enemies, ctx.rng, ctx).slice(0, 2)
          .forEach((enemy) => h.dealSkillDamage(ctx, enemy, 102, 'physical'))
      }
      // 4回受撃するたび会心+25%、最大2回。
      if (hits % 4 === 0 && (ctx.caster.specialState.moonCriticalStacks ?? 0) < 2) {
        const stacks = (ctx.caster.specialState.moonCriticalStacks ?? 0) + 1
        ctx.caster.specialState.moonCriticalStacks = stacks
        ctx.caster.buffs.physicalCriticalChance = (ctx.caster.buffs.physicalCriticalChance ?? 0) + 25
        log(ctx.logs, ctx, `月華鶴影: 会心率+${stacks * 25}%`)
      }
      return true
    }

    case '境目奮戦': {
      // 戦法タイプ: 突撃。通常攻撃後、兵力割合が最も低い敵へ260%の計略ダメージ。
      const target = [...living(ctx.enemies)].sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0]
      if (!target) return true
      h.dealSkillDamage(ctx, target, 260, 'strategy')
      // 受ける回復効果を1ターン30%低下させる。
      // 同じ対象へ再付与されても加算せず、回復低下30%の効果時間だけ更新する。
      h.addTimedModifier(ctx, target, 'healingReceived', -30, 1, 1)
      return true
    }

    case '献身': {
      // 戦法タイプ: 指揮。初回判定では異性の友軍1名へ次回攻撃の追加攻撃を予約する。
      if (ctx.trigger === 'beforeAction') {
        // 戦法自体は指揮戦法として常時有効だが、追加攻撃の予約は知略依存で44%。
        const chance = attributeDependentChance(0.44, [h.statOf(ctx.caster, 'int')])
        if (!h.roll(ctx.rng, chance)) return true
        const oppositeGender = living(ctx.allies).filter((ally) => ally.id !== ctx.caster.id && ally.gender && ally.gender !== ctx.caster.gender)
        const target = randomLiving(ctx, h, oppositeGender.length > 0 ? oppositeGender : ctx.allies.filter((ally) => ally.id !== ctx.caster.id))
        if (!target) return true
        target.specialState.devotionSourceRole = roleCode(ctx.caster)
        target.specialState.devotionUntil = ctx.turn + 1
        h.addTimedModifier(ctx, ctx.caster, 'damageTaken', 18, 1)
        log(ctx.logs, ctx, `献身: ${target.name}の次の通常攻撃へ追加攻撃を付与`, target)
        return true
      }
      // 予約された友軍の通常攻撃後、ランダムな敵へ262%の兵刃ダメージ。
      const attacker = ctx.eventSubject
      if (
        !attacker
        || attacker.specialState.devotionSourceRole !== roleCode(ctx.caster)
        || (attacker.specialState.devotionUntil ?? 0) < ctx.turn
      ) return true
      attacker.specialState.devotionSourceRole = 0
      const target = randomLiving(ctx, h, ctx.enemies)
      if (target) h.dealSkillDamage(ctx, target, 262, 'physical')
      return true
    }

    case '鬼小島': {
      // 戦法タイプ: 突撃。通常攻撃対象へ304%の兵刃ダメージ。
      if (!currentTarget) return true
      h.dealSkillDamage(ctx, currentTarget, 304, 'physical')
      // 発動するたび次回以降の発動率を5%低下、最大4回。
      const stacks = ctx.caster.specialState.onikojimaRateDownStacks ?? 0
      if (stacks < 4) {
        ctx.caster.specialState.onikojimaRateDownStacks = stacks + 1
        ctx.caster.specialState['activationRatePenalty:鬼小島'] = (stacks + 1) * 5
        log(ctx.logs, ctx, `鬼小島: 発動率-${(stacks + 1) * 5}%`)
      }
      return true
    }

    case '洞察反撃': {
      if (ctx.trigger === 'beforeAction') {
        // 戦法タイプ: 能動。1ターン準備後、自身と友軍1名へ洞察を2ターン付与。
        const friend = randomLiving(ctx, h, ctx.allies.filter((ally) => ally.id !== ctx.caster.id))
        ;[ctx.caster, friend].filter(Boolean).forEach((ally) => {
          ally!.specialState.insightUntil = expiresAfterTurns(ctx.turn, 2)
        })
        // 自身が次に通常攻撃を受けた時の反撃を2ターン予約する。
        ctx.caster.specialState.insightCounterUntil = expiresAfterTurns(ctx.turn, 2)
        ctx.caster.specialState.insightCounterReady = 1
        return true
      }
      const attacker = ctx.target
      if (
        !attacker
        || (ctx.caster.specialState.insightCounterReady ?? 0) <= 0
        || (ctx.caster.specialState.insightCounterUntil ?? 0) < ctx.turn
      ) return true
      ctx.caster.specialState.insightCounterReady = 0
      h.dealSkillDamage(ctx, attacker, 304, 'strategy')
      return true
    }

    case '陣形崩し': {
      // 戦法タイプ: 能動。1ターン準備後、敵2～3名の統率・知略を48低下し102%兵刃ダメージ。
      const count = Math.min(living(ctx.enemies).length, 2 + Math.floor(ctx.rng() * 2))
      h.aliveRandom(ctx.enemies, ctx.rng, ctx).slice(0, count).forEach((enemy) => {
        h.addTimedModifier(ctx, enemy, 'lea', -48, 2)
        h.addTimedModifier(ctx, enemy, 'int', -48, 2)
        h.dealSkillDamage(ctx, enemy, 102, 'physical')
      })
      return true
    }

    case '楼岸一番': {
      // 戦法タイプ: 突撃。高い方の属性で通常攻撃対象へ188%ダメージ。
      if (!currentTarget) return true
      const kind = h.statOf(ctx.caster, 'val') >= h.statOf(ctx.caster, 'int') ? 'physical' : 'strategy'
      h.dealSkillDamage(ctx, currentTarget, 188, kind)
      // 対象の与ダメージ低下率も、自身の武勇・知略の高い方に依存する。
      const debuffStat: Stat = kind === 'physical' ? 'val' : 'int'
      const reduction = attributeDependentValue(30, [h.statOf(ctx.caster, debuffStat)])
      h.addTimedModifier(ctx, currentTarget, 'damageDealt', -reduction, currentTarget.hp > currentTarget.maxHp * 0.5 ? 2 : 1)
      return true
    }

    case '先制攻撃': {
      // 戦法タイプ: 能動。1ターン準備後、敵2～3名へ132%計略ダメージ。
      const count = Math.min(living(ctx.enemies).length, 2 + Math.floor(ctx.rng() * 2))
      h.aliveRandom(ctx.enemies, ctx.rng, ctx).slice(0, count).forEach((enemy) => {
        h.dealSkillDamage(ctx, enemy, 132, 'strategy')
        // 2ターン、能動戦法による被ダメージを30%上昇。
        h.addTimedModifier(ctx, enemy, 'activeDamageTaken', 30, 2)
      })
      return true
    }

    case '一念乱志': {
      // 戦法タイプ: 受動。3ターン目以降、70%から毎ターン5%ずつ低下する確率で攻撃。
      if (ctx.turn < 3) return true
      const chance = Math.max(0, 0.7 - (ctx.turn - 3) * 0.05)
      if (!h.roll(ctx.rng, chance)) return true
      const target = randomLiving(ctx, h, ctx.enemies)
      if (!target) return true
      h.dealSkillDamage(ctx, target, 178, 'physical')
      // 35%で武勇最高の友軍も同じ対象へ178%の兵刃ダメージ。
      const helper = highestByStat(ctx.allies, 'val')
      if (helper && h.roll(ctx.rng, 0.35)) h.dealSkillDamage({ ...ctx, caster: helper }, target, 178, 'physical')
      return true
    }

    case '鉄砲猛撃': {
      // 戦法タイプ: 能動。敵軍2名へ102%の計略ダメージ、与ダメージを2ターン12%低下。
      h.aliveRandom(ctx.enemies, ctx.rng, ctx).slice(0, 2).forEach((enemy) => {
        h.dealSkillDamage(ctx, enemy, 102, 'strategy')
        h.addTimedModifier(ctx, enemy, 'damageDealt', -12, 2)
      })
      return true
    }

    case '覇王の右筆': {
      // 戦法タイプ: 指揮。友軍の通常攻撃後、40%で同じ対象へ126%の兵刃ダメージ。
      const attacker = ctx.eventSubject
      if (attacker && attacker.id !== ctx.caster.id && currentTarget && h.roll(ctx.rng, 0.4)) {
        h.dealSkillDamage(ctx, currentTarget, 126, 'physical')
      }
      return true
    }

    case '岐阜侍従': {
      // 戦法タイプ: 能動。武勇・知略の両方が対象より高ければ170%、それ以外は148%。
      const target = currentTarget ?? randomLiving(ctx, h, ctx.enemies)
      if (!target) return true
      const enhanced = h.statOf(ctx.caster, 'val') > h.statOf(target, 'val') && h.statOf(ctx.caster, 'int') > h.statOf(target, 'int')
      const rate = enhanced ? 170 : 148
      h.dealSkillDamage(ctx, target, rate, 'physical')
      h.dealSkillDamage(ctx, target, rate, 'strategy')
      return true
    }

    case '鈴鳴り': {
      // 戦法タイプ: 受動。毎ターン66%、劣勢時は半分の33%で210%兵刃ダメージ。
      const allyHp = living(ctx.allies).reduce((sum, ally) => sum + ally.hp, 0)
      const allyMax = ctx.allies.reduce((sum, ally) => sum + ally.maxHp, 0)
      const enemyHp = living(ctx.enemies).reduce((sum, enemy) => sum + enemy.hp, 0)
      const chance = allyHp <= allyMax * 0.5 && allyHp < enemyHp ? 0.33 : 0.66
      const target = randomLiving(ctx, h, ctx.enemies)
      if (target && h.roll(ctx.rng, chance)) h.dealSkillDamage(ctx, target, 210, 'physical')
      return true
    }

    case '先制先登': {
      // 戦法タイプ: 能動。敵軍2名へ122%の兵刃ダメージ。
      h.aliveRandom(ctx.enemies, ctx.rng, ctx).slice(0, 2)
        .forEach((enemy) => h.dealSkillDamage(ctx, enemy, 122, 'physical'))
      // 次ターンの速度順で先に行動できるよう、先攻を次ターンまで保持する。
      ctx.caster.statuses['先攻'] = Math.max(ctx.caster.statuses['先攻'] ?? 0, 2)
      return true
    }

    case '鬼玄蕃': {
      // 戦法タイプ: 能動。次の被ダメージを30%増加させる。
      ctx.caster.specialState.nextDamageTakenBonus = 30
      // 2ターン、兵刃ダメージの18%を回復する離反を獲得する。
      ctx.caster.specialState.physicalLifeStealPercent = 18
      ctx.caster.specialState.physicalLifeStealUntil = expiresAfterTurns(ctx.turn, 2)
      // 敵軍2～3名へ118%の兵刃ダメージ。
      const count = Math.min(living(ctx.enemies).length, 2 + Math.floor(ctx.rng() * 2))
      h.aliveRandom(ctx.enemies, ctx.rng, ctx).slice(0, count)
        .forEach((enemy) => h.dealSkillDamage(ctx, enemy, 118, 'physical'))
      return true
    }

    case '援護射撃': {
      if (ctx.trigger === 'beforeAction') {
        // 戦法タイプ: 能動。友軍1名へ1ターン30%の回避を付与する。
        const target = randomLiving(ctx, h, ctx.allies.filter((ally) => ally.id !== ctx.caster.id)) ?? ctx.caster
        target.specialState.skillEvasionChance = 30
        target.specialState.skillEvasionUntil = expiresAfterTurns(ctx.turn, 1)
        target.specialState.coverFireSourceRole = roleCode(ctx.caster)
        target.specialState.coverFireReady = 1
        log(ctx.logs, ctx, `援護射撃: ${target.name}へ回避30%を付与`, target)
        return true
      }
      // 対象が初めて実ダメージを受けた時、攻撃者へ162%の兵刃ダメージ。
      const damaged = ctx.eventSubject
      const attacker = ctx.target
      if (
        !damaged
        || !attacker
        || damaged.specialState.coverFireSourceRole !== roleCode(ctx.caster)
        || (damaged.specialState.coverFireReady ?? 0) <= 0
      ) return true
      damaged.specialState.coverFireReady = 0
      h.dealSkillDamage(ctx, attacker, 162, 'physical', {
        attackStats: ['val', 'lea'], defenseStats: ['lea'], coefficient: 0.9,
      })
      return true
    }

    case '一刀両断': {
      // 戦法タイプ: 突撃。通常攻撃対象へ316%の兵刃ダメージ。
      if (currentTarget) h.dealSkillDamage(ctx, currentTarget, 316, 'physical')
      return true
    }

    case '矢石飛交': {
      // 戦法タイプ: 能動。敵軍単体へ84%の兵刃ダメージを2～4回。
      const target = currentTarget ?? randomLiving(ctx, h, ctx.enemies)
      if (!target) return true
      const hits = 2 + Math.floor(ctx.rng() * 3)
      for (let hit = 0; hit < hits && target.hp > 0; hit += 1) h.dealSkillDamage(ctx, target, 84, 'physical')
      return true
    }

    case '秋水一色': {
      // 戦法タイプ: 能動。1ターン準備後、自身と友軍1名の計略与ダメージを2ターン20%上昇。
      const friend = randomLiving(ctx, h, ctx.allies.filter((ally) => ally.id !== ctx.caster.id))
      ;[ctx.caster, friend].filter(Boolean).forEach((ally) => h.addTimedModifier(ctx, ally!, 'strategyDamageDealt', 20, 2))
      // その後、敵軍2名へ148%の計略ダメージ。
      h.aliveRandom(ctx.enemies, ctx.rng, ctx).slice(0, 2)
        .forEach((enemy) => h.dealSkillDamage(ctx, enemy, 148, 'strategy'))
      return true
    }

    case '槍の鈴': {
      // 戦法タイプ: 突撃。通常攻撃後、敵軍単体へ232%の兵刃ダメージ。
      const target = currentTarget ?? randomLiving(ctx, h, ctx.enemies)
      if (target) h.dealSkillDamage(ctx, target, 232, 'physical')
      // 3ターン目以降は自身を54%で回復する。
      if (ctx.turn >= 3) h.healBySkill(ctx, ctx.caster, 54, 'bravery')
      return true
    }

    case '妖怪退治': {
      // 戦法タイプ: 能動。敵軍単体の強化効果を1個解除してから256%の兵刃ダメージ。
      const target = currentTarget ?? randomLiving(ctx, h, ctx.enemies)
      if (!target) return true
      const removed = removeOnePositiveEffect(target)
      if (removed) log(ctx.logs, ctx, `妖怪退治: ${target.name}の${removed}を強化解除`, target)
      h.dealSkillDamage(ctx, target, 256, 'physical')
      return true
    }

    case '驍勇善戦': {
      // 戦法タイプ: 能動。1ターン準備後、自身へ会心40%を2ターン付与。
      h.addTimedModifier(ctx, ctx.caster, 'physicalCriticalChance', 40, 2)
      const target = currentTarget ?? randomLiving(ctx, h, ctx.enemies)
      if (target) h.dealSkillDamage(ctx, target, 312, 'physical')
      return true
    }

    case '甲州流軍学': {
      // 戦法タイプ: 能動。敵軍単体へ186%の計略ダメージ。
      const target = currentTarget ?? randomLiving(ctx, h, ctx.enemies)
      if (target) h.dealSkillDamage(ctx, target, 186, 'strategy')
      // 友軍1名へ次の被ダメージを無効にする鉄壁を1回付与。
      const ally = randomLiving(ctx, h, ctx.allies)
      if (ally) {
        ally.specialState.ironWallCharges = (ally.specialState.ironWallCharges ?? 0) + 1
        log(ctx.logs, ctx, `甲州流軍学: ${ally.name}へ鉄壁1回を付与`, ally)
      }
      return true
    }

    case '忠勤励行': {
      // 戦法タイプ: 能動。1ターン準備後、自軍2名の兵刃与ダメージを2ターン15%上昇。
      h.aliveRandom(ctx.allies, ctx.rng, ctx).slice(0, 2)
        .forEach((ally) => h.addTimedModifier(ctx, ally, 'attackDamage', 15, 2))
      // 自身が敵軍単体へ296%の兵刃ダメージ。
      const target = randomLiving(ctx, h, ctx.enemies)
      if (target) h.dealSkillDamage(ctx, target, 296, 'physical')
      return true
    }

    case '一六勝負': {
      // 戦法タイプ: 能動。50%ずつで240%計略ダメージまたは240%回復。
      if (h.roll(ctx.rng, 0.5)) {
        const target = randomLiving(ctx, h, ctx.enemies)
        if (target) h.dealSkillDamage(ctx, target, 240, 'strategy')
      } else {
        const ally = randomLiving(ctx, h, ctx.allies)
        if (ally) h.healBySkill(ctx, ally, 240, 'strategy')
      }
      return true
    }

    case '攻守兼備': {
      // 戦法タイプ: 能動。武勇・知略の高い方で184%ダメージ。
      const target = currentTarget ?? randomLiving(ctx, h, ctx.enemies)
      if (target) {
        const kind = h.statOf(ctx.caster, 'val') >= h.statOf(ctx.caster, 'int') ? 'physical' : 'strategy'
        h.dealSkillDamage(ctx, target, 184, kind)
      }
      // 発動ターン中、兵刃・計略それぞれ最初の被ダメージを40%軽減。
      ctx.caster.specialState.attackDefenseUntil = ctx.turn
      ctx.caster.specialState.attackDefensePhysicalTurn = 0
      ctx.caster.specialState.attackDefenseStrategyTurn = 0
      return true
    }

    case '反撃': {
      if (ctx.trigger === 'beforeAction') {
        // 戦法タイプ: 能動。1ターン、通常攻撃を受けるたび60%で反撃する。
        ctx.caster.specialState.counterAttackUntil = expiresAfterTurns(ctx.turn, 1)
        return true
      }
      const attacker = ctx.target
      if (attacker && (ctx.caster.specialState.counterAttackUntil ?? 0) >= ctx.turn) {
        h.dealSkillDamage(ctx, attacker, 60, 'physical')
      }
      return true
    }

    case '神出鬼没': {
      if (ctx.trigger === 'beforeAction') {
        // 戦法タイプ: 能動。次の通常攻撃後に追加攻撃を行う状態を2ターン予約する。
        ctx.caster.specialState.sneakAttackReady = 1
        ctx.caster.specialState.sneakAttackUntil = expiresAfterTurns(ctx.turn, 2)
        return true
      }
      if ((ctx.caster.specialState.sneakAttackReady ?? 0) <= 0 || (ctx.caster.specialState.sneakAttackUntil ?? 0) < ctx.turn) return true
      ctx.caster.specialState.sneakAttackReady = 0
      if (currentTarget) h.dealSkillDamage(ctx, currentTarget, toPercent(h.varNumber(ctx.skill, 'damage_rate', 2.98)), 'physical')
      return true
    }

    case '威風凛凛': {
      // 戦法タイプ: 突撃。通常攻撃対象へ238%の兵刃ダメージ。
      if (!currentTarget) return true
      h.dealSkillDamage(ctx, currentTarget, toPercent(h.varNumber(ctx.skill, 'damage_rate', 2.38)), 'physical')
      // 武勇依存の与ダメージ低下を付与。各層は2ターンまたは次の与ダメージ2回まで、最大4層。
      const reduction = attributeDependentValue(
        toPercent(h.varNumber(ctx.skill, 'damage_debuff', 0.42)),
        [h.statOf(ctx.caster, 'val')],
      )
      h.addTimedModifier(ctx, currentTarget, 'damageDealt', -reduction, 2, 4, 2)
      return true
    }

    case '伝馬疾馳': {
      if (ctx.trigger === 'beforeAction') {
        // 戦法タイプ: 能動。友軍1名の武勇・速度を20上昇させ、行動前攻撃を予約する。
        const target = randomLiving(ctx, h, ctx.allies.filter((ally) => ally.id !== ctx.caster.id)) ?? ctx.caster
        h.addTimedModifier(ctx, target, 'val', h.varNumber(ctx.skill, 'valor_speed_buff', 20), 1)
        h.addTimedModifier(ctx, target, 'spd', h.varNumber(ctx.skill, 'valor_speed_buff', 20), 1)
        ctx.caster.specialState.postHorseTargetRole = roleCode(target)
        ctx.caster.specialState.postHorseUntil = ctx.turn
        ctx.caster.specialState.postHorseTransferred = 0
        return true
      }
      if (ctx.trigger === 'allyBeforeAction') {
        const actor = ctx.eventSubject
        // 最初の友軍への効果が終わった次のターンは、これから行動する別の友軍へ残り1ターン分を移す。
        if (
          actor
          && (ctx.caster.specialState.postHorseUntil ?? 0) < ctx.turn
          && (ctx.caster.specialState.postHorseTransferred ?? 0) === 0
        ) {
          const oldRole = ctx.caster.specialState.postHorseTargetRole ?? 0
          const candidates = ctx.allies.filter((ally) => roleCode(ally) !== oldRole)
          // 現在行動しようとしている武将が候補なら優先し、効果が行動後に空振りするのを防ぐ。
          const next = candidates.find((ally) => ally.id === actor.id) ?? randomLiving(ctx, h, candidates)
          if (next) {
            h.addTimedModifier(ctx, next, 'val', h.varNumber(ctx.skill, 'valor_speed_buff', 20), 1)
            h.addTimedModifier(ctx, next, 'spd', h.varNumber(ctx.skill, 'valor_speed_buff', 20), 1)
            ctx.caster.specialState.postHorseTargetRole = roleCode(next)
            ctx.caster.specialState.postHorseUntil = ctx.turn
          }
          ctx.caster.specialState.postHorseTransferred = 1
        }
        if (!actor || roleCode(actor) !== ctx.caster.specialState.postHorseTargetRole || (ctx.caster.specialState.postHorseUntil ?? 0) < ctx.turn) return true
        const target = randomLiving(ctx, h, ctx.enemies)
        if (target) h.dealSkillDamage({ ...ctx, caster: actor }, target, toPercent(h.varNumber(ctx.skill, 'damage_rate', 1.02)), 'physical')
        return true
      }
      return true
    }

    case '鬼義重': {
      // 戦法タイプ: 能動。敵軍2名へ214%兵刃ダメージ、統率を1ターン65低下。
      h.aliveRandom(ctx.enemies, ctx.rng, ctx).slice(0, 2).forEach((enemy) => {
        h.dealSkillDamage(ctx, enemy, toPercent(h.varNumber(ctx.skill, 'dmg_rate', 2.14)), 'physical')
        h.addTimedModifier(ctx, enemy, 'lea', -h.varNumber(ctx.skill, 'stat_debuff', 65), 1)
      })
      return true
    }

    case '荷駄崩': {
      // 戦法タイプ: 能動。敵軍2名へ134%計略ダメージ、被回復効果を1ターン40%低下。
      h.aliveRandom(ctx.enemies, ctx.rng, ctx).slice(0, 2).forEach((enemy) => {
        h.dealSkillDamage(ctx, enemy, toPercent(h.varNumber(ctx.skill, 'dmg_rate', 1.34)), 'strategy')
        h.addTimedModifier(ctx, enemy, 'healingReceived', -toPercent(h.varNumber(ctx.skill, 'heal_reduction', 0.4)), 1)
      })
      return true
    }

    case '一力当先': {
      if (ctx.trigger === 'beforeAction') {
        // 戦法タイプ: 能動。通常攻撃与ダメージ+50%と乱舞70%を2ターン付与。
        h.addTimedModifier(ctx, ctx.caster, 'attackDamage', 50, 2)
        // 軍神の所持者は通常攻撃強化だけを獲得し、乱舞は獲得できない。
        if ((ctx.caster.specialState.ranbuDisabled ?? 0) <= 0) {
          ctx.caster.specialState.splashAttackUntil = expiresAfterTurns(ctx.turn, 2)
        }
        return true
      }
      if ((ctx.caster.specialState.splashAttackUntil ?? 0) < ctx.turn || !currentTarget) return true
      // 通常攻撃対象以外の敵軍武将へ70%の兵刃ダメージ。
      living(ctx.enemies).filter((enemy) => enemy.id !== currentTarget.id)
        .forEach((enemy) => h.dealSkillDamage(ctx, enemy, 70, 'physical'))
      return true
    }

    case '火攻め': {
      // 戦法タイプ: 能動。敵軍単体へ150%の計略ダメージ。
      const target = currentTarget ?? randomLiving(ctx, h, ctx.enemies)
      if (target) h.dealSkillDamage(ctx, target, 150, 'strategy')
      return true
    }

    case '攻其不備': {
      // 戦法タイプ: 能動。統率最低へ168%兵刃、知略最低へ168%計略ダメージ。
      const physicalTarget = lowestByStat(ctx.enemies, 'lea')
      const strategyTarget = lowestByStat(ctx.enemies, 'int')
      if (physicalTarget) h.dealSkillDamage(ctx, physicalTarget, 168, 'physical')
      if (strategyTarget) h.dealSkillDamage(ctx, strategyTarget, 168, 'strategy')
      return true
    }

    case '三楽犬': {
      if (ctx.trigger === 'beforeAction') {
        // 戦法タイプ: 能動。自軍2～3名へ先攻・必中を付与し、速度最高の敵を標記する。
        const count = Math.min(living(ctx.allies).length, 2 + Math.floor(ctx.rng() * 2))
        const buffed = h.aliveRandom(ctx.allies, ctx.rng, ctx).slice(0, count)
        let mask = 0
        buffed.forEach((ally) => {
          ally.statuses['先攻'] = Math.max(ally.statuses['先攻'] ?? 0, 2)
          ally.statuses['必中'] = Math.max(ally.statuses['必中'] ?? 0, 2)
          mask += 2 ** (roleCode(ally) - 1)
        })
        const marked = highestByStat(ctx.enemies, 'spd')
        ctx.caster.specialState.sanrakuBuffedMask = mask
        ctx.caster.specialState.sanrakuMarkedRole = marked ? roleCode(marked) : 0
        ctx.caster.specialState.sanrakuUntil = ctx.turn + 1
        return true
      }
      const actedEnemy = ctx.eventSubject
      if (
        !actedEnemy
        || roleCode(actedEnemy) !== ctx.caster.specialState.sanrakuMarkedRole
        || (ctx.caster.specialState.sanrakuUntil ?? 0) < ctx.turn
      ) return true
      const mask = ctx.caster.specialState.sanrakuBuffedMask ?? 0
      living(ctx.allies).filter((ally) => (mask & (2 ** (roleCode(ally) - 1))) !== 0).forEach((ally) => {
        h.dealSkillDamage({ ...ctx, caster: ally }, actedEnemy, 146, 'physical')
      })
      ctx.caster.specialState.sanrakuMarkedRole = 0
      return true
    }

    case '城盗り': {
      const markKey = `castleRaidMark:${roleCode(ctx.caster)}`
      const untilKey = `castleRaidUntil:${roleCode(ctx.caster)}`
      if (ctx.trigger === 'beforeAction') {
        // 戦法タイプ: 能動。自身の知略を2ターン33上昇。
        h.addTimedModifier(ctx, ctx.caster, 'int', h.varNumber(ctx.skill, 'intelligence_buff', 33), 2)
        // 敵軍2～3名へ、次の計略被ダメージ時の106%追加攻撃を予約する。
        const count = Math.min(living(ctx.enemies).length, 2 + Math.floor(ctx.rng() * 2))
        h.aliveRandom(ctx.enemies, ctx.rng, ctx).slice(0, count).forEach((enemy) => {
          enemy.specialState[markKey] = 1
          enemy.specialState[untilKey] = expiresAfterTurns(ctx.turn, 2)
        })
        return true
      }
      const damaged = ctx.eventSubject
      if (!damaged || (damaged.specialState[markKey] ?? 0) <= 0 || (damaged.specialState[untilKey] ?? 0) < ctx.turn) return true
      damaged.specialState[markKey] = 0
      h.dealSkillDamage(ctx, damaged, toPercent(h.varNumber(ctx.skill, 'extra_damage_rate', 1.06)), 'strategy')
      return true
    }

    case '電光石火': {
      // 戦法タイプ: 能動。敵軍2名へ96%の兵刃ダメージ。
      h.aliveRandom(ctx.enemies, ctx.rng, ctx).slice(0, 2)
        .forEach((enemy) => h.dealSkillDamage(ctx, enemy, toPercent(h.varNumber(ctx.skill, 'dmg', 0.96)), 'physical'))
      // ランダム友軍の統率+48、その友軍が自身を2ターン援護する。
      const guardian = randomLiving(ctx, h, ctx.allies.filter((ally) => ally.id !== ctx.caster.id))
      if (guardian) {
        h.addTimedModifier(ctx, guardian, 'lea', h.varNumber(ctx.skill, 'stat_inc', 48), 2)
        ctx.caster.statuses['援護'] = Math.max(ctx.caster.statuses['援護'] ?? 0, 2)
        ctx.caster.specialState.mikawaGuardianRole = guardian.role === 'vice1' ? 1 : guardian.role === 'vice2' ? 2 : 0
      }
      return true
    }

    case '同討': {
      // 戦法タイプ: 能動。1ターン準備後、敵軍2名へ155%の兵刃ダメージ。
      h.aliveRandom(ctx.enemies, ctx.rng, ctx).slice(0, 2)
        .forEach((enemy) => h.dealSkillDamage(ctx, enemy, 155, 'physical'))
      return true
    }

    case '薙ぎ払い': {
      // 戦法タイプ: 能動。敵軍単体へ125%の兵刃ダメージ。
      const target = currentTarget ?? randomLiving(ctx, h, ctx.enemies)
      if (target) h.dealSkillDamage(ctx, target, 125, 'physical')
      return true
    }

    case '不屈の精神': {
      if (ctx.trigger === 'beforeAction') {
        // 戦法タイプ: 能動。2ターンの反撃を付与し、受撃回数を初期化する。
        ctx.caster.specialState.indomitableCounterUntil = expiresAfterTurns(ctx.turn, 2)
        ctx.caster.specialState.indomitableNormalHits = 0
        ctx.caster.specialState.indomitableValorReady = 1
        return true
      }
      const attacker = ctx.target
      if (!attacker || (ctx.caster.specialState.indomitableCounterUntil ?? 0) < ctx.turn) return true
      h.dealSkillDamage(ctx, attacker, 148, 'physical')
      const hits = (ctx.caster.specialState.indomitableNormalHits ?? 0) + 1
      ctx.caster.specialState.indomitableNormalHits = hits
      if (hits >= 2 && (ctx.caster.specialState.indomitableValorReady ?? 0) > 0) {
        ctx.caster.specialState.indomitableValorReady = 0
        ctx.caster.buffs.val = (ctx.caster.buffs.val ?? 0) + 36
        log(ctx.logs, ctx, '不屈の精神: 武勇+36')
      }
      return true
    }

    case '不退転': {
      // 戦法タイプ: 突撃。通常攻撃対象へ140%の兵刃ダメージ。
      if (currentTarget) h.dealSkillDamage(ctx, currentTarget, 140, 'physical')
      return true
    }

    case '勇猛無比': {
      // 戦法タイプ: 能動。自身へ会心25%を2ターン付与し、敵軍単体へ116%兵刃ダメージ。
      h.addTimedModifier(ctx, ctx.caster, 'physicalCriticalChance', toPercent(h.varNumber(ctx.skill, 'crit_rate_1', 0.25)), 2)
      const first = currentTarget ?? randomLiving(ctx, h, ctx.enemies)
      if (first) h.dealSkillDamage(ctx, first, toPercent(h.varNumber(ctx.skill, 'damage_1', 1.16)), 'physical')
      // 速度依存の65%で会心+15%（最大2層）と、別対象への98%追加攻撃。
      const extraChance = attributeDependentChance(
        toChance(h.varNumber(ctx.skill, 'extra_trigger_chance', 0.65)),
        [h.statOf(ctx.caster, 'spd')],
      )
      if (h.roll(ctx.rng, extraChance)) {
        h.addTimedModifier(ctx, ctx.caster, 'physicalCriticalChance', toPercent(h.varNumber(ctx.skill, 'crit_rate_2', 0.15)), 2, 2)
        const extra = h.aliveRandom(ctx.enemies, ctx.rng, ctx).find((enemy) => enemy.id !== first?.id) ?? first
        if (extra) h.dealSkillDamage(ctx, extra, toPercent(h.varNumber(ctx.skill, 'damage_2', 0.98)), 'physical')
      }
      return true
    }

    case '連戦': {
      // 戦法タイプ: 突撃。通常攻撃対象へ120%の兵刃ダメージ。
      if (currentTarget) h.dealSkillDamage(ctx, currentTarget, 120, 'physical')
      return true
    }

    case '伊賀忍者': {
      // 戦法タイプ: 兵種
      if (ctx.trigger === 'preparationTurn') {
        // 戦闘開始時、自軍全体の武勇と速度を10上昇させる。
        ctx.allies.forEach((ally) => {
          setPermanentBuffContribution(ally, 'val', 'igaNinjaValor', 10)
          setPermanentBuffContribution(ally, 'spd', 'igaNinjaSpeed', 10)
          // 敵軍1名ごとに密報を2個用意し、攻撃対象別に残数を管理する。
          ctx.enemies.forEach((enemy) => {
            ally.specialState[`igaIntel:${roleCode(enemy)}`] = 2
          })
        })
        log(ctx.logs, ctx, '伊賀忍者: 自軍全体の武勇・速度+10、敵軍ごとに密報を2個獲得')
        return true
      }

      // 通常攻撃後以外は密報を消費しない。
      if (ctx.trigger !== 'afterNormalAttack') return true
      const attacked = ctx.target
      if (!attacked || attacked.hp <= 0) return true
      const intelKey = `igaIntel:${roleCode(attacked)}`
      const intel = ctx.caster.specialState[intelKey] ?? 0
      if (intel <= 0) return true

      // 基本35%。藤林正保が装備している部隊では、行動武将の速度に応じて確率が上昇する。
      const fujibayashiEquipped = ctx.allies.some((ally) =>
        ally.name === '藤林正保' && fighterHasSkill(ally, ['伊賀忍者']),
      )
      const chance = fujibayashiEquipped
        ? attributeDependentChance(0.35, [h.statOf(ctx.caster, 'spd')])
        : 0.35
      if (!h.roll(ctx.rng, chance)) return true

      // 密報を1個消費し、通常攻撃対象へ102%の兵刃ダメージを与える。
      ctx.caster.specialState[intelKey] = intel - 1
      log(ctx.logs, ctx, `伊賀忍者: ${attacked.name}への密報を1個消費(残り${intel - 1})`, attacked)
      h.dealSkillDamage(ctx, attacked, 102, 'physical')
      // 同じ敵への密報を使い切った時、その敵へ疲弊を1ターン付与する。
      if (intel - 1 === 0 && attacked.hp > 0) h.addControl(ctx, attacked, '疲弊', 1)
      return true
    }

    case '越後先手組': {
      // 戦法タイプ: 兵種
      if (ctx.trigger === 'preparationTurn') {
        // 戦闘開始時、自軍全体の速度を24上昇させる。
        ctx.allies.forEach((ally) => setPermanentBuffContribution(ally, 'spd', 'echigoVanguardSpeed', 24))
        log(ctx.logs, ctx, '越後先手組: 自軍全体の速度+24')
        return true
      }

      if (ctx.trigger === 'beforeAction') {
        // 第2ターン以降、各武将の行動前に武勇・速度依存の35%で自軍単体を78%回復する。
        if (ctx.turn < 2) return true
        const chance = attributeDependentChance(0.35, [h.statOf(ctx.caster, 'val'), h.statOf(ctx.caster, 'spd')])
        if (!h.roll(ctx.rng, chance)) return true
        const target = h.aliveRandom(ctx.allies, ctx.rng, ctx)[0]
        if (target) h.healBySkill(ctx, target, 78, 'bravery')
        return true
      }

      // 上杉謙信が装備している場合、武勇最高の味方が通常攻撃で撃破すると追加回復する。
      const attacker = ctx.eventSubject ?? ctx.caster
      const defeated = ctx.target
      const kenshinEquipped = ctx.allies.some((ally) =>
        ally.name === '上杉謙信' && fighterHasSkill(ally, ['越後先手組']),
      )
      const highestValor = highestByStat(ctx.allies, 'val')
      if (
        ctx.trigger === 'afterNormalAttack'
        && kenshinEquipped
        && defeated
        && defeated.hp <= 0
        && highestValor?.id === attacker.id
      ) {
        const target = h.weakest(ctx.allies, 1)[0]
        if (target) h.healBySkill({ ...ctx, caster: attacker }, target, 78, 'bravery')
      }
      return true
    }

    case '甲斐弓騎兵': {
      // 戦法タイプ: 兵種。戦闘中の行軍速度は戦闘シミュレーションの対象外。
      if (ctx.trigger !== 'preparationTurn') return true
      const ichijoEquipped = ctx.caster.name === '一条信龍'
      ctx.allies.forEach((ally) => {
        // 配置順が最初の能動戦法だけを対象にする。
        const firstActive = ally.skills.find((skill) => battleSkillType(skill) === '能動')
        if (!firstActive) return
        const prepared = Number(firstActive.battle?.prepTurns ?? 0) > 0 || /準備/.test(textOfSkill(firstActive))
        const baseBonus = prepared ? 12 : 8
        // 一条信龍が装備している場合のみ、上昇値を一条信龍の速度依存にする。
        const bonus = ichijoEquipped
          ? attributeDependentValue(baseBonus, [h.statOf(ctx.caster, 'spd')])
          : baseBonus
        const firstActiveName = firstActive.name_jp || firstActive.name
        const beforeRate = h.activationRateOf(ally, firstActive)
        ally.specialState[`activationRateBonus:${firstActiveName}`] = Number(bonus.toFixed(4))
        const afterRate = h.activationRateOf(ally, firstActive)
        const effectiveIncrease = Math.max(0, (afterRate - beforeRate) * 100)
        log(
          ctx.logs,
          { ...ctx, caster: ally },
          `甲斐弓騎兵: ${ally.name}の「${firstActiveName}」発動率 ${(beforeRate * 100).toFixed(2)}% → ${(afterRate * 100).toFixed(2)}%（+${effectiveIncrease.toFixed(2)}%）`,
        )
      })
      return true
    }

    case '薩摩鉄砲兵': {
      // 戦法タイプ: 兵種
      if (ctx.trigger !== 'preparationTurn') return true
      // 島津貴久本人が装備していれば60%、それ以外は40%を通常攻撃の基本倍率へ加算する。
      const bonusRate = ctx.caster.name === '島津貴久' ? 60 : 40
      ctx.allies.forEach((ally) => {
        // 戦闘本体はこの値を見て、通常攻撃を計略攻撃へ変換し、攻撃後1ターン休止させる。
        ally.specialState.satsumaStrategyNormalRate = 100 + bonusRate
        ally.specialState.satsumaStrategyNormalNextTurn = 1
      })
      log(ctx.logs, ctx, `薩摩鉄砲兵: 自軍全体の通常攻撃を${100 + bonusRate}%の計略攻撃へ変換`)
      return true
    }

    case '三河弓兵隊': {
      // 戦法タイプ: 兵種
      if (ctx.trigger === 'preparationTurn') {
        // 戦闘開始時、自軍全体の統率を20上昇させる。
        ctx.allies.forEach((ally) => {
          setPermanentBuffContribution(ally, 'lea', 'mikawaArcherLeadership', 20)
          ally.specialState.mikawaArcherRebirthUntil = 3
        })
        log(ctx.logs, ctx, '三河弓兵隊: 自軍全体の統率+20、3ターン目まで回生を付与')
        return true
      }

      // 兵刃・計略ダメージを実際に受けた武将を回生の対象にする。
      const damaged = ctx.eventSubject ?? ctx.caster
      if ((damaged.specialState.mikawaArcherRebirthUntil ?? 0) < ctx.turn) return true
      // 基本35%。酒井忠次が装備している場合、装備者の統率に応じて確率が上昇する。
      const chance = ctx.caster.name === '酒井忠次'
        ? attributeDependentChance(0.35, [h.statOf(ctx.caster, 'lea')])
        : 0.35
      if (!h.roll(ctx.rng, chance)) return true
      h.healBySkill({ ...ctx, caster: damaged }, damaged, 65, 'leadership')
      return true
    }

    case '赤備え隊': {
      // 戦法タイプ: 兵種
      if (ctx.trigger !== 'preparationTurn') return true
      // 戦闘開始時、自軍全体へ会心35%を付与する。
      ctx.allies.forEach((ally) => {
        setPermanentBuffContribution(ally, 'physicalCriticalChance', 'redArmorCriticalChance', 35)
      })
      // 飯富虎昌の装備条件と会心回数は戦闘本体の各ダメージ確定時に判定する。
      ctx.caster.specialState.redArmorCriticalHits = 0
      log(ctx.logs, ctx, '赤備え隊: 自軍全体の会心+35%')
      return true
    }

    case '僧兵': {
      // 戦法タイプ: 兵種
      if (ctx.trigger === 'preparationTurn') {
        const miyabeEquipped = ctx.caster.name === '宮部継潤'
        ctx.allies.forEach((ally) => {
          // 自軍全体の兵刃被ダメージを20%（各武将の統率依存）低下させる。
          const reduction = attributeDependentValue(20, [h.statOf(ally, 'lea')])
          setPermanentBuffContribution(ally, 'physicalDamageTaken', 'monkPhysicalReduction', -reduction)
          // 宮部継潤が装備している部隊では、火傷以外の継続状態を無効化する。
          ally.specialState.monkNonBurnDotImmune = miyabeEquipped ? 1 : 0
        })
        log(ctx.logs, ctx, `僧兵: 自軍全体の兵刃被ダメージを低下${miyabeEquipped ? '、火傷以外の継続状態を無効化' : ''}`)
        return true
      }

      // 各武将の行動前、弱体化効果中なら追加の兵力損失を発生させる。
      const hasDebuff = DEBUFF_NAMES.some((name) => (ctx.caster.statuses[name] ?? 0) > 0)
        || ctx.caster.timedStatuses.length > 0
        || ctx.caster.timedModifiers.some((modifier) => modifier.value < 0)
      if (!hasDebuff) return true
      // 火傷中は240%、それ以外の弱体化効果中は60%の兵刃ダメージとして処理する。
      const burning = (ctx.caster.statuses['火傷'] ?? 0) > 0
        || ctx.caster.timedStatuses.some((status) => status.name === '火傷')
      h.dealSkillDamage(ctx, ctx.caster, burning ? 240 : 60, 'physical')
      return true
    }

    case '大太刀力士隊': {
      // 戦法タイプ: 兵種
      if (ctx.trigger === 'preparationTurn') {
        ctx.allies.forEach((ally) => {
          // 2ターン目まで、通常攻撃・突撃戦法の被ダメージを18%（武勇依存）低下させる。
          ally.specialState.odachiReductionPercent = attributeDependentValue(18, [h.statOf(ally, 'val')])
          ally.specialState.odachiReductionUntil = 2
        })
        log(ctx.logs, ctx, '大太刀力士隊: 2ターン目まで通常攻撃・突撃戦法の被ダメージを低下')
        return true
      }

      // 通常攻撃を受けた武将が30%で攻撃者へ100%の兵刃反撃を行う。
      const defender = ctx.eventSubject ?? ctx.caster
      const attacker = ctx.target
      if (!attacker || attacker.hp <= 0 || !h.roll(ctx.rng, 0.30)) return true
      h.dealSkillDamage({ ...ctx, caster: defender }, attacker, 100, 'physical')

      // 真柄直隆本人が装備して反撃した時だけ、25%で120%の追加兵刃ダメージを与える。
      if (
        defender.name === '真柄直隆'
        && fighterHasSkill(defender, ['大太刀力士隊'])
        && attacker.hp > 0
        && h.roll(ctx.rng, 0.25)
      ) h.dealSkillDamage({ ...ctx, caster: defender }, attacker, 120, 'physical')
      return true
    }

    case '鉄砲僧兵': {
      // 戦法タイプ: 兵種
      if (ctx.trigger === 'preparationTurn') {
        const tsudaEquipped = ctx.caster.name === '津田算長'
        ctx.allies.forEach((ally) => {
          // 自軍全体の統率・知略を12上昇。津田算長装備時は装備者の統率依存で上昇量を伸ばす。
          const increase = tsudaEquipped
            ? attributeDependentValue(12, [h.statOf(ctx.caster, 'lea')])
            : 12
          setPermanentBuffContribution(ally, 'lea', 'gunMonkLeadership', increase)
          setPermanentBuffContribution(ally, 'int', 'gunMonkIntelligence', increase)
          ally.specialState.gunMonkRestEnabled = 1
        })
        log(ctx.logs, ctx, '鉄砲僧兵: 自軍全体の統率・知略を上昇')
        return true
      }

      // 1・2・5・6ターン目の行動前に、各武将が48%（統率依存）の休養回復を行う。
      if ((ctx.caster.specialState.gunMonkRestEnabled ?? 0) > 0 && [1, 2, 5, 6].includes(ctx.turn)) {
        h.healBySkill(ctx, ctx.caster, 48, 'leadership')
      }
      return true
    }

    case '母衣武者': {
      // 戦法タイプ: 兵種
      if (ctx.trigger === 'preparationTurn') {
        // 戦闘開始時、自軍全体の速度を20上昇させる。
        ctx.allies.forEach((ally) => setPermanentBuffContribution(ally, 'spd', 'horoSpeed', 20))
        log(ctx.logs, ctx, '母衣武者: 自軍全体の速度+20')
        return true
      }

      // 通常攻撃後、攻撃対象の被ダメージを速度依存で上昇させる（最大5回）。
      const attacked = ctx.target
      if (!attacked || attacked.hp <= 0) return true
      const maedaEquipped = ctx.allies.some((ally) =>
        ally.name === '前田利家' && fighterHasSkill(ally, ['母衣武者']),
      )
      const baseIncrease = maedaEquipped ? 3.5 : 3
      const increase = attributeDependentValue(baseIncrease, [h.statOf(ctx.caster, 'spd')])
      h.addTimedModifier(ctx, attacked, 'damageTaken', increase, 99, 5)
      const totalIncrease = attacked.timedModifiers
        .filter((modifier) => modifier.key === '母衣武者:damageTaken')
        .reduce((sum, modifier) => sum + modifier.value, 0)
      log(ctx.logs, ctx, `母衣武者: ${attacked.name}の被ダメージ+${totalIncrease.toFixed(2)}%`, attacked)
      return true
    }














    // DB戦法: ここから下は .build/skills.json から戦法名ごとに展開した個別case。
    // 精度を上げたい戦法は、該当case内を回天転運のような手書き処理に置き換える。
    case '縦横馳突': {
      // 戦法タイプ: 能動
      // 発動したターンは通常攻撃を2回行えるようにする。
      ctx.caster.specialState.doubleAttackUntil = Math.max(
        ctx.caster.specialState.doubleAttackUntil ?? 0,
        ctx.turn,
      )
      // 発動したターンは、既に受けている封撃と新たに受ける封撃の両方を無効化する。
      ctx.caster.specialState['controlImmunityUntil:封撃'] = Math.max(
        ctx.caster.specialState['controlImmunityUntil:封撃'] ?? 0,
        ctx.turn,
      )
      log(ctx.logs, ctx, `${ctx.caster.name}は連撃と封撃耐性を獲得(1T)`)
      return true
    }
    case '知者楽水': {
      // 戦法タイプ: 指揮
      // 自軍内で知略が武勇より高い武将の人数を数える。
      const strategyFocusedCount = ctx.allies.filter((ally) => h.statOf(ally, 'int') > h.statOf(ally, 'val')).length
      // 過半数が知略型なら兵刃軽減を24%、それ以外なら計略軽減を24%にする。
      const physicalReduction = strategyFocusedCount >= 2 ? 24 : 18
      const strategyReduction = strategyFocusedCount >= 2 ? 18 : 24
      // 自軍から重複なしで2名を選び、3ターン限定の補正を付与する。
      const targets = h.aliveRandom(ctx.allies, ctx.rng, ctx).slice(0, 2)
      targets.forEach((target) => {
        // 兵刃・計略被ダメージをそれぞれ軽減する。
        h.addTimedModifier(ctx, target, 'physicalDamageTaken', -physicalReduction, 3, 1)
        h.addTimedModifier(ctx, target, 'strategyDamageTaken', -strategyReduction, 3, 1)
        // 強力な軽減と引き換えに、対象の与ダメージを5%低下させる。
        h.addTimedModifier(ctx, target, 'damageDealt', -5, 3, 1)
        log(
          ctx.logs,
          ctx,
          `知者楽水: ${target.name}の兵刃被ダメージを${physicalReduction}%軽減、計略被ダメージを${strategyReduction}%軽減、与ダメージを5%低下(3T)`,
          target,
        )
      })

      if (hasCommanderSkill(ctx.caster)) {
        // 大将時は自軍全体へ、第1ターンの最終被ダメージ30%分担を予約する。
        ctx.allies.forEach((ally) => {
          ally.specialState[WISE_WATER_SHARE_UNTIL_KEY] = 1
        })
        log(ctx.logs, ctx, '知者楽水: 第1ターンの被ダメージ30%を自軍全体で分担')
      }
      return true
    }
    case '新生': {
      // 戦法タイプ: 指揮
      if (ctx.trigger === 'preparationTurn') {
        // 戦闘開始時、発動者以外の友軍2名へ統率依存の与ダメージ上昇を付与する。
        const damageBonus = attributeDependentValue(14, [h.statOf(ctx.caster, 'lea')])
        ctx.allies
          .filter((ally) => ally.id !== ctx.caster.id && ally.hp > 0)
          .slice(0, 2)
          .forEach((ally) => {
            setPermanentBuffContribution(ally, 'damageDealt', `newLifeDamage:${ctx.caster.id}`, damageBonus)
            log(ctx.logs, ctx, `新生: ${ally.name}の与ダメージが${damageBonus.toFixed(2)}%上昇（${(100 + (ally.buffs.damageDealt ?? 0)).toFixed(2)}%）`, ally)
          })
        // 大将技の閾値判定は、まだ一度も成立していない状態から始める。
        ctx.caster.specialState.newLifeThresholdReached = 0
        return true
      }

      if (ctx.trigger === 'turnEnd') {
        // 大将時のみ、各ターン終了時に敵軍総兵力が初めて70%以下になったかを確認する。
        if (!hasCommanderSkill(ctx.caster) || (ctx.caster.specialState.newLifeThresholdReached ?? 0) > 0) return true
        const enemyHp = ctx.enemies.reduce((sum, enemy) => sum + Math.max(0, enemy.hp), 0)
        const enemyMaxHp = ctx.enemies.reduce((sum, enemy) => sum + Math.max(1, enemy.maxHp), 0)
        if (enemyHp / Math.max(1, enemyMaxHp) <= 0.7) {
          ctx.caster.specialState.newLifeThresholdReached = 1
          log(ctx.logs, ctx, '新生: 敵軍総兵力が70%以下になり、以降の行動時回復を獲得')
        }
        return true
      }

      if (ctx.trigger === 'beforeAction' && hasCommanderSkill(ctx.caster) && (ctx.caster.specialState.newLifeThresholdReached ?? 0) > 0) {
        // 条件成立後は、大将自身が行動するたびに知略依存で回復する。
        h.healBySkill(ctx, ctx.caster, 65, 'strategy')
      }
      return true
    }
    case '紅蓮の炎': {
      // 戦法タイプ: 能動
      // 1ターンの準備完了後、生存中の敵軍全体を対象にする。
      living(ctx.enemies).forEach((target) => {
        // 敵軍全体へ104%・知略依存の計略ダメージを与える。
        h.dealSkillDamage(ctx, target, 104, 'strategy')
        // 同じ対象へ74%・知略依存の火傷を2ターン付与する。
        if (target.hp > 0) applyExplicitContinuousDamage(ctx, h, target, '火傷', 2, 74, 'strategy')
      })
      return true
    }
    case '盤石耽々': {
      // 戦法タイプ: 受動
      // 戦闘開始時は統率依存で被ダメージを9%低下させる。
      const initialReduction = attributeDependentValue(9, [h.statOf(ctx.caster, 'lea')])
      // 1～8ターン目は、ターン経過ごとに低下量を4%ずつ増やす。
      const perTurnReduction = attributeDependentValue(4, [h.statOf(ctx.caster, 'lea')])
      const turnReduction = ctx.trigger === 'turnStart' ? Math.max(0, ctx.turn) * perTurnReduction : 0
      const totalReduction = initialReduction + turnReduction
      // 再実行時は前回分との差し替えにし、同じターンで二重加算しない。
      setPermanentBuffContribution(ctx.caster, 'damageTaken', 'rockSteadyDamageReduction', -totalReduction)
      log(ctx.logs, ctx, `盤石耽々: ${ctx.caster.name}の被ダメージが${totalReduction.toFixed(2)}%低下（${(100 + (ctx.caster.buffs.damageTaken ?? 0)).toFixed(2)}%）`)
      return true
    }
    case '運勝の鼻': {
      // 戦法タイプ: 受動
      // 準備省略の抽選は、対象となる固有能動戦法が実際に発動した時に
      // battleSimulator.ts の準備処理から行う。ここでは監視戦法の登録だけを行う。
      return true
    }
    case '水攻干計': {
      // 戦法タイプ: 能動
      // 1ターンの準備後、敵軍全体へ2ターンの水攻めと回復不可を付与する。
      living(ctx.enemies).forEach((target) => {
        // 回復不可中は、戦法が発動しても実際の回復量が0になる。
        h.addControl(ctx, target, '回復不可', 2)

        // 水攻めは対象の行動開始時に、知略依存の98%計略ダメージを与える。
        // 同じ発動者・戦法による水攻めが残っている場合は重ねず、持続時間だけ2ターンへ更新する。
        const existing = target.timedStatuses.find((status) =>
          status.name === '水攻め'
          && status.sourceSkill === h.skillDisplayName(ctx.skill)
          && status.sourceActorId === ctx.caster.id)
        const waterTurns = h.extendDotDuration(ctx, 2)
        if (existing) {
          existing.turns = waterTurns
          existing.dotRate = 98
          existing.dotType = 'strategy'
        } else {
          target.timedStatuses.push({
            name: '水攻め',
            turns: waterTurns,
            sourceSkill: h.skillDisplayName(ctx.skill),
            sourceActorId: ctx.caster.id,
            sourceActor: ctx.caster.name,
            dotRate: 98,
            dotType: 'strategy',
          })
        }
        log(ctx.logs, ctx, `${target.name}に水攻め(2T)`, target)
      })
      return true
    }
    case '時は今': {
      // 戦法タイプ: 能動
      // ランダムな対象2名を選ぶ。混乱中は既存ルールに従い敵味方を区別しない。
      h.aliveRandom(ctx.enemies, ctx.rng, ctx).slice(0, 2).forEach((target) => {
        // まだ所持していない継続状態を優先し、5種類すべて所持済みなら全種類から選び直す。
        const missing = TIME_IS_NOW_DOT_NAMES.filter((name) =>
          !target.timedStatuses.some((status) => status.name === name),
        )
        let pool = missing.length > 0 ? [...missing] : [...TIME_IS_NOW_DOT_NAMES]
        // 宮部継潤の僧兵は火傷以外の継続状態を受けないため、付与可能な候補だけに絞る。
        if ((target.specialState.monkNonBurnDotImmune ?? 0) > 0) pool = pool.filter((name) => name === '火傷')
        const statusName = pool[Math.floor(ctx.rng() * pool.length)]
        if (!statusName) return

        const dotType: 'physical' | 'strategy' = statusName === '潰走' ? 'physical' : 'strategy'
        const sourceSkill = h.skillDisplayName(ctx.skill)
        // 同じ発動者の同名状態は重ねず3ターンへ更新し、別の発動者による状態とは区別する。
        const existing = target.timedStatuses.find((status) =>
          status.name === statusName
          && status.sourceSkill === sourceSkill
          && status.sourceActorId === ctx.caster.id)
        const dotTurns = h.extendDotDuration(ctx, 3)
        if (existing) {
          existing.turns = dotTurns
          existing.dotRate = 56
          existing.dotType = dotType
        } else {
          target.timedStatuses.push({
            name: statusName,
            turns: dotTurns,
            sourceSkill,
            sourceActorId: ctx.caster.id,
            sourceActor: ctx.caster.name,
            dotRate: 56,
            dotType,
          })
        }
        // 大将時は、対象に5種類が揃っている間の浄化禁止判定を有効にする。
        if (hasCommanderSkill(ctx.caster)) target.specialState.timeIsNowDotCleanseLock = 1
        log(ctx.logs, ctx, `時は今: ${target.name}に${statusName}(3T・ダメージ率56%)`, target)
      })
      return true
    }
    case '軍神': {
      // 戦法タイプ: 受動
      if (ctx.trigger === 'preparationTurn') {
        // 戦闘開始時に溜めを初期化し、以降は乱舞を獲得できない状態にする。
        ctx.caster.specialState.militaryGodCharges = 0
        ctx.caster.specialState.militaryGodNormalAttackBonus = 0
        ctx.caster.specialState.ranbuDisabled = 1
        delete ctx.caster.specialState.splashAttackUntil
        log(ctx.logs, ctx, '軍神: 乱舞獲得不可')
        return true
      }

      if (ctx.trigger === 'beforeAction') {
        // 大将の時は、毎ターン自身の行動前に確率判定なしで溜めを1つ獲得する。
        if (hasCommanderSkill(ctx.caster)) gainMilitaryGodCharge(ctx, h, '大将効果')
        return true
      }

      if (ctx.trigger === 'allyNormalAttack' || ctx.trigger === 'allySkillActivated') {
        const source = ctx.eventSubject
        // 軍神の所持者本人は対象外。自軍にいる残り2名の行動だけを監視する。
        if (!source || source.side !== ctx.caster.side || source.id === ctx.caster.id) return true

        // 友軍の通常攻撃・能動戦法・突撃戦法の発動時、66%（武勇依存）で溜めを獲得する。
        const chance = attributeDependentChance(0.66, [h.statOf(ctx.caster, 'val')])
        if (h.roll(ctx.rng, chance)) {
          const reason = ctx.trigger === 'allyNormalAttack'
            ? `${source.name}の通常攻撃`
            : `${source.name}の能動・突撃戦法発動`
          gainMilitaryGodCharge(ctx, h, reason)
        }
        return true
      }

      if (ctx.trigger === 'afterNormalAttack') {
        // 溜めが最大の12回に達した後、自身の通常攻撃が完了した時だけ全消費する。
        const stacks = ctx.caster.specialState.militaryGodCharges ?? 0
        const bonus = ctx.caster.specialState.militaryGodNormalAttackBonus ?? 0
        if (stacks < 12) return true

        log(ctx.logs, ctx, `軍神: 最大まで溜めた通常攻撃後、${ctx.caster.name}の通常攻撃与ダメージが${bonus.toFixed(2)}%低下（100.00%）`)
        ctx.caster.specialState.militaryGodCharges = 0
        ctx.caster.specialState.militaryGodNormalAttackBonus = 0
        return true
      }

      return true
    }
    case '毘沙門天': {
      // 戦法タイプ: 受動
      // 自身の行動終了時、40%を基礎として武勇依存で発動判定する。
      const chance = attributeDependentChance(0.4, [h.statOf(ctx.caster, 'val')])
      if (!h.roll(ctx.rng, chance)) return true
      // 自軍から2～3名を選び、54%・武勇依存で回復する。
      const count = 2 + Math.floor(ctx.rng() * 2)
      explicitAllyTargets(ctx, h, count).forEach((target) => {
        h.healBySkill(ctx, target, 54, 'bravery')
      })
      // 敵軍から2～3名を選び、双方の武勇差を反映した与ダメージ低下を1ターン付与する。
      explicitEnemyTargets(ctx, h, count).forEach((target) => {
        const valorGap = Math.max(0, h.statOf(ctx.caster, 'val') - h.statOf(target, 'val'))
        const reduction = Math.min(18, 9 + valorGap * 0.02)
        h.addTimedModifier(ctx, target, 'damageDealt', -reduction, 1, 1)
      })
      return true
    }
    case '独立独歩': {
      // 戦法タイプ: 受動
      // 戦闘中、自身の突撃戦法だけの発動率を17%上昇させる。
      ctx.caster.specialState.assaultSkillActivationRateBonus = 17
      log(ctx.logs, ctx, `${ctx.caster.name}の突撃戦法発動率が17.00%上昇`)
      return true
    }
    case '一領具足': {
      // 戦法タイプ: 指揮
      if (ctx.trigger === 'preparationTurn') {
        // 最初の2ターン、自軍全体の兵力損害を武勇依存で最大12%低下させる。
        const reduction = attributeDependentValue(12, [h.statOf(ctx.caster, 'val')])
        living(ctx.allies).forEach((ally) => h.addTimedModifier(ctx, ally, 'damageTaken', -reduction, 2, 1))
        return true
      }
      // 3～4ターン目の自身の行動前に、自軍全体へ統率依存96%の傭兵を3ターン付与する。
      if (ctx.turn === 3 || ctx.turn === 4) {
        const mercenaries = Math.max(1, Math.round(h.statOf(ctx.caster, 'lea') * 2.64 * 0.96))
        living(ctx.allies).forEach((ally) => {
          ally.hp += mercenaries
          ally.maxHp += mercenaries
          ally.specialState.mercenaryTroops = (ally.specialState.mercenaryTroops ?? 0) + mercenaries
          ally.specialState.mercenaryTroopsUntil = Math.max(
            ally.specialState.mercenaryTroopsUntil ?? 0,
            expiresAfterTurns(ctx.turn, 3),
          )
          log(ctx.logs, ctx, `一領具足: ${ally.name}が傭兵${mercenaries.toLocaleString()}を獲得(3T)`, ally)
        })
      }
      return true
    }
    case '電光雷轟': {
      // 戦法タイプ: 突撃
      // 通常攻撃で実際に狙った対象だけを基準にし、撃破済みなら別対象へすり替えない。
      const normalAttackTarget = ctx.target && ctx.target.hp > 0 ? ctx.target : null
      if (!normalAttackTarget) return true
      const targetAlreadyParalyzed = (normalAttackTarget.statuses['麻痺'] ?? 0) > 0

      if (targetAlreadyParalyzed) {
        // 通常攻撃対象がすでに麻痺中なら、雷鳴として敵軍全体へ兵刃ダメージを与える。
        const thunderRate = hasCommanderSkill(ctx.caster) ? 60 : 52
        ctx.enemies.filter((enemy) => enemy.hp > 0).forEach((enemy) => {
          h.dealSkillDamage(ctx, enemy, thunderRate, 'physical')
        })
        // 雷鳴後、まだ麻痺していないランダムな武将1名へ麻痺を付与する。
        const extraTarget = h.aliveRandom(ctx.enemies, ctx.rng, ctx)
          .find((enemy) => (enemy.statuses['麻痺'] ?? 0) <= 0)
        if (extraTarget) h.addControl(ctx, extraTarget, '麻痺', 2)
        return true
      }

      // 対象が麻痺していなければ、通常攻撃対象へ麻痺を付与する。
      h.addControl(ctx, normalAttackTarget, '麻痺', 2)
      // さらに通常攻撃対象とは別のランダムな武将1名へ麻痺を付与する。
      const extraTarget = h.aliveRandom(ctx.enemies, ctx.rng, ctx)
        .find((enemy) => enemy.id !== normalAttackTarget.id && (enemy.statuses['麻痺'] ?? 0) <= 0)
      if (extraTarget) h.addControl(ctx, extraTarget, '麻痺', 2)
      return true
    }
    case '霹靂一撃': {
      // 戦法タイプ: 能動
      // 既に指定された敵が生存していればその敵を使い、いなければ敵軍から単体を選ぶ。
      const target = ctx.target && ctx.target.hp > 0 && ctx.target.side !== ctx.caster.side
        ? ctx.target
        : h.chooseTarget(ctx.enemies, ctx.rng, ctx)
      // 生存している敵軍単体がいない場合は、何もせず個別処理済みとして終了する。
      if (!target) return true

      // ダメージや麻痺の付与前に、対象がすでに麻痺中だったかを記録する。
      const wasAlreadyParalyzed = (target.statuses['麻痺'] ?? 0) > 0
      // 対象へダメージ率228%の兵刃ダメージを与える。
      h.dealSkillDamage(ctx, target, 228, 'physical')

      // ダメージ後も対象が生存している場合、麻痺を2ターン付与する。
      if (target.hp > 0) h.addControl(ctx, target, '麻痺', 2)

      // 発動前から対象が麻痺中だった場合、自身へ会心50%を2ターン付与する。
      if (wasAlreadyParalyzed) {
        h.addTimedModifier(ctx, ctx.caster, 'physicalCriticalChance', 50, 2)
      }

      // 霹靂一撃はここで個別処理済みなので、後段の汎用推定処理へ進ませない。
      return true
    }
    case '一行三昧': {
      // 戦法タイプ: 受動
      // 戦闘中、自身の能動戦法の発動確率が7%→14%増加
      // 準備ターンに、最大レベル時の14%を戦闘終了まで加算する。
      addActiveSkillActivationRateBonus(ctx, 14)
      return true
    }
    case '地黄八幡': {
      // 戦法タイプ: 能動
      // 準備完了後、敵軍全体へ兵刃ダメージを与える。
      ctx.enemies.filter((target) => target.hp > 0).forEach((target) => {
        h.dealSkillDamage(ctx, target, 174, 'physical')
        // 制御は対象ごとに1回判定し、成功時は封撃と無策を同時に1ターン付与する。
        const baseChance = hasCommanderSkill(ctx.caster) ? 0.44 : 0.36
        const controlChance = attributeDependentChance(baseChance, [h.statOf(ctx.caster, 'val')])
        if (target.hp > 0 && h.roll(ctx.rng, controlChance)) {
          h.addControl(ctx, target, '封撃', 1)
          h.addControl(ctx, target, '無策', 1)
        }
      })
      return true
    }
    case '千軍辟易': {
      // 戦法タイプ: 能動
      // 生存中の敵軍全体をこの戦法の対象として一度だけ確定する。
      living(ctx.enemies).forEach((target) => {
        // ダメージ前から封撃または無策なら、威圧の追加判定対象になる
        const canApplyPressure = (target.statuses['封撃'] ?? 0) > 0 || (target.statuses['無策'] ?? 0) > 0
        // 対象にダメージ率106%の兵刃ダメージを与える
        h.dealSkillDamage(ctx, target, 106, 'physical')
        // 条件を満たす生存対象には35%の確率で威圧を1ターン付与する
        if (canApplyPressure && target.hp > 0 && h.roll(ctx.rng, 0.35)) {
          h.addControl(ctx, target, '威圧', 1)
        }
      })
      return true
    }
    case '血戦奮闘': {
      // 戦法タイプ: 受動
      // 戦闘開始時、自身が受ける回復量を60%上昇させる。
      setPermanentBuffContribution(ctx.caster, 'healingReceived', 'bloodyBattleHealingReceived', 60)
      // 戦闘開始時、自身へ会心40%を付与する。
      setPermanentBuffContribution(ctx.caster, 'physicalCriticalChance', 'bloodyBattleCriticalChance', 40)
      return true
    }
    case '理非曲直': {
      // 戦法タイプ: 突撃
      // 通常攻撃で実際に狙った生存対象を取得する。
      const target = explicitEnemyTarget(ctx, h)
      if (!target) return true
      // 同じ対象へ192%の兵刃ダメージを与える。
      h.dealSkillDamage(ctx, target, 192, 'physical')
      // 対象が生存していれば混乱を1ターン付与する。
      if (target.hp > 0) h.addControl(ctx, target, '混乱', 1)
      return true
    }
    case '静動自在': {
      // 戦法タイプ: 能動
      // 自身より速度が遅い友軍を候補にし、いなければ自身を対象にする。
      const slowerAllies = living(ctx.allies).filter((ally) =>
        ally.id !== ctx.caster.id && h.statOf(ally, 'spd') < h.statOf(ctx.caster, 'spd'))
      const target = randomLiving(ctx, h, slowerAllies) ?? ctx.caster
      // 2ターンの洞察で制御状態を無効化する。
      target.specialState.insightUntil = expiresAfterTurns(ctx.turn, 2)
      // 先攻は既存の行動順判定が参照する状態名で2ターン保持する。
      target.statuses['先攻'] = Math.max(target.statuses['先攻'] ?? 0, 2)
      log(ctx.logs, ctx, `静動自在: ${target.name}に洞察・先攻を付与(2T)`, target)
      return true
    }
    case '相模の獅子': {
      // 戦法タイプ: 能動
      // 自軍から2～3名をランダムに選ぶ。
      const targetCount = 2 + Math.floor(ctx.rng() * 2)
      h.aliveRandom(ctx.allies, ctx.rng, ctx).slice(0, targetCount).forEach((ally) => {
        if ((ally.specialState.ironWallCharges ?? 0) > 0) {
          // すでに鉄壁中なら付与を行わず、代わりに敵軍単体へ計略ダメージを与える。
          const enemy = h.chooseTarget(ctx.enemies, ctx.rng, ctx)
          if (enemy) h.dealSkillDamage(ctx, enemy, 178, 'strategy')
          return
        }

        // 2回分それぞれについて85%で鉄壁を獲得する。
        let gainedCharges = 0
        for (let attempt = 0; attempt < 2; attempt += 1) {
          if (h.roll(ctx.rng, 0.85)) {
            gainedCharges += 1
          } else if (hasCommanderSkill(ctx.caster)) {
            // 大将時は、鉄壁の獲得に失敗するたびに対象を回復する。
            h.healBySkill(ctx, ally, 40, 'strategy')
          }
        }
        if (gainedCharges <= 0) return
        ally.specialState.ironWallCharges = (ally.specialState.ironWallCharges ?? 0) + gainedCharges
        ally.specialState.sagamiIronWallCharges = (ally.specialState.sagamiIronWallCharges ?? 0) + gainedCharges
        ally.specialState.sagamiIronWallUntil = ctx.turn + 1
        log(ctx.logs, ctx, `相模の獅子: ${ally.name}に鉄壁${gainedCharges}回分を付与(2T)`, ally)
      })
      return true
    }
    case '所領役帳': {
      // 戦法タイプ: 能動
      if (ctx.trigger === 'beforeAction') {
        // 発動時、ランダムな自軍単体を212%・知略依存で回復する。
        const healTarget = explicitAllyTargets(ctx, h, 1)[0]
        if (healTarget) h.healBySkill(ctx, healTarget, 212, 'strategy')
        // 最も兵力が少ない自軍単体へ、被ダメージ時に反応する回生を2ターン付与する。
        const rebirthTarget = h.weakest(ctx.allies, 1)[0]
        if (rebirthTarget) {
          rebirthTarget.specialState.domainLedgerRebirthSource = roleCode(ctx.caster)
          rebirthTarget.specialState.domainLedgerRebirthUntil = expiresAfterTurns(ctx.turn, 2)
          log(ctx.logs, ctx, `${rebirthTarget.name}に回生を付与(2T)`, rebirthTarget)
        }
        return true
      }

      // 回生対象が兵刃・計略ダメージを受けた時だけ、50%で66%・知略依存の回復を行う。
      const damaged = ctx.eventSubject
      if (
        !damaged
        || damaged.specialState.domainLedgerRebirthSource !== roleCode(ctx.caster)
        || (damaged.specialState.domainLedgerRebirthUntil ?? 0) < ctx.turn
        || !h.roll(ctx.rng, 0.5)
      ) return true
      h.healBySkill(ctx, damaged, 66, 'strategy')
      return true
    }
    case '以戦養戦': {
      // 戦法タイプ: 受動
      // 戦闘開始時に離反25%を獲得する。
      if (ctx.trigger === 'preparationTurn') {
        ctx.caster.specialState.physicalLifeStealPercent = 25
        ctx.caster.specialState.physicalLifeStealUntil = 99
        return true
      }
      // 5ターン目に離反をさらに25%加算する。
      if (ctx.turn === 5) ctx.caster.specialState.physicalLifeStealPercent = 50
      // 兵力50%以下なら会心25%、超えていれば追加会心を解除する。
      const criticalBonus = ctx.caster.hp <= ctx.caster.maxHp * 0.5 ? 25 : 0
      setPermanentBuffContribution(ctx.caster, 'physicalCriticalChance', 'warFeedsWarLowHpCritical', criticalBonus)
      return true
    }
    case '気勢衝天': {
      // 戦法タイプ: 指揮
      // 5ターン目以降は効果を発動しない。
      if (ctx.turn < 1 || ctx.turn > 4 || !h.roll(ctx.rng, 0.8)) return true
      const physicalTarget = highestByStat(ctx.enemies, 'val')
      const strategyTarget = highestByStat(ctx.enemies, 'int')
      const reduction = attributeDependentValue(30, [h.statOf(ctx.caster, 'val')])
      // 武勇最高の敵は兵刃与ダメージ、知略最高の敵は計略与ダメージを1ターン低下させる。
      if (physicalTarget) h.addTimedModifier(ctx, physicalTarget, 'attackDamage', -reduction, 1, 1)
      if (strategyTarget) h.addTimedModifier(ctx, strategyTarget, 'strategyDamageDealt', -reduction, 1, 1)
      return true
    }
    case '啄木鳥': {
      // 戦法タイプ: 能動
      const executeWoodpecker = (target: BattleFighter | null) => {
        if (!target || target.hp <= 0) return
        // 発動者が対象へ知略依存の計略ダメージを与える。
        h.dealSkillDamage(ctx, target, 156, 'strategy')
        // 武勇が最も高い生存友軍が、同じ対象へ武勇・速度依存の兵刃ダメージを与える。
        const attacker = highestByStat(ctx.allies, 'val')
        if (attacker && target.hp > 0) {
          h.dealSkillDamage({ ...ctx, caster: attacker }, target, 160, 'physical', {
            attackStats: ['val', 'spd'],
            defenseStats: ['lea'],
            coefficient: 0.9,
          })
        }
        // 対象が生存していれば、速度依存の確率で威圧を1ターン付与する。
        const pressureChance = attributeDependentChance(0.35, [h.statOf(ctx.caster, 'spd')])
        if (target.hp > 0 && h.roll(ctx.rng, pressureChance)) h.addControl(ctx, target, '威圧', 1)
      }

      executeWoodpecker(currentTarget)
      // 大将時は10%で戦法効果一式を追加でもう1回発動する。
      if (hasCommanderSkill(ctx.caster) && h.roll(ctx.rng, 0.1)) {
        const repeatTarget = h.chooseTarget(ctx.enemies, ctx.rng, ctx)
        log(ctx.logs, ctx, '啄木鳥: 大将効果でもう1回発動')
        executeWoodpecker(repeatTarget)
      }
      return true
    }
    case '大智不智': {
      // 戦法タイプ: 能動
      // 敵軍2名へ、104%・知略依存の消沈を2ターン付与する。
      explicitEnemyTargets(ctx, h, 2).forEach((target) => {
        applyExplicitContinuousDamage(ctx, h, target, '消沈', 2, 104, 'strategy')
        // 同じ2ターン、対象が受ける兵刃ダメージを20%増加させる。
        h.addTimedModifier(ctx, target, 'physicalDamageTaken', 20, 2, 1)
      })
      return true
    }
    case '前後挟撃': {
      // 戦法タイプ: 能動
      // 自身と、自身以外の生存友軍1名へ連撃100%を1ターン付与する。
      const ally = explicitAllyTargets(ctx, h, 1, true)[0]
      ;[ctx.caster, ally].filter((target): target is BattleFighter => Boolean(target)).forEach((target) => {
        target.specialState.comboChance = 100
        target.specialState.comboChanceUntil = expiresAfterTurns(ctx.turn, 1)
      })
      return true
    }
    case '沈魚落雁': {
      // 戦法タイプ: 受動
      // 通常攻撃を行った敵武将だけを反撃対象にする。
      const attacker = ctx.target
      if (!attacker || attacker.side === ctx.caster.side || attacker.hp <= 0) return true
      // 基礎36%。女性武将の場合は魅力依存の追加分を加える。
      const isFemale = /女|女性|female/i.test(ctx.caster.gender)
      const chance = isFemale
        ? attributeDependentChance(0.36, [h.statOf(ctx.caster, 'cha')])
        : 0.36
      if (!h.roll(ctx.rng, chance)) return true
      // 混乱・無策・疲弊から1種類だけを無作為に選び、1ターン付与する。
      const controls = ['混乱', '無策', '疲弊']
      h.addControl(ctx, attacker, controls[Math.floor(ctx.rng() * controls.length)]!, 1)
      return true
    }
    case '五里霧中': {
      // 戦法タイプ: 能動
      // 準備完了後、敵軍から2名を無作為に選ぶ。
      explicitEnemyTargets(ctx, h, 2).forEach((target) => {
        // 対象へ混乱を2ターン付与する。
        h.addControl(ctx, target, '混乱', 2)
        // 発動者が女性なら、同じ対象の被ダメージを2ターン6%上昇させる。
        if (/女|女性|female/i.test(ctx.caster.gender)) h.addTimedModifier(ctx, target, 'damageTaken', 6, 2, 1)
      })
      return true
    }
    case '深慮遠謀': {
      // 戦法タイプ: 指揮
      // 戦闘開始時、敵軍2名の与ダメージを知略依存で最大28%低下させる。
      const reduction = attributeDependentValue(28, [h.statOf(ctx.caster, 'int')])
      explicitEnemyTargets(ctx, h, 2).forEach((target) => {
        h.addTimedModifier(ctx, target, 'damageDealt', -reduction, 3, 1)
      })
      return true
    }
    case '百戦錬磨': {
      // 戦法タイプ: 受動
      // 戦闘中、自身の武勇・知略・統率・速度をそれぞれ42増加させる。
      ;(['val', 'int', 'lea', 'spd'] as Stat[]).forEach((stat) => {
        setPermanentBuffContribution(ctx.caster, stat, `veteran:${stat}`, 42)
      })
      return true
    }
    case '奇謀独断': {
      // 戦法タイプ: 能動
      // 準備完了後、敵軍2名へ無策を2ターン付与する。
      explicitEnemyTargets(ctx, h, 2).forEach((target) => h.addControl(ctx, target, '無策', 2))
      return true
    }
    case '剛毅果断': {
      // 戦法タイプ: 能動
      // 3ターンの間、自身の突撃戦法与ダメージを35%上昇させる。
      ctx.caster.specialState.assaultDamageBonus = 35
      ctx.caster.specialState.assaultDamageBonusUntil = expiresAfterTurns(ctx.turn, 3)
      // 同じ3ターン、自身が受ける能動戦法ダメージだけを20%軽減する。
      h.addTimedModifier(ctx, ctx.caster, 'activeDamageTaken', -20, 3, 1)
      return true
    }
    case '罵詈雑言': {
      // 戦法タイプ: 指揮
      if (ctx.trigger === 'preparationTurn') {
        // 最初の3ターンは、自身が受ける通常攻撃・突撃戦法ダメージを50%軽減する。
        ctx.caster.specialState.verbalAbuseReductionUntil = 3
        ctx.caster.specialState.verbalAbuseReductionPercent = 50
        return true
      }

      // 大将時は挑発を付与せず、4ターン目以降も新しい挑発を付与しない。
      if (hasCommanderSkill(ctx.caster) || ctx.turn < 1 || ctx.turn > 3) return true
      // 毎ターン、ランダムな敵軍2～3名へ個別に90%で1ターンの挑発を付与する。
      const count = 2 + Math.floor(ctx.rng() * 2)
      explicitEnemyTargets(ctx, h, count).forEach((target) => {
        if (h.roll(ctx.rng, 0.9)) h.addControl(ctx, target, '挑発', 1)
      })
      return true
    }
    case '戦意消沈': {
      // 戦法タイプ: 指揮
      // 1ターン目と3ターン目だけ、それぞれ敵軍1名へ疲弊を2ターン付与する。
      if (ctx.turn !== 1 && ctx.turn !== 3) return true
      const previousRole = ctx.caster.specialState.moraleCollapseFirstTargetRole
      const candidates = living(ctx.enemies).filter((enemy) => ctx.turn === 1 || roleCode(enemy) !== previousRole)
      const target = randomLiving(ctx, h, candidates.length > 0 ? candidates : ctx.enemies)
      if (!target) return true
      h.addControl(ctx, target, '疲弊', 2)
      if (ctx.turn === 1) ctx.caster.specialState.moraleCollapseFirstTargetRole = roleCode(target)
      return true
    }
    case '帰還の凱歌': {
      // 戦法タイプ: 能動
      // 自軍から2名を選び、兵力50%以下なら172%、それ以外は132%で回復する。
      explicitAllyTargets(ctx, h, 2).forEach((target) => {
        const rate = target.hp <= target.maxHp * 0.5 ? 172 : 132
        h.healBySkill(ctx, target, rate, 'strategy')
      })
      return true
    }
    case '金鼓連天': {
      // 戦法タイプ: 能動
      // 3ターンの間、自身の能動戦法与ダメージを48%上昇させる。
      ctx.caster.specialState.activeDamageBonus = 48
      ctx.caster.specialState.activeDamageBonusUntil = expiresAfterTurns(ctx.turn, 3)
      // 同じ3ターン、自身が受ける突撃戦法ダメージを25%軽減する。
      ctx.caster.specialState.assaultDamageReductionPercent = 25
      ctx.caster.specialState.assaultDamageReductionUntil = expiresAfterTurns(ctx.turn, 3)
      return true
    }
    case '文武両道': {
      // 戦法タイプ: 受動
      // 属性上昇は全ダメージ経路共通の recordBunbuDamageHit で処理する。
      return true
    }
    case '戦意崩壊': {
      // 戦法タイプ: 突撃
      const target = explicitEnemyTarget(ctx, h)
      if (!target) return true
      // 通常攻撃対象の統率と知略を2ターン65低下させる。
      h.addTimedModifier(ctx, target, 'lea', -65, 2, 1)
      h.addTimedModifier(ctx, target, 'int', -65, 2, 1)
      // 自軍大将へ鉄壁を付与する。発動者自身が大将なら1回、その他は2回分。
      const commander = ctx.allies.find((ally) => ally.role === 'main' && ally.hp > 0)
      if (commander) commander.specialState.ironWallCharges = (commander.specialState.ironWallCharges ?? 0) + (hasCommanderSkill(ctx.caster) ? 1 : 2)
      return true
    }
    case '按甲休兵': {
      // 戦法タイプ: 受動
      // 1～8ターンのターン開始時、自身を140%で回復する。
      h.healBySkill(ctx, ctx.caster, 140, 'strategy')
      return true
    }
    case '気炎万丈': {
      // 戦法タイプ: 指揮
      // 1～3ターン目だけ処理し、発動率は70%から毎ターン14%ずつ低下する。
      if (ctx.turn < 1 || ctx.turn > 3) return true
      const chance = Math.max(0, 0.70 - (ctx.turn - 1) * 0.14)
      // 敵軍2名を選び、対象ごとに封撃の付与を判定する。
      explicitEnemyTargets(ctx, h, 2).forEach((target) => {
        if (h.roll(ctx.rng, chance)) h.addControl(ctx, target, '封撃', 1)
      })
      return true
    }
    case '嚢沙之計': {
      // 戦法タイプ: 能動
      // 敵軍2名へ、102%・知略依存の水攻めを2ターン付与する。
      explicitEnemyTargets(ctx, h, 2).forEach((target) => {
        applyExplicitContinuousDamage(ctx, h, target, '水攻め', 2, 102, 'strategy')
        // 同じ2ターン、対象が受ける計略ダメージを30%増加させる。
        h.addTimedModifier(ctx, target, 'strategyDamageTaken', 30, 2, 1)
      })
      return true
    }
    case '全力戦闘': {
      // 戦法タイプ: 受動
      // 5ターン目以降、戦闘終了まで連撃70%を維持する。
      if (ctx.turn >= 5) {
        ctx.caster.specialState.comboChance = 70
        ctx.caster.specialState.comboChanceUntil = 99
      }
      return true
    }
    case '荒切': {
      // 戦法タイプ: 突撃
      // 通常攻撃後、次の通常攻撃判定まで連撃100%を付与する。
      ctx.caster.specialState.comboChance = 100
      ctx.caster.specialState.comboChanceUntil = expiresAfterTurns(ctx.turn, 1)
      return true
    }
    case '奮戦': {
      // 戦法タイプ: 能動
      // 自身へ連撃100%を1ターン付与する。
      ctx.caster.specialState.comboChance = 100
      ctx.caster.specialState.comboChanceUntil = expiresAfterTurns(ctx.turn, 1)
      // 代償として同じ1ターン、与ダメージを15%低下させる。
      h.addTimedModifier(ctx, ctx.caster, 'damageDealt', -15, 1, 1)
      return true
    }
    case '生死一顧': {
      // 戦法タイプ: 能動
      // 生存中の敵軍全体へ56%・知略依存の計略ダメージを与える。
      living(ctx.enemies).forEach((target) => {
        h.dealSkillDamage(ctx, target, 56, 'strategy')
        // 生存対象へ挑発を1ターン付与する。
        if (target.hp > 0) h.addControl(ctx, target, '挑発', 1)
      })
      return true
    }
    case '先陣の勇': {
      // 戦法タイプ: 能動
      // 敵軍単体へ154%の兵刃ダメージを与える。
      const target = explicitEnemyTarget(ctx, h)
      if (!target) return true
      h.dealSkillDamage(ctx, target, 154, 'physical')
      // 基礎35%に双方の速度差を加味し、威圧を1ターン付与する。
      const speedGap = h.statOf(ctx.caster, 'spd') - h.statOf(target, 'spd')
      const chance = Math.max(0, Math.min(0.95, 0.35 + speedGap * 0.001))
      if (target.hp > 0 && h.roll(ctx.rng, chance)) h.addControl(ctx, target, '威圧', 1)
      // 自身の速度を2ターン20増加させる。
      h.addTimedModifier(ctx, ctx.caster, 'spd', 20, 2, 1)
      return true
    }
    case '後方支援': {
      // 戦法タイプ: 指揮
      const supportAllies = living(ctx.allies).filter((ally) => ally.id !== ctx.caster.id).slice(0, 2)
      if (ctx.trigger === 'preparationTurn') {
        // 代償として、所持者本人の能動戦法発動率を10%低下させる。
        ctx.caster.specialState.activeSkillActivationRateBonus = (ctx.caster.specialState.activeSkillActivationRateBonus ?? 0) - 10
        // 友軍2名へ与ダメージ+18%を付与する。
        supportAllies.forEach((ally) => setPermanentBuffContribution(ally, 'damageDealt', `rearSupport:${ctx.caster.id}`, 18))
        return true
      }
      // 毎ターン40%で、後方支援による友軍の上昇量を2%ずつ減らす。
      if (!h.roll(ctx.rng, 0.4)) return true
      supportAllies.forEach((ally) => {
        const sourceKey = `rearSupport:${ctx.caster.id}`
        const nextValue = Math.max(0, (ally.specialState[sourceKey] ?? 18) - 2)
        setPermanentBuffContribution(ally, 'damageDealt', sourceKey, nextValue)
      })
      return true
    }
    case '祓除': {
      // 戦法タイプ: 能動
      // 自軍2名の弱体効果を2個解除し、武勇・知略・速度を2ターン24増加させる。
      explicitAllyTargets(ctx, h, 2).forEach((target) => {
        removeDebuffs(target, 2)
        h.addTimedModifier(ctx, target, 'val', 24, 2, 1)
        h.addTimedModifier(ctx, target, 'int', 24, 2, 1)
        h.addTimedModifier(ctx, target, 'spd', 24, 2, 1)
      })
      return true
    }
    case '闇討ち': {
      // 戦法タイプ: 能動
      // 準備完了後、生存中の敵軍大将だけへ332%の兵刃ダメージを与える。
      const commander = ctx.enemies.find((enemy) => enemy.role === 'main' && enemy.hp > 0)
      if (commander) h.dealSkillDamage(ctx, commander, 332, 'physical')
      return true
    }
    case '奪気': {
      // 戦法タイプ: 能動
      // 敵軍2名から強化効果を最大2個ずつ解除する。
      explicitEnemyTargets(ctx, h, 2).forEach((target) => {
        removeOnePositiveEffect(target)
        removeOnePositiveEffect(target)
      })
      // 自身の知略を3ターン28増加させる。
      h.addTimedModifier(ctx, ctx.caster, 'int', 28, 3, 1)
      return true
    }
    case '殿軍奮戦': {
      // 戦法タイプ: 能動
      // 敵軍単体を選び、現在の挑発・牽制状態を確認する。
      const target = explicitEnemyTarget(ctx, h)
      if (!target) return true
      const hasTaunt = (target.statuses['挑発'] ?? 0) > 0
      const hasLure = (target.statuses['牽制'] ?? 0) > 0
      if (hasTaunt || hasLure) {
        // 既に片方なら与ダメージ-25%、両方なら-45%を2ターン付与する。
        h.addTimedModifier(ctx, target, 'damageDealt', hasTaunt && hasLure ? -45 : -25, 2, 1)
      } else {
        // 未付与なら挑発か牽制をランダムに1つ、2ターン付与する。
        h.addControl(ctx, target, h.roll(ctx.rng, 0.5) ? '挑発' : '牽制', 2)
      }
      return true
    }
    case '一上一下': {
      // 戦法タイプ: 受動
      // 戦闘中、自身の能動戦法の発動確率が6%→12%増加
      // 準備ターンに、最大レベル時の12%を戦闘終了まで加算する。
      addActiveSkillActivationRateBonus(ctx, 12)
      return true
    }
    case '捨て身の義': {
      // 戦法タイプ: 指揮
      if (ctx.trigger === 'preparationTurn') {
        // 戦闘開始時、自身の統率を40増加させる。
        setPermanentBuffContribution(ctx.caster, 'lea', 'selfSacrificeLeadership', 40)
        // 発動者以外の友軍2名は、武勇と知略を20増加させる。
        living(ctx.allies).filter((ally) => ally.id !== ctx.caster.id).slice(0, 2).forEach((ally) => {
          setPermanentBuffContribution(ally, 'val', `selfSacrificeValor:${ctx.caster.id}`, 20)
          setPermanentBuffContribution(ally, 'int', `selfSacrificeIntelligence:${ctx.caster.id}`, 20)
        })
        ctx.caster.specialState.selfSacrificeLastThreshold = Math.floor(ctx.caster.hp / Math.max(1, ctx.caster.maxHp) * 5)
        return true
      }
      // 自身の兵力が20%の境界を下回るたび、初期値の60%分を追加で重ねる。
      const currentThreshold = Math.floor(ctx.caster.hp / Math.max(1, ctx.caster.maxHp) * 5)
      const previousThreshold = ctx.caster.specialState.selfSacrificeLastThreshold ?? currentThreshold
      const crossed = Math.max(0, previousThreshold - currentThreshold)
      if (crossed <= 0) return true
      ctx.caster.specialState.selfSacrificeLastThreshold = currentThreshold
      ctx.caster.buffs.lea = (ctx.caster.buffs.lea ?? 0) + 24 * crossed
      living(ctx.allies).filter((ally) => ally.id !== ctx.caster.id).slice(0, 2).forEach((ally) => {
        ally.buffs.val = (ally.buffs.val ?? 0) + 12 * crossed
        ally.buffs.int = (ally.buffs.int ?? 0) + 12 * crossed
      })
      return true
    }
    case '百錬成鋼': {
      // 戦法タイプ: 受動
      // 戦闘中、自身の武勇・知略・統率・速度をそれぞれ35増加させる。
      ;(['val', 'int', 'lea', 'spd'] as Stat[]).forEach((stat) => {
        setPermanentBuffContribution(ctx.caster, stat, `temperedSteel:${stat}`, 35)
      })
      return true
    }
    case '懐柔': {
      // 戦法タイプ: 指揮
      // 第2～4ターンのターン開始時だけ、自軍2～3名を88%・知略依存で回復する。
      if (ctx.turn < 2 || ctx.turn > 4) return true
      const count = 2 + Math.floor(ctx.rng() * 2)
      explicitAllyTargets(ctx, h, count).forEach((target) => h.healBySkill(ctx, target, 88, 'strategy'))
      return true
    }
    case '休養': {
      // 戦法タイプ: 受動
      // 1～8ターンのターン開始時、自身を100%で回復する。
      h.healBySkill(ctx, ctx.caster, 100, 'strategy')
      return true
    }
    case '融通自在': {
      // 戦法タイプ: 能動
      const target = explicitAllyTargets(ctx, h, 1, true)[0] ?? ctx.caster
      // 現在の有効層を数え、最大2層まで能動戦法発動率+12%を重ねる。
      const activeStacks = target.timedModifiers.filter((modifier) =>
        modifier.key === '融通自在:activationRate' && modifier.expiresTurn >= ctx.turn).length
      if (activeStacks < 2) h.addTimedModifier(ctx, target, 'activationRate', 12, 2, 2)
      return true
    }
    case '腹中鱗甲': {
      // 戦法タイプ: 受動
      // 通常攻撃を行った敵武将だけを反撃対象にする。
      const attacker = ctx.target
      if (!attacker || attacker.side === ctx.caster.side || attacker.hp <= 0) return true
      // 自身が大将なら52%、副将なら62%の兵刃反撃を与える。
      h.dealSkillDamage(ctx, attacker, hasCommanderSkill(ctx.caster) ? 52 : 62, 'physical')
      return true
    }
    case '敵陣攪乱': {
      // 戦法タイプ: 能動
      // 敵軍単体へ146%・知略依存の計略ダメージを与える。
      const target = explicitEnemyTarget(ctx, h)
      if (!target) return true
      h.dealSkillDamage(ctx, target, 146, 'strategy')
      // 生存対象へ混乱を1ターン付与する。
      if (target.hp > 0) h.addControl(ctx, target, '混乱', 1)
      return true
    }
    case '警戒周到': {
      // 戦法タイプ: 指揮
      // 戦闘開始時、自軍2名の被ダメージを最初の4ターン22%低下させる。
      explicitAllyTargets(ctx, h, 2).forEach((target) => {
        h.addTimedModifier(ctx, target, 'damageTaken', -22, 4, 1)
      })
      return true
    }
    case '魚目混珠': {
      // 戦法タイプ: 受動
      if (ctx.trigger === 'preparationTurn') {
        // 戦闘開始時、自身の通常攻撃を禁止する。
        h.addControl(ctx, ctx.caster, '封撃', 99)
        // 戦闘開始時、自身の与ダメージを50%低下させる。
        setPermanentBuffContribution(ctx.caster, 'damageDealt', 'fishEyeDamagePenalty', -50)
        return true
      }
      // 毎ターン開始時、食事で自身を212%回復する。
      h.healBySkill(ctx, ctx.caster, 212, 'strategy')
      return true
    }
    case '不意打ち': {
      // 戦法タイプ: 能動
      // 65%で2ターン、それ以外は1ターン持続する。
      const duration = h.roll(ctx.rng, 0.65) ? 2 : 1
      // 敵軍2名へ、無策または封撃のどちらか1種類をランダムに付与する。
      explicitEnemyTargets(ctx, h, 2).forEach((target) => {
        h.addControl(ctx, target, h.roll(ctx.rng, 0.5) ? '無策' : '封撃', duration)
      })
      return true
    }
    case '有備無患': {
      // 戦法タイプ: 能動
      // 自軍2名を108%・知略依存で回復する。
      explicitAllyTargets(ctx, h, 2).forEach((target) => h.healBySkill(ctx, target, 108, 'strategy'))
      return true
    }
    case '一触即発': {
      // 戦法タイプ: 突撃
      // 通常攻撃対象の統率を140低下させ、無策を1ターン付与する。
      const target = explicitEnemyTarget(ctx, h)
      if (!target) return true
      h.addTimedModifier(ctx, target, 'lea', -140, 1, 1)
      h.addControl(ctx, target, '無策', 1)
      return true
    }
    case '弓調馬服': {
      // 戦法タイプ: 能動
      const target = explicitEnemyTarget(ctx, h)
      if (!target) return true
      const valorIsHigher = h.statOf(target, 'val') >= h.statOf(target, 'int')
      // 対象の武勇と知略を比較し、高い方だけを2ターン100低下させる。
      h.addTimedModifier(ctx, target, valorIsHigher ? 'val' : 'int', -100, 2, 1)
      // 20%を基礎として武勇依存で成功した場合、低い方も同量低下させる。
      if (h.roll(ctx.rng, attributeDependentChance(0.2, [h.statOf(ctx.caster, 'val')]))) {
        h.addTimedModifier(ctx, target, valorIsHigher ? 'int' : 'val', -100, 2, 1)
      }
      return true
    }
    case '回山倒海': {
      // 戦法タイプ: 突撃
      // 通常攻撃対象へ104%の兵刃ダメージを与える。
      const target = explicitEnemyTarget(ctx, h)
      if (!target) return true
      h.dealSkillDamage(ctx, target, 104, 'physical')
      // 生存対象へ94%・武勇依存の潰走を2ターン付与する。
      if (target.hp > 0) applyExplicitContinuousDamage(ctx, h, target, '潰走', 2, 94, 'physical')
      return true
    }
    case '参謀の助言': {
      // 戦法タイプ: 指揮
      // 戦闘中、自軍全体の武勇と知略を28増加させる。
      living(ctx.allies).forEach((target) => {
        setPermanentBuffContribution(target, 'val', `strategistAdviceValor:${ctx.caster.id}`, 28)
        setPermanentBuffContribution(target, 'int', `strategistAdviceIntelligence:${ctx.caster.id}`, 28)
      })
      return true
    }
    case '嘲罵': {
      // 戦法タイプ: 能動
      // 生存中の敵軍全体へ挑発を1ターン付与する。
      living(ctx.enemies).forEach((target) => h.addControl(ctx, target, '挑発', 1))
      return true
    }
    case '刺突': {
      // 戦法タイプ: 能動
      const target = explicitEnemyTarget(ctx, h)
      // 敵軍単体へ70%・武勇依存の潰走を3ターン付与する。
      if (target) applyExplicitContinuousDamage(ctx, h, target, '潰走', 3, 70, 'physical')
      return true
    }
    case '対話': {
      // 戦法タイプ: 能動
      // 自軍単体へ混乱耐性を3ターン付与する。混乱そのものは付与しない。
      const target = explicitAllyTargets(ctx, h, 1)[0]
      if (target) target.specialState['controlImmunityUntil:混乱'] = expiresAfterTurns(ctx.turn, 3)
      return true
    }
    case '救援': {
      // 戦法タイプ: 能動
      if (ctx.trigger === 'beforeAction') {
        // 自軍単体へ、被ダメージ時に反応する回生を2ターン付与する。
        const target = explicitAllyTargets(ctx, h, 1)[0]
        if (target) {
          target.specialState.rescueRecoverySource = roleCode(ctx.caster)
          target.specialState.rescueRecoveryUntil = expiresAfterTurns(ctx.turn, 2)
          log(ctx.logs, ctx, `救援: ${target.name}に回生を付与(2T)`, target)
        }
        return true
      }
      // 回生対象が兵刃・計略ダメージを受けるたび、50%で75%・知略依存の回復を行う。
      const damaged = ctx.eventSubject
      if (
        damaged
        && damaged.specialState.rescueRecoverySource === roleCode(ctx.caster)
        && (damaged.specialState.rescueRecoveryUntil ?? 0) >= ctx.turn
        && h.roll(ctx.rng, 0.5)
      ) h.healBySkill(ctx, damaged, 75, 'strategy')
      return true
    }
    case '水計': {
      // 戦法タイプ: 能動
      const target = explicitEnemyTarget(ctx, h)
      // 敵軍単体へ70%・知略依存の水攻めを3ターン付与する。
      if (target) applyExplicitContinuousDamage(ctx, h, target, '水攻め', 3, 70, 'strategy')
      return true
    }
    case '猛撃': {
      // 戦法タイプ: 突撃
      // 通常攻撃後、自身へ会心15%を2ターン付与する。
      h.addTimedModifier(ctx, ctx.caster, 'physicalCriticalChance', 15, 2, 1)
      return true
    }
    case '看破': {
      // 戦法タイプ: 能動
      const target = explicitEnemyTarget(ctx, h)
      if (!target) return true
      // 敵軍単体から強化効果を1個解除する。
      removeOnePositiveEffect(target)
      // 同じ対象の知略を2ターン18低下させる。
      h.addTimedModifier(ctx, target, 'int', -18, 2, 1)
      return true
    }
    case '火計': {
      // 戦法タイプ: 能動
      const target = explicitEnemyTarget(ctx, h)
      // 敵軍単体へ70%・知略依存の火傷を3ターン付与する。
      if (target) applyExplicitContinuousDamage(ctx, h, target, '火傷', 3, 70, 'strategy')
      return true
    }
    case '奮起': {
      // 戦法タイプ: 受動
      // 戦闘中、自身の武勇と速度を25増加させる。
      setPermanentBuffContribution(ctx.caster, 'val', 'rouseValor', 25)
      setPermanentBuffContribution(ctx.caster, 'spd', 'rouseSpeed', 25)
      return true
    }
    case '殿軍': {
      // 戦法タイプ: 能動
      // 自身の武勇を2ターン30増加させる。
      h.addTimedModifier(ctx, ctx.caster, 'val', 30, 2, 1)
      // 副将として編成されている場合だけ、統率も2ターン40増加させる。
      if (!hasCommanderSkill(ctx.caster)) h.addTimedModifier(ctx, ctx.caster, 'lea', 40, 2, 1)
      return true
    }
    case '破甲': {
      // 戦法タイプ: 突撃
      const target = explicitEnemyTarget(ctx, h)
      // 通常攻撃対象の統率を2ターン36低下させる。
      if (target) h.addTimedModifier(ctx, target, 'lea', -36, 2, 1)
      return true
    }
    case '威圧': {
      // 戦法タイプ: 能動
      // 敵軍2名の与ダメージを2ターン15%低下させる。
      explicitEnemyTargets(ctx, h, 2).forEach((target) => {
        h.addTimedModifier(ctx, target, 'damageDealt', -15, 2, 1)
      })
      return true
    }
    case '恵風和雨': {
      // 戦法タイプ: 指揮
      // 準備ターンは指揮戦法の登録だけを行い、回復判定は1～8ターン目に実行する。
      if (ctx.trigger === 'preparationTurn' || ctx.turn <= 0) return true

      // 偶数ターンは80%で発動する。奇数ターンは女性武将だけが発動判定を行う。
      const isEvenTurn = ctx.turn % 2 === 0
      const isFemale = /女|女性|female/i.test(ctx.caster.gender)
      if (!isEvenTurn && !isFemale) return true

      // 女性武将の奇数ターンは20%を基礎値とし、魅力100超過分で発動率を上げる。
      const chance = isEvenTurn
        ? 0.8
        : attributeDependentChance(0.2, [h.statOf(ctx.caster, 'cha')])
      if (!h.roll(ctx.rng, chance)) return true

      // 発動に成功した時だけ、ランダムな自軍2名を122%・知略依存で回復する。
      explicitAllyTargets(ctx, h, 2).forEach((target) => h.healBySkill(ctx, target, 122, 'strategy'))
      return true
    }
    case '金城湯池': {
      // 戦法タイプ: 能動
      if (ctx.trigger === 'turnStart') {
        // 発動の次ターン開始時に、予約されていた78%・知略依存の回復を行う。
        if (ctx.caster.specialState.goldenFortressHealTurn === ctx.turn) {
          h.healBySkill(ctx, ctx.caster, 78, 'strategy')
          ctx.caster.specialState.goldenFortressHealTurn = 0
        }
        return true
      }

      // 発動時、敵軍2～3名へ牽制を1ターン付与する。
      const count = 2 + Math.floor(ctx.rng() * 2)
      explicitEnemyTargets(ctx, h, count).forEach((target) => h.addControl(ctx, target, '牽制', 1))
      // 自身が戦法から受けるダメージを、知略依存で最大15%軽減する。
      ctx.caster.specialState.skillDamageReductionPercent = attributeDependentValue(15, [h.statOf(ctx.caster, 'int')])
      ctx.caster.specialState.skillDamageReductionUntil = ctx.turn
      // 回復は即時に行わず、次のターン開始時へ予約する。
      ctx.caster.specialState.goldenFortressHealTurn = ctx.turn + 1
      return true
    }
    case '姻戚同盟': {
      // 戦法タイプ: 能動
      const oppositeGender = living(ctx.allies).filter((ally) =>
        ally.id !== ctx.caster.id && Boolean(ally.gender) && ally.gender !== ctx.caster.gender)
      const ally = randomLiving(ctx, h, oppositeGender)
      const reduction = attributeDependentValue(20, [h.statOf(ctx.caster, 'int')])
      // 自身と異性の友軍1名の被ダメージを2ターン軽減する。
      h.addTimedModifier(ctx, ctx.caster, 'damageTaken', -reduction, 2, 1)
      if (ally) {
        h.addTimedModifier(ctx, ally, 'damageTaken', -reduction, 2, 1)
        // 友軍が受けるダメージの20%を、発動者が肩代わりする。
        ally.specialState.damageShoulderSourceRole = roleCode(ctx.caster)
        ally.specialState.damageShoulderPercent = 20
        ally.specialState.damageShoulderUntil = expiresAfterTurns(ctx.turn, 2)
        ally.specialState.damageShoulderEffect = 3
      }
      return true
    }
    case '離心の計': {
      // 戦法タイプ: 能動
      // 準備完了後、生存中の敵軍大将だけを対象にする。
      const commander = ctx.enemies.find((enemy) => enemy.role === 'main' && enemy.hp > 0)
      if (!commander) return true
      // 敵軍大将へ252%の兵刃ダメージを与える。
      h.dealSkillDamage(ctx, commander, 252, 'physical')
      // 生存していれば、与ダメージを50%低下させる効果を2ターン付与する。
      if (commander.hp > 0) h.addTimedModifier(ctx, commander, 'damageDealt', -50, 2, 1)
      return true
    }
    case '機に乗ず': {
      // 戦法タイプ: 突撃
      // 通常攻撃対象の武勇と知略を140低下させる。
      const target = explicitEnemyTarget(ctx, h)
      if (!target) return true
      h.addTimedModifier(ctx, target, 'val', -140, 1, 1)
      h.addTimedModifier(ctx, target, 'int', -140, 1, 1)

      const controlled = (target.statuses['挑発'] ?? 0) > 0 || (target.statuses['牽制'] ?? 0) > 0
      if (controlled) {
        // 対象が既に挑発・牽制中なら、自身へ回避35%を1ターン付与する。
        ctx.caster.specialState.skillEvasionChance = 35
        ctx.caster.specialState.skillEvasionUntil = expiresAfterTurns(ctx.turn, 1)
      } else {
        // 未付与なら、対象へ挑発と牽制を同時に1ターン付与する。
        h.addControl(ctx, target, '挑発', 1)
        h.addControl(ctx, target, '牽制', 1)
      }
      return true
    }
    case '大器の萌芽': {
      // 戦法タイプ: 指揮
      // 5ターン目以降のターン開始時、自軍2名を108%・知略依存で回復する。
      if (ctx.turn < 5) return true
      explicitAllyTargets(ctx, h, 2).forEach((target) => h.healBySkill(ctx, target, 108, 'strategy'))
      return true
    }
    case '自立の志': {
      // 戦法タイプ: 能動
      // 生存中の敵軍全体へ挑発を2ターン付与する。
      living(ctx.enemies).forEach((target) => h.addControl(ctx, target, '挑発', 2))
      // 現在統率の55%分を2ターン加算する。
      const leadershipBonus = h.statOf(ctx.caster, 'lea') * 0.55
      h.addTimedModifier(ctx, ctx.caster, 'lea', leadershipBonus, 2, 1)
      return true
    }
    case '専横専断': {
      // 戦法タイプ: 能動
      // 発動回数を記録し、次の能動・兵刃ダメージの上昇量を毎回12%増加させる。
      const activations = (ctx.caster.specialState.arbitraryRuleActivations ?? 0) + 1
      ctx.caster.specialState.arbitraryRuleActivations = activations
      ctx.caster.specialState.nextActivePhysicalDamageBonus = 48 + (activations - 1) * 12
      // 3回目ごとの発動時、敵軍単体へ無策を1ターン付与する。
      if (activations % 3 === 0) {
        const target = explicitEnemyTarget(ctx, h)
        if (target) h.addControl(ctx, target, '無策', 1)
      }
      return true
    }
    case '家中整序': {
      // 戦法タイプ: 能動
      // 敵軍単体へ136%の計略ダメージを与える。
      const target = explicitEnemyTarget(ctx, h)
      if (!target) return true
      h.dealSkillDamage(ctx, target, 136, 'strategy')
      // 生存対象へ封撃を2ターン付与する。
      if (target.hp > 0) h.addControl(ctx, target, '封撃', 2)
      return true
    }
    case '破天の轟': {
      // 戦法タイプ: 能動
      // 準備完了後、敵軍2名へ105%・知略依存の火傷を2ターン付与する。
      explicitEnemyTargets(ctx, h, 2).forEach((target) => {
        applyExplicitContinuousDamage(ctx, h, target, '火傷', 2, 105, 'strategy')
        // 同じ対象の統率を20低下させ、2ターン持続させる。
        h.addTimedModifier(ctx, target, 'lea', -20, 2, 1)
      })
      return true
    }
    case '雷神斬り': {
      // 戦法タイプ: 受動
      // 毎ターン開始時、蓄勢を1増やす。
      const charges = (ctx.caster.specialState.thunderSlashCharges ?? 0) + 1
      ctx.caster.specialState.thunderSlashCharges = charges
      // 蓄勢2未満、または威圧中なら強化を発動せず蓄勢を保持する。
      if (charges < 2 || (ctx.caster.statuses['威圧'] ?? 0) > 0) return true
      // 蓄勢をすべて消費し、会心50%・武勇120を1ターン獲得する。
      ctx.caster.specialState.thunderSlashCharges = 0
      h.addTimedModifier(ctx, ctx.caster, 'physicalCriticalChance', 50, 1, 1)
      h.addTimedModifier(ctx, ctx.caster, 'val', 120, 1, 1)
      if (charges > 2) {
        // 3以上を消費した場合は、追加で会心25%・武勇60を獲得する。
        h.addTimedModifier(ctx, ctx.caster, 'physicalCriticalChance', 25, 1, 1)
        h.addTimedModifier(ctx, ctx.caster, 'val', 60, 1, 1)
      }
      return true
    }
    case '疑心暗鬼': {
      // 戦法タイプ: 受動
      if (ctx.trigger === 'preparationTurn') {
        // 準備が必要な固有能動戦法を探し、その戦法だけの発動率を知略依存で最大12%上昇させる。
        const preparedUnique = ctx.caster.skills.find((skill) =>
          battleSkillType(skill) === '能動'
          && Boolean(skill.is_unique || skill.unique_hero)
          && (varValue(skill, 'prep_turns') ?? 0) > 0)
        if (preparedUnique) {
          const skillName = preparedUnique.name_jp || preparedUnique.name
          ctx.caster.specialState[`activationRateBonus:${skillName}`] = attributeDependentValue(12, [h.statOf(ctx.caster, 'int')])
        }
        return true
      }
      // 実際に準備型の固有能動戦法が発動した時、自身の知略を2ターン最大30増加させる。
      if (
        (ctx.caster.specialState.currentActivatedSkillActive ?? 0) > 0
        && (ctx.caster.specialState.currentActivatedSkillUnique ?? 0) > 0
        && (ctx.caster.specialState.currentActivatedSkillPrepared ?? 0) > 0
      ) h.addTimedModifier(ctx, ctx.caster, 'int', attributeDependentValue(30, [h.statOf(ctx.caster, 'int')]), 2, 1)
      return true
    }
    case '直諫敢行': {
      // 戦法タイプ: 能動
      // 発動タイミング: 自身の行動開始前
      if (ctx.trigger !== 'beforeAction') return true

      // 自軍から生存中の武将をランダムに2名選ぶ。
      const targets = h.aliveRandom(ctx.allies, ctx.rng, ctx).slice(0, 2)
      // 最大効果26%を基準に、発動者の知略で被ダメージ低下量を補正する。
      const reduction = attributeDependentValue(26, [h.statOf(ctx.caster, 'int')])

      targets.forEach((target) => {
        // 2ターン持続し、同じ対象には最大2層まで重ねがけできる。
        h.addTimedModifier(ctx, target, 'damageTaken', -reduction, 2, 2)
        // スタック数ではなく、現在有効な被ダメージ低下量の合計を表示する。
        const totalReduction = -target.timedModifiers
          .filter((modifier) => modifier.key === '直諫敢行:damageTaken')
          .reduce((sum, modifier) => sum + modifier.value, 0)
        ctx.logs.push({
          turn: ctx.turn,
          side: ctx.caster.side,
          actor: ctx.caster.name,
          actorHp: ctx.caster.hp,
          target: target.name,
          targetSide: target.side,
          effect: '直諫敢行',
          message: `${target.name}の被ダメージを${reduction.toFixed(2)}%低下（合計${totalReduction.toFixed(2)}%・2ターン）`,
        })
      })
      return true
    }
    case '会盟の陣': {
      // 戦法タイプ: 陣法
      if (ctx.trigger === 'preparationTurn') {
        // 自軍3名が揃い、所属勢力がすべて異なるかを確認する。
        const factions = ctx.allies.map((ally) => ally.faction).filter(Boolean)
        const allFactionsDifferent = factions.length === 3 && new Set(factions).size === 3
        // 自軍大将と、その固有戦法を取得する。
        const commander = ctx.allies.find((ally) => ally.role === 'main')
        const commanderUniqueSkill = commander?.skills.find((skill) =>
          Boolean(skill.is_unique || skill.unique_hero || /固有戦法/.test(skill.game8_kind ?? '')))
        // 大将の固有戦法が能動または突撃かを確認する。
        const uniqueSkillType = commanderUniqueSkill ? battleSkillType(commanderUniqueSkill) : null
        const validUniqueSkill = uniqueSkillType === '能動' || uniqueSkillType === '突撃'

        if (!commander || !commanderUniqueSkill || !allFactionsDifferent || !validUniqueSkill) {
          ctx.caster.specialState.allianceFormationActive = 0
          log(ctx.logs, ctx, '会盟の陣: 発動条件を満たしていない')
          return true
        }

        // 条件成立を記録し、大将の固有戦法だけに発動率+13%を加える。
        ctx.caster.specialState.allianceFormationActive = 1
        const uniqueSkillName = commanderUniqueSkill.name_jp || commanderUniqueSkill.name
        const activationRateKey = `activationRateBonus:${uniqueSkillName}`
        setSpecialStateContribution(
          commander,
          activationRateKey,
          `allianceFormationActivationRate:${ctx.caster.id}:${uniqueSkillName}`,
          13,
        )
        log(ctx.logs, ctx, `${commander.name}の${uniqueSkillName}発動率が13.00%上昇`, commander)
        return true
      }

      // 準備ターンで条件を満たしていない場合、所持武将の行動開始時補正を行わない。
      if ((ctx.caster.specialState.allianceFormationActive ?? 0) <= 0) return true
      // 現在兵力を比較するため、戦死した武将を含む副将2名を取得する。
      const deputies = ctx.allies.filter((ally) => ally.role !== 'main')
      if (deputies.length < 2) return true
      // 同兵力の場合は第1副将を兵力が高い側として扱う。
      const higher = deputies[0]!.hp >= deputies[1]!.hp ? deputies[0]! : deputies[1]!
      const lower = higher.id === deputies[0]!.id ? deputies[1]! : deputies[0]!

      // 兵力が高い副将は、1ターンの間、与ダメージ+18%・被ダメージ-10%。
      if (higher.hp > 0) {
        h.addTimedModifier(ctx, higher, 'damageDealt', 18, 1, 1)
        h.addTimedModifier(ctx, higher, 'damageTaken', -10, 1, 1)
        log(ctx.logs, ctx, `会盟の陣: ${higher.name}の与ダメージが18.00%上昇（${(100 + (higher.buffs.damageDealt ?? 0)).toFixed(2)}%）、被ダメージが10.00%低下（${(100 + (higher.buffs.damageTaken ?? 0)).toFixed(2)}%）`, higher)
      }

      // 兵力が低い副将は、1ターンの間、与ダメージ+10%・被ダメージ-18%。
      if (lower.hp > 0) {
        h.addTimedModifier(ctx, lower, 'damageDealt', 10, 1, 1)
        h.addTimedModifier(ctx, lower, 'damageTaken', -18, 1, 1)
        log(ctx.logs, ctx, `会盟の陣: ${lower.name}の与ダメージが10.00%上昇（${(100 + (lower.buffs.damageDealt ?? 0)).toFixed(2)}%）、被ダメージが18.00%低下（${(100 + (lower.buffs.damageTaken ?? 0)).toFixed(2)}%）`, lower)
      }
      return true
    }
    case '出奇制勝': {
      // 戦法タイプ: 受動
      if (ctx.trigger === 'preparationTurn') {
        // 戦闘中、固有能動戦法の与ダメージを知略依存で最大28%上昇させる。
        ctx.caster.specialState.uniqueActiveDamageBonus = attributeDependentValue(28, [h.statOf(ctx.caster, 'int')])
        ctx.caster.specialState.uniqueActiveDamageBonusUntil = 99
        return true
      }
      // 固有能動戦法の発動成功後だけ、70%（知略依存）で攻心を4%獲得する。
      if (
        (ctx.caster.specialState.currentActivatedSkillActive ?? 0) > 0
        && (ctx.caster.specialState.currentActivatedSkillUnique ?? 0) > 0
        && h.roll(ctx.rng, attributeDependentChance(0.7, [h.statOf(ctx.caster, 'int')]))
      ) {
        ctx.caster.specialState.strategyLifeStealPercent = Math.min(
          16,
          (ctx.caster.specialState.strategyLifeStealPercent ?? 0) + 4,
        )
        ctx.caster.specialState.strategyLifeStealUntil = 99
        log(ctx.logs, ctx, `出奇制勝: ${ctx.caster.name}の攻心が${ctx.caster.specialState.strategyLifeStealPercent.toFixed(2)}%に上昇`)
      }
      return true
    }
    case '重農主義': {
      // 戦法タイプ: 指揮
      // 評定衆時に兵糧増産効果を増加
      // 内政専用戦法のため、戦闘中には効果を発生させない。
      return true
    }
    case '戮力同心': {
      // 戦法タイプ: 指揮
      // 毎ターン開始時、34%を基礎として統率依存で発動判定する。
      const chance = attributeDependentChance(0.34, [h.statOf(ctx.caster, 'lea')])
      if (!h.roll(ctx.rng, chance)) return true
      const weakestAlly = h.weakest(ctx.allies, 1)[0]
      // 自身が兵力最低でなければ自軍全体、最低なら自身と友軍1名を回復対象にする。
      const targets = weakestAlly?.id !== ctx.caster.id
        ? living(ctx.allies)
        : [ctx.caster, ...explicitAllyTargets(ctx, h, 1, true)]
      targets.forEach((target) => h.healBySkill(ctx, target, 82, 'leadership'))
      return true
    }
    case '士気高揚': {
      // 戦法タイプ: 能動
      // 自軍単体へ洞察を1ターン付与する。
      const target = explicitAllyTargets(ctx, h, 1)[0]
      if (target) target.specialState.insightUntil = expiresAfterTurns(ctx.turn, 1)
      return true
    }
    // DB戦法: ここまで。

    default:
      return false
  }
}
