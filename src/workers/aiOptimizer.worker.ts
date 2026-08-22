/// <reference lib="webworker" />

import type { Lineup, RoleData } from '../composables/useLineups'
import type { Hero, Skill } from '../composables/useData'
import { simulateBattleScoreBatch } from '../lib/battleSimulator'
import {
  aiHeroIdentity,
  aiSkillIdentity,
  type AiWorkerEvaluationResult,
  type AiWorkerLineupSnapshot,
  type AiWorkerRequest,
  type AiWorkerResponse,
  type AiWorkerTemplate,
} from '../lib/aiOptimizerWorkerTypes'

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<AiWorkerRequest>) => void) | null
  postMessage: (message: AiWorkerResponse) => void
}

const heroes = new Map<string, Hero>()
const skills = new Map<string, Skill>()
const templates = new Map<string, { id: string; name: string; lineup: Lineup }>()

const hydrateRole = (snapshot: AiWorkerLineupSnapshot['main']): RoleData => ({
  hero: snapshot.heroKey ? heroes.get(snapshot.heroKey) ?? null : null,
  skill1: snapshot.skill1Key ? skills.get(snapshot.skill1Key) ?? null : null,
  skill2: snapshot.skill2Key ? skills.get(snapshot.skill2Key) ?? null : null,
  stats: { ...snapshot.stats },
  breakthrough: snapshot.breakthrough,
  bingxue: {
    direction: snapshot.bingxue.direction,
    major: snapshot.bingxue.major,
    minors: snapshot.bingxue.minors.map((minor) => ({ ...minor })),
  },
})

const hydrateLineup = (snapshot: AiWorkerLineupSnapshot): Lineup => ({
  name: snapshot.name,
  troopType: snapshot.troopType,
  main: hydrateRole(snapshot.main),
  vice1: hydrateRole(snapshot.vice1),
  vice2: hydrateRole(snapshot.vice2),
})

const initialize = (message: Extract<AiWorkerRequest, { type: 'init' }>) => {
  heroes.clear()
  skills.clear()
  templates.clear()
  message.heroes.forEach((hero) => heroes.set(aiHeroIdentity(hero), hero))
  message.skills.forEach((skill) => skills.set(aiSkillIdentity(skill), skill))
  message.templates.forEach((template: AiWorkerTemplate) => {
    templates.set(template.id, {
      id: template.id,
      name: template.name,
      // テンプレ編成はWorker起動時に一度だけ復元し、全候補で再利用する。
      lineup: hydrateLineup(template.lineup),
    })
  })
  scope.postMessage({ type: 'ready' })
}

const evaluate = (message: Extract<AiWorkerRequest, { type: 'evaluate' }>): AiWorkerEvaluationResult => {
  const lineup = hydrateLineup(message.lineup)
  const matchupResults = message.templateIds.map((templateId) => {
    const template = templates.get(templateId)
    if (!template) throw new Error(`AI評価テンプレが見つかりません: ${templateId}`)
    return {
      template,
      result: simulateBattleScoreBatch(lineup, template.lineup, {
        seed: `${message.seed}-${template.id}`,
        runs: message.runs,
      }),
    }
  })
  const divisor = Math.max(1, matchupResults.length)
  const average = (pick: (item: typeof matchupResults[number]['result']) => number) =>
    matchupResults.reduce((sum, item) => sum + pick(item.result), 0) / divisor

  return {
    winRate: average((result) => result.allyWinRate),
    drawRate: average((result) => result.drawRate),
    exchangeRatio: average((result) => result.exchangeRatio),
    score: average((result) => result.scoreValue),
    totalRuns: message.runs * matchupResults.length,
    matchups: matchupResults
      .map(({ template, result }) => ({
        id: template.id,
        name: template.name,
        winRate: result.allyWinRate,
        exchangeRatio: result.exchangeRatio,
      }))
      .sort((a, b) => b.winRate - a.winRate || b.exchangeRatio - a.exchangeRatio),
  }
}

scope.onmessage = (event) => {
  const message = event.data
  try {
    if (message.type === 'init') {
      initialize(message)
      return
    }
    scope.postMessage({ type: 'result', taskId: message.taskId, result: evaluate(message) })
  } catch (error) {
    scope.postMessage({
      type: 'error',
      taskId: message.type === 'evaluate' ? message.taskId : undefined,
      message: error instanceof Error ? error.message : String(error),
    })
  }
}

