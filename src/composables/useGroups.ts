import { reactive, ref, computed } from 'vue'
import type { Group, Team } from '../types/group'
import { MAX_TEAMS_PER_GROUP } from '../types/group'

// One group holds up to MAX_TEAMS_PER_GROUP teams. Phase 3d only ships the
// single-group case; addGroup/removeGroup wire the multi-group machinery so
// Phase 3e/6 (group selector dropdown) can build on top.

const makeGroupId = () =>
  `g_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

const groups = reactive<Group[]>([
  // Seeded empty — useLineups inserts the first default team on first init,
  // so Group ↔ Team ownership stays one-way (groups owns teams, useLineups
  // mirrors).
  { id: makeGroupId(), name: 'デフォルト', teams: [] },
])

const currentGroupIndex = ref(0)
const currentGroup = computed(() => groups[currentGroupIndex.value])

const addGroup = (name = '新しい編成'): number => {
  groups.push({ id: makeGroupId(), name, teams: [] })
  return groups.length - 1
}

const removeGroup = (idx: number): boolean => {
  if (groups.length <= 1) return false
  if (idx < 0 || idx >= groups.length) return false
  groups.splice(idx, 1)
  if (currentGroupIndex.value >= groups.length) {
    currentGroupIndex.value = groups.length - 1
  }
  return true
}

const renameGroup = (idx: number, name: string) => {
  const g = groups[idx]
  if (g) g.name = name
}

const setCurrentGroup = (idx: number) => {
  if (idx >= 0 && idx < groups.length) currentGroupIndex.value = idx
}

// Wholesale replacement, used by share-blob v3 restore AND by localStorage
// autosave restore. Keeps the `groups` proxy stable (callers holding the
// reference keep seeing updates) but the element identities are new —
// watchers on `currentGroup` fire so useLineups can resync its mirror.
//
// `id` may be passed in by the autosave restore path so a group keeps the
// same client-side id across reloads (needed for cross-tab reconciliation
// and, later, cloud-sync client_id mapping). If omitted (share-link path,
// proposal import), a fresh id is generated as before.
const replaceGroups = (incoming: { id?: string; name: string; teams: Team[] }[]) => {
  if (incoming.length === 0) return
  const next: Group[] = incoming.map((g) => ({
    id: g.id ?? makeGroupId(),
    name: g.name,
    teams: g.teams,
  }))
  groups.splice(0, groups.length, ...next)
  currentGroupIndex.value = 0
}

// Replace the current group's id with a fresh one. Called when the user
// resets the current group's teams — the underlying intent is "start this
// group over", which for cloud sync means we want the next push to create
// a new cloud row (and let stale-detect remove the previous one). Without
// this, the stale group id would PATCH the old cloud row, silently mixing
// the "reset" intent with whatever was on cloud under the same client_id.
const regenerateCurrentGroupId = (): void => {
  const g = groups[currentGroupIndex.value]
  if (g) g.id = makeGroupId()
}

// Append a pre-built team to an arbitrary group identified by index. Caller
// must pass a deep-cloned Team (the snapshot becomes part of reactive state)
// and is responsible for capacity checks via MAX_TEAMS_PER_GROUP — this
// helper enforces it defensively but returns false on overflow rather than
// throwing. When the target IS the current group, useLineups' lineups mirror
// won't auto-resync (the watcher fires on currentGroup identity change, not
// on in-place pushes); callers in that case should prefer
// useLineups.addTeamFromSnapshot which keeps the mirror in lockstep. For
// any other target index, the autosave deep-watcher picks up the mutation
// and the next cloud push PATCHes the affected group.
const appendTeamToGroup = (groupIdx: number, team: Team): boolean => {
  if (groupIdx < 0 || groupIdx >= groups.length) return false
  const g = groups[groupIdx]
  if (g.teams.length >= MAX_TEAMS_PER_GROUP) return false
  g.teams.push(team)
  return true
}

// Wipe groups[] back to a single default group with a fresh id. Used by the
// "全部重置" reset. The fresh id ensures any stale cloud rows tied to the
// old ids get cleaned up by stale-detect on the next push, instead of being
// silently overwritten in place.
const resetToDefault = (): void => {
  groups.splice(0, groups.length, {
    id: makeGroupId(),
    name: 'デフォルト',
    teams: [],
  })
  currentGroupIndex.value = 0
}

export function useGroups() {
  return {
    groups,
    currentGroupIndex,
    currentGroup,
    addGroup,
    removeGroup,
    renameGroup,
    setCurrentGroup,
    replaceGroups,
    regenerateCurrentGroupId,
    resetToDefault,
    appendTeamToGroup,
  }
}
