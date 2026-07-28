import type { Skill, Stat } from '../composables/useData'
import type { BattleFighter } from './battleSimulator'
import type { BattleSkillType } from './battleSkillEffects'

type DamageKind = 'physical' | 'strategy'
type TargetMode = 'normal' | 'skill'

export interface BingxueTimedModifier {
  key: string
  stat: Stat
  value: number
  expiresTurn: number
}

export interface BingxueRuntimeState {
  timedModifiers: BingxueTimedModifier[]
}

export interface BingxueActionHelpers {
  statOf: (fighter: BattleFighter, stat: Stat) => number
  log: (owner: BattleFighter, message: string) => void
  heal: (owner: BattleFighter, target: BattleFighter, rate: number, effect: string) => number
  damage: (
    owner: BattleFighter,
    target: BattleFighter,
    rate: number,
    kind: DamageKind,
    effect: string,
  ) => number
  cleanse: (target: BattleFighter, count: number) => string[]
}

export interface BingxueActionContext {
  owner: BattleFighter
  allies: BattleFighter[]
  enemies: BattleFighter[]
  currentTarget: BattleFighter | null
  turn: number
  rng: () => number
  helpers: BingxueActionHelpers
}

export interface BingxueDamageContext {
  attacker: BattleFighter
  target: BattleFighter
  kind: DamageKind
  skill: Skill | null
  skillType: BattleSkillType | null
  prepared: boolean
  dot: boolean
  candidates: BattleFighter[]
  rng: () => number
}

const alive = (fighters: BattleFighter[]): BattleFighter[] => fighters.filter(fighter => fighter.hp > 0)
const roll = (rng: () => number, chance: number): boolean => rng() < Math.max(0, Math.min(0.95, chance))
const stateKey = (name: string): string => `bingxue:${name}`

export const bingxueLevel = (fighter: BattleFighter, name: string): number => {
  if (fighter.bingxue.major === name) return 1
  return fighter.bingxue.minors.find(minor => minor.name === name)?.level ?? 0
}

export const hasBingxue = (fighter: BattleFighter, name: string): boolean =>
  bingxueLevel(fighter, name) > 0

const addTimedModifier = (
  fighter: BattleFighter,
  key: string,
  stat: Stat,
  value: number,
  expiresTurn: number,
): void => {
  const existing = fighter.bingxueRuntime.timedModifiers.find(item => item.key === key)
  if (existing) {
    fighter.buffs[existing.stat] = (fighter.buffs[existing.stat] ?? 0) - existing.value
    fighter.bingxueRuntime.timedModifiers = fighter.bingxueRuntime.timedModifiers.filter(item => item !== existing)
  }
  fighter.buffs[stat] = (fighter.buffs[stat] ?? 0) + value
  fighter.bingxueRuntime.timedModifiers.push({ key, stat, value, expiresTurn })
}

export const tickBingxueTurn = (fighter: BattleFighter, turn: number): void => {
  fighter.specialState.bingxueCurrentTurn = turn
  const keep: BingxueTimedModifier[] = []
  fighter.bingxueRuntime.timedModifiers.forEach((modifier) => {
    if (modifier.expiresTurn < turn) {
      fighter.buffs[modifier.stat] = (fighter.buffs[modifier.stat] ?? 0) - modifier.value
    } else {
      keep.push(modifier)
    }
  })
  fighter.bingxueRuntime.timedModifiers = keep
  fighter.specialState.bingxueActiveUsedThisAction = 0
  fighter.specialState.bingxueAssaultUsedThisAction = 0
}

export const bingxueStatBonus = (fighter: BattleFighter, stat: Stat): number => {
  if (stat !== 'spd') return 0
  let bonus = 10 * bingxueLevel(fighter, '機動')
  if ((fighter.specialState.bingxueCurrentTurn ?? 0) <= 1) {
    bonus += 20 * bingxueLevel(fighter, '早駆')
  }
  return bonus
}

