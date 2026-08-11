import type { BingxueActive, Lineup, RoleData } from '../composables/useLineups'
import type { Skill, Stat, TriggerEvent } from '../composables/useData'
import skillsData from '../../.build/skills.json'
import { heroLevel50Stats } from './heroStats'
import { selectedTroopLevel, selectedTroopStatMultiplier } from './troopLevels'
import type { TroopType } from '../constants/traits'
import {
  BATTLE_SKILL_EFFECT_TRIGGERS,
  ENEMY_AFTER_ACTION_SKILL_NAMES,
  ENEMY_STRATEGY_DAMAGE_RECEIVED_SKILL_NAMES,
  HEAL_STOCK_DAMAGE_SKILL_NAMES,
  IMPLEMENTED_BATTLE_SKILL_NAMES,
  TEAM_AFTER_NORMAL_ATTACK_SKILL_NAMES,
  TEAM_BEFORE_ACTION_SKILL_NAMES,
  TEAM_DAMAGE_RECEIVED_SKILL_NAMES,
  TEAM_ACTION_BATTLE_SKILL_NAMES,
  TEAM_NORMAL_ATTACK_RECEIVED_SKILL_NAMES,
  applyNamedSkillEffect,
  battleSkillType,
  compareBattleSkillPriority,
  isBattleSkillFollowUpTrigger,
  recordDamageDealtSkillEffects,
  structuredBattleTriggers,
  type BattleSkillEffectHelpers,
  type SkillDamageStatRule,
} from './battleSkillEffects'
import {
  bingxueActivationChanceBonus,
  bingxueHealMultiplier,
  bingxueLifeStealPercent,
  bingxueStatBonus,
  consumeBingxuePreparationReduction,
  controlBlockedByBingxue,
  initializeBingxueBattle,
  markBingxueSkillUsed,
  preferredBingxueTarget,
  recordBingxueSkillFailure,
  recordBingxueSkillResolved,
  resolveBingxueDamage,
  runBingxueAfterAction,
  runBingxueAfterNormalAttack,
  runBingxueBeforeAction,
  runBingxueControlApplied,
  runBingxueNormalAttackReceived,
  runBingxueSkillHeal,
  runBingxueTurnStart,
  tickBingxueTurn,
  type BingxueActionHelpers,
  type BingxueRuntimeState,
} from './battleBingxueEffects'

export type BattleSide = 'ally' | 'enemy'
export type BattleOutcome = 'ally' | 'enemy' | 'draw'
export type BattleTrigger = Extract<TriggerEvent, string>
export type BattleTroopAffinity = 'advantage' | 'neutral' | 'disadvantage'

export const BATTLE_TURN_LIMIT = 8
const BASE_TROOPS = 10000

export interface BattleOptions {
  seed: string
  collectLogs?: boolean
  allyTroopAffinity?: BattleTroopAffinity
  enemyTroopAffinity?: BattleTroopAffinity
}

export interface BattleLogEntry {
  turn: number
  side: BattleSide | 'system'
  actor?: string
  actorHp?: number
  actionActor?: string
  actionSide?: BattleSide
  actionActorHp?: number
  actionActorSpeed?: number
  message: string
  target?: string
  targetSide?: BattleSide
  amount?: number
  beforeHp?: number
  afterHp?: number
  woundedDelta?: number
  deadDelta?: number
  valueType?: 'damage' | 'healing'
  effect?: string
}

const NO_LOGS = { push: () => 0 } as unknown as BattleLogEntry[]

interface TimedStatus {
  name: string
  turns: number
  sourceSkill?: string
  sourceActorId?: string
  sourceActor?: string
  dotRate?: number
  dotType?: 'physical' | 'strategy'
}

export interface TimedBattleModifier {
  key: string
  stat: Stat
  value: number
  expiresTurn: number
  sourceSkill: string
}

interface PendingSkill {
  skill: Skill
  remainingTurns: number
}

interface BattleControlSource {
  actorId: string
  actorName: string
}

export interface BattleFighter {
  id: string
  side: BattleSide
  role: 'main' | 'vice1' | 'vice2'
  roleLabel: string
  name: string
  gender: string
  maxHp: number
  hp: number
  wounded: number
  dead: number
  baseStats: Record<Stat, number>
  buffs: Partial<Record<Stat, number>>
  statuses: Record<string, number>
  controlSources: Record<string, BattleControlSource>
  timedStatuses: TimedStatus[]
  timedModifiers: TimedBattleModifier[]
  pendingSkills: PendingSkill[]
  skillCooldowns: Record<string, number>
  skillUsesThisTurn: Record<string, number>
  specialState: Record<string, number>
  skills: Skill[]
  bingxue: BingxueActive
  bingxueRuntime: BingxueRuntimeState
  troopType: TroopType | null
  troopLevel: number
  troopStatMultiplier: number
  troopAffinityModifier: number
}

export interface BattleSummary {
  outcome: BattleOutcome
  turns: number
  allyHp: number
  enemyHp: number
  allyMaxHp: number
  enemyMaxHp: number
}

export interface BattleResult {
  summary: BattleSummary
  logs: BattleLogEntry[]
  ally: BattleFighter[]
  enemy: BattleFighter[]
  skillStats: SkillBattleStat[]
  turnStats: BattleTurnStat[]
  controlStats: Record<string, number>
}

export interface SkillBattleStat {
  key: string
  side: BattleSide
  actorId: string
  actorName: string
  role: BattleFighter['role']
  roleLabel: string
  skillId: string
  skillName: string
  activations: number
  damage: number
  healing: number
}

export interface SkillBattleAverage extends SkillBattleStat {
  avgActivations: number
  avgDamage: number
  avgHealing: number
}

export interface BattleTurnStat {
  turn: number
  allyDamage: number
  enemyDamage: number
  allyHealing: number
  enemyHealing: number
  allyHp: number
  enemyHp: number
  allyMembers: number[]
  enemyMembers: number[]
}

export interface BattleScoreMetrics {
  output: number
  burst: number
  multi: number
  recovery: number
  control: number
  destruction: number
  stability: number
  exchange: number
}

export interface BattleBatchResult {
  runs: number
  maxTurns: number
  allyWins: number
  enemyWins: number
  draws: number
  allyWinRate: number
  enemyWinRate: number
  drawRate: number
  averageTurns: number
  averageAllyHp: number
  averageEnemyHp: number
  allyMaxHp: number
  enemyMaxHp: number
  skillStats: SkillBattleAverage[]
  exchangeRatio: number
  scoreTier: string
  scoreValue: number
  metrics: BattleScoreMetrics
  turnStats: BattleTurnStat[]
  controlStats: Record<string, number>
}

const ROLE_LABELS: Record<BattleFighter['role'], string> = {
  main: '大将',
  vice1: '副将',
  vice2: '副将',
}

type CoreStat = keyof RoleData['stats']
const CORE_STATS: CoreStat[] = ['lea', 'val', 'int', 'pol', 'cha', 'spd']

const makeRng = (seed: string) => {
  let h = 2166136261
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return () => {
    h += 0x6D2B79F5
    let t = h
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const asNumber = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null)
const normalizeRate = (value: number): number => (Math.abs(value) <= 3 ? value * 100 : value)
export { IMPLEMENTED_BATTLE_SKILL_NAMES }

const pickMaxVar = (skill: Skill, keys: string[]): number | null => {
  if (!skill.vars) return null
  for (const key of keys) {
    const raw = skill.vars[key]
    if (typeof raw === 'number') return raw
    if (raw && typeof raw === 'object') {
      if (typeof raw.max === 'number') return raw.max
      if (typeof raw.base === 'number') return raw.base
    }
  }
  return null
}

const pickMaxVarRate = (skill: Skill, keys: string[]): number | null => {
  const value = pickMaxVar(skill, keys)
  return value == null ? null : normalizeRate(value)
}

// 戦法発動率は複数ソースから来るため、明示値を優先し、最後に戦法種別の既定値へ落とす。
const extractRate = (skill: Skill): number => {
  if (typeof skill.probability === 'number') return clamp(skill.probability, 0, 1)
  if (Array.isArray(skill.rate) && skill.rate.length > 0) return clamp(skill.rate[skill.rate.length - 1], 0, 1)
  if (typeof skill.battle?.rate === 'number') return clamp(skill.battle.rate, 0, 1)
  const raw = skill.activation_rate ?? ''
  const percentMatches = [...raw.matchAll(/(\d+(?:\.\d+)?)\s*%/g)]
  if (percentMatches.length > 0) {
    const last = percentMatches[percentMatches.length - 1]?.[1]
    return clamp(Number(last) / 100, 0, 1)
  }
  const numberMatches = [...raw.matchAll(/(?:^|[^\d.])(\d(?:\.\d+)?)(?:$|[^\d.])/g)]
  if (numberMatches.length > 0) {
    const last = numberMatches[numberMatches.length - 1]?.[1]
    return clamp(Number(last), 0, 1)
  }
  return isPassiveLike(skill) ? 1 : 0.35
}

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

const isPassiveLike = (skill: Skill): boolean =>
  skill.category === 'passive'
  || skill.category === 'command'
  || skill.category === 'troop'
  || /受動|被動|指揮|兵種|陣法|パッシブ|passive|command|troop/i.test(textOfSkill(skill))

const normalizeTrigger = (trigger?: string): BattleTrigger => {
  switch (trigger) {
    case 'battleStart': return 'preparationTurn'
    case 'afterAttack': return 'afterNormalAttack'
    case 'onHeal': return 'onHealed'
    case 'onDamaged': return 'onPhysicalDamageReceived'
    default: return (trigger || 'beforeAction') as BattleTrigger
  }
}

const describesDirectDamage = (text: string): boolean =>
  /(?:兵刃|計略|謀略|物理|知略|武勇)?ダメージ(?:を)?(?:与える|造成|与え)|(?:兵刃|計略|謀略)ダメージ/.test(text)
  && !/(?:被ダメージ|与ダメージ|ダメージ率|ダメージを(?:上昇|低下|減少|軽減|増加)|ダメージが(?:上昇|低下|減少|軽減|増加))/.test(text)

const describesDirectHeal = (text: string): boolean =>
  /(?:回復|治療)(?:を)?(?:行う|する|付与|回復)|兵力を(?:回復|治療)/.test(text)

// 発動タイミングはカテゴリが空のデータもあるため、戦法名と説明文の表記も併用して推定する。
const triggerForSkill = (skill: Skill): BattleTrigger => {
  const skillName = skill.name_jp || skill.name

  // 個別実装済みの戦法は、データ側に残っている汎用 trigger よりコード側の実装タイミングを優先する。
  // 例: 如水 / 千成瓢箪は元データ上 battleStart でも、実際の処理は各武将の行動前に解決する。
  if (['如水', '千成瓢箪'].includes(skillName)) return 'beforeAction'
  if (HEAL_STOCK_DAMAGE_SKILL_NAMES.includes(skillName)) return 'afterAction'
  if (['疾風迅雷', '恵風和雨', '樽俎折衝', '風林火山', '伊達風采'].includes(skillName)) return 'turnStart'

  if (skill.trigger) return normalizeTrigger(skill.trigger)
  if (skill.category === 'assault') return 'afterNormalAttack'
  if (skill.category === 'active') return 'beforeAction'
  const text = textOfSkill(skill)
  if (/固有戦法.*前|固有.*発動.*前/.test(text)) return 'beforeUniqueSkill'
  if (/通常攻撃を受けた時|普通攻撃を受けた時|通常攻撃を受ける|普通攻撃を受ける/.test(text)) return 'onNormalAttackReceived'
  if (/兵刃ダメージを受けた時|兵刃ダメージを受ける/.test(text)) return 'onPhysicalDamageReceived'
  if (/計略ダメージを受けた時|謀略ダメージを受けた時|計略ダメージを受ける|謀略ダメージを受ける/.test(text)) return 'onStrategyDamageReceived'
  if (/回復効果を受けた時|回復を受けた時|治療を受けた時|回復を受ける|治療を受ける/.test(text)) return 'onHealed'
  if (/行動終了時|行動後|行動が終了/.test(text)) return 'afterAction'
  if (/行動前|行動開始前/.test(text)) return 'beforeAction'
  if (/通常攻撃前|普通攻撃前|通常攻撃の前|普通攻撃の前/.test(text)) return 'beforeNormalAttack'
  if (/突擊|突撃|通常攻撃後|普通攻撃後|普通攻擊之後|assault/i.test(text)) return 'afterNormalAttack'
  if (/ターン開始時|ターン開始|毎ターン開始|各ターン開始|每回合開始|每回合开始/.test(text)) return 'turnStart'
  if (skill.category === 'passive' || skill.category === 'command' || skill.category === 'troop') {
    if (/毎ターン|每回合/.test(text)) return 'turnStart'
    if (describesDirectDamage(text) || describesDirectHeal(text)) return 'beforeAction'
    return 'preparationTurn'
  }
  if (/受動|被動|指揮|兵種|陣法|戦闘開始|戰鬥開始|戦闘中|戰鬥中|passive|command|troop/i.test(text)) {
    if (/毎ターン|每回合/.test(text)) return 'turnStart'
    if (describesDirectDamage(text) || describesDirectHeal(text)) return 'beforeAction'
    return 'preparationTurn'
  }
  return 'beforeAction'
}

const uniqueTriggers = (triggers: TriggerEvent[]): BattleTrigger[] =>
  [...new Set(triggers.map((trigger) => normalizeTrigger(trigger)))]

const triggerEventsForSkill = (skill: Skill): BattleTrigger[] => {
  const skillName = skill.name_jp || skill.name
  const registered = BATTLE_SKILL_EFFECT_TRIGGERS[skillName] ?? []
  const explicit = skill.triggers ?? []
  const structured = structuredBattleTriggers(skill)
  const triggers = uniqueTriggers([...registered, ...explicit, ...structured])
  return triggers.length > 0 ? triggers : [triggerForSkill(skill)]
}

const skillSupportsTrigger = (skill: Skill, trigger: BattleTrigger): boolean => {
  const normalizedTrigger = normalizeTrigger(trigger)
  return triggerEventsForSkill(skill).some((skillTrigger) => skillTrigger === 'always' || skillTrigger === normalizedTrigger)
}

const preparationTurns = (skill: Skill): number => {
  if (typeof skill.battle?.prepTurns === 'number') return Math.max(0, Math.round(skill.battle.prepTurns))
  const text = textOfSkill(skill)
  const match = text.match(/(\d+)\s*ターンの準備|(\d+)\s*T準備|(\d+)\s*ターンの準備期間|(\d+)\s*ターン準備/)
  if (match) return Number(match[1] ?? match[2])
  return /準備後|準備期間|準備が必要/.test(text) ? 1 : 0
}

const roleStats = (role: RoleData, troopStatMultiplier: number): Record<Stat, number> => {
  const out = {} as Record<Stat, number>
  const level50Stats = heroLevel50Stats(role.hero)
  CORE_STATS.forEach((stat) => {
    const statValue = Number(role.stats[stat] ?? level50Stats[stat] ?? 100)
    const existingBattleStat = Math.round(statValue + role.breakthrough * 2)
    out[stat] = Math.round(existingBattleStat * troopStatMultiplier * 100) / 100
  })
  out.damageDealt = 0
  out.damageTaken = 0
  out.strategyDamageDealt = 0
  out.attackDamage = 0
  return out
}

const allSkills = skillsData as unknown as Skill[]

const skillKeyForDedup = (skill: Skill) => skill.sim_id || skill.id || skill.name_jp || skill.name

const findSkillByName = (name?: string | null): Skill | null => {
  if (!name) return null
  return allSkills.find((skill) => skill.name === name || skill.name_jp === name) ?? null
}

const battleSkillsForRole = (role: RoleData): Skill[] => {
  const uniqueSkill = findSkillByName(role.hero?.unique_skill)
  const list = [uniqueSkill, role.skill1, role.skill2].filter(Boolean) as Skill[]
  const seen = new Set<string>()
  return list
    .filter((skill) => {
      const key = skillKeyForDedup(skill)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) => compareBattleSkillPriority(a, b) || skillKeyForDedup(a).localeCompare(skillKeyForDedup(b), 'ja'))
}

const affinityMultiplier = (affinity: BattleTroopAffinity = 'neutral'): number => {
  if (affinity === 'advantage') return 1.125
  if (affinity === 'disadvantage') return 0.875
  return 1
}

const makeFighter = (
  side: BattleSide,
  roleKey: BattleFighter['role'],
  role: RoleData,
  troopAffinity: BattleTroopAffinity,
  troopType: TroopType | null,
  troopLevel: number,
  troopStatMultiplier: number,
): BattleFighter | null => {
  if (!role.hero) return null
  const fighter: BattleFighter = {
    id: `${side}-${roleKey}`,
    side,
    role: roleKey,
    roleLabel: ROLE_LABELS[roleKey],
    name: role.hero.name_jp || role.hero.name,
    gender: role.hero.gender ?? '',
    maxHp: BASE_TROOPS,
    hp: BASE_TROOPS,
    wounded: 0,
    dead: 0,
    baseStats: roleStats(role, troopStatMultiplier),
    buffs: {},
    statuses: {},
    controlSources: {},
    timedStatuses: [],
    timedModifiers: [],
    pendingSkills: [],
    skillCooldowns: {},
    skillUsesThisTurn: {},
    specialState: {},
    skills: battleSkillsForRole(role),
    bingxue: role.bingxue,
    bingxueRuntime: { timedModifiers: [] },
    troopType,
    troopLevel,
    troopStatMultiplier,
    troopAffinityModifier: affinityMultiplier(troopAffinity),
  }
  return fighter
}

const makeSide = (side: BattleSide, lineup: Lineup, troopAffinity: BattleTroopAffinity): BattleFighter[] => {
  const troopType = lineup.troopType ?? null
  const troopLevel = selectedTroopLevel(lineup)
  const troopStatMultiplier = selectedTroopStatMultiplier(lineup)
  return [
    makeFighter(side, 'main', lineup.main, troopAffinity, troopType, troopLevel, troopStatMultiplier),
    makeFighter(side, 'vice1', lineup.vice1, troopAffinity, troopType, troopLevel, troopStatMultiplier),
    makeFighter(side, 'vice2', lineup.vice2, troopAffinity, troopType, troopLevel, troopStatMultiplier),
  ].filter(Boolean) as BattleFighter[]
}

export type SkillStatMap = Map<string, SkillBattleStat>
const skillStatKey = (caster: BattleFighter, skill: Skill): string =>
  `${caster.side}:${caster.role}:${caster.name}:${skill.id || skill.sim_id || skill.name}`

const ensureSkillStat = (stats: SkillStatMap, caster: BattleFighter, skill: Skill): SkillBattleStat => {
  const key = skillStatKey(caster, skill)
  let item = stats.get(key)
  if (!item) {
    item = {
      key,
      side: caster.side,
      actorId: caster.id,
      actorName: caster.name,
      role: caster.role,
      roleLabel: caster.roleLabel,
      skillId: skill.id || skill.sim_id || skill.name,
      skillName: skill.name_jp || skill.name,
      activations: 0,
      damage: 0,
      healing: 0,
    }
    stats.set(key, item)
  }
  return item
}

const recordActivation = (stats: SkillStatMap, caster: BattleFighter, skill: Skill) => {
  ensureSkillStat(stats, caster, skill).activations += 1
}
const recordDamage = (stats: SkillStatMap, caster: BattleFighter, skill: Skill, amount: number) => {
  ensureSkillStat(stats, caster, skill).damage += amount
}
const recordHealing = (stats: SkillStatMap, caster: BattleFighter, skill: Skill, amount: number) => {
  ensureSkillStat(stats, caster, skill).healing += amount
}

const emptyTurnStat = (turn: number): BattleTurnStat => ({
  turn,
  allyDamage: 0,
  enemyDamage: 0,
  allyHealing: 0,
  enemyHealing: 0,
  allyHp: 0,
  enemyHp: 0,
  allyMembers: [],
  enemyMembers: [],
})

const isAlive = (fighter: BattleFighter) => fighter.hp > 0
const living = (fighters: BattleFighter[]) => fighters.filter(isAlive)
const CONTROL_STATUS_NAMES = new Set([
  '無策',
  '封撃',
  '混乱',
  '疲弊',
  '回復不可',
  '挑発',
  '牽制',
  '麻痺',
  '威圧',
  '畏縮',
  '萎縮',
])
const CONTINUOUS_DAMAGE_STATUS_NAMES = new Set(['火傷', '水攻', '水攻め', '中毒', '消沈', '潰走'])
const CONTROL_STATUS_ALIASES: Record<string, string[]> = {
  畏縮: ['畏縮', '萎縮'],
  萎縮: ['畏縮', '萎縮'],
}
const controlStatusKeys = (name: string): string[] => CONTROL_STATUS_ALIASES[name] ?? [name]
const activeControlStatusKey = (fighter: BattleFighter, name: string): string | null =>
  controlStatusKeys(name).find((key) => (fighter.statuses[key] ?? 0) > 0) ?? null
const hasControlStatus = (fighter: BattleFighter, name: string): boolean =>
  activeControlStatusKey(fighter, name) !== null
const clearControlStatus = (fighter: BattleFighter, name: string) => {
  controlStatusKeys(name).forEach((key) => {
    delete fighter.statuses[key]
    delete fighter.controlSources[key]
  })
}
const applyControlStatus = (
  caster: BattleFighter,
  target: BattleFighter,
  name: string,
  duration: number,
): boolean => {
  // 宮部継潤が装備した僧兵は、火傷以外の継続状態そのものを受けない。
  if (
    (target.specialState.monkNonBurnDotImmune ?? 0) > 0
    && CONTINUOUS_DAMAGE_STATUS_NAMES.has(name)
    && name !== '火傷'
  ) return false
  // 制御状態は重ね掛けも残り時間の上書きも行わない。
  if (activeControlStatusKey(target, name)) return false
  target.statuses[name] = Math.max(1, duration)
  target.controlSources[name] = { actorId: caster.id, actorName: caster.name }
  return true
}
const sideHp = (fighters: BattleFighter[]) => fighters.reduce((sum, fighter) => sum + Math.max(0, fighter.hp), 0)
const sideMaxHp = (fighters: BattleFighter[]) => fighters.reduce((sum, fighter) => sum + fighter.maxHp, 0)
const sideMainAlive = (fighters: BattleFighter[]) => fighters.some((fighter) => fighter.role === 'main' && isAlive(fighter))

const statOf = (fighter: BattleFighter, stat: Stat): number =>
  Math.max(0, (fighter.baseStats[stat] ?? 0) + (fighter.buffs[stat] ?? 0) + bingxueStatBonus(fighter, stat))

// 基本ターゲットは残兵割合が低い候補を優先しつつ、上位2名からランダムに選ぶ。
const chooseTarget = (
  candidates: BattleFighter[],
  rng: () => number,
  mode: 'normal' | 'skill' = 'skill',
): BattleFighter | null => {
  const live = living(candidates)
  if (live.length === 0) return null
  const turn = Math.max(0, ...live.map(fighter => fighter.specialState.bingxueCurrentTurn ?? 0))
  const preferred = preferredBingxueTarget(live, mode, turn)
  if (preferred) return preferred
  const sorted = [...live].sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))
  return sorted[Math.floor(rng() * Math.min(2, sorted.length))] ?? sorted[0]
}

