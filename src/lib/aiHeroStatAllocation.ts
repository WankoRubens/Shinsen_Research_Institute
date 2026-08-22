import type { Hero, Skill } from '../composables/useData'
import { heroLevel50Stats, type HeroStatBlock, type HeroStatKey } from './heroStats'

type AllocationRule =
  | { mode: 'single'; stat: HeroStatKey }
  | { mode: 'balance'; stats: [HeroStatKey, HeroStatKey] }
  | { mode: 'higher'; stats: [HeroStatKey, HeroStatKey] }

const COMBAT_STATS: HeroStatKey[] = ['lea', 'val', 'int', 'spd']

// 説明文だけでは主効果と副効果の優先度を決められない固有戦法はここで指定する。
// 武将名・固有戦法名のどちらでも照合するため、データ側の表記揺れにも対応できる。
const UNIQUE_SKILL_ALLOCATION_RULES: Record<string, AllocationRule> = {
  伊達政宗: { mode: 'balance', stats: ['val', 'int'] },
  伊達風采: { mode: 'balance', stats: ['val', 'int'] },
  伊達の粋: { mode: 'balance', stats: ['val', 'int'] },
  織田信長: { mode: 'single', stat: 'lea' },
  新生: { mode: 'single', stat: 'lea' },
}

const STAT_LABELS: Array<{ stat: HeroStatKey; pattern: RegExp }> = [
  { stat: 'lea', pattern: /統率/ },
  { stat: 'val', pattern: /武勇|武力/ },
  { stat: 'int', pattern: /知略|知力|智略/ },
  { stat: 'pol', pattern: /政治/ },
  { stat: 'cha', pattern: /魅力/ },
  { stat: 'spd', pattern: /速度/ },
]

const skillText = (skill: Skill | null | undefined): string => [
  skill?.description_jp,
  skill?.brief_description_jp,
  skill?.commander_description_jp,
  skill?.description,
  skill?.brief_description,
  skill?.commander_description,
].filter(Boolean).join(' ')

const explicitRule = (hero: Hero, skill: Skill | null | undefined): AllocationRule | null => {
  const keys = [hero.name_jp, hero.name, skill?.name_jp, skill?.name].filter(Boolean) as string[]
  for (const key of keys) {
    const rule = UNIQUE_SKILL_ALLOCATION_RULES[key]
    if (rule) return rule
  }
  return null
}

const statsInClause = (clause: string): HeroStatKey[] =>
  STAT_LABELS.filter(({ pattern }) => pattern.test(clause)).map(({ stat }) => stat)

/**
 * 固有戦法の日本語説明から、追加属性ポイントの配分方針を決める。
 * 「高い方に依存」は元から高い側、複数属性への同時依存は差が小さくなる配分にする。
 */
const inferRule = (hero: Hero, skill: Skill | null | undefined, base: HeroStatBlock): AllocationRule => {
  const fixed = explicitRule(hero, skill)
  if (fixed) return fixed

  const text = skillText(skill)
  if (/(?:武勇|武力)と(?:知略|知力|智略)の高い方|(?:武勇|武力)、(?:知略|知力|智略)の高い方/.test(text)) {
    return { mode: 'higher', stats: ['val', 'int'] }
  }

  // 最初に現れる「○○依存」の節を主効果とみなし、後半の大将技などに引っ張られないようにする。
  for (const match of text.matchAll(/[^。！？\n]{0,48}依存/g)) {
    const stats = statsInClause(match[0])
    if (stats.length === 1) return { mode: 'single', stat: stats[0] }
    if (stats.length >= 2) return { mode: 'balance', stats: [stats[0], stats[1]] }
  }

  // 「対応属性依存」など、兵刃と計略をそれぞれの能力で参照する説明を補う。
  const hasPhysical = /兵刃(?:与)?ダメージ/.test(text)
  const hasStrategy = /(?:計略|謀略)(?:与)?ダメージ/.test(text)
  if (hasPhysical && hasStrategy) return { mode: 'balance', stats: ['val', 'int'] }
  if (hasPhysical) return { mode: 'single', stat: 'val' }
  if (hasStrategy || /回復/.test(text)) return { mode: 'single', stat: 'int' }

  // 依存属性が明記されていない場合もポイントを余らせず、元から最も高い戦闘属性を伸ばす。
  const highest = COMBAT_STATS.reduce((best, stat) => base[stat] > base[best] ? stat : best)
  return { mode: 'single', stat: highest }
}

const allocateBalanced = (
  stats: HeroStatBlock,
  pair: [HeroStatKey, HeroStatKey],
  points: number,
): void => {
  // 1ポイントずつ低い側へ振ることで、小数を含む初期値でも最終差を最小にする。
  for (let point = 0; point < points; point += 1) {
    const target = stats[pair[0]] <= stats[pair[1]] ? pair[0] : pair[1]
    stats[target] += 1
  }
}

/**
 * AI探索で自動選出された武将へ、Lv50の基礎値に加えて50+凸数×10ポイントを配分する。
 */
export const autoAllocatedHeroStats = (
  hero: Hero,
  uniqueSkill: Skill | null | undefined,
  breakthrough: number,
): HeroStatBlock => {
  const stats = { ...heroLevel50Stats(hero) }
  const points = 50 + Math.max(0, Math.min(5, Math.trunc(breakthrough))) * 10
  const rule = inferRule(hero, uniqueSkill, stats)

  if (rule.mode === 'single') {
    stats[rule.stat] += points
    return stats
  }

  if (rule.mode === 'higher') {
    const target = stats[rule.stats[0]] >= stats[rule.stats[1]] ? rule.stats[0] : rule.stats[1]
    stats[target] += points
    return stats
  }

  allocateBalanced(stats, rule.stats, points)
  return stats
}
