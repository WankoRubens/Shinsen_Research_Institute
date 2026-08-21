import type { Stat, TriggerEvent } from '../composables/useData'
import type { BattleFighter, BattleLogEntry, SkillResolveContext } from './battleSimulator'
import type { BattleSkillEffectHelpers, BattleSkillEffectMeta } from './battleSkillEffects'

// S武将の固有戦法のうち、説明文ベースの共通処理では再現できないものをここへ集約する。
// 戦法名ごとのcaseを維持し、発動条件・対象・重ねがけを後から追いやすくしている。
export const S_UNIQUE_HANDCRAFTED_SKILL_NAMES = [
  '武田之赤備', '百万一心', '海道一', '鬼若子', '梟雄の計', '一切皆空', '古今独歩', '冷徹無情',
  '破陣乱舞', '風姿綽約', '同気連枝', '末世の道者', '豊後の戦陣', '天下御免', '鬼美濃',
  'かかれ柴田', '掃疑平乱', '槍の又左', '破竹の勢い', '死灰復然', '十面埋伏', '東国無双の麗',
  '帰蝶の舞', '越後流軍学', '甲山猛虎', '陣前無我', '湖水渡り', '内助の賢', '七本槍筆頭',
  '勇志不抜', '尼御台', '信義貫徹', '旋乾転坤', '怪力無双', '積水成淵', '諸行無常',
  '先陣鼓舞', '斗星北天', '一心一徳', '非常の器', '耐苦鍛錬', '密報通暁', '夜叉美濃',
  '一徹の意志', '攻めの三左', '仏の高力', '綱紀粛正', '傲岸不遜', '満ちゆく月', '鬼十河',
  '津田流砲術', '仁者の沈勇', '諏訪の光', '笹の才蔵', '落花啼鳥', '夢幻泡影', '槍弾正',
  '剛毅木訥', '松柏之操', '樽俎折衝', '風流武者', '上州の黄斑', '股肱の臣', '天神山残照',
] as const

const meta = (
  type: BattleSkillEffectMeta['type'],
  triggers: TriggerEvent[],
  followUpTriggers: TriggerEvent[] = [],
  maxPerTurn?: number,
): BattleSkillEffectMeta => ({
  type,
  triggers,
  followUpTriggers,
  replaceStructuredTriggers: true,
  ...(maxPerTurn ? { maxPerTurn } : {}),
})

// 複数タイミングを持つ戦法は、最初の発動抽選と予約効果を区別する。
export const S_UNIQUE_HANDCRAFTED_META: Record<string, BattleSkillEffectMeta> = {
  武田之赤備: meta('受動', ['preparationTurn', 'afterAction']),
  百万一心: meta('指揮', ['enemyActiveSkill']),
  海道一: meta('突撃', ['afterNormalAttack']),
  鬼若子: meta('指揮', ['preparationTurn']),
  梟雄の計: meta('能動', ['beforeAction']),
  一切皆空: meta('受動', ['beforeAction']),
  古今独歩: meta('受動', ['onNormalAttackReceived']),
  冷徹無情: meta('能動', ['beforeAction']),
  破陣乱舞: meta('能動', ['beforeAction', 'afterNormalAttack'], ['afterNormalAttack']),
  風姿綽約: meta('指揮', ['turnStart']),
  同気連枝: meta('指揮', ['beforeAction', 'allyNormalAttack', 'onPhysicalDamageReceived', 'onStrategyDamageReceived']),
  末世の道者: meta('指揮', ['preparationTurn']),
  豊後の戦陣: meta('受動', ['preparationTurn']),
  天下御免: meta('突撃', ['afterNormalAttack']),
  鬼美濃: meta('受動', ['onPhysicalDamageReceived', 'onStrategyDamageReceived']),
  かかれ柴田: meta('能動', ['beforeAction']),
  掃疑平乱: meta('能動', ['beforeAction']),
  槍の又左: meta('受動', ['ownSkillActivated', 'afterNormalAttack']),
  破竹の勢い: meta('受動', ['preparationTurn']),
  死灰復然: meta('能動', ['beforeAction']),
  十面埋伏: meta('能動', ['beforeAction']),
  東国無双の麗: meta('受動', ['preparationTurn']),
  帰蝶の舞: meta('受動', ['turnStart']),
  越後流軍学: meta('指揮', ['preparationTurn', 'ownSkillActivated']),
  甲山猛虎: meta('能動', ['beforeAction']),
  陣前無我: meta('能動', ['beforeAction']),
  湖水渡り: meta('能動', ['beforeAction']),
  内助の賢: meta('指揮', ['turnStart']),
  七本槍筆頭: meta('受動', ['preparationTurn', 'beforeAction']),
  勇志不抜: meta('能動', ['beforeAction']),
  尼御台: meta('指揮', ['preparationTurn', 'turnStart']),
  信義貫徹: meta('能動', ['beforeAction']),
  旋乾転坤: meta('能動', ['beforeAction']),
  怪力無双: meta('能動', ['beforeAction']),
  積水成淵: meta('能動', ['beforeAction']),
  諸行無常: meta('指揮', ['preparationTurn', 'turnStart']),
  先陣鼓舞: meta('能動', ['beforeAction']),
  斗星北天: meta('能動', ['beforeAction']),
  一心一徳: meta('能動', ['beforeAction']),
  非常の器: meta('指揮', ['preparationTurn', 'turnStart']),
  耐苦鍛錬: meta('指揮', ['preparationTurn', 'onNormalAttackReceived']),
  密報通暁: meta('能動', ['beforeAction', 'enemyActiveSkill'], ['enemyActiveSkill']),
  夜叉美濃: meta('受動', ['preparationTurn']),
  一徹の意志: meta('能動', ['beforeAction']),
  攻めの三左: meta('能動', ['beforeAction']),
  仏の高力: meta('能動', ['beforeAction']),
  綱紀粛正: meta('能動', ['beforeAction']),
  傲岸不遜: meta('能動', ['beforeAction']),
  満ちゆく月: meta('能動', ['beforeAction']),
  鬼十河: meta('突撃', ['afterNormalAttack']),
  津田流砲術: meta('能動', ['beforeAction']),
  仁者の沈勇: meta('突撃', ['afterNormalAttack']),
  諏訪の光: meta('能動', ['beforeAction']),
  笹の才蔵: meta('能動', ['beforeAction']),
  落花啼鳥: meta('能動', ['beforeAction']),
  夢幻泡影: meta('能動', ['beforeAction']),
  槍弾正: meta('能動', ['beforeAction']),
  剛毅木訥: meta('指揮', ['onPhysicalDamageReceived', 'onStrategyDamageReceived']),
  松柏之操: meta('指揮', ['preparationTurn', 'allySkillActivated']),
  樽俎折衝: meta('指揮', ['beforeAction']),
  風流武者: meta('受動', ['ownSkillActivated']),
  上州の黄斑: meta('指揮', ['turnStart', 'onNormalAttackReceived']),
  股肱の臣: meta('能動', ['beforeAction', 'turnStart'], ['turnStart']),
  天神山残照: meta('受動', ['beforeAction', 'afterNormalAttack', 'turnStart']),
}

// 所持者以外の行動・被弾も監視する戦法を戦闘エンジンへ公開する。
export const S_UNIQUE_TEAM_NORMAL_ATTACK_WATCHERS = new Set(['同気連枝'])
export const S_UNIQUE_TEAM_DAMAGE_WATCHERS = new Set(['同気連枝', '剛毅木訥'])
export const S_UNIQUE_TEAM_SKILL_WATCHERS = new Set(['松柏之操'])
export const S_UNIQUE_ENEMY_ACTIVE_SKILL_WATCHERS = new Set(['百万一心', '密報通暁'])
export const S_UNIQUE_OWN_SKILL_WATCHERS = new Set(['槍の又左', '越後流軍学', '風流武者', '疑心暗鬼'])

const living = (fighters: BattleFighter[]) => fighters.filter((fighter) => fighter.hp > 0)
const fighterHasSkill = (fighter: BattleFighter, name: string) =>
  fighter.skills.some((skill) => (skill.name_jp || skill.name) === name)
