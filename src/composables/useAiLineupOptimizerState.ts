import { reactive, ref } from 'vue'
import type { Lineup, RoleData } from './useLineups'

export interface AiOptimizerMatchupSummary {
  id: string
  name: string
  winRate: number
  exchangeRatio: number
}

export interface AiOptimizerResult {
  id: string
  rank: number
  lineup: Lineup
  winRate: number
  drawRate: number
  exchangeRatio: number
  score: number
  scoreTier: string
  totalRuns: number
  matchups: AiOptimizerMatchupSummary[]
}

export type AiOptimizerPhase = 'idle' | 'scout' | 'final' | 'done'

export const emptyAiOptimizerRole = (): RoleData => ({
  hero: null,
  skill1: null,
  skill2: null,
  stats: { lea: 100, val: 100, int: 100, pol: 100, cha: 100, spd: 100 },
  breakthrough: 0,
  bingxue: { direction: null, major: null, minors: [] },
})

const seedTeam = reactive<Lineup>({
  name: 'AI探索編成',
  main: emptyAiOptimizerRole(),
  vice1: emptyAiOptimizerRole(),
  vice2: emptyAiOptimizerRole(),
})

const running = ref(false)
const topResults = ref<AiOptimizerResult[]>([])
const progress = reactive({ done: 0, total: 0 })
const resultPhase = ref<AiOptimizerPhase>('idle')
const sampleCount = ref(500)
const scoutRuns = ref(20)
const finalRuns = ref(100)

export function useAiLineupOptimizerState() {
  return {
    seedTeam,
    running,
    topResults,
    progress,
    resultPhase,
    sampleCount,
    scoutRuns,
    finalRuns,
  }
}
