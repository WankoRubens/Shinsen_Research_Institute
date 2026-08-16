import type { Skill, Stat, Trait } from '../composables/useData'
import type { BattleFighter } from './battleSimulator'

/**
 * 戦闘開始時に一度だけ適用する、単純な常時特性をまとめたファイル。
 *
 * 属性上昇は戦闘開始時点の基礎属性に割合を掛けて加算する。
 * 与ダメージ・被ダメージ補正は、既存の戦闘計算で使う割合ポイントへ加算する。
 */
type TraitTarget = 'self' | 'allies'

interface StaticTraitEffect {
  target: TraitTarget
  stat: Stat
  values: Partial<Record<1 | 2 | 3, number>>
  percentOfBaseStat?: boolean
  label: string
}

// 説明文で数値を確認できるⅠ・Ⅱ・Ⅲ系の常時効果。
// 被ダメージ低下は damageTaken 系へ負数として登録する。
const STATIC_TRAIT_EFFECTS: Readonly<Record<string, StaticTraitEffect>> = {
  武威: { target: 'self', stat: 'val', values: { 1: 2, 2: 2.5, 3: 3 }, percentOfBaseStat: true, label: '武勇' },
  知恵: { target: 'self', stat: 'int', values: { 1: 2, 2: 2.5, 3: 3 }, percentOfBaseStat: true, label: '知略' },
  統帥: { target: 'self', stat: 'lea', values: { 1: 2, 2: 2.5, 3: 3 }, percentOfBaseStat: true, label: '統率' },
  急速: { target: 'self', stat: 'spd', values: { 1: 2, 2: 2.5, 3: 3 }, percentOfBaseStat: true, label: '速度' },
  破敵: { target: 'self', stat: 'damageDealt', values: { 1: 1.2, 2: 1.6, 3: 2 }, label: '与ダメージ' },
  血気: { target: 'self', stat: 'attackDamage', values: { 1: 1.6, 2: 2.2, 3: 2.8 }, label: '兵刃与ダメージ' },
  知謀: { target: 'self', stat: 'strategyDamageDealt', values: { 1: 2.6, 2: 3.3, 3: 4 }, label: '計略与ダメージ' },
  攻勢: { target: 'allies', stat: 'damageDealt', values: { 1: 1, 2: 1.3, 3: 1.6 }, label: '与ダメージ' },
  猛攻: { target: 'allies', stat: 'attackDamage', values: { 1: 1.4, 2: 1.8, 3: 2.5 }, label: '兵刃与ダメージ' },
  謀攻: { target: 'allies', stat: 'strategyDamageDealt', values: { 1: 2.3, 2: 3, 3: 3.7 }, label: '計略与ダメージ' },
  牢固: { target: 'self', stat: 'damageTaken', values: { 1: -1.2, 2: -1.6, 3: -2 }, label: '被ダメージ' },
  防護: { target: 'self', stat: 'physicalDamageTaken', values: { 1: -1.6, 2: -2.2, 3: -2.8 }, label: '兵刃被ダメージ' },
  看破: { target: 'self', stat: 'strategyDamageTaken', values: { 1: -2.6, 2: -3.3, 3: -4 }, label: '計略被ダメージ' },
  守勢: { target: 'allies', stat: 'damageTaken', values: { 1: -1, 2: -1.3, 3: -1.6 }, label: '被ダメージ' },
  固守: { target: 'allies', stat: 'physicalDamageTaken', values: { 1: -1.4, 2: -1.8, 3: -2.2 }, label: '兵刃被ダメージ' },
  堅固: { target: 'allies', stat: 'strategyDamageTaken', values: { 1: -2.3, 2: -3, 3: -3.7 }, label: '計略被ダメージ' },
}

// 内政・成長・城外移動だけに作用し、戦闘シミュレーションの計算対象にしない特性。
export const NON_BATTLE_TRAIT_NAMES = new Set([
  '甲斐の虎',
  '立身出世',
  '禄寿応穏',
])