const statOf = (fighter: BattleFighter, stat: Stat) => Math.max(0, (fighter.baseStats[stat] ?? 0) + (fighter.buffs[stat] ?? 0))
const roleCode = (fighter: BattleFighter) => fighter.role === 'main' ? 1 : fighter.role === 'vice1' ? 2 : 3
const roleFighter = (fighters: BattleFighter[], code: number) => living(fighters).find((fighter) => roleCode(fighter) === code) ?? null
const random = (ctx: SkillResolveContext, h: BattleSkillEffectHelpers, fighters: BattleFighter[]) => h.aliveRandom(fighters, ctx.rng, ctx)[0] ?? null
const randomMany = (ctx: SkillResolveContext, h: BattleSkillEffectHelpers, fighters: BattleFighter[], count: number) => h.aliveRandom(fighters, ctx.rng, ctx).slice(0, count)
const highest = (fighters: BattleFighter[], stat: Stat) => [...living(fighters)].sort((a, b) => statOf(b, stat) - statOf(a, stat))[0] ?? null
const lowest = (fighters: BattleFighter[], stat: Stat) => [...living(fighters)].sort((a, b) => statOf(a, stat) - statOf(b, stat))[0] ?? null
const attributeChance = (base: number, value: number) => Math.min(0.95, base + Math.max(0, value - 100) * 0.001)
const attributeValue = (base: number, value: number) => base * (1 + Math.max(0, value - 100) * 0.001)
const expires = (turn: number, duration: number) => Math.max(1, turn) + Math.max(1, duration) - 1

const log = (ctx: SkillResolveContext, message: string, target?: BattleFighter) => {
  ctx.logs.push({
    turn: ctx.turn,
    side: ctx.caster.side,
    actor: ctx.caster.name,
    actorHp: ctx.caster.hp,
    target: target?.name,
    targetSide: target?.side,
    effect: ctx.skill.name_jp || ctx.skill.name,
    message,
  })
}

const setPermanent = (fighter: BattleFighter, stat: Stat, source: string, value: number) => {
  const key = `unique:${source}:${stat}`
  const previous = fighter.specialState[key] ?? 0
  fighter.specialState[key] = value
  fighter.buffs[stat] = (fighter.buffs[stat] ?? 0) - previous + value
}

const stackPermanent = (fighter: BattleFighter, stat: Stat, key: string, value: number, maxStacks: number) => {
  const stacks = fighter.specialState[key] ?? 0
  if (stacks >= maxStacks) return stacks
  fighter.specialState[key] = stacks + 1
  fighter.buffs[stat] = (fighter.buffs[stat] ?? 0) + value
  return stacks + 1
}

const removeDebuffs = (fighter: BattleFighter, count: number) => {
  const names = ['無策', '封撃', '麻痺', '混乱', '挑発', '牽制', '畏縮', '萎縮', '疲弊', '威圧', '回復不可']
  let removed = 0
  names.forEach((name) => {
    if (removed >= count || (fighter.statuses[name] ?? 0) <= 0) return
    delete fighter.statuses[name]
    delete fighter.controlSources[name]
    removed += 1
  })
  fighter.timedStatuses = fighter.timedStatuses.filter((_status) => {
    if (removed >= count) return true
    removed += 1
    return false
  })
  return removed
}

const addDot = (
  ctx: SkillResolveContext,
  target: BattleFighter,
  name: string,
  rate: number,
  turns: number,
  kind: 'physical' | 'strategy',
) => {
  const skillName = ctx.skill.name_jp || ctx.skill.name
  // 内助の賢は味方が付与する継続状態を知略依存の確率で1ターン延長する。
  const extensionOwner = living(ctx.allies).find((fighter) => fighterHasSkill(fighter, '内助の賢'))
  const extendedTurns = extensionOwner
    && ctx.rng() < attributeChance(0.5, statOf(extensionOwner, 'int'))
    ? turns + 1
    : turns
  const existing = target.timedStatuses.find((status) =>
    status.name === name && status.sourceSkill === skillName && status.sourceActorId === ctx.caster.id)
  if (existing) {
    existing.turns = Math.max(existing.turns, extendedTurns)
    existing.dotRate = rate
    return
  }
  target.timedStatuses.push({
    name,
    turns: extendedTurns,
    sourceSkill: skillName,
    sourceActorId: ctx.caster.id,
    sourceActor: ctx.caster.name,
    dotRate: rate,
    dotType: kind,
  })
  log(ctx, `${target.name}に${name}(${extendedTurns}T)`, target)
}

const hasDot = (fighter: BattleFighter, name?: string) => fighter.timedStatuses.some((status) => !name || status.name === name)
const hasControl = (fighter: BattleFighter, name: string) => (fighter.statuses[name] ?? 0) > 0
const primaryStat = (fighter: BattleFighter): Stat => {
  const stats: Stat[] = ['val', 'int', 'lea']
  return stats.sort((a, b) => statOf(fighter, b) - statOf(fighter, a))[0] ?? 'val'
}

const applyControlRandom = (
  ctx: SkillResolveContext,
  h: BattleSkillEffectHelpers,
  target: BattleFighter,
  names: string[],
  duration: number,
) => {
  const available = names.filter((name) => !hasControl(target, name))
  const pool = available.length > 0 ? available : names
  const name = pool[Math.floor(ctx.rng() * pool.length)]
  if (name) h.addControl(ctx, target, name, duration)
}

// 会心・兵刃ヒットなど、ダメージ計算の確定後でしか分からない固有戦法の状態を更新する。
export const recordSUniqueDamageEvent = (
  fighter: BattleFighter,
  kind: 'physical' | 'strategy',
  critical: boolean,
  turn: number,
  logs: BattleLogEntry[],
) => {
  const hasSkill = (name: string) => fighter.skills.some((skill) => (skill.name_jp || skill.name) === name)
  if (critical && hasSkill('武田之赤備')) fighter.specialState.takedaRedCriticalTurn = turn

  if (critical && hasSkill('破竹の勢い')) {
    const stacks = fighter.specialState.hachikuCriticalStacks ?? 0
    if (stacks < (fighter.role === 'main' ? 15 : 10)) {
      fighter.specialState.hachikuCriticalStacks = stacks + 1
      fighter.specialState.criticalDamageBonus = 30 + (stacks + 1) * 5
      logs.push({
        turn,
        side: fighter.side,
        actor: fighter.name,
        actorHp: fighter.hp,
        effect: '破竹の勢い',
        message: `${fighter.name}の会心ダメージが5%上昇（${150 + fighter.specialState.criticalDamageBonus}%）`,
      })
    }
  }

  if (critical && (fighter.specialState.lakeCriticalUntil ?? 0) >= turn) {
    const stacks = Math.min(4, (fighter.specialState.lakeCriticalStacks ?? 0) + 1)
    fighter.specialState.lakeCriticalStacks = stacks
    fighter.specialState.criticalDamageBonus = (fighter.specialState.criticalDamageBonus ?? 0) + 15
  }

  if (kind === 'physical' && hasSkill('七本槍筆頭')) {
    const hits = (fighter.specialState.spearSevenPhysicalHits ?? 0) + 1
    fighter.specialState.spearSevenPhysicalHits = hits
    if (hits % 5 === 0) {
      const maxStacks = fighter.role === 'main' ? 5 : 3
      const stacks = Math.min(maxStacks, (fighter.specialState.spearSevenLockStacks ?? 0) + 1)
      fighter.specialState.spearSevenLockStacks = stacks
      logs.push({ turn, side: fighter.side, actor: fighter.name, actorHp: fighter.hp, effect: '七本槍筆頭', message: `通常攻撃固定率が13%上昇（${30 + stacks * 13}%）` })
    }
  }
}

