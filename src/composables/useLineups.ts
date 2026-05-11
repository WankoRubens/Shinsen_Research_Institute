import { reactive, ref, computed, watch } from 'vue'
import { Hero, Skill, BingxueDirection } from './useData'
import { useGroups, MAX_TEAMS_PER_GROUP } from './useGroups'

// Active 兵學 selection for a hero. A hero activates ONE direction at a time,
// picks 1 of 3 majors (1 pt), plus minors from 6 available using a 5-point budget.
// Each minor costs `level` points (Lv1=1pt, Lv2=2pt). Total of .minors.level sums
// must be ≤5. `direction: null` = 兵學 not yet configured.
export interface BingxueMinor {
  name: string          // JP key
  level: 1 | 2
}

export interface BingxueActive {
  direction: BingxueDirection | null
  major: string | null
  minors: BingxueMinor[]
}

// Types
export interface RoleData {
  hero: Hero | null
  skill1: Skill | null
  skill2: Skill | null
  stats: {
    lea: number
    val: number
    int: number
    pol: number
    cha: number
    spd: number
  }
  breakthrough: number  // 0-5, controls which traits are active
  bingxue: BingxueActive
}

export interface Lineup {
  name: string
  main: RoleData
  vice1: RoleData
  vice2: RoleData
}

// State
const defaultStats = { lea: 100, val: 100, int: 100, pol: 100, cha: 100, spd: 100 }

const emptyBingxue = (): BingxueActive => ({
  direction: null,
  major: null,
  minors: [],
})

export const emptyRole = (): RoleData => ({
  hero: null,
  skill1: null,
  skill2: null,
  stats: { ...defaultStats },
  breakthrough: 0,
  bingxue: emptyBingxue(),
})

export const makeTeam = (idx: number): Lineup => ({
  name: `隊伍 ${idx + 1}`,
  main: emptyRole(),
  vice1: emptyRole(),
  vice2: emptyRole(),
})

// A team is "empty" when none of its three roles has a hero assigned —
// skills, breakthrough, and bingxue are meaningless without a hero anchor.
// Used by preview surfaces to hide unused team slots from screencaps.
export const isEmptyTeam = (t: Lineup): boolean =>
  !t.main.hero && !t.vice1.hero && !t.vice2.hero

const { currentGroup } = useGroups()

// Phase 3d: groups owns teams; useLineups exposes a stable `lineups` mirror
// of the active group's teams. `splice` keeps the same array proxy across
// group switches so consumers that captured `lineups` once at module-load
// time keep seeing live data. Items pushed in are the same proxies as
// `currentGroup.value.teams[i]` (Vue 3 reactive is idempotent — pushing an
// already-proxied object reuses its proxy), so mutations propagate either
// direction.
const lineups = reactive<Lineup[]>([])

const currentTeamIndex = ref(0)

// Self-bootstrapping: also seeds the active group with one default team if
// it's empty (cold start, or user removed the last team). Folding the seed
// in here removes the seed-then-watch ordering trap an external seed block
// would create.
const syncLineupsFromGroup = () => {
  if (currentGroup.value.teams.length === 0) {
    currentGroup.value.teams.push(makeTeam(0))
  }
  lineups.splice(0, lineups.length, ...currentGroup.value.teams)
  if (currentTeamIndex.value >= lineups.length) {
    currentTeamIndex.value = Math.max(0, lineups.length - 1)
  }
}

// Watch the computed group reference (not just the index) so wholesale
// replacements via useGroups().replaceGroups() — which the v3 share restore
// uses — also resync the mirror, even if currentGroupIndex stays at 0.
watch(currentGroup, syncLineupsFromGroup, { immediate: true })