// 個別処理を持つ戦闘特性。特性一覧の「実装済み」表示にも同じ定義を使う。
export const NAMED_TRAIT_BATTLE_EFFECTS: Readonly<Record<string, string>> = {
  赤備え: '初回通常攻撃後、対象の統率-18',
  勇烈: '毎ターン行動前に武勇+14（1ターン）',
  気勢Ⅰ: '会心・奇策ダメージ+4.50%',
  気勢Ⅱ: '会心・奇策ダメージ+6.00%',
  気勢Ⅲ: '会心・奇策ダメージ+7.50%',
  方円の器: '第3ターン以降、毎ターン最初の計略被ダメージ時に50%で自軍全体の知略+5（最大2回）',
  玄謀: '大将時、友軍大将技を補助。対象がない場合は回避+3%',
  妙計Ⅱ: '奇策ダメージ+8.50%',
  魔王: '行動後、各敵軍が初めて兵力50%以下になった時に追加兵力損失',
  覇王: '自身の回復時、回復量の10%を敵軍単体への追加ダメージへ変換',
  人は城: '自軍全体の統率+5%',
  三河武士: '自軍武将が通常攻撃後、15%で次の被ダメージ-50%',
  古狸: '同じ他勢力の友軍2名と編成時、自身をその勢力として扱う',
  謀神: '計略ダメージ時、25%で知略差に応じた追加ダメージ（最大3回）',
  三矢家訓: '自身の統率・武勇・知略がすべて異なる時、各属性+8',
  人たらし: '友軍回復の余剰発生時、50%で対象の主要属性+15（1ターン）',
  連歌百韻: '能動戦法の発動失敗時に再判定（固有35%、その他7%）',
  波風: '通常攻撃後、80%で対象の知略を2吸収（最大10回）',
  義の将: '混乱付与率を低下',
  越後の龍: 'そのターンに被ダメージがなければ、次の行動まで被ダメージ-22%',
  公家趣味: '装備品効果（戦闘編成で装備品未対応）',
  善戦Ⅱ: '会心率・奇策率+2.90%',
  四州の雄: '自軍全体の通常攻撃ダメージ+6%',
  雷の化身: '通常攻撃を受けた時、低確率で攻撃者へ麻痺を付与',
  尽力Ⅰ: '会心率+3.00%',
  尽力Ⅱ: '会心率+4.00%',
  尽力Ⅲ: '会心率+5.00%',
  清濁併呑: '25%で次の通常攻撃を無効化',
  心尽Ⅰ: '奇策率+4.00%',
  求道: '編成条件に応じた勢力変換、または自軍全体の計略被ダメージ-5%',
  無傷の誇り: '被ダメージ時の兵士死亡率を20%低下（戦死率8%）',
  剛猛Ⅰ: '通常攻撃の対象抽選ウェイト+10%',
  剛猛Ⅱ: '通常攻撃の対象抽選ウェイト+20%',
  剛猛Ⅲ: '通常攻撃の対象抽選ウェイト+30%',
  先駆け: '第3ターンまで、40%で制御を無効化（最大2回）',
  近衛斉射: '通常攻撃後、20%で対象へ麻痺を2ターン付与',
  姫家督: '兵刃ダメージを6回与えるたび、兵力最低の友軍を回復（最大2回）',
  姫城督: '兵刃ダメージを6回与えるたび、兵力最低の友軍を回復（最大2回）',
  老獪: '自身を大将の勢力として扱う。変換不要時は計略離反+8%',
  虚実: '混乱中の敵がいる間、自身の被ダメージ-3%',
  独眼竜: '行動前、武勇と知略の差に応じて与ダメージ上昇',
  高揚Ⅱ: '会心・奇策ダメージ+3.80%',
  金城鉄壁: '弱体状態の攻撃者から通常攻撃を受けた時、30%で自身を回復',
  坂東太郎: '統率低下中の対象へ兵刃ダメージ時、55%で武勇+8（2ターン・最大3回）',
  花枝招展: '通常攻撃を受けた時、45%で自身を回復（最大3回）',
  手足之愛: '毎ターン初めて他の友軍を回復した時、対象主要属性の12%分だけ自身の統率上昇',
  忍耐Ⅰ: '通常攻撃の対象抽選ウェイト-10%',
  忍耐Ⅱ: '通常攻撃の対象抽選ウェイト-20%',
  忍耐Ⅲ: '通常攻撃の対象抽選ウェイト-30%',
  雄略絶倫: '通常攻撃を受けた時、攻撃者と同じ主要属性を2吸収（最大8回）',
  傾奇者: '制御を12%で無効化',
  上下一心: '第1ターン、自軍2～3名が制御を30%で無効化',
  不死身: '被ダメージ時の兵士死亡率を20%低下（戦死率8%）',
  瓶割り: '第5ターン以降に離反10%。兵力50%以下では与ダメージ+10%',
  算盤勘定: '戦闘開始時、自身の武勇+16',
  築城名手: '戦闘開始時、自身の統率+24',
  奮戦Ⅰ: '通常攻撃を受けていない時、非固有能動戦法の発動率+2.00%',
  奮戦Ⅱ: '通常攻撃を受けていない時、非固有能動戦法の発動率+2.50%',
  奮戦Ⅲ: '通常攻撃を受けていない時、非固有能動戦法の発動率+3.00%',
  側撃: '通常攻撃後、14%で対象へ疲弊を1ターン付与',
  鳳凰: '被ダメージ+1.5%。第3ターン以降、最初の致死ダメージを無効化',
  姫武者: '2回攻撃するたび会心率+2%（最大8回）',
  短刀の契: '男性の自軍大将の全属性+2%',
  老功古実: '初めて能動戦法ダメージを受けた時、発動者の知略-15',
  猪武者: '兵刃ダメージ時、60%で会心率・会心ダメージ+1%（最大6回）',
  淑徳: '第2ターンまで、自軍大将が受ける最初の無策・封撃・混乱を80%で肩代わり',
  物外軒: '第4ターンまで、自身の能動・突撃戦法発動率+4.5%',
  一番槍: '第1ターンに初めてダメージを与えた時、50%で主要属性+18',
  威勢Ⅰ: '通常攻撃を受けていない時、固有能動戦法の発動率+2.10%',
  威勢Ⅱ: '通常攻撃を受けていない時、固有能動戦法の発動率+2.80%',
  威勢Ⅲ: '通常攻撃を受けていない時、固有能動戦法の発動率+3.50%',
  猛闘Ⅰ: '通常攻撃を受けていない時、非固有突撃戦法の発動率+2.00%',
  猛闘Ⅱ: '通常攻撃を受けていない時、非固有突撃戦法の発動率+2.50%',
  猛闘Ⅲ: '通常攻撃を受けていない時、非固有突撃戦法の発動率+3.00%',
  攻陣Ⅰ: '通常攻撃を受けていない時、固有突撃戦法の発動率+2.10%',
  攻陣Ⅱ: '通常攻撃を受けていない時、固有突撃戦法の発動率+2.80%',
  攻陣Ⅲ: '通常攻撃を受けていない時、固有突撃戦法の発動率+3.50%',
  死守: '初めて兵力50%以下になった時、自身を回復',
}

