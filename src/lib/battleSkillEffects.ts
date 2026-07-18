import type { Skill, Stat, TriggerEvent } from '../composables/useData'
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
}

const defineBattleSkillMeta = (meta: BattleSkillEffectMeta): BattleSkillEffectMeta => meta

// 個別 case の戦法タイプや複数タイミングはここで指定する。
// type は発動優先度や兵種/陣法の重複チェックにも使うため、case 実行前に読めるメタ情報として持つ。
export const BATTLE_SKILL_EFFECT_META: Record<string, BattleSkillEffectMeta> = {
  回天転運: defineBattleSkillMeta({ type: '能動' }),
  千成瓢箪: defineBattleSkillMeta({ type: '指揮', triggers: ['beforeAction'] }),
  如水: defineBattleSkillMeta({ type: '受動', triggers: ['beforeAction', 'onHealed'] }),
  比翼連理: defineBattleSkillMeta({ type: '指揮', triggers: ['afterAction'] }),
  奇策縦横: defineBattleSkillMeta({ type: '能動' }),
  南蛮渡来: defineBattleSkillMeta({ type: '能動' }),
  一舟軒: defineBattleSkillMeta({ type: '能動' }),
  弾嵐雨霰: defineBattleSkillMeta({ type: '能動' }),
  越後二天: defineBattleSkillMeta({ type: '突撃' }),
  疾風迅雷: defineBattleSkillMeta({ type: '指揮' }),
  表裏比興: defineBattleSkillMeta({ type: '能動' }),
  瞬息万変: defineBattleSkillMeta({ type: '能動' }),
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

export const battleSkillType = (skill: Skill): BattleSkillType =>
  normalizeBattleSkillType(battleSkillEffectMeta(skill)?.type)
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
  '比翼連理',
  '奇策縦横',
  '南蛮渡来',
  '一舟軒',
  '弾嵐雨霰',
  '越後二天',
  '疾風迅雷',
  '表裏比興',
  '瞬息万変',
  '三河武士',
  '風林火山',
  '無想掃討',
  ...HEAL_STOCK_DAMAGE_SKILL_NAMES,
]

const DESCRIPTION_BASED_BATTLE_SKILL_NAMES = (skillsData as Skill[])
  .flatMap((skill) => [skill.name_jp, skill.name])
  .filter((name): name is string => Boolean(name))

// 個別 case が未作成の戦法も、battleSimulator.ts 側の説明文ベース汎用処理で動かす。
// 精度を上げたい戦法だけ、このファイルの switch に case を追加して上書きする。
export const IMPLEMENTED_BATTLE_SKILL_NAMES = new Set([
  ...DESCRIPTION_BASED_BATTLE_SKILL_NAMES,
  ...NAMED_BATTLE_SKILL_NAMES,
])

export interface BattleSkillEffectHelpers {
  skillDisplayName: (skill: Skill) => string
  chooseTarget: (candidates: BattleFighter[], rng: () => number) => BattleFighter | null
  resolveTargets: (ctx: SkillResolveContext) => BattleFighter[]
  varNumber: (skill: Skill, key: string, fallback: number) => number
  aliveRandom: (fighters: BattleFighter[], rng: () => number) => BattleFighter[]
  weakest: (fighters: BattleFighter[], count: number) => BattleFighter[]
  roll: (rng: () => number, chance: number) => boolean
  dealSkillDamage: (
    ctx: SkillResolveContext,
    target: BattleFighter,
    rate: number,
    kind?: 'physical' | 'strategy',
  ) => number
  healBySkill: (
    ctx: SkillResolveContext,
    target: BattleFighter,
    rate: number,
    kind?: 'bravery' | 'strategy',
  ) => number
  addControl: (ctx: SkillResolveContext, target: BattleFighter, name: string, duration: number) => void
  statOf: (fighter: BattleFighter, stat: Stat) => number
}

const DEBUFF_NAMES = [
  '無策',
  '封撃',
  '麻痺',
  '混乱',
  '挑発',
  '畏縮',
  '疲弊',
  '威圧',
  '回復不可',
  '火傷',
  '水攻',
  '中毒',
  '消沈',
  '潰走',
]

