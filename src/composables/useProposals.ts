import { ref } from 'vue'
import type { Proposal } from '../types/group'
import type { Lineup } from './useLineups'
import {
  createProposal as remoteCreate,
  updateProposal as remoteUpdate,
  deleteProposal as remoteDelete,
  listMyProposals,
  listPublicProposals,
  toggleProposalVote,
  listMyVotes,
  isProposalsEnabled,
} from '../lib/proposals'

const myProposals = ref<Proposal[]>([])
const publicProposals = ref<Proposal[]>([])
const myVotes = ref<Set<string>>(new Set())
const loadingMine = ref(false)
const loadingPublic = ref(false)
const lastError = ref<string | null>(null)

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

  const refreshPublic = async (limit = 50): Promise<void> => {
    if (!isProposalsEnabled()) return
    loadingPublic.value = true
    lastError.value = null
    try {
      publicProposals.value = await listPublicProposals(limit)
    } catch (e) {
      lastError.value = e instanceof Error ? e.message : String(e)
    } finally {
      loadingPublic.value = false
    }
  }

  const createFromLineup = async (
    lineup: Lineup,
    opts: { name: string; description?: string; isPublic: boolean; authorName?: string | null; forkedFrom?: string | null },
  ): Promise<Proposal> => {
    const team = snapshotTeam(lineup)
    const created = await remoteCreate({ ...opts, team })
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
  }

  const vote = async (id: string): Promise<void> => {
    const currentlyOn = myVotes.value.has(id)
    await toggleProposalVote(id, !currentlyOn)
    const next = new Set(myVotes.value)
    if (currentlyOn) next.delete(id)
    else next.add(id)
    myVotes.value = next
    const bump = currentlyOn ? -1 : 1
    const apply = (list: Proposal[]) =>
      list.map(p => (p.id === id ? { ...p, voteCount: p.voteCount + bump } : p))
    publicProposals.value = apply(publicProposals.value)
    myProposals.value = apply(myProposals.value)
  }

  return {
    myProposals,
    publicProposals,
    myVotes,
    loadingMine,
    loadingPublic,
    lastError,
    refreshMine,
    refreshPublic,
    createFromLineup,
    togglePublic,
    remove,
    vote,
    isEnabled: isProposalsEnabled,
  }
}
