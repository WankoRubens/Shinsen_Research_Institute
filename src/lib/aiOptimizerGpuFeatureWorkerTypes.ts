import type { BingxueOption, Hero, Skill } from '../composables/useData'
import type { AiWorkerLineupSnapshot } from './aiOptimizerWorkerTypes'

export interface AiGpuFeatureWorkerInitMessage {
  type: 'init'
  heroes: Hero[]
  skills: Skill[]
  bingxue: Record<string, BingxueOption>
}

export interface AiGpuFeatureWorkerBuildMessage {
  type: 'build'
  taskId: number
  lineups: AiWorkerLineupSnapshot[]
}

export type AiGpuFeatureWorkerRequest = AiGpuFeatureWorkerInitMessage | AiGpuFeatureWorkerBuildMessage

export type AiGpuFeatureWorkerResponse =
  | { type: 'ready' }
  | { type: 'result'; taskId: number; features: ArrayBuffer }
  | { type: 'error'; taskId?: number; message: string }