const forcedControlTarget = (
  caster: BattleFighter,
  candidates: BattleFighter[],
  mode: 'normal' | 'skill',
): BattleFighter | null => {
  const controlName = mode === 'normal' ? '挑発' : '牽制'
  const activeKey = activeControlStatusKey(caster, controlName)
  if (!activeKey) return null
  const source = caster.controlSources[activeKey]
  if (!source) return null
  return living(candidates).find((fighter) => fighter.id === source.actorId)
    ?? living(candidates).find((fighter) => fighter.name === source.actorName)
    ?? null
}

const controlledRandomCandidates = (
  caster: BattleFighter,
  candidates: BattleFighter[],
  allies: BattleFighter[],
  enemies: BattleFighter[],
  mode: 'normal' | 'skill',
): BattleFighter[] => {
  const forced = forcedControlTarget(caster, candidates, mode)
  if (forced) return [forced]
  if (!hasControlStatus(caster, '混乱')) return living(candidates)
  const mixed = living([...allies, ...enemies])
  return mode === 'normal' ? mixed.filter((fighter) => fighter.id !== caster.id) : mixed
}

const chooseControlledTarget = (
  caster: BattleFighter,
  candidates: BattleFighter[],
  allies: BattleFighter[],
  enemies: BattleFighter[],
  rng: () => number,
  mode: 'normal' | 'skill' = 'skill',
): BattleFighter | null => {
  const forced = forcedControlTarget(caster, candidates, mode)
  if (forced) return forced
  const controlled = controlledRandomCandidates(caster, candidates, allies, enemies, mode)
  if (hasControlStatus(caster, '混乱')) {
    return controlled[Math.floor(rng() * controlled.length)] ?? null
  }
  return chooseTarget(controlled, rng, mode)
}

const redirectGuardedNormalAttack = (
  target: BattleFighter,
  defenders: BattleFighter[],
  attacker: BattleFighter,
  turn: number,
  logs: BattleLogEntry[],
): BattleFighter => {
  if ((target.statuses['援護'] ?? 0) <= 0) return target
  const guardianRole = target.specialState.mikawaGuardianRole
  const guardian = defenders.find((fighter) =>
    fighter.id !== target.id
    && isAlive(fighter)
    && ((guardianRole === 1 && fighter.role === 'vice1') || (guardianRole === 2 && fighter.role === 'vice2')),
  )
  if (!guardian) {
    delete target.statuses['援護']
    delete target.specialState.mikawaGuardianRole
    return target
  }
  if (logs !== NO_LOGS) logs.push({
    turn,
    side: target.side,
    actor: target.name,
    actorHp: target.hp,
    target: guardian.name,
    targetSide: guardian.side,
    effect: '三河魂',
    message: `${guardian.name}が${target.name}を援護し、${attacker.name}の通常攻撃を引き受ける`,
  })
  return guardian
}

