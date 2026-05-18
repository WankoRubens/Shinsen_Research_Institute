// Personal-collection state for the 我的提案 surface.
//
// The public feed and voting now live in `useVariants` (canonical hash-based
// model). This composable retains only the my-drafts surface: list / create
// / toggle public/private. Toggling public/private fans out to submit_variant
// / withdraw_variant so the variant pool stays in sync with proposal state.
//
// Functions removed in the variant-first migration:
//   - publicProposals / refreshPublic / loadMorePublic  → use useVariants
//   - vote / myVotes / applyVoteDeltas                  → variants are voted
//   - remove (proposal delete)                          → not surfaced in UI
//
// LineupBuilder consumes only createFromLineup; ProposalsView consumes
// myProposals / loadingMine / refreshMine / togglePublic.

import { ref } from 'vue'
import type { Proposal } from '../types/group'
import type { Lineup } from './useLineups'
import { snapshotTeam } from '../lib/lineup'
import {
  createProposal as remoteCreate,
  updateProposal as remoteUpdate,
  listMyProposals,
  isProposalsEnabled,
} from '../lib/proposals'
import {
  submitVariant,
  withdrawVariant,
  findVariantForTeam,
} from '../lib/variants'

const myProposals = ref<Proposal[]>([])
const loadingMine = ref(false)
const lastError = ref<string | null>(null)

export function useProposals() {
  const refreshMine = async (): Promise<void> => {
    if (!isProposalsEnabled()) return
    loadingMine.value = true
    lastError.value = null
    try {
      myProposals.value = await listMyProposals()
    } catch (e) {
      lastError.value = e instanceof Error ? e.message : String(e)
    } finally {
      loadingMine.value = false
    }
  }

  const createFromLineup = async (
    lineup: Lineup,
    opts: { name: string; isPublic: boolean; authorName?: string | null; forkedFrom?: string | null },
  ): Promise<Proposal> => {
    const team = snapshotTeam(lineup)
    // Centralize the 10-char display-name cap here so every create path gets
    // the same stored author_name without callers having to remember.
    const authorName = opts.authorName ? opts.authorName.slice(0, 10) : opts.authorName ?? null
    const created = await remoteCreate({ ...opts, authorName, team })
    if (opts.isPublic) {
      try { await submitVariant(team, authorName) }
      catch (e) { console.warn('submitVariant during create failed:', e) }
    }
    myProposals.value = [created, ...myProposals.value]
    return created
  }

  // Toggling visibility keeps the variant pool in sync: public → submit
  // (idempotent), private → withdraw if a matching variant exists. Variant
  // sync errors are non-fatal; the proposal flip already succeeded.
  const togglePublic = async (id: string, isPublic: boolean): Promise<void> => {
    const updated = await remoteUpdate(id, { isPublic })
    const idx = myProposals.value.findIndex(p => p.id === id)
    if (idx >= 0) myProposals.value[idx] = updated
    try {
      if (isPublic) {
        const authorName = updated.authorName ? updated.authorName.slice(0, 10) : null
        await submitVariant(updated.team, authorName)
      } else {
        const variantId = await findVariantForTeam(updated.team)
        if (variantId) await withdrawVariant(variantId)
      }
    } catch (e) {
      console.warn('variant sync on togglePublic failed:', e)
    }
  }

  return {
    myProposals,
    loadingMine,
    lastError,
    refreshMine,
    createFromLineup,
    togglePublic,
    isEnabled: isProposalsEnabled,
  }
}