export const initializeBingxueBattle = (
  fighter: BattleFighter,
  allies: BattleFighter[],
  rng: () => number,
  log: (owner: BattleFighter, message: string) => void,
): void => {
  if (hasBingxue(fighter, '殿軍救護')) {
    alive(allies).filter(ally => ally.id !== fighter.id).forEach((ally) => {
      ally.buffs.damageDealt = (ally.buffs.damageDealt ?? 0) + 4
    })
    fighter.buffs.damageTaken = (fighter.buffs.damageTaken ?? 0) + 10
    log(fighter, '殿軍救護: 友軍の与ダメージ+4%、自身の被ダメージ+10%')
  }

  const internalAid = bingxueLevel(fighter, '内助')
  if (internalAid > 0) {
    fighter.buffs.damageTaken = (fighter.buffs.damageTaken ?? 0) + 1.5 * internalAid
    const commander = allies.find(ally => ally.role === 'main')
    if (commander) {
      commander.buffs.damageTaken = (commander.buffs.damageTaken ?? 0) - 2.5 * internalAid
    }
    log(fighter, `内助${internalAid}: 自身の被ダメージ+${1.5 * internalAid}%、大将の被ダメージ-${2.5 * internalAid}%`)
  }

  const cooperation = bingxueLevel(fighter, '協同')
  if (cooperation > 0) {
    const friends = alive(allies).filter(ally => ally.id !== fighter.id)
    const target = friends[Math.floor(rng() * friends.length)]
    if (target) {
      target.buffs.damageDealt = (target.buffs.damageDealt ?? 0) + 1.5 * cooperation
      log(fighter, `協同${cooperation}: ${target.name}の与ダメージ+${1.5 * cooperation}%`)
    }
  }
}

export const bingxueActivationChanceBonus = (fighter: BattleFighter, skillType: BattleSkillType, unique: boolean): number => {
  let bonus = 0
  if (skillType === '突撃') bonus += 0.01 * bingxueLevel(fighter, '活路')
  if (unique && skillType === '能動') bonus += 0.01 * bingxueLevel(fighter, '果敢')
  if (unique && skillType === '突撃') bonus += 0.01 * bingxueLevel(fighter, '兵家')
  return bonus
}

export const recordBingxueSkillFailure = (
  fighter: BattleFighter,
  skillType: BattleSkillType,
  unique: boolean,
  prepared: boolean,
): void => {
  if (unique && prepared && skillType === '能動' && hasBingxue(fighter, '七転八起')) {
    fighter.specialState.bingxueSevenFallsPending = 1
  }
}

export const consumeBingxuePreparationReduction = (
  fighter: BattleFighter,
  skillType: BattleSkillType,
  unique: boolean,
  prepared: boolean,
  rng: () => number,
): boolean => {
  if (!unique || !prepared || skillType !== '能動') return false
  if ((fighter.specialState.bingxueSevenFallsPending ?? 0) <= 0) return false
  fighter.specialState.bingxueSevenFallsPending = 0
  return hasBingxue(fighter, '七転八起') && roll(rng, 0.7)
}

export const markBingxueSkillUsed = (fighter: BattleFighter, skillType: BattleSkillType): void => {
  if (skillType === '能動') fighter.specialState.bingxueActiveUsedThisAction = 1
  if (skillType === '突撃') fighter.specialState.bingxueAssaultUsedThisAction = 1
}

export const recordBingxueSkillResolved = (
  fighter: BattleFighter,
  skillType: BattleSkillType,
  prepared: boolean,
  turn: number,
  rng: () => number,
): void => {
  if (skillType === '突撃' && hasBingxue(fighter, '兵勢連鎖')) {
    fighter.specialState.bingxueAssaultDamageStacks = Math.min(
      4,
      (fighter.specialState.bingxueAssaultDamageStacks ?? 0) + 1,
    )
  }
  if (skillType === '能動' && hasBingxue(fighter, '離間の計')) {
    fighter.specialState.bingxueDrainStacks = Math.min(
      5,
      (fighter.specialState.bingxueDrainStacks ?? 0) + 1,
    )
  }
  const courage = bingxueLevel(fighter, '胆力')
  if (skillType === '突撃' && courage > 0) {
    addTimedModifier(fighter, stateKey('胆力'), 'damageTaken', -3 * courage, turn)
  }
  if (skillType === '能動' && prepared && hasBingxue(fighter, '臨機応変') && roll(rng, 0.4)) {
    fighter.statuses['先攻'] = Math.max(fighter.statuses['先攻'] ?? 0, 2)
  }
}

const intScaledPercent = (base: number, intelligence: number): number =>
  base * Math.min(1.5, 1 + Math.max(0, intelligence - 100) / 1000)