// 実際に戦闘イベントへ接続済みのものだけを一覧画面で「実装済み」にする。
// 数値が公開説明にないものや、装備品・大将技の追加対応が必要なものは先走って登録しない。
const IMPLEMENTED_NAMED_TRAIT_NAMES = new Set([
  '赤備え', '勇烈', '気勢Ⅰ', '気勢Ⅱ', '気勢Ⅲ', '方円の器', '妙計Ⅱ', '魔王', '覇王',
  '人は城', '三河武士', '古狸', '謀神', '三矢家訓', '人たらし', '連歌百韻', '波風',
  '越後の龍', '善戦Ⅱ', '四州の雄', '雷の化身', '尽力Ⅰ', '尽力Ⅱ', '尽力Ⅲ', '清濁併呑',
  '心尽Ⅰ', '求道', '無傷の誇り', '剛猛Ⅰ', '剛猛Ⅱ', '剛猛Ⅲ', '先駆け', '近衛斉射',
  '姫家督', '姫城督', '老獪', '独眼竜', '高揚Ⅱ', '金城鉄壁', '坂東太郎', '花枝招展',
  '手足之愛', '忍耐Ⅰ', '忍耐Ⅱ', '忍耐Ⅲ', '雄略絶倫', '傾奇者', '上下一心', '不死身',
  '瓶割り', '算盤勘定', '築城名手', '奮戦Ⅰ', '奮戦Ⅱ', '奮戦Ⅲ', '側撃', '鳳凰', '姫武者',
  '短刀の契', '老功古実', '猪武者', '淑徳', '物外軒', '一番槍', '威勢Ⅰ', '威勢Ⅱ', '威勢Ⅲ',
  '猛闘Ⅰ', '猛闘Ⅱ', '猛闘Ⅲ', '攻陣Ⅰ', '攻陣Ⅱ', '攻陣Ⅲ',
])

export const IMPLEMENTED_NAMED_TRAIT_EFFECTS: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(NAMED_TRAIT_BATTLE_EFFECTS).filter(([name]) => IMPLEMENTED_NAMED_TRAIT_NAMES.has(name)),
)

const ROMAN_LEVELS: Readonly<Record<string, 1 | 2 | 3>> = {
  I: 1,
  II: 2,
  III: 3,
}

// Unicodeローマ数字とASCII表記を同じ内部形式へ揃える。
const parseTraitSeries = (trait: Trait): { family: string; level: 1 | 2 | 3 } | null => {
  const name = (trait.name_jp || trait.name).normalize('NFKC').trim()
  const match = name.match(/^(.*?)(III|II|I)$/)
  if (!match) return null
  const level = ROMAN_LEVELS[match[2]]
  return level ? { family: match[1], level } : null
}

const signedPercent = (value: number): string => `${value >= 0 ? '+' : '-'}${Math.abs(value).toFixed(2)}%`

const traitName = (trait: Trait): string => (trait.name_jp || trait.name).normalize('NFKC').trim()

export const hasBattleTrait = (fighter: BattleFighter, name: string): boolean =>
  fighter.traits.some((trait) => traitName(trait) === name.normalize('NFKC'))

/**
 * 通常攻撃の対象抽選で使う重み。
 * 1.0を基準に、剛猛は10/20/30%加算、忍耐は10/20/30%減算する。
 */
export const traitNormalTargetWeight = (fighter: BattleFighter): number => {
  const weights: Readonly<Record<string, number>> = {
    剛猛I: 1.1,
    剛猛II: 1.2,
    剛猛III: 1.3,
    忍耐I: 0.9,
    忍耐II: 0.8,
    忍耐III: 0.7,
  }
  return fighter.traits.reduce((weight, trait) => weight * (weights[traitName(trait)] ?? 1), 1)
}

/**
 * 被ダメージ直後に戦死へ振り分ける割合。
 * 不死身・無傷の誇りは通常10%の戦死率を20%低下させるため8%になる。
 * 同一効果を複数持っていても二重に低下させない。
 */
export const traitImmediateDeathRate = (fighter: BattleFighter): number =>
  hasBattleTrait(fighter, '不死身') || hasBattleTrait(fighter, '無傷の誇り') ? 0.08 : 0.1

const familyLevelValue = (
  fighter: BattleFighter,
  values: Readonly<Record<string, number>>,
): number => fighter.traits.reduce((sum, trait) => sum + (values[traitName(trait)] ?? 0), 0)

/** 戦法の基礎発動率へ加える特性補正を、小数（4.5%=0.045）で返す。 */
export const traitActivationRateBonus = (
  fighter: BattleFighter,
  _skill: Skill,
  skillType: string,
  unique: boolean,
  turn: number,
): number => {
  const hasReceivedNormalThisTurn = (fighter.specialState.lastNormalAttackedTurn ?? 0) === turn
  let percent = 0
  if (!hasReceivedNormalThisTurn && skillType === '能動') {
    percent += unique
      ? familyLevelValue(fighter, { 威勢I: 2.1, 威勢II: 2.8, 威勢III: 3.5 })
      : familyLevelValue(fighter, { 奮戦I: 2, 奮戦II: 2.5, 奮戦III: 3 })
  }
  if (!hasReceivedNormalThisTurn && skillType === '突撃') {
    percent += unique
      ? familyLevelValue(fighter, { 攻陣I: 2.1, 攻陣II: 2.8, 攻陣III: 3.5 })
      : familyLevelValue(fighter, { 猛闘I: 2, 猛闘II: 2.5, 猛闘III: 3 })
  }
  if (turn <= 4 && (skillType === '能動' || skillType === '突撃') && hasBattleTrait(fighter, '物外軒')) {
    percent += 4.5
  }
  return percent / 100
}

/** 連歌百韻による、失敗した能動戦法の再抽選確率。 */
export const traitSkillRetryChance = (
  fighter: BattleFighter,
  skillType: string,
  unique: boolean,
): number => skillType === '能動' && hasBattleTrait(fighter, '連歌百韻') ? (unique ? 0.35 : 0.07) : 0

