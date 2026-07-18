/**
 * Shared trait constants used by both LineupSlot (breakthrough gating)
 * and useTroopLevels (team-level aggregation).
 */

/** Breakthrough stars required to unlock each trait slot (index 0-3). */
export const TRAIT_UNLOCK = [0, 1, 3, 5] as const

/** The five troop types in fixed display order. */
export const TROOP_TYPES = ['足軽', '弓兵', '騎兵', '鉄砲', '器械'] as const
export type TroopType = (typeof TROOP_TYPES)[number]

const TROOP_TYPE_ALIASES: Record<string, TroopType> = {
  '足輕': '足軽',
  '足軽': '足軽',
  '弓兵': '弓兵',
  '騎兵': '騎兵',
  '鐵炮': '鉄砲',
  '鉄砲': '鉄砲',
  '器械': '器械',
}

export const normalizeTroopType = (value: string): TroopType | null => TROOP_TYPE_ALIASES[value] ?? null

/** Short display labels for troop chips (2 chars max). */
export const TROOP_LABELS: Record<TroopType, string> = {
  '足軽': '歩',
  '弓兵': '弓',
  '騎兵': '騎',
  '鉄砲': '砲',
  '器械': '器',
}
