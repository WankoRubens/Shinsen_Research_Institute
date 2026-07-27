import type { Hero } from '../composables/useData'
import type { Lineup } from '../composables/useLineups'
import {
  TRAIT_UNLOCK,
  TROOP_TYPES,
  normalizeTroopType,
  type TroopType,
} from '../constants/traits'

export const BASE_TROOP_LEVEL_CAP = 10
export const TROOP_LEVEL_STAT_RATE = 0.02

const addHeroLookupKey = (
  lookup: Map<string, Hero>,
  key: string | null | undefined,
  hero: Hero,
): void => {
  if (key) lookup.set(key, hero)
}

const heroLookupFor = (heroes: readonly Hero[]): Map<string, Hero> => {
  const lookup = new Map<string, Hero>()
  for (const hero of heroes) {
    addHeroLookupKey(lookup, hero.name, hero)
    addHeroLookupKey(lookup, hero.name_jp, hero)
    hero.aliases?.forEach(alias => addHeroLookupKey(lookup, alias, hero))
  }
  return lookup
}

/**
 * Aggregate the five troop levels for a lineup.
 *
 * The optional catalogue lets UI callers replace stale saved Hero references
 * with the current database object. The battle engine can omit it because its
 * lineup builders already assign canonical Hero objects.
 */
export const calculateTroopLevels = (
  lineup: Lineup,
  heroCatalog: readonly Hero[] = [],
): Record<TroopType, number> => {
  const lookup = heroLookupFor(heroCatalog)
  const sums = Object.fromEntries(
    TROOP_TYPES.map(troopType => [troopType, { level: 0, capBonus: 0 }]),
  ) as Record<TroopType, { level: number; capBonus: number }>

  for (const role of [lineup.main, lineup.vice1, lineup.vice2]) {
    const selectedHero = role.hero
    if (!selectedHero) continue
    const hero = lookup.get(selectedHero.name)
      ?? lookup.get(selectedHero.name_jp ?? '')
      ?? selectedHero

    hero.traits?.forEach((trait, index) => {
      if (index >= TRAIT_UNLOCK.length || role.breakthrough < TRAIT_UNLOCK[index]) return
      if (!trait.affinity) return
      for (const rawTroopType of trait.affinity.troop_types) {
        const troopType = normalizeTroopType(rawTroopType)
        if (!troopType) continue
        sums[troopType].level += Math.max(0, Number(trait.affinity.level) || 0)
        sums[troopType].capBonus += Math.max(0, Number(trait.affinity.level_cap_bonus) || 0)
      }
    })
  }

  return Object.fromEntries(
    TROOP_TYPES.map(troopType => [
      troopType,
      Math.min(
        sums[troopType].level,
        BASE_TROOP_LEVEL_CAP + sums[troopType].capBonus,
      ),
    ]),
  ) as Record<TroopType, number>
}

export const selectedTroopLevel = (
  lineup: Lineup,
  heroCatalog: readonly Hero[] = [],
): number => {
  const troopType = lineup.troopType
  if (!troopType) return 0
  return calculateTroopLevels(lineup, heroCatalog)[troopType] ?? 0
}

/** Lv1 = 1.02x, Lv6 = 1.12x, Lv10 = 1.20x. */
export const selectedTroopStatMultiplier = (
  lineup: Lineup,
  heroCatalog: readonly Hero[] = [],
): number => 1 + selectedTroopLevel(lineup, heroCatalog) * TROOP_LEVEL_STAT_RATE