export const resolveBingxueDamage = (ctx: BingxueDamageContext): { multiplier: number; evaded: boolean; critical: boolean } => {
  const { attacker, target, kind, skillType, skill, prepared, dot, candidates, rng } = ctx
  const turn = target.specialState.bingxueCurrentTurn ?? 0
  const evasion = (
    1.5 * bingxueLevel(target, '地利')
    + (target.role === 'main' && turn <= 3 ? 2.5 * bingxueLevel(target, '慧眼') : 0)
  ) / 100
  if (roll(rng, evasion)) return { multiplier: 0, evaded: true, critical: false }

  let percent = 0
  percent += bingxueLevel(attacker, '鬼気')
  percent -= 2 * bingxueLevel(attacker, '天時')

  if (!skill) percent += 3 * bingxueLevel(attacker, '剛力')
  if (kind === 'strategy') {
    percent += intScaledPercent(bingxueLevel(attacker, '多謀'), attacker.baseStats.int + (attacker.buffs.int ?? 0))
  }
  if (skillType === '突撃') {
    percent += 5 + 5 * (attacker.specialState.bingxueAssaultDamageStacks ?? 0)
    if (!hasBingxue(attacker, '兵勢連鎖')) percent -= 5
    percent -= 2 * bingxueLevel(attacker, '活路')
  }
  if (skillType === '能動') percent += 1.25 * bingxueLevel(attacker, '神算')
  if (skillType === '能動' && prepared) percent += 1.5 * bingxueLevel(attacker, '大勇')
  if (dot) percent += hasBingxue(attacker, '詭計百出') ? 18 : 0

  const highestHp = Math.max(0, ...alive(candidates).map(candidate => candidate.hp))
  if (hasBingxue(attacker, '破陣の勢い') && target.hp >= highestHp) percent += 6

  percent -= 2 * bingxueLevel(target, '天時')
  if (kind === 'strategy') {
    percent -= 1.8 * bingxueLevel(target, '才気')
    if (hasBingxue(target, '勇猛果敢')) {
      percent -= Math.min(12, 8 + Math.max(0, target.baseStats.val + (target.buffs.val ?? 0) - 100) * 0.01)
    }
  } else {
    percent -= bingxueLevel(target, '俊才')
  }
  if (!skill || skillType === '突撃') percent -= 3 * bingxueLevel(target, '逆境')
  if (skillType === '能動') percent -= 3.5 * bingxueLevel(target, '不敵')
  if (skillType === '指揮' || skillType === '受動') percent -= 3.5 * bingxueLevel(target, '兵心')
  if (attacker.troopAffinityModifier > 1) percent -= 3 * bingxueLevel(target, '乱戦')
  if (hasBingxue(target, '脱兎の如し')) {
    percent -= Math.min(6, 3 + Math.max(0, target.baseStats.spd + (target.buffs.spd ?? 0) - 100) * 0.01)
  }
  if (kind === 'physical' && (target.specialState.bingxuePhysicalGuardUntil ?? 0) >= turn) {
    percent -= target.specialState.bingxuePhysicalGuardValue ?? 0
  }
  if (kind === 'strategy' && (target.specialState.bingxueStrategyGuardUntil ?? 0) >= turn) {
    percent -= target.specialState.bingxueStrategyGuardValue ?? 0
  }

  const criticalChance = kind === 'physical'
    ? 0.02 * bingxueLevel(attacker, '豪勇')
    : intScaledPercent(0.02 * bingxueLevel(attacker, '妙策'), attacker.baseStats.int + (attacker.buffs.int ?? 0))
  const critical = roll(rng, criticalChance)
  const criticalBonus = kind === 'physical'
    ? 0.025 * bingxueLevel(attacker, '突貫')
    : 0.025 * bingxueLevel(attacker, '奇謀')
  const criticalMultiplier = critical ? 1.5 + criticalBonus : 1

  return {
    multiplier: Math.max(0.1, 1 + percent / 100) * criticalMultiplier,
    evaded: false,
    critical,
  }
}

export const bingxueHealMultiplier = (caster: BattleFighter, target: BattleFighter): number => {
  const output = 2.5 * bingxueLevel(caster, '仁愛')
  const received = 4 * bingxueLevel(target, '恩顧')
  return Math.max(0.1, 1 + (output + received) / 100)
}