const targetCountOf = (skill: Skill, fallback = 1): number | [number, number] => {
  const text = `${skill.target_jp ?? ''} ${skill.target ?? ''} ${skill.description_jp ?? ''}`
  const range = text.match(/(\d+)\s*[〜～-]\s*(\d+)\s*名|(\d+)\s*[〜～-]\s*(\d+)\s*人/)
  if (range) return [Number(range[1] ?? range[3]), Number(range[2] ?? range[4])]
  const single = text.match(/複数[（(](\d+)[名人]/) ?? text.match(/群[体體][（(](\d+)[名人]/) ?? text.match(/全[体體][（(](\d+)[名人]/)
  if (single) return Number(single[1])
  if (/全体|全體|自軍全体|自軍全體|我軍全體|敵軍全体|敵軍全體/.test(text)) return 3
  if (/複数|群体|群體|集団/.test(text)) return 2
  return fallback
}

const resolveTargets = (
  skill: Skill,
  caster: BattleFighter,
  currentTarget: BattleFighter | null,
  allies: BattleFighter[],
  enemies: BattleFighter[],
  rng: () => number,
): BattleFighter[] => {
  const text = `${skill.target_jp ?? ''} ${skill.target ?? ''} ${skill.description_jp ?? ''}`
  const isAlly = /自軍|我軍|友軍|自身|自分|回復|恢復|heal/i.test(text) && !/敵軍/.test(text)
  if (/自身|自分/.test(text)) return [caster]
  // 牽制中の敵向け戦法は、効果人数にかかわらず付与者へ固定する。
  if (!isAlly) {
    const forced = forcedControlTarget(caster, enemies, 'skill')
    if (forced) return [forced]
  }
  const source = isAlly ? living(allies) : living(enemies)
  if (source.length === 0) return []
  const countDef = targetCountOf(skill)
  const count = Array.isArray(countDef)
    ? countDef[0] + Math.floor(rng() * (countDef[1] - countDef[0] + 1))
    : countDef
  if (/兵力最低|兵力の最も低い|最低/.test(text)) {
    return [...source].sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp)).slice(0, count)
  }
  if (/大将/.test(text)) {
    const commander = source.find((fighter) => fighter.role === 'main')
    return commander ? [commander] : source.slice(0, 1)
  }
  const randomSource = controlledRandomCandidates(caster, source, allies, enemies, 'skill')
  if (currentTarget && randomSource.some((fighter) => fighter.id === currentTarget.id) && count === 1) {
    return [currentTarget]
  }
  return [...randomSource].sort(() => rng() - 0.5).slice(0, count)
}

const applyDamage = (target: BattleFighter, amount: number): number => {
  const actual = Math.min(target.hp, Math.max(0, Math.round(amount)))
  target.hp -= actual
  const wounded = Math.min(actual, Math.round(actual * 0.9))
  const dead = actual - wounded
  target.wounded += wounded
  target.dead += dead
  target.maxHp = Math.max(0, target.maxHp - dead)
  if (target.hp > target.maxHp) target.hp = target.maxHp
  return actual
}

const applyHeal = (target: BattleFighter, amount: number): number => {
  // 回復不可中も戦法自体は発動するが、実際の兵力回復は0になる。
  if (hasControlStatus(target, '回復不可')) return 0
  const actual = Math.min(target.wounded, target.maxHp - target.hp, Math.max(0, Math.round(amount)))
  target.hp += actual
  target.wounded = Math.max(0, target.wounded - actual)
  return actual
}

const hpChangeText = (beforeHp: number, afterHp: number): string =>
  `（${beforeHp.toLocaleString()} ⇒ ${afterHp.toLocaleString()}）`
const casualtyText = (woundedDelta: number, deadDelta: number): string =>
  `負傷${woundedDelta.toLocaleString()}・戦死${deadDelta.toLocaleString()}`

const damageKind = (skill: Skill): 'physical' | 'strategy' => {
  const text = textOfSkill(skill)
  if (skill.damage_type === '計略' || skill.battle_type === 'strategy' || /計略|謀略|智略|知略依存/.test(text)) return 'strategy'
  return 'physical'
}

const damageRate = (skill: Skill | null): number => {
  if (!skill) return 100
  const direct = asNumber(skill.damage_rate_max)
  return (direct == null ? null : normalizeRate(direct))
    ?? pickMaxVarRate(skill, [
      'damage_rate',
      'dmg_rate',
      'dmg',
      'dmg1',
      'dmg2',
      'damage',
      'damage_1',
      'damage_2',
      'prep_strategy_rate',
      'strategy_rate',
      'counter_damage_rate',
      'extra_damage_rate',
      'commander_dmg_rate',
    ])
    ?? (/(damage|兵刃|計略)/i.test(textOfSkill(skill)) ? 160 : 0)
}

const healRate = (skill: Skill): number => {
  const direct = asNumber(skill.heal_rate_max)
  return (direct == null ? null : normalizeRate(direct))
    ?? pickMaxVarRate(skill, ['heal_rate', 'heal', 'recovery_rate', 'enhanced_heal_rate'])
    ?? (/回復|恢復|休養|heal/i.test(textOfSkill(skill)) ? 120 : 0)
}

const damageModifier = (fighter: BattleFighter, outgoing: boolean, kind: 'physical' | 'strategy'): number => {
  let modifier = 1
  modifier += (fighter.buffs.damageDealt ?? 0) / 100
  if (kind === 'strategy') modifier += (fighter.buffs.strategyDamageDealt ?? 0) / 100
  if (kind === 'physical') modifier += (fighter.buffs.attackDamage ?? 0) / 100
  if (!outgoing) modifier += (fighter.buffs.damageTaken ?? 0) / 100
  if (!outgoing && kind === 'physical') modifier += (fighter.buffs.physicalDamageTaken ?? 0) / 100
  if (!outgoing && kind === 'strategy') modifier += (fighter.buffs.strategyDamageTaken ?? 0) / 100
  return Math.max(0.1, modifier)
}

const battleDamageBase = (
  attackStat: number,
  defenseStat: number,
  troops: number,
) => 1.37 * (attackStat - defenseStat) + (0.037 * troops + 175)

const normalDamageFloor = (troops: number): number => {
  const currentTroops = Math.max(0, troops)
  if (currentTroops <= 600) return 11
  if (currentTroops <= 3000) return currentTroops * 0.0185 + 0.25
  return 55.75 + (currentTroops - 3000) * 0.0165
}

const guaranteedDamageFloor = (troops: number, rate: number, isSkillDamage: boolean): number => {
  const normalFloor = normalDamageFloor(troops)
  if (!isSkillDamage) return normalFloor
  return normalFloor * (20.5 / 18.75) * (rate / 100)
}

// note公開式ベース:
// (1.37×(攻撃武勇-守備統率)+(0.037×兵数+175))×(1+バフ-デバフ)×兵種相性。
// 戦法の兵刃ダメージは、この通常攻撃相当値に戦法倍率を掛けて扱う。
interface DamageResolution {
  amount: number
  critical: boolean
}

const baseDamage = (
  caster: BattleFighter,
  target: BattleFighter,
  skill: Skill | null,
  rng: () => number,
  kind: 'normal' | 'physical' | 'strategy',
  statRule?: SkillDamageStatRule,
  bingxueContext?: {
    candidates?: BattleFighter[]
    dot?: boolean
    normalAttack?: boolean
    skillType?: ReturnType<typeof battleSkillType> | null
    prepared?: boolean
    turn?: number
  },
): DamageResolution => {
  const actualKind = kind === 'normal' ? 'physical' : kind
  // 疲弊中も通常攻撃・戦法は発動するが、そこから発生するダメージは0になる。
  if (hasControlStatus(caster, '疲弊')) return { amount: 0, critical: false }
  const currentTurn = bingxueContext?.turn ?? 0
  // 鉄壁は次の被ダメージを1回だけ無効化する。
  if ((target.specialState.ironWallCharges ?? 0) > 0) {
    target.specialState.ironWallCharges -= 1
    return { amount: 0, critical: false }
  }
  // 回避効果はダメージ計算前に判定する。
  if (
    currentTurn > 0
    && (target.specialState.skillEvasionUntil ?? 0) >= currentTurn
    && rng() < (target.specialState.skillEvasionChance ?? 0) / 100
  ) return { amount: 0, critical: false }
  const rate = damageRate(skill)
  const attackStat = actualKind === 'strategy' ? statOf(caster, 'int') : statOf(caster, 'val')
  const defenseStat = actualKind === 'strategy' ? statOf(target, 'int') : statOf(target, 'lea')
  const damageBase = statRule
    ? statRule.coefficient * (
        statRule.attackStats.reduce((sum, stat) => sum + statOf(caster, stat), 0)
        - statRule.defenseStats.reduce((sum, stat) => sum + statOf(target, stat), 0)
      ) + (0.037 * caster.hp + 175)
    : battleDamageBase(attackStat, defenseStat, caster.hp)
  const resolvedSkillType = bingxueContext?.skillType === undefined
    ? skill ? battleSkillType(skill) : null
    : bingxueContext.skillType
  const variance = 0.9 + rng() * 0.2
  let incomingSpecialMultiplier = 1
  if (resolvedSkillType === '能動') {
    incomingSpecialMultiplier += (target.buffs.activeDamageTaken ?? 0) / 100
    if ((target.specialState.nextActiveDamageTaken ?? 0) !== 0) {
      incomingSpecialMultiplier += (target.specialState.nextActiveDamageTaken ?? 0) / 100
      target.specialState.nextActiveDamageTaken = 0
    }
  }
  if ((target.specialState.nextDamageTakenBonus ?? 0) !== 0) {
    incomingSpecialMultiplier += (target.specialState.nextDamageTakenBonus ?? 0) / 100
    target.specialState.nextDamageTakenBonus = 0
  }
  // 大太刀力士隊は最初の2ターンだけ、通常攻撃と突撃戦法の被ダメージを個別に軽減する。
  const isNormalAttack = kind === 'normal' || bingxueContext?.normalAttack === true
  if (
    currentTurn > 0
    && (target.specialState.odachiReductionUntil ?? 0) >= currentTurn
    && (isNormalAttack || resolvedSkillType === '突撃')
  ) {
    incomingSpecialMultiplier *= 1 - Math.min(0.9, (target.specialState.odachiReductionPercent ?? 0) / 100)
  }
  // 攻守兼備は発動ターン中、兵刃・計略それぞれ最初の被ダメージを軽減する。
  if ((target.specialState.attackDefenseUntil ?? 0) >= currentTurn && currentTurn > 0) {
    const seenKey = actualKind === 'physical' ? 'attackDefensePhysicalTurn' : 'attackDefenseStrategyTurn'
    if ((target.specialState[seenKey] ?? 0) !== currentTurn) {
      target.specialState[seenKey] = currentTurn
      incomingSpecialMultiplier *= 0.6
    }
  }
  // 御旗楯無は被ダメージごとに、武勇依存の確率で知略依存の軽減を行う。
  if ((target.specialState.mihataPassive ?? 0) > 0) {
    const chance = Math.min(0.95, 0.4 + Math.max(0, statOf(target, 'val') - 100) * 0.001)
    if (rng() < chance) {
      const reduction = Math.min(0.8, 0.4 + Math.max(0, statOf(target, 'int') - 100) * 0.001)
      incomingSpecialMultiplier *= 1 - reduction
    }
  }
  const modifier = damageModifier(caster, true, actualKind) * damageModifier(target, false, actualKind)
  const raw = damageBase * (rate / 100) * modifier * variance
  const floor = guaranteedDamageFloor(caster.hp, rate, Boolean(skill)) * variance
  const bingxueDamage = resolveBingxueDamage({
    attacker: caster,
    target,
    kind: actualKind,
    skill,
    skillType: resolvedSkillType,
    prepared: bingxueContext?.prepared ?? Boolean(skill && preparationTurns(skill) > 0),
    dot: bingxueContext?.dot ?? false,
    candidates: bingxueContext?.candidates ?? [target],
    rng,
  })
  if (bingxueDamage.evaded) return { amount: 0, critical: false }
  // 兵種相性は、最低保証を含むダメージが確定した後に全体へ掛ける。
  return {
    amount: Math.max(floor, raw) * incomingSpecialMultiplier * bingxueDamage.multiplier * caster.troopAffinityModifier,
    critical: bingxueDamage.critical,
  }
}

const baseHeal = (caster: BattleFighter, target: BattleFighter, skill: Skill, rng: () => number): number => {
  const rate = healRate(skill)
  // 兵種戦法の回生・休養には統率依存があるため、武勇・知略とは別の回復軸として扱う。
  const mainStat = skill.battle_type === 'leadership'
    ? statOf(caster, 'lea')
    : skill.battle_type === 'bravery'
      ? statOf(caster, 'val')
      : statOf(caster, 'int')
  const variance = 0.92 + rng() * 0.16
  const receivedMultiplier = Math.max(0, 1 + (target.buffs.healingReceived ?? 0) / 100)
  return Math.max(20, (mainStat * 7.5 + 480) * (rate / 100) * variance) * bingxueHealMultiplier(caster, target) * receivedMultiplier
}

const applyGenericBuffs = (
  skill: Skill,
  caster: BattleFighter,
  targets: BattleFighter[],
) => {
  const rawValue = Number(String(skill.effect_value ?? '').match(/\d+(?:\.\d+)?/)?.[0] ?? 0)
  const value = rawValue || pickMaxVarRate(skill, [
    'damage_buff',
    'damage_buff_base',
    'dmg_reduce',
    'damage_reduction',
    'stat_buff',
    'speed_buff',
    'valor_buff_at_threshold',
    'intelligence_buff',
    'valor_speed_buff',
  ]) || 0
  if (!value) return
  const text = `${skill.buff_types ?? ''} ${skill.debuff_types ?? ''} ${skill.description_jp ?? ''}`
  targets.forEach((target) => {
    if (/与ダメ/.test(text) && /減|低下|DOWN/i.test(text)) target.buffs.damageDealt = (target.buffs.damageDealt ?? 0) - value
    else if (/与ダメ/.test(text)) target.buffs.damageDealt = (target.buffs.damageDealt ?? 0) + value
    if (/被ダメ/.test(text) && /増/.test(text)) target.buffs.damageTaken = (target.buffs.damageTaken ?? 0) + value
    else if (/被ダメ|兵力損害/.test(text)) target.buffs.damageTaken = (target.buffs.damageTaken ?? 0) - value
    if (/武勇/.test(text)) target.buffs.val = (target.buffs.val ?? 0) + (/DOWN|低下|減少/.test(text) ? -value : value)
    if (/知略/.test(text)) target.buffs.int = (target.buffs.int ?? 0) + (/DOWN|低下|減少/.test(text) ? -value : value)
    if (/統率/.test(text)) target.buffs.lea = (target.buffs.lea ?? 0) + (/DOWN|低下|減少/.test(text) ? -value : value)
    if (/速度/.test(text)) target.buffs.spd = (target.buffs.spd ?? 0) + (/DOWN|低下|減少/.test(text) ? -value : value)
  })
  if (/自身/.test(textOfSkill(skill)) && targets.length === 0) {
    caster.buffs.damageDealt = (caster.buffs.damageDealt ?? 0) + value
  }
}

const applyControl = (
  ctx: SkillResolveContext,
  targets: BattleFighter[],
) => {
  const { skill, caster, allies, enemies, logs, turn, rng, stats, turnStat, controlStats } = ctx
  const inferred = ['無策', '封撃', '麻痺', '混乱', '挑発', '牽制', '畏縮', '萎縮', '疲弊', '威圧', '回復不可']
    .filter((name) => textOfSkill(skill).includes(name))
  const controlNames = [
    ...String(skill.control_type ?? '').split('/').map((name) => name.trim()).filter(Boolean),
    ...inferred,
  ].filter((name, index, all) => all.indexOf(name) === index)
  if (controlNames.length === 0) return
  const duration = Math.max(1, Math.round(skill.control_turns ?? 1))
  for (const name of controlNames) {
    targets.forEach((target) => {
      if ((target.specialState.insightUntil ?? 0) >= turn) {
        if (logs !== NO_LOGS) logs.push({ turn, side: target.side, actor: target.name, actorHp: target.hp, message: `${target.name}は洞察で${name}を無効化` })
        return
      }
      if (controlBlockedByBingxue(target, name)) {
        if (logs !== NO_LOGS) logs.push({
          turn,
          side: target.side,
          actor: target.name,
          actorHp: target.hp,
          message: `兵学の耐性で${name}を防いだ`,
        })
        return
      }
      if (!applyControlStatus(caster, target, name, duration)) return
      controlStats[name] = (controlStats[name] ?? 0) + 1
      if (logs !== NO_LOGS) logs.push({ turn, side: caster.side, actor: caster.name, actorHp: caster.hp, message: `${skill.name_jp || skill.name}: ${target.name}に${name}(${duration}T)` })
      const targetAllies = target.side === caster.side ? allies : enemies
      const targetEnemies = target.side === caster.side ? enemies : allies
      runBingxueControlApplied(
        caster,
        target,
        targetAllies,
        targetEnemies,
        turn,
        rng,
        createBingxueHelpers(allies, enemies, turn, logs, rng, stats, turnStat, controlStats),
      )
    })
  }
}

const applyDot = (
  skill: Skill,
  targets: BattleFighter[],
  caster: BattleFighter,
  turn: number,
  logs: BattleLogEntry[],
) => {
  if (!skill.dot_name || !skill.dot_rate_max) return
  const duration = Math.max(1, Math.round(skill.dot_turns ?? 1))
  targets.forEach((target) => {
    if (
      (target.specialState.monkNonBurnDotImmune ?? 0) > 0
      && CONTINUOUS_DAMAGE_STATUS_NAMES.has(skill.dot_name!)
      && skill.dot_name !== '火傷'
    ) return
    target.timedStatuses.push({
      name: skill.dot_name!,
      turns: duration,
      sourceSkill: skill.name_jp || skill.name,
      sourceActorId: caster.id,
      sourceActor: caster.name,
      dotRate: normalizeRate(skill.dot_rate_max!),
      dotType: damageKind(skill),
    })
    if (logs !== NO_LOGS) logs.push({
      turn,
      side: caster.side,
      actor: caster.name,
      actorHp: caster.hp,
      target: target.name,
      targetSide: target.side,
      message: `${target.name}に${skill.dot_name}(${duration}T)`,
    })
  })
}

export interface SkillResolveContext {
  caster: BattleFighter
  target: BattleFighter | null
  allies: BattleFighter[]
  enemies: BattleFighter[]
  skill: Skill
  trigger: BattleTrigger
  turn: number
  logs: BattleLogEntry[]
  rng: () => number
  stats: SkillStatMap
  turnStat: BattleTurnStat
  controlStats: Record<string, number>
  // 受撃・回復などのイベントが実際に発生した武将。targetは効果の発生源を指す。
  eventSubject?: BattleFighter
}

const isSameSkill = (a: Skill, b: Skill): boolean => skillKeyForDedup(a) === skillKeyForDedup(b)
const isUniqueBattleSkill = (skill: Skill): boolean =>
  Boolean(skill.is_unique || skill.unique_hero || /固有戦法/.test(skill.game8_kind ?? ''))

const skillDisplayName = (skill: Skill): string => skill.name_jp || skill.name
const varNumber = (skill: Skill, key: string, fallback: number): number => pickMaxVar(skill, [key]) ?? fallback
const aliveRandom = (
  fighters: BattleFighter[],
  rng: () => number,
  ctx?: SkillResolveContext,
): BattleFighter[] => {
  const candidates = ctx
    ? controlledRandomCandidates(ctx.caster, fighters, ctx.allies, ctx.enemies, 'skill')
    : living(fighters)
  return [...candidates].sort(() => rng() - 0.5)
}
const weakest = (fighters: BattleFighter[], count: number): BattleFighter[] =>
  [...living(fighters)].sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp)).slice(0, count)
const roll = (rng: () => number, chance: number): boolean => rng() < clamp(chance, 0, 1)
const orderedBattleSkills = (skills: Skill[]): Skill[] =>
  [...skills].sort((a, b) => compareBattleSkillPriority(a, b) || skillDisplayName(a).localeCompare(skillDisplayName(b), 'ja'))