// S固有戦法の個別case。対象外の戦法ではnullを返して既存switchへ処理を渡す。
export const applySUniqueSkillEffect = (
  ctx: SkillResolveContext,
  h: BattleSkillEffectHelpers,
): boolean | null => {
  const name = ctx.skill.name_jp || ctx.skill.name
  const subject = ctx.eventSubject

  switch (name) {
    // 戦闘開始時に会心を得て、行動後に赤備え突撃と統率低下を判定する。
    case '武田之赤備': {
      if (ctx.trigger === 'preparationTurn') {
        setPermanent(ctx.caster, 'physicalCriticalChance', name, 20)
        return true
      }
      const bonus = ctx.caster.specialState.takedaRedCriticalTurn === ctx.turn ? 0.25 : 0
      const chance = attributeChance(0.25 + bonus + (ctx.caster.role === 'main' ? 0.1 : 0), statOf(ctx.caster, 'val'))
      const target = random(ctx, h, ctx.enemies)
      if (target && h.roll(ctx.rng, chance)) {
        h.dealSkillDamage(ctx, target, 138, 'physical')
        h.addTimedModifier(ctx, target, 'lea', -statOf(target, 'lea') * 0.15, 2)
      }
      return true
    }
    // 敵の能動戦法発動を監視し、確率で発動を阻止して計略ダメージを返す。
    case '百万一心': {
      if (!subject || subject.side === ctx.caster.side) return true
      const allChance = ctx.caster.role === 'main' ? 0.35 : 0.15
      const watched = h.roll(ctx.rng, allChance) ? living(ctx.enemies) : randomMany(ctx, h, ctx.enemies, 2)
      if (!watched.some((fighter) => fighter.id === subject.id) || !h.roll(ctx.rng, 0.3)) return true
      subject.specialState.cancelCurrentActiveSkill = 1
      h.dealSkillDamage({ ...ctx, target: subject }, subject, 100, 'strategy')
      log(ctx, `${subject.name}の能動戦法を阻止`, subject)
      return true
    }
    // 通常攻撃後に兵刃・計略の連続攻撃を行い、自身の統率を攻撃属性へ移す。
    case '海道一': {
      for (let shot = 0; shot < 2; shot += 1) {
        const physicalTarget = random(ctx, h, ctx.enemies)
        const strategyTarget = random(ctx, h, ctx.enemies)
        if (physicalTarget) h.dealSkillDamage(ctx, physicalTarget, 134, 'physical')
        if (strategyTarget) h.dealSkillDamage(ctx, strategyTarget, 134, 'strategy')
      }
      const stackKey = 'kaidoStatStacks'
      const stacks = ctx.caster.specialState[stackKey] ?? 0
      if (stacks < 8) {
        const lost = statOf(ctx.caster, 'lea') * 0.06
        ctx.caster.specialState[stackKey] = stacks + 1
        ctx.caster.buffs.lea = (ctx.caster.buffs.lea ?? 0) - lost
        ctx.caster.buffs.val = (ctx.caster.buffs.val ?? 0) + lost
        ctx.caster.buffs.int = (ctx.caster.buffs.int ?? 0) + lost
      }
      if (ctx.caster.role === 'main' && ctx.turn === 5) {
        setPermanent(ctx.caster, 'physicalCriticalChance', '海道一大将', 12)
        setPermanent(ctx.caster, 'strategyCriticalChance', '海道一大将', 12)
      }
      return true
    }
    // 戦闘開始時に味方へ連撃と統率上昇を付与する。
    case '鬼若子': {
      const targets = randomMany(ctx, h, ctx.allies, h.roll(ctx.rng, ctx.caster.role === 'main' ? 0.75 : 0.5) ? 3 : 2)
      targets.forEach((ally) => {
        ally.specialState.comboChance = Math.max(ally.specialState.comboChance ?? 0, 50)
        ally.specialState.comboChanceUntil = 4
        h.addTimedModifier(ctx, ally, 'lea', attributeValue(18, statOf(ctx.caster, 'lea')), 4)
      })
      return true
    }
    // 敵複数へ計略ダメージと中毒・火傷を与え、後半は自身を強化する。
    case '梟雄の計': {
      const targets = randomMany(ctx, h, ctx.enemies, h.roll(ctx.rng, 0.55) ? 3 : 2)
      targets.forEach((target) => {
        h.dealSkillDamage(ctx, target, 128, 'strategy')
        if (h.roll(ctx.rng, 0.55)) {
          if (hasDot(target, '中毒')) h.addControl(ctx, target, '疲弊', 2)
          else addDot(ctx, target, '中毒', 96, 2, 'strategy')
        }
        if (h.roll(ctx.rng, 0.55)) addDot(ctx, target, '火傷', 96, 2, 'strategy')
      })
      if (ctx.turn >= 5 && h.roll(ctx.rng, 0.5)) {
        h.addTimedModifier(ctx, ctx.caster, 'int', statOf(ctx.caster, 'int') * 0.25, 8)
        if (ctx.caster.role !== 'main') h.addControl(ctx, ctx.caster, '混乱', 8)
      }
      return true
    }
    // ターン経過で発動率を高め、敵複数への攻撃量に応じて味方を回復する。
    case '一切皆空': {
      // 1ターン目は一揆の発動判定を行わない。
      if (ctx.turn < 2) return true
      // 2ターン目30%から、ターン経過ごとに発動率を40ポイントずつ増やす。
      const uprisingChance = Math.min(1, 0.3 + (ctx.turn - 2) * 0.4)
      if (!h.roll(ctx.rng, uprisingChance)) return true
      // 一揆発動後、その行動で実際に攻撃する確率はターン数に応じ80～90%になる。
      const attackChance = Math.min(0.9, 0.8 + (ctx.turn - 2) * (0.1 / 6))
      if (!h.roll(ctx.rng, attackChance)) return true

      // 通常は敵軍2名、50%で3名を攻撃する。
      const targets = randomMany(ctx, h, ctx.enemies, h.roll(ctx.rng, 0.5) ? 3 : 2)
      let total = 0
      // 武勇と知略の高い方を攻撃属性として使う。
      const attackStat: Stat = statOf(ctx.caster, 'val') >= statOf(ctx.caster, 'int') ? 'val' : 'int'
      const damageKind = attackStat === 'val' ? 'physical' : 'strategy'
      // 大将時は、自軍にいる雑賀・本願寺武将1名につきダメージ率を12%加算する。
      const factionAllies = living(ctx.allies).filter((ally) => /本願寺|雑賀/.test(ally.faction))
      const damageRate = 72 + (ctx.caster.role === 'main' ? factionAllies.length * 12 : 0)
      targets.forEach((target) => {
        // 防御属性を参照しない個別式で、防御無視の一揆ダメージを与える。
        total += h.dealSkillDamage(ctx, target, damageRate, damageKind, {
          attackStats: [attackStat],
          defenseStats: [],
          coefficient: 1.37,
        })
      })
      // 与えた合計ダメージの25%を、生存する雑賀・本願寺武将へ均等配分する。
      if (factionAllies.length > 0 && total > 0) {
        const healRate = total * 0.25 / factionAllies.length / Math.max(1, statOf(ctx.caster, 'int') * 2.64) * 100
        factionAllies.forEach((ally) => h.healBySkill(ctx, ally, healRate, 'strategy'))
      }
      return true
    }
    // 通常攻撃を受けた時に反撃し、兵刃吸血を段階的に蓄積する。
    case '古今独歩': {
      if (!ctx.target || !h.roll(ctx.rng, 0.48)) return true
      h.dealSkillDamage(ctx, ctx.target, 70, 'physical')
      const stacks = Math.min(ctx.caster.role === 'main' ? 10 : 8, (ctx.caster.specialState.kokonLifeStealStacks ?? 0) + 1)
      ctx.caster.specialState.kokonLifeStealStacks = stacks
      ctx.caster.specialState.physicalLifeStealPercent = stacks * 4
      ctx.caster.specialState.physicalLifeStealUntil = 8
      return true
    }
    // 敵の兵力が減るほど威力を増し、条件達成時に能動発動率を上げる。
    case '冷徹無情': {
      randomMany(ctx, h, ctx.enemies, 2).forEach((target) => {
        // 対象の兵力損失率に応じ、142%の兵刃ダメージを最大50%増幅する。
        const lostRatio = 1 - target.hp / Math.max(1, target.maxHp)
        h.dealSkillDamage(ctx, target, 142 * (1 + Math.min(0.5, lostRatio * 0.5)), 'physical')
        const threshold = (ctx.caster.specialState.ruthlessRateStacks ?? 0) === 0 ? 0.75 : 0.5
        if (target.hp / Math.max(1, target.maxHp) <= threshold && (ctx.caster.specialState.ruthlessRateStacks ?? 0) < 2) {
          // 1回目は兵力75%以下、2回目は50%以下で能動発動率を10%ずつ上げる。
          const stacks = (ctx.caster.specialState.ruthlessRateStacks ?? 0) + 1
          ctx.caster.specialState.ruthlessRateStacks = stacks
          ctx.caster.specialState.ruthlessActiveRateBonus = stacks * 10
          // 大将なら4ターン、それ以外は2ターン持続する。
          ctx.caster.specialState.ruthlessActiveRateUntil = expires(ctx.turn, ctx.caster.role === 'main' ? 4 : 2)
          log(ctx, `${ctx.caster.name}の能動戦法発動率が10.00%上昇（合計+${stacks * 10}.00%）`)
        }
      })
      return true
    }
    // 行動前に破陣を付与し、その通常攻撃後に高倍率の兵刃追撃を行う。
    case '破陣乱舞': {
      if (ctx.trigger === 'beforeAction') {
        const ally = highest(ctx.allies.filter((fighter) => fighter.id !== ctx.caster.id), 'val')
        ;[ctx.caster, ally].filter((fighter): fighter is BattleFighter => Boolean(fighter)).forEach((fighter) => {
          fighter!.specialState.physicalPenetration = attributeValue(46, statOf(ctx.caster, 'val'))
          fighter!.specialState.physicalPenetrationUntil = ctx.turn
        })
        ctx.caster.specialState.breakFormationNormalUntil = ctx.turn
        ctx.caster.skillCooldowns[ctx.skill.id || ctx.skill.name] = 1
        return true
      }
      if ((ctx.caster.specialState.breakFormationNormalUntil ?? 0) >= ctx.turn && ctx.target) {
        h.dealSkillDamage(ctx, ctx.target, 206, 'physical')
        if (ctx.caster.role === 'main' && h.roll(ctx.rng, 0.35)) {
          const extra = random(ctx, h, ctx.enemies.filter((enemy) => enemy.id !== ctx.target?.id))
          if (extra) h.dealSkillDamage(ctx, extra, 206, 'physical')
        }
        ctx.caster.specialState.breakFormationNormalUntil = 0
      }
      return true
    }
    // 味方副将の武勇を重ねて上げ、最大時に敵へランダム制御を付与する。
    case '風姿綽約': {
      randomMany(ctx, h, ctx.allies.filter((ally) => ally.id !== ctx.caster.id), 2).forEach((ally) => {
        const stacks = stackPermanent(ally, 'val', `graceValor:${ctx.caster.id}`, statOf(ally, 'val') * 0.04, 4)
        if (stacks >= 4 && h.roll(ctx.rng, attributeChance(0.65, statOf(ctx.caster, 'int')))) {
          const target = random(ctx, h, ctx.enemies)
          if (target) applyControlRandom(ctx, h, target, ['混乱', '封撃', '無策', '疲弊'], 1)
        }
      })
      return true
    }
    // 味方の通常攻撃で主属性を強化し、標的への被ダメージに反応して回復する。
    case '同気連枝': {
      if (ctx.trigger === 'allyNormalAttack' && subject) {
        const stat = primaryStat(subject)
        stackPermanent(subject, stat, `sameBranch:${ctx.caster.id}:${stat}`, attributeValue(5, statOf(ctx.caster, 'int')), 5)
        return true
      }
      if (ctx.trigger === 'beforeAction') {
        randomMany(ctx, h, ctx.enemies, h.roll(ctx.rng, 0.5) ? 3 : 2).forEach((enemy) => {
          enemy.specialState[`sameBranchMarked:${ctx.caster.id}`] = ctx.turn
        })
        return true
      }
      const source = ctx.target
      const damaged = subject ?? ctx.caster
      if (source && source.specialState[`sameBranchMarked:${ctx.caster.id}`] === ctx.turn && h.roll(ctx.rng, 0.8)) {
        h.healBySkill(ctx, damaged, attributeValue(28, statOf(ctx.caster, 'int')), 'strategy')
      }
      return true
    }
    // 知略最大の味方へ計略強化と吸血を与え、武勇最大の味方を一時弱化する。
    case '末世の道者': {
      const strategist = highest(ctx.allies, 'int')
      const warrior = highest(ctx.allies, 'val')
      if (strategist) {
        setPermanent(strategist, 'strategyDamageDealt', name, attributeValue(14, statOf(ctx.caster, 'lea')))
        strategist.specialState.strategyLifeStealPercent = attributeValue(14, statOf(ctx.caster, 'lea'))
      }
      if (warrior) h.addTimedModifier(ctx, warrior, 'val', -statOf(warrior, 'val') * 0.1, ctx.caster.role === 'main' ? 4 : 8)
      return true
    }
    // 自身へ洞察と最も高い戦闘属性に応じた恒久強化を与える。
    case '豊後の戦陣': {
      ctx.caster.specialState.insightUntil = 8
      const top = primaryStat(ctx.caster)
      if (top === 'val') setPermanent(ctx.caster, 'attackDamage', name, attributeValue(12, statOf(ctx.caster, 'val')))
      else if (top === 'int') setPermanent(ctx.caster, 'strategyDamageDealt', name, attributeValue(12, statOf(ctx.caster, 'int')))
      else ctx.caster.specialState.activeSkillActivationRateBonus = attributeValue(8, statOf(ctx.caster, 'lea'))
      if (ctx.caster.role === 'main') setPermanent(ctx.caster, top, `${name}大将`, 20)
      return true
    }
    // 通常攻撃対象へ兵刃追撃し、敵大将へ混乱または属性奪取を行う。
    case '天下御免': {
      if (!ctx.target) return true
      h.dealSkillDamage(ctx, ctx.target, 188, 'physical')
      if (ctx.target.role !== 'main') return true
      if (!hasControl(ctx.target, '混乱')) h.addControl(ctx, ctx.target, '混乱', 2)
      else {
        const stat = primaryStat(ctx.target)
        ctx.target.buffs[stat] = (ctx.target.buffs[stat] ?? 0) - 30
        ctx.caster.buffs[stat] = (ctx.caster.buffs[stat] ?? 0) + 30
      }
      return true
    }
    // 被ダメージ時に確率で弱体をすべて解除し、自身を回復する。
    case '鬼美濃': {
      if (!h.roll(ctx.rng, 0.35)) return true
      removeDebuffs(ctx.caster, 99)
      h.healBySkill(ctx, ctx.caster, 112, 'leadership')
      return true
    }
    // 自身の弱体を解除して敵全体へ兵刃ダメージを与える。
    case 'かかれ柴田': {
      removeDebuffs(ctx.caster, 2)
      living(ctx.enemies).forEach((enemy) => h.dealSkillDamage(ctx, enemy, 154, 'physical'))
      if (ctx.caster.role === 'main' && ctx.turn >= 5) {
        const ally = random(ctx, h, ctx.allies.filter((fighter) => fighter.id !== ctx.caster.id))
        if (ally) removeDebuffs(ally, 2)
      }
      ctx.caster.skillCooldowns[ctx.skill.id || ctx.skill.name] = 1
      return true
    }
    // 自身と味方一人へ乱舞を付与し、後半は速度も上昇させる。
    case '掃疑平乱': {
      const friendPool = ctx.allies.filter((ally) => ally.id !== ctx.caster.id)
      const friend = ctx.caster.role === 'main' ? highest(friendPool, 'val') : random(ctx, h, friendPool)
      ;[ctx.caster, friend].filter((fighter): fighter is BattleFighter => Boolean(fighter)).forEach((fighter) => {
        fighter!.specialState.splashAttackChance = attributeValue(78, statOf(ctx.caster, 'spd'))
        fighter!.specialState.splashAttackUntil = expires(ctx.turn, 2)
        if (ctx.turn >= 5) h.addTimedModifier(ctx, fighter!, 'spd', statOf(fighter!, 'spd') * 0.2, 2)
      })
      return true
    }
    // 能動戦法発動時に鉄壁を獲得し、規定回数ごとに通常攻撃後の全体追撃を予約する。
    case '槍の又左': {
      if (ctx.trigger === 'ownSkillActivated') {
        if ((ctx.caster.specialState.currentActivatedSkillActive ?? 0) <= 0 || !h.roll(ctx.rng, 0.9)) return true
        ctx.caster.specialState.ironWallCharges = (ctx.caster.specialState.ironWallCharges ?? 0) + 1
        const checks = (ctx.caster.specialState.matazaIronWallChecks ?? 0) + 1
        ctx.caster.specialState.matazaIronWallChecks = checks
        if (checks % 2 === 0) ctx.caster.specialState.matazaEnhancedNormal = 1
        return true
      }
      if ((ctx.caster.specialState.matazaEnhancedNormal ?? 0) <= 0) return true
      ctx.caster.specialState.matazaEnhancedNormal = 0
      living(ctx.enemies).forEach((enemy) => h.dealSkillDamage(ctx, enemy, ctx.caster.role === 'main' ? 70 : 50, 'physical'))
      return true
    }
    // 戦闘開始時に高い会心率を得て、会心成立ごとに会心ダメージを伸ばす。
    case '破竹の勢い': {
      setPermanent(ctx.caster, 'physicalCriticalChance', name, 70)
      ctx.caster.specialState.criticalDamageBonus = Math.max(ctx.caster.specialState.criticalDamageBonus ?? 0, 30)
      return true
    }
    // 最も兵力の少ない味方を回復・軽減し、全快時は自身も回復する。
    case '死灰復然': {
      const target = h.weakest(ctx.allies, 1)[0]
      if (!target) return true
      const missingBefore = Math.max(0, target.maxHp - target.hp)
      const healed = h.healBySkill(ctx, target, 276, 'strategy')
      h.addTimedModifier(ctx, target, 'damageTaken', -attributeValue(18, statOf(ctx.caster, 'int')), 1)
      if (healed >= missingBefore && missingBefore > 0) h.healBySkill(ctx, ctx.caster, 108, 'strategy')
      return true
    }
    // 敵全体の被ダメージを上げた後、計略ダメージを与える。
    case '十面埋伏': {
      living(ctx.enemies).forEach((enemy) => {
        const value = attributeValue(18, statOf(ctx.caster, 'int'))
        if (ctx.caster.role === 'main' && ctx.turn >= 5) setPermanent(enemy, 'damageTaken', `${name}:${ctx.caster.id}`, value)
        else h.addTimedModifier(ctx, enemy, 'damageTaken', value, 2)
        h.dealSkillDamage(ctx, enemy, 138, 'strategy')
      })
      return true
    }
    // 自身へ永続連撃と武勇上昇を付与する。
    case '東国無双の麗': {
      ctx.caster.specialState.comboChance = 100
      ctx.caster.specialState.comboChanceUntil = 8
      setPermanent(ctx.caster, 'val', name, 30)
      return true
    }
    // 奇数ターンは属性低下、偶数ターンは混乱を敵複数へ判定する。
    case '帰蝶の舞': {
      const targets = randomMany(ctx, h, ctx.enemies, 2)
      if (ctx.turn % 2 === 1) {
        if (!h.roll(ctx.rng, attributeChance(0.4, statOf(ctx.caster, 'int')))) return true
        targets.forEach((target) => {
          h.addTimedModifier(ctx, target, 'lea', -statOf(target, 'lea') * 0.22, 1)
          h.addTimedModifier(ctx, target, 'int', -statOf(target, 'int') * 0.22, 1)
        })
      } else if (h.roll(ctx.rng, attributeChance(0.38, statOf(ctx.caster, 'int')))) {
        targets.forEach((target) => h.addControl(ctx, target, '混乱', 1))
      }
      return true
    }
    // 能動発動率を上げ、能動発動時に味方全体へ制御耐性を付与する。
    case '越後流軍学': {
      if (ctx.trigger === 'preparationTurn') {
        ctx.caster.specialState.activeSkillActivationRateBonus = (ctx.caster.specialState.activeSkillActivationRateBonus ?? 0) + 20
        return true
      }
      if ((ctx.caster.specialState.currentActivatedSkillActive ?? 0) <= 0 || !h.roll(ctx.rng, attributeChance(0.5, statOf(ctx.caster, 'int')))) return true
      const pool = ['封撃', '無策', '威圧', '疲弊'].filter((control) => living(ctx.allies).some((ally) => (ally.specialState[`controlImmunityUntil:${control}`] ?? 0) < ctx.turn + 1))
      const control = pool[Math.floor(ctx.rng() * pool.length)] ?? ['封撃', '無策', '威圧', '疲弊'][0]
      living(ctx.allies).forEach((ally) => { ally.specialState[`controlImmunityUntil:${control}`] = expires(ctx.turn, ctx.caster.role === 'main' ? 3 : 2) })
      return true
    }
    // 敵複数を兵刃攻撃し、封撃の有無で追加付与と威力を切り替える。
    case '甲山猛虎': {
      randomMany(ctx, h, ctx.enemies, 2).forEach((target) => {
        const sealed = hasControl(target, '封撃')
        h.dealSkillDamage(ctx, target, sealed ? 136 : 96, 'physical')
        if (!sealed) h.addControl(ctx, target, '封撃', 1)
      })
      return true
    }
    // 自身が最低兵力なら回復し、それ以外は敵複数を挑発・牽制する。
    case '陣前無我': {
      const lowestHp = Math.min(...living(ctx.allies).map((ally) => ally.hp / Math.max(1, ally.maxHp)))
      if (ctx.caster.hp / Math.max(1, ctx.caster.maxHp) <= lowestHp) {
        h.healBySkill(ctx, ctx.caster, 278, 'leadership')
      } else {
        randomMany(ctx, h, ctx.enemies, h.roll(ctx.rng, 0.5) ? 3 : 2).forEach((enemy) => {
          h.addControl(ctx, enemy, '挑発', 1)
          h.addControl(ctx, enemy, '牽制', 1)
        })
      }
      return true
    }
    // 自身と味方一人へ会心・奇策を付与し、成立ごとの強化を記録する。
    case '湖水渡り': {
      const ally = random(ctx, h, ctx.allies.filter((fighter) => fighter.id !== ctx.caster.id))
      ;[ctx.caster, ally].filter((fighter): fighter is BattleFighter => Boolean(fighter)).forEach((fighter) => {
        h.addTimedModifier(ctx, fighter!, 'strategyCriticalChance', 65, 2)
        h.addTimedModifier(ctx, fighter!, 'physicalCriticalChance', 65, 2)
        fighter!.specialState.lakeCriticalUntil = expires(ctx.turn, 2)
        fighter!.specialState.lakeCriticalStacks = 0
      })
      return true
    }
    // 偶数ターンに敵全体へ継続状態がある場合、味方全体を回復する。
    case '内助の賢': {
      if (ctx.turn % 2 !== 0 || !living(ctx.enemies).every((enemy) => hasDot(enemy))) return true
      living(ctx.allies).forEach((ally) => h.healBySkill(ctx, ally, 96, 'strategy'))
      return true
    }
    // 乱舞を得て、兵刃ヒット蓄積に応じた確率で最低統率の敵を狙う。
    case '七本槍筆頭': {
      if (ctx.trigger === 'preparationTurn') {
        ctx.caster.specialState.splashAttackChance = 92
        ctx.caster.specialState.splashAttackUntil = 8
        return true
      }
      const chance = 30 + (ctx.caster.specialState.spearSevenLockStacks ?? 0) * 13
      if (h.roll(ctx.rng, chance / 100)) {
        const target = lowest(ctx.enemies, 'lea')
        if (target) {
          ctx.caster.specialState.forcedNormalTargetRole = roleCode(target)
          ctx.caster.specialState.forcedNormalTargetUntil = ctx.turn
        }
      }
      return true
    }
    // 味方の被ダメージを肩代わりし、自身の武勇と兵刃吸血を強化する。
    case '勇志不抜': {
      randomMany(ctx, h, ctx.allies.filter((ally) => ally.id !== ctx.caster.id), 2).forEach((ally) => {
        ally.specialState.damageShoulderSourceRole = roleCode(ctx.caster)
        ally.specialState.damageShoulderPercent = 20
        ally.specialState.damageShoulderUntil = expires(ctx.turn, 2)
      })
      const low = ctx.caster.hp / Math.max(1, ctx.caster.maxHp) <= 0.5
      h.addTimedModifier(ctx, ctx.caster, 'val', low ? 100 : 75, 2)
      ctx.caster.specialState.physicalLifeStealPercent = low ? 32 : 24
      ctx.caster.specialState.physicalLifeStealUntil = expires(ctx.turn, 2)
      return true
    }
    // 序盤は大将を保護し、3ターン目から兵刃・計略吸血を与える。
    case '尼御台': {
      const commander = ctx.allies.find((ally) => ally.role === 'main')
      if (!commander) return true
      if (ctx.trigger === 'preparationTurn') {
        commander.specialState.insightUntil = 2
        h.addTimedModifier(ctx, commander, 'damageTaken', -attributeValue(18, statOf(ctx.caster, 'int')), 2)
      } else if (ctx.turn === 3) {
        commander.specialState.physicalLifeStealPercent = attributeValue(24, statOf(ctx.caster, 'int'))
        commander.specialState.strategyLifeStealPercent = attributeValue(24, statOf(ctx.caster, 'int'))
        commander.specialState.physicalLifeStealUntil = 6
        commander.specialState.strategyLifeStealUntil = 6
      }
      return true
    }
    // 自身と大将時の味方へ兵刃吸血を与え、敵複数を攻撃する。
    case '信義貫徹': {
      ctx.caster.specialState.physicalLifeStealPercent = 15
      ctx.caster.specialState.physicalLifeStealUntil = ctx.turn
      if (ctx.caster.role === 'main') {
        const ally = random(ctx, h, ctx.allies.filter((fighter) => fighter.id !== ctx.caster.id))
        if (ally) {
          ally.specialState.physicalLifeStealPercent = 15
          ally.specialState.physicalLifeStealUntil = ctx.turn
        }
      }
      randomMany(ctx, h, ctx.enemies, 2).forEach((enemy) => h.dealSkillDamage(ctx, enemy, 156, 'physical'))
      return true
    }
    // 敵複数へ計略ダメージと、指揮・受動の所持数に応じた恐慌を与える。
    case '旋乾転坤': {
      randomMany(ctx, h, ctx.enemies, h.roll(ctx.rng, 0.5) ? 3 : 2).forEach((enemy) => {
        h.dealSkillDamage(ctx, enemy, ctx.caster.role === 'main' ? 146 : 126, 'strategy')
        const passiveCount = enemy.skills.filter((skill) => /指揮|受動|被動/.test(`${skill.type ?? ''}${skill.category_jp ?? ''}`)).length
        addDot(ctx, enemy, '恐慌', 64 + passiveCount * 34, 2, 'strategy')
      })
      ctx.caster.skillCooldowns[ctx.skill.id || ctx.skill.name] = 1
      return true
    }
    // 敵複数へ高倍率兵刃ダメージを与え、撃破時に破陣を得る。
    case '怪力無双': {
      const targets = randomMany(ctx, h, ctx.enemies, ctx.caster.role === 'main' ? 3 : (h.roll(ctx.rng, 0.5) ? 3 : 2))
      let defeated = false
      targets.forEach((target) => {
        h.dealSkillDamage(ctx, target, 333, 'physical')
        defeated ||= target.hp <= 0
      })
      if (defeated) ctx.caster.specialState.physicalPenetrationUntil = expires(ctx.turn, 2)
      return true
    }
    // 味方複数へ計略吸血を付与し、敵複数へ水攻めを与える。
    case '積水成淵': {
      randomMany(ctx, h, ctx.allies, h.roll(ctx.rng, 0.5) ? 3 : 2).forEach((ally) => {
        ally.specialState.strategyLifeStealPercent = 22
        ally.specialState.strategyLifeStealUntil = expires(ctx.turn, 2)
      })
      randomMany(ctx, h, ctx.enemies, h.roll(ctx.rng, 0.5) ? 3 : 2).forEach((enemy) => addDot(ctx, enemy, '水攻め', 88, 2, 'strategy'))
      return true
    }
    // 序盤は味方全体を強化し、4ターン目から自身と敵一人を弱化する。
    case '諸行無常': {
      if (ctx.trigger === 'preparationTurn') {
        living(ctx.allies).forEach((ally) => h.addTimedModifier(ctx, ally, 'damageDealt', attributeValue(24, statOf(ctx.caster, 'int')), 3))
      } else if (ctx.turn === 4) {
        h.addTimedModifier(ctx, ctx.caster, 'damageDealt', -attributeValue(56, statOf(ctx.caster, 'int')), 3)
        const enemy = random(ctx, h, ctx.enemies)
        if (enemy) h.addTimedModifier(ctx, enemy, 'damageDealt', -attributeValue(56, statOf(ctx.caster, 'int')), 3)
      }
      return true
    }
    // 敵一人を兵刃攻撃し、味方一人の固有戦法発動率を上げる。
    case '先陣鼓舞': {
      const enemy = random(ctx, h, ctx.enemies)
      if (enemy) h.dealSkillDamage(ctx, enemy, 242, 'physical')
      const ally = random(ctx, h, ctx.allies)
      if (ally) {
        ally.specialState.uniqueActivationRateBonus = (ally.specialState.uniqueActivationRateBonus ?? 0) + 16 + (ctx.caster.role === 'main' ? 4 : 0)
        ally.specialState.uniqueActivationRateBonusUntil = expires(ctx.turn, 2)
      }
      return true
    }
    // 自身へ洞察と属性上昇を与え、敵複数へ牽制を判定する。
    case '斗星北天': {
      ctx.caster.specialState.insightUntil = expires(ctx.turn, 2)
      h.addTimedModifier(ctx, ctx.caster, 'lea', 50, 2)
      h.addTimedModifier(ctx, ctx.caster, 'int', 50, 2)
      randomMany(ctx, h, ctx.enemies, h.roll(ctx.rng, 0.5) ? 3 : 2).forEach((enemy) => {
        if (h.roll(ctx.rng, attributeChance(0.75, statOf(ctx.caster, 'int')))) h.addControl(ctx, enemy, '牽制', 2)
      })
      return true
    }
    // 味方複数を即時回復し、次ターンの休養回復を予約する。
    case '一心一徳': {
      randomMany(ctx, h, ctx.allies, h.roll(ctx.rng, 0.5) ? 3 : 2).forEach((ally) => {
        h.healBySkill(ctx, ally, 60, 'strategy')
        ally.specialState.restHealRate = 76
        ally.specialState.restHealTurn = ctx.turn + 1
        ally.specialState.restHealSourceRole = roleCode(ctx.caster)
      })
      return true
    }
    // 序盤は味方全体へ回避を与え、中盤は毎ターン回復する。
    case '非常の器': {
      if (ctx.trigger === 'preparationTurn') {
        living(ctx.allies).forEach((ally) => {
          ally.specialState.skillEvasionChance = 35
          ally.specialState.skillEvasionUntil = 2
        })
      } else if (ctx.turn >= 3 && ctx.turn <= 5) {
        living(ctx.allies).forEach((ally) => h.healBySkill(ctx, ally, 66, 'strategy'))
      }
      return true
    }
    // 大将を援護し、通常攻撃を受けるたびに武勇・統率を蓄積する。
    case '耐苦鍛錬': {
      if (ctx.trigger === 'preparationTurn') {
        const commander = ctx.allies.find((ally) => ally.role === 'main')
        if (commander && commander.id !== ctx.caster.id) {
          commander.statuses['援護'] = 3
          commander.specialState.mikawaGuardianRole = ctx.caster.role === 'vice1' ? 1 : 2
        }
        return true
      }
      const stacks = ctx.caster.specialState.enduranceStacks ?? 0
      if (stacks >= 5) return true
      ctx.caster.specialState.enduranceStacks = stacks + 1
      ctx.caster.buffs.val = (ctx.caster.buffs.val ?? 0) + 14
      ctx.caster.buffs.lea = (ctx.caster.buffs.lea ?? 0) + 14
      if (stacks + 1 === 5) living(ctx.enemies).forEach((enemy) => h.dealSkillDamage(ctx, enemy, 160, 'physical'))
      return true
    }
    // 味方へ洞察、敵へ密報を付け、その敵の能動発動時に反撃する。
    case '密報通暁': {
      if (ctx.trigger === 'beforeAction') {
        const ally = random(ctx, h, ctx.allies)
        const enemy = random(ctx, h, ctx.enemies)
        if (ally) ally.specialState.insightUntil = expires(ctx.turn, 2)
        if (enemy) {
          enemy.specialState.intelDisruptSourceRole = roleCode(ctx.caster)
          enemy.specialState.intelDisruptUntil = expires(ctx.turn, 2)
        }
        return true
      }
      if (!subject || (subject.specialState.intelDisruptUntil ?? 0) < ctx.turn || subject.specialState.intelDisruptSourceRole !== roleCode(ctx.caster)) return true
      h.dealSkillDamage(ctx, subject, 152, 'strategy')
      return true
    }
    // 相手兵種を見て自身の被ダメージ軽減率を決定する。
    case '夜叉美濃': {
      const strongMatchup = ctx.enemies.some((enemy) => enemy.troopType === '騎兵' || enemy.troopType === '鉄砲')
      setPermanent(ctx.caster, 'damageTaken', name, -(strongMatchup ? 50 : 35))
      return true
    }
    // 統率を上げて武勇最大の敵を固定し、弱体中なら鉄壁も得る。
    case '一徹の意志': {
      h.addTimedModifier(ctx, ctx.caster, 'lea', 150, 2)
      const enemy = highest(ctx.enemies, 'val')
      if (enemy) {
        h.addControl(ctx, enemy, '挑発', 2)
        h.addControl(ctx, enemy, '牽制', 2)
      }
      if (Object.keys(ctx.caster.statuses).length > 0 || ctx.caster.timedStatuses.length > 0) {
        ctx.caster.specialState.ironWallCharges = (ctx.caster.specialState.ironWallCharges ?? 0) + 2
      }
      ctx.caster.skillCooldowns[ctx.skill.id || ctx.skill.name] = 1
      return true
    }
    // 敵一人を攻撃し、潰走の有無で付与または自己回復を行う。
    case '攻めの三左': {
      const enemy = random(ctx, h, ctx.enemies)
      if (!enemy) return true
      h.dealSkillDamage(ctx, enemy, 142, 'physical')
      if (hasDot(enemy, '潰走')) h.healBySkill(ctx, ctx.caster, 70, 'bravery')
      else addDot(ctx, enemy, '潰走', 72, 3, 'physical')
      return true
    }
    // 味方一人の能動発動率を上げ、次の能動発動時の統率上昇を予約する。
    case '仏の高力': {
      const ally = random(ctx, h, ctx.allies)
      if (!ally) return true
      ally.specialState.activeSkillActivationRateBonus = (ally.specialState.activeSkillActivationRateBonus ?? 0) + attributeValue(9, statOf(ctx.caster, 'lea'))
      ally.specialState.buddhaLeadershipBonus = attributeValue(30, statOf(ctx.caster, 'int'))
      ally.specialState.buddhaLeadershipUntil = expires(ctx.turn, 2)
      return true
    }
    // 敵一人へ計略ダメージと威圧を与え、大将時は既存威圧を疲弊へ変える。
    case '綱紀粛正': {
      const enemy = random(ctx, h, ctx.enemies)
      if (!enemy) return true
      h.dealSkillDamage(ctx, enemy, 196, 'strategy')
      if (ctx.caster.role === 'main' && hasControl(enemy, '威圧')) h.addControl(ctx, enemy, '疲弊', 2)
      else h.addControl(ctx, enemy, '威圧', 2)
      return true
    }
    // 敵複数を攻撃・挑発し、突撃と大将時の通常攻撃ダメージを下げる。
    case '傲岸不遜': {
      randomMany(ctx, h, ctx.enemies, 2).forEach((enemy) => {
        h.dealSkillDamage(ctx, enemy, 124, 'physical')
        h.addControl(ctx, enemy, '挑発', 2)
        enemy.specialState.assaultDamagePenalty = attributeValue(30, statOf(ctx.caster, 'lea'))
        enemy.specialState.assaultDamagePenaltyUntil = expires(ctx.turn, 2)
        if (ctx.caster.role === 'main') {
          enemy.specialState.normalDamagePenalty = attributeValue(30, statOf(ctx.caster, 'lea'))
          enemy.specialState.normalDamagePenaltyUntil = expires(ctx.turn, 2)
        }
      })
      return true
    }
    // 潰走がない敵を優先して継続ダメージと次の与ダメージ低下を付与する。
    case '満ちゆく月': {
      const target = living(ctx.enemies).find((enemy) => !hasDot(enemy, '潰走')) ?? random(ctx, h, ctx.enemies)
      if (!target) return true
      addDot(ctx, target, '潰走', 108, ctx.caster.role === 'main' ? 8 : 4, 'physical')
      target.specialState.nextDamagePenalty = 40
      target.specialState.nextDamagePenaltyCharges = 2
      return true
    }
    // 通常攻撃対象へ兵刃追撃し、威圧を付与する。
    case '鬼十河': {
      if (!ctx.target) return true
      h.dealSkillDamage(ctx, ctx.target, 188, 'physical')
      h.addControl(ctx, ctx.target, '威圧', 1)
      return true
    }
    // 敵一人へ計略ダメージを与え、制御状態を一つ付与する。
    case '津田流砲術': {
      const target = random(ctx, h, ctx.enemies)
      if (!target) return true
      h.dealSkillDamage(ctx, target, 188, 'strategy')
      applyControlRandom(ctx, h, target, ['封撃', '無策', '威圧', '混乱'], 2)
      return true
    }
    // 通常攻撃対象へ計略追撃し、確率で味方の追加計略攻撃を行う。
    case '仁者の沈勇': {
      if (!ctx.target) return true
      h.dealSkillDamage(ctx, ctx.target, 184, 'strategy')
      if (h.roll(ctx.rng, ctx.caster.role === 'main' ? 0.9 : 0.7)) {
        const ally = random(ctx, h, ctx.allies.filter((fighter) => fighter.id !== ctx.caster.id))
        if (ally) h.dealSkillDamage({ ...ctx, caster: ally }, ctx.target, 154, 'strategy')
      }
      return true
    }
    // 味方複数の弱体を解除し、武勇と統率を上げる。
    case '諏訪の光': {
      randomMany(ctx, h, ctx.allies, 2).forEach((ally) => {
        removeDebuffs(ally, 2)
        h.addTimedModifier(ctx, ally, 'val', 36, 2)
        h.addTimedModifier(ctx, ally, 'lea', 36, 2)
      })
      return true
    }
    // 敵一人へ高倍率兵刃ダメージと回復不可を与え、撃破時に次回を強化する。
    case '笹の才蔵': {
      const target = random(ctx, h, ctx.enemies)
      if (!target) return true
      h.dealSkillDamage(ctx, target, 522, 'physical')
      h.addControl(ctx, target, '回復不可', 3)
      if (target.hp <= 0) {
        ctx.caster.specialState[`activationRateBonus:${name}`] = 100
        ctx.caster.specialState.skipPreparationOnce = 1
      }
      return true
    }
    // 味方複数へ先攻と能動戦法限定の与ダメージ上昇を付与する。
    case '落花啼鳥': {
      randomMany(ctx, h, ctx.allies, 2).forEach((ally) => {
        // 先攻は行動順判定が参照する状態として付与する。
        ally.statuses['先攻'] = Math.max(ally.statuses['先攻'] ?? 0, 2)
        // 与ダメージ上昇は説明どおり能動戦法にだけ適用する。
        ally.specialState.activeDamageBonus = ctx.caster.role === 'main' ? 85 : 75
        ally.specialState.activeDamageBonusUntil = expires(ctx.turn, 2)
      })
      return true
    }
    // 味方複数を回復し、知略依存の与ダメージ上昇を与える。
    case '夢幻泡影': {
      randomMany(ctx, h, ctx.allies, 2).forEach((ally) => {
        h.healBySkill(ctx, ally, 118, 'strategy')
        h.addTimedModifier(ctx, ally, 'damageDealt', attributeValue(15, statOf(ctx.caster, 'int')), 2)
      })
      return true
    }
    // 敵一人へ兵刃ダメージを与え、無策を付与する。
    case '槍弾正': {
      const target = random(ctx, h, ctx.enemies)
      if (target) {
        h.dealSkillDamage(ctx, target, 172, 'physical')
        h.addControl(ctx, target, '無策', 1)
      }
      return true
    }
    // 味方ごとの最初の被ダメージに反応し、攻撃者へ反撃して被弾者を回復する。
    case '剛毅木訥': {
      const damaged = subject ?? ctx.caster
      const turnKey = `gokiFirstDamage:${ctx.caster.id}`
      if (damaged.specialState[turnKey] === ctx.turn || !ctx.target) return true
      damaged.specialState[turnKey] = ctx.turn
      const chance = ctx.caster.role === 'main' ? attributeChance(0.45, statOf(ctx.caster, 'lea')) : 0.45
      if (h.roll(ctx.rng, chance)) {
        h.dealSkillDamage(ctx, ctx.target, 86, 'physical')
        h.healBySkill(ctx, damaged, 86, 'strategy')
      }
      return true
    }
    // 大将の非固有能動発動率を上げ、大将の戦法発動時に副将を保護する。
    case '松柏之操': {
      if (ctx.trigger === 'preparationTurn') {
        const commander = ctx.allies.find((ally) => ally.role === 'main')
        if (commander) commander.specialState.nonUniqueActiveActivationBonus = attributeValue(15, statOf(ctx.caster, 'int'))
        return true
      }
      if (!subject || subject.role !== 'main' || (subject.specialState.currentActivatedSkillCombatState ?? 0) <= 0) return true
      randomMany(ctx, h, ctx.allies.filter((ally) => ally.role !== 'main'), 2).forEach((ally) => {
        h.addTimedModifier(ctx, ally, 'damageTaken', -attributeValue(5, statOf(ctx.caster, 'int')), 2, 2)
      })
      return true
    }
    // 行動前に自身の制御状態を敵へ返し、味方がいる時は被ダメージを肩代わりさせる。
    case '樽俎折衝': {
      if (!h.roll(ctx.rng, attributeChance(0.3, statOf(ctx.caster, 'lea')))) return true
      const target = random(ctx, h, ctx.enemies)
      if (!target) return true
      if (hasControl(ctx.caster, '無策')) h.addControl(ctx, target, '無策', 2)
      if (hasControl(ctx.caster, '封撃') || !hasControl(ctx.caster, '無策')) h.addControl(ctx, target, '封撃', 2)
      if (living(ctx.allies).some((ally) => ally.id !== ctx.caster.id)) {
        ctx.caster.specialState.damageShoulderEnemyRole = roleCode(target)
        ctx.caster.specialState.damageShoulderPercent = attributeValue(ctx.caster.role === 'main' ? 7 : 4, statOf(ctx.caster, 'lea'))
        ctx.caster.specialState.damageShoulderUntil = expires(ctx.turn, 2)
      }
      return true
    }
    // 能動・突撃の発動回数を数え、奇数ターンの1回目は回復、2回目は計略強化する。
    case '風流武者': {
      if ((ctx.caster.specialState.currentActivatedSkillActive ?? 0) <= 0 && (ctx.caster.specialState.currentActivatedSkillAssault ?? 0) <= 0) return true
      if (ctx.turn % 2 === 1 && ctx.caster.specialState.flowingWarriorResetTurn !== ctx.turn) {
        ctx.caster.specialState.flowingWarriorResetTurn = ctx.turn
        ctx.caster.specialState.flowingWarriorCount = 0
      }
      const count = (ctx.caster.specialState.flowingWarriorCount ?? 0) + 1
      ctx.caster.specialState.flowingWarriorCount = count
      if (!h.roll(ctx.rng, attributeChance(0.8, statOf(ctx.caster, 'int')))) return true
      if (count === 1) randomMany(ctx, h, ctx.allies, 2).forEach((ally) => h.healBySkill(ctx, ally, 132, 'strategy'))
      if (count === 2) randomMany(ctx, h, ctx.allies, 2).forEach((ally) => h.addTimedModifier(ctx, ally, 'strategyDamageDealt', attributeValue(30, statOf(ctx.caster, 'int')), 2, 2))
      return true
    }
    // 前ターンの攻撃者を優先し、消沈または既存消沈への疲弊を判定する。
    case '上州の黄斑': {
      if (ctx.trigger === 'onNormalAttackReceived' && ctx.target) {
        ctx.caster.specialState.joshuLastAttackerRole = roleCode(ctx.target)
        ctx.caster.specialState.joshuLastAttackedTurn = ctx.turn
        return true
      }
      const lastAttacker = (ctx.caster.specialState.joshuLastAttackedTurn ?? -2) === ctx.turn - 1
        ? roleFighter(ctx.enemies, ctx.caster.specialState.joshuLastAttackerRole ?? 0)
        : null
      const targets = lastAttacker ? [lastAttacker] : randomMany(ctx, h, ctx.enemies, 2)
      const chance = attributeChance(lastAttacker ? 0.75 : 0.3, statOf(ctx.caster, 'lea'))
      targets.forEach((target) => {
        if (!h.roll(ctx.rng, chance)) return
        if (hasDot(target, '消沈')) {
          if (h.roll(ctx.rng, attributeChance(0.36 + (ctx.caster.role === 'main' ? 0.05 : 0), statOf(ctx.caster, 'lea')))) h.addControl(ctx, target, '疲弊', 1)
        } else addDot(ctx, target, '消沈', 46, 3, 'strategy')
      })
      return true
    }
    // 味方複数へ復活回数を与え、残数に応じて次ターンの与ダメージを上げる。
    case '股肱の臣': {
      if (ctx.trigger === 'beforeAction') {
        randomMany(ctx, h, ctx.allies, h.roll(ctx.rng, 0.5) ? 3 : 2).forEach((ally) => {
          ally.specialState.reviveCharges = 3
          ally.specialState.reviveHealRate = 54
          ally.specialState.reviveUntil = ctx.turn + 1
          ally.specialState.reviveSourceRole = roleCode(ctx.caster)
        })
      } else {
        living(ctx.allies).forEach((ally) => {
          if ((ally.specialState.reviveUntil ?? 0) !== ctx.turn) return
          const charges = ally.specialState.reviveCharges ?? 0
          if (charges > 0) h.addTimedModifier(ctx, ally, 'damageDealt', attributeValue(charges * 11, statOf(ctx.caster, 'int')), 1)
          ally.specialState.reviveCharges = 0
        })
      }
      return true
    }
    // 序盤の属性上昇、通常攻撃後の計略追撃、5ターン目の混乱を処理する。
    case '天神山残照': {
      if (ctx.trigger === 'afterNormalAttack') {
        if (ctx.target && h.roll(ctx.rng, 0.5)) h.dealSkillDamage(ctx, ctx.target, 218, 'strategy')
        return true
      }
      if (ctx.trigger === 'turnStart' && ctx.turn === 5) {
        const ally = highest(ctx.allies, 'int')
        if (ally) h.addControl(ctx, ally, '混乱', 1)
        return true
      }
      const rounds = ctx.caster.role === 'main' ? 5 : 4
      if (ctx.turn <= 0 || ctx.turn > rounds) return true
      const reduction = ctx.caster.role === 'main' ? 0.2 : 0.25
      const value = attributeValue(60 * Math.pow(1 - reduction, ctx.turn - 1), statOf(ctx.caster, 'int'))
      h.addTimedModifier(ctx, ctx.caster, 'val', value, 1)
      h.addTimedModifier(ctx, ctx.caster, 'int', value, 1)
      return true
    }
    default:
      return null
  }
}