// 弱体効果を指定数まで解除する。戦法コメントからそのまま呼べるようにしておく。
export const removeDebuffs = (fighter: BattleFighter, count: number): string[] => {
  const removed: string[] = []
  for (const name of DEBUFF_NAMES) {
    if (removed.length >= count) break
    if ((fighter.statuses[name] ?? 0) <= 0) continue
    delete fighter.statuses[name]
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

const log = (logs: BattleLogEntry[], ctx: SkillResolveContext, message: string) => {
  logs.push({ turn: ctx.turn, side: ctx.caster.side, actor: ctx.caster.name, message })
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

const hasEnemyTargetText = (skill: Skill) => /敵軍|敵方|敵/.test(textOfSkill(skill))
const hasAllyTargetText = (skill: Skill) => /自軍|我軍|友軍|自身|自分|味方/.test(textOfSkill(skill))

const databaseTargets = (
  ctx: SkillResolveContext,
  h: BattleSkillEffectHelpers,
  purpose: 'damage' | 'heal' | 'buff' | 'debuff' | 'control' | 'dot',
): BattleFighter[] => {
  const resolved = h.resolveTargets(ctx).filter((fighter) => fighter.hp > 0)
  if (purpose === 'heal') return resolved.some((fighter) => fighter.side === ctx.caster.side) ? resolved : h.weakest(ctx.allies, 1)
  if (purpose === 'damage' || purpose === 'control' || purpose === 'dot') {
    const enemyResolved = resolved.filter((fighter) => fighter.side !== ctx.caster.side)
    if (enemyResolved.length > 0) return enemyResolved
    const fallback = h.chooseTarget(ctx.enemies, ctx.rng)
    return fallback ? [fallback] : []
  }
  if (purpose === 'debuff') return resolved.some((fighter) => fighter.side !== ctx.caster.side) ? resolved : living(ctx.enemies)
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
    '畏縮',
    '疲弊',
    '威圧',
    '回復不可',
  ].filter((name) => text.includes(name))
  const direct = String(skill.control_type ?? '').split('/').map((name) => name.trim()).filter(Boolean)
  return [...direct, ...inferred].filter((name, index, all) => all.indexOf(name) === index)
}

const durationFromDatabase = (skill: Skill, fallback = 1): number =>
  Math.max(1, Math.round(firstVar(skill, ['duration', 'status_duration', 'debuff_duration', 'buff_duration', 'dur']) ?? skill.control_turns ?? fallback))

const applyDatabaseBuffs = (ctx: SkillResolveContext, h: BattleSkillEffectHelpers): boolean => {
  const text = textOfSkill(ctx.skill)
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
      if (/武勇|武力/.test(text)) target.buffs.val = (target.buffs.val ?? 0) + value
      if (/知略|智略/.test(text)) target.buffs.int = (target.buffs.int ?? 0) + value
      if (/統率|防御|防禦/.test(text)) target.buffs.lea = (target.buffs.lea ?? 0) + value
      if (/速度/.test(text)) target.buffs.spd = (target.buffs.spd ?? 0) + value
    })
    applied = true
  }

  if (damageBuff !== null) {
    const value = toPercent(damageBuff)
    buffTargets.forEach((target) => {
      if (/計略|謀略/.test(text)) target.buffs.strategyDamageDealt = (target.buffs.strategyDamageDealt ?? 0) + value
      else if (/通常攻撃|普通攻撃|兵刃/.test(text)) target.buffs.attackDamage = (target.buffs.attackDamage ?? 0) + value
      else target.buffs.damageDealt = (target.buffs.damageDealt ?? 0) + value
    })
    applied = true
  }

  if (reduction !== null) {
    const value = toPercent(reduction)
    buffTargets.forEach((target) => {
      target.buffs.damageTaken = (target.buffs.damageTaken ?? 0) - value
    })
    applied = true
  }

  if (debuffValue !== null) {
    const value = toPercent(debuffValue)
    debuffTargets.forEach((target) => {
      if (/武勇|武力/.test(text)) target.buffs.val = (target.buffs.val ?? 0) - value
      if (/知略|智略/.test(text)) target.buffs.int = (target.buffs.int ?? 0) - value
      if (/統率|防御|防禦/.test(text)) target.buffs.lea = (target.buffs.lea ?? 0) - value
      if (/速度/.test(text)) target.buffs.spd = (target.buffs.spd ?? 0) - value
      if (/与ダメ|造成傷害|ダメージ/.test(text)) target.buffs.damageDealt = (target.buffs.damageDealt ?? 0) - value
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
    target.timedStatuses.push({
      name: ctx.skill.dot_name!,
      turns,
      sourceSkill: h.skillDisplayName(ctx.skill),
      sourceActor: ctx.caster.name,
      dotRate: rate,
      dotType: databaseDamageKind(ctx.skill),
    })
    log(ctx.logs, ctx, `${target.name}に${ctx.skill.dot_name}(${turns}T)`)
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
    const kind = databaseDamageKind(ctx.skill)
    for (let hit = 0; hit < hits; hit += 1) {
      targets.forEach((target) => h.dealSkillDamage(ctx, target, damageRates[0], kind))
    }
    damageRates.slice(1).forEach((rate) => {
      if (h.roll(ctx.rng, chanceFrom(ctx.skill, ['extra_trigger_chance', 'extra_prob', 'extra_chance'], 1))) {
        const target = h.aliveRandom(ctx.enemies, ctx.rng).find((enemy) => !targets.some((base) => base.id === enemy.id)) ?? targets[0]
        if (target) h.dealSkillDamage(ctx, target, rate, kind)
      }
    })
    extraDamageRates.forEach((rate) => {
      if (h.roll(ctx.rng, chanceFrom(ctx.skill, ['extra_trigger_chance', 'extra_prob', 'extra_chance'], 1))) {
        const target = h.chooseTarget(ctx.enemies, ctx.rng)
        if (target) h.dealSkillDamage(ctx, target, rate, kind)
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
  const currentTarget = ctx.target && ctx.target.hp > 0 ? ctx.target : h.chooseTarget(ctx.enemies, ctx.rng)

  switch (name) {
    case '回天転運': {
      // 戦法タイプ: 能動
      // 兵力の1番少ない味方1人に
      h.weakest(ctx.allies, 1).forEach((ally) => {
        // 弱体効果を2つ解除
        const removed = removeDebuffs(ally, 2)
        if (removed.length > 0) log(ctx.logs, ctx, `${ally.name}の弱体効果を${removed.join('、')}解除`)

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
        // 奇策1スタックにつき計略与ダメージを5%上げる
        ctx.caster.buffs.strategyDamageDealt = (ctx.caster.buffs.strategyDamageDealt ?? 0) + 5
        log(ctx.logs, ctx, `如水: ${reason}で奇策を獲得(${nextStacks}/8)`)
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
        h.aliveRandom(ctx.enemies, ctx.rng)
          .slice(0, targetCount)
          .forEach((enemy) => h.dealSkillDamage(ctx, enemy, damageRate, 'strategy'))
      }

      // 発動判定後、蓄積された回復量をリセット
      log(ctx.logs, ctx, `回復蓄積をリセット(${stock})`)
      ctx.caster.specialState.healingStock = 0
      return true
    }

    case '奇策縦横': {
      // 戦法タイプ: 能動
      // 敵軍全体に近い複数(最大3人)へ254%の計略ダメージ
      h.aliveRandom(ctx.enemies, ctx.rng).slice(0, 3).forEach((enemy) => h.dealSkillDamage(ctx, enemy, 254, 'strategy'))
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
        const extra = h.aliveRandom(ctx.enemies, ctx.rng).find((enemy) => enemy.id !== currentTarget.id) ?? currentTarget
        h.dealSkillDamage(ctx, extra, 98, 'physical')
      }
      return true
    }

    case '疾風迅雷': {
      // 戦法タイプ: 指揮
      // 45%で発動
      if (!h.roll(ctx.rng, 0.45)) return true

      // 敵軍複数に76%の兵刃ダメージ
      h.aliveRandom(ctx.enemies, ctx.rng).slice(0, Math.round(h.varNumber(ctx.skill, 'target_count', 2))).forEach((enemy) => {
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
        const extra = h.aliveRandom(ctx.enemies, ctx.rng).find((enemy) => enemy.id !== currentTarget.id) ?? currentTarget
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
        const attacker = h.aliveRandom(ctx.enemies, ctx.rng).find((enemy) => enemy.id !== currentTarget.id)
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
        h.aliveRandom(ctx.enemies, ctx.rng).slice(0, 2 + Math.floor(ctx.rng() * 2)).forEach((enemy) => h.dealSkillDamage(ctx, enemy, 92, 'strategy'))
      } else if (phase === 2) {
        // 火: 敵1～2回へ156%の兵刃ダメージ
        const hits = 1 + Math.floor(ctx.rng() * 2)
        for (let i = 0; i < hits; i += 1) {
          const enemy = h.chooseTarget(ctx.enemies, ctx.rng)
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
      const extra = h.aliveRandom(ctx.enemies, ctx.rng).find((enemy) => enemy.id !== currentTarget.id)
      if (extra && h.roll(ctx.rng, 0.5)) h.dealSkillDamage(ctx, extra, 102, 'physical')

      // 自身の通常攻撃ダメージを上げる
      ctx.caster.buffs.attackDamage = (ctx.caster.buffs.attackDamage ?? 0) + 50
      return true
    }





    // DB戦法: ここから下は .build/skills.json から戦法名ごとに展開した個別case。
    // 精度を上げたい戦法は、該当case内を回天転運のような手書き処理に置き換える。
    case '勇猛無比': {
      // 戦法タイプ: 能動
      // 自身が12.5%→25%の会心状態を獲得し、2ターン持続
      // 敌军单体に兵刃ダメージ（ダメージ率116%）を与える
      // 追加効果として別判定のダメージ（ダメージ率98%）を扱う
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 116, 'physical')
      })
      if (h.roll(ctx.rng, chanceFrom(ctx.skill, ['extra_trigger_chance', 'extra_prob', 'extra_chance'], 1))) {
        const target = h.chooseTarget(ctx.enemies, ctx.rng)
        if (target) h.dealSkillDamage(ctx, target, 98, 'physical')
      }
      return true
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
    case '電光石火': {
      // 戦法タイプ: 能動
      // 敵軍複数（2名）に兵刃ダメージ（ダメージ率48%→96%）を与える
      // 敌军群体(2人)に兵刃ダメージ（ダメージ率96%）を与える
      // 戦法説明にある能力値/与ダメ/被ダメ補正（48%または48）を反映する
      applyDatabaseBuffs(ctx, h)
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 96, 'physical')
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
    case '城盗り': {
      // 戦法タイプ: 能動
      // 自身の知略を16.5→33（知略依存）増加させ、2ターン持続
      // 追加効果として別判定のダメージ（ダメージ率106%）を扱う
      // 戦法説明にある能力値/与ダメ/被ダメ補正（33%または33）を反映する
      applyDatabaseBuffs(ctx, h)
      if (h.roll(ctx.rng, chanceFrom(ctx.skill, ['extra_trigger_chance', 'extra_prob', 'extra_chance'], 1))) {
        const target = h.chooseTarget(ctx.enemies, ctx.rng)
        if (target) h.dealSkillDamage(ctx, target, 106, 'strategy')
      }
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
      // 自軍複数（2名）の被ダメージを13%→26%（知略依存）低下させ、2ターン持続、最大2回まで重ねがけ可能
      // 戦法説明にある能力値/与ダメ/被ダメ補正（24%または24）を反映する
      applyDatabaseBuffs(ctx, h)
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
      // 能動戦法の与ダメージを上げ、確率で会心を獲得
      // 戦法説明にある能力値/与ダメ/被ダメ補正（28%または28）を反映する
      applyDatabaseBuffs(ctx, h)
      return true
    }
    case '越後先手組': {
      // 戦法タイプ: 兵種
      // 騎兵を進化させ、速度上昇と確率回復を付与
      // 自軍全体を回復（回復率78%）する
      // 戦法説明にある能力値/与ダメ/被ダメ補正（24%または24）を反映する
      applyDatabaseBuffs(ctx, h)
      databaseTargets(ctx, h, 'heal').forEach((target) => {
        h.healBySkill(ctx, target, 78, databaseHealKind(ctx.skill))
      })
      return true
    }
    case '追亡逐北': {
      // 戦法タイプ: 能動
      // 単体計略ダメージと畏縮付与
      // 敵軍単体に計略ダメージ（ダメージ率146%）を与える
      // 畏縮を付与する
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 146, 'strategy')
      })
      databaseTargets(ctx, h, 'control').forEach((target) => {
        ["畏縮"].forEach((name) => {
          if (h.roll(ctx.rng, chanceFrom(ctx.skill, ['status_chance', 'debuff_rate', 'random_rate', 'pressure_rate', 'fatigue_rate'], 1))) {
            h.addControl(ctx, target, name, durationFromDatabase(ctx.skill, 1))
          }
        })
      })
      return true
    }
    case '伊達風采': {
      // 戦法タイプ: 指揮
      // 風采を消費して兵刃・計略ダメージを与え、重ねがけで能力上昇
      // 敵軍単体に兵刃ダメージ（ダメージ率92%）を与える
      // 戦法説明にある能力値/与ダメ/被ダメ補正（5%または5）を反映する
      applyDatabaseBuffs(ctx, h)
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 92, 'physical')
      })
      return true
    }
    case '龍騎兵': {
      // 戦法タイプ: 兵種
      // 鉄砲を進化させ、弾丸を消費してダメージを与える
      // 自軍全体に兵刃ダメージ（ダメージ率104%）を与える
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 104, 'physical')
      })
      return true
    }
    case '神出鬼沒': {
      // 戦法タイプ: 能動
      // 降低被選中率並強化下次攻擊
      // 自身に兵刃ダメージ（ダメージ率298%）を与える
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 298, 'physical')
      })
      return true
    }
    case '伊賀忍者': {
      // 戦法タイプ: 兵種
      // 弓兵を進化させ、密報を使って追加ダメージを与える
      // 自軍全体に兵刃ダメージ（ダメージ率102%）を与える
      // 疲弊を付与する
      // 戦法説明にある能力値/与ダメ/被ダメ補正（10%または10）を反映する
      applyDatabaseBuffs(ctx, h)
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 102, 'physical')
      })
      databaseTargets(ctx, h, 'control').forEach((target) => {
        ["疲弊"].forEach((name) => {
          if (h.roll(ctx.rng, chanceFrom(ctx.skill, ['status_chance', 'debuff_rate', 'random_rate', 'pressure_rate', 'fatigue_rate'], 1))) {
            h.addControl(ctx, target, name, durationFromDatabase(ctx.skill, 1))
          }
        })
      })
      return true
    }
    case '風流武者': {
      // 戦法タイプ: 受動
      // 能動戦法の発動に応じて回復または与ダメージを上昇
      // 自軍複数（2人）を回復（回復率132%）する
      // 戦法説明にある能力値/与ダメ/被ダメ補正（30%または30）を反映する
      applyDatabaseBuffs(ctx, h)
      databaseTargets(ctx, h, 'heal').forEach((target) => {
        h.healBySkill(ctx, target, 132, databaseHealKind(ctx.skill))
      })
      return true
    }
    case '威風凜凜': {
      // 戦法タイプ: 突撃
      // 通常攻撃後に目標の与ダメージを低下
      // 敵軍単体に兵刃ダメージ（ダメージ率238%）を与える
      // 戦法説明にある能力値/与ダメ/被ダメ補正（42%または42）を反映する
      applyDatabaseBuffs(ctx, h)
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 238, 'physical')
      })
      return true
    }
    case '傳馬疾馳': {
      // 戦法タイプ: 能動
      // 友軍を強化し、効果終了時に別の友軍へ移す
      // 友軍単体に兵刃ダメージ（ダメージ率102%）を与える
      // 戦法説明にある能力値/与ダメ/被ダメ補正（20%または20）を反映する
      applyDatabaseBuffs(ctx, h)
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 102, 'physical')
      })
      return true
    }
    case '重農主義': {
      // 戦法タイプ: 指揮
      // 評定衆時に兵糧増産効果を追加
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '上州黃斑': {
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
      // 毎ターン確率で友軍を回復
      // 自軍単体または自軍複数を回復（回復率82%）する
      databaseTargets(ctx, h, 'heal').forEach((target) => {
        h.healBySkill(ctx, target, 82, databaseHealKind(ctx.skill))
      })
      return true
    }
    case '鬼義重': {
      // 戦法タイプ: 能動
      // 複数兵刃ダメージと統率低下
      // 敵軍複数（2人）に兵刃ダメージ（ダメージ率214%）を与える
      // 戦法説明にある能力値/与ダメ/被ダメ補正（65%または65）を反映する
      applyDatabaseBuffs(ctx, h)
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 214, 'physical')
      })
      return true
    }
    case '股肱之臣': {
      // 戦法タイプ: 能動
      // 複数に回生を付与し、残数に応じて与ダメージ上昇
      // 自軍複数（2-3人）を回復（回復率54%）する
      // 戦法説明にある能力値/与ダメ/被ダメ補正（11%または11）を反映する
      applyDatabaseBuffs(ctx, h)
      databaseTargets(ctx, h, 'heal').forEach((target) => {
        h.healBySkill(ctx, target, 54, databaseHealKind(ctx.skill))
      })
      return true
    }
    case '荷馱崩': {
      // 戦法タイプ: 能動
      // 複数計略ダメージと被回復効果低下
      // 敵軍複数（2人）に計略ダメージ（ダメージ率134%）を与える
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 134, 'strategy')
      })
      return true
    }
    case '天神山殘照': {
      // 戦法タイプ: 受動
      // 通常攻撃後に計略ダメージを与え、序盤は自身の能力を上昇
      // 自身に計略ダメージ（ダメージ率218%）を与える
      // 戦法説明にある能力値/与ダメ/被ダメ補正（60%または60）を反映する
      applyDatabaseBuffs(ctx, h)
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 218, 'strategy')
      })
      return true
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
    case '三河魂': {
      // 戦法タイプ: 指揮
      // 友軍複数（2名）が通常攻撃を受けると、攻撃者の全属性に1.25%→2.5%（統率依存）の低下効果を付与（最大8回まで重ねがけ可能） 大将技：自身が通常攻撃を受け
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
    case '時は今': {
      // 戦法タイプ: 能動
      // 敵軍複数（2名）に、以下のいずれか1種を付与（既存と異なる状態を優先、ダメージ率56%）
      // 火傷/水攻め/中毒/消沈/潰走状態を付与し、継続ダメージ（ダメージ率56%）を処理する
      applyDatabaseDot(ctx, h)
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
    case '軍神': {
      // 戦法タイプ: 受動
      // 戦闘中、乱舞獲得不可
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '海道一': {
      // 戦法タイプ: 突撃
      // 通常攻撃後、射撃を2回行い、それぞれランダムな敵軍単体への兵刃ダメージ（ダメージ率134%）と計略ダメージ（ダメージ率134%・知略依存）
      // 敵軍単体に計略ダメージ（ダメージ率134%）を与える
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 134, 'strategy')
      })
      return true
    }
    case '鬼若子': {
      // 戦法タイプ: 指揮
      // 4ターン目まで、自軍複数（2～3名）は25%→50%の連撃を獲得し、統率が9→18（統率依存）増加 大将技：対象人数増加の確率が25%増加
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
    case '鬼美濃': {
      // 戦法タイプ: 受動
      // ダメージを受けると、17.5%→35%の確率で自身の弱体化効果を浄化し、自身の兵力を回復（回復率56%→112%、統率依存）
      // 自分を回復（回復率112%）する
      databaseTargets(ctx, h, 'heal').forEach((target) => {
        h.healBySkill(ctx, target, 112, databaseHealKind(ctx.skill))
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
    case '古今独歩': {
      // 戦法タイプ: 受動
      // 通常攻撃を受けると24%→48%の確率で攻撃者に兵刃ダメージ（ダメージ率35%→70%、通常攻撃効果と突撃を発動可能）を与え、2%→4%の離反を獲得（最大8回ま
      // 敵軍単体に兵刃ダメージ（ダメージ率48%）を与える
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 48, 'physical')
      })
      return true
    }
    case '啄木鳥': {
      // 戦法タイプ: 能動
      // 敵軍単体に計略ダメージ（ダメージ率78%→156%、知略依存）を与え、武勇が最も高い自軍単体が同じ対象に兵刃ダメージ（ダメージ率80%→160%、武勇と速度依存
      // 敵軍単体に計略ダメージ（ダメージ率156%）を与える
      // 威圧を付与する
      databaseTargets(ctx, h, 'damage').forEach((target) => {
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
    case '十面埋伏': {
      // 戦法タイプ: 能動
      // 1ターンの準備後、2ターンの間、敵軍全体の被ダメージが9%→18%（知略依存）上昇
      // 敵軍全体（3名）に計略ダメージ（ダメージ率18%）を与える
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 18, 'strategy')
      })
      return true
    }
    case '東国無双の麗': {
      // 戦法タイプ: 受動
      // 戦闘中、自身は連撃（1ターンに2回通常攻撃）を獲得し、自身の武勇が3→30増加
      return applyDatabaseSkillEffect(ctx, h)
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
    case '夢幻泡影': {
      // 戦法タイプ: 能動
      // 自軍複数（2名）を回復し（回復率59%→118%、知略依存）、2ターンの間、対象の与ダメージが7.5%→15%上昇（知略依存）
      // 自軍複数（2名）を回復（回復率118%）する
      databaseTargets(ctx, h, 'heal').forEach((target) => {
        h.healBySkill(ctx, target, 118, databaseHealKind(ctx.skill))
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
    case '一切皆空': {
      // 戦法タイプ: 受動
      // 2ターン目以降、30%の確率（毎ターン発動の確率が40%増加）で一揆を発動
      // 敵軍複数（2〜3名）を回復（回復率72%）する
      databaseTargets(ctx, h, 'heal').forEach((target) => {
        h.healBySkill(ctx, target, 72, databaseHealKind(ctx.skill))
      })
      return true
    }
    case '疾風怒濤': {
      // 戦法タイプ: 能動
      // 2ターンの間、自身と友軍単体が22.5%→45%の会心を獲得し、敵軍複数（2名）に兵刃ダメージ（ダメージ率51%→102%）
      // 敵軍複数（2名）に兵刃ダメージ（ダメージ率45%）を与える
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 45, 'physical')
      })
      return true
    }
    case '槍の又左': {
      // 戦法タイプ: 受動
      // 戦闘中、能動戦法を発動するたびに、45%→90%の確率で、次のターンの行動時までに自身が1回分の鉄壁を獲得（すでにこの戦法で付与された場合は回数増加）
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '斗星北天': {
      // 戦法タイプ: 能動
      // 2ターンの間、自身は洞察を獲得し、統率と知略が25→50増加し、敵軍複数（2～3名）に牽制（37.5%→75%の確率で自身を敵軍戦法の発動対象に固定、知略依存）
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '破竹の勢い': {
      // 戦法タイプ: 受動
      // 戦闘中、自身が35%→70%の会心を獲得し、会心ダメージ率が15%→30%増加
      return applyDatabaseSkillEffect(ctx, h)
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
    case '死灰復然': {
      // 戦法タイプ: 能動
      // 最も兵力が少ない自軍単体を回復（回復率138%→276%、知略依存）
      // 自軍単体を回復（回復率276%）する
      databaseTargets(ctx, h, 'heal').forEach((target) => {
        h.healBySkill(ctx, target, 276, databaseHealKind(ctx.skill))
      })
      return true
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
    case '掃疑平乱': {
      // 戦法タイプ: 能動
      // 2ターンの間、自身と友軍単体が39%→78%の乱舞を獲得（速度依存）
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '献身': {
      // 戦法タイプ: 指揮
      // 戦闘中、自身の行動時に22%→44%の確率（知略依存）で自軍異性が次の攻撃で追加でランダムな敵軍単体に兵刃ダメージ（ダメージ率131%→262%）
      // 自軍単体に計略ダメージ（ダメージ率262%）を与える
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 262, 'strategy')
      })
      return true
    }
    case '先制攻撃': {
      // 戦法タイプ: 能動
      // 1ターンの準備後、敵軍複数（2～3名）に計略ダメージ（ダメージ率66%→132%、知略依存）を与え、2ターンの間対象の能動戦法の被ダメージが15%→30%上昇
      // 敵軍複数（2〜3名）に計略ダメージ（ダメージ率132%）を与える
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 132, 'strategy')
      })
      return true
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
    case '密報通暁': {
      // 戦法タイプ: 能動
      // 1ターンの準備後、2ターンの間、友軍単体が洞察を獲得し、敵軍単体に撹乱（能動戦法発動時に計略ダメージ、ダメージ率152%、知略依存）を付与
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '三楽犬': {
      // 戦法タイプ: 能動
      // 1ターンの間、自軍複数（2～3名）が先攻・必中を獲得し、速度が最も高い敵軍単体に標記を付与
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '鬼小島': {
      // 戦法タイプ: 突撃
      // 通常攻撃後、対象に兵刃ダメージ（ダメージ率304%）
      // 敵軍単体に兵刃ダメージ（ダメージ率304%）を与える
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 304, 'physical')
      })
      return true
    }
    case '先手必勝': {
      // 戦法タイプ: 能動
      // 敵軍複数（2名）に計略ダメージ（ダメージ率67%→134%、知略依存）を与え、2ターンの間、対象が次に受ける能動戦法のダメージが26%→52%上昇
      // 敵軍複数（2名）に計略ダメージ（ダメージ率134%）を与える
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 134, 'strategy')
      })
      return true
    }
    case '不屈の精神': {
      // 戦法タイプ: 能動
      // 2ターンの間、自身は反撃を獲得し、通常攻撃を受けると攻撃者に1回反撃（ダメージ率74%→148%）を付与
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '剛の武者': {
      // 戦法タイプ: 突撃
      // 通常攻撃後、攻撃対象に兵刃ダメージ（ダメージ率123%→246%）を与え、2ターンの間、その次の計略与ダメージが45%→90%低下
      // 敵軍単体に計略ダメージ（ダメージ率246%）を与える
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 246, 'strategy')
      })
      return true
    }
    case '洞察反撃': {
      // 戦法タイプ: 能動
      // 1ターンの準備後、2ターンの間、自軍複数（2名）に洞察を付与
      // 自軍複数（2名）に計略ダメージ（ダメージ率304%）を与える
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 304, 'strategy')
      })
      return true
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
    case '夜叉美濃': {
      // 戦法タイプ: 受動
      // 戦闘中、自身の被ダメージが17.5%→35%低下（敵軍が騎兵・鉄砲部隊の場合は25%→50%）
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '諏訪の光': {
      // 戦法タイプ: 能動
      // 自軍複数（2名）の弱体化効果を2個浄化し、2ターンの間、対象の武勇と統率が36増加
      return applyDatabaseSkillEffect(ctx, h)
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
    case '形影相弔': {
      // 戦法タイプ: 能動
      // 自身と知略が最も高い敵軍武将で同時にランダムな敵軍単体に計略ダメージ（ダメージ率96%→192%、知略依存）
      // 敵軍単体に計略ダメージ（ダメージ率192%）を与える
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 192, 'strategy')
      })
      return true
    }
    case '湖水渡り': {
      // 戦法タイプ: 能動
      // 2ターンの間、自身と友軍単体が奇策を65%獲得
      return applyDatabaseSkillEffect(ctx, h)
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
    case '内助の賢': {
      // 戦法タイプ: 指揮
      // 戦闘中、友軍複数（2名）が継続状態を付与する際、その継続時間が25%→50%の確率（知略依存）で1ターン増加
      // 友軍複数（2名）を回復（回復率92%）する
      databaseTargets(ctx, h, 'heal').forEach((target) => {
        h.healBySkill(ctx, target, 92, databaseHealKind(ctx.skill))
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
    case '楼岸一番': {
      // 戦法タイプ: 突撃
      // 通常攻撃後、攻撃対象にダメージ（ダメージ率94%→188%、ダメージタイプは武勇と知略の高い方）
      // 敵軍単体に計略ダメージ（ダメージ率168%）を与える
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 168, 'strategy')
      })
      return true
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
    case '非常の器': {
      // 戦法タイプ: 指揮
      // 2ターン目まで、自軍全体が17.5%→35%の回避（ダメージを無効化）を獲得
      // 自軍全体（3名）を回復（回復率66%）する
      databaseTargets(ctx, h, 'heal').forEach((target) => {
        h.healBySkill(ctx, target, 66, databaseHealKind(ctx.skill))
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
    case '仏の高力': {
      // 戦法タイプ: 能動
      // 2ターンの間、友軍単体の能動戦法の発動率が4.5%→9%（統率依存）増加
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '勇志不抜': {
      // 戦法タイプ: 能動
      // 2ターンの間、友軍複数（2名）の被ダメージの20%を肩代りし、自身の武勇が37.5→75増加し、12%→24%の離反を獲得
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
    case '落花啼鳥': {
      // 戦法タイプ: 能動
      // 1ターンの準備後、友軍複数（2名）が先攻を獲得し、能動戦法与ダメージが37.5%→75%上昇する（2ターン持続） 大将技：与ダメージ基本増加量が42.5%→85
      return applyDatabaseSkillEffect(ctx, h)
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
    case '尼御台': {
      // 戦法タイプ: 指揮
      // 2ターン目まで、自軍大将は洞察を獲得し、被ダメージが9%→18%（知略依存）低下
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '満ちゆく月': {
      // 戦法タイプ: 能動
      // 1ターンの準備後、4ターンの間、敵軍単体に潰走（ダメージ率108%、潰走を持っていない敵軍単体が優先）を付与
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '月華鶴影': {
      // 戦法タイプ: 指揮
      // 戦闘中、友軍複数（2名）が通常攻撃を受けると35%の確率で敵軍複数に兵刃ダメージ（ダメージ率51%→102%）
      // 敵軍複数（2名）に兵刃ダメージ（ダメージ率102%）を与える
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 102, 'physical')
      })
      return true
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
    case '信義貫徹': {
      // 戦法タイプ: 能動
      // 1ターンの間、7.5%→15%の離反（兵刃ダメージを与えた際にダメージ量に応じて兵力回復）を獲得し、敵軍複数（2名）に兵刃ダメージ（ダメージ率78%→156%）
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
    case '陣形崩し': {
      // 戦法タイプ: 能動
      // 1ターンの準備後、2ターンの間、敵軍複数（2～3名）の統率と知略が24→48（武勇依存）減少、さらに対象に兵刃ダメージ（ダメージ率51%→102%）
      // 敵軍複数（2名）に計略ダメージ（ダメージ率102%）を与える
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 102, 'strategy')
      })
      return true
    }
    case '所向無敵': {
      // 戦法タイプ: 能動
      // 1ターンの準備後、敵軍全体に兵刃ダメージ（ダメージ率127%→254%）
      // 敵軍全体（3名）に兵刃ダメージ（ダメージ率254%）を与える
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 254, 'physical')
      })
      return true
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
    case '草木皆兵': {
      // 戦法タイプ: 能動
      // 1ターンの準備後、敵軍複数（2名）に計略ダメージ（ダメージ率71%→142%）を与え、自軍複数（2名）の兵力を回復（回復率53%→106%、知略依存）
      // 敵軍複数（2名）に計略ダメージ（ダメージ率142%）を与える
      // 敵軍複数（2名）を回復（回復率106%）する
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 142, 'strategy')
      })
      databaseTargets(ctx, h, 'heal').forEach((target) => {
        h.healBySkill(ctx, target, 106, databaseHealKind(ctx.skill))
      })
      return true
    }
    case '縦横馳突': {
      // 戦法タイプ: 能動
      // 自身に連撃（1ターンに2回通常攻撃が可能）を付与し、さらに封撃（通常攻撃不可）耐性を獲得する
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
    case '前後挟撃': {
      // 戦法タイプ: 能動
      // 1ターンの間、自身と友軍単体は連撃（1ターンに2回通常攻撃）を獲得
      return applyDatabaseSkillEffect(ctx, h)
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
    case '按甲休兵': {
      // 戦法タイプ: 受動
      // 戦闘中、自身は休養（毎ターン兵力回復、回復率70%→140%）を獲得
      // 自分を回復（回復率140%）する
      databaseTargets(ctx, h, 'heal').forEach((target) => {
        h.healBySkill(ctx, target, 140, databaseHealKind(ctx.skill))
      })
      return true
    }
    case '一力当先': {
      // 戦法タイプ: 能動
      // 2ターンの間、自身の通常攻撃ダメージが25%→50%上昇、乱舞（通常攻撃時、対象部隊の他武将へもダメージ
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '乗勝追撃': {
      // 戦法タイプ: 突撃
      // 通常攻撃後、敵軍全体にもう一度兵刃ダメージ（ダメージ率68%→136%）
      // 敵軍全体（3名）に兵刃ダメージ（ダメージ率136%）を与える
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 136, 'physical')
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
    case '戦意崩壊': {
      // 戦法タイプ: 突撃
      // 通常攻撃後、2ターンの間、対象の統率と知略が65低下し、自軍大将に2回分の鉄壁（被ダメージ無効）を付与
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
    case '一行三昧': {
      // 戦法タイプ: 受動
      // 戦闘中、自身の能動戦法の発動確率が7%→14%増加
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
    case '死中求活': {
      // 戦法タイプ: 受動
      // 戦闘中、自身は兵刃ダメージを受けるたびに武勇が2.5→5増加（最大10回まで重ねがけ可能）
      // 友軍複数（2名）に兵刃ダメージ（ダメージ率125%）を与える
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 125, 'physical')
      })
      return true
    }
    case '文武両道': {
      // 戦法タイプ: 受動
      // 戦闘中、自身は計略ダメージを与えるたびに武勇が15→30増加（最大5回まで重ねがけ可能）、兵刃ダメージを与えるたびに知略が15→30増加（最大5回まで重ねがけ可
      return applyDatabaseSkillEffect(ctx, h)
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
    case '気勢衝天': {
      // 戦法タイプ: 指揮
      // 4ターン目まで、自身の行動時に80%の確率で1ターンの間、武勇が最も高い敵軍武将の兵刃与ダメージが15%→30%低下（武勇依存）、知略が最も高い敵軍武将の計略与
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '深慮遠謀': {
      // 戦法タイプ: 指揮
      // 3ターン目まで、敵軍複数（2名）の与ダメージが14%→28%低下（知略依存）
      return applyDatabaseSkillEffect(ctx, h)
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
    case '血戦奮闘': {
      // 戦法タイプ: 受動
      // 自身の被回復効果が30%→60%上昇、さらに20%→40%の会心を獲得
      // 自分を回復（回復率60%）する
      databaseTargets(ctx, h, 'heal').forEach((target) => {
        h.healBySkill(ctx, target, 60, databaseHealKind(ctx.skill))
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
    case '以戦養戦': {
      // 戦法タイプ: 受動
      // 戦闘中、自身は12.5%→25%の離反（兵刃ダメージを与えた際にダメージ量に応じて兵力回復）を獲得
      // 自分に兵刃ダメージ（ダメージ率25%）を与える
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 25, 'physical')
      })
      return true
    }
    case '百戦錬磨': {
      // 戦法タイプ: 受動
      // 戦闘中、自身の武勇・知略・統率・速度が21→42増加
      return applyDatabaseSkillEffect(ctx, h)
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
    case '金鼓連天': {
      // 戦法タイプ: 能動
      // 3ターンの間、自身の能動戦法与ダメージが24%→48%上昇、突撃戦法被ダメージが12.5%→25%低下（1ターン後に再発動可能）
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '剛毅果断': {
      // 戦法タイプ: 能動
      // 3ターンの間、自身の突撃戦法の与ダメージが17.5%→35%上昇、能動戦法の被ダメージが10%→20%低下（1ターン後に再発動可能）
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '嚢沙之計': {
      // 戦法タイプ: 能動
      // 2ターンの間、敵軍複数（2名）に水攻めを付与し、毎ターン持続ダメージ（ダメージ率51%→102%、知略依存）を与え、さらに対象の計略被ダメージが15%→30%上
      // 水攻め状態を付与し、継続ダメージ（ダメージ率102%）を処理する
      applyDatabaseDot(ctx, h)
      return true
    }
    case '大智不智': {
      // 戦法タイプ: 能動
      // 敵軍複数（2名）に消沈を付与し、2ターンの間、毎ターン持続ダメージ（ダメージ率52%→104%、知略依存）を与え、さらに対象の兵刃被ダメージが10%→20%上昇
      // 消沈状態を付与し、継続ダメージ（ダメージ率104%）を処理する
      applyDatabaseDot(ctx, h)
      return true
    }
    case '赤備え隊': {
      // 戦法タイプ: 兵種
      // 騎兵が、横掃千軍の赤備え隊に進化
      // 自軍全体（3名）に兵刃ダメージ（ダメージ率35%）を与える
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 35, 'physical')
      })
      return true
    }
    case '母衣武者': {
      // 戦法タイプ: 兵種
      // 騎兵が、剛勇無双の母衣武者に進化
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '三河弓兵隊': {
      // 戦法タイプ: 兵種
      // 弓兵が、百発百中の三河弓兵隊に進化
      // 自軍全体（3名）を回復（回復率65%）する
      databaseTargets(ctx, h, 'heal').forEach((target) => {
        h.healBySkill(ctx, target, 65, databaseHealKind(ctx.skill))
      })
      return true
    }
    case '甲斐弓騎兵': {
      // 戦法タイプ: 兵種
      // 弓兵が、精妙な射術を誇る甲斐弓騎兵に進化
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '薩摩鉄砲兵': {
      // 戦法タイプ: 兵種
      // 鉄砲が、鉄火烈襲の薩摩鉄砲兵に進化
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '鉄砲僧兵': {
      // 戦法タイプ: 兵種
      // 鉄砲が、破邪顕正の鉄砲僧兵に進化
      // 自軍全体を回復（回復率48%）する
      databaseTargets(ctx, h, 'heal').forEach((target) => {
        h.healBySkill(ctx, target, 48, databaseHealKind(ctx.skill))
      })
      return true
    }
    case '大太刀力士隊': {
      // 戦法タイプ: 兵種
      // 足軽が、臨戦態勢の大太刀力士隊に進化
      // 自軍全体（3名）に兵刃ダメージ（ダメージ率100%）を与える
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 100, 'physical')
      })
      return true
    }
    case '僧兵': {
      // 戦法タイプ: 兵種
      // 足軽が、不退転の僧兵に進化
      // 自軍全体（3名）に兵刃ダメージ（ダメージ率60%）を与える
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 60, 'physical')
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
    case '水攻干計': {
      // 戦法タイプ: 能動
      // 1ターンの準備後、2ターンの間、敵軍全体に水攻め（毎ターン持続ダメージ
      // 回復不可を付与する
      // 水攻め状態を付与し、継続ダメージ（ダメージ率98%）を処理する
      databaseTargets(ctx, h, 'control').forEach((target) => {
        ["回復不可"].forEach((name) => {
          if (h.roll(ctx.rng, chanceFrom(ctx.skill, ['status_chance', 'debuff_rate', 'random_rate', 'pressure_rate', 'fatigue_rate'], 1))) {
            h.addControl(ctx, target, name, durationFromDatabase(ctx.skill, 1))
          }
        })
      })
      applyDatabaseDot(ctx, h)
      return true
    }
    case '盤石耽々': {
      // 戦法タイプ: 受動
      // 戦闘中、自身の被ダメージが（4.5%→9%、統率依存）低下
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '御旗楯無': {
      // 戦法タイプ: 受動
      // 戦闘中、自身がダメージを受けると20%→40%の確率（武勇依存）で、今回の被ダメージが20%→40%（知略依存）低下
      // 自分に計略ダメージ（ダメージ率40%）を与える
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 40, 'strategy')
      })
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
    case '運勝の鼻': {
      // 戦法タイプ: 受動
      // 戦闘中、準備ターンが必要な固有能動戦法発動時、37.5%→75%の確率で準備時間を1ターンスキップ
      return applyDatabaseSkillEffect(ctx, h)
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
    case '独立独歩': {
      // 戦法タイプ: 受動
      // 戦闘中、自身の突撃戦法の発動確率が8.5%→17%増加
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '一領具足': {
      // 戦法タイプ: 指揮
      // 最初の2ターンの間、自軍全体の兵力損害が6%→12%（武勇依存）低下
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '七十二の計': {
      // 戦法タイプ: 受動
      // 戦闘中、自身は25%→50%の奇策（発動時に計略ダメージが50%増加）を獲得し、奇策ダメージ率が15%→30%増加
      // 自分に計略ダメージ（ダメージ率50%）を与える
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 50, 'strategy')
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
    case '積水成淵': {
      // 戦法タイプ: 能動
      // 1ターンの準備後、自軍複数（2～3名）に11%→22%の心攻（計略ダメージを与えた際にダメージ量に応じて兵力回復）を付与
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '武田之赤備': {
      // 戦法タイプ: 受動
      // 戦闘中、10%→20%の会心を獲得
      // 自身・敵軍単体に兵刃ダメージ（ダメージ率138%）を与える
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 138, 'physical')
      })
      return true
    }
    case '豊後の戦神': {
      // 戦法タイプ: 受動
      // 洞察を獲得し、最高属性に応じて火力または発動率を強化する
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
    case '仁者の沈勇': {
      // 戦法タイプ: 突撃
      // 通常攻撃後、敵軍単体に計略ダメージ（ダメージ率92%→184%、知略依存）を与え、70%の確率で友軍単体にも同時に同対象への計略ダメージ（ダメージ率77%→15
      // 敵軍単体に計略ダメージ（ダメージ率184%）を与える
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 184, 'strategy')
      })
      return true
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
    case '諸行無常': {
      // 戦法タイプ: 指揮
      // 戦闘開始後の3ターンの間、自軍全体の与ダメージを12%→24%（知略依存）上昇させる
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '知者楽水': {
      // 戦法タイプ: 指揮
      // 戦闘開始後の3ターンの間、自軍複数（2人）が受ける兵刃及び計略ダメージを9%→18%から12%→24%（統率依存
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '乱世の華': {
      // 戦法タイプ: 突撃
      // 通常攻撃後、攻撃対象にもう一度兵刃ダメージ （ダメージ率79%→158%）と計略ダメージ（ダメージ率79%→158%、知略依存）を与える、このダメージは双方の属
      // 敵軍単体に計略ダメージ（ダメージ率158%）を与える
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 158, 'strategy')
      })
      return true
    }
    case '静動自在': {
      // 戦法タイプ: 能動
      // 自身より行動順が遅い自軍単体を選択し、洞察と先攻状態を付与し、2ターン持続
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '境目奮戦': {
      // 戦法タイプ: 突撃
      // 通常攻撃後、兵力の最も低い敵軍単体に計略ダメージ（ダメージ率130%→260%、知略依存）を与え、その敵軍が受ける回復効果を15%→30%低下させる
      // 兵力最低の敵軍単体に計略ダメージ（ダメージ率260%）を与える
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 260, 'strategy')
      })
      return true
    }
    case '同気連枝': {
      // 戦法タイプ: 指揮
      // 戦闘中、友軍複数が通常攻撃後に2.5→5のメイン属性を獲得（知略依存、最大5回まで重ねがけ可能）
      return applyDatabaseSkillEffect(ctx, h)
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
    case '攻其不備': {
      // 戦法タイプ: 能動
      // 統率が最も低い敵軍単体に兵刃ダメージ（ダメージ率84%→168%）を与え、知略が最も低い敵軍単体に計略ダメージ（ダメージ率84%→168%、知略依存）を与える
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
    case '一念乱志': {
      // 戦法タイプ: 受動
      // 3ターン目以降、自身は35%→70%の確率で敵軍単体に兵刃ダメージ（ダメージ率89%→178%）を与え、35%の確率で武勇が最も高い友軍単体も同じ対象に兵刃ダメ
      // 敵軍単体に兵刃ダメージ（ダメージ率178%）を与える
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 178, 'physical')
      })
      return true
    }
    case '警戒周到': {
      // 戦法タイプ: 指揮
      // 4ターン目まで、自軍複数（2名）の被ダメージが11%→22%低下
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '攻守兼備': {
      // 戦法タイプ: 能動
      // 敵軍単体にダメージ（ダメージ率92%→184%、ダメージタイプは武勇と知略の高い方）
      // 敵軍単体に計略ダメージ（ダメージ率184%）を与える
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 184, 'strategy')
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
    case '鉄砲猛撃': {
      // 戦法タイプ: 能動
      // 敵軍複数（2名）に計略ダメージ（ダメージ率51%→102%、知略依存）
      // 敵軍複数（2名）に計略ダメージ（ダメージ率102%）を与える
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 102, 'strategy')
      })
      return true
    }
    case '先制先登': {
      // 戦法タイプ: 能動
      // 敵軍複数（2名）に兵刃ダメージ（ダメージ率61%→122%）を与え、1ターンの間、先攻（優先行動）を獲得
      // 敵軍複数（2名）に兵刃ダメージ（ダメージ率122%）を与える
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 122, 'physical')
      })
      return true
    }
    case '一上一下': {
      // 戦法タイプ: 受動
      // 戦闘中、自身の能動戦法の発動確率が6%→12%増加
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '鬼玄蕃': {
      // 戦法タイプ: 能動
      // 自身の次に受けるダメージが20%→30%上昇する代わりに、2ターンの間、9%→18%の離反（兵刃ダメージを与えた際にダメージ量に応じて兵力回復）を獲得
      // 敵軍複数（2〜3名）に兵刃ダメージ（ダメージ率118%）を与える
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 118, 'physical')
      })
      return true
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
    case '忠勤励行': {
      // 戦法タイプ: 能動
      // 1ターンの準備後、2ターンの間、自軍複数（2名）の兵刃与ダメージが7.5%→15%上昇
      // 自軍複数（2名）に兵刃ダメージ（ダメージ率296%）を与える
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 296, 'physical')
      })
      return true
    }
    case '援護射撃': {
      // 戦法タイプ: 能動
      // 1ターンの間、友軍単体が15%→30%の回避を獲得
      // 自軍単体に兵刃ダメージ（ダメージ率162%）を与える
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 162, 'physical')
      })
      return true
    }
    case '捨て身の義': {
      // 戦法タイプ: 指揮
      // 戦闘中、自身の統率が20→40増加し、友軍複数の武勇と知略が10→20増加
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '一刀両断': {
      // 戦法タイプ: 突撃
      // 通常攻撃後、攻撃対象にもう一度兵刃ダメージ（ダメージ率158%→316%）
      // 敵軍単体に兵刃ダメージ（ダメージ率316%）を与える
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 316, 'physical')
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
    case '全力戦闘': {
      // 戦法タイプ: 受動
      // 5ターン目以降、戦闘終了まで自身が35%→70%の連撃（1ターンに2回通常攻撃）を獲得
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
    case '荒切': {
      // 戦法タイプ: 突撃
      // 通常攻撃後、1ターンの間連撃（1ターンに2回通常攻撃）を獲得
      return applyDatabaseSkillEffect(ctx, h)
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
    case '矢石飛交': {
      // 戦法タイプ: 能動
      // 敵軍単体にランダムで2～4回の兵刃ダメージ（ダメージ率42%→84%）
      // 敵軍単体に兵刃ダメージ（ダメージ率84%）を与える
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 84, 'physical')
      })
      return true
    }
    case '融通自在': {
      // 戦法タイプ: 能動
      // 2ターンの間、友軍単体の能動戦法の発動確率が6%→12%増加（最大2回重ねがけ可能）
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '秋水一色': {
      // 戦法タイプ: 能動
      // 1ターンの準備後、2ターンの間、自身と友軍単体の計略与ダメージが10%→20%上昇
      // 自軍複数（2名）に計略ダメージ（ダメージ率148%）を与える
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 148, 'strategy')
      })
      return true
    }
    case '参謀の助言': {
      // 戦法タイプ: 指揮
      // 自軍全体の武勇と知略が14→28増加
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '後方支援': {
      // 戦法タイプ: 指揮
      // 戦闘中、自身の能動戦法の発動確率が5%→10%減少するが、友軍複数（2名）に9%→18%の与ダメージ上昇効果を付与
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '槍の鈴': {
      // 戦法タイプ: 突撃
      // 通常攻撃後、敵軍単体に兵刃ダメージ（ダメージ率116%→232%）
      // 敵軍単体に兵刃ダメージ（ダメージ率232%）を与える
      // 敵軍単体を回復（回復率54%）する
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 232, 'physical')
      })
      databaseTargets(ctx, h, 'heal').forEach((target) => {
        h.healBySkill(ctx, target, 54, databaseHealKind(ctx.skill))
      })
      return true
    }
    case '妖怪退治': {
      // 戦法タイプ: 能動
      // 敵軍単体の強化効果を1個「強化解除」し、その後兵刃ダメージ（ダメージ率128%→256%）
      // 敵軍単体に兵刃ダメージ（ダメージ率256%）を与える
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 256, 'physical')
      })
      return true
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
    case '腹中鱗甲': {
      // 戦法タイプ: 受動
      // 自身が反撃（通常攻撃を受けると、敵軍に兵刃ダメージ
      // 敵軍単体に兵刃ダメージ（ダメージ率52%）を与える
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 52, 'physical')
      })
      return true
    }
    case '覇王の右筆': {
      // 戦法タイプ: 指揮
      // 友軍複数（2名）が通常攻撃を行った後、自身は20%→40%の確率でその対象に兵刃ダメージ（ダメージ率63%→126%）
      // 敵軍単体に兵刃ダメージ（ダメージ率120%）を与える
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 120, 'physical')
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
    case '驍勇善戦': {
      // 戦法タイプ: 能動
      // 1ターンの準備後、2ターンの間自身が20%→40%の会心（発動時、兵刃ダメージが50%上昇）を獲得し、敵軍単体に兵刃ダメージ（ダメージ率156%→312%）
      // 敵軍単体に兵刃ダメージ（ダメージ率312%）を与える
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 312, 'physical')
      })
      return true
    }
    case '一六勝負': {
      // 戦法タイプ: 能動
      // ランダムにいずれか1つの効果を発動：敵軍単体に計略ダメージ（ダメージ率120%→240%、知略依存）を与えるか、自軍単体の兵力を回復（回復率120%→240%、
      // 敵軍単体に計略ダメージ（ダメージ率240%）を与える
      // 敵軍単体を回復（回復率240%）する
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 240, 'strategy')
      })
      databaseTargets(ctx, h, 'heal').forEach((target) => {
        h.healBySkill(ctx, target, 240, databaseHealKind(ctx.skill))
      })
      return true
    }
    case '岐阜侍従': {
      // 戦法タイプ: 能動
      // 敵軍単体に兵刃ダメージ（ダメージ率74%→148%）と計略ダメージ（ダメージ率74%→148%、知略依存）
      // 敵軍単体に計略ダメージ（ダメージ率148%）を与える
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 148, 'strategy')
      })
      return true
    }
    case '鈴鳴り': {
      // 戦法タイプ: 受動
      // 自身は毎ターン33%→66%の確率で敵軍単体に兵刃ダメージ（ダメージ率105%→210%）
      // 敵軍単体に兵刃ダメージ（ダメージ率210%）を与える
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 210, 'physical')
      })
      return true
    }
    case '甲州流軍学': {
      // 戦法タイプ: 能動
      // 敵軍単体に計略ダメージ（ダメージ率93%→186%、知略依存）を与え、1ターンの間、友軍単体に1回分の鉄壁（被ダメージ無効）を付与
      // 敵軍単体に計略ダメージ（ダメージ率186%）を与える
      databaseTargets(ctx, h, 'damage').forEach((target) => {
        h.dealSkillDamage(ctx, target, 186, 'strategy')
      })
      return true
    }
    case '奮戦': {
      // 戦法タイプ: 能動
      // 自身に連撃（1ターンに2回通常攻撃）を付与するが、1ターンの間与ダメージが15%低下
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '百錬成鋼': {
      // 戦法タイプ: 受動
      // 自身の武勇・知略・統率・速度が17.5→35増加
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '臨時槍之鈴': {
      // 戦法タイプ: 突撃
      // 兵刃ダメージを与え、条件付きで自身を回復
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '祓除': {
      // 戦法タイプ: 能動
      // 2ターンの間、自軍複数（2名）の武勇・知略・速度が12→24増加、弱体化効果を2個浄化
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '奪気': {
      // 戦法タイプ: 能動
      // 敵軍複数（2名）の強化効果を2個「強化解除」し、3ターンの間、自身の知略が14→28上昇
      return applyDatabaseSkillEffect(ctx, h)
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
    case '斬り': {
      // 戦法タイプ: 能動
      // 敵単体に兵刃ダメージを与える
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '火攻め': {
      // 戦法タイプ: 能動
      // 敵軍単体に計略ダメージ（ダメージ率75%→150%）
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '同討': {
      // 戦法タイプ: 能動
      // 1ターンの準備後、敵軍複数（2名）に兵刃ダメージ（ダメージ率77.5%→155%）
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '看破': {
      // 戦法タイプ: 能動
      // 敵軍単体の強化効果を解除し、2ターンの間、対象の知略が9→18低下
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '殿軍': {
      // 戦法タイプ: 能動
      // 2ターンの間、自身の武勇が15→30増加、自身が副将の場合は追加で統率が20→40増加
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '救援': {
      // 戦法タイプ: 能動
      // 2ターンの間、自軍単体に回生（ダメージを受けるたびに50%の確率で兵力を一定量回復
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '威圧': {
      // 戦法タイプ: 能動
      // 2ターンの間、敵軍複数（2名）の与ダメージが7.5%→15%低下
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '刺突': {
      // 戦法タイプ: 能動
      // 3ターンの間、敵軍単体に潰走（毎ターン持続ダメージ
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '火計': {
      // 戦法タイプ: 能動
      // 3ターンの間、敵軍単体を火傷にし、毎ターン持続ダメージを与える（ダメージ率35%→70%、知略依存）
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '水計': {
      // 戦法タイプ: 能動
      // 3ターンの間、敵軍単体に水攻めを付与し、毎ターン持続ダメージを与える（ダメージ率35%→70%、知略依存）
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
    case '反撃': {
      // 戦法タイプ: 能動
      // 1ターンの間、反撃（通常攻撃を受けるたびに攻撃者にダメージを与え、ダメージ率30%→60%）を獲得
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '会話': {
      // 戦法タイプ: 能動
      // 自軍単体に混乱耐性を付与する
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
    case '不退転': {
      // 戦法タイプ: 突撃
      // 通常攻撃後、攻撃対象にもう一度兵刃ダメージ（ダメージ率70%→140%）
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '連戦': {
      // 戦法タイプ: 突撃
      // 通常攻撃後、敵軍単体に兵刃ダメージ（ダメージ率60%→120%）
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '破甲': {
      // 戦法タイプ: 突撃
      // 通常攻撃後、2ターンの間攻撃対象の統率が18→36減少
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '猛撃': {
      // 戦法タイプ: 突撃
      // 通常攻撃後、2ターンの間、自身が7.5%→15%の会心を獲得（発動時、兵刃ダメージが50%上昇）
      return applyDatabaseSkillEffect(ctx, h)
    }
    case '奮起': {
      // 戦法タイプ: 受動
      // 自身の武勇と速度が12.5→25増加
      return applyDatabaseSkillEffect(ctx, h)
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
    case '速戰': {
      // 戦法タイプ: 受動
      // 速度提升
      return applyDatabaseSkillEffect(ctx, h)
    }
    // DB戦法: ここまで。

    default:
      return false
  }
}