const fireTriggeredSkillList = (
  owner: BattleFighter,
  skills: Skill[],
  trigger: BattleTrigger,
  target: BattleFighter | null,
  allies: BattleFighter[],
  enemies: BattleFighter[],
  turn: number,
  logs: BattleLogEntry[],
  rng: () => number,
  stats: SkillStatMap,
  turnStat: BattleTurnStat,
  controlStats: Record<string, number>,
  skipSkill?: Skill,
  eventSubject?: BattleFighter,
) => {
  orderedBattleSkills(skills).forEach((skill) => {
    if (skipSkill && isSameSkill(skill, skipSkill)) return
    trySkill(skill, trigger, owner, target, allies, enemies, turn, logs, rng, stats, turnStat, controlStats, eventSubject)
  })
}

const fireTriggeredSkills = (
  owner: BattleFighter,
  trigger: BattleTrigger,
  target: BattleFighter | null,
  allies: BattleFighter[],
  enemies: BattleFighter[],
  turn: number,
  logs: BattleLogEntry[],
  rng: () => number,
  stats: SkillStatMap,
  turnStat: BattleTurnStat,
  controlStats: Record<string, number>,
  skipSkill?: Skill,
  eventSubject?: BattleFighter,
) => {
  fireTriggeredSkillList(
    owner,
    owner.skills,
    trigger,
    target,
    allies,
    enemies,
    turn,
    logs,
    rng,
    stats,
    turnStat,
    controlStats,
    skipSkill,
    eventSubject,
  )
}

const skillsNamedIn = (owner: BattleFighter, names: Set<string>): Skill[] =>
  owner.skills.filter((skill) => names.has(skillDisplayName(skill)) || names.has(skill.name))

// ダメージを受けた本人以外が監視する戦法を、攻撃側・被攻撃側の向きを保って処理する。
const fireDamageWatcherSkills = (
  source: BattleFighter,
  damaged: BattleFighter,
  kind: 'physical' | 'strategy',
  damagedAllies: BattleFighter[],
  damagedEnemies: BattleFighter[],
  turn: number,
  logs: BattleLogEntry[],
  rng: () => number,
  stats: SkillStatMap,
  turnStat: BattleTurnStat,
  controlStats: Record<string, number>,
) => {
  // 被ダメージ本人が所有する戦法は直前の通常処理で発動済みなので、監視側では重複させない。
  damagedAllies.filter((owner) => owner.id !== damaged.id && isAlive(owner)).forEach((owner) => {
    const skills = skillsNamedIn(owner, TEAM_DAMAGE_RECEIVED_SKILL_NAMES)
    if (skills.length === 0) return
    fireTriggeredSkillList(
      owner,
      skills,
      kind === 'strategy' ? 'onStrategyDamageReceived' : 'onPhysicalDamageReceived',
      source,
      damagedAllies,
      damagedEnemies,
      turn,
      logs,
      rng,
      stats,
      turnStat,
      controlStats,
      undefined,
      damaged,
    )
  })

  if (kind !== 'strategy') return
  damagedEnemies.filter(isAlive).forEach((owner) => {
    const skills = skillsNamedIn(owner, ENEMY_STRATEGY_DAMAGE_RECEIVED_SKILL_NAMES)
    if (skills.length === 0) return
    fireTriggeredSkillList(
      owner,
      skills,
      'onStrategyDamageReceived',
      damaged,
      damagedEnemies,
      damagedAllies,
      turn,
      logs,
      rng,
      stats,
      turnStat,
      controlStats,
      undefined,
      damaged,
    )
  })
}

// 部隊内の誰かが持つ「全武将の行動を起点にする戦法」を、重複なしで取得する。
const teamActionBattleSkills = (allies: BattleFighter[]): Skill[] => {
  const skills = allies.flatMap((ally) => ally.skills).filter((skill) =>
    TEAM_ACTION_BATTLE_SKILL_NAMES.has(skillDisplayName(skill))
    || TEAM_ACTION_BATTLE_SKILL_NAMES.has(skill.name),
  )
  return skills.filter((skill, index) =>
    skills.findIndex((candidate) => isSameSkill(candidate, skill)) === index,
  )
}

// 竜騎兵の行動後装填は、役割ではなく伊達政宗本人が戦法を装備していることが条件。
const dateMasamuneHasDragonCavalry = (allies: BattleFighter[]): boolean =>
  allies.some((ally) =>
    ally.name === '伊達政宗'
    && ally.skills.some((skill) =>
      TEAM_ACTION_BATTLE_SKILL_NAMES.has(skillDisplayName(skill))
      || TEAM_ACTION_BATTLE_SKILL_NAMES.has(skill.name),
    ),
  )

const fireBeforeUniqueSkill = (
  owner: BattleFighter,
  uniqueSkill: Skill,
  target: BattleFighter | null,
  allies: BattleFighter[],
  enemies: BattleFighter[],
  turn: number,
  logs: BattleLogEntry[],
  rng: () => number,
  stats: SkillStatMap,
  turnStat: BattleTurnStat,
  controlStats: Record<string, number>,
) => {
  fireTriggeredSkills(owner, 'beforeUniqueSkill', target, allies, enemies, turn, logs, rng, stats, turnStat, controlStats, uniqueSkill)
}

const withRate = (skill: Skill, rate: number, kind?: 'bravery' | 'strategy'): Skill => ({
  ...skill,
  damage_rate_max: rate,
  battle_type: kind ?? skill.battle_type,
})

const withHealRate = (skill: Skill, rate: number, kind?: 'bravery' | 'strategy' | 'leadership'): Skill => ({
  ...skill,
  heal_rate_max: rate,
  battle_type: kind ?? skill.battle_type,
})

// 兵学で得た離反・心攻を、実際に与えたダメージを基準に回復へ変換する。
const applyBingxueLifeSteal = (
  source: BattleFighter,
  damage: number,
  turn: number,
  logs: BattleLogEntry[],
  turnStat: BattleTurnStat,
): number => {
  const percent = bingxueLifeStealPercent(source)
  if (damage <= 0 || percent <= 0 || !isAlive(source)) return 0
  const beforeHp = source.hp
  const beforeWounded = source.wounded
  const actual = applyHeal(source, damage * percent / 100)
  if (actual <= 0) return 0
  const healedWounded = beforeWounded - source.wounded
  if (source.side === 'ally') turnStat.allyHealing += actual
  else turnStat.enemyHealing += actual
  if (logs !== NO_LOGS) logs.push({
    turn,
    side: source.side,
    actor: source.name,
    actorHp: source.hp,
    target: source.name,
    targetSide: source.side,
    amount: actual,
    beforeHp,
    afterHp: source.hp,
    woundedDelta: -healedWounded,
    deadDelta: 0,
    valueType: 'healing',
    effect: '兵学・離反/心攻',
    message: `兵学の離反・心攻で${source.name}を${actual.toLocaleString()}回復 ${hpChangeText(beforeHp, source.hp)} / 負傷兵${healedWounded.toLocaleString()}復帰`,
  })
  return actual
}

// 戦法で付与された離反は、実際に与えた兵刃ダメージの割合だけ負傷兵を回復する。
const applyPhysicalLifeSteal = (
  source: BattleFighter,
  damage: number,
  turn: number,
  logs: BattleLogEntry[],
  turnStat: BattleTurnStat,
): number => {
  const percent = source.specialState.physicalLifeStealPercent ?? 0
  const until = source.specialState.physicalLifeStealUntil ?? 0
  if (damage <= 0 || percent <= 0 || until < turn || !isAlive(source)) return 0
  const beforeHp = source.hp
  const beforeWounded = source.wounded
  const actual = applyHeal(source, damage * percent / 100)
  if (actual <= 0) return 0
  const healedWounded = beforeWounded - source.wounded
  if (source.side === 'ally') turnStat.allyHealing += actual
  else turnStat.enemyHealing += actual
  if (logs !== NO_LOGS) logs.push({
    turn,
    side: source.side,
    actor: source.name,
    actorHp: source.hp,
    target: source.name,
    targetSide: source.side,
    amount: actual,
    beforeHp,
    afterHp: source.hp,
    woundedDelta: -healedWounded,
    deadDelta: 0,
    valueType: 'healing',
    effect: '離反',
    message: `離反で${source.name}を${actual.toLocaleString()}回復 ${hpChangeText(beforeHp, source.hp)} / 負傷兵${healedWounded.toLocaleString()}復帰`,
  })
  return actual
}

const RED_ARMOR_SKILL_NAMES = new Set(['赤備え隊', '赤備隊'])

// 飯富虎昌が赤備え隊を装備している時、部隊全体の会心ダメージ回数を共有して数える。
// 10回へ到達した直後に回数をリセットし、生存中の各武将が88%の全軍出撃を行う。
function resolveRedArmorCriticalHit(
  ctx: SkillResolveContext,
  kind: 'physical' | 'strategy',
  critical: boolean,
  actualDamage: number,
) {
  if (kind !== 'physical' || !critical || actualDamage <= 0) return
  const owner = ctx.allies.find((ally) =>
    ally.name === '飯富虎昌'
    && ally.skills.some((skill) => RED_ARMOR_SKILL_NAMES.has(skillDisplayName(skill)) || RED_ARMOR_SKILL_NAMES.has(skill.name)),
  )
  if (!owner) return
  const skill = owner.skills.find((candidate) =>
    RED_ARMOR_SKILL_NAMES.has(skillDisplayName(candidate)) || RED_ARMOR_SKILL_NAMES.has(candidate.name),
  )
  if (!skill) return

  const hits = (owner.specialState.redArmorCriticalHits ?? 0) + 1
  owner.specialState.redArmorCriticalHits = hits
  if (hits < 10) return
  // 追加攻撃で会心が出ても同じ10回分へ戻らないよう、攻撃前に0へ戻す。
  owner.specialState.redArmorCriticalHits = 0
  if (ctx.logs !== NO_LOGS) ctx.logs.push({
    turn: ctx.turn,
    side: owner.side,
    actor: owner.name,
    actorHp: owner.hp,
    effect: '赤備え隊',
    message: '赤備え隊: 会心ダメージ累計10回、全軍出撃を発動',
  })

  living(ctx.allies).forEach((attacker) => {
    const target = chooseControlledTarget(attacker, ctx.enemies, ctx.allies, ctx.enemies, ctx.rng)
    if (!target) return
    dealSkillDamage({ ...ctx, caster: attacker, target, skill, trigger: 'afterNormalAttack' }, target, 88, 'physical')
  })
}

const dealSkillDamage = (
  ctx: SkillResolveContext,
  target: BattleFighter,
  rate: number,
  kind: 'physical' | 'strategy' = damageKind(ctx.skill),
  statRule?: SkillDamageStatRule,
) => {
  if (ctx.trigger === 'preparationTurn') return 0
  if (!isAlive(target)) return 0
  const beforeHp = target.hp
  const beforeWounded = target.wounded
  const beforeDead = target.dead
  const resolvedDamage = baseDamage(
    ctx.caster,
    target,
    withRate(ctx.skill, rate, kind === 'strategy' ? 'strategy' : 'bravery'),
    ctx.rng,
    kind,
    statRule,
    {
      candidates: target.side === ctx.caster.side ? ctx.allies : ctx.enemies,
      skillType: battleSkillType(ctx.skill),
      turn: ctx.turn,
    },
  )
  const actual = applyDamage(target, resolvedDamage.amount)
  const afterHp = target.hp
  const woundedDelta = target.wounded - beforeWounded
  const deadDelta = target.dead - beforeDead
  recordDamage(ctx.stats, ctx.caster, ctx.skill, actual)
  if (ctx.caster.side === 'ally') ctx.turnStat.allyDamage += actual
  else ctx.turnStat.enemyDamage += actual
  if (ctx.logs !== NO_LOGS) ctx.logs.push({
    turn: ctx.turn,
    side: ctx.caster.side,
    actor: ctx.caster.name,
    actorHp: ctx.caster.hp,
    target: target.name,
    targetSide: target.side,
    amount: actual,
    beforeHp,
    afterHp,
    woundedDelta,
    deadDelta,
    valueType: 'damage',
    effect: skillDisplayName(ctx.skill),
    message: `${skillDisplayName(ctx.skill)}で${target.name}に${actual.toLocaleString()}ダメージ ${hpChangeText(beforeHp, afterHp)} / ${casualtyText(woundedDelta, deadDelta)}`,
  })
  if (actual > 0) {
    recordDamageDealtSkillEffects(ctx.caster, kind, ctx.turn, ctx.logs)
    resolveRedArmorCriticalHit(ctx, kind, resolvedDamage.critical, actual)
    applyBingxueLifeSteal(ctx.caster, actual, ctx.turn, ctx.logs, ctx.turnStat)
    if (kind === 'physical') applyPhysicalLifeSteal(ctx.caster, actual, ctx.turn, ctx.logs, ctx.turnStat)
    resolveSeventyTwoCriticalDamage(ctx, kind, resolvedDamage.critical, actual)
    const targetAllies = target.side === ctx.caster.side ? ctx.allies : ctx.enemies
    const targetEnemies = target.side === ctx.caster.side ? ctx.enemies : ctx.allies
    fireTriggeredSkills(
      target,
      kind === 'strategy' ? 'onStrategyDamageReceived' : 'onPhysicalDamageReceived',
      ctx.caster,
      targetAllies,
      targetEnemies,
      ctx.turn,
      ctx.logs,
      ctx.rng,
      ctx.stats,
      ctx.turnStat,
      ctx.controlStats,
    )
    fireDamageWatcherSkills(
      ctx.caster,
      target,
      kind,
      targetAllies,
      targetEnemies,
      ctx.turn,
      ctx.logs,
      ctx.rng,
      ctx.stats,
      ctx.turnStat,
      ctx.controlStats,
    )
  }
  return actual
}

const hasSkillNamed = (fighter: BattleFighter, name: string) =>
  fighter.skills.some((skill) => skillDisplayName(skill) === name || skill.name === name || skill.name_jp === name)

const hasAnySkillNamed = (fighter: BattleFighter, names: string[]) =>
  names.some((name) => hasSkillNamed(fighter, name))

const SEVENTY_TWO_SKILL_NAMES = ['七十二の計', '七十二欺計']

/**
 * 七十二の計を持つ武将が奇策ダメージを与えた回数を記録する。
 * 7回目の奇策が成立した直後、一度だけ敵軍全体へ120%の計略ダメージを与える。
 */
function resolveSeventyTwoCriticalDamage(
  ctx: SkillResolveContext,
  kind: 'physical' | 'strategy',
  critical: boolean,
  actualDamage: number,
) {
  if (kind !== 'strategy' || !critical || actualDamage <= 0 || !isAlive(ctx.caster)) return
  if ((ctx.caster.specialState.seventyTwoBurstTriggered ?? 0) > 0) return

  const seventyTwoSkill = ctx.caster.skills.find((skill) =>
    SEVENTY_TWO_SKILL_NAMES.some((name) => skillDisplayName(skill) === name || skill.name === name || skill.name_jp === name),
  )
  if (!seventyTwoSkill) return

  const criticalHits = (ctx.caster.specialState.seventyTwoCriticalHits ?? 0) + 1
  ctx.caster.specialState.seventyTwoCriticalHits = criticalHits
  if (criticalHits < 7) return

  // 追加攻撃自体が奇策になっても再発動しないよう、攻撃より先に発動済みへ切り替える。
  ctx.caster.specialState.seventyTwoBurstTriggered = 1
  if (ctx.logs !== NO_LOGS) ctx.logs.push({
    turn: ctx.turn,
    side: ctx.caster.side,
    actor: ctx.caster.name,
    actorHp: ctx.caster.hp,
    effect: '七十二の計',
    message: '七十二の計: 奇策ダメージを7回与え、敵軍全体への追加攻撃を発動',
  })

  const burstContext: SkillResolveContext = {
    ...ctx,
    skill: seventyTwoSkill,
    trigger: 'beforeAction',
  }
  living(ctx.enemies).forEach((enemy) => {
    dealSkillDamage(burstContext, enemy, 120, 'strategy')
  })
}

