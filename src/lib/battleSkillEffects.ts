import type { Skill, Stat, StructuredBattleNode, TriggerEvent } from '../composables/useData'
import type { BattleFighter, BattleLogEntry, SkillResolveContext } from './battleSimulator'
import skillsData from '../../.build/skills.json'

export const HEAL_STOCK_DAMAGE_SKILL_NAMES = ['比翼連理']

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
  表裏比興: defineBattleSkillMeta({ type: '能動' }),
  瞬息万変: defineBattleSkillMeta({ type: '能動' }),
  沈魚落雁: defineBattleSkillMeta({ type: '受動', triggers: ['onNormalAttackReceived'] }),
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
  攻其不備: defineBattleSkillMeta({ type: '能動', triggers: ['beforeAction'] }),
  追い崩し: defineBattleSkillMeta({ type: '能動', triggers: ['beforeAction'] }),
  追亡逐北: defineBattleSkillMeta({ type: '能動', triggers: ['beforeAction'] }),
  縦横馳突: defineBattleSkillMeta({ type: '能動', triggers: ['beforeAction'], replaceStructuredTriggers: true }),
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
  臨時槍の鈴: defineBattleSkillMeta({ type: '突撃', triggers: ['afterNormalAttack'] }),
  連戦: defineBattleSkillMeta({ type: '突撃', triggers: ['afterNormalAttack'] }),
  三河武士: defineBattleSkillMeta({ type: '兵種' }),
  風林火山: defineBattleSkillMeta({ type: '指揮' }),
  無想掃討: defineBattleSkillMeta({ type: '能動' }),
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
  '越後二天',
  '疾風迅雷',
  '表裏比興',
  '瞬息万変',
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
export const TEAM_NORMAL_ATTACK_RECEIVED_SKILL_NAMES = new Set(['三河魂', '月華鶴影', '大太刀力士隊'])

// 友軍の通常攻撃や被ダメージ、敵軍の行動を監視する個別戦法。
export const TEAM_AFTER_NORMAL_ATTACK_SKILL_NAMES = new Set(['覇王の右筆', '献身'])
export const TEAM_DAMAGE_RECEIVED_SKILL_NAMES = new Set(['援護射撃', '三河弓兵隊'])
export const ENEMY_STRATEGY_DAMAGE_RECEIVED_SKILL_NAMES = new Set(['城盗り'])
export const TEAM_BEFORE_ACTION_SKILL_NAMES = new Set(['伝馬疾馳'])
export const ENEMY_AFTER_ACTION_SKILL_NAMES = new Set(['三楽犬'])
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
  '電光石火', '同討', '薙ぎ払い', '不屈の精神', '不退転', '勇猛無比', '臨時槍の鈴', '連戦',
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
  addControl: (ctx: SkillResolveContext, target: BattleFighter, name: string, duration: number) => void
  addTimedModifier: (
    ctx: SkillResolveContext,
    target: BattleFighter,
    stat: Stat,
    value: number,
    duration: number,
    maxStacks?: number,
  ) => void
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
  '中毒',
  '消沈',
  '潰走',
]
const CONTINUOUS_DAMAGE_NAMES = new Set(['火傷', '水攻', '水攻め', '中毒', '消沈', '潰走'])