export const bingxueLifeStealPercent = (fighter: BattleFighter): number => {
  const turn = fighter.specialState.bingxueCurrentTurn ?? 0
  const temporary = (fighter.specialState.bingxueDefectionUntil ?? 0) >= turn ? 6 : 0
  return temporary + (fighter.specialState.bingxueDrainStacks ?? 0)
}

export const preferredBingxueTarget = (
  candidates: BattleFighter[],
  mode: TargetMode,
  turn: number,
): BattleFighter | null => {
  if (mode === 'normal' && turn <= 3) {
    return alive(candidates).find(candidate => hasBingxue(candidate, '先陣誘導')) ?? null
  }
  if (mode === 'skill' && turn >= 4) {
    return alive(candidates).find(candidate => hasBingxue(candidate, '陽動の策')) ?? null
  }
  return null
}

export const controlBlockedByBingxue = (target: BattleFighter, controlName: string): boolean =>
  controlName === '封撃' && (target.statuses['封撃耐性'] ?? 0) > 0

export const runBingxueTurnStart = (ctx: BingxueActionContext): void => {
  const { owner, allies, turn, rng, helpers } = ctx

  if (turn === 5 && hasBingxue(owner, '強靭') && (owner.specialState.bingxueStrongApplied ?? 0) === 0) {
    owner.specialState.bingxueStrongApplied = 1
    const level = bingxueLevel(owner, '強靭')
    if (owner.hp > owner.maxHp * 0.5) {
      owner.buffs.damageDealt = (owner.buffs.damageDealt ?? 0) + 2 * level
      helpers.log(owner, `強靭${level}: 兵力50%超のため与ダメージ+${2 * level}%`)
    } else {
      owner.buffs.damageTaken = (owner.buffs.damageTaken ?? 0) - 2 * level
      helpers.log(owner, `強靭${level}: 兵力50%以下のため被ダメージ-${2 * level}%`)
    }
  }

  if (turn === 3 && hasBingxue(owner, '心頭滅却')) {
    const removed = helpers.cleanse(owner, 1)
    if (removed.length > 0) helpers.log(owner, `心頭滅却: ${removed.join('、')}を浄化`)
  }

  if (turn === 4 && hasBingxue(owner, '達人大観')) {
    const targets = alive(allies).filter(ally => ally.id !== owner.id)
    const target = targets[Math.floor(rng() * targets.length)]
    if (target) {
      const removed = helpers.cleanse(target, 2)
      if (removed.length > 0) helpers.log(owner, `達人大観: ${target.name}の${removed.join('、')}を浄化`)
    }
  }
}

export const runBingxueBeforeAction = (ctx: BingxueActionContext): void => {
  const { owner, turn, rng, helpers } = ctx

  if (hasBingxue(owner, '生々流転') && roll(rng, 0.4)) {
    helpers.heal(owner, owner, 50, '生々流転')
  }
  if (hasBingxue(owner, '舟中敵国') && roll(rng, 0.5)) {
    owner.specialState.bingxueDefectionUntil = turn
    helpers.log(owner, '舟中敵国: 離反6%を獲得')
  }
  if (hasBingxue(owner, '表裏一体')) {
    const chance = Math.min(0.45, 0.1 + Math.max(0, helpers.statOf(owner, 'int') - 100) * 0.0005)
    if (roll(rng, chance)) {
      owner.specialState.bingxueComboThisAction = 1
      helpers.log(owner, '表裏一体: 連撃を獲得')
    }
  }
  if (hasBingxue(owner, '智勇兼備') && (owner.specialState.bingxueWisdomBraveryApplied ?? 0) === 0 && roll(rng, 0.75)) {
    const value = Math.round(helpers.statOf(owner, 'val') * 0.08 * 100) / 100
    owner.specialState.bingxueWisdomBraveryApplied = 1
    owner.buffs.int = (owner.buffs.int ?? 0) + value
    helpers.log(owner, `智勇兼備: 知略+${value}`)
  }
  const mystery = bingxueLevel(owner, '神秘')
  if (mystery > 0) {
    const value = 3 * mystery
    if (rng() < 0.5) {
      owner.specialState.bingxuePhysicalGuardUntil = turn
      owner.specialState.bingxuePhysicalGuardValue = value
      helpers.log(owner, `神秘${mystery}: 兵刃被ダメージ-${value}%`)
    } else {
      owner.specialState.bingxueStrategyGuardUntil = turn
      owner.specialState.bingxueStrategyGuardValue = value
      helpers.log(owner, `神秘${mystery}: 計略被ダメージ-${value}%`)
    }
  }
}

