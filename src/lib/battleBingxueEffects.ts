import type { Skill, Stat } from '../composables/useData'
import type { BattleFighter } from './battleSimulator'
import type { BattleSkillType } from './battleSkillEffects'

/**
 * 兵学固有効果をまとめたファイル。
 *
 * `battleSimulator.ts` が戦闘開始、ターン開始、行動前後、被弾時などの
 * 各タイミングで `runBingxue...` 関数を呼び出す。兵学を追加・修正する時は、
 * 説明文に対応する発動タイミングの関数へ処理を追加する。
 *
 * `fighter.buffs` の damageDealt / damageTaken は割合ポイントで保持する。
 * 例: damageDealt に 5 を加えると与ダメージ+5%として計算される。
 */
type DamageKind = 'physical' | 'strategy'
type TargetMode = 'normal' | 'skill'

// ターンをまたぐ一時補正。期限を過ぎたら tickBingxueTurn で自動解除する。
export interface BingxueTimedModifier {
  key: string
  stat: Stat
  value: number
  expiresTurn: number
}

export interface BingxueRuntimeState {
  timedModifiers: BingxueTimedModifier[]
}

// 兵学から戦闘本体の計算・ログ処理を利用するための窓口。
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
// 確率は0～95%へ丸め、100%に近い効果にも最低限の不発余地を残す。
const roll = (rng: () => number, chance: number): boolean => rng() < Math.max(0, Math.min(0.95, chance))
// 一時補正の識別子を通常の戦法状態と衝突しない名前に統一する。
const stateKey = (name: string): string => `bingxue:${name}`

// 主兵法はLv1、副兵法はカードで選択したLvを返す。
export const bingxueLevel = (fighter: BattleFighter, name: string): number => {
  if (fighter.bingxue.major === name) return 1
  return fighter.bingxue.minors.find(minor => minor.name === name)?.level ?? 0
}

export const hasBingxue = (fighter: BattleFighter, name: string): boolean =>
  bingxueLevel(fighter, name) > 0

/**
 * 同じ兵学の一時補正を付け直す。
 * 既存値を先に戻すことで、再発動しても補正が意図せず重複しない。
 */
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
    // 有効期限を過ぎた補正値を buffs から差し引いて元へ戻す。
    if (modifier.expiresTurn < turn) {
      fighter.buffs[modifier.stat] = (fighter.buffs[modifier.stat] ?? 0) - modifier.value
    } else {
      keep.push(modifier)
    }
  })
  fighter.bingxueRuntime.timedModifiers = keep
  // 「この行動で戦法を使わなかった時」の判定用フラグを毎ターン初期化する。
  fighter.specialState.bingxueActiveUsedThisAction = 0
  fighter.specialState.bingxueAssaultUsedThisAction = 0
}

// statOf から常時参照する速度補正。機動は常時、早駆は第1ターンまで有効。
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
  // 殿軍救護: 戦闘開始時に友軍を強化する代わりに、自身の被ダメージを増やす。
  if (hasBingxue(fighter, '殿軍救護')) {
    alive(allies).filter(ally => ally.id !== fighter.id).forEach((ally) => {
      ally.buffs.damageDealt = (ally.buffs.damageDealt ?? 0) + 4
    })
    fighter.buffs.damageTaken = (fighter.buffs.damageTaken ?? 0) + 10
    log(fighter, '殿軍救護: 友軍の与ダメージ+4%、自身の被ダメージ+10%')
  }

  // 内助: 自身が受けるダメージを増やし、その分だけ大将を守る。
  const internalAid = bingxueLevel(fighter, '内助')
  if (internalAid > 0) {
    fighter.buffs.damageTaken = (fighter.buffs.damageTaken ?? 0) + 1.5 * internalAid
    const commander = allies.find(ally => ally.role === 'main')
    if (commander) {
      commander.buffs.damageTaken = (commander.buffs.damageTaken ?? 0) - 2.5 * internalAid
    }
    log(fighter, `内助${internalAid}: 自身の被ダメージ+${1.5 * internalAid}%、大将の被ダメージ-${2.5 * internalAid}%`)
  }

  // 協同: 自分以外の生存中の味方1名をランダムに強化する。
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

