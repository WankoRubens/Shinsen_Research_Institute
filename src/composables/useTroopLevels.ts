/**
 * Reactive team-level troop type aggregation.
 *
 * Aggregates troop affinity across all 3 heroes in a lineup,
 * respecting breakthrough-gated trait activation.
 *
 * Formula: effective = min(sum_levels, BASE_TROOP_LEVEL_CAP + cap bonuses)
 */

import { computed, ref, type Ref, type ComputedRef } from 'vue'
import type { Lineup } from './useLineups'
import { useData, type Hero } from './useData'
import { TRAIT_UNLOCK, TROOP_TYPES, normalizeTroopType, type TroopType } from '../constants/traits'

export const BASE_TROOP_LEVEL_CAP = 10

// Route changes explicitly bump this revision. In normal editing, Vue tracks
// lineup mutations directly; the revision also covers catalogue replacement
// during development/HMR without requiring a full browser reload.
const troopLevelRevision = ref(0)

export const refreshTroopLevels = (): void => {
  troopLevelRevision.value += 1
}

const addHeroLookupKey = (lookup: Map<string, Hero>, key: string | null | undefined, hero: Hero): void => {
  if (key) lookup.set(key, hero)
}

export function useTroopLevels(lineup: Ref<Lineup> | ComputedRef<Lineup>) {
  const { heroes } = useData()

  return computed<Record<TroopType, number>>(() => {
    // Keep the latest catalogue object as the source of trait data. A lineup
    // restored before a data/HMR update can otherwise retain an older Hero
    // object until the entire page is reloaded.
    troopLevelRevision.value
    const heroLookup = new Map<string, Hero>()
    for (const hero of heroes.value) {
      addHeroLookupKey(heroLookup, hero.name, hero)
      addHeroLookupKey(heroLookup, hero.name_jp, hero)
      hero.aliases?.forEach(alias => addHeroLookupKey(heroLookup, alias, hero))
    }

    const sums: Record<TroopType, { lv: number; cap: number }> = {} as any
    for (const tt of TROOP_TYPES) {
      sums[tt] = { lv: 0, cap: 0 }
    }

    for (const role of [lineup.value.main, lineup.value.vice1, lineup.value.vice2]) {
      const selectedHero = role.hero
      if (!selectedHero) continue
      const hero = heroLookup.get(selectedHero.name)
        ?? heroLookup.get(selectedHero.name_jp ?? '')
        ?? selectedHero
      if (!hero.traits) continue
      hero.traits.forEach((t, i) => {
        // Trait slot i only active if breakthrough >= TRAIT_UNLOCK[i]
        if (i >= TRAIT_UNLOCK.length || role.breakthrough < TRAIT_UNLOCK[i]) return
        if (!t.affinity) return
        for (const rawTroopType of t.affinity.troop_types) {
          const tt = normalizeTroopType(rawTroopType)
          if (!tt) continue
          if (tt in sums) {
            sums[tt].lv += Math.max(0, Number(t.affinity.level) || 0)
            sums[tt].cap += Math.max(0, Number(t.affinity.level_cap_bonus) || 0)
          }
        }
      })
    }

    const result = {} as Record<TroopType, number>
    for (const tt of TROOP_TYPES) {
      result[tt] = Math.min(sums[tt].lv, BASE_TROOP_LEVEL_CAP + sums[tt].cap)
    }
    return result
  })
}
