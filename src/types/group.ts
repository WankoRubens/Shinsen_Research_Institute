// Phase 2 type-layer for the dual-mode lineup model.
//
// Two modes:
//   - 編組 (Group): a set of up to 5 teams sharing a hero/skill uniqueness
//     constraint — mirrors what the user actually owns in the live game.
//   - 配將提案 (Proposal): a single team frozen as a snapshot, optionally
//     made public for community sharing/voting/import. No uniqueness
//     constraint vs. anything else (theory-craft).
//
// `Lineup` (= Team) lives in useLineups; we only re-export the alias here so
// upstream consumers can read intent without ambient cross-imports.
import type { Lineup } from '../composables/useLineups'

/** Alias: a Team is one Lineup. Use Team in group/proposal contexts where
 *  "Lineup" reads ambiguously. */
export type Team = Lineup

/**
 * A 編組 holds up to MAX_TEAMS_PER_GROUP teams. Within a group, a hero or
 * skill may appear in at most one team — this enforces the inventory truth
 * that you can't put 黒田官兵衛 in two teams simultaneously when you only own
 * one copy.
 *
 * The 10 limit matches the existing `lineups` array length so all current
 * users fit a single default group on migration without truncation.
 */
export interface Group {
  id: string
  name: string
  teams: Team[]
}

export const MAX_TEAMS_PER_GROUP = 10

/**
 * A 配將提案 is a snapshot of a single team. Snapshots are intentionally
 * data-redundant (we copy hero/skill names, not just ids) so a future
 * pipeline rename of a hero/skill doesn't retroactively mutate the proposal.
 *
 * `isPublic` defaults false — the share toggle in the create dialog defaults
 * to private and only lifts to public when the user opts in.
 */
export interface Proposal {
  id: string
  /** Free-text label, max ~50 chars (UI-enforced). */
  name: string
  /** Optional short rationale. */
  description: string
  /** Frozen team payload — same shape as Lineup but with snapshot semantics. */
  team: Team
  /** False = private (only owner sees it); True = public (listed on the proposal feed). */
  isPublic: boolean
  /** Author's user_id from Supabase auth, null for anonymous local-only proposals. */
  authorId: string | null
  /** Author display name at the time of share (frozen). */
  authorName: string | null
  /** Vote count, denormalized; source of truth is proposal_votes table. */
  voteCount: number
  /** ISO timestamps. */
  createdAt: string
  updatedAt: string
  /** Optional reference to a parent proposal this was forked from. */
  forkedFrom: string | null
}