export interface TraitBattleRuntimeHelpers {
  log: (owner: BattleFighter, effect: string, message: string) => void
  statOf: (fighter: BattleFighter, stat: Stat) => number
  damage: (owner: BattleFighter, target: BattleFighter, amount: number, effect: string) => number
  heal: (owner: BattleFighter, target: BattleFighter, rate: number, kind: 'bravery' | 'strategy' | 'leadership', effect: string) => number
  control: (owner: BattleFighter, target: BattleFighter, name: string, duration: number, effect: string) => void
}

export interface TraitBattleRuntimeContext {
  owner: BattleFighter
  allies: BattleFighter[]
  enemies: BattleFighter[]
  turn: number
  rng: () => number
  helpers: TraitBattleRuntimeHelpers
}

const addTimedTraitStat = (
  target: BattleFighter,
  stat: Stat,
  value: number,
  turn: number,
  duration: number,
  key: string,
): void => {
  const old = target.timedModifiers.filter((modifier) => modifier.key === key)
  old.forEach((modifier) => {
    target.buffs[modifier.stat] = (target.buffs[modifier.stat] ?? 0) - modifier.value
  })
  target.timedModifiers = target.timedModifiers.filter((modifier) => modifier.key !== key)
  target.buffs[stat] = (target.buffs[stat] ?? 0) + value
  target.timedModifiers.push({
    key,
    stat,
    value,
    expiresTurn: turn + Math.max(1, duration),
    sourceSkill: key,
  })
}

const lowestHpAlly = (allies: BattleFighter[]): BattleFighter | null =>
  [...allies].filter((ally) => ally.hp > 0).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0] ?? null

/** 各武将の行動開始前に解決する特性。 */
export const runTraitBeforeAction = (ctx: TraitBattleRuntimeContext): void => {
  const { owner, turn, helpers } = ctx
  if (hasBattleTrait(owner, '越後の龍')) owner.specialState.echigoDragonReduction = 0
  if (hasBattleTrait(owner, '勇烈')) {
    addTimedTraitStat(owner, 'val', 14, turn, 1, '特性:勇烈')
    helpers.log(owner, '勇烈', `${owner.name}の武勇が14上昇（${helpers.statOf(owner, 'val').toFixed(2)}）`)
  }
  if (hasBattleTrait(owner, '独眼竜')) {
    const valor = helpers.statOf(owner, 'val')
    const intelligence = helpers.statOf(owner, 'int')
    const base = Math.max(1, Math.max(valor, intelligence))
    const differencePercent = Math.abs(valor - intelligence) / base * 100
    const maximum = owner.role === 'main' ? 15 : 10
    owner.specialState.oneEyedDragonDamageBonus = differencePercent > 20
      ? 0
      : maximum * (1 - differencePercent / 20)
    helpers.log(
      owner,
      '独眼竜',
      `${owner.name}の与ダメージが${owner.specialState.oneEyedDragonDamageBonus.toFixed(2)}%上昇`,
    )
  }
  if (hasBattleTrait(owner, '瓶割り') && turn >= 5) {
    owner.specialState.physicalLifeStealPercent = Math.max(owner.specialState.physicalLifeStealPercent ?? 0, 10)
    owner.specialState.physicalLifeStealUntil = 8
  }
}

/** 各武将の行動終了後に解決する特性。 */
export const runTraitAfterAction = (ctx: TraitBattleRuntimeContext): void => {
  const { owner, enemies, turn, rng, helpers } = ctx
  if (hasBattleTrait(owner, '越後の龍')) {
    owner.specialState.echigoDragonReduction = (owner.specialState.damageDealtTurn ?? 0) === turn ? 0 : 22
    if ((owner.specialState.echigoDragonReduction ?? 0) > 0) {
      helpers.log(owner, '越後の龍', `${owner.name}の被ダメージが次の行動時まで22%低下`)
    }
  }
  if (hasBattleTrait(owner, '魔王')) {
    enemies.filter((enemy) => enemy.hp > 0 && enemy.hp <= enemy.maxHp * 0.5).forEach((enemy) => {
      const key = `devilTriggered:${enemy.id}`
      if ((owner.specialState[key] ?? 0) > 0) return
      owner.specialState[key] = 1
      const loss = Math.max(1, Math.floor(enemy.hp * rng() * 0.05))
      helpers.damage(owner, enemy, loss, '魔王')
    })
  }
}