// 弱体効果を指定数まで解除する。戦法コメントからそのまま呼べるようにしておく。
export const removeDebuffs = (fighter: BattleFighter, count: number): string[] => {
  const removed: string[] = []
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
      if (fighter.role === 'main' && nextBuffStacks === 4) {
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
) => {
  recordDateIkiDamageHit(fighter, kind, turn, logs)
  recordBunbuDamageHit(fighter, kind, turn, logs)
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
const roleCode = (fighter: BattleFighter): number => fighter.role === 'main' ? 1 : fighter.role === 'vice1' ? 2 : 3
const highestByStat = (fighters: BattleFighter[], stat: Stat): BattleFighter | null =>
  [...living(fighters)].sort((a, b) => (b.baseStats[stat] + (b.buffs[stat] ?? 0)) - (a.baseStats[stat] + (a.buffs[stat] ?? 0)))[0] ?? null
const lowestByStat = (fighters: BattleFighter[], stat: Stat): BattleFighter | null =>
  [...living(fighters)].sort((a, b) => (a.baseStats[stat] + (a.buffs[stat] ?? 0)) - (b.baseStats[stat] + (b.buffs[stat] ?? 0)))[0] ?? null
const randomLiving = (ctx: SkillResolveContext, h: BattleSkillEffectHelpers, fighters: BattleFighter[]): BattleFighter | null =>
  h.aliveRandom(fighters, ctx.rng, ctx)[0] ?? null
const expiresAfterTurns = (turn: number, duration: number): number => Math.max(1, turn) + Math.max(1, duration) - 1

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
  if (/commander_strategy_type/.test(text)) return ctx.caster.role === 'main'
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
          turns: duration,
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

  if (rootMatches && ctx.caster.role === 'main' && battle.bonus && typeof battle.bonus === 'object') {
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
  const turns = Math.max(1, Math.round(ctx.skill.dot_turns ?? durationFromDatabase(ctx.skill, 1)))
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

const applyDatabaseSkillEffect = (ctx: SkillResolveContext, h: BattleSkillEffectHelpers): boolean => {
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

  // 精密な個別caseがない戦法は、skills.json の battle.do を説明通りに実行する。
  // battle定義側が条件不成立を返した場合も、旧来の単一効果へ二重実行しない。
  if (ctx.skill.battle && !PRECISE_HANDCRAFTED_SKILLS.has(name) && !PRECISE_HANDCRAFTED_SKILLS.has(ctx.skill.name)) {
    return applyStructuredBattleSkillEffect(ctx, h)
  }

  switch (name) {
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
      const allHealChance = ctx.caster.role === 'main' ? 0.7 : 0.35

      // 上の確率で自軍全体を回復
      if (h.roll(ctx.rng, allHealChance)) {
        ctx.allies.forEach((ally) => {
          if (ally.hp > 0) h.healBySkill(ctx, ally, 76, 'strategy')
        })
      } else {
        // 生きている味方のうち兵力割合が低い2人に76%の回復
        h.weakest(ctx.allies, 2).forEach((ally) => {
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
        const damageChance = ctx.caster.role === 'main' ? 0.75 : 0.6
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
      const useCommanderExtra = ctx.caster.role === 'main'
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
      // 兵力の低い味方2～3人を144%で回復
      const count = 2 + Math.floor(ctx.rng() * 2)
      h.weakest(ctx.allies, count).forEach((ally) => h.healBySkill(ctx, ally, 144, 'strategy'))
      return true
    }

    case '一舟軒': {
      // 戦法タイプ: 能動
      // 兵力の低い味方2人を152%で回復
      h.weakest(ctx.allies, 2).forEach((ally) => {
        h.healBySkill(ctx, ally, 152, 'strategy')

        // 52%で鉄壁を付与し、被ダメージを少し下げる
        if (h.roll(ctx.rng, 0.52)) {
          ally.statuses['鉄壁'] = Math.max(ally.statuses['鉄壁'] ?? 0, Math.round(h.varNumber(ctx.skill, 'duration', 2)))
          ally.buffs.damageTaken = (ally.buffs.damageTaken ?? 0) - 8
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

      // 75%で無策。すでに無策なら封撃へ置き換える
      if (h.roll(ctx.rng, 0.75)) {
        const status = (currentTarget.statuses['無策'] ?? 0) > 0 ? '封撃' : '無策'
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

      // 対象に108%の兵刃ダメージ
      const wasSilenced = (currentTarget.statuses['無策'] ?? 0) > 0
      h.dealSkillDamage(ctx, currentTarget, 108, 'physical')

      // 確率で無策を付与
      const silenceChance = h.varNumber(ctx.skill, 'silence_prob', 0.4)
      if (h.roll(ctx.rng, silenceChance)) h.addControl(ctx, currentTarget, '無策', Math.round(h.varNumber(ctx.skill, 'duration', 1)))

      // すでに無策だった場合は自身を回復
      if (wasSilenced) h.healBySkill(ctx, ctx.caster, 78, 'bravery')

      // 確率で別対象へ追加ダメージ
      if (h.roll(ctx.rng, h.varNumber(ctx.skill, 'extra_prob', 0.5))) {
        const extra = h.aliveRandom(ctx.enemies, ctx.rng, ctx).find((enemy) => enemy.id !== currentTarget.id) ?? currentTarget
        h.dealSkillDamage(ctx, extra, 98, 'physical')
      }
      return true
    }

    case '疾風迅雷': {
      // 戦法タイプ: 指揮
      // 45%で発動
      if (!h.roll(ctx.rng, 0.45)) return true

      // 敵軍複数に76%の兵刃ダメージ
      h.aliveRandom(ctx.enemies, ctx.rng, ctx).slice(0, Math.round(h.varNumber(ctx.skill, 'target_count', 2))).forEach((enemy) => {
        const wasParalyzed = (enemy.statuses['麻痺'] ?? 0) > 0
        h.dealSkillDamage(ctx, enemy, 76, 'physical')

        // 50%で麻痺を付与
        if (h.roll(ctx.rng, 0.5)) h.addControl(ctx, enemy, '麻痺', Math.round(h.varNumber(ctx.skill, 'status_duration', 1)))

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
      if (!currentTarget) return true

      // 敵単体に142%の計略ダメージ
      const wasConfused = (currentTarget.statuses['混乱'] ?? 0) > 0
      h.dealSkillDamage(ctx, currentTarget, 142, 'strategy')

      // 混乱を付与
      h.addControl(ctx, currentTarget, '混乱', Math.round(h.varNumber(ctx.skill, 'duration', 1)))

      // 既に混乱していれば追加で別対象へ192%の計略ダメージ
      if (wasConfused) {
        const extra = h.aliveRandom(ctx.enemies, ctx.rng, ctx).find((enemy) => enemy.id !== currentTarget.id) ?? currentTarget
        h.dealSkillDamage(ctx, extra, 192, 'strategy')
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
      // 自軍全体の統率を上昇
      const statBuff = h.varNumber(ctx.skill, 'stat_buff', 16)
      ctx.allies.forEach((ally) => {
        ally.buffs.lea = (ally.buffs.lea ?? 0) + statBuff
      })
      return true
    }

    case '風林火山': {
      // 戦法タイプ: 指揮
      // 偶数ターンごとに風林火山の順で効果を切り替える
      if (ctx.turn === 0 || ctx.turn % 2 !== 0) return true
      const phase = ((ctx.turn / 2) - 1) % 4

      if (phase === 0) {
        // 風: 味方2～3人の兵刃ダメージを上昇
        h.weakest(ctx.allies, 2 + Math.floor(ctx.rng() * 2)).forEach((ally) => {
          ally.buffs.attackDamage = (ally.buffs.attackDamage ?? 0) + 22
        })
      } else if (phase === 1) {
        // 林: 敵2～3人へ92%の計略ダメージ
        h.aliveRandom(ctx.enemies, ctx.rng, ctx).slice(0, 2 + Math.floor(ctx.rng() * 2)).forEach((enemy) => h.dealSkillDamage(ctx, enemy, 92, 'strategy'))
      } else if (phase === 2) {
        // 火: 敵1～2回へ156%の兵刃ダメージ
        const hits = 1 + Math.floor(ctx.rng() * 2)
        for (let i = 0; i < hits; i += 1) {
          const enemy = h.chooseTarget(ctx.enemies, ctx.rng, ctx)
          if (enemy) h.dealSkillDamage(ctx, enemy, 156, 'physical')
        }
      } else {
        // 山: 味方2～3人の被ダメージを低下
        h.weakest(ctx.allies, 2 + Math.floor(ctx.rng() * 2)).forEach((ally) => {
          ally.buffs.damageTaken = (ally.buffs.damageTaken ?? 0) - 22
        })
      }
      return true
    }

    case '無想掃討': {
      // 戦法タイプ: 能動
      if (!currentTarget) return true

      // 対象へ102%の兵刃ダメージ
      h.dealSkillDamage(ctx, currentTarget, 102, 'physical')

      // 50%で別対象にも同じダメージ
      const extra = h.aliveRandom(ctx.enemies, ctx.rng, ctx).find((enemy) => enemy.id !== currentTarget.id)
      if (extra && h.roll(ctx.rng, 0.5)) h.dealSkillDamage(ctx, extra, 102, 'physical')

      // 自身の通常攻撃ダメージを上げる
      ctx.caster.buffs.attackDamage = (ctx.caster.buffs.attackDamage ?? 0) + 50
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
      if (ctx.caster.role === 'main' && h.roll(ctx.rng, h.varNumber(ctx.skill, 'guard_chance', 0.8))) {
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
      // 同時に兵力割合が低い自軍2名を106%で回復する。
      h.weakest(ctx.allies, 2).forEach((ally) => h.healBySkill(ctx, ally, 106, 'strategy'))
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
      // 対象の与ダメージを30%低下。兵力50%超なら2ターン、それ以外は1ターン。
      h.addTimedModifier(ctx, currentTarget, 'damageDealt', -30, currentTarget.hp > currentTarget.maxHp * 0.5 ? 2 : 1)
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

    case '槍の鈴':
    case '臨時槍の鈴': {
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
      // 対象の与ダメージを42%低下。2ターン、最大4層。
      h.addTimedModifier(ctx, currentTarget, 'damageDealt', -toPercent(h.varNumber(ctx.skill, 'damage_debuff', 0.42)), 2, 4)
      return true
    }

    case '伝馬疾馳': {
      if (ctx.trigger === 'beforeAction') {
        // 戦法タイプ: 能動。友軍1名の武勇・速度を20上昇させ、行動前攻撃を予約する。
        const target = randomLiving(ctx, h, ctx.allies.filter((ally) => ally.id !== ctx.caster.id)) ?? ctx.caster
        h.addTimedModifier(ctx, target, 'val', h.varNumber(ctx.skill, 'valor_speed_buff', 20), 2)
        h.addTimedModifier(ctx, target, 'spd', h.varNumber(ctx.skill, 'valor_speed_buff', 20), 2)
        ctx.caster.specialState.postHorseTargetRole = roleCode(target)
        ctx.caster.specialState.postHorseUntil = ctx.turn + 1
        ctx.caster.specialState.postHorseTransferred = 0
        return true
      }
      if (ctx.trigger === 'allyBeforeAction') {
        const actor = ctx.eventSubject
        if (!actor || roleCode(actor) !== ctx.caster.specialState.postHorseTargetRole || (ctx.caster.specialState.postHorseUntil ?? 0) < ctx.turn) return true
        const target = randomLiving(ctx, h, ctx.enemies)
        if (target) h.dealSkillDamage({ ...ctx, caster: actor }, target, toPercent(h.varNumber(ctx.skill, 'damage_rate', 1.02)), 'physical')
        return true
      }
      // 持続終了時に未移動なら、別の友軍へ一度だけ効果を移す。
      if (
        ctx.trigger === 'turnStart'
        && (ctx.caster.specialState.postHorseUntil ?? 0) < ctx.turn
        && (ctx.caster.specialState.postHorseTransferred ?? 0) === 0
      ) {
        const oldRole = ctx.caster.specialState.postHorseTargetRole ?? 0
        const next = randomLiving(ctx, h, ctx.allies.filter((ally) => roleCode(ally) !== oldRole))
        if (next) {
          h.addTimedModifier(ctx, next, 'val', h.varNumber(ctx.skill, 'valor_speed_buff', 20), 1)
          h.addTimedModifier(ctx, next, 'spd', h.varNumber(ctx.skill, 'valor_speed_buff', 20), 1)
          ctx.caster.specialState.postHorseTargetRole = roleCode(next)
          ctx.caster.specialState.postHorseUntil = ctx.turn
        }
        ctx.caster.specialState.postHorseTransferred = 1
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
      // 65%で会心+15%（最大2層）と、別対象への98%追加攻撃。
      if (h.roll(ctx.rng, toChance(h.varNumber(ctx.skill, 'extra_trigger_chance', 0.65)))) {
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
    case '武田之赤備': {
      // 戦法タイプ: 受動
      // 戦闘中、10%→20%の会心を獲得
      // 自身・敵軍単体に兵刃ダメージ（ダメージ率138%）を与える
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 138, 'physical')
      })
      return true
    }
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
      // 戦闘開始後の3ターンの間、自軍複数（2人）が受ける兵刃及び計略ダメージを9%→18%から12%→24%（統率依存
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '新生': {
      // 戦法タイプ: 指揮
      // 戦闘中、友軍複数（2名）の与ダメージが7%→14%（統率依存）上昇 大将技：ターン終了時に敵軍部隊の総兵力が初めて35%→70%以下になる場合、自身は毎ターン行
      // 自軍全体（3名）を回復（回復率14%）する
      databaseTargets(ctx, h, 'heal').forEach((target) => {
        h.healBySkill(ctx, target, 14, databaseHealKind(ctx.skill))
      })
      return true
    }
    case '紅蓮の炎': {
      // 戦法タイプ: 能動
      // 1ターンの準備後、敵軍全体に計略ダメージ（ダメージ率52%→104%、知略依存）を与え、2ターンの間、対象に火傷状態を付与し、毎ターン持続ダメージを与える（ダメ
      // 敵軍全体（3名）に計略ダメージ（ダメージ率104%）を与える
      // 火傷状態を付与し、継続ダメージ（ダメージ率74%）を処理する
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 104, 'strategy')
      })
      applyDatabaseDot(ctx, h)
      return true
    }
    case '盤石耽々': {
      // 戦法タイプ: 受動
      // 戦闘中、自身の被ダメージが（4.5%→9%、統率依存）低下
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '百万一心': {
      // 戦法タイプ: 指揮
      // 戦闘中、敵軍複数（2名
      // 敵軍複数（2名）に計略ダメージ（ダメージ率15%）を与える
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 15, 'strategy')
      })
      return true
    }
    case '運勝の鼻': {
      // 戦法タイプ: 受動
      // 戦闘中、準備ターンが必要な固有能動戦法発動時、37.5%→75%の確率で準備時間を1ターンスキップ
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '水攻干計': {
      // 戦法タイプ: 能動
      // 1ターンの準備後、敵軍全体へ2ターンの水攻めと回復不可を付与する。
      databaseTargets(ctx, h, 'control').forEach((target) => {
        // 回復不可中は、戦法が発動しても実際の回復量が0になる。
        h.addControl(ctx, target, '回復不可', 2)

        // 水攻めは対象の行動開始時に、知略依存の98%計略ダメージを与える。
        // 同じ発動者・戦法による水攻めが残っている場合は重ねず、持続時間だけ2ターンへ更新する。
        const existing = target.timedStatuses.find((status) =>
          status.name === '水攻め'
          && status.sourceSkill === h.skillDisplayName(ctx.skill)
          && status.sourceActorId === ctx.caster.id)
        if (existing) {
          existing.turns = 2
          existing.dotRate = 98
          existing.dotType = 'strategy'
        } else {
          target.timedStatuses.push({
            name: '水攻め',
            turns: 2,
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
      // 敵軍複数（2名）に、以下のいずれか1種を付与（既存と異なる状態を優先、ダメージ率56%）
      // 火傷/水攻め/中毒/消沈/潰走状態を付与し、継続ダメージ（ダメージ率56%）を処理する
      applyDatabaseDot(ctx, h)
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
        if (ctx.caster.role === 'main') gainMilitaryGodCharge(ctx, h, '大将効果')
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
      // 戦闘中、自身の行動が終了するたびに20%→40%の確率（武勇依存）で自軍複数（2～3名）を回復（回復率27%→54%、武勇依存）
      // 自軍複数（2〜3名）を回復（回復率54%）する
      databaseTargets(ctx, h, 'heal').forEach((target) => {
        h.healBySkill(ctx, target, 54, databaseHealKind(ctx.skill))
      })
      return true
    }
    case '海道一': {
      // 戦法タイプ: 突撃
      // 通常攻撃後、射撃を2回行い、それぞれランダムな敵軍単体への兵刃ダメージ（ダメージ率134%）と計略ダメージ（ダメージ率134%・知略依存）
      // 敵軍単体に兵刃・計略ダメージ（ダメージ率134%）を与える
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 134, 'physical')
        h.dealSkillDamage(ctx, target, 134, 'strategy')
      })
      return true
    }
    case '独立独歩': {
      // 戦法タイプ: 受動
      // 戦闘中、自身の突撃戦法の発動確率が8.5%→17%増加
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '鬼若子': {
      // 戦法タイプ: 指揮
      // 4ターン目まで、自軍複数（2～3名）は25%→50%の連撃を獲得し、統率が9→18（統率依存）増加 大将技：対象人数増加の確率が25%増加
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '一領具足': {
      // 戦法タイプ: 指揮
      // 最初の2ターンの間、自軍全体の兵力損害が6%→12%（武勇依存）低下
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '電光雷轟': {
      // 戦法タイプ: 突撃
      // 通常攻撃後、対象とランダムな敵単体に麻痺付与（2ターン、毎ターン30%で行動不能）
      // 敵軍単体に兵刃ダメージ（ダメージ率60%）を与える
      // 麻痺・威圧を付与する
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 60, 'physical')
      })
      databaseTargets(ctx, h, 'control').forEach((target) => {
        ["麻痺","威圧"].forEach((name) => {
          if (h.roll(ctx.rng, chanceFrom(ctx.skill, ['status_chance', 'debuff_rate', 'random_rate', 'pressure_rate', 'fatigue_rate'], 1))) {
            h.addControl(ctx, target, name, durationFromDatabase(ctx.skill, 1))
          }
        })
      })
      return true
    }
    case '霹靂一撃': {
      // 戦法タイプ: 能動
      // 敵軍単体に114%→228%の兵刃ダメージを与え、2ターンの間麻痺（毎ターン30%の確率で行動不能）を付与
      // 敵軍単体に兵刃ダメージ（ダメージ率228%）を与える
      // 麻痺を付与する
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 228, 'physical')
      })
      databaseTargets(ctx, h, 'control').forEach((target) => {
        ["麻痺"].forEach((name) => {
          if (h.roll(ctx.rng, chanceFrom(ctx.skill, ['status_chance', 'debuff_rate', 'random_rate', 'pressure_rate', 'fatigue_rate'], 1))) {
            h.addControl(ctx, target, name, durationFromDatabase(ctx.skill, 1))
          }
        })
      })
      return true
    }
    case '梟雄の計': {
      // 戦法タイプ: 能動
      // 1ターンの準備後、敵軍複数（2～3名）に計略ダメージ（ダメージ率64%→128%、知略依存）
      // 敵軍複数（2〜3名）に計略ダメージ（ダメージ率128%）を与える
      // 混乱・疲弊を付与する
      // 火傷/中毒状態を付与し、継続ダメージ（ダメージ率96%）を処理する
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 128, 'strategy')
      })
      databaseTargets(ctx, h, 'control').forEach((target) => {
        ["混乱","疲弊"].forEach((name) => {
          if (h.roll(ctx.rng, chanceFrom(ctx.skill, ['status_chance', 'debuff_rate', 'random_rate', 'pressure_rate', 'fatigue_rate'], 1))) {
            h.addControl(ctx, target, name, durationFromDatabase(ctx.skill, 1))
          }
        })
      })
      applyDatabaseDot(ctx, h)
      return true
    }
    case '一行三昧': {
      // 戦法タイプ: 受動
      // 戦闘中、自身の能動戦法の発動確率が7%→14%増加
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '地黄八幡': {
      // 戦法タイプ: 能動
      // 1ターンの準備後、敵軍全体に兵刃ダメージ（ダメージ率87%→174%）
      // 敵軍全体（3名）に兵刃ダメージ（ダメージ率174%）を与える
      // 無策・封撃を付与する
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 174, 'physical')
      })
      databaseTargets(ctx, h, 'control').forEach((target) => {
        ["無策","封撃"].forEach((name) => {
          if (h.roll(ctx.rng, chanceFrom(ctx.skill, ['status_chance', 'debuff_rate', 'random_rate', 'pressure_rate', 'fatigue_rate'], 1))) {
            h.addControl(ctx, target, name, durationFromDatabase(ctx.skill, 1))
          }
        })
      })
      return true
    }
    case '千軍辟易': {
      // 戦法タイプ: 能動
      // 1ターンの間、敵軍全体に53%→106%の兵刃ダメージ
      // 敵軍全体（3名）に兵刃ダメージ（ダメージ率106%）を与える
      // 無策・封撃・威圧を付与する
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 106, 'physical')
      })
      databaseTargets(ctx, h, 'control').forEach((target) => {
        ["無策","封撃","威圧"].forEach((name) => {
          if (h.roll(ctx.rng, chanceFrom(ctx.skill, ['status_chance', 'debuff_rate', 'random_rate', 'pressure_rate', 'fatigue_rate'], 1))) {
            h.addControl(ctx, target, name, durationFromDatabase(ctx.skill, 1))
          }
        })
      })
      return true
    }
    case '一切皆空': {
      // 戦法タイプ: 受動
      // 2ターン目以降、30%の確率（毎ターン発動の確率が40%増加）で一揆を発動
      // 敵軍複数（2〜3名）を回復（回復率72%）する
      databaseTargets(ctx, h, 'heal').forEach((target) => {
        h.healBySkill(ctx, target, 72, databaseHealKind(ctx.skill))
      })
      return true
    }
    case '古今独歩': {
      // 戦法タイプ: 受動
      // 通常攻撃を受けると24%→48%の確率で攻撃者に兵刃ダメージ（ダメージ率35%→70%、通常攻撃効果と突撃を発動可能）を与え、2%→4%の離反を獲得（最大8回ま
      // 敵軍単体に兵刃ダメージ（ダメージ率48%）を与える
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 48, 'physical')
      })
      return true
    }
    case '血戦奮闘': {
      // 戦法タイプ: 受動
      // 自身の被回復効果が30%→60%上昇、さらに20%→40%の会心を獲得
      // 自分を回復（回復率60%）する
      databaseTargets(ctx, h, 'heal').forEach((target) => {
        h.healBySkill(ctx, target, 60, databaseHealKind(ctx.skill))
      })
      return true
    }
    case '冷徹無情': {
      // 戦法タイプ: 能動
      // 敵軍複数（2名）に兵刃ダメージ（ダメージ率71%→142%、さらに対象の兵力損失に応じて最大25%→50%増加）
      // 敵軍複数（2名）に兵刃ダメージ（ダメージ率142%）を与える
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 142, 'physical')
      })
      return true
    }
    case '理非曲直': {
      // 戦法タイプ: 突撃
      // 通常攻撃後、対象にもう一度兵刃ダメージ（ダメージ率192%）を与え、1ターンの間混乱を付与（攻撃と戦法の発動対象をランダムに選択）
      // 敵軍単体に兵刃ダメージ（ダメージ率192%）を与える
      // 混乱を付与する
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 192, 'physical')
      })
      databaseTargets(ctx, h, 'control').forEach((target) => {
        ["混乱"].forEach((name) => {
          if (h.roll(ctx.rng, chanceFrom(ctx.skill, ['status_chance', 'debuff_rate', 'random_rate', 'pressure_rate', 'fatigue_rate'], 1))) {
            h.addControl(ctx, target, name, durationFromDatabase(ctx.skill, 1))
          }
        })
      })
      return true
    }
    case '破陣乱舞': {
      // 戦法タイプ: 能動
      // 1ターンの間、自身と武勇が最も高い友軍単体が23%→46%（武勇依存）の破陣を獲得
      // 自軍複数（2名）に兵刃ダメージ（ダメージ率44%）を与える
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 44, 'physical')
      })
      return true
    }
    case '風姿綽約': {
      // 戦法タイプ: 指揮
      // 戦闘中、友軍複数（2人）の武勇を2%→4%上昇（知略依存）、毎ターン1回重複、最大4層まで重ね掛け可能
      // 無策・封撃・混乱・疲弊を付与する
      databaseTargets(ctx, h, 'control').forEach((target) => {
        ["無策","封撃","混乱","疲弊"].forEach((name) => {
          if (h.roll(ctx.rng, chanceFrom(ctx.skill, ['status_chance', 'debuff_rate', 'random_rate', 'pressure_rate', 'fatigue_rate'], 1))) {
            h.addControl(ctx, target, name, durationFromDatabase(ctx.skill, 1))
          }
        })
      })
      return true
    }
    case '同気連枝': {
      // 戦法タイプ: 指揮
      // 戦闘中、友軍複数が通常攻撃後に2.5→5のメイン属性を獲得（知略依存、最大5回まで重ねがけ可能）
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '末世の道者': {
      // 戦法タイプ: 指揮
      // 戦闘中、知略の最も高い自軍武将の計略ダメージを7%→14%（統率依存）増加させ、7%→14%の心攻状態を付与する
      // 自軍全体（3名）に計略ダメージ（ダメージ率14%）を与える
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 14, 'strategy')
      })
      return true
    }
    case '静動自在': {
      // 戦法タイプ: 能動
      // 自身より行動順が遅い自軍単体を選択し、洞察と先攻状態を付与し、2ターン持続
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '豊後の戦陣': {
      // 戦法タイプ: 受動
      // 戦闘中、自身が洞察状態を獲得し、自身の最も高い属性に応じた強化効果を獲得する（その属性に依存） 武勇：兵刃ダメージが6%→12%上昇
      // 自分に兵刃・計略ダメージ（ダメージ率12%）を与える
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 12, 'physical')
        h.dealSkillDamage(ctx, target, 12, 'strategy')
      })
      return true
    }
    case '天下御免': {
      // 戦法タイプ: 突撃
      // 通常攻撃後、対象に追加で兵刃ダメージ（ダメージ率188%）を与える
      // ?に兵刃ダメージ（ダメージ率188%）を与える
      // 混乱を付与する
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 188, 'physical')
      })
      databaseTargets(ctx, h, 'control').forEach((target) => {
        ["混乱"].forEach((name) => {
          if (h.roll(ctx.rng, chanceFrom(ctx.skill, ['status_chance', 'debuff_rate', 'random_rate', 'pressure_rate', 'fatigue_rate'], 1))) {
            h.addControl(ctx, target, name, durationFromDatabase(ctx.skill, 1))
          }
        })
      })
      return true
    }
    case '相模の獅子': {
      // 戦法タイプ: 能動
      // 2ターンの間、自軍複数（2～3名）に42.5%→85%の鉄壁（ダメージを無効化）を2回分付与
      // 自軍複数（2〜3名）に計略ダメージ（ダメージ率85%）を与える
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 85, 'strategy')
      })
      return true
    }
    case '所領役帳': {
      // 戦法タイプ: 能動
      // ランダムな自軍単体を回復し（回復率106%→212%、知略依存）、2ターンの間、最も兵力が少ない自軍単体に回生を付与し、ダメージを受けるたびに25%→50%の確
      // 自軍単体を回復（回復率212%）する
      databaseTargets(ctx, h, 'heal').forEach((target) => {
        h.healBySkill(ctx, target, 212, databaseHealKind(ctx.skill))
      })
      return true
    }
    case '鬼美濃': {
      // 戦法タイプ: 受動
      // ダメージを受けると、17.5%→35%の確率で自身の弱体化効果を浄化し、自身の兵力を回復（回復率56%→112%、統率依存）
      // 自分を回復（回復率112%）する
      databaseTargets(ctx, h, 'heal').forEach((target) => {
        h.healBySkill(ctx, target, 112, databaseHealKind(ctx.skill))
      })
      return true
    }
    case '以戦養戦': {
      // 戦法タイプ: 受動
      // 戦闘中、自身は12.5%→25%の離反（兵刃ダメージを与えた際にダメージ量に応じて兵力回復）を獲得
      // 自分に兵刃ダメージ（ダメージ率25%）を与える
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 25, 'physical')
      })
      return true
    }
    case 'かかれ柴田': {
      // 戦法タイプ: 能動
      // 自身の弱体化効果を2個浄化し、敵軍全体に兵刃ダメージ（ダメージ率77%→154%）
      // 敵軍全体（3名）に兵刃ダメージ（ダメージ率154%）を与える
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 154, 'physical')
      })
      return true
    }
    case '掃疑平乱': {
      // 戦法タイプ: 能動
      // 2ターンの間、自身と友軍単体が39%→78%の乱舞を獲得（速度依存）
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '槍の又左': {
      // 戦法タイプ: 受動
      // 戦闘中、能動戦法を発動するたびに、45%→90%の確率で、次のターンの行動時までに自身が1回分の鉄壁を獲得（すでにこの戦法で付与された場合は回数増加）
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '破竹の勢い': {
      // 戦法タイプ: 受動
      // 戦闘中、自身が35%→70%の会心を獲得し、会心ダメージ率が15%→30%増加
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '気勢衝天': {
      // 戦法タイプ: 指揮
      // 4ターン目まで、自身の行動時に80%の確率で1ターンの間、武勇が最も高い敵軍武将の兵刃与ダメージが15%→30%低下（武勇依存）、知略が最も高い敵軍武将の計略与
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '啄木鳥': {
      // 戦法タイプ: 能動
      // 敵軍単体に計略ダメージ（ダメージ率78%→156%、知略依存）を与え、武勇が最も高い自軍単体が同じ対象に兵刃ダメージ（ダメージ率80%→160%、武勇と速度依存
      // 敵軍単体に兵刃・計略ダメージ（ダメージ率156%）を与える
      // 威圧を付与する
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 156, 'physical')
        h.dealSkillDamage(ctx, target, 156, 'strategy')
      })
      databaseTargets(ctx, h, 'control').forEach((target) => {
        ["威圧"].forEach((name) => {
          if (h.roll(ctx.rng, chanceFrom(ctx.skill, ['status_chance', 'debuff_rate', 'random_rate', 'pressure_rate', 'fatigue_rate'], 1))) {
            h.addControl(ctx, target, name, durationFromDatabase(ctx.skill, 1))
          }
        })
      })
      return true
    }
    case '死灰復然': {
      // 戦法タイプ: 能動
      // 最も兵力が少ない自軍単体を回復（回復率138%→276%、知略依存）
      // 自軍単体を回復（回復率276%）する
      databaseTargets(ctx, h, 'heal').forEach((target) => {
        h.healBySkill(ctx, target, 276, databaseHealKind(ctx.skill))
      })
      return true
    }
    case '十面埋伏': {
      // 戦法タイプ: 能動
      // 1ターンの準備後、2ターンの間、敵軍全体の被ダメージが9%→18%（知略依存）上昇
      // 敵軍全体（3名）に計略ダメージ（ダメージ率18%）を与える
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 18, 'strategy')
      })
      return true
    }
    case '大智不智': {
      // 戦法タイプ: 能動
      // 敵軍複数（2名）に消沈を付与し、2ターンの間、毎ターン持続ダメージ（ダメージ率52%→104%、知略依存）を与え、さらに対象の兵刃被ダメージが10%→20%上昇
      // 消沈状態を付与し、継続ダメージ（ダメージ率104%）を処理する
      applyDatabaseDot(ctx, h)
      return true
    }
    case '東国無双の麗': {
      // 戦法タイプ: 受動
      // 戦闘中、自身は連撃（1ターンに2回通常攻撃）を獲得し、自身の武勇が3→30増加
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '前後挟撃': {
      // 戦法タイプ: 能動
      // 1ターンの間、自身と友軍単体は連撃（1ターンに2回通常攻撃）を獲得
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '沈魚落雁': {
      // 戦法タイプ: 受動
      // 自身が通常攻撃を受けた際、18%→36%の確率で1ターンの間、攻撃者に以下の状態を1つ付与：混乱（攻撃と戦法の目標ランダムに選択）、無策（能動戦法が発動不能）、
      // 無策・混乱・疲弊を付与する
      databaseTargets(ctx, h, 'control').forEach((target) => {
        ["無策","混乱","疲弊"].forEach((name) => {
          if (h.roll(ctx.rng, chanceFrom(ctx.skill, ['status_chance', 'debuff_rate', 'random_rate', 'pressure_rate', 'fatigue_rate'], 1))) {
            h.addControl(ctx, target, name, durationFromDatabase(ctx.skill, 1))
          }
        })
      })
      return true
    }
    case '帰蝶の舞': {
      // 戦法タイプ: 受動
      // 戦闘中、奇数ターンに20%→40%の確率（知略依存）で1ターンの間、敵軍複数（2名）の統率と知略が11%→22%（知略依存）低下
      // 混乱を付与する
      databaseTargets(ctx, h, 'control').forEach((target) => {
        ["混乱"].forEach((name) => {
          if (h.roll(ctx.rng, chanceFrom(ctx.skill, ['status_chance', 'debuff_rate', 'random_rate', 'pressure_rate', 'fatigue_rate'], 1))) {
            h.addControl(ctx, target, name, durationFromDatabase(ctx.skill, 1))
          }
        })
      })
      return true
    }
    case '五里霧中': {
      // 戦法タイプ: 能動
      // 1ターンの準備後、2ターンの間、敵軍複数（2名）に混乱（攻撃と戦法の発動対象をランダムに選択）を付与
      // 混乱を付与する
      databaseTargets(ctx, h, 'control').forEach((target) => {
        ["混乱"].forEach((name) => {
          if (h.roll(ctx.rng, chanceFrom(ctx.skill, ['status_chance', 'debuff_rate', 'random_rate', 'pressure_rate', 'fatigue_rate'], 1))) {
            h.addControl(ctx, target, name, durationFromDatabase(ctx.skill, 1))
          }
        })
      })
      return true
    }
    case '越後流軍学': {
      // 戦法タイプ: 指揮
      // 戦闘中、自身の能動戦法の発動確率が10%→20%増加
      // 無策・封撃・疲弊・威圧を付与する
      databaseTargets(ctx, h, 'control').forEach((target) => {
        ["無策","封撃","疲弊","威圧"].forEach((name) => {
          if (h.roll(ctx.rng, chanceFrom(ctx.skill, ['status_chance', 'debuff_rate', 'random_rate', 'pressure_rate', 'fatigue_rate'], 1))) {
            h.addControl(ctx, target, name, durationFromDatabase(ctx.skill, 1))
          }
        })
      })
      return true
    }
    case '深慮遠謀': {
      // 戦法タイプ: 指揮
      // 3ターン目まで、敵軍複数（2名）の与ダメージが14%→28%低下（知略依存）
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '百戦錬磨': {
      // 戦法タイプ: 受動
      // 戦闘中、自身の武勇・知略・統率・速度が21→42増加
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '奇謀独断': {
      // 戦法タイプ: 能動
      // 1ターンの準備後、2ターンの間、敵軍複数（2名）に無策（能動戦法発動不可）を付与
      // 無策を付与する
      databaseTargets(ctx, h, 'control').forEach((target) => {
        ["無策"].forEach((name) => {
          if (h.roll(ctx.rng, chanceFrom(ctx.skill, ['status_chance', 'debuff_rate', 'random_rate', 'pressure_rate', 'fatigue_rate'], 1))) {
            h.addControl(ctx, target, name, durationFromDatabase(ctx.skill, 1))
          }
        })
      })
      return true
    }
    case '剛毅果断': {
      // 戦法タイプ: 能動
      // 3ターンの間、自身の突撃戦法の与ダメージが17.5%→35%上昇、能動戦法の被ダメージが10%→20%低下（1ターン後に再発動可能）
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '甲山猛虎': {
      // 戦法タイプ: 能動
      // 敵軍複数（2名）に兵刃ダメージ（ダメージ率48%→96%）を与え、1ターンの間封撃を付与
      // 敵軍複数（2名）に兵刃ダメージ（ダメージ率96%）を与える
      // 封撃を付与する
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 96, 'physical')
      })
      databaseTargets(ctx, h, 'control').forEach((target) => {
        ["封撃"].forEach((name) => {
          if (h.roll(ctx.rng, chanceFrom(ctx.skill, ['status_chance', 'debuff_rate', 'random_rate', 'pressure_rate', 'fatigue_rate'], 1))) {
            h.addControl(ctx, target, name, durationFromDatabase(ctx.skill, 1))
          }
        })
      })
      return true
    }
    case '陣前無我': {
      // 戦法タイプ: 能動
      // 自身の兵力が自軍の最低値でない場合、1ターンの間、敵軍複数（2～3名）に挑発と牽制（強制的に敵軍の通常攻撃と戦法の発動対象を自身に固定）を付与
      // 挑発を付与する
      databaseTargets(ctx, h, 'control').forEach((target) => {
        ["挑発"].forEach((name) => {
          if (h.roll(ctx.rng, chanceFrom(ctx.skill, ['status_chance', 'debuff_rate', 'random_rate', 'pressure_rate', 'fatigue_rate'], 1))) {
            h.addControl(ctx, target, name, durationFromDatabase(ctx.skill, 1))
          }
        })
      })
      return true
    }
    case '罵詈雑言': {
      // 戦法タイプ: 指揮
      // 3ターン目まで、敵軍複数（2～3名）に挑発（毎ターン45%→90%の確率で強制的に自身を通常攻撃の対象に固定）を付与
      // 挑発を付与する
      databaseTargets(ctx, h, 'control').forEach((target) => {
        ["挑発"].forEach((name) => {
          if (h.roll(ctx.rng, chanceFrom(ctx.skill, ['status_chance', 'debuff_rate', 'random_rate', 'pressure_rate', 'fatigue_rate'], 1))) {
            h.addControl(ctx, target, name, durationFromDatabase(ctx.skill, 1))
          }
        })
      })
      return true
    }
    case '戦意消沈': {
      // 戦法タイプ: 指揮
      // 敵軍複数（2名）に対し、1ターン目に1名へ、3ターン目にもう1名へ、疲弊を付与（2ターンの間、与ダメージを25％→50％の確率で無効）
      // 疲弊を付与する
      databaseTargets(ctx, h, 'control').forEach((target) => {
        ["疲弊"].forEach((name) => {
          if (h.roll(ctx.rng, chanceFrom(ctx.skill, ['status_chance', 'debuff_rate', 'random_rate', 'pressure_rate', 'fatigue_rate'], 1))) {
            h.addControl(ctx, target, name, durationFromDatabase(ctx.skill, 1))
          }
        })
      })
      return true
    }
    case '湖水渡り': {
      // 戦法タイプ: 能動
      // 2ターンの間、自身と友軍単体が奇策を65%獲得
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '内助の賢': {
      // 戦法タイプ: 指揮
      // 戦闘中、友軍複数（2名）が継続状態を付与する際、その継続時間が25%→50%の確率（知略依存）で1ターン増加
      // 友軍複数（2名）を回復（回復率92%）する
      databaseTargets(ctx, h, 'heal').forEach((target) => {
        h.healBySkill(ctx, target, 92, databaseHealKind(ctx.skill))
      })
      return true
    }
    case '帰還の凱歌': {
      // 戦法タイプ: 能動
      // 自軍複数（2名）の兵力を一定量回復（回復率66%→132%、知略依存）
      // 自軍複数（2名）を回復（回復率152%）する
      databaseTargets(ctx, h, 'heal').forEach((target) => {
        h.healBySkill(ctx, target, 152, databaseHealKind(ctx.skill))
      })
      return true
    }
    case '七本槍筆頭': {
      // 戦法タイプ: 受動
      // 戦闘中、自身は46%→92%の乱舞（通常攻撃時、対象部隊の他武将へもダメージ）を獲得
      // 自分に兵刃ダメージ（ダメージ率92%）を与える
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 92, 'physical')
      })
      return true
    }
    case '勇志不抜': {
      // 戦法タイプ: 能動
      // 2ターンの間、友軍複数（2名）の被ダメージの20%を肩代りし、自身の武勇が37.5→75増加し、12%→24%の離反を獲得
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '尼御台': {
      // 戦法タイプ: 指揮
      // 2ターン目まで、自軍大将は洞察を獲得し、被ダメージが9%→18%（知略依存）低下
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '信義貫徹': {
      // 戦法タイプ: 能動
      // 1ターンの間、7.5%→15%の離反（兵刃ダメージを与えた際にダメージ量に応じて兵力回復）を獲得し、敵軍複数（2名）に兵刃ダメージ（ダメージ率78%→156%）
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '金鼓連天': {
      // 戦法タイプ: 能動
      // 3ターンの間、自身の能動戦法与ダメージが24%→48%上昇、突撃戦法被ダメージが12.5%→25%低下（1ターン後に再発動可能）
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '旋乾転坤': {
      // 戦法タイプ: 能動
      // 敵軍複数（2～3名）に計略ダメージ（ダメージ率63%→126%、知略依存）を与え、恐慌を付与
      // 敵軍複数（2〜3名）に計略ダメージ（ダメージ率126%）を与える
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 126, 'strategy')
      })
      return true
    }
    case '怪力無双': {
      // 戦法タイプ: 能動
      // 2ターンの準備後、敵軍複数（2～3名）に大量の兵刃ダメージ（ダメージ率166.5%→333%）
      // 敵軍複数（2〜3名）に兵刃ダメージ（ダメージ率333%）を与える
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 333, 'physical')
      })
      return true
    }
    case '積水成淵': {
      // 戦法タイプ: 能動
      // 1ターンの準備後、自軍複数（2～3名）に11%→22%の心攻（計略ダメージを与えた際にダメージ量に応じて兵力回復）を付与
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '諸行無常': {
      // 戦法タイプ: 指揮
      // 戦闘開始後の3ターンの間、自軍全体の与ダメージを12%→24%（知略依存）上昇させる
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '先陣鼓舞': {
      // 戦法タイプ: 能動
      // 敵軍単体に兵刃ダメージ （ダメージ率121%→242%）を与え、さらに自軍単体の固有戦法発動確率を8%→16%増加させる
      // 敵軍単体に兵刃ダメージ（ダメージ率242%）を与える
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 242, 'physical')
      })
      return true
    }
    case '斗星北天': {
      // 戦法タイプ: 能動
      // 2ターンの間、自身は洞察を獲得し、統率と知略が25→50増加し、敵軍複数（2～3名）に牽制（37.5%→75%の確率で自身を敵軍戦法の発動対象に固定、知略依存）
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '文武両道': {
      // 戦法タイプ: 受動
      // 戦闘中、自身は計略ダメージを与えるたびに武勇が15→30増加（最大5回まで重ねがけ可能）、兵刃ダメージを与えるたびに知略が15→30増加（最大5回まで重ねがけ可
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '一心一徳': {
      // 戦法タイプ: 能動
      // 自軍複数（2～3名）を回復し（回復率30%→60%、知略依存）、1ターンの間休養（毎ターン兵力回復）を付与（回復率38%→76%、知略依存）
      // 自軍複数（2〜3名）を回復（回復率60%）する
      databaseTargets(ctx, h, 'heal').forEach((target) => {
        h.healBySkill(ctx, target, 60, databaseHealKind(ctx.skill))
      })
      return true
    }
    case '非常の器': {
      // 戦法タイプ: 指揮
      // 2ターン目まで、自軍全体が17.5%→35%の回避（ダメージを無効化）を獲得
      // 自軍全体（3名）を回復（回復率66%）する
      databaseTargets(ctx, h, 'heal').forEach((target) => {
        h.healBySkill(ctx, target, 66, databaseHealKind(ctx.skill))
      })
      return true
    }
    case '戦意崩壊': {
      // 戦法タイプ: 突撃
      // 通常攻撃後、2ターンの間、対象の統率と知略が65低下し、自軍大将に2回分の鉄壁（被ダメージ無効）を付与
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '耐苦鍛錬': {
      // 戦法タイプ: 指揮
      // 戦闘中、自身が通常攻撃を受けた際に自身の武勇と統率が7→14増加（5回まで重ねがけ可能）
      // 自分に兵刃ダメージ（ダメージ率160%）を与える
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 160, 'physical')
      })
      return true
    }
    case '按甲休兵': {
      // 戦法タイプ: 受動
      // 戦闘中、自身は休養（毎ターン兵力回復、回復率70%→140%）を獲得
      // 自分を回復（回復率140%）する
      databaseTargets(ctx, h, 'heal').forEach((target) => {
        h.healBySkill(ctx, target, 140, databaseHealKind(ctx.skill))
      })
      return true
    }
    case '密報通暁': {
      // 戦法タイプ: 能動
      // 1ターンの準備後、2ターンの間、友軍単体が洞察を獲得し、敵軍単体に撹乱（能動戦法発動時に計略ダメージ、ダメージ率152%、知略依存）を付与
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '気炎万丈': {
      // 戦法タイプ: 指揮
      // 3ターン目まで、敵軍複数（2名）に封撃を付与し、毎ターン35%→70%の確率で通常攻撃不可（毎ターン発動確率が7%→14%減少）
      // 封撃を付与する
      databaseTargets(ctx, h, 'control').forEach((target) => {
        ["封撃"].forEach((name) => {
          if (h.roll(ctx.rng, chanceFrom(ctx.skill, ['status_chance', 'debuff_rate', 'random_rate', 'pressure_rate', 'fatigue_rate'], 1))) {
            h.addControl(ctx, target, name, durationFromDatabase(ctx.skill, 1))
          }
        })
      })
      return true
    }
    case '夜叉美濃': {
      // 戦法タイプ: 受動
      // 戦闘中、自身の被ダメージが17.5%→35%低下（敵軍が騎兵・鉄砲部隊の場合は25%→50%）
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '一徹の意志': {
      // 戦法タイプ: 能動
      // 2ターンの間、自身の統率が150上昇し、武勇が最も高い敵軍単体に挑発・牽制を付与し、強制的に敵軍の通常攻撃と戦法の発動対象を自身に固定
      // 挑発を付与する
      databaseTargets(ctx, h, 'control').forEach((target) => {
        ["挑発"].forEach((name) => {
          if (h.roll(ctx.rng, chanceFrom(ctx.skill, ['status_chance', 'debuff_rate', 'random_rate', 'pressure_rate', 'fatigue_rate'], 1))) {
            h.addControl(ctx, target, name, durationFromDatabase(ctx.skill, 1))
          }
        })
      })
      return true
    }
    case '攻めの三左': {
      // 戦法タイプ: 能動
      // 敵軍単体に兵刃ダメージ（ダメージ率71%→142%）
      // 敵軍単体に兵刃ダメージ（ダメージ率142%）を与える
      // 敵軍単体を回復（回復率68%）する
      // 潰走状態を付与し、継続ダメージ（ダメージ率72%）を処理する
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 142, 'physical')
      })
      databaseTargets(ctx, h, 'heal').forEach((target) => {
        h.healBySkill(ctx, target, 68, databaseHealKind(ctx.skill))
      })
      applyDatabaseDot(ctx, h)
      return true
    }
    case '嚢沙之計': {
      // 戦法タイプ: 能動
      // 2ターンの間、敵軍複数（2名）に水攻めを付与し、毎ターン持続ダメージ（ダメージ率51%→102%、知略依存）を与え、さらに対象の計略被ダメージが15%→30%上
      // 水攻め状態を付与し、継続ダメージ（ダメージ率102%）を処理する
      applyDatabaseDot(ctx, h)
      return true
    }
    case '仏の高力': {
      // 戦法タイプ: 能動
      // 2ターンの間、友軍単体の能動戦法の発動率が4.5%→9%（統率依存）増加
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '綱紀粛正': {
      // 戦法タイプ: 能動
      // 1ターンの準備後、敵軍単体に計略ダメージ（ダメージ率196%、知略依存）
      // 疲弊・威圧を付与する
      databaseTargets(ctx, h, 'control').forEach((target) => {
        ["疲弊","威圧"].forEach((name) => {
          if (h.roll(ctx.rng, chanceFrom(ctx.skill, ['status_chance', 'debuff_rate', 'random_rate', 'pressure_rate', 'fatigue_rate'], 1))) {
            h.addControl(ctx, target, name, durationFromDatabase(ctx.skill, 1))
          }
        })
      })
      return true
    }
    case '傲岸不遜': {
      // 戦法タイプ: 能動
      // 敵軍複数（2名）に兵刃ダメージ（ダメージ率62%→124%）を与え、2ターンの間、挑発（敵軍の突撃戦法ダメージが15%→30%減少、統率依存）を付与 大将技：追
      // 敵軍複数（2名）に兵刃ダメージ（ダメージ率118%）を与える
      // 挑発を付与する
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 118, 'physical')
      })
      databaseTargets(ctx, h, 'control').forEach((target) => {
        ["挑発"].forEach((name) => {
          if (h.roll(ctx.rng, chanceFrom(ctx.skill, ['status_chance', 'debuff_rate', 'random_rate', 'pressure_rate', 'fatigue_rate'], 1))) {
            h.addControl(ctx, target, name, durationFromDatabase(ctx.skill, 1))
          }
        })
      })
      return true
    }
    case '満ちゆく月': {
      // 戦法タイプ: 能動
      // 1ターンの準備後、4ターンの間、敵軍単体に潰走（ダメージ率108%、潰走を持っていない敵軍単体が優先）を付与
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '鬼十河': {
      // 戦法タイプ: 突撃
      // 通常攻撃後、対象に兵刃ダメージ（ダメージ率188%）
      // 敵軍単体に兵刃ダメージ（ダメージ率188%）を与える
      // 威圧を付与する
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 188, 'physical')
      })
      databaseTargets(ctx, h, 'control').forEach((target) => {
        ["威圧"].forEach((name) => {
          if (h.roll(ctx.rng, chanceFrom(ctx.skill, ['status_chance', 'debuff_rate', 'random_rate', 'pressure_rate', 'fatigue_rate'], 1))) {
            h.addControl(ctx, target, name, durationFromDatabase(ctx.skill, 1))
          }
        })
      })
      return true
    }
    case '津田流砲術': {
      // 戦法タイプ: 能動
      // 敵軍単体に計略ダメージ（ダメージ率94%→188%、知略依存）
      // 敵軍単体に計略ダメージ（ダメージ率188%）を与える
      // 無策・封撃・混乱・威圧を付与する
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 188, 'strategy')
      })
      databaseTargets(ctx, h, 'control').forEach((target) => {
        ["無策","封撃","混乱","威圧"].forEach((name) => {
          if (h.roll(ctx.rng, chanceFrom(ctx.skill, ['status_chance', 'debuff_rate', 'random_rate', 'pressure_rate', 'fatigue_rate'], 1))) {
            h.addControl(ctx, target, name, durationFromDatabase(ctx.skill, 1))
          }
        })
      })
      return true
    }
    case '仁者の沈勇': {
      // 戦法タイプ: 突撃
      // 通常攻撃後、敵軍単体に計略ダメージ（ダメージ率92%→184%、知略依存）を与え、70%の確率で友軍単体にも同時に同対象への計略ダメージ（ダメージ率77%→15
      // 敵軍単体に計略ダメージ（ダメージ率184%）を与える
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 184, 'strategy')
      })
      return true
    }
    case '諏訪の光': {
      // 戦法タイプ: 能動
      // 自軍複数（2名）の弱体化効果を2個浄化し、2ターンの間、対象の武勇と統率が36増加
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '笹の才蔵': {
      // 戦法タイプ: 能動
      // 1ターンの準備後、敵軍単体に大量の兵刃ダメージ（ダメージ率261%→522%）を与え、3ターンの間回復不可（兵力を回復不能）を付与
      // 敵軍単体に兵刃ダメージ（ダメージ率522%）を与える
      // 回復不可を付与する
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 522, 'physical')
      })
      databaseTargets(ctx, h, 'control').forEach((target) => {
        ["回復不可"].forEach((name) => {
          if (h.roll(ctx.rng, chanceFrom(ctx.skill, ['status_chance', 'debuff_rate', 'random_rate', 'pressure_rate', 'fatigue_rate'], 1))) {
            h.addControl(ctx, target, name, durationFromDatabase(ctx.skill, 1))
          }
        })
      })
      return true
    }
    case '落花啼鳥': {
      // 戦法タイプ: 能動
      // 1ターンの準備後、友軍複数（2名）が先攻を獲得し、能動戦法与ダメージが37.5%→75%上昇する（2ターン持続） 大将技：与ダメージ基本増加量が42.5%→85
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '夢幻泡影': {
      // 戦法タイプ: 能動
      // 自軍複数（2名）を回復し（回復率59%→118%、知略依存）、2ターンの間、対象の与ダメージが7.5%→15%上昇（知略依存）
      // 自軍複数（2名）を回復（回復率118%）する
      databaseTargets(ctx, h, 'heal').forEach((target) => {
        h.healBySkill(ctx, target, 118, databaseHealKind(ctx.skill))
      })
      return true
    }
    case '全力戦闘': {
      // 戦法タイプ: 受動
      // 5ターン目以降、戦闘終了まで自身が35%→70%の連撃（1ターンに2回通常攻撃）を獲得
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '荒切': {
      // 戦法タイプ: 突撃
      // 通常攻撃後、1ターンの間連撃（1ターンに2回通常攻撃）を獲得
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '奮戦': {
      // 戦法タイプ: 能動
      // 自身に連撃（1ターンに2回通常攻撃）を付与するが、1ターンの間与ダメージが15%低下
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '生死一顧': {
      // 戦法タイプ: 能動
      // 敵軍全体に計略ダメージ（ダメージ率28%→56%、知略依存）を与え、1ターンの間挑発（強制的に自身を通常攻撃の対象に固定）を付与
      // 敵軍全体に計略ダメージ（ダメージ率56%）を与える
      // 挑発を付与する
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 56, 'strategy')
      })
      databaseTargets(ctx, h, 'control').forEach((target) => {
        ["挑発"].forEach((name) => {
          if (h.roll(ctx.rng, chanceFrom(ctx.skill, ['status_chance', 'debuff_rate', 'random_rate', 'pressure_rate', 'fatigue_rate'], 1))) {
            h.addControl(ctx, target, name, durationFromDatabase(ctx.skill, 1))
          }
        })
      })
      return true
    }
    case '先陣の勇': {
      // 戦法タイプ: 能動
      // 敵軍単体に兵刃ダメージ（ダメージ率77%→154%）を与え、17.5%→35%の確率（速度差依存）で1ターンの間威圧（行動不能）を付与
      // 敵軍単体に兵刃ダメージ（ダメージ率154%）を与える
      // 威圧を付与する
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 154, 'physical')
      })
      databaseTargets(ctx, h, 'control').forEach((target) => {
        ["威圧"].forEach((name) => {
          if (h.roll(ctx.rng, chanceFrom(ctx.skill, ['status_chance', 'debuff_rate', 'random_rate', 'pressure_rate', 'fatigue_rate'], 1))) {
            h.addControl(ctx, target, name, durationFromDatabase(ctx.skill, 1))
          }
        })
      })
      return true
    }
    case '後方支援': {
      // 戦法タイプ: 指揮
      // 戦闘中、自身の能動戦法の発動確率が5%→10%減少するが、友軍複数（2名）に9%→18%の与ダメージ上昇効果を付与
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '祓除': {
      // 戦法タイプ: 能動
      // 2ターンの間、自軍複数（2名）の武勇・知略・速度が12→24増加、弱体化効果を2個浄化
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '闇討ち': {
      // 戦法タイプ: 能動
      // 1ターンの準備後、敵軍大将に兵刃ダメージ（ダメージ率166%→332%）
      // 敵軍大将に兵刃ダメージ（ダメージ率332%）を与える
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 332, 'physical')
      })
      return true
    }
    case '奪気': {
      // 戦法タイプ: 能動
      // 敵軍複数（2名）の強化効果を2個「強化解除」し、3ターンの間、自身の知略が14→28上昇
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '槍弾正': {
      // 戦法タイプ: 能動
      // 敵軍単体に兵刃ダメージ（ダメージ率86%→172%）
      // 敵軍単体に兵刃ダメージ（ダメージ率172%）を与える
      // 無策を付与する
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 172, 'physical')
      })
      databaseTargets(ctx, h, 'control').forEach((target) => {
        ["無策"].forEach((name) => {
          if (h.roll(ctx.rng, chanceFrom(ctx.skill, ['status_chance', 'debuff_rate', 'random_rate', 'pressure_rate', 'fatigue_rate'], 1))) {
            h.addControl(ctx, target, name, durationFromDatabase(ctx.skill, 1))
          }
        })
      })
      return true
    }
    case '殿軍奮戦': {
      // 戦法タイプ: 能動
      // 2ターンの間、敵軍単体に挑発（強制的に自身を通常攻撃の対象に固定）または牽制（強制的に自身を戦法の対象に固定）を付与
      // 挑発を付与する
      databaseTargets(ctx, h, 'control').forEach((target) => {
        ["挑発"].forEach((name) => {
          if (h.roll(ctx.rng, chanceFrom(ctx.skill, ['status_chance', 'debuff_rate', 'random_rate', 'pressure_rate', 'fatigue_rate'], 1))) {
            h.addControl(ctx, target, name, durationFromDatabase(ctx.skill, 1))
          }
        })
      })
      return true
    }
    case '一上一下': {
      // 戦法タイプ: 受動
      // 戦闘中、自身の能動戦法の発動確率が6%→12%増加
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '捨て身の義': {
      // 戦法タイプ: 指揮
      // 戦闘中、自身の統率が20→40増加し、友軍複数の武勇と知略が10→20増加
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '百錬成鋼': {
      // 戦法タイプ: 受動
      // 自身の武勇・知略・統率・速度が17.5→35増加
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '懐柔': {
      // 戦法タイプ: 指揮
      // 2ターン目から3ターンの間、自軍複数（2～3名）が休養（毎ターン兵力回復）を獲得（回復率44%→88%、知略依存）
      // 自軍複数（2〜3名）を回復（回復率84%）する
      databaseTargets(ctx, h, 'heal').forEach((target) => {
        h.healBySkill(ctx, target, 84, databaseHealKind(ctx.skill))
      })
      return true
    }
    case '休養': {
      // 戦法タイプ: 受動
      // 戦闘中、自身は休養（毎ターン兵力回復、回復率50%→100%）を獲得
      // 自分を回復（回復率100%）する
      databaseTargets(ctx, h, 'heal').forEach((target) => {
        h.healBySkill(ctx, target, 100, databaseHealKind(ctx.skill))
      })
      return true
    }
    case '融通自在': {
      // 戦法タイプ: 能動
      // 2ターンの間、友軍単体の能動戦法の発動確率が6%→12%増加（最大2回重ねがけ可能）
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '腹中鱗甲': {
      // 戦法タイプ: 受動
      // 自身が反撃（通常攻撃を受けると、敵軍に兵刃ダメージ
      // 敵軍単体に兵刃ダメージ（ダメージ率52%）を与える
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 52, 'physical')
      })
      return true
    }
    case '敵陣攪乱': {
      // 戦法タイプ: 能動
      // 敵軍単体に計略ダメージ（ダメージ率73%→146%、知略依存）
      // 敵軍単体に計略ダメージ（ダメージ率146%）を与える
      // 混乱を付与する
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 146, 'strategy')
      })
      databaseTargets(ctx, h, 'control').forEach((target) => {
        ["混乱"].forEach((name) => {
          if (h.roll(ctx.rng, chanceFrom(ctx.skill, ['status_chance', 'debuff_rate', 'random_rate', 'pressure_rate', 'fatigue_rate'], 1))) {
            h.addControl(ctx, target, name, durationFromDatabase(ctx.skill, 1))
          }
        })
      })
      return true
    }
    case '警戒周到': {
      // 戦法タイプ: 指揮
      // 4ターン目まで、自軍複数（2名）の被ダメージが11%→22%低下
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '魚目混珠': {
      // 戦法タイプ: 受動
      // 自身は通常攻撃ができず、与ダメージが25%→50%低下するが、毎ターン食事で自身の兵力を回復（回復率106%→212%）
      // 自分を回復（回復率212%）する
      databaseTargets(ctx, h, 'heal').forEach((target) => {
        h.healBySkill(ctx, target, 212, databaseHealKind(ctx.skill))
      })
      return true
    }
    case '不意打ち': {
      // 戦法タイプ: 能動
      // 1ターンの準備後、1～2ターンの間（65%の確率で2ターンの間）、敵軍複数（2名）にランダムに無策（能動戦法発動不可）と封撃（通常攻撃不可）のいずれかを付与
      // 無策・封撃を付与する
      databaseTargets(ctx, h, 'control').forEach((target) => {
        ["無策","封撃"].forEach((name) => {
          if (h.roll(ctx.rng, chanceFrom(ctx.skill, ['status_chance', 'debuff_rate', 'random_rate', 'pressure_rate', 'fatigue_rate'], 1))) {
            h.addControl(ctx, target, name, durationFromDatabase(ctx.skill, 1))
          }
        })
      })
      return true
    }
    case '有備無患': {
      // 戦法タイプ: 能動
      // 自軍複数（2名）の兵力を回復（回復率54%→108%、知略依存）
      // 自軍複数（2名）を回復（回復率108%）する
      databaseTargets(ctx, h, 'heal').forEach((target) => {
        h.healBySkill(ctx, target, 108, databaseHealKind(ctx.skill))
      })
      return true
    }
    case '一触即発': {
      // 戦法タイプ: 突撃
      // 通常攻撃後、1ターンの間攻撃対象の統率が70→140減少、無策（能動戦法発動不可）を付与
      // 無策を付与する
      databaseTargets(ctx, h, 'control').forEach((target) => {
        ["無策"].forEach((name) => {
          if (h.roll(ctx.rng, chanceFrom(ctx.skill, ['status_chance', 'debuff_rate', 'random_rate', 'pressure_rate', 'fatigue_rate'], 1))) {
            h.addControl(ctx, target, name, durationFromDatabase(ctx.skill, 1))
          }
        })
      })
      return true
    }
    case '弓調馬服': {
      // 戦法タイプ: 能動
      // 2ターンの間、敵軍単体の武勇と知略の高い方が50→100減少
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '回山倒海': {
      // 戦法タイプ: 突撃
      // 通常攻撃後、敵軍単体に兵刃ダメージ（ダメージ率52%→104%）を与え、さらに対象に2ターンの間潰走（毎ターン持続ダメージ、ダメージ率47%→94%、武勇依存）
      // 敵軍単体に兵刃ダメージ（ダメージ率104%）を与える
      // 潰走状態を付与し、継続ダメージ（ダメージ率94%）を処理する
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 104, 'physical')
      })
      applyDatabaseDot(ctx, h)
      return true
    }
    case '参謀の助言': {
      // 戦法タイプ: 指揮
      // 自軍全体の武勇と知略が14→28増加
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '嘲罵': {
      // 戦法タイプ: 能動
      // 1ターンの間、敵軍全体に挑発を付与して自身をその攻撃対象に固定
      // 挑発を付与する
      databaseTargets(ctx, h, 'control').forEach((target) => {
        ["挑発"].forEach((name) => {
          if (h.roll(ctx.rng, chanceFrom(ctx.skill, ['status_chance', 'debuff_rate', 'random_rate', 'pressure_rate', 'fatigue_rate'], 1))) {
            h.addControl(ctx, target, name, durationFromDatabase(ctx.skill, 1))
          }
        })
      })
      return true
    }
    case '刺突': {
      // 戦法タイプ: 能動
      // 3ターンの間、敵軍単体に潰走（毎ターン持続ダメージ
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '対話': {
      // 戦法タイプ: 能動
      // 3ターンの間、自軍単体に混乱に対する「耐性」効果を付与
      // 混乱を付与する
      databaseTargets(ctx, h, 'control').forEach((target) => {
        ["混乱"].forEach((name) => {
          if (h.roll(ctx.rng, chanceFrom(ctx.skill, ['status_chance', 'debuff_rate', 'random_rate', 'pressure_rate', 'fatigue_rate'], 1))) {
            h.addControl(ctx, target, name, durationFromDatabase(ctx.skill, 1))
          }
        })
      })
      return true
    }
    case '救援': {
      // 戦法タイプ: 能動
      // 2ターンの間、自軍単体に回生（ダメージを受けるたびに50%の確率で兵力を一定量回復
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '水計': {
      // 戦法タイプ: 能動
      // 3ターンの間、敵軍単体に水攻めを付与し、毎ターン持続ダメージを与える（ダメージ率35%→70%、知略依存）
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '猛撃': {
      // 戦法タイプ: 突撃
      // 通常攻撃後、2ターンの間、自身が7.5%→15%の会心を獲得（発動時、兵刃ダメージが50%上昇）
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '看破': {
      // 戦法タイプ: 能動
      // 敵軍単体の強化効果を解除し、2ターンの間、対象の知略が9→18低下
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '火計': {
      // 戦法タイプ: 能動
      // 3ターンの間、敵軍単体を火傷にし、毎ターン持続ダメージを与える（ダメージ率35%→70%、知略依存）
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '奮起': {
      // 戦法タイプ: 受動
      // 自身の武勇と速度が12.5→25増加
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '殿軍': {
      // 戦法タイプ: 能動
      // 2ターンの間、自身の武勇が15→30増加、自身が副将の場合は追加で統率が20→40増加
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '破甲': {
      // 戦法タイプ: 突撃
      // 通常攻撃後、2ターンの間攻撃対象の統率が18→36減少
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '威圧': {
      // 戦法タイプ: 能動
      // 2ターンの間、敵軍複数（2名）の与ダメージが7.5%→15%低下
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '恵風和雨': {
      // 戦法タイプ: 指揮
      // 戦闘中、偶数ターンに40%→80%の確率で自軍複数（2名）を回復する（回復率61%→122%、知略依存）
      // 友军群体(2人)を回復（回復率122%）する
      databaseTargets(ctx, h, 'heal').forEach((target) => {
        h.healBySkill(ctx, target, 122, databaseHealKind(ctx.skill))
      })
      return true
    }
    case '剛毅木訥': {
      // 戦法タイプ: 指揮
      // 戦闘中、友軍複数（2名）が各ターンで最初にダメージを受けた際、22.5%→45%の確率でダメージを与えてきた敵軍武将に兵刃ダメージ（ダメージ率43%→86%）を
      // 敌军单体に兵刃ダメージ（ダメージ率86%）を与える
      // 敌军单体を回復（回復率86%）する
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 86, 'physical')
      })
      databaseTargets(ctx, h, 'heal').forEach((target) => {
        h.healBySkill(ctx, target, 86, databaseHealKind(ctx.skill))
      })
      return true
    }
    case '松柏之操': {
      // 戦法タイプ: 指揮
      // 自軍大将の固有能動戦法以外の能動戦法の発動率を7%→15%（知略依存）増加させる
      // 戦法説明にある能力値/与ダメ/被ダメ補正（5%または5）を反映する
      applyDatabaseBuffs(ctx, h)
      return true
    }
    case '金城湯池': {
      // 戦法タイプ: 能動
      // 敵軍複数（2～3名）を牽制し、自身の戦法による被ダメージを7.5%→15%低下させ、1ターン持続（知略依存）
      // 敌军群体(2-3人)を回復（回復率78%）する
      // 戦法説明にある能力値/与ダメ/被ダメ補正（15%または15）を反映する
      applyDatabaseBuffs(ctx, h)
      databaseTargets(ctx, h, 'heal').forEach((target) => {
        h.healBySkill(ctx, target, 78, databaseHealKind(ctx.skill))
      })
      return true
    }
    case '樽俎折衝': {
      // 戦法タイプ: 指揮
      // 行動前、15%〜30%の確率（統率依存）で自身と敵軍単体に封撃状態（自身が無策状態の場合、無策状態を付与、自身が同時に封撃と無策状態の場合、両方を付与）を付与す
      // 無策・封撃を付与する
      databaseTargets(ctx, h, 'control').forEach((target) => {
        ["無策","封撃"].forEach((name) => {
          if (h.roll(ctx.rng, chanceFrom(ctx.skill, ['status_chance', 'debuff_rate', 'random_rate', 'pressure_rate', 'fatigue_rate'], 1))) {
            h.addControl(ctx, target, name, durationFromDatabase(ctx.skill, 1))
          }
        })
      })
      return true
    }
    case '姻戚同盟': {
      // 戦法タイプ: 能動
      // 自身と異性の友軍単体の被ダメージを10%→20%（知略依存）減少させ、さらにその友軍が受けるダメージを10%→20%分担する
      // 戦法説明にある能力値/与ダメ/被ダメ補正（20%または20）を反映する
      applyDatabaseBuffs(ctx, h)
      return true
    }
    case '離心の計': {
      // 戦法タイプ: 能動
      // 1ターンの準備期間の後、敵軍の大将に兵刃ダメージ（ダメージ率176%→252%）を与え、さらにその与ダメージを25%→50%低下させ、2ターン持続
      // 敵軍大将に兵刃ダメージ（ダメージ率252%）を与える
      // 戦法説明にある能力値/与ダメ/被ダメ補正（50%または50）を反映する
      applyDatabaseBuffs(ctx, h)
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 252, 'physical')
      })
      return true
    }
    case '機に乗ず': {
      // 戦法タイプ: 突撃
      // 通常攻撃後、攻撃対象の武勇と知略を70→140低下させる
      // 挑発を付与する
      // 戦法説明にある能力値/与ダメ/被ダメ補正（140%または140）を反映する
      applyDatabaseBuffs(ctx, h)
      databaseTargets(ctx, h, 'control').forEach((target) => {
        ["挑発"].forEach((name) => {
          if (h.roll(ctx.rng, chanceFrom(ctx.skill, ['status_chance', 'debuff_rate', 'random_rate', 'pressure_rate', 'fatigue_rate'], 1))) {
            h.addControl(ctx, target, name, durationFromDatabase(ctx.skill, 1))
          }
        })
      })
      return true
    }
    case '大器の萌芽': {
      // 戦法タイプ: 指揮
      // 5ターン目以降、毎ターン自軍複数（2人）の兵力を回復（回復率54%→108%、知略依存）
      // 自軍複数（2名）を回復（回復率108%）する
      databaseTargets(ctx, h, 'heal').forEach((target) => {
        h.healBySkill(ctx, target, 108, databaseHealKind(ctx.skill))
      })
      return true
    }
    case '自立の志': {
      // 戦法タイプ: 能動
      // 敵軍全体を挑発状態にし、同時に自身の統率を22.5%→55%増加させる
      // 挑発を付与する
      // 戦法説明にある能力値/与ダメ/被ダメ補正（55%または55）を反映する
      applyDatabaseBuffs(ctx, h)
      databaseTargets(ctx, h, 'control').forEach((target) => {
        ["挑発"].forEach((name) => {
          if (h.roll(ctx.rng, chanceFrom(ctx.skill, ['status_chance', 'debuff_rate', 'random_rate', 'pressure_rate', 'fatigue_rate'], 1))) {
            h.addControl(ctx, target, name, durationFromDatabase(ctx.skill, 1))
          }
        })
      })
      return true
    }
    case '専横専断': {
      // 戦法タイプ: 能動
      // 自身の次の能動戦法による兵刃ダメージを24%→48%上昇させる
      // 無策を付与する
      // 戦法説明にある能力値/与ダメ/被ダメ補正（48%または48）を反映する
      applyDatabaseBuffs(ctx, h)
      databaseTargets(ctx, h, 'control').forEach((target) => {
        ["無策"].forEach((name) => {
          if (h.roll(ctx.rng, chanceFrom(ctx.skill, ['status_chance', 'debuff_rate', 'random_rate', 'pressure_rate', 'fatigue_rate'], 1))) {
            h.addControl(ctx, target, name, durationFromDatabase(ctx.skill, 1))
          }
        })
      })
      return true
    }
    case '家中整序': {
      // 戦法タイプ: 能動
      // 敵軍単体に計略ダメージ（ダメージ率68%→136%）を与え、その敵軍に封撃効果を付与し、2ターン持続
      // 敵軍単体に計略ダメージ（ダメージ率136%）を与える
      // 封撃を付与する
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 136, 'strategy')
      })
      databaseTargets(ctx, h, 'control').forEach((target) => {
        ["封撃"].forEach((name) => {
          if (h.roll(ctx.rng, chanceFrom(ctx.skill, ['status_chance', 'debuff_rate', 'random_rate', 'pressure_rate', 'fatigue_rate'], 1))) {
            h.addControl(ctx, target, name, durationFromDatabase(ctx.skill, 1))
          }
        })
      })
      return true
    }
    case '破天の轟': {
      // 戦法タイプ: 能動
      // 1ターンの準備期間の後、敵軍複数（2人）に火傷効果（ダメージ率52%→105%）を付与し、さらに統率を10→20低下させる
      // 敵軍複数（2名）に兵刃ダメージ（ダメージ率105%）を与える
      // 火傷状態を付与し、継続ダメージ（ダメージ率105%）を処理する
      // 戦法説明にある能力値/与ダメ/被ダメ補正（20%または20）を反映する
      applyDatabaseBuffs(ctx, h)
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 105, 'physical')
      })
      applyDatabaseDot(ctx, h)
      return true
    }
    case '雷神斬り': {
      // 戦法タイプ: 受動
      // 戦闘中、毎ターン蓄勢を1獲得する
      // 威圧を付与する
      // 戦法説明にある能力値/与ダメ/被ダメ補正（120%または120）を反映する
      applyDatabaseBuffs(ctx, h)
      databaseTargets(ctx, h, 'control').forEach((target) => {
        ["威圧"].forEach((name) => {
          if (h.roll(ctx.rng, chanceFrom(ctx.skill, ['status_chance', 'debuff_rate', 'random_rate', 'pressure_rate', 'fatigue_rate'], 1))) {
            h.addControl(ctx, target, name, durationFromDatabase(ctx.skill, 1))
          }
        })
      })
      return true
    }
    case '疑心暗鬼': {
      // 戦法タイプ: 受動
      // 戦闘中、自身の準備が必要な固有能動戦法の発動確率を6%→12%（知略依存）増加
      // 自己に計略ダメージ（ダメージ率12%）を与える
      // 戦法説明にある能力値/与ダメ/被ダメ補正（30%または30）を反映する
      applyDatabaseBuffs(ctx, h)
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 12, 'strategy')
      })
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
      // 自軍3名の所属勢力がすべて異なり、且つ自軍大将の固有戦法が能動または突撃である場合に発動
      // 戦法説明にある能力値/与ダメ/被ダメ補正（13%または13）を反映する
      applyDatabaseBuffs(ctx, h)
      return true
    }
    case '出奇制勝': {
      // 戦法タイプ: 受動
      // 固有能動戦法の与ダメージを上げ、確率で攻心を獲得
      // 戦法説明にある能力値/与ダメ/被ダメ補正（28%または28）を反映する
      applyDatabaseBuffs(ctx, h)
      return true
    }
    case '風流武者': {
      // 戦法タイプ: 受動
      // 能動・突撃戦法の発動に応じて回復または計略与ダメージ上昇
      // 自軍群體（2人）を回復（回復率132%）する
      // 戦法説明にある能力値/与ダメ/被ダメ補正（30%または30）を反映する
      applyDatabaseBuffs(ctx, h)
      databaseTargets(ctx, h, 'heal').forEach((target) => {
        h.healBySkill(ctx, target, 132, databaseHealKind(ctx.skill))
      })
      return true
    }
    case '重農主義': {
      // 戦法タイプ: 指揮
      // 評定衆時に兵糧増産効果を増加
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '上州の黄斑': {
      // 戦法タイプ: 指揮
      // 条件に応じて消沈または疲弊を付与
      // 疲弊を付与する
      databaseTargets(ctx, h, 'control').forEach((target) => {
        ["疲弊"].forEach((name) => {
          if (h.roll(ctx.rng, chanceFrom(ctx.skill, ['status_chance', 'debuff_rate', 'random_rate', 'pressure_rate', 'fatigue_rate'], 1))) {
            h.addControl(ctx, target, name, durationFromDatabase(ctx.skill, 1))
          }
        })
      })
      return true
    }
    case '戮力同心': {
      // 戦法タイプ: 指揮
      // 毎ターン確率で自身と友軍を回復
      // 自軍單體或自軍群體を回復（回復率82%）する
      databaseTargets(ctx, h, 'heal').forEach((target) => {
        h.healBySkill(ctx, target, 82, databaseHealKind(ctx.skill))
      })
      return true
    }
    case '股肱の臣': {
      // 戦法タイプ: 能動
      // 複数に回生を付与し、残数に応じて与ダメージ上昇
      // 自軍群體（2-3人）を回復（回復率54%）する
      // 戦法説明にある能力値/与ダメ/被ダメ補正（11%または11）を反映する
      applyDatabaseBuffs(ctx, h)
      databaseTargets(ctx, h, 'heal').forEach((target) => {
        h.healBySkill(ctx, target, 54, databaseHealKind(ctx.skill))
      })
      return true
    }
    case '天神山残照': {
      // 戦法タイプ: 受動
      // 通常攻撃後に計略ダメージを与え、序盤は自身の能力を上昇
      // 自身に計略ダメージ（ダメージ率218%）を与える
      // 混乱を付与する
      // 戦法説明にある能力値/与ダメ/被ダメ補正（60%または60）を反映する
      applyDatabaseBuffs(ctx, h)
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 218, 'strategy')
      })
      databaseTargets(ctx, h, 'control').forEach((target) => {
        ["混乱"].forEach((name) => {
          if (h.roll(ctx.rng, chanceFrom(ctx.skill, ['status_chance', 'debuff_rate', 'random_rate', 'pressure_rate', 'fatigue_rate'], 1))) {
            h.addControl(ctx, target, name, durationFromDatabase(ctx.skill, 1))
          }
        })
      })
      return true
    }
    case '士気高揚': {
      // 戦法タイプ: 能動
      // 自軍単体に洞察を付与する
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '初級鼓舞': {
      // 戦法タイプ: 能動
      // 自軍単体の武勇を上げる
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '初期激昂': {
      // 戦法タイプ: 能動
      // 自軍単体の速度を上げる
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '初級圧制': {
      // 戦法タイプ: 能動
      // 敵単体の統率を下げる
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '初級撹乱': {
      // 戦法タイプ: 能動
      // 敵単体の速度を下げる
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '初級治療': {
      // 戦法タイプ: 能動
      // 自軍単体に回生を付与する
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '勇武': {
      // 戦法タイプ: 受動
      // 自身の武勇を上げる
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '固陣': {
      // 戦法タイプ: 受動
      // 自身の統率を上げる
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '速戦': {
      // 戦法タイプ: 受動
      // 速度上昇
      return applyDatabaseSkillEffect(ctx, h)
    }
    // DB戦法: ここまで。

    default:
      return false
  }
}
