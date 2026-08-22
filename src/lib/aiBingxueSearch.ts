import type { BingxueActive, BingxueMinor } from '../composables/useLineups'
import { BINGXUE_DIRECTIONS, type Hero } from '../composables/useData'

const BINGXUE_POINT_BUDGET = 5
const MAX_MINOR_LEVEL = 2
const patternCache = new WeakMap<Hero, BingxueActive[]>()
const patternCountCache = new WeakMap<Hero, number>()

export const cloneAiBingxue = (value: BingxueActive): BingxueActive => ({
  direction: value.direction,
  major: value.major,
  minors: value.minors.map((minor) => ({ ...minor })),
})

export const hasConfiguredAiBingxue = (value: BingxueActive): boolean =>
  Boolean(value.direction && value.major)

// 副兵法は各Lv IIまで、合計5点をすべて使い切る設定だけを全列挙する。
// 未使用ポイントを残した構成は、同じ選択の上位Lv構成より不利なのでAI候補から省く。
const buildMinorPatterns = (names: string[]): BingxueMinor[][] => {
  const uniqueNames = [...new Set(names.filter(Boolean))]
  const patterns: BingxueMinor[][] = []
  const selected: BingxueMinor[] = []

  const visit = (index: number, remaining: number): void => {
    if (remaining === 0) {
      patterns.push(selected.map((minor) => ({ ...minor })))
      return
    }
    if (index >= uniqueNames.length) return
    if ((uniqueNames.length - index) * MAX_MINOR_LEVEL < remaining) return

    const name = uniqueNames[index]
    if (!name) return
    const maxLevel = Math.min(MAX_MINOR_LEVEL, remaining)
    for (let level = 0; level <= maxLevel; level += 1) {
      if (level > 0) selected.push({ name, level: level as 1 | 2 })
      visit(index + 1, remaining - level)
      if (level > 0) selected.pop()
    }
  }

  visit(0, BINGXUE_POINT_BUDGET)
  return patterns
}

const countMinorPatterns = (minorCount: number): number => {
  let count = 0
  const visit = (index: number, remaining: number): void => {
    if (remaining === 0) {
      count += 1
      return
    }
    if (index >= minorCount || (minorCount - index) * MAX_MINOR_LEVEL < remaining) return
    for (let level = 0; level <= Math.min(MAX_MINOR_LEVEL, remaining); level += 1) {
      visit(index + 1, remaining - level)
    }
  }
  visit(0, BINGXUE_POINT_BUDGET)
  return count
}

export const aiBingxuePatternCountForHero = (hero: Hero): number => {
  const cached = patternCountCache.get(hero)
  if (cached !== undefined) return cached
  let count = 0
  for (const direction of BINGXUE_DIRECTIONS) {
    const options = hero.bingxue?.[direction]
    if (!options) continue
    const majorCount = new Set(options.major.filter(Boolean)).size
    const minorCount = new Set(options.minor.filter(Boolean)).size
    count += majorCount * countMinorPatterns(minorCount)
  }
  patternCountCache.set(hero, count)
  return count
}

// 武将に開放されている全系統について、主兵法と副兵法5点の直積を返す。
export const aiBingxuePatternsForHero = (hero: Hero): BingxueActive[] => {
  const cached = patternCache.get(hero)
  if (cached) return cached

  const patterns: BingxueActive[] = []
  for (const direction of BINGXUE_DIRECTIONS) {
    const options = hero.bingxue?.[direction]
    if (!options) continue
    const majors = [...new Set(options.major.filter(Boolean))]
    const minorPatterns = buildMinorPatterns(options.minor)
    for (const major of majors) {
      for (const minors of minorPatterns) {
        patterns.push({
          direction,
          major,
          minors: minors.map((minor) => ({ ...minor })),
        })
      }
    }
  }

  patternCache.set(hero, patterns)
  patternCountCache.set(hero, patterns.length)
  return patterns
}

export const randomAiBingxueForHero = (hero: Hero): BingxueActive => {
  const patterns = aiBingxuePatternsForHero(hero)
  if (patterns.length === 0) return { direction: null, major: null, minors: [] }
  const selected = patterns[Math.floor(Math.random() * patterns.length)]
  return selected ? cloneAiBingxue(selected) : { direction: null, major: null, minors: [] }
}
