import type { Stat, Trait } from '../composables/useData'
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

export const traitBattleEffectDetail = (trait: Trait): string | null => {
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
): void => {
  fighter.traits.forEach((trait) => {
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
    })

    const displayName = trait.name_jp || trait.name
    if (effect.percentOfBaseStat) {
      const appliedValue = Math.round((fighter.baseStats[effect.stat] ?? 0) * configuredValue) / 100
      const after = (fighter.baseStats[effect.stat] ?? 0) + (fighter.buffs[effect.stat] ?? 0)
      log(fighter, `${displayName}: ${effect.label}+${appliedValue.toFixed(2)}（${after.toFixed(2)}）`)
      return
    }
    const targetLabel = effect.target === 'allies' ? '自軍全体の' : ''
    log(fighter, `${displayName}: ${targetLabel}${effect.label}${signedPercent(configuredValue)}`)
  })
}
