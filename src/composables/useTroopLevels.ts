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
import { useData } from './useData'
import type { TroopType } from '../constants/traits'
import { calculateTroopLevels } from '../lib/troopLevels'

export { BASE_TROOP_LEVEL_CAP } from '../lib/troopLevels'

// Route changes explicitly bump this revision. In normal editing, Vue tracks
// lineup mutations directly; the revision also covers catalogue replacement
// during development/HMR without requiring a full browser reload.
const troopLevelRevision = ref(0)

export const refreshTroopLevels = (): void => {
  troopLevelRevision.value += 1
}

export function useTroopLevels(lineup: Ref<Lineup> | ComputedRef<Lineup>) {
  const { heroes } = useData()

  return computed<Record<TroopType, number>>(() => {
    // Keep the latest catalogue object as the source of trait data. A lineup
    // restored before a data/HMR update can otherwise retain an older Hero
    // object until the entire page is reloaded.
    troopLevelRevision.value
    return calculateTroopLevels(lineup.value, heroes.value)
  })
}
