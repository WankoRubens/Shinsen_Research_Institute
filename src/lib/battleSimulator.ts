import type { BingxueActive, Lineup, RoleData } from '../composables/useLineups'
import type { Skill, Stat, TriggerEvent } from '../composables/useData'
import skillsData from '../../.build/skills.json'
import { heroLevel50Stats } from './heroStats'
import { selectedTroopLevel, selectedTroopStatMultiplier } from './troopLevels'
import type { TroopType } from '../constants/traits'
import {
  BATTLE_SKILL_EFFECT_TRIGGERS,
  HEAL_STOCK_DAMAGE_SKILL_NAMES,
  IMPLEMENTED_BATTLE_SKILL_NAMES,
  TEAM_ACTION_BATTLE_SKILL_NAMES,
  applyNamedSkillEffect,
  battleSkillType,
  compareBattleSkillPriority,
  recordDamageDealtSkillEffects,
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
  sourceActor?: string
  dotRate?: number
  dotType?: 'physical' | 'strategy'
}

interface PendingSkill {
  skill: Skill
  remainingTurns: number
}

export interface BattleFighter {
  id: string
  side: BattleSide
  role: 'main' | 'vice1' | 'vice2'
  roleLabel: string
  name: string
  maxHp: number
  hp: number
  wounded: number
  dead: number
  baseStats: Record<Stat, number>
  buffs: Partial<Record<Stat, number>>
  statuses: Record<string, number>
  timedStatuses: TimedStatus[]
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
  const triggers = uniqueTriggers([...registered, ...explicit])
  return triggers.length > 0 ? triggers : [triggerForSkill(skill)]
}

const skillSupportsTrigger = (skill: Skill, trigger: BattleTrigger): boolean => {
  const normalizedTrigger = normalizeTrigger(trigger)
  return triggerEventsForSkill(skill).some((skillTrigger) => skillTrigger === 'always' || skillTrigger === normalizedTrigger)
}

const preparationTurns = (skill: Skill): number => {
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

const allSkills = skillsData as Skill[]

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
    maxHp: BASE_TROOPS,
    hp: BASE_TROOPS,
    wounded: 0,
    dead: 0,
    baseStats: roleStats(role, troopStatMultiplier),
    buffs: {},
    statuses: {},
    timedStatuses: [],
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
  if (currentTarget && source.some((fighter) => fighter.id === currentTarget.id) && count === 1) {
    return [currentTarget]
  }
  return [...source].sort(() => rng() - 0.5).slice(0, count)
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
  if (target.statuses['回復不可'] > 0) return 0
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
    skillType?: ReturnType<typeof battleSkillType> | null
    prepared?: boolean
  },
) => {
  const actualKind = kind === 'normal' ? 'physical' : kind
  const rate = damageRate(skill)
  const attackStat = actualKind === 'strategy' ? statOf(caster, 'int') : statOf(caster, 'val')
  const defenseStat = actualKind === 'strategy' ? statOf(target, 'int') : statOf(target, 'lea')
  const damageBase = statRule
    ? statRule.coefficient * (
        statRule.attackStats.reduce((sum, stat) => sum + statOf(caster, stat), 0)
        - statRule.defenseStats.reduce((sum, stat) => sum + statOf(target, stat), 0)
      ) + (0.037 * caster.hp + 175)
    : battleDamageBase(attackStat, defenseStat, caster.hp)
  const variance = 0.9 + rng() * 0.2
  const modifier = damageModifier(caster, true, actualKind) * damageModifier(target, false, actualKind)
  const raw = damageBase * (rate / 100) * modifier * variance
  const floor = guaranteedDamageFloor(caster.hp, rate, Boolean(skill)) * variance
  const resolvedSkillType = bingxueContext?.skillType === undefined
    ? skill ? battleSkillType(skill) : null
    : bingxueContext.skillType
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
  if (bingxueDamage.evaded) return 0
  // 兵種相性は、最低保証を含むダメージが確定した後に全体へ掛ける。
  return Math.max(floor, raw) * bingxueDamage.multiplier * caster.troopAffinityModifier
}