// 戦法ごとの元発動率へ加算する兵学補正。戻り値0.01は発動率+1%。
export const bingxueActivationChanceBonus = (fighter: BattleFighter, skillType: BattleSkillType, unique: boolean): number => {
  let bonus = 0
  if (skillType === '突撃') bonus += 0.01 * bingxueLevel(fighter, '活路')
  if (unique && skillType === '能動') bonus += 0.01 * bingxueLevel(fighter, '果敢')
  if (unique && skillType === '突撃') bonus += 0.01 * bingxueLevel(fighter, '兵家')
  return bonus
}

// 七転八起: 固有の準備能動戦法が不発だった事実を、次回判定まで記録する。
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

// 七転八起: 前回不発していれば70%で次の準備ターンを1短縮する。
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

// 練磨・警戒が「この行動中に戦法を使ったか」を判断するための使用記録。
export const markBingxueSkillUsed = (fighter: BattleFighter, skillType: BattleSkillType): void => {
  if (skillType === '能動') fighter.specialState.bingxueActiveUsedThisAction = 1
  if (skillType === '突撃') fighter.specialState.bingxueAssaultUsedThisAction = 1
}

// 戦法が実際に効果を解決した直後に、積み重ね型・発動後型の兵学を処理する。
export const recordBingxueSkillResolved = (
  fighter: BattleFighter,
  skillType: BattleSkillType,
  prepared: boolean,
  turn: number,
  rng: () => number,
): void => {
  // 兵勢連鎖: 突撃戦法を発動するたび、以降の突撃ダメージ用スタックを増やす。
  if (skillType === '突撃' && hasBingxue(fighter, '兵勢連鎖')) {
    fighter.specialState.bingxueAssaultDamageStacks = Math.min(
      4,
      (fighter.specialState.bingxueAssaultDamageStacks ?? 0) + 1,
    )
  }
  // 離間の計: 能動戦法の発動回数に応じて離反・心攻の回復率を増やす。
  if (skillType === '能動' && hasBingxue(fighter, '離間の計')) {
    fighter.specialState.bingxueDrainStacks = Math.min(
      5,
      (fighter.specialState.bingxueDrainStacks ?? 0) + 1,
    )
  }
  // 胆力: 突撃戦法発動後、このターン中の被ダメージを軽減する。
  const courage = bingxueLevel(fighter, '胆力')
  if (skillType === '突撃' && courage > 0) {
    addTimedModifier(fighter, stateKey('胆力'), 'damageTaken', -3 * courage, turn)
  }
  // 臨機応変: 固有の準備能動戦法発動後、確率で封撃耐性を得る。
  if (skillType === '能動' && prepared && hasBingxue(fighter, '臨機応変') && roll(rng, 0.4)) {
    fighter.statuses['先攻'] = Math.max(fighter.statuses['先攻'] ?? 0, 2)
  }
}

// 知略依存の割合を最大1.5倍まで伸ばす共通計算。
const intScaledPercent = (base: number, intelligence: number): number =>
  base * Math.min(1.5, 1 + Math.max(0, intelligence - 100) / 1000)

/**
 * ダメージ確定前に兵学補正をまとめて計算する。
 * 戻り値の multiplier を通常ダメージへ掛け、evaded=trueならダメージを0にする。
 */