const addHealingStock = (
  allies: BattleFighter[],
  amount: number,
  turn: number,
  logs: BattleLogEntry[],
) => {
  const stockAmount = Math.floor(amount * 0.75)
  if (stockAmount <= 0) return

  allies
    .filter((ally) => hasAnySkillNamed(ally, HEAL_STOCK_DAMAGE_SKILL_NAMES))
    .forEach((owner) => {
      owner.specialState.healingStock = (owner.specialState.healingStock ?? 0) + stockAmount
      if (logs !== NO_LOGS) logs.push({
        turn,
        side: owner.side,
        actor: owner.name,
        actorHp: owner.hp,
        message: `${owner.name}の回復蓄積: ${stockAmount}蓄積(合計${owner.specialState.healingStock})`,
      })
    })
}

const healBySkill = (ctx: SkillResolveContext, target: BattleFighter, rate: number, kind: 'bravery' | 'strategy' | 'leadership' = 'strategy') => {
  if (ctx.trigger === 'preparationTurn') return 0
  if (!isAlive(target)) return 0
  const beforeHp = target.hp
  const beforeWounded = target.wounded
  const lowestRatioBeforeHeal = Math.min(...living(ctx.allies).map(ally => ally.hp / Math.max(1, ally.maxHp)))
  const wasLowestBeforeHeal = target.hp / Math.max(1, target.maxHp) <= lowestRatioBeforeHeal
  const actual = applyHeal(target, baseHeal(ctx.caster, target, withHealRate(ctx.skill, rate, kind), ctx.rng))
  const afterHp = target.hp
  const healedWounded = beforeWounded - target.wounded
  recordHealing(ctx.stats, ctx.caster, ctx.skill, actual)
  if (ctx.caster.side === 'ally') ctx.turnStat.allyHealing += actual
  else ctx.turnStat.enemyHealing += actual
  if (ctx.logs !== NO_LOGS) ctx.logs.push({
    turn: ctx.turn,
    side: ctx.caster.side,
    actor: ctx.caster.name,
    actorHp: ctx.caster.hp,
    target: target.name,
    targetSide: target.side,
    amount: actual,
    beforeHp,
    afterHp,
    woundedDelta: -healedWounded,
    deadDelta: 0,
    valueType: 'healing',
    effect: skillDisplayName(ctx.skill),
    message: `${skillDisplayName(ctx.skill)}で${target.name}を${actual.toLocaleString()}回復 ${hpChangeText(beforeHp, afterHp)} / 負傷兵${healedWounded.toLocaleString()}復帰`,
  })
  if (actual > 0) {
    addHealingStock(ctx.allies, actual, ctx.turn, ctx.logs)
    runBingxueSkillHeal(
      ctx.caster,
      target,
      ctx.allies,
      ctx.turn,
      createBingxueHelpers(ctx.allies, ctx.enemies, ctx.turn, ctx.logs, ctx.rng, ctx.stats, ctx.turnStat, ctx.controlStats),
      wasLowestBeforeHeal,
    )
    const targetAllies = target.side === ctx.caster.side ? ctx.allies : ctx.enemies
    const targetEnemies = target.side === ctx.caster.side ? ctx.enemies : ctx.allies
    fireTriggeredSkills(
      target,
      'onHealed',
      ctx.caster,
      targetAllies,
      targetEnemies,
      ctx.turn,
      ctx.logs,
      ctx.rng,
      ctx.stats,
      ctx.turnStat,
      ctx.controlStats,
    )
  }
  return actual
}

/**
 * 兵学専用ファイルから、戦闘本体のダメージ・回復・ログ処理を安全に呼ぶための窓口。
 * 兵学側ではHPや負傷兵を直接書き換えず、必ずこのヘルパーを経由する。
 */
const createBingxueHelpers = (
  allies: BattleFighter[],
  enemies: BattleFighter[],
  turn: number,
  logs: BattleLogEntry[],
  rng: () => number,
  stats: SkillStatMap,
  turnStat: BattleTurnStat,
  controlStats: Record<string, number>,
): BingxueActionHelpers => ({
  statOf,
  log: (owner, message) => {
    if (logs !== NO_LOGS) logs.push({
      turn,
      side: owner.side,
      actor: owner.name,
      actorHp: owner.hp,
      effect: '兵学',
      message,
    })
  },
  heal: (owner, target, rate, effect) => {
    if (!isAlive(owner) || !isAlive(target)) return 0
    const pseudoSkill = {
      id: `bingxue:${effect}`,
      name: effect,
      name_jp: effect,
      battle_type: 'strategy',
      heal_rate_max: rate,
    } as Skill
    const beforeHp = target.hp
    const beforeWounded = target.wounded
    const actual = applyHeal(target, baseHeal(owner, target, pseudoSkill, rng))
    if (actual <= 0) return 0
    const healedWounded = beforeWounded - target.wounded
    if (owner.side === 'ally') turnStat.allyHealing += actual
    else turnStat.enemyHealing += actual
    if (logs !== NO_LOGS) logs.push({
      turn,
      side: owner.side,
      actor: owner.name,
      actorHp: owner.hp,
      target: target.name,
      targetSide: target.side,
      amount: actual,
      beforeHp,
      afterHp: target.hp,
      woundedDelta: -healedWounded,
      deadDelta: 0,
      valueType: 'healing',
      effect,
      message: `${effect}で${target.name}を${actual.toLocaleString()}回復 ${hpChangeText(beforeHp, target.hp)} / 負傷兵${healedWounded.toLocaleString()}復帰`,
    })
    return actual
  },
  damage: (owner, target, rate, kind, effect) => {
    if (!isAlive(owner) || !isAlive(target)) return 0
    const pseudoSkill = {
      id: `bingxue:${effect}`,
      name: effect,
      name_jp: effect,
      battle_type: kind === 'strategy' ? 'strategy' : 'bravery',
      damage_rate_max: rate,
    } as Skill
    const beforeHp = target.hp
    const beforeWounded = target.wounded
    const beforeDead = target.dead
    const allFighters = [...allies, ...enemies]
    const targetCandidates = allFighters.filter(fighter => fighter.side === target.side)
    const resolvedDamage = baseDamage(owner, target, pseudoSkill, rng, kind, undefined, {
      candidates: targetCandidates,
      skillType: null,
      turn,
    })
    const actual = applyDamage(target, resolvedDamage.amount)
    if (owner.side === 'ally') turnStat.allyDamage += actual
    else turnStat.enemyDamage += actual
    const woundedDelta = target.wounded - beforeWounded
    const deadDelta = target.dead - beforeDead
    if (logs !== NO_LOGS) logs.push({
      turn,
      side: owner.side,
      actor: owner.name,
      actorHp: owner.hp,
      target: target.name,
      targetSide: target.side,
      amount: actual,
      beforeHp,
      afterHp: target.hp,
      woundedDelta,
      deadDelta,
      valueType: 'damage',
      effect,
      message: `${effect}で${target.name}に${actual.toLocaleString()}ダメージ ${hpChangeText(beforeHp, target.hp)} / ${casualtyText(woundedDelta, deadDelta)}`,
    })
    if (actual > 0) {
      recordDamageDealtSkillEffects(owner, kind, turn, logs)
      applyBingxueLifeSteal(owner, actual, turn, logs, turnStat)
      if (kind === 'physical') applyPhysicalLifeSteal(owner, actual, turn, logs, turnStat)
      const ownerAllies = allFighters.filter(fighter => fighter.side === owner.side)
      const ownerEnemies = allFighters.filter(fighter => fighter.side !== owner.side)
      resolveRedArmorCriticalHit({
        caster: owner,
        target,
        allies: ownerAllies,
        enemies: ownerEnemies,
        skill: pseudoSkill,
        trigger: 'beforeAction',
        turn,
        logs,
        rng,
        stats,
        turnStat,
        controlStats,
      }, kind, resolvedDamage.critical, actual)
      resolveSeventyTwoCriticalDamage({
        caster: owner,
        target,
        allies: ownerAllies,
        enemies: ownerEnemies,
        skill: pseudoSkill,
        trigger: 'beforeAction',
        turn,
        logs,
        rng,
        stats,
        turnStat,
        controlStats,
      }, kind, resolvedDamage.critical, actual)
      const targetAllies = allFighters.filter(fighter => fighter.side === target.side)
      const targetEnemies = allFighters.filter(fighter => fighter.side !== target.side)
      fireTriggeredSkills(
        target,
        kind === 'strategy' ? 'onStrategyDamageReceived' : 'onPhysicalDamageReceived',
        owner,
        targetAllies,
        targetEnemies,
        turn,
        logs,
        rng,
        stats,
        turnStat,
        controlStats,
      )
      fireDamageWatcherSkills(
        owner,
        target,
        kind,
        targetAllies,
        targetEnemies,
        turn,
        logs,
        rng,
        stats,
        turnStat,
        controlStats,
      )
    }
    return actual
  },
  cleanse: (target, count) => {
    const removed = Object.keys(target.statuses)
      .filter(name => name !== '先攻' && !name.endsWith('耐性'))
      .slice(0, count)
    removed.forEach(name => clearControlStatus(target, name))
    return removed
  },
})

const addControl = (ctx: SkillResolveContext, target: BattleFighter, name: string, duration: number) => {
  if (!isAlive(target)) return
  if ((target.specialState.insightUntil ?? 0) >= ctx.turn) {
    if (ctx.logs !== NO_LOGS) ctx.logs.push({
      turn: ctx.turn,
      side: target.side,
      actor: target.name,
      actorHp: target.hp,
      message: `${target.name}は洞察で${name}を無効化`,
    })
    return
  }
  if (controlBlockedByBingxue(target, name)) {
    if (ctx.logs !== NO_LOGS) ctx.logs.push({
      turn: ctx.turn,
      side: target.side,
      actor: target.name,
      actorHp: target.hp,
      message: `兵学の耐性で${name}を防いだ`,
    })
    return
  }
  if (!applyControlStatus(ctx.caster, target, name, duration)) return
  ctx.controlStats[name] = (ctx.controlStats[name] ?? 0) + 1
  if (ctx.logs !== NO_LOGS) ctx.logs.push({
    turn: ctx.turn,
    side: ctx.caster.side,
    actor: ctx.caster.name,
    actorHp: ctx.caster.hp,
    target: target.name,
    targetSide: target.side,
    message: `${skillDisplayName(ctx.skill)}: ${target.name}に${name}(${duration}T)`,
  })
  const targetAllies = target.side === ctx.caster.side ? ctx.allies : ctx.enemies
  const targetEnemies = target.side === ctx.caster.side ? ctx.enemies : ctx.allies
  runBingxueControlApplied(
    ctx.caster,
    target,
    targetAllies,
    targetEnemies,
    ctx.turn,
    ctx.rng,
    createBingxueHelpers(ctx.allies, ctx.enemies, ctx.turn, ctx.logs, ctx.rng, ctx.stats, ctx.turnStat, ctx.controlStats),
  )
}

const addTimedModifier = (
  ctx: SkillResolveContext,
  target: BattleFighter,
  stat: Stat,
  value: number,
  duration: number,
  maxStacks = Number.POSITIVE_INFINITY,
) => {
  if (!isAlive(target) || value === 0) return
  const sourceSkill = skillDisplayName(ctx.skill)
  const key = `${sourceSkill}:${stat}`
  const sameModifiers = target.timedModifiers.filter((modifier) => modifier.key === key)

  // 上限へ達した場合は最も早く切れる古い1層を外してから、新しい1層を加える。
  if (sameModifiers.length >= maxStacks) {
    const oldest = [...sameModifiers].sort((a, b) => a.expiresTurn - b.expiresTurn)[0]
    if (oldest) {
      target.buffs[oldest.stat] = (target.buffs[oldest.stat] ?? 0) - oldest.value
      target.timedModifiers = target.timedModifiers.filter((modifier) => modifier !== oldest)
    }
  }

  target.buffs[stat] = (target.buffs[stat] ?? 0) + value
  target.timedModifiers.push({
    key,
    stat,
    value,
    // 準備ターン(0)で付与した1ターン効果も、第1ターン中は有効にする。
    expiresTurn: Math.max(1, ctx.turn) + Math.max(1, Math.round(duration)),
    sourceSkill,
  })
}

// 戦法ごとの基礎発動率に、兵学・兵種戦法・弱体効果の補正を加えた最終発動率を返す。
// 発動判定と効果ログで同じ計算を使い、表示値と実際の抽選確率を一致させる。
const activationRateOf = (caster: BattleFighter, skill: Skill): number => {
  const resolvedSkillName = skillDisplayName(skill)
  const skillType = battleSkillType(skill)
  const unique = isUniqueBattleSkill(skill)
  const skillActivationBonus = caster.specialState[`activationRateBonus:${resolvedSkillName}`] ?? 0
  const skillActivationPenalty = caster.specialState[`activationRatePenalty:${resolvedSkillName}`] ?? 0
  return clamp(
    extractRate(skill)
      + (caster.buffs.activationRate ?? 0) / 100
      + bingxueActivationChanceBonus(caster, skillType, unique)
      + skillActivationBonus / 100
      - skillActivationPenalty / 100,
    0,
    1,
  )
}

const namedSkillHelpers: BattleSkillEffectHelpers = {
  skillDisplayName,
  chooseTarget: (candidates, rng, ctx) => ctx
    ? chooseControlledTarget(ctx.caster, candidates, ctx.allies, ctx.enemies, rng, 'skill')
    : chooseTarget(candidates, rng),
  resolveTargets: (ctx) => resolveTargets(ctx.skill, ctx.caster, ctx.target, ctx.allies, ctx.enemies, ctx.rng),
  varNumber,
  aliveRandom,
  weakest,
  roll,
  dealSkillDamage,
  healBySkill,
  addControl,
  addTimedModifier,
  statOf,
  activationRateOf,
}