export const runBingxueAfterNormalAttack = (ctx: BingxueActionContext): void => {
  const { owner, currentTarget, turn, rng, helpers } = ctx
  if (hasBingxue(owner, '当意即妙')) {
    const countKey = 'bingxueQuickHealCount'
    const turnKey = 'bingxueQuickHealTurn'
    if ((owner.specialState[turnKey] ?? 0) !== turn) {
      owner.specialState[turnKey] = turn
      owner.specialState[countKey] = 0
    }
    const count = owner.specialState[countKey] ?? 0
    const chance = count === 0 ? 0.5 : 0.25
    if (count < 2 && roll(rng, chance)) {
      owner.specialState[countKey] = count + 1
      helpers.heal(owner, owner, 60, '当意即妙')
    }
  }
  if (currentTarget && currentTarget.hp > 0 && (owner.specialState.bingxueComboThisAction ?? 0) > 0) {
    owner.specialState.bingxueComboThisAction = 0
    helpers.damage(owner, currentTarget, 100, 'physical', '表裏一体')
  }
}

export const runBingxueAfterAction = (ctx: BingxueActionContext): void => {
  const { owner, turn, rng, helpers } = ctx
  if (hasBingxue(owner, '冷静沈着') && (owner.statuses['封撃'] ?? 0) > 0 && roll(rng, 0.8)) {
    owner.statuses['封撃耐性'] = Math.max(owner.statuses['封撃耐性'] ?? 0, 2)
    helpers.log(owner, '冷静沈着: 封撃耐性を獲得')
  }

  const training = bingxueLevel(owner, '練磨')
  if (training > 0 && (owner.specialState.bingxueActiveUsedThisAction ?? 0) === 0) {
    const value = 2.5 * training
    const stat: Stat = rng() < 0.5 ? 'damageDealt' : 'damageTaken'
    addTimedModifier(owner, stateKey('練磨'), stat, stat === 'damageDealt' ? value : -value, turn + 1)
    helpers.log(owner, `練磨${training}: ${stat === 'damageDealt' ? '与ダメージ上昇' : '被ダメージ低下'}${value}%`)
  }

  const caution = bingxueLevel(owner, '警戒')
  if (caution > 0 && (owner.specialState.bingxueAssaultUsedThisAction ?? 0) === 0) {
    const value = 3 * caution
    const stat: Stat = rng() < 0.5 ? 'damageDealt' : 'damageTaken'
    addTimedModifier(owner, stateKey('警戒'), stat, stat === 'damageDealt' ? value : -value, turn + 1)
    helpers.log(owner, `警戒${caution}: ${stat === 'damageDealt' ? '与ダメージ上昇' : '被ダメージ低下'}${value}%`)
  }
}

export const runBingxueNormalAttackReceived = (
  defender: BattleFighter,
  attacker: BattleFighter,
  turn: number,
  rng: () => number,
  helpers: BingxueActionHelpers,
): void => {
  if (!hasBingxue(defender, '気勢崩し') || !roll(rng, 0.5)) return
  addTimedModifier(attacker, `${stateKey('気勢崩し')}:val`, 'val', -12, turn)
  addTimedModifier(attacker, `${stateKey('気勢崩し')}:int`, 'int', -12, turn)
  helpers.log(defender, `気勢崩し: ${attacker.name}の武勇・知略-12`)
}

export const runBingxueSkillHeal = (
  caster: BattleFighter,
  target: BattleFighter,
  allies: BattleFighter[],
  turn: number,
  helpers: BingxueActionHelpers,
  wasLowestBeforeHeal = true,
): void => {
  if (hasBingxue(caster, '手当の心得') && wasLowestBeforeHeal) {
    addTimedModifier(target, `${stateKey('手当の心得')}:${caster.id}`, 'damageTaken', -6, turn)
    helpers.log(caster, `手当の心得: ${target.name}の被ダメージ-6%`)
  }
  if (hasBingxue(caster, '鼓舞激励') && target.id !== caster.id) {
    addTimedModifier(target, `${stateKey('鼓舞激励')}:${caster.id}`, 'damageDealt', 4, turn)
    helpers.log(caster, `鼓舞激励: ${target.name}の与ダメージ+4%`)
  }
}