export const resolveBingxueDamage = (ctx: BingxueDamageContext): { multiplier: number; evaded: boolean; critical: boolean } => {
  const { attacker, target, kind, skillType, skill, prepared, dot, candidates, rng } = ctx
  const turn = target.specialState.bingxueCurrentTurn ?? 0
  // 地利と慧眼による回避。慧眼は大将かつ3ターン目まで。
  const evasion = (
    1.5 * bingxueLevel(target, '地利')
    + (target.role === 'main' && turn <= 3 ? 2.5 * bingxueLevel(target, '慧眼') : 0)
  ) / 100
  if (roll(rng, evasion)) return { multiplier: 0, evaded: true, critical: false }

  let percent = 0
  // 常時与ダメージ補正。
  percent += bingxueLevel(attacker, '鬼気')
  percent -= 2 * bingxueLevel(attacker, '天時')

  // 攻撃種別・戦法種別に応じた与ダメージ補正。
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

  // 破陣の勢い: 現在兵力が最も多い敵を狙った時だけ加算する。
  const highestHp = Math.max(0, ...alive(candidates).map(candidate => candidate.hp))
  if (hasBingxue(attacker, '破陣の勢い') && target.hp >= highestHp) percent += 6

  // 防御側の兵学による被ダメージ補正。
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

  // 豪勇・妙算で会心率を決め、突破・奇謀で会心倍率を上げる。
  const criticalChance = kind === 'physical'
    ? 0.02 * bingxueLevel(attacker, '豪勇')
    : intScaledPercent(0.02 * bingxueLevel(attacker, '妙策'), attacker.baseStats.int + (attacker.buffs.int ?? 0))
  const critical = roll(rng, criticalChance)
  const criticalBonus = kind === 'physical'
    ? 0.025 * bingxueLevel(attacker, '突貫')
    : 0.025 * bingxueLevel(attacker, '奇謀')
  const criticalMultiplier = critical ? 1.5 + criticalBonus : 1

  return {
    // 極端な軽減が重なっても最低10%は残す。
    multiplier: Math.max(0.1, 1 + percent / 100) * criticalMultiplier,
    evaded: false,
    critical,
  }
}

export const bingxueHealMultiplier = (caster: BattleFighter, target: BattleFighter): number => {
  // 仁愛は回復する側、恩顧は回復を受ける側の倍率へ加算する。
  const output = 2.5 * bingxueLevel(caster, '仁愛')
  const received = 4 * bingxueLevel(target, '恩顧')
  return Math.max(0.1, 1 + (output + received) / 100)
}

// 与えたダメージの何%を兵力へ戻すかを返す。舟中敵国は発動ターンのみ有効。
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
  // 先陣誘導: 最初の3ターンは通常攻撃を自分へ引きつける。
  if (mode === 'normal' && turn <= 3) {
    return alive(candidates).find(candidate => hasBingxue(candidate, '先陣誘導')) ?? null
  }
  // 陽動の策: 4ターン目以降は戦法の対象を自分へ引きつける。
  if (mode === 'skill' && turn >= 4) {
    return alive(candidates).find(candidate => hasBingxue(candidate, '陽動の策')) ?? null
  }
  return null
}

// 冷静沈着で得た封撃耐性がある間は封撃付与を無効化する。
export const controlBlockedByBingxue = (target: BattleFighter, controlName: string): boolean =>
  controlName === '封撃' && (target.statuses['封撃耐性'] ?? 0) > 0

// 全武将のターン開始処理で呼ばれる兵学効果。
export const runBingxueTurnStart = (ctx: BingxueActionContext): void => {
  const { owner, allies, turn, rng, helpers } = ctx

  // 強靭: 第5ターンに残兵割合を確認し、攻撃か防御のどちらかを永続強化する。
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

  // 心頭滅却: 第3ターンに自身の弱体状態を1つ解除する。
  if (turn === 3 && hasBingxue(owner, '心頭滅却')) {
    const removed = helpers.cleanse(owner, 1)
    if (removed.length > 0) helpers.log(owner, `心頭滅却: ${removed.join('、')}を浄化`)
  }

  // 達人大観: 第4ターンに自分以外の味方1名から弱体状態を2つ解除する。
  if (turn === 4 && hasBingxue(owner, '達人大観')) {
    const targets = alive(allies).filter(ally => ally.id !== owner.id)
    const target = targets[Math.floor(rng() * targets.length)]
    if (target) {
      const removed = helpers.cleanse(target, 2)
      if (removed.length > 0) helpers.log(owner, `達人大観: ${target.name}の${removed.join('、')}を浄化`)
    }
  }
}