/** 通常攻撃が成立した直後に、攻撃者側の特性を処理する。 */
export const runTraitAfterNormalAttack = (
  ctx: TraitBattleRuntimeContext,
  target: BattleFighter,
): void => {
  const { owner, turn, rng, helpers } = ctx
  if (hasBattleTrait(owner, '三河武士') || (owner.specialState.mikawaWarriorChance ?? 0) > 0) {
    if (rng() < (owner.specialState.mikawaWarriorChance ?? 15) / 100) {
      owner.specialState.nextDamageReductionCharges = 1
      owner.specialState.nextDamageReductionPercent = 50
      helpers.log(owner, '三河武士', `${owner.name}の次回被ダメージが50%低下`)
    }
  }
  if (hasBattleTrait(owner, '赤備え') && (owner.specialState.redArmorTraitTriggered ?? 0) === 0) {
    owner.specialState.redArmorTraitTriggered = 1
    target.buffs.lea = (target.buffs.lea ?? 0) - 18
    helpers.log(owner, '赤備え', `${target.name}の統率が18低下（${helpers.statOf(target, 'lea').toFixed(2)}）`)
  }
  if (hasBattleTrait(owner, '波風') && (owner.specialState.waveIntStealStacks ?? 0) < 10 && rng() < 0.8) {
    owner.specialState.waveIntStealStacks = (owner.specialState.waveIntStealStacks ?? 0) + 1
    owner.buffs.int = (owner.buffs.int ?? 0) + 2
    target.buffs.int = (target.buffs.int ?? 0) - 2
    helpers.log(owner, '波風', `${target.name}から知略を2吸収（${owner.name}: ${helpers.statOf(owner, 'int').toFixed(2)}）`)
  }
  if (hasBattleTrait(owner, '近衛斉射') && rng() < 0.2) helpers.control(owner, target, '麻痺', 2, '近衛斉射')
  if (hasBattleTrait(owner, '側撃') && rng() < 0.14) helpers.control(owner, target, '疲弊', 1, '側撃')
  if (hasBattleTrait(owner, '姫武者')) {
    const attacks = (owner.specialState.princessWarriorAttacks ?? 0) + 1
    owner.specialState.princessWarriorAttacks = attacks
    if (attacks % 2 === 0 && (owner.specialState.princessWarriorStacks ?? 0) < 8) {
      owner.specialState.princessWarriorStacks = (owner.specialState.princessWarriorStacks ?? 0) + 1
      owner.buffs.physicalCriticalChance = (owner.buffs.physicalCriticalChance ?? 0) + 2
      helpers.log(owner, '姫武者', `${owner.name}の会心率が2%上昇（合計+${(owner.specialState.princessWarriorStacks * 2).toFixed(0)}%）`)
    }
  }
  owner.specialState.lastTraitNormalAttackTurn = turn
}

/** 通常攻撃を受けた直後に、防御側の特性を処理する。 */
export const runTraitNormalAttackReceived = (
  ctx: TraitBattleRuntimeContext,
  attacker: BattleFighter,
): void => {
  const { owner, turn, rng, helpers } = ctx
  owner.specialState.lastNormalAttackedTurn = turn
  if (hasBattleTrait(owner, '側撃')) owner.specialState.fatigueImmunityUntil = turn
  if (hasBattleTrait(owner, '雷の化身') && rng() < 0.2) helpers.control(owner, attacker, '麻痺', 1, '雷の化身')
  if (hasBattleTrait(owner, '金城鉄壁')) {
    const weakened = Object.keys(attacker.statuses).length > 0
      || ['lea', 'val', 'int', 'spd'].some((stat) => (attacker.buffs[stat as Stat] ?? 0) < 0)
    if (weakened && rng() < 0.3) helpers.heal(owner, owner, 52, 'leadership', '金城鉄壁')
  }
  if (hasBattleTrait(owner, '花枝招展') && (owner.specialState.flowerHealUses ?? 0) < 3) {
    const chance = Math.min(0.9, 0.45 + Math.max(0, helpers.statOf(owner, 'cha') - 100) * 0.001)
    if (rng() < chance) {
      owner.specialState.flowerHealUses = (owner.specialState.flowerHealUses ?? 0) + 1
      helpers.heal(owner, owner, 68, 'strategy', '花枝招展')
    }
  }
  if (hasBattleTrait(owner, '雄略絶倫') && (owner.specialState.heroicAbsorbStacks ?? 0) < 8) {
    const stat = primaryStat(owner)
    owner.specialState.heroicAbsorbStacks = (owner.specialState.heroicAbsorbStacks ?? 0) + 1
    owner.buffs[stat] = (owner.buffs[stat] ?? 0) + 2
    attacker.buffs[stat] = (attacker.buffs[stat] ?? 0) - 2
    helpers.log(owner, '雄略絶倫', `${attacker.name}から${stat === 'lea' ? '統率' : stat === 'val' ? '武勇' : '知略'}を2吸収`)
  }
}

/** 兵刃・計略ダメージを実際に与えた直後に処理する特性。 */
export const runTraitDamageDealt = (
  ctx: TraitBattleRuntimeContext,
  target: BattleFighter,
  kind: 'physical' | 'strategy',
  amount: number,
): void => {
  if (amount <= 0) return
  const { owner, allies, turn, rng, helpers } = ctx
  owner.specialState.damageDealtTurn = turn
  if (hasBattleTrait(owner, '方円の器') && kind === 'strategy' && turn >= 3) {
    const usedThisTurn = owner.specialState.squareVesselCheckedTurn === turn
    if (!usedThisTurn && (owner.specialState.squareVesselStacks ?? 0) < 2) {
      owner.specialState.squareVesselCheckedTurn = turn
      if (rng() < 0.5) {
        owner.specialState.squareVesselStacks = (owner.specialState.squareVesselStacks ?? 0) + 1
        allies.forEach((ally) => { ally.buffs.int = (ally.buffs.int ?? 0) + 5 })
        helpers.log(owner, '方円の器', `自軍全体の知略が5上昇（合計+${owner.specialState.squareVesselStacks * 5}）`)
      }
    }
  }
  if (hasBattleTrait(owner, '一番槍') && turn === 1 && (owner.specialState.firstSpearChecked ?? 0) === 0) {
    owner.specialState.firstSpearChecked = 1
    if (rng() < 0.5) {
      const stat = primaryStat(owner)
      owner.buffs[stat] = (owner.buffs[stat] ?? 0) + 18
      helpers.log(owner, '一番槍', `${owner.name}の主要属性が18上昇`)
    }
  }
  if (kind === 'physical' && hasBattleTrait(owner, '猪武者') && (owner.specialState.boarWarriorStacks ?? 0) < 6 && rng() < 0.6) {
    owner.specialState.boarWarriorStacks = (owner.specialState.boarWarriorStacks ?? 0) + 1
    owner.buffs.physicalCriticalChance = (owner.buffs.physicalCriticalChance ?? 0) + 1
    owner.specialState.traitCriticalDamageBonus = (owner.specialState.traitCriticalDamageBonus ?? 0) + 1
    helpers.log(owner, '猪武者', `${owner.name}の会心率・会心ダメージが1%上昇（合計+${owner.specialState.boarWarriorStacks}%）`)
  }
  if (kind === 'physical' && hasBattleTrait(owner, '坂東太郎') && (target.buffs.lea ?? 0) < 0 && rng() < 0.55) {
    addTimedTraitStat(owner, 'val', 8, turn, 2, `特性:坂東太郎:${Math.min(3, (owner.specialState.bandoStacks ?? 0) + 1)}`)
    owner.specialState.bandoStacks = Math.min(3, (owner.specialState.bandoStacks ?? 0) + 1)
    helpers.log(owner, '坂東太郎', `${owner.name}の武勇が8上昇`)
  }
  if (kind === 'physical' && (hasBattleTrait(owner, '姫家督') || hasBattleTrait(owner, '姫城督'))) {
    owner.specialState.princessCommanderPhysicalHits = (owner.specialState.princessCommanderPhysicalHits ?? 0) + 1
    if (owner.specialState.princessCommanderPhysicalHits % 6 === 0 && (owner.specialState.princessCommanderHealUses ?? 0) < 2) {
      const ally = lowestHpAlly(allies)
      if (ally) {
        owner.specialState.princessCommanderHealUses = (owner.specialState.princessCommanderHealUses ?? 0) + 1
        helpers.heal(owner, ally, 98, 'bravery', hasBattleTrait(owner, '姫城督') ? '姫城督' : '姫家督')
      }
    }
  }
}