const baseHeal = (caster: BattleFighter, target: BattleFighter, skill: Skill, rng: () => number): number => {
  const rate = healRate(skill)
  const mainStat = skill.battle_type === 'bravery' ? statOf(caster, 'val') : statOf(caster, 'int')
  const variance = 0.92 + rng() * 0.16
  return Math.max(20, (mainStat * 7.5 + 480) * (rate / 100) * variance) * bingxueHealMultiplier(caster, target)
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
  const inferred = ['無策', '封撃', '麻痺', '混乱', '挑発', '畏縮', '疲弊', '威圧', '回復不可']
    .filter((name) => textOfSkill(skill).includes(name))
  const controlNames = [
    ...String(skill.control_type ?? '').split('/').map((name) => name.trim()).filter(Boolean),
    ...inferred,
  ].filter((name, index, all) => all.indexOf(name) === index)
  if (controlNames.length === 0) return
  const duration = Math.max(1, Math.round(skill.control_turns ?? 1))
  for (const name of controlNames) {
    targets.forEach((target) => {
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
      target.statuses[name] = Math.max(target.statuses[name] ?? 0, duration)
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
    target.timedStatuses.push({
      name: skill.dot_name!,
      turns: duration,
      sourceSkill: skill.name_jp || skill.name,
      sourceActor: caster.name,
      dotRate: normalizeRate(skill.dot_rate_max),
      dotType: damageKind(skill),
    })
    if (logs !== NO_LOGS) logs.push({ turn, side: caster.side, actor: caster.name, actorHp: caster.hp, message: `${target.name}に${skill.dot_name}(${duration}T)` })
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
}

const isSameSkill = (a: Skill, b: Skill): boolean => skillKeyForDedup(a) === skillKeyForDedup(b)
const isUniqueBattleSkill = (skill: Skill): boolean =>
  Boolean(skill.is_unique || skill.unique_hero || /固有戦法/.test(skill.game8_kind ?? ''))

const skillDisplayName = (skill: Skill): string => skill.name_jp || skill.name
const varNumber = (skill: Skill, key: string, fallback: number): number => pickMaxVar(skill, [key]) ?? fallback
const aliveRandom = (fighters: BattleFighter[], rng: () => number): BattleFighter[] =>
  [...living(fighters)].sort(() => rng() - 0.5)
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
) => {
  orderedBattleSkills(skills).forEach((skill) => {
    if (skipSkill && isSameSkill(skill, skipSkill)) return
    trySkill(skill, trigger, owner, target, allies, enemies, turn, logs, rng, stats, turnStat, controlStats)
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
  )
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

const withHealRate = (skill: Skill, rate: number, kind?: 'bravery' | 'strategy'): Skill => ({
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
  const actual = applyDamage(target, baseDamage(
    ctx.caster,
    target,
    withRate(ctx.skill, rate, kind === 'strategy' ? 'strategy' : 'bravery'),
    ctx.rng,
    kind,
    statRule,
    { candidates: ctx.enemies, skillType: battleSkillType(ctx.skill) },
  ))
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
    applyBingxueLifeSteal(ctx.caster, actual, ctx.turn, ctx.logs, ctx.turnStat)
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
  }
  return actual
}

const hasSkillNamed = (fighter: BattleFighter, name: string) =>
  fighter.skills.some((skill) => skillDisplayName(skill) === name || skill.name === name || skill.name_jp === name)

const hasAnySkillNamed = (fighter: BattleFighter, names: string[]) =>
  names.some((name) => hasSkillNamed(fighter, name))

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

const healBySkill = (ctx: SkillResolveContext, target: BattleFighter, rate: number, kind: 'bravery' | 'strategy' = 'strategy') => {
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
    const actual = applyDamage(target, baseDamage(owner, target, pseudoSkill, rng, kind, undefined, {
      candidates: targetCandidates,
      skillType: null,
    }))
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
    }
    return actual
  },
  cleanse: (target, count) => {
    const removed = Object.keys(target.statuses)
      .filter(name => name !== '先攻' && !name.endsWith('耐性'))
      .slice(0, count)
    removed.forEach(name => delete target.statuses[name])
    return removed
  },
})

const addControl = (ctx: SkillResolveContext, target: BattleFighter, name: string, duration: number) => {
  if (!isAlive(target)) return
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
  target.statuses[name] = Math.max(target.statuses[name] ?? 0, duration)
  ctx.controlStats[name] = (ctx.controlStats[name] ?? 0) + 1
  if (ctx.logs !== NO_LOGS) ctx.logs.push({ turn: ctx.turn, side: ctx.caster.side, actor: ctx.caster.name, actorHp: ctx.caster.hp, message: `${skillDisplayName(ctx.skill)}: ${target.name}に${name}(${duration}T)` })
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

const namedSkillHelpers: BattleSkillEffectHelpers = {
  skillDisplayName,
  chooseTarget,
  resolveTargets: (ctx) => resolveTargets(ctx.skill, ctx.caster, ctx.target, ctx.allies, ctx.enemies, ctx.rng),
  varNumber,
  aliveRandom,
  weakest,
  roll,
  dealSkillDamage,
  healBySkill,
  addControl,
  statOf,
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
) => {
  const targets = resolveTargets(skill, caster, target, allies, enemies, rng)
  const skillName = skill.name_jp || skill.name
  const kind = damageKind(skill)
  const rate = damageRate(skill)
  const hRate = healRate(skill)
  const isHeal = hRate > 0 && (/回復|恢復|休養|heal/i.test(textOfSkill(skill)) || rate === 0)
  const canApplyDirectTroopChange = trigger !== 'preparationTurn'

  // 個別実装がある戦法を優先し、未対応の戦法だけ汎用ダメージ/回復/制御へ流す。
  if (applyNamedSkill({ caster, target, allies, enemies, skill, trigger, turn, logs, rng, stats, turnStat, controlStats })) return

  if (canApplyDirectTroopChange && rate > 0 && !isHeal) {
    targets.forEach((fighter) => {
      const beforeHp = fighter.hp
      const beforeWounded = fighter.wounded
      const beforeDead = fighter.dead
      const actual = applyDamage(fighter, baseDamage(
        caster,
        fighter,
        skill,
        rng,
        kind,
        undefined,
        { candidates: fighter.side === caster.side ? allies : enemies, skillType: battleSkillType(skill) },
      ))
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
        applyBingxueLifeSteal(caster, actual, turn, logs, turnStat)
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
      }
    })
  }

  if (canApplyDirectTroopChange && (isHeal || hRate > 0)) {
    const healTargets = targets.length > 0 && targets.some((fighter) => fighter.side === caster.side)
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
) => {
  // 発動タイミング、クールダウン、ターン内回数、確率判定をまとめて見る入口。
  if (!isAlive(caster) || !skillSupportsTrigger(skill, trigger)) return
  if ((caster.skillCooldowns[skill.id || skill.name] ?? 0) > 0) return
  if (skill.maxPerTurn && (caster.skillUsesThisTurn[skill.id || skill.name] ?? 0) >= skill.maxPerTurn) return
  const resolvedSkillType = battleSkillType(skill)
  const unique = isUniqueBattleSkill(skill)
  const prepared = preparationTurns(skill) > 0
  const activationRate = clamp(
    extractRate(skill) + bingxueActivationChanceBonus(caster, resolvedSkillType, unique),
    0,
    1,
  )
  if (rng() > activationRate) {
    recordBingxueSkillFailure(caster, resolvedSkillType, unique, prepared)
    if (trigger === 'beforeAction' || trigger === 'afterNormalAttack') {
      if (logs !== NO_LOGS) logs.push({ turn, side: caster.side, actor: caster.name, actorHp: caster.hp, message: `${skill.name_jp || skill.name}は不発` })
    }
    return
  }

  markBingxueSkillUsed(caster, resolvedSkillType)
  const skillKey = skill.id || skill.name
  caster.skillUsesThisTurn[skillKey] = (caster.skillUsesThisTurn[skillKey] ?? 0) + 1
  if (skill.cooldown) caster.skillCooldowns[skillKey] = skill.cooldown
  recordActivation(stats, caster, skill)

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
  if (logs !== NO_LOGS) logs.push({ turn, side: caster.side, actor: caster.name, actorHp: caster.hp, message: `${skill.name_jp || skill.name}発動` })
  resolveSkill(caster, target, allies, enemies, skill, trigger, turn, logs, rng, stats, turnStat, controlStats)
  recordBingxueSkillResolved(caster, resolvedSkillType, prepared, turn, rng)
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
      const target = chooseTarget(enemies, rng)
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
) => {
  const remaining: TimedStatus[] = []
  fighter.timedStatuses.forEach((status) => {
    if (status.dotRate && isAlive(fighter)) {
      const source = all.find((candidate) => candidate.name === status.sourceActor) ?? fighter
      const pseudoSkill = { id: status.sourceSkill ?? status.name, name: status.sourceSkill ?? status.name } as Skill
      const beforeHp = fighter.hp
      const beforeWounded = fighter.wounded
      const beforeDead = fighter.dead
      const amount = applyDamage(fighter, baseDamage(source, fighter, {
        ...pseudoSkill,
        damage_rate_max: status.dotRate,
        battle_type: status.dotType === 'strategy' ? 'strategy' : 'bravery',
      }, rng, status.dotType ?? 'physical', undefined, {
        candidates: all.filter(candidate => candidate.side === fighter.side),
        dot: true,
        skillType: null,
      }))
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
        recordDamageDealtSkillEffects(source, status.dotType ?? 'physical', turn, logs)
        applyBingxueLifeSteal(source, amount, turn, logs, turnStat)
      }
    }
    status.turns -= 1
    if (status.turns > 0) remaining.push(status)
  })
  fighter.timedStatuses = remaining
}

const isActionBlocked = (fighter: BattleFighter, rng: () => number): string | null => {
  if ((fighter.statuses['封撃'] ?? 0) > 0) return '封撃'
  if ((fighter.statuses['疲弊'] ?? 0) > 0 && rng() < 0.3) return '疲弊'
  if ((fighter.statuses['麻痺'] ?? 0) > 0 && rng() < 0.3) return '麻痺'
  if ((fighter.statuses['無策'] ?? 0) > 0) return '無策'
  return null
}

const tickFighter = (fighter: BattleFighter, turn: number, logs: BattleLogEntry[]) => {
  tickBingxueTurn(fighter, turn)
  Object.keys(fighter.skillCooldowns).forEach((key) => {
    fighter.skillCooldowns[key] = Math.max(0, fighter.skillCooldowns[key] - 1)
  })
  Object.keys(fighter.statuses).forEach((key) => {
    fighter.statuses[key] -= 1
    if (fighter.statuses[key] <= 0) delete fighter.statuses[key]
  })
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
) => {
  if (logs === NO_LOGS) return
  logs.slice(startIndex).forEach((entry) => {
    entry.actionActor = actor.name
    entry.actionSide = actor.side
    entry.actionActorHp = actionActorHp
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
    fireTriggeredSkills(fighter, 'preparationTurn', chooseTarget(enemies, rng), allies, enemies, 0, logs, rng, skillStats, setupStat, controlStats)
  })

  // 本戦は真戦風に8ターン固定。各ターンは継続効果、ターン開始効果、速度順行動の順で進む。
  for (let turn = 1; turn <= BATTLE_TURN_LIMIT; turn += 1) {
    finalTurn = turn
    const all = [...ally, ...enemy]
    const turnStat = emptyTurnStat(turn)
    all.forEach((fighter) => tickFighter(fighter, turn, logs))
    if (logs !== NO_LOGS) logs.push({ turn, side: 'system', message: `ターン${turn}` })
    processTurnStartWoundedDeaths(all, turn, logs)

    all.forEach((fighter) => {
      const allies = fighter.side === 'ally' ? ally : enemy
      const enemies = fighter.side === 'ally' ? enemy : ally
      // 負傷兵死亡や通常のターン開始戦法と同じ段階で、ターン開始兵学を処理する。
      runBingxueTurnStart({
        owner: fighter,
        allies,
        enemies,
        currentTarget: chooseTarget(enemies, rng),
        turn,
        rng,
        helpers: createBingxueHelpers(allies, enemies, turn, logs, rng, skillStats, turnStat, controlStats),
      })
      processDots(fighter, turn, logs, rng, skillStats, all, turnStat)
      processPendingSkills(fighter, allies, enemies, turn, logs, rng, skillStats, turnStat, controlStats)
      fireTriggeredSkills(fighter, 'turnStart', chooseTarget(enemies, rng), allies, enemies, turn, logs, rng, skillStats, turnStat, controlStats)
    })

    const order = living(all).sort((a, b) =>
      Number((b.statuses['先攻'] ?? 0) > 0) - Number((a.statuses['先攻'] ?? 0) > 0)
      || statOf(b, 'spd') - statOf(a, 'spd')
      || (rng() > 0.5 ? 1 : -1),
    )
    for (const actor of order) {
      if (!isAlive(actor)) continue
      const allies = actor.side === 'ally' ? ally : enemy
      const enemies = actor.side === 'ally' ? enemy : ally
      let target = chooseTarget(enemies, rng)
      if (!target) break
      const actionLogStart = logs === NO_LOGS ? 0 : logs.length
      const actionActorHp = actor.hp

      try {
        const blocked = isActionBlocked(actor, rng)
        if (blocked) {
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
        if (!isAlive(target)) continue

        target = chooseTarget(enemies, rng, 'normal')
        if (!target) break
        fireTriggeredSkills(actor, 'beforeNormalAttack', target, allies, enemies, turn, logs, rng, skillStats, turnStat, controlStats)
        if (!isAlive(target)) continue

        const beforeHp = target.hp
        const beforeWounded = target.wounded
        const beforeDead = target.dead
        const normalDamage = applyDamage(
          target,
          baseDamage(actor, target, null, rng, 'normal', undefined, {
            candidates: enemies,
            skillType: null,
          }),
        )
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
          effect: '通常攻撃',
          message: `${actor.name}の通常攻撃: ${target.name}に${normalDamage.toLocaleString()}ダメージ ${hpChangeText(beforeHp, afterHp)} / ${casualtyText(woundedDelta, deadDelta)}`,
        })
        if (normalDamage > 0) {
          recordDamageDealtSkillEffects(actor, 'physical', turn, logs)
          applyBingxueLifeSteal(actor, normalDamage, turn, logs, turnStat)
          runBingxueNormalAttackReceived(
            target,
            actor,
            turn,
            rng,
            createBingxueHelpers(allies, enemies, turn, logs, rng, skillStats, turnStat, controlStats),
          )
          fireTriggeredSkills(target, 'onNormalAttackReceived', actor, enemies, allies, turn, logs, rng, skillStats, turnStat, controlStats)
          fireTriggeredSkills(target, 'onPhysicalDamageReceived', actor, enemies, allies, turn, logs, rng, skillStats, turnStat, controlStats)
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
        fireTriggeredSkills(actor, 'afterNormalAttack', target, allies, enemies, turn, logs, rng, skillStats, turnStat, controlStats)
        if (dateMasamuneHasDragonCavalry(allies) && grantedActionSkills.length > 0) {
          fireTriggeredSkillList(
            actor,
            grantedActionSkills,
            'afterAction',
            chooseTarget(enemies, rng),
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
        const afterActionOwners = actor.role === 'main' ? allies : []
        afterActionOwners.forEach((owner) => {
          if (!isAlive(owner)) return
          fireTriggeredSkills(
            owner,
            'afterAction',
            chooseTarget(enemies, rng),
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
        if (living(enemy).length === 0 || living(ally).length === 0) break
      } finally {
        // 途中で行動が終了した場合も finally で必ず行動後兵学を1回だけ処理する。
        runBingxueAfterAction({
          owner: actor,
          allies,
          enemies,
          currentTarget: chooseTarget(enemies, rng),
          turn,
          rng,
          helpers: createBingxueHelpers(allies, enemies, turn, logs, rng, skillStats, turnStat, controlStats),
        })
        markActionLogs(logs, actionLogStart, actor, actionActorHp)
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