// 個別戦法は battleSkillEffects.ts に集約する。
const applyNamedSkill = (ctx: SkillResolveContext): boolean => applyNamedSkillEffect(ctx, namedSkillHelpers)
const resolveSkill = (
  caster: BattleFighter,
  target: BattleFighter | null,
  allies: BattleFighter[],
  enemies: BattleFighter[],
  skill: Skill,
  trigger: BattleTrigger,
  turn: number,
  logs: BattleLogEntry[],
  rng: () => number,
  stats: SkillStatMap,
  turnStat: BattleTurnStat,
  controlStats: Record<string, number>,
  eventSubject?: BattleFighter,
) => {
  const targets = resolveTargets(skill, caster, target, allies, enemies, rng)
  const skillName = skill.name_jp || skill.name
  const kind = damageKind(skill)
  const rate = damageRate(skill)
  const hRate = healRate(skill)
  const isHeal = hRate > 0 && (/回復|恢復|休養|heal/i.test(textOfSkill(skill)) || rate === 0)
  const canApplyDirectTroopChange = trigger !== 'preparationTurn'

  // 個別実装がある戦法を優先し、未対応の戦法だけ汎用ダメージ/回復/制御へ流す。
  if (applyNamedSkill({ caster, target, allies, enemies, skill, trigger, turn, logs, rng, stats, turnStat, controlStats, eventSubject })) return

  if (canApplyDirectTroopChange && rate > 0 && !isHeal) {
    targets.forEach((fighter) => {
      const beforeHp = fighter.hp
      const beforeWounded = fighter.wounded
      const beforeDead = fighter.dead
      const resolvedDamage = baseDamage(
        caster,
        fighter,
        skill,
        rng,
        kind,
        undefined,
        { candidates: fighter.side === caster.side ? allies : enemies, skillType: battleSkillType(skill), turn },
      )
      const actual = applyDamage(fighter, resolvedDamage.amount)
      const afterHp = fighter.hp
      const woundedDelta = fighter.wounded - beforeWounded
      const deadDelta = fighter.dead - beforeDead
      recordDamage(stats, caster, skill, actual)
      if (caster.side === 'ally') turnStat.allyDamage += actual
      else turnStat.enemyDamage += actual
      if (logs !== NO_LOGS) logs.push({
        turn,
        side: caster.side,
        actor: caster.name,
        actorHp: caster.hp,
        target: fighter.name,
        targetSide: fighter.side,
        amount: actual,
        beforeHp,
        afterHp,
        woundedDelta,
        deadDelta,
        valueType: 'damage',
        effect: skillName,
        message: `${skillName}で${fighter.name}に${actual.toLocaleString()}ダメージ ${hpChangeText(beforeHp, afterHp)} / ${casualtyText(woundedDelta, deadDelta)}`,
      })
      if (actual > 0) {
        recordDamageDealtSkillEffects(caster, kind, turn, logs)
        resolveRedArmorCriticalHit({
          caster,
          target: fighter,
          allies,
          enemies,
          skill,
          trigger,
          turn,
          logs,
          rng,
          stats,
          turnStat,
          controlStats,
          eventSubject,
        }, kind, resolvedDamage.critical, actual)
        applyBingxueLifeSteal(caster, actual, turn, logs, turnStat)
        if (kind === 'physical') applyPhysicalLifeSteal(caster, actual, turn, logs, turnStat)
        resolveSeventyTwoCriticalDamage({
          caster,
          target: fighter,
          allies,
          enemies,
          skill,
          trigger,
          turn,
          logs,
          rng,
          stats,
          turnStat,
          controlStats,
          eventSubject,
        }, kind, resolvedDamage.critical, actual)
        const targetAllies = fighter.side === caster.side ? allies : enemies
        const targetEnemies = fighter.side === caster.side ? enemies : allies
        fireTriggeredSkills(
          fighter,
          kind === 'strategy' ? 'onStrategyDamageReceived' : 'onPhysicalDamageReceived',
          caster,
          targetAllies,
          targetEnemies,
          turn,
          logs,
          rng,
          stats,
          turnStat,
          controlStats,
        )
        fireDamageWatcherSkills(
          caster,
          fighter,
          kind,
          targetAllies,
          targetEnemies,
          turn,
          logs,
          rng,
          stats,
          turnStat,
          controlStats,
        )
      }
    })
  }

  if (canApplyDirectTroopChange && (isHeal || hRate > 0)) {
    const healTargets = targets.length > 0
      ? targets
      : [...living(allies)].sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp)).slice(0, targetCountOf(skill) as number)
    healTargets.forEach((fighter) => {
      const beforeHp = fighter.hp
      const beforeWounded = fighter.wounded
      const lowestRatioBeforeHeal = Math.min(...living(allies).map(ally => ally.hp / Math.max(1, ally.maxHp)))
      const wasLowestBeforeHeal = fighter.hp / Math.max(1, fighter.maxHp) <= lowestRatioBeforeHeal
      const actual = applyHeal(fighter, baseHeal(caster, fighter, skill, rng))
      const afterHp = fighter.hp
      const healedWounded = beforeWounded - fighter.wounded
      recordHealing(stats, caster, skill, actual)
      if (caster.side === 'ally') turnStat.allyHealing += actual
      else turnStat.enemyHealing += actual
      if (logs !== NO_LOGS) logs.push({
        turn,
        side: caster.side,
        actor: caster.name,
        actorHp: caster.hp,
        target: fighter.name,
        targetSide: fighter.side,
        amount: actual,
        beforeHp,
        afterHp,
        woundedDelta: -healedWounded,
        deadDelta: 0,
        valueType: 'healing',
        effect: skillName,
        message: `${skillName}で${fighter.name}を${actual.toLocaleString()}回復 ${hpChangeText(beforeHp, afterHp)} / 負傷兵${healedWounded.toLocaleString()}復帰`,
      })
      if (actual > 0) {
        addHealingStock(allies, actual, turn, logs)
        runBingxueSkillHeal(
          caster,
          fighter,
          allies,
          turn,
          createBingxueHelpers(allies, enemies, turn, logs, rng, stats, turnStat, controlStats),
          wasLowestBeforeHeal,
        )
        const targetAllies = fighter.side === caster.side ? allies : enemies
        const targetEnemies = fighter.side === caster.side ? enemies : allies
        fireTriggeredSkills(fighter, 'onHealed', caster, targetAllies, targetEnemies, turn, logs, rng, stats, turnStat, controlStats)
      }
    })
  }

  applyGenericBuffs(skill, caster, targets)
  applyControl({ caster, target, allies, enemies, skill, trigger, turn, logs, rng, stats, turnStat, controlStats }, targets)
  applyDot(skill, targets, caster, turn, logs)

  if (rate === 0 && hRate === 0 && !skill.control_type && !skill.dot_name && (skill.buff_types || skill.debuff_types)) {
    if (logs !== NO_LOGS) logs.push({ turn, side: caster.side, actor: caster.name, actorHp: caster.hp, message: `${skillName}の効果を適用` })
  }
}

const skillControlBlock = (caster: BattleFighter, skill: Skill): string | null => {
  const type = battleSkillType(skill)
  if (hasControlStatus(caster, '無策') && type === '能動') return '無策'
  if (hasControlStatus(caster, '萎縮') && (type === '指揮' || type === '受動')) {
    return activeControlStatusKey(caster, '萎縮') ?? '萎縮'
  }
  return null
}

const logSkillControlBlock = (
  caster: BattleFighter,
  skill: Skill,
  control: string,
  turn: number,
  logs: BattleLogEntry[],
) => {
  if (logs === NO_LOGS) return
  logs.push({
    turn,
    side: caster.side,
    actor: caster.name,
    actorHp: caster.hp,
    effect: skillDisplayName(skill),
    message: `${skillDisplayName(skill)}は${control}で発動できない`,
  })
}

const trySkill = (
  skill: Skill,
  trigger: BattleTrigger,
  caster: BattleFighter,
  target: BattleFighter | null,
  allies: BattleFighter[],
  enemies: BattleFighter[],
  turn: number,
  logs: BattleLogEntry[],
  rng: () => number,
  stats: SkillStatMap,
  turnStat: BattleTurnStat,
  controlStats: Record<string, number>,
  eventSubject?: BattleFighter,
) => {
  // 発動タイミング、クールダウン、ターン内回数、確率判定をまとめて見る入口。
  if (!isAlive(caster) || !skillSupportsTrigger(skill, trigger)) return
  // 如水の回復反応は本戦ターン中に各ターン1回だけ。
  // 発動記録より先に除外し、準備ターンや2回目以降の回復をログ・集計へ残さない。
  const resolvedSkillName = skillDisplayName(skill)
  if (
    trigger === 'onHealed'
    && (resolvedSkillName === '如水' || skill.name === '如水')
    && (turn <= 0 || caster.specialState.josuiHealTurn === turn)
  ) return
  const resolvedSkillType = battleSkillType(skill)
  const followUp = isBattleSkillFollowUpTrigger(skill, trigger)
  // 無策は能動、萎縮（旧表記の畏縮を含む）は指揮・受動戦法だけを止める。
  const controlBlock = skillControlBlock(caster, skill)
  if (controlBlock) {
    logSkillControlBlock(caster, skill, controlBlock, turn, logs)
    return
  }
  if (!followUp && (caster.skillCooldowns[skill.id || skill.name] ?? 0) > 0) return
  if (!followUp && skill.maxPerTurn && (caster.skillUsesThisTurn[skill.id || skill.name] ?? 0) >= skill.maxPerTurn) return
  const unique = isUniqueBattleSkill(skill)
  const prepared = preparationTurns(skill) > 0
  const activationRate = activationRateOf(caster, skill)
  if (!followUp && rng() > activationRate) {
    recordBingxueSkillFailure(caster, resolvedSkillType, unique, prepared)
    if (trigger === 'beforeAction' || trigger === 'afterNormalAttack') {
      if (logs !== NO_LOGS) logs.push({
        turn,
        side: caster.side,
        actor: caster.name,
        actorHp: caster.hp,
        effect: resolvedSkillName,
        message: `${resolvedSkillName}は不発`,
      })
    }
    return
  }

  if (!followUp) markBingxueSkillUsed(caster, resolvedSkillType)
  const skillKey = skill.id || skill.name
  if (!followUp) {
    caster.skillUsesThisTurn[skillKey] = (caster.skillUsesThisTurn[skillKey] ?? 0) + 1
    if (skill.cooldown) caster.skillCooldowns[skillKey] = skill.cooldown
    recordActivation(stats, caster, skill)
  }

  let prep = trigger === 'beforeAction' ? preparationTurns(skill) : 0
  if (prep > 0 && consumeBingxuePreparationReduction(caster, resolvedSkillType, unique, prepared, rng)) {
    prep = Math.max(0, prep - 1)
    if (logs !== NO_LOGS) logs.push({
      turn,
      side: caster.side,
      actor: caster.name,
      actorHp: caster.hp,
      message: '七転八起: 準備ターンを1短縮',
    })
  }
  if (prep > 0) {
    caster.pendingSkills.push({ skill, remainingTurns: prep })
    if (logs !== NO_LOGS) logs.push({ turn, side: caster.side, actor: caster.name, actorHp: caster.hp, message: `${skill.name_jp || skill.name}の準備を開始(${prep}T)` })
    return
  }
  if (trigger !== 'beforeUniqueSkill' && isUniqueBattleSkill(skill)) {
    fireBeforeUniqueSkill(caster, skill, target, allies, enemies, turn, logs, rng, stats, turnStat, controlStats)
  }
  if (!followUp && logs !== NO_LOGS) logs.push({ turn, side: caster.side, actor: caster.name, actorHp: caster.hp, message: `${skill.name_jp || skill.name}発動` })
  resolveSkill(caster, target, allies, enemies, skill, trigger, turn, logs, rng, stats, turnStat, controlStats, eventSubject)
  if (!followUp) recordBingxueSkillResolved(caster, resolvedSkillType, prepared, turn, rng)
}

const processPendingSkills = (
  fighter: BattleFighter,
  allies: BattleFighter[],
  enemies: BattleFighter[],
  turn: number,
  logs: BattleLogEntry[],
  rng: () => number,
  stats: SkillStatMap,
  turnStat: BattleTurnStat,
  controlStats: Record<string, number>,
) => {
  const ready: PendingSkill[] = []
  fighter.pendingSkills.forEach((pending) => {
    pending.remainingTurns -= 1
    if (pending.remainingTurns <= 0) ready.push(pending)
  })
  fighter.pendingSkills = fighter.pendingSkills.filter((pending) => pending.remainingTurns > 0)
  ready
    .sort((a, b) => compareBattleSkillPriority(a.skill, b.skill) || skillDisplayName(a.skill).localeCompare(skillDisplayName(b.skill), 'ja'))
    .forEach((pending) => {
      if (!isAlive(fighter)) return
      const controlBlock = skillControlBlock(fighter, pending.skill)
      if (controlBlock) {
        logSkillControlBlock(fighter, pending.skill, controlBlock, turn, logs)
        return
      }
      const target = chooseControlledTarget(fighter, enemies, allies, enemies, rng)
      if (logs !== NO_LOGS) logs.push({ turn, side: fighter.side, actor: fighter.name, actorHp: fighter.hp, message: `${pending.skill.name_jp || pending.skill.name}の準備完了` })
      if (isUniqueBattleSkill(pending.skill)) {
        fireBeforeUniqueSkill(fighter, pending.skill, target, allies, enemies, turn, logs, rng, stats, turnStat, controlStats)
      }
      markBingxueSkillUsed(fighter, battleSkillType(pending.skill))
      resolveSkill(fighter, target, allies, enemies, pending.skill, 'beforeAction', turn, logs, rng, stats, turnStat, controlStats)
      recordBingxueSkillResolved(
        fighter,
        battleSkillType(pending.skill),
        preparationTurns(pending.skill) > 0,
        turn,
        rng,
      )
    })
}

const processDots = (
  fighter: BattleFighter,
  turn: number,
  logs: BattleLogEntry[],
  rng: () => number,
  stats: SkillStatMap,
  all: BattleFighter[],
  turnStat: BattleTurnStat,
  controlStats: Record<string, number>,
) => {
  const remaining: TimedStatus[] = []
  fighter.timedStatuses.forEach((status) => {
    // 僧兵の継続状態無効は、既に予約されていた状態にも適用してダメージ前に除去する。
    if (
      (fighter.specialState.monkNonBurnDotImmune ?? 0) > 0
      && CONTINUOUS_DAMAGE_STATUS_NAMES.has(status.name)
      && status.name !== '火傷'
    ) return
    if (status.dotRate && isAlive(fighter)) {
      const source = all.find((candidate) => candidate.id === status.sourceActorId)
        ?? all.find((candidate) => candidate.name === status.sourceActor && candidate.side !== fighter.side)
        ?? all.find((candidate) => candidate.name === status.sourceActor)
        ?? fighter
      const pseudoSkill = { id: status.sourceSkill ?? status.name, name: status.sourceSkill ?? status.name } as Skill
      const beforeHp = fighter.hp
      const beforeWounded = fighter.wounded
      const beforeDead = fighter.dead
      const resolvedDamage = baseDamage(source, fighter, {
        ...pseudoSkill,
        damage_rate_max: status.dotRate,
        battle_type: status.dotType === 'strategy' ? 'strategy' : 'bravery',
      }, rng, status.dotType ?? 'physical', undefined, {
        candidates: all.filter(candidate => candidate.side === fighter.side),
        dot: true,
        skillType: null,
        turn,
      })
      const amount = applyDamage(fighter, resolvedDamage.amount)
      const afterHp = fighter.hp
      const woundedDelta = fighter.wounded - beforeWounded
      const deadDelta = fighter.dead - beforeDead
      recordDamage(stats, source, pseudoSkill, amount)
      if (source.side === 'ally') turnStat.allyDamage += amount
      else turnStat.enemyDamage += amount
      if (logs !== NO_LOGS) logs.push({
        turn,
        side: source.side,
        actor: source.name,
        actorHp: source.hp,
        target: fighter.name,
        targetSide: fighter.side,
        amount,
        beforeHp,
        afterHp,
        woundedDelta,
        deadDelta,
        valueType: 'damage',
        effect: status.name,
        message: `${status.name}で${fighter.name}に${amount.toLocaleString()}ダメージ ${hpChangeText(beforeHp, afterHp)} / ${casualtyText(woundedDelta, deadDelta)}`,
      })
      if (amount > 0) {
        const dotKind = status.dotType ?? 'physical'
        recordDamageDealtSkillEffects(source, dotKind, turn, logs)
        resolveRedArmorCriticalHit({
          caster: source,
          target: fighter,
          allies: all.filter(candidate => candidate.side === source.side),
          enemies: all.filter(candidate => candidate.side !== source.side),
          skill: pseudoSkill,
          trigger: 'beforeAction',
          turn,
          logs,
          rng,
          stats,
          turnStat,
          controlStats,
        }, dotKind, resolvedDamage.critical, amount)
        applyBingxueLifeSteal(source, amount, turn, logs, turnStat)
        resolveSeventyTwoCriticalDamage({
          caster: source,
          target: fighter,
          allies: all.filter(candidate => candidate.side === source.side),
          enemies: all.filter(candidate => candidate.side !== source.side),
          skill: pseudoSkill,
          trigger: 'beforeAction',
          turn,
          logs,
          rng,
          stats,
          turnStat,
          controlStats,
        }, dotKind, resolvedDamage.critical, amount)
      }
    }
    status.turns -= 1
    if (status.turns > 0) remaining.push(status)
  })
  fighter.timedStatuses = remaining
}