/** ダメージを受けた直後に、防御側の特性を処理する。 */
export const runTraitDamageReceived = (
  ctx: TraitBattleRuntimeContext,
  attacker: BattleFighter,
  skillType: string | null,
  amount: number,
): void => {
  if (amount <= 0) return
  const { owner, helpers } = ctx
  if (
    skillType === '能動'
    && hasBattleTrait(owner, '老功古実')
    && (owner.specialState.oldMeritTriggered ?? 0) === 0
  ) {
    owner.specialState.oldMeritTriggered = 1
    attacker.buffs.int = (attacker.buffs.int ?? 0) - 15
    helpers.log(owner, '老功古実', `${attacker.name}の知略が15低下（${helpers.statOf(attacker, 'int').toFixed(2)}）`)
  }
}

/** 戦法回復が解決した直後に、回復者側の特性を処理する。 */
export const runTraitHealResolved = (
  ctx: TraitBattleRuntimeContext,
  target: BattleFighter,
  actual: number,
  attempted: number,
): void => {
  const { owner, enemies, turn, rng, helpers } = ctx
  if (hasBattleTrait(owner, '覇王') && attempted > 0) {
    const enemy = enemies.filter((candidate) => candidate.hp > 0).sort(() => rng() - 0.5)[0]
    if (enemy) helpers.damage(owner, enemy, Math.min(Math.round(actual * 0.1), Math.round(owner.hp * 0.1)), '覇王')
  }
  if (hasBattleTrait(owner, '人たらし') && target.id !== owner.id && attempted > actual && rng() < 0.5) {
    const stat = primaryStat(target)
    addTimedTraitStat(target, stat, 15, turn, 1, `特性:人たらし:${owner.id}`)
    helpers.log(owner, '人たらし', `${target.name}の主要属性が15上昇`)
  }
  if (hasBattleTrait(owner, '手足之愛') && target.id !== owner.id && owner.specialState.handFootHealTurn !== turn) {
    owner.specialState.handFootHealTurn = turn
    const value = helpers.statOf(target, primaryStat(target)) * 0.12
    addTimedTraitStat(owner, 'lea', value, turn, 1, '特性:手足之愛')
    helpers.log(owner, '手足之愛', `${owner.name}の統率が${value.toFixed(2)}上昇`)
  }
}

/** 制御付与前に特性耐性と淑徳の肩代わりを解決する。nullは無効化を表す。 */
export const resolveTraitControlTarget = (
  _caster: BattleFighter,
  originalTarget: BattleFighter,
  targetAllies: BattleFighter[],
  name: string,
  turn: number,
  rng: () => number,
  log: (owner: BattleFighter, effect: string, message: string) => void,
): BattleFighter | null => {
  let target = originalTarget
  if (turn <= 2 && originalTarget.role === 'main' && ['無策', '封撃', '混乱'].includes(name)) {
    const protector = targetAllies.find((ally) =>
      ally.id !== originalTarget.id
      && ally.hp > 0
      && hasBattleTrait(ally, '淑徳')
      && ally.specialState.virtuousRedirectTurn !== turn,
    )
    if (protector) {
      protector.specialState.virtuousRedirectTurn = turn
      if (rng() < 0.8) {
        target = protector
        log(protector, '淑徳', `${originalTarget.name}への${name}を${protector.name}が肩代わり`)
      }
    }
  }
  const resistance = (target.specialState.traitControlResistanceUntil ?? 0) >= turn
    ? target.specialState.traitControlResistanceChance ?? 0
    : 0
  if (resistance > 0 && rng() < resistance / 100) {
    log(target, '上下一心', `${target.name}が${name}を無効化`)
    return null
  }
  if (hasBattleTrait(target, '傾奇者') && rng() < 0.12) {
    log(target, '傾奇者', `${target.name}が${name}を無効化`)
    return null
  }
  if (hasBattleTrait(target, '先駆け') && turn <= 3 && (target.specialState.vanguardBlocks ?? 0) < 2 && rng() < 0.4) {
    target.specialState.vanguardBlocks = (target.specialState.vanguardBlocks ?? 0) + 1
    log(target, '先駆け', `${target.name}が${name}を無効化`)
    return null
  }
  return target
}

