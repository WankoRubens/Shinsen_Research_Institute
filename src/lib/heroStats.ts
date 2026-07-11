import { HERO_STAT_GROWTH, type HeroStatBlock, type HeroStatGrowthEntry, type HeroStatKey } from '../data/heroStatGrowth'

export { type HeroStatBlock, type HeroStatGrowthEntry, type HeroStatKey }

const STAT_KEYS: HeroStatKey[] = ['lea', 'val', 'int', 'pol', 'cha', 'spd']
const DEFAULT_STATS: HeroStatBlock = { lea: 100, val: 100, int: 100, pol: 100, cha: 100, spd: 100 }

export interface HeroLikeForStats {
  name?: string | null
  name_jp?: string | null
  aliases?: string[]
  stats?: Partial<HeroStatBlock> | null
}

const roundStat = (value: number): number => Math.round(value * 100) / 100

const candidateNames = (hero: HeroLikeForStats): string[] => [
  hero.name_jp,
  hero.name,
  ...(hero.aliases ?? []),
].filter((value): value is string => Boolean(value))

export const heroStatGrowthEntry = (hero: HeroLikeForStats | null | undefined): HeroStatGrowthEntry | null => {
  if (!hero) return null
  for (const name of candidateNames(hero)) {
    const entry = HERO_STAT_GROWTH[name]
    if (entry) return entry
  }
  return null
}

export const heroStatsAtLevel = (
  hero: HeroLikeForStats | null | undefined,
  level = 50,
): HeroStatBlock => {
  const entry = heroStatGrowthEntry(hero)
  if (entry) {
    const stats = {} as HeroStatBlock
    for (const key of STAT_KEYS) {
      stats[key] = roundStat(entry.level1[key] + entry.growth[key] * (level - 1))
    }
    return stats
  }

  const fallback = hero?.stats ?? {}
  return {
    lea: Number(fallback.lea ?? DEFAULT_STATS.lea),
    val: Number(fallback.val ?? DEFAULT_STATS.val),
    int: Number(fallback.int ?? DEFAULT_STATS.int),
    pol: Number(fallback.pol ?? DEFAULT_STATS.pol),
    cha: Number(fallback.cha ?? DEFAULT_STATS.cha),
    spd: Number(fallback.spd ?? DEFAULT_STATS.spd),
  }
}

export const heroLevel50Stats = (hero: HeroLikeForStats | null | undefined): HeroStatBlock =>
  heroStatsAtLevel(hero, 50)

export const withHeroLevel50Stats = <T extends HeroLikeForStats>(hero: T): T => ({
  ...hero,
  stats: heroLevel50Stats(hero),
})
