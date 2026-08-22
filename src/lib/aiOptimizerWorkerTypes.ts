import type { BingxueActive, Lineup, RoleData } from '../composables/useLineups'
import type { Hero, Skill } from '../composables/useData'
import type { TroopType } from '../constants/traits'

export interface AiWorkerRoleSnapshot {
  heroKey: string | null
  skill1Key: string | null
  skill2Key: string | null
  stats: RoleData['stats']
  breakthrough: number
  bingxue: BingxueActive
}

export interface AiWorkerLineupSnapshot {
  name: string
  troopType: TroopType | null
  main: AiWorkerRoleSnapshot
  vice1: AiWorkerRoleSnapshot
  vice2: AiWorkerRoleSnapshot
}

export interface AiWorkerTemplate {
  id: string
  name: string
  lineup: AiWorkerLineupSnapshot
}

export interface AiWorkerMatchupResult {
  id: string
  name: string
  winRate: number
  exchangeRatio: number
}

export interface AiWorkerEvaluationResult {
  winRate: number
  drawRate: number
  exchangeRatio: number
  score: number
  totalRuns: number
  matchups: AiWorkerMatchupResult[]
}

export interface AiWorkerInitMessage {
  type: 'init'
  heroes: Hero[]
  skills: Skill[]
  templates: AiWorkerTemplate[]
}

export interface AiWorkerEvaluateMessage {
  type: 'evaluate'
  taskId: number
  lineup: AiWorkerLineupSnapshot
  runs: number
  seed: string
  templateIds: string[]
}

export type AiWorkerRequest = AiWorkerInitMessage | AiWorkerEvaluateMessage

export type AiWorkerResponse =
  | { type: 'ready' }
  | { type: 'result'; taskId: number; result: AiWorkerEvaluationResult }
  | { type: 'error'; taskId?: number; message: string }

export const aiHeroIdentity = (hero: Hero): string => hero.sim_id || hero.name_jp || hero.name
export const aiSkillIdentity = (skill: Skill): string => skill.sim_id || skill.id || skill.name_jp || skill.name

const snapshotRole = (role: RoleData): AiWorkerRoleSnapshot => ({
  heroKey: role.hero ? aiHeroIdentity(role.hero) : null,
  skill1Key: role.skill1 ? aiSkillIdentity(role.skill1) : null,
  skill2Key: role.skill2 ? aiSkillIdentity(role.skill2) : null,
  stats: { ...role.stats },
  breakthrough: role.breakthrough,
  bingxue: {
    direction: role.bingxue.direction,
    major: role.bingxue.major,
    minors: role.bingxue.minors.map((minor) => ({ ...minor })),
  },
})

// VueのProxyをWorkerへ直接渡さず、戦闘に必要なIDと固定値だけへ圧縮する。
export const snapshotAiLineup = (lineup: Lineup): AiWorkerLineupSnapshot => ({
  name: lineup.name,
  troopType: lineup.troopType ?? null,
  main: snapshotRole(lineup.main),
  vice1: snapshotRole(lineup.vice1),
  vice2: snapshotRole(lineup.vice2),
})

