/**
 * Reactive team-level troop type aggregation.
 *
 * Aggregates troop affinity across all 3 heroes in a lineup,
 * respecting breakthrough-gated trait activation.
 *
 * Formula: effective = min(sum_levels, BASE_TROOP_LEVEL_CAP + cap bonuses)
 */

import { computed, type Ref, type ComputedRef } from 'vue'
import type { Lineup } from './useLineups'
import { TRAIT_UNLOCK, TROOP_TYPES, normalizeTroopType, type TroopType } from '../constants/traits'

export const BASE_TROOP_LEVEL_CAP = 10

export function useTroopLevels(lineup: Ref<Lineup> | ComputedRef<Lineup>) {
  return computed<Record<TroopType, number>>(() => {
    const sums: Record<TroopType, { lv: number; cap: number }> = {} as any
    for (const tt of TROOP_TYPES) {
      sums[tt] = { lv: 0, cap: 0 }
    }

    for (const role of [lineup.value.main, lineup.value.vice1, lineup.value.vice2]) {
      if (!role.hero?.traits) continue
      role.hero.traits.forEach((t, i) => {
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