// ダメージ補正は100%を基準にし、同じ計算へ加わる汎用補正も含めた現在値を返す。
const currentDamagePercent = (fighter: BattleFighter, stat: Stat): number => {
  const commonDealt = fighter.buffs.damageDealt ?? 0
  const commonTaken = fighter.buffs.damageTaken ?? 0
  switch (stat) {
    case 'attackDamage':
      return 100 + commonDealt + (fighter.buffs.attackDamage ?? 0)
    case 'strategyDamageDealt':
      return 100 + commonDealt + (fighter.buffs.strategyDamageDealt ?? 0)
    case 'physicalDamageTaken':
      return 100 + commonTaken + (fighter.buffs.physicalDamageTaken ?? 0)
    case 'strategyDamageTaken':
      return 100 + commonTaken + (fighter.buffs.strategyDamageTaken ?? 0)
    default:
      return 100 + (fighter.buffs[stat] ?? 0)
  }
}

const damageChangeText = (
  target: BattleFighter,
  label: string,
  stat: Stat,
  value: number,
): string => {
  const direction = value >= 0 ? '上昇' : '低下'
  return `${target.name}の${label}が${Math.abs(value).toFixed(2)}%${direction}（${currentDamagePercent(target, stat).toFixed(2)}%）`
}

const addBaseStatPercent = (
  target: BattleFighter,
  stat: Stat,
  percent: number,
): number => {
  const value = Math.round((target.baseStats[stat] ?? 0) * percent) / 100
  target.buffs[stat] = (target.buffs[stat] ?? 0) + value
  return value
}

const primaryStat = (fighter: BattleFighter): Stat => {
  const candidates: Stat[] = ['lea', 'val', 'int']
  return candidates.sort((a, b) =>
    ((fighter.baseStats[b] ?? 0) + (fighter.buffs[b] ?? 0))
    - ((fighter.baseStats[a] ?? 0) + (fighter.buffs[a] ?? 0)),
  )[0]
}

const initializeNamedTrait = (
  fighter: BattleFighter,
  allies: BattleFighter[],
  trait: Trait,
  rng: () => number,
  log: (owner: BattleFighter, message: string) => void,
): void => {
  const name = traitName(trait)
  const logSelf = (message: string) => log(fighter, `${name}: ${message}`)
  const addAllStats = (target: BattleFighter, percent: number) => {
    ;(['lea', 'val', 'int', 'pol', 'cha', 'spd'] as Stat[]).forEach((stat) => addBaseStatPercent(target, stat, percent))
  }

  switch (name) {
    case '算盤勘定':
      fighter.buffs.val = (fighter.buffs.val ?? 0) + 16
      logSelf(`${fighter.name}の武勇が16上昇（${((fighter.baseStats.val ?? 0) + (fighter.buffs.val ?? 0)).toFixed(2)}）`)
      return
    case '築城名手':
      fighter.buffs.lea = (fighter.buffs.lea ?? 0) + 24
      logSelf(`${fighter.name}の統率が24上昇（${((fighter.baseStats.lea ?? 0) + (fighter.buffs.lea ?? 0)).toFixed(2)}）`)
      return
    case '人は城':
      allies.forEach((ally) => addBaseStatPercent(ally, 'lea', 5))
      logSelf('自軍全体の統率が5%上昇')
      return
    case '三矢家訓': {
      const values = ['lea', 'val', 'int'].map((stat) => fighter.baseStats[stat as Stat] ?? 0)
      if (new Set(values).size !== values.length) return
      ;(['lea', 'val', 'int'] as Stat[]).forEach((stat) => {
        fighter.buffs[stat] = (fighter.buffs[stat] ?? 0) + 8
      })
      logSelf(`${fighter.name}の統率・武勇・知略が8上昇`)
      return
    }
    case '短刀の契': {
      const commander = allies.find((ally) => ally.role === 'main' && ['男', '男性'].includes(ally.gender))
      if (!commander) return
      addAllStats(commander, 2)
      logSelf(`${commander.name}の全属性が2%上昇`)
      return
    }
    case '古狸': {
      const others = allies.filter((ally) => ally.id !== fighter.id)
      if (others.length === 2 && others[0].faction && others[0].faction === others[1].faction && others[0].faction !== fighter.faction) {
        fighter.faction = others[0].faction
        logSelf(`${fighter.name}の勢力を${fighter.faction}として扱う`)
      }
      return
    }
    case '老獪': {
      const commander = allies.find((ally) => ally.role === 'main')
      if (commander && commander.faction !== fighter.faction) {
        fighter.faction = commander.faction
        logSelf(`${fighter.name}の勢力を${fighter.faction}として扱う`)
      } else {
        fighter.specialState.strategyLifeStealPercent = (fighter.specialState.strategyLifeStealPercent ?? 0) + 8
        fighter.specialState.strategyLifeStealUntil = 8
        logSelf(`${fighter.name}が計略離反8%を獲得`)
      }
      return
    }
    case '求道': {
      const targetFaction = '雑賀本願寺'
      const convertible = allies.find((ally) => ally.id !== fighter.id && ally.faction !== targetFaction)
      if (convertible) {
        convertible.faction = targetFaction
        logSelf(`${convertible.name}の勢力を${targetFaction}として扱う`)
      } else {
        allies.forEach((ally) => {
          ally.buffs.strategyDamageTaken = (ally.buffs.strategyDamageTaken ?? 0) - 5
        })
        logSelf('自軍全体の計略被ダメージが5%低下')
      }
      return
    }
    case '善戦Ⅱ':
      fighter.buffs.physicalCriticalChance = (fighter.buffs.physicalCriticalChance ?? 0) + 2.9
      fighter.buffs.strategyCriticalChance = (fighter.buffs.strategyCriticalChance ?? 0) + 2.9
      logSelf(`${fighter.name}の会心率・奇策率が2.90%上昇`)
      return
    case '尽力Ⅰ':
    case '尽力Ⅱ':
    case '尽力Ⅲ': {
      const value = name === '尽力Ⅰ' ? 3 : name === '尽力Ⅱ' ? 4 : 5
      fighter.buffs.physicalCriticalChance = (fighter.buffs.physicalCriticalChance ?? 0) + value
      logSelf(`${fighter.name}の会心率が${value.toFixed(2)}%上昇`)
      return
    }
    case '心尽Ⅰ':
      fighter.buffs.strategyCriticalChance = (fighter.buffs.strategyCriticalChance ?? 0) + 4
      logSelf(`${fighter.name}の奇策率が4.00%上昇`)
      return
    case '気勢Ⅰ':
    case '気勢Ⅱ':
    case '気勢Ⅲ':
    case '高揚Ⅱ': {
      const value = name === '気勢Ⅰ' ? 4.5 : name === '気勢Ⅱ' ? 6 : name === '気勢Ⅲ' ? 7.5 : 3.8
      fighter.specialState.traitCriticalDamageBonus = (fighter.specialState.traitCriticalDamageBonus ?? 0) + value
      logSelf(`${fighter.name}の会心・奇策ダメージが${value.toFixed(2)}%上昇`)
      return
    }
    case '妙計Ⅱ':
      fighter.specialState.strategyCriticalDamageBonus = (fighter.specialState.strategyCriticalDamageBonus ?? 0) + 8.5
      logSelf(`${fighter.name}の奇策ダメージが8.50%上昇`)
      return
    case '四州の雄':
      allies.forEach((ally) => {
        ally.specialState.normalAttackDamageBonus = (ally.specialState.normalAttackDamageBonus ?? 0) + 6
      })
      logSelf('自軍全体の通常攻撃ダメージが6%上昇')
      return
    case '三河武士':
      allies.forEach((ally) => { ally.specialState.mikawaWarriorChance = Math.max(ally.specialState.mikawaWarriorChance ?? 0, 15) })
      logSelf('自軍全体へ通常攻撃後15%の被ダメージ軽減判定を付与')
      return
    case '清濁併呑':
      fighter.specialState.normalAttackNullifyChance = Math.max(fighter.specialState.normalAttackNullifyChance ?? 0, 25)
      logSelf(`${fighter.name}が通常攻撃無効化25%を獲得`)
      return
    case '上下一心': {
      const count = Math.min(allies.length, 2 + (rng() < 0.5 ? 0 : 1))
      ;[...allies].sort(() => rng() - 0.5).slice(0, count).forEach((ally) => {
        ally.specialState.traitControlResistanceUntil = 1
        ally.specialState.traitControlResistanceChance = Math.max(ally.specialState.traitControlResistanceChance ?? 0, 30)
      })
      logSelf(`第1ターンに自軍${count}名が制御耐性30%を獲得`)
      return
    }
    case '鳳凰':
      fighter.buffs.damageTaken = (fighter.buffs.damageTaken ?? 0) + 1.5
      fighter.specialState.phoenixLethalGuard = 1
      logSelf(`${fighter.name}の被ダメージが1.50%上昇し、第3ターン以降の致死ダメージ無効を獲得`)
      return
    case '玄謀':
      if (fighter.role === 'main') {
        fighter.specialState.skillEvasionChance = Math.max(fighter.specialState.skillEvasionChance ?? 0, 3)
        fighter.specialState.skillEvasionUntil = 8
        logSelf(`${fighter.name}が回避3%を獲得`)
      }
      return
    default:
      return
  }
}