// 武将本人の行動が始まる直前に呼ばれる兵学効果。
export const runBingxueBeforeAction = (ctx: BingxueActionContext): void => {
  const { owner, turn, rng, helpers } = ctx

  // 生々流転: 確率で自身を回復する。
  if (hasBingxue(owner, '生々流転') && roll(rng, 0.4)) {
    helpers.heal(owner, owner, 50, '生々流転')
  }
  // 舟中敵国: 発動ターン中だけ離反・心攻を6%得る。
  if (hasBingxue(owner, '舟中敵国') && roll(rng, 0.5)) {
    owner.specialState.bingxueDefectionUntil = turn
    helpers.log(owner, '舟中敵国: 離反6%を獲得')
  }
  // 表裏一体: 知略依存の確率で、この行動の通常攻撃後に追加攻撃する。
  if (hasBingxue(owner, '表裏一体')) {
    const chance = Math.min(0.45, 0.1 + Math.max(0, helpers.statOf(owner, 'int') - 100) * 0.0005)
    if (roll(rng, chance)) {
      owner.specialState.bingxueComboThisAction = 1
      helpers.log(owner, '表裏一体: 連撃を獲得')
    }
  }
  // 智勇兼備: 戦闘中1回だけ、武勇に応じた知略を得る。
  if (hasBingxue(owner, '智勇兼備') && (owner.specialState.bingxueWisdomBraveryApplied ?? 0) === 0 && roll(rng, 0.75)) {
    const value = Math.round(helpers.statOf(owner, 'val') * 0.08 * 100) / 100
    owner.specialState.bingxueWisdomBraveryApplied = 1
    owner.buffs.int = (owner.buffs.int ?? 0) + value
    helpers.log(owner, `智勇兼備: 知略+${value}`)
  }
  // 神秘: 行動ごとに兵刃・計略のどちらか片方へ被ダメージ軽減を付ける。
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

// 通常攻撃と突撃戦法の処理が終わった直後に呼ばれる兵学効果。
export const runBingxueAfterNormalAttack = (ctx: BingxueActionContext): void => {
  const { owner, currentTarget, turn, rng, helpers } = ctx
  // 当意即妙: 1回目50%、2回目25%で自身を回復し、1ターン最大2回まで。
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
  // 表裏一体: 行動前に獲得した連撃フラグを消費して、同じ対象へ追加攻撃する。
  if (currentTarget && currentTarget.hp > 0 && (owner.specialState.bingxueComboThisAction ?? 0) > 0) {
    owner.specialState.bingxueComboThisAction = 0
    helpers.damage(owner, currentTarget, 100, 'physical', '表裏一体')
  }
}

// 通常攻撃まで含む武将1人分の行動がすべて終わった後に呼ばれる兵学効果。
export const runBingxueAfterAction = (ctx: BingxueActionContext): void => {
  const { owner, turn, rng, helpers } = ctx
  // 冷静沈着: 封撃中に確率で封撃耐性を得て、次の付与を防ぐ。
  if (hasBingxue(owner, '冷静沈着') && (owner.statuses['封撃'] ?? 0) > 0 && roll(rng, 0.8)) {
    owner.statuses['封撃耐性'] = Math.max(owner.statuses['封撃耐性'] ?? 0, 2)
    helpers.log(owner, '冷静沈着: 封撃耐性を獲得')
  }

  // 練磨: 能動戦法を使わなかった行動後、攻撃か防御を次ターンまで強化する。
  const training = bingxueLevel(owner, '練磨')
  if (training > 0 && (owner.specialState.bingxueActiveUsedThisAction ?? 0) === 0) {
    const value = 2.5 * training
    const stat: Stat = rng() < 0.5 ? 'damageDealt' : 'damageTaken'
    addTimedModifier(owner, stateKey('練磨'), stat, stat === 'damageDealt' ? value : -value, turn + 1)
    helpers.log(owner, `練磨${training}: ${stat === 'damageDealt' ? '与ダメージ上昇' : '被ダメージ低下'}${value}%`)
  }

  // 警戒: 突撃戦法を使わなかった行動後、攻撃か防御を次ターンまで強化する。
  const caution = bingxueLevel(owner, '警戒')
  if (caution > 0 && (owner.specialState.bingxueAssaultUsedThisAction ?? 0) === 0) {
    const value = 3 * caution
    const stat: Stat = rng() < 0.5 ? 'damageDealt' : 'damageTaken'
    addTimedModifier(owner, stateKey('警戒'), stat, stat === 'damageDealt' ? value : -value, turn + 1)
    helpers.log(owner, `警戒${caution}: ${stat === 'damageDealt' ? '与ダメージ上昇' : '被ダメージ低下'}${value}%`)
  }
}

// 通常攻撃を受けた直後に呼ばれる兵学効果。
export const runBingxueNormalAttackReceived = (
  defender: BattleFighter,
  attacker: BattleFighter,
  turn: number,
  rng: () => number,
  helpers: BingxueActionHelpers,
): void => {
  // 気勢崩し: 通常攻撃を受けた時、50%の確率で攻撃者の武勇と知略を1ターン低下させる。
  if (!hasBingxue(defender, '気勢崩し') || !roll(rng, 0.5)) return
  addTimedModifier(attacker, `${stateKey('気勢崩し')}:val`, 'val', -12, turn + 1)
  addTimedModifier(attacker, `${stateKey('気勢崩し')}:int`, 'int', -12, turn + 1)
  helpers.log(defender, `気勢崩し: ${attacker.name}の武勇・知略-12(1T)`)
}

// 戦法による回復が実際に1以上入った直後に呼ばれる兵学効果。
export const runBingxueSkillHeal = (
  caster: BattleFighter,
  target: BattleFighter,
  allies: BattleFighter[],
  turn: number,
  helpers: BingxueActionHelpers,
  wasLowestBeforeHeal = true,
): void => {
  // 手当の心得: 回復前に最も兵力割合が低かった対象を、そのターン中だけ守る。
  if (hasBingxue(caster, '手当の心得') && wasLowestBeforeHeal) {
    addTimedModifier(target, `${stateKey('手当の心得')}:${caster.id}`, 'damageTaken', -6, turn)
    helpers.log(caster, `手当の心得: ${target.name}の被ダメージ-6%`)
  }
  // 鼓舞激励: 自分以外を回復した時、その味方の与ダメージをそのターン中だけ上げる。
  if (hasBingxue(caster, '鼓舞激励') && target.id !== caster.id) {
    addTimedModifier(target, `${stateKey('鼓舞激励')}:${caster.id}`, 'damageDealt', 4, turn)
    helpers.log(caster, `鼓舞激励: ${target.name}の与ダメージ+4%`)
  }
}

// 状態異常を付与した直後に、付与側・被付与側双方の兵学を処理する。
export const runBingxueControlApplied = (
  controller: BattleFighter,
  target: BattleFighter,
  targetAllies: BattleFighter[],
  targetEnemies: BattleFighter[],
  turn: number,
  rng: () => number,
  helpers: BingxueActionHelpers,
): void => {
  // 軍律擾乱: 状態異常を付けた対象の統率と知略を次ターンまで下げる。
  if (hasBingxue(controller, '軍律擾乱') && roll(rng, 0.6)) {
    addTimedModifier(target, `${stateKey('軍律擾乱')}:lea`, 'lea', -helpers.statOf(target, 'lea') * 0.08, turn + 1)
    addTimedModifier(target, `${stateKey('軍律擾乱')}:int`, 'int', -helpers.statOf(target, 'int') * 0.08, turn + 1)
    helpers.log(controller, `軍律擾乱: ${target.name}の統率・知略-8%`)
  }
  // 搦手の策: 状態異常を付けた対象の被ダメージを次ターンまで増やす。
  if (hasBingxue(controller, '搦手の策') && roll(rng, 0.6)) {
    addTimedModifier(target, stateKey('搦手の策'), 'damageTaken', 8, turn + 1)
    helpers.log(controller, `搦手の策: ${target.name}の被ダメージ+8%`)
  }
  // 右往左往: 状態異常を付けた対象の与ダメージを次ターンまで下げる。
  if (hasBingxue(controller, '右往左往')) {
    addTimedModifier(target, stateKey('右往左往'), 'damageDealt', -8, turn + 1)
    helpers.log(controller, `右往左往: ${target.name}の与ダメージ-8%`)
  }

  // 返り討ちの計: 自身が制御状態を受けた直後、90%の確率でランダムな敵へ反撃する。
  if (hasBingxue(target, '返り討ちの計')) {
    const livingEnemies = alive(targetEnemies)
    const retaliationTarget = livingEnemies[Math.floor(rng() * livingEnemies.length)]
    if (retaliationTarget && roll(rng, 0.9)) {
      // 武勇が知略を上回る場合は兵刃、それ以外（同値を含む）は計略ダメージにする。
      const kind: DamageKind = helpers.statOf(target, 'val') > helpers.statOf(target, 'int') ? 'physical' : 'strategy'
      helpers.damage(target, retaliationTarget, 100, kind, '返り討ちの計')
    }
  }

  // 不惑: 味方が状態異常を受けた時、各所有者につき1ターン1回だけ被害を軽減する。
  targetAllies.forEach((owner) => {
    const perplexity = bingxueLevel(owner, '不惑')
    if (owner.id !== target.id && perplexity > 0 && (owner.specialState.bingxuePerplexityTurn ?? 0) !== turn) {
      owner.specialState.bingxuePerplexityTurn = turn
      addTimedModifier(target, `${stateKey('不惑')}:${owner.id}`, 'damageTaken', -4.5 * perplexity, turn)
      helpers.log(owner, `不惑${perplexity}: ${target.name}の被ダメージ-${4.5 * perplexity}%`)
    }
  })

  // 明鏡: 自身が状態異常を受けた時、戦闘中2回まで兵力割合最低の味方を回復する。
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

// データ上に存在する全兵学名。テストで60種の登録漏れがないことを検査する。
export const IMPLEMENTED_BINGXUE_NAMES = new Set([
  '生々流転', '気勢崩し', '陽動の策', '慧眼', '兵心', '不敵', '逆境', '才気', '俊才',
  '兵勢連鎖', '舟中敵国', '当意即妙', '胆力', '活路', '突貫', '妙策', '豪勇', '剛力',
  '破陣の勢い', '離間の計', '軍律擾乱', '強靭', '神秘', '早駆', '大勇', '鬼気', '神算',
  '搦手の策', '達人大観', '手当の心得', '不惑', '明鏡', '天時', '機動', '地利', '協同',
  '返り討ちの計', '乱戦', '恩顧', '冷静沈着', '表裏一体', '奇謀', '詭計百出', '多謀',
  '心頭滅却', '臨機応変', '鼓舞激励', '智勇兼備', '仁愛', '練磨', '果敢', '脱兎の如し',
  '警戒', '兵家', '勇猛果敢', '七転八起', '先陣誘導', '右往左往', '殿軍救護', '内助',
])