// addTeam / ensureTeamCount mutate the source (currentGroup.teams) AND
// manually mirror the new entries into `lineups`. The watcher does NOT fire
// on in-place pushes — it only fires when `currentGroup`'s identity changes
// (group switch or replaceGroups). Without the manual mirror these helpers
// would silently grow the source while leaving `lineups` short, until the
// next group-identity change resynced it.
const addTeam = (): boolean => {
  if (currentGroup.value.teams.length >= MAX_TEAMS_PER_GROUP) return false
  currentGroup.value.teams.push(makeTeam(currentGroup.value.teams.length))
  // Pull the just-pushed item back from the source array so the value
  // mirrored into `lineups` is the same proxy as currentGroup.teams[i].
  const last = currentGroup.value.teams[currentGroup.value.teams.length - 1]
  lineups.push(last)
  currentTeamIndex.value = lineups.length - 1
  return true
}

// Grow the active group up to `target` slots so a share blob with N teams can
// restore fully. Caller is responsible for not exceeding MAX_TEAMS_PER_GROUP.
const ensureTeamCount = (target: number) => {
  while (currentGroup.value.teams.length < target && currentGroup.value.teams.length < MAX_TEAMS_PER_GROUP) {
    currentGroup.value.teams.push(makeTeam(currentGroup.value.teams.length))
    const last = currentGroup.value.teams[currentGroup.value.teams.length - 1]
    lineups.push(last)
  }
}

// Append a pre-built Lineup (e.g. from a proposal import) and switch to it.
// Caller must pass a fully-formed deep clone — the snapshot becomes part of
// the active group's reactive state.
const addTeamFromSnapshot = (team: Lineup): boolean => {
  if (currentGroup.value.teams.length >= MAX_TEAMS_PER_GROUP) return false
  currentGroup.value.teams.push(team)
  const last = currentGroup.value.teams[currentGroup.value.teams.length - 1]
  lineups.push(last)
  currentTeamIndex.value = lineups.length - 1
  return true
}

// Getters
const currentLineup = computed(() => lineups[currentTeamIndex.value])

const currentTeamName = computed({
  get: () => currentLineup.value.name,
  set: (val) => { currentLineup.value.name = val }
})

const allUsedHeroNames = computed(() => {
  const names = new Set<string>()
  lineups.forEach((team) => {
    if (team.main.hero) names.add(team.main.hero.name)
    if (team.vice1.hero) names.add(team.vice1.hero.name)
    if (team.vice2.hero) names.add(team.vice2.hero.name)
  })
  return names
})

const allUsedSkillNames = computed(() => {
  const names = new Set<string>()
  lineups.forEach(team => {
    [team.main, team.vice1, team.vice2].forEach(r => {
      if (r.skill1) names.add(r.skill1.name)
      if (r.skill2) names.add(r.skill2.name)
    })
  })
  return names
})

const totalCost = computed(() => {
  let cost = 0
  const l = currentLineup.value
  if (l.main.hero) cost += l.main.hero.cost
  if (l.vice1.hero) cost += l.vice1.hero.cost
  if (l.vice2.hero) cost += l.vice2.hero.cost
  return cost
})

// Actions
const swapRoles = (roleA: 'main' | 'vice1' | 'vice2', roleB: 'main' | 'vice1' | 'vice2') => {
  if (roleA === roleB) return
  const l = currentLineup.value
  const clone = (r: RoleData): RoleData => ({
    ...r,
    stats: { ...r.stats },
    bingxue: { ...r.bingxue, minors: r.bingxue.minors.map(m => ({ ...m })) },
  })
  const temp = clone(l[roleA])
  l[roleA] = clone(l[roleB])
  l[roleB] = temp
}

const clearLineup = (type: 'all' | 'current') => {
  if (type === 'current') {
    currentLineup.value.main = emptyRole()
    currentLineup.value.vice1 = emptyRole()
    currentLineup.value.vice2 = emptyRole()
  }
  if (type === 'all') {
    lineups.forEach(l => {
      l.main = emptyRole()
      l.vice1 = emptyRole()
      l.vice2 = emptyRole()
    })
  }
}

export function useLineups() {
  return {
    lineups,
    currentTeamIndex,
    currentLineup,
    currentTeamName,
    allUsedHeroNames,
    allUsedSkillNames,
    totalCost,
    emptyRole,
    clearLineup,
    swapRoles,
    addTeam,
    addTeamFromSnapshot,
    ensureTeamCount,
  }
}