export const traitBattleEffectDetail = (trait: Trait): string | null => {
  const named = IMPLEMENTED_NAMED_TRAIT_EFFECTS[traitName(trait)]
  if (named) return named
  const parsed = parseTraitSeries(trait)
  if (!parsed) return null
  const effect = STATIC_TRAIT_EFFECTS[parsed.family]
  const value = effect?.values[parsed.level]
  if (!effect || value == null) return null
  const target = effect.target === 'allies' ? '自軍全体' : '自身'
  return `${target}の${effect.label}${signedPercent(value)}`
}

export const initializeTraitBattle = (
  fighter: BattleFighter,
  allies: BattleFighter[],
  log: (owner: BattleFighter, message: string) => void,
  rng: () => number = Math.random,
): void => {
  fighter.traits.forEach((trait) => {
    initializeNamedTrait(fighter, allies, trait, rng, log)
    const parsed = parseTraitSeries(trait)
    if (!parsed) return
    const effect = STATIC_TRAIT_EFFECTS[parsed.family]
    const configuredValue = effect?.values[parsed.level]
    if (!effect || configuredValue == null) return

    const targets = effect.target === 'allies' ? allies : [fighter]
    targets.forEach((target) => {
      // 属性割合は対象本人の戦闘開始時基礎値から、実際に加算する値へ変換する。
      const appliedValue = effect.percentOfBaseStat
        ? Math.round((target.baseStats[effect.stat] ?? 0) * configuredValue) / 100
        : configuredValue
      target.buffs[effect.stat] = (target.buffs[effect.stat] ?? 0) + appliedValue

      const displayName = trait.name_jp || trait.name
      if (effect.percentOfBaseStat) {
        const after = (target.baseStats[effect.stat] ?? 0) + (target.buffs[effect.stat] ?? 0)
        log(fighter, `${displayName}: ${target.name}の${effect.label}が${appliedValue.toFixed(2)}上昇（${after.toFixed(2)}）`)
      } else {
        log(fighter, `${displayName}: ${damageChangeText(target, effect.label, effect.stat, configuredValue)}`)
      }
    })
  })
}
