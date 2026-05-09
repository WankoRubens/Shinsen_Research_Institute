// Supabase REST client for the 配將提案 (proposal) feature.
//
// Mirrors the no-SDK pattern from share.ts / profiles.ts: PostgREST direct
// calls, JWT for authenticated writes, anon for public reads.
//
// Public proposals (is_public = true) are readable by anyone via RLS.
// Private proposals (is_public = false) are readable only by the owner.
// Voting is constrained to authenticated users; one vote per (user, proposal).

import { SUPABASE_URL, fetchWithTimeout, isSupabaseConfigured, restHeaders } from './supabase'
import { getSession, getValidAccessToken } from './auth'
import type { Proposal } from '../types/group'

interface ProposalRow {
  id: string
  name: string
  description: string | null
  team_blob: unknown
  is_public: boolean
  user_id: string | null
  author_name: string | null
  vote_count: number
  forked_from: string | null
  created_at: string
  updated_at: string
}

const rowToProposal = (row: ProposalRow): Proposal => ({
  id: row.id,
  name: row.name,
  description: row.description ?? '',
  team: row.team_blob as Proposal['team'],
  isPublic: row.is_public,
  authorId: row.user_id,
  authorName: row.author_name,
  voteCount: row.vote_count,
  forkedFrom: row.forked_from,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

export const isProposalsEnabled = isSupabaseConfigured

export interface CreateProposalInput {
  name: string
  description?: string
  team: Proposal['team']
  isPublic: boolean
  forkedFrom?: string | null
  authorName?: string | null
}

/** Insert a new proposal. Auth required: anon users can't create proposals
 *  (we want every public submission attributable). Returns the inserted row. */
export const createProposal = async (input: CreateProposalInput): Promise<Proposal> => {
  if (!SUPABASE_URL) throw new Error('proposals backend not configured')
  const token = await getValidAccessToken()
  if (!token) throw new Error('login required to create a proposal')

  const body = {
    name: input.name,
    description: input.description ?? null,
    team_blob: input.team,
    is_public: input.isPublic,
    forked_from: input.forkedFrom ?? null,
    author_name: input.authorName ?? null,
  }

  const res = await fetchWithTimeout(`${SUPABASE_URL}/rest/v1/proposals`, {
    method: 'POST',
    headers: {
      ...restHeaders(token),
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`proposal create failed: ${res.status} ${await res.text()}`)
  const rows = (await res.json()) as ProposalRow[]
  return rowToProposal(rows[0])
}

/** Update a proposal (owner only via RLS). Use for renaming, edit description,
 *  or flipping is_public after the fact. */
export const updateProposal = async (
  id: string,
  patch: Partial<Pick<CreateProposalInput, 'name' | 'description' | 'isPublic'>>,
): Promise<Proposal> => {
  if (!SUPABASE_URL) throw new Error('proposals backend not configured')
  const token = await getValidAccessToken()
  if (!token) throw new Error('login required to update a proposal')

  const body: Record<string, unknown> = {}
  if (patch.name !== undefined) body.name = patch.name
  if (patch.description !== undefined) body.description = patch.description
  if (patch.isPublic !== undefined) body.is_public = patch.isPublic

  const res = await fetchWithTimeout(`${SUPABASE_URL}/rest/v1/proposals?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      ...restHeaders(token),
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`proposal update failed: ${res.status}`)
  const rows = (await res.json()) as ProposalRow[]
  return rowToProposal(rows[0])
}

export const deleteProposal = async (id: string): Promise<void> => {
  if (!SUPABASE_URL) throw new Error('proposals backend not configured')
  const token = await getValidAccessToken()
  if (!token) throw new Error('login required to delete a proposal')

  const res = await fetchWithTimeout(`${SUPABASE_URL}/rest/v1/proposals?id=eq.${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: restHeaders(token),
  })
  if (!res.ok) throw new Error(`proposal delete failed: ${res.status}`)
}

/** List the current user's own proposals (private + public). Auth required. */
export const listMyProposals = async (): Promise<Proposal[]> => {
  if (!SUPABASE_URL) throw new Error('proposals backend not configured')
  const token = await getValidAccessToken()
  if (!token) return []

  const url = `${SUPABASE_URL}/rest/v1/proposals?select=*&order=updated_at.desc`
  const res = await fetchWithTimeout(url, { headers: restHeaders(token) })
  if (!res.ok) throw new Error(`proposals list failed: ${res.status}`)
  return ((await res.json()) as ProposalRow[]).map(rowToProposal)
}

/** Browse the public proposal feed, anon-readable. */
export const listPublicProposals = async (limit = 50): Promise<Proposal[]> => {
  if (!SUPABASE_URL) throw new Error('proposals backend not configured')

  const url = `${SUPABASE_URL}/rest/v1/proposals?is_public=eq.true&select=*&order=vote_count.desc,updated_at.desc&limit=${limit}`
  const res = await fetchWithTimeout(url, { headers: restHeaders(null) })
  if (!res.ok) throw new Error(`proposals public list failed: ${res.status}`)
  return ((await res.json()) as ProposalRow[]).map(rowToProposal)
}

/** Toggle the current user's vote on a proposal. vote_count is maintained
 *  by a DB trigger so the client only flips the membership row. */
export const toggleProposalVote = async (proposalId: string, on: boolean): Promise<void> => {
  if (!SUPABASE_URL) throw new Error('proposals backend not configured')
  const token = await getValidAccessToken()
  const session = getSession()
  if (!token || !session) throw new Error('login required to vote')

  if (on) {
    const res = await fetchWithTimeout(`${SUPABASE_URL}/rest/v1/proposal_votes`, {
      method: 'POST',
      headers: {
        ...restHeaders(token),
        'Content-Type': 'application/json',
        Prefer: 'resolution=ignore-duplicates,return=minimal',
      },
      body: JSON.stringify({ proposal_id: proposalId }),
    })
    if (!res.ok) throw new Error(`vote add failed: ${res.status}`)
  } else {
    // Filter on (proposal_id, user_id) so we hit the PK exactly. RLS would
    // also restrict this to our own row, but matching the PK keeps the query
    // intent explicit and survives any future RLS policy edits.
    const url = `${SUPABASE_URL}/rest/v1/proposal_votes`
      + `?proposal_id=eq.${encodeURIComponent(proposalId)}`
      + `&user_id=eq.${encodeURIComponent(session.user.id)}`
    const res = await fetchWithTimeout(url, { method: 'DELETE', headers: restHeaders(token) })
    if (!res.ok) throw new Error(`vote remove failed: ${res.status}`)
  }
}

/** Returns the set of proposal_ids the current user has voted for. Used to
 *  paint the heart icon on browse. Anon users get an empty set. */
export const listMyVotes = async (): Promise<Set<string>> => {
  if (!SUPABASE_URL) return new Set()
  const token = await getValidAccessToken()
  if (!token) return new Set()

  const res = await fetchWithTimeout(
    `${SUPABASE_URL}/rest/v1/proposal_votes?select=proposal_id`,
    { headers: restHeaders(token) },
  )
  if (!res.ok) return new Set()
  const rows = (await res.json()) as Array<{ proposal_id: string }>
  return new Set(rows.map(r => r.proposal_id))
}