const isActionBlocked = (fighter: BattleFighter, rng: () => number): string | null => {
  if (hasControlStatus(fighter, '威圧')) return '威圧'
  if (hasControlStatus(fighter, '麻痺') && rng() < 0.3) return '麻痺'
  return null
}

const consumeActionControlDurations = (fighter: BattleFighter, activeAtActionStart: Set<string>) => {
  activeAtActionStart.forEach((name) => {
    if (!CONTROL_STATUS_NAMES.has(name) || (fighter.statuses[name] ?? 0) <= 0) return
    fighter.statuses[name] -= 1
    if (fighter.statuses[name] > 0) return
    delete fighter.statuses[name]
    delete fighter.controlSources[name]
  })
}

const tickFighter = (fighter: BattleFighter, turn: number, logs: BattleLogEntry[]) => {
  tickBingxueTurn(fighter, turn)
  const activeModifiers: TimedBattleModifier[] = []
  fighter.timedModifiers.forEach((modifier) => {
    if (turn < modifier.expiresTurn) {
      activeModifiers.push(modifier)
      return
    }
    fighter.buffs[modifier.stat] = (fighter.buffs[modifier.stat] ?? 0) - modifier.value
    if (Math.abs(fighter.buffs[modifier.stat] ?? 0) < 0.0001) delete fighter.buffs[modifier.stat]
  })
  fighter.timedModifiers = activeModifiers
  Object.keys(fighter.skillCooldowns).forEach((key) => {
    fighter.skillCooldowns[key] = Math.max(0, fighter.skillCooldowns[key] - 1)
  })
  Object.keys(fighter.statuses).forEach((key) => {
    // 制御状態は対象の行動機会終了時に消費し、付与直後にターン更新で消えないようにする。
    if (CONTROL_STATUS_NAMES.has(key)) return
    fighter.statuses[key] -= 1
    if (fighter.statuses[key] <= 0) {
      delete fighter.statuses[key]
      delete fighter.controlSources[key]
    }
  })
  if ((fighter.statuses['援護'] ?? 0) <= 0) delete fighter.specialState.mikawaGuardianRole
  fighter.skillUsesThisTurn = {}
}

const processTurnStartWoundedDeaths = (fighters: BattleFighter[], turn: number, logs: BattleLogEntry[]) => {
  fighters.forEach((fighter) => {
    if (fighter.wounded <= 0) return
    const deadFromWounded = Math.min(fighter.wounded, Math.floor(fighter.wounded * 0.1))
    if (deadFromWounded <= 0) return
    const beforeHp = fighter.hp
    fighter.wounded -= deadFromWounded
    fighter.dead += deadFromWounded
    fighter.maxHp = Math.max(0, fighter.maxHp - deadFromWounded)
    if (fighter.hp > fighter.maxHp) fighter.hp = fighter.maxHp
    if (logs !== NO_LOGS) logs.push({
      turn,
      side: fighter.side,
      actor: fighter.name,
      actorHp: fighter.hp,
      target: fighter.name,
      targetSide: fighter.side,
      beforeHp,
      afterHp: fighter.hp,
      deadDelta: deadFromWounded,
      effect: '負傷兵死亡',
      message: `ターン開始時に負傷兵${deadFromWounded.toLocaleString()}が戦死（残り負傷兵${fighter.wounded.toLocaleString()}）`,
    })
  })
}

const markActionLogs = (
  logs: BattleLogEntry[],
  startIndex: number,
  actor: BattleFighter,
  actionActorHp: number,
  actionActorSpeed: number,
) => {
  if (logs === NO_LOGS) return
  logs.slice(startIndex).forEach((entry) => {
    entry.actionActor = actor.name
    entry.actionSide = actor.side
    entry.actionActorHp = actionActorHp
    entry.actionActorSpeed = actionActorSpeed
  })
}

const logTroopStatBonus = (
  logs: BattleLogEntry[],
  label: string,
  fighters: BattleFighter[],
): void => {
  if (logs === NO_LOGS) return
  const fighter = fighters[0]
  if (!fighter?.troopType) return
  const bonusPercent = fighter.troopLevel * 2
  logs.push({
    turn: 0,
    side: 'system',
    message: `${label}兵種: ${fighter.troopType} Lv${fighter.troopLevel} / 戦闘開始時の全属性+${bonusPercent}%`,
  })
}

export const simulateBattle = (allyLineup: Lineup, enemyLineup: Lineup, options: BattleOptions): BattleResult => {
  const rng = makeRng(`${options.seed}:${allyLineup.name}:${enemyLineup.name}`)
  const ally = makeSide('ally', allyLineup, options.allyTroopAffinity ?? 'neutral')
  const enemy = makeSide('enemy', enemyLineup, options.enemyTroopAffinity ?? 'neutral')
  const collectLogs = options.collectLogs !== false
  const logs: BattleLogEntry[] = collectLogs ? [] : NO_LOGS
  const skillStats = new Map<string, SkillBattleStat>()
  const turnStats: BattleTurnStat[] = []
  const controlStats: Record<string, number> = {}
  let finalTurn = 0

  if (ally.length === 0 || enemy.length === 0) {
    return {
      ally,
      enemy,
      logs: [{ turn: 0, side: 'system', message: '両方の編成に武将を配置してください。' }],
      skillStats: [],
      turnStats: [],
      controlStats: {},
      summary: {
        outcome: 'draw',
        turns: 0,
        allyHp: sideHp(ally),
        enemyHp: sideHp(enemy),
        allyMaxHp: sideMaxHp(ally),
        enemyMaxHp: sideMaxHp(enemy),
      },
    }
  }

  if (logs !== NO_LOGS) logs.push({ turn: 0, side: 'system', message: `${allyLineup.name} vs ${enemyLineup.name} 開始` })
  logTroopStatBonus(logs, '自軍', ally)
  logTroopStatBonus(logs, '敵軍', enemy)
  // 戦闘開始時に一度だけ発動する兵学を、自軍・敵軍の全武将へ適用する。
  ;[
    { fighters: ally, allies: ally },
    { fighters: enemy, allies: enemy },
  ].forEach(({ fighters, allies }) => {
    fighters.forEach((fighter) => initializeBingxueBattle(
      fighter,
      allies,
      rng,
      (owner, message) => {
        if (logs !== NO_LOGS) logs.push({
          turn: 0,
          side: owner.side,
          actor: owner.name,
          actorHp: owner.hp,
          effect: '兵学',
          message,
        })
      },
    ))
  })
  if (logs !== NO_LOGS) logs.push({ turn: 0, side: 'system', message: '準備ターン: 指揮・受動・兵種戦法を処理' })

  // 準備ターン: 指揮・受動・兵種など、戦闘開始時に解決する戦法を処理する。
  ;[...ally, ...enemy].forEach((fighter) => {
    const allies = fighter.side === 'ally' ? ally : enemy
    const enemies = fighter.side === 'ally' ? enemy : ally
    const setupStat = emptyTurnStat(0)
    fireTriggeredSkills(
      fighter,
      'preparationTurn',
      chooseControlledTarget(fighter, enemies, allies, enemies, rng),
      allies,
      enemies,
      0,
      logs,
      rng,
      skillStats,
      setupStat,
      controlStats,
    )
  })

    // 本戦は真戦風に8ターン固定。各ターンは負傷兵死亡後、速度順に各武将の行動開始処理へ進む。
  for (let turn = 1; turn <= BATTLE_TURN_LIMIT; turn += 1) {
    finalTurn = turn
    const all = [...ally, ...enemy]
    const turnStat = emptyTurnStat(turn)
    all.forEach((fighter) => tickFighter(fighter, turn, logs))
    if (logs !== NO_LOGS) logs.push({ turn, side: 'system', message: `ターン${turn}` })
    processTurnStartWoundedDeaths(all, turn, logs)

    const order = living(all).sort((a, b) =>
      Number((b.statuses['先攻'] ?? 0) > 0) - Number((a.statuses['先攻'] ?? 0) > 0)
      || statOf(b, 'spd') - statOf(a, 'spd')
      || (rng() > 0.5 ? 1 : -1),
    )
    for (const actor of order) {
      if (!isAlive(actor)) continue
      const allies = actor.side === 'ally' ? ally : enemy
      const enemies = actor.side === 'ally' ? enemy : ally
      const actionLogStart = logs === NO_LOGS ? 0 : logs.length
      const actionActorHp = actor.hp
      // 伊賀忍者などの戦闘中補正を含む、行動開始時点の実速度をログへ保存する。
      const actionActorSpeed = statOf(actor, 'spd')
      const actionControlStatusKeys = new Set(
        Object.keys(actor.statuses).filter((name) => CONTROL_STATUS_NAMES.has(name)),
      )
      let actionPrevented = false

      try {
        // 火傷・水攻め・中毒・消沈・潰走は、対象武将の行動開始時に最優先で解決する。
        processDots(actor, turn, logs, rng, skillStats, all, turnStat, controlStats)
        if (!isAlive(actor)) continue

        let target = chooseControlledTarget(actor, enemies, allies, enemies, rng)
        if (!target) break

        // 継続ダメージ後、生存していれば兵学とターン開始戦法を処理する。
        runBingxueTurnStart({
          owner: actor,
          allies,
          enemies,
          currentTarget: target,
          turn,
          rng,
          helpers: createBingxueHelpers(allies, enemies, turn, logs, rng, skillStats, turnStat, controlStats),
        })
        processPendingSkills(actor, allies, enemies, turn, logs, rng, skillStats, turnStat, controlStats)
        fireTriggeredSkills(actor, 'turnStart', target, allies, enemies, turn, logs, rng, skillStats, turnStat, controlStats)
        if (!isAlive(actor)) continue
        target = chooseControlledTarget(actor, enemies, allies, enemies, rng)
        if (!target) break

        const blocked = isActionBlocked(actor, rng)
        if (blocked) {
          actionPrevented = true
          if (logs !== NO_LOGS) logs.push({ turn, side: actor.side, actor: actor.name, actorHp: actor.hp, message: `${actor.name}は${blocked}で行動できない` })
          continue
        }

        // 行動不能判定を通過した武将へ、行動開始前の兵学を処理する。
        runBingxueBeforeAction({
          owner: actor,
          allies,
          enemies,
          currentTarget: target,
          turn,
          rng,
          helpers: createBingxueHelpers(allies, enemies, turn, logs, rng, skillStats, turnStat, controlStats),
        })

        // 伝馬疾馳など、所持者とは別の友軍の行動開始を監視する予約効果を先に解決する。
        allies.filter(isAlive).forEach((owner) => {
          const watcherSkills = skillsNamedIn(owner, TEAM_BEFORE_ACTION_SKILL_NAMES)
          if (watcherSkills.length === 0) return
          fireTriggeredSkillList(
            owner,
            watcherSkills,
            'allyBeforeAction',
            target,
            allies,
            enemies,
            turn,
            logs,
            rng,
            skillStats,
            turnStat,
            controlStats,
            undefined,
            actor,
          )
        })

        const grantedActionSkills = teamActionBattleSkills(allies)
        const inheritedActionSkills = grantedActionSkills.filter(
          (skill) => !actor.skills.some((ownSkill) => isSameSkill(ownSkill, skill)),
        )
        fireTriggeredSkillList(
          actor,
          [...actor.skills, ...inheritedActionSkills],
          'beforeAction',
          target,
          allies,
          enemies,
          turn,
          logs,
          rng,
          skillStats,
          turnStat,
          controlStats,
        )
        const normalAttackBlocked = hasControlStatus(actor, '封撃')
        const satsumaStrategyRate = actor.specialState.satsumaStrategyNormalRate ?? 0
        const satsumaWaiting = satsumaStrategyRate > 0
          && (actor.specialState.satsumaStrategyNormalNextTurn ?? 1) > turn
        if (normalAttackBlocked) {
          if (logs !== NO_LOGS) logs.push({
            turn,
            side: actor.side,
            actor: actor.name,
            actorHp: actor.hp,
            effect: '封撃',
            message: `${actor.name}は封撃で通常攻撃できない`,
          })
        } else if (satsumaWaiting) {
          // 薩摩鉄砲兵の計略通常攻撃は、攻撃した次のターンを休止する。
          if (logs !== NO_LOGS) logs.push({
            turn,
            side: actor.side,
            actor: actor.name,
            actorHp: actor.hp,
            effect: '薩摩鉄砲兵',
            message: `${actor.name}は薩摩鉄砲兵の再装填中`,
          })
        } else {
          if (!isAlive(target)) continue

          target = chooseControlledTarget(actor, enemies, allies, enemies, rng, 'normal')
          if (!target) break
          fireTriggeredSkills(actor, 'beforeNormalAttack', target, allies, enemies, turn, logs, rng, skillStats, turnStat, controlStats)
          if (!isAlive(target)) continue

          // 援護中の大将が狙われた場合、指定された友軍が通常攻撃を引き受ける。
          const targetSideMembers = target.side === actor.side ? allies : enemies
          target = redirectGuardedNormalAttack(target, targetSideMembers, actor, turn, logs)

          const beforeHp = target.hp
          const beforeWounded = target.wounded
          const beforeDead = target.dead
          const normalDamageKind = satsumaStrategyRate > 0 ? 'strategy' : 'physical'
          const satsumaSkill = satsumaStrategyRate > 0 ? {
            id: 'troop:satsuma-strategy-normal',
            name: '薩摩鉄砲兵',
            name_jp: '薩摩鉄砲兵',
            type: '兵種',
            battle_type: 'strategy',
            damage_rate_max: satsumaStrategyRate,
          } as Skill : null
          const resolvedNormalDamage = baseDamage(
            actor,
            target,
            satsumaSkill,
            rng,
            satsumaStrategyRate > 0 ? 'strategy' : 'normal',
            undefined,
            {
            candidates: targetSideMembers,
            normalAttack: true,
            skillType: null,
            turn,
            },
          )
          const normalDamage = applyDamage(target, resolvedNormalDamage.amount)
          const afterHp = target.hp
          const woundedDelta = target.wounded - beforeWounded
          const deadDelta = target.dead - beforeDead
          if (actor.side === 'ally') turnStat.allyDamage += normalDamage
          else turnStat.enemyDamage += normalDamage
          if (logs !== NO_LOGS) logs.push({
            turn,
            side: actor.side,
            actor: actor.name,
            actorHp: actor.hp,
            target: target.name,
            targetSide: target.side,
            amount: normalDamage,
            beforeHp,
            afterHp,
            woundedDelta,
            deadDelta,
            valueType: 'damage',
            effect: satsumaStrategyRate > 0 ? '薩摩鉄砲兵' : '通常攻撃',
            message: `${actor.name}の${satsumaStrategyRate > 0 ? '計略通常攻撃' : '通常攻撃'}: ${target.name}に${normalDamage.toLocaleString()}ダメージ ${hpChangeText(beforeHp, afterHp)} / ${casualtyText(woundedDelta, deadDelta)}`,
          })
          if (satsumaStrategyRate > 0) actor.specialState.satsumaStrategyNormalNextTurn = turn + 2
          if (normalDamage > 0) {
            const targetAllies = target.side === actor.side ? allies : enemies
            const targetEnemies = target.side === actor.side ? enemies : allies
            if (satsumaSkill) recordDamage(skillStats, actor, satsumaSkill, normalDamage)
            recordDamageDealtSkillEffects(actor, normalDamageKind, turn, logs)
            const normalAttackContext: SkillResolveContext = {
              caster: actor,
              target,
              allies,
              enemies,
              skill: satsumaSkill ?? ({ id: 'normal-attack', name: '通常攻撃' } as Skill),
              trigger: 'afterNormalAttack',
              turn,
              logs,
              rng,
              stats: skillStats,
              turnStat,
              controlStats,
            }
            resolveRedArmorCriticalHit(normalAttackContext, normalDamageKind, resolvedNormalDamage.critical, normalDamage)
            resolveSeventyTwoCriticalDamage(normalAttackContext, normalDamageKind, resolvedNormalDamage.critical, normalDamage)
            applyBingxueLifeSteal(actor, normalDamage, turn, logs, turnStat)
            if (normalDamageKind === 'physical') applyPhysicalLifeSteal(actor, normalDamage, turn, logs, turnStat)
            runBingxueNormalAttackReceived(
              target,
              actor,
              turn,
              rng,
              createBingxueHelpers(targetAllies, targetEnemies, turn, logs, rng, skillStats, turnStat, controlStats),
            )
            fireTriggeredSkills(
              target,
              'onNormalAttackReceived',
              actor,
              targetAllies,
              targetEnemies,
              turn,
              logs,
              rng,
              skillStats,
              turnStat,
              controlStats,
              undefined,
              target,
            )
            // 三河魂など、所持者以外の友軍が通常攻撃を受けた時に反応する指揮戦法も処理する。
            targetAllies
              .filter((owner) => owner.id !== target!.id && isAlive(owner))
              .forEach((owner) => {
                const reactiveSkills = owner.skills.filter((skill) =>
                  TEAM_NORMAL_ATTACK_RECEIVED_SKILL_NAMES.has(skillDisplayName(skill))
                  || TEAM_NORMAL_ATTACK_RECEIVED_SKILL_NAMES.has(skill.name),
                )
                if (reactiveSkills.length === 0) return
                fireTriggeredSkillList(
                  owner,
                  reactiveSkills,
                  'onNormalAttackReceived',
                  actor,
                  targetAllies,
                  targetEnemies,
                  turn,
                  logs,
                  rng,
                  skillStats,
                  turnStat,
                  controlStats,
                  undefined,
                  target ?? undefined,
                )
              })
            fireTriggeredSkills(
              target,
              normalDamageKind === 'strategy' ? 'onStrategyDamageReceived' : 'onPhysicalDamageReceived',
              actor,
              targetAllies,
              targetEnemies,
              turn,
              logs,
              rng,
              skillStats,
              turnStat,
              controlStats,
            )
            fireDamageWatcherSkills(
              actor,
              target,
              normalDamageKind,
              targetAllies,
              targetEnemies,
              turn,
              logs,
              rng,
              skillStats,
              turnStat,
              controlStats,
            )
          }
          // 通常攻撃の結果が確定してから、通常攻撃後の兵学を処理する。
          runBingxueAfterNormalAttack({
            owner: actor,
            allies,
            enemies,
            currentTarget: target,
            turn,
            rng,
            helpers: createBingxueHelpers(allies, enemies, turn, logs, rng, skillStats, turnStat, controlStats),
          })
          // 伊賀忍者・越後先手組・母衣武者など、部隊全員へ付与された兵種戦法も
          // 実際に通常攻撃した武将を発動者として一度だけ処理する。
          fireTriggeredSkillList(
            actor,
            [...actor.skills, ...inheritedActionSkills],
            'afterNormalAttack',
            target,
            allies,
            enemies,
            turn,
            logs,
            rng,
            skillStats,
            turnStat,
            controlStats,
          )
          // 覇王の右筆・献身は、所持者本人ではなく友軍の通常攻撃後にも反応する。
          allies
            .filter((owner) => owner.id !== actor.id && isAlive(owner))
            .forEach((owner) => {
              const watcherSkills = skillsNamedIn(owner, TEAM_AFTER_NORMAL_ATTACK_SKILL_NAMES)
              if (watcherSkills.length === 0) return
              fireTriggeredSkillList(
                owner,
                watcherSkills,
                'afterNormalAttack',
                target,
                allies,
                enemies,
                turn,
                logs,
                rng,
                skillStats,
                turnStat,
                controlStats,
                undefined,
                actor,
              )
            })
        }
        if (dateMasamuneHasDragonCavalry(allies) && grantedActionSkills.length > 0) {
          fireTriggeredSkillList(
            actor,
            grantedActionSkills,
            'afterAction',
            chooseControlledTarget(actor, enemies, allies, enemies, rng),
            allies,
            enemies,
            turn,
            logs,
            rng,
            skillStats,
            turnStat,
            controlStats,
          )
        }
        // 行動後戦法は行動した本人なら役割に関係なく発動する。
        // 大将の行動終了を監視する比翼連理などは、従来通り部隊全員から拾う。
        const afterActionOwners = actor.role === 'main' ? allies : [actor]
        afterActionOwners.forEach((owner) => {
          if (!isAlive(owner)) return
          fireTriggeredSkills(
            owner,
            'afterAction',
            chooseControlledTarget(owner, enemies, allies, enemies, rng),
            allies,
            enemies,
            turn,
            logs,
            rng,
            skillStats,
            turnStat,
            controlStats,
            grantedActionSkills[0],
          )
        })
        // 三楽犬など、標記した敵の行動終了を監視する戦法を敵側から解決する。
        enemies.filter(isAlive).forEach((owner) => {
          const watcherSkills = skillsNamedIn(owner, ENEMY_AFTER_ACTION_SKILL_NAMES)
          if (watcherSkills.length === 0) return
          fireTriggeredSkillList(
            owner,
            watcherSkills,
            'enemyAfterAction',
            actor,
            enemies,
            allies,
            turn,
            logs,
            rng,
            skillStats,
            turnStat,
            controlStats,
            undefined,
            actor,
          )
        })
        if (living(enemy).length === 0 || living(ally).length === 0) break
      } finally {
        // 麻痺・威圧で行動できなかった時は「行動後」を条件とする兵学も発動しない。
        if (!actionPrevented && isAlive(actor)) {
          runBingxueAfterAction({
            owner: actor,
            allies,
            enemies,
            currentTarget: chooseControlledTarget(actor, enemies, allies, enemies, rng),
            turn,
            rng,
            helpers: createBingxueHelpers(allies, enemies, turn, logs, rng, skillStats, turnStat, controlStats),
          })
        }
        // 行動開始時点で有効だった制御だけを消費し、行動中に新規付与された制御は残す。
        consumeActionControlDurations(actor, actionControlStatusKeys)
        markActionLogs(logs, actionLogStart, actor, actionActorHp, actionActorSpeed)
      }
    }

    turnStat.allyHp = sideHp(ally)
    turnStat.enemyHp = sideHp(enemy)
    turnStat.allyMembers = ally.map((fighter) => Math.max(0, fighter.hp))
    turnStat.enemyMembers = enemy.map((fighter) => Math.max(0, fighter.hp))
    turnStats.push(turnStat)

    if (living(enemy).length === 0 || living(ally).length === 0) break
  }

  const allyHp = sideHp(ally)
  const enemyHp = sideHp(enemy)
  const bothMainAliveAfterEightTurns = finalTurn >= BATTLE_TURN_LIMIT && sideMainAlive(ally) && sideMainAlive(enemy)
  const outcome: BattleOutcome = bothMainAliveAfterEightTurns
    ? 'draw'
    : allyHp === enemyHp
      ? 'draw'
      : allyHp > enemyHp ? 'ally' : 'enemy'
  if (logs !== NO_LOGS) logs.push({
    turn: finalTurn,
    side: 'system',
    message: outcome === 'draw' ? '引き分け' : `${outcome === 'ally' ? allyLineup.name : enemyLineup.name} の勝利`,
  })

  return {
    ally,
    enemy,
    logs: collectLogs ? logs : [],
    skillStats: [...skillStats.values()],
    turnStats,
    controlStats,
    summary: {
      outcome,
      turns: finalTurn,
      allyHp,
      enemyHp,
      allyMaxHp: sideMaxHp(ally),
      enemyMaxHp: sideMaxHp(enemy),
    },
  }
}