export const runBingxueControlApplied = (
  controller: BattleFighter,
  target: BattleFighter,
  targetAllies: BattleFighter[],
  targetEnemies: BattleFighter[],
  turn: number,
  rng: () => number,
  helpers: BingxueActionHelpers,
): void => {
  if (hasBingxue(controller, '軍律擾乱') && roll(rng, 0.6)) {
    addTimedModifier(target, `${stateKey('軍律擾乱')}:lea`, 'lea', -helpers.statOf(target, 'lea') * 0.08, turn + 1)
    addTimedModifier(target, `${stateKey('軍律擾乱')}:int`, 'int', -helpers.statOf(target, 'int') * 0.08, turn + 1)
    helpers.log(controller, `軍律擾乱: ${target.name}の統率・知略-8%`)
  }
  if (hasBingxue(controller, '搦手の策') && roll(rng, 0.6)) {
    addTimedModifier(target, stateKey('搦手の策'), 'damageTaken', 8, turn + 1)
    helpers.log(controller, `搦手の策: ${target.name}の被ダメージ+8%`)
  }
  if (hasBingxue(controller, '右往左往')) {
    addTimedModifier(target, stateKey('右往左往'), 'damageDealt', -8, turn + 1)
    helpers.log(controller, `右往左往: ${target.name}の与ダメージ-8%`)
  }

  if (hasBingxue(target, '返り討ちの計')) {
    const uses = target.specialState.bingxueCounterUses ?? 0
    const retaliationTarget = alive(targetEnemies)[Math.floor(rng() * alive(targetEnemies).length)]
    if (uses < 3 && retaliationTarget && roll(rng, 0.9)) {
      target.specialState.bingxueCounterUses = uses + 1
      const kind: DamageKind = helpers.statOf(target, 'val') >= helpers.statOf(target, 'int') ? 'physical' : 'strategy'
      helpers.damage(target, retaliationTarget, 100, kind, '返り討ちの計')
    }
  }

  targetAllies.forEach((owner) => {
    const perplexity = bingxueLevel(owner, '不惑')
    if (owner.id !== target.id && perplexity > 0 && (owner.specialState.bingxuePerplexityTurn ?? 0) !== turn) {
      owner.specialState.bingxuePerplexityTurn = turn
      addTimedModifier(target, `${stateKey('不惑')}:${owner.id}`, 'damageTaken', -4.5 * perplexity, turn)
      helpers.log(owner, `不惑${perplexity}: ${target.name}の被ダメージ-${4.5 * perplexity}%`)
    }
  })

  const clearMind = bingxueLevel(target, '明鏡')
  if (turn >= 1 && clearMind > 0 && (target.specialState.bingxueClearMindUses ?? 0) < 2) {
    const friend = alive(targetAllies)
      .filter(ally => ally.id !== target.id)
      .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0]
    if (friend) {
      target.specialState.bingxueClearMindUses = (target.specialState.bingxueClearMindUses ?? 0) + 1
      helpers.heal(target, friend, 25 * clearMind, '明鏡')
    }
  }
}

export const IMPLEMENTED_BINGXUE_NAMES = new Set([
  '生々流転', '気勢崩し', '陽動の策', '慧眼', '兵心', '不敵', '逆境', '才気', '俊才',
  '兵勢連鎖', '舟中敵国', '当意即妙', '胆力', '活路', '突貫', '妙策', '豪勇', '剛力',
  '破陣の勢い', '離間の計', '軍律擾乱', '強靭', '神秘', '早駆', '大勇', '鬼気', '神算',
  '搦手の策', '達人大観', '手当の心得', '不惑', '明鏡', '天時', '機動', '地利', '協同',
  '返り討ちの計', '乱戦', '恩顧', '冷静沈着', '表裏一体', '奇謀', '詭計百出', '多謀',
  '心頭滅却', '臨機応変', '鼓舞激励', '智勇兼備', '仁愛', '練磨', '果敢', '脱兎の如し',
  '警戒', '兵家', '勇猛果敢', '七転八起', '先陣誘導', '右往左往', '殿軍救護', '内助',
])
