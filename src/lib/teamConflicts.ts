// Hero / skill collision handling for "place a team into a group".
//
// A "group" is the destination — up to MAX_TEAMS_PER_GROUP teams sharing a
// uniqueness constraint (a hero or skill may appear in at most one team in
// the group). When we drop an incoming team into a destination group, any
// hero/skill the incoming team uses that's also present in one of the
// destination's OTHER teams is a collision.
//
// Resolution semantics mirror the legacy ImportProposalDialog flow:
//   - 'leave-empty'   → null out the colliding piece on the *incoming* team
//                       (hero whole role; skill just that slot)
//   - 'overwrite'     → null out the colliding piece on the *destination's
//                       other teams* instead, so the incoming team lands intact
//   - 'cancel'        → no-op (caller bails before reaching this helper)
//
// Both mutating helpers return the (already-mutated) inputs for convenience.

import type { Lineup } from '../composables/useLineups'
import { emptyRole } from '../composables/useLineups'
import type { Team, ImportConflictResolution } from '../types/group'

type Role = 'main' | 'vice1' | 'vice2'

const ROLES: Role[] = ['main', 'vice1', 'vice2']

export interface CollisionPreview {
  heroes: string[]
  skills: string[]
}

// Names of heroes and skills already used by `destTeams` excluding the team
// at `excludeIndex` (if any). Used to highlight conflicts before the user
// commits.
export function buildCollisionPool(
  destTeams: Lineup[],
  excludeIndex?: number,
): { heroes: Set<string>; skills: Set<string> } {
  const heroes = new Set<string>()
  const skills = new Set<string>()
  destTeams.forEach((t, i) => {
    if (excludeIndex != null && i === excludeIndex) return
    for (const role of ROLES) {
      const r = t[role]
      if (r.hero) heroes.add(r.hero.name)
      if (r.skill1) skills.add(r.skill1.name)
      if (r.skill2) skills.add(r.skill2.name)
    }
  })
  return { heroes, skills }
}

// Compute a list of human-readable collision names between an incoming team
// and the rest of a destination group. Order: heroes first, then skills.
export function previewCollisions(
  incoming: Lineup,
  pool: { heroes: Set<string>; skills: Set<string> },
): CollisionPreview {
  const heroes: string[] = []
  const skills: string[] = []
  for (const role of ROLES) {
    const r = incoming[role]
    if (r?.hero && pool.heroes.has(r.hero.name)) heroes.push(r.hero.name)
    if (r?.skill1 && pool.skills.has(r.skill1.name)) skills.push(r.skill1.name)
    if (r?.skill2 && pool.skills.has(r.skill2.name)) skills.push(r.skill2.name)
  }
  return { heroes, skills }
}

// Apply `resolution` to an incoming team about to be placed into a
// destination group's teams. Mutates `incoming` and / or `destTeams` in
// place per the resolution. 'cancel' is a no-op here (caller responsibility).
export function applyConflictResolution(
  incoming: Team,
  destTeams: Team[],
  resolution: ImportConflictResolution,
  excludeIndex?: number,
): void {
  if (resolution === 'cancel') return
  const pool = buildCollisionPool(destTeams, excludeIndex)

  if (resolution === 'leave-empty') {
    for (const role of ROLES) {
      const r = incoming[role]
      if (r?.hero && pool.heroes.has(r.hero.name)) {
        incoming[role] = emptyRole()
        continue
      }
      if (r?.skill1 && pool.skills.has(r.skill1.name)) r.skill1 = null
      if (r?.skill2 && pool.skills.has(r.skill2.name)) r.skill2 = null
    }
    return
  }

  // 'overwrite' — null the same piece on the destination's other teams.
  const incomingHeroes = new Set<string>()
  const incomingSkills = new Set<string>()
  for (const role of ROLES) {
    const r = incoming[role]
    if (r?.hero) incomingHeroes.add(r.hero.name)
    if (r?.skill1) incomingSkills.add(r.skill1.name)
    if (r?.skill2) incomingSkills.add(r.skill2.name)
  }
  destTeams.forEach((t, i) => {
    if (excludeIndex != null && i === excludeIndex) return
    for (const role of ROLES) {
      const r = t[role]
      if (r.hero && incomingHeroes.has(r.hero.name)) {
        t[role] = emptyRole()
        continue
      }
      if (r.skill1 && incomingSkills.has(r.skill1.name)) r.skill1 = null
      if (r.skill2 && incomingSkills.has(r.skill2.name)) r.skill2 = null
    }
  })
}