const metricScore = (value: number, scale: number): number => clamp(Math.round((value / scale) * 100), 0, 100)

const scoreTier = (value: number): string => {
  if (value >= 86) return 'T0'
  if (value >= 72) return 'T0.5'
  if (value >= 58) return 'T1'
  if (value >= 44) return 'T1.5'
  if (value >= 30) return 'T2'
  return 'T3'
}

const mergeControlStats = (into: Record<string, number>, from: Record<string, number>) => {
  Object.entries(from).forEach(([key, value]) => {
    into[key] = (into[key] ?? 0) + value
  })
}

export const simulateBattleBatch = (
  allyLineup: Lineup,
  enemyLineup: Lineup,
  options: BattleOptions & { runs?: number },
): BattleBatchResult => {
  // 結果表示用に同一編成を多数回試行し、平均ダメージ・平均回復・勝率へ集約する。
  const runs = Math.max(1, Math.floor(options.runs ?? 1000))
  const aggregate = new Map<string, SkillBattleStat>()
  const turnAggregate = Array.from({ length: BATTLE_TURN_LIMIT }, (_, index) => emptyTurnStat(index + 1))
  const controlAggregate: Record<string, number> = {}
  let allyWins = 0
  let enemyWins = 0
  let draws = 0
  let totalTurns = 0
  let totalAllyHp = 0
  let totalEnemyHp = 0
  let totalAllyDamage = 0
  let totalEnemyDamage = 0
  let totalAllyHealing = 0
  let totalEnemyHealing = 0
  let allyMaxHp = 0
  let enemyMaxHp = 0
  const randomPrefix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`

  for (let i = 0; i < runs; i += 1) {
    const result = simulateBattle(allyLineup, enemyLineup, {
      ...options,
      collectLogs: false,
      seed: `${randomPrefix}-${i}`,
    })
    if (result.summary.outcome === 'ally') allyWins += 1
    else if (result.summary.outcome === 'enemy') enemyWins += 1
    else draws += 1
    totalTurns += result.summary.turns
    totalAllyHp += result.summary.allyHp
    totalEnemyHp += result.summary.enemyHp
    allyMaxHp = result.summary.allyMaxHp
    enemyMaxHp = result.summary.enemyMaxHp
    mergeControlStats(controlAggregate, result.controlStats)

    result.turnStats.forEach((turn) => {
      const bucket = turnAggregate[turn.turn - 1]
      if (!bucket) return
      bucket.allyDamage += turn.allyDamage
      bucket.enemyDamage += turn.enemyDamage
      bucket.allyHealing += turn.allyHealing
      bucket.enemyHealing += turn.enemyHealing
      bucket.allyHp += turn.allyHp
      bucket.enemyHp += turn.enemyHp
      totalAllyDamage += turn.allyDamage
      totalEnemyDamage += turn.enemyDamage
      totalAllyHealing += turn.allyHealing
      totalEnemyHealing += turn.enemyHealing
      for (let member = 0; member < 3; member += 1) {
        bucket.allyMembers[member] = (bucket.allyMembers[member] ?? 0) + (turn.allyMembers[member] ?? 0)
        bucket.enemyMembers[member] = (bucket.enemyMembers[member] ?? 0) + (turn.enemyMembers[member] ?? 0)
      }
    })

    result.skillStats.forEach((stat) => {
      const existing = aggregate.get(stat.key)
      if (existing) {
        existing.activations += stat.activations
        existing.damage += stat.damage
        existing.healing += stat.healing
      } else {
        aggregate.set(stat.key, { ...stat })
      }
    })
  }

  const skillStats = [...aggregate.values()]
    .map((stat) => ({
      ...stat,
      avgActivations: stat.activations / runs,
      avgDamage: stat.damage / runs,
      avgHealing: stat.healing / runs,
    }))
    .sort((a, b) => {
      if (a.side !== b.side) return a.side === 'ally' ? -1 : 1
      if (a.actorId !== b.actorId) return a.actorId.localeCompare(b.actorId)
      return b.avgDamage + b.avgHealing - (a.avgDamage + a.avgHealing)
    })

  const turnStats = turnAggregate.map((turn) => ({
    ...turn,
    allyDamage: turn.allyDamage / runs,
    enemyDamage: turn.enemyDamage / runs,
    allyHealing: turn.allyHealing / runs,
    enemyHealing: turn.enemyHealing / runs,
    allyHp: turn.allyHp / runs,
    enemyHp: turn.enemyHp / runs,
    allyMembers: turn.allyMembers.map((value) => value / runs),
    enemyMembers: turn.enemyMembers.map((value) => value / runs),
  }))
  const controlStats = Object.fromEntries(
    Object.entries(controlAggregate).map(([key, value]) => [key, value / runs]),
  )
  const allyLoss = Math.max(1, allyMaxHp - (totalAllyHp / runs))
  const enemyLoss = Math.max(0, enemyMaxHp - (totalEnemyHp / runs))
  const exchangeRatio = enemyLoss / allyLoss
  const topTurnDamage = Math.max(...turnStats.map((turn) => turn.allyDamage), 0)
  const topSkillCount = skillStats.filter((stat) => stat.side === 'ally' && stat.avgDamage > 0).length
  const metrics: BattleScoreMetrics = {
    output: metricScore(totalAllyDamage / runs, enemyMaxHp * 0.95),
    burst: metricScore(topTurnDamage, enemyMaxHp * 0.28),
    multi: metricScore(topSkillCount, 8),
    recovery: metricScore(totalAllyHealing / runs, allyMaxHp * 0.55),
    control: metricScore(Object.values(controlStats).reduce((sum, value) => sum + value, 0), 8),
    destruction: metricScore(enemyLoss, enemyMaxHp * 0.9),
    stability: metricScore(totalAllyHp / runs, allyMaxHp * 0.85),
    exchange: metricScore(exchangeRatio, 2.4),
  }
  const scoreValue = Math.round(
    metrics.output * 0.16
    + metrics.burst * 0.12
    + metrics.multi * 0.1
    + metrics.recovery * 0.12
    + metrics.control * 0.14
    + metrics.destruction * 0.12
    + metrics.stability * 0.12
    + metrics.exchange * 0.12,
  )

  return {
    runs,
    maxTurns: BATTLE_TURN_LIMIT,
    allyWins,
    enemyWins,
    draws,
    allyWinRate: allyWins / runs,
    enemyWinRate: enemyWins / runs,
    drawRate: draws / runs,
    averageTurns: totalTurns / runs,
    averageAllyHp: totalAllyHp / runs,
    averageEnemyHp: totalEnemyHp / runs,
    allyMaxHp,
    enemyMaxHp,
    skillStats,
    exchangeRatio,
    scoreTier: scoreTier(scoreValue),
    scoreValue,
    metrics,
    turnStats,
    controlStats,
  }
}

