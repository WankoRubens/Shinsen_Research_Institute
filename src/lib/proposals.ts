// Supabase REST client for the 精選隊伍 (single-team snapshot) feature.
// Code/DB names retain "proposal(s)" for backwards compatibility; the CHT
// surface label was renamed away from "配將提案" because that term is
// reserved for a future group-level (multi-team) suggestion feature.
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
  upvote_count: number
  downvote_count: number
  forked_from: string | null
  created_at: string
  updated_at: string
}

const rowToProposal = (row: ProposalRow): Proposal => ({
  id: row.id,
  name: row.name,
  team: row.team_blob as Proposal['team'],
  isPublic: row.is_public,
  authorId: row.user_id,
  authorName: row.author_name,
  voteCount: row.vote_count,
  // Older rows from pre-migration deploys may lack the per-direction columns;
  // coerce nullish to 0 so the UI never NaN-renders.
  upvoteCount: row.upvote_count ?? 0,
  downvoteCount: row.downvote_count ?? 0,
  forkedFrom: row.forked_from,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

export type VoteDirection = 1 | -1

export const isProposalsEnabled = isSupabaseConfigured

export interface CreateProposalInput {
  name: string
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

  // description column is intentionally omitted — the UI no longer accepts
  // user-supplied descriptions (anti-harassment), and the DB default for the
  // column is NULL, so new rows land cleanly without a stale empty-string.
  const body = {
    name: input.name,
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

/** Update a proposal (owner only via RLS). Use for renaming or flipping
 *  is_public after the fact. */
export const updateProposal = async (
  id: string,
  patch: Partial<Pick<CreateProposalInput, 'name' | 'isPublic'>>,
): Promise<Proposal> => {
  if (!SUPABASE_URL) throw new Error('proposals backend not configured')
  const token = await getValidAccessToken()
  if (!token) throw new Error('login required to update a proposal')

  const body: Record<string, unknown> = {}
  if (patch.name !== undefined) body.name = patch.name
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
export const listPublicProposals = async (limit = 50, offset = 0): Promise<Proposal[]> => {
  if (!SUPABASE_URL) throw new Error('proposals backend not configured')

  const url = `${SUPABASE_URL}/rest/v1/proposals?is_public=eq.true&select=*`
    + `&order=vote_count.desc,updated_at.desc`
    + `&limit=${limit}&offset=${offset}`
  const res = await fetchWithTimeout(url, { headers: restHeaders(null) })
  if (!res.ok) throw new Error(`proposals public list failed: ${res.status}`)
  return ((await res.json()) as ProposalRow[]).map(rowToProposal)
}

/** Set the current user's vote direction on a proposal. Upserts on
 *  (proposal_id, user_id) — inserts a fresh row or flips `value` if a row
 *  already exists. The DB trigger fans out to upvote_count/downvote_count
 *  and the net vote_count. */
export const setProposalVote = async (
  proposalId: string,
  direction: VoteDirection,
): Promise<void> => {
  if (!SUPABASE_URL) throw new Error('proposals backend not configured')
  const token = await getValidAccessToken()
  if (!token) throw new Error('login required to vote')

  // PostgREST upsert: `on_conflict=` targets the unique constraint we want to
  // resolve against (the PK here) and Prefer=merge-duplicates tells the server
  // to UPDATE on conflict rather than skip.
  const url = `${SUPABASE_URL}/rest/v1/proposal_votes`
    + `?on_conflict=proposal_id,user_id`
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      ...restHeaders(token),
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({ proposal_id: proposalId, value: direction }),
  })
  if (!res.ok) throw new Error(`vote set failed: ${res.status} ${await res.text()}`)
}

export const clearProposalVote = async (proposalId: string): Promise<void> => {
  if (!SUPABASE_URL) throw new Error('proposals backend not configured')
  const token = await getValidAccessToken()
  const session = getSession()
  if (!token || !session) throw new Error('login required to vote')

  // Filter on (proposal_id, user_id) so we hit the PK exactly. RLS also
  // restricts this to our own row; matching the PK keeps the query
  // intent explicit and survives future RLS edits.
  const url = `${SUPABASE_URL}/rest/v1/proposal_votes`
    + `?proposal_id=eq.${encodeURIComponent(proposalId)}`
    + `&user_id=eq.${encodeURIComponent(session.user.id)}`
  const res = await fetchWithTimeout(url, { method: 'DELETE', headers: restHeaders(token) })
  if (!res.ok) throw new Error(`vote remove failed: ${res.status}`)
}

/** Returns a Map of proposal_id → direction (1 = upvoted, -1 = downvoted) for
 *  the current user. Anon users get an empty Map. */
export const listMyVotes = async (): Promise<Map<string, VoteDirection>> => {
  if (!SUPABASE_URL) return new Map()
  const token = await getValidAccessToken()
  if (!token) return new Map()

  const res = await fetchWithTimeout(
    `${SUPABASE_URL}/rest/v1/proposal_votes?select=proposal_id,value`,
    { headers: restHeaders(token) },
  )
  if (!res.ok) return new Map()
  const rows = (await res.json()) as Array<{ proposal_id: string; value: number }>
  return new Map(rows.map(r => [r.proposal_id, (r.value === -1 ? -1 : 1) as VoteDirection]))
}
