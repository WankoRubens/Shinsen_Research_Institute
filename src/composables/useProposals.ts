import { ref } from 'vue'
import type { Proposal } from '../types/group'
import type { Lineup } from './useLineups'
import {
  createProposal as remoteCreate,
  updateProposal as remoteUpdate,
  deleteProposal as remoteDelete,
  listMyProposals,
  listPublicProposals,
  setProposalVote,
  clearProposalVote,
  listMyVotes,
  isProposalsEnabled,
  type VoteDirection,
} from '../lib/proposals'

const myProposals = ref<Proposal[]>([])
const publicProposals = ref<Proposal[]>([])
const myVotes = ref<Map<string, VoteDirection>>(new Map())
const loadingMine = ref(false)
const loadingPublic = ref(false)
const loadingPublicMore = ref(false)
const publicHasMore = ref(true)
const lastError = ref<string | null>(null)

const PUBLIC_PAGE_SIZE = 24

const snapshotTeam = (lineup: Lineup): Lineup => JSON.parse(JSON.stringify(lineup))

export function useProposals() {
  const refreshMine = async (): Promise<void> => {
    if (!isProposalsEnabled()) return
    loadingMine.value = true
    lastError.value = null
    try {
      myProposals.value = await listMyProposals()
      myVotes.value = await listMyVotes()
    } catch (e) {
      lastError.value = e instanceof Error ? e.message : String(e)
    } finally {
      loadingMine.value = false
    }
  }

  const refreshPublic = async (): Promise<void> => {
    if (!isProposalsEnabled()) return
    loadingPublic.value = true
    lastError.value = null
    try {
      const rows = await listPublicProposals(PUBLIC_PAGE_SIZE, 0)
      publicProposals.value = rows
      publicHasMore.value = rows.length === PUBLIC_PAGE_SIZE
    } catch (e) {
      lastError.value = e instanceof Error ? e.message : String(e)
    } finally {
      loadingPublic.value = false
    }
  }

  const loadMorePublic = async (): Promise<void> => {
    if (!isProposalsEnabled() || loadingPublicMore.value || !publicHasMore.value) return
    loadingPublicMore.value = true
    try {
      const rows = await listPublicProposals(PUBLIC_PAGE_SIZE, publicProposals.value.length)
      // Dedupe in case a concurrent insert shifted pagination and we'd otherwise
      // grab an id that's already in our local list.
      const seen = new Set(publicProposals.value.map(p => p.id))
      const fresh = rows.filter(r => !seen.has(r.id))
      publicProposals.value = [...publicProposals.value, ...fresh]
      publicHasMore.value = rows.length === PUBLIC_PAGE_SIZE
    } catch (e) {
      lastError.value = e instanceof Error ? e.message : String(e)
    } finally {
      loadingPublicMore.value = false
    }
  }

  const createFromLineup = async (
    lineup: Lineup,
    opts: { name: string; isPublic: boolean; authorName?: string | null; forkedFrom?: string | null },
  ): Promise<Proposal> => {
    const team = snapshotTeam(lineup)
    // Centralize the 10-char display-name cap here so every create path (the
    // CreateProposalDialog and the share-dialog auto-publish) gets the same
    // stored author_name without callers having to remember the rule.
    const authorName = opts.authorName ? opts.authorName.slice(0, 10) : opts.authorName ?? null
    const created = await remoteCreate({ ...opts, authorName, team })
    myProposals.value = [created, ...myProposals.value]
    return created
  }

  const togglePublic = async (id: string, isPublic: boolean): Promise<void> => {
    const updated = await remoteUpdate(id, { isPublic })
    const idx = myProposals.value.findIndex(p => p.id === id)
    if (idx >= 0) myProposals.value[idx] = updated
  }

  const remove = async (id: string): Promise<void> => {
    await remoteDelete(id)
    myProposals.value = myProposals.value.filter(p => p.id !== id)
    publicProposals.value = publicProposals.value.filter(p => p.id !== id)
  }

  /** Apply the optimistic count deltas for a vote transition. Centralizing
   *  this avoids repeating four cases (none → up, none → down, up → down,
   *  etc.) and keeps the trigger arithmetic and client state in lockstep. */
  const applyVoteDeltas = (
    id: string,
    prev: VoteDirection | undefined,
    next: VoteDirection | undefined,
  ): void => {
    let dUp = 0, dDown = 0, dNet = 0
    if (prev === 1)  { dUp--;   dNet-- }
    if (prev === -1) { dDown--; dNet++ }
    if (next === 1)  { dUp++;   dNet++ }
    if (next === -1) { dDown++; dNet-- }
    const apply = (list: Proposal[]) =>
      list.map(p => p.id === id
        ? {
            ...p,
            upvoteCount:   Math.max(0, p.upvoteCount   + dUp),
            downvoteCount: Math.max(0, p.downvoteCount + dDown),
            voteCount:     p.voteCount + dNet,
          }
        : p,
      )
    publicProposals.value = apply(publicProposals.value)
    myProposals.value = apply(myProposals.value)
  }

  /** Toggle the user's vote in a given direction. If they already voted that
   *  direction, the click clears the vote (YouTube-like UX). Otherwise the
   *  vote is set/flipped to that direction.
   *
   *  Snapshot semantics: we capture the three reactive blobs (myVotes,
   *  publicProposals, myProposals) BEFORE the await so a concurrent vote on
   *  the same card can't taint the rollback path. The cost is a fresh Map
   *  + two array refs per call — cheap, and it makes the failure path
   *  arithmetic-free. */
  const vote = async (id: string, direction: VoteDirection): Promise<void> => {
    const prev = myVotes.value.get(id)
    const next: VoteDirection | undefined = prev === direction ? undefined : direction

    const prevVotes = myVotes.value
    const prevPublic = publicProposals.value
    const prevMine = myProposals.value

    const nextMap = new Map(prevVotes)
    if (next === undefined) nextMap.delete(id)
    else nextMap.set(id, next)
    myVotes.value = nextMap
    applyVoteDeltas(id, prev, next)

    try {
      if (next === undefined) await clearProposalVote(id)
      else await setProposalVote(id, next)
    } catch (e) {
      myVotes.value = prevVotes
      publicProposals.value = prevPublic
      myProposals.value = prevMine
      throw e
    }
  }

  return {
    myProposals,
    publicProposals,
    myVotes,
    loadingMine,
    loadingPublic,
    loadingPublicMore,
    publicHasMore,
    lastError,
    refreshMine,
    refreshPublic,
    loadMorePublic,
    createFromLineup,
    togglePublic,
    remove,
    vote,
    isEnabled: isProposalsEnabled,
  }
}
