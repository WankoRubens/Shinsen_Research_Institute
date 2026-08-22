import type { BingxueOption, Hero, Skill } from '../composables/useData'
import type { BingxueActive } from '../composables/useLineups'
import {
  aiHeroIdentity,
  aiSkillIdentity,
  type AiWorkerLineupSnapshot,
} from './aiOptimizerWorkerTypes'

export const AI_GPU_FEATURE_COUNT = 8
const roleKeys = ['main', 'vice1', 'vice2'] as const

export interface AiGpuFeatureCatalog {
  heroes: Map<string, Hero>
  skills: Map<string, Skill>
  bingxue: Record<string, BingxueOption>
}

export const createAiGpuFeatureCatalog = (
  heroes: Hero[],
  skills: Skill[],
  bingxue: Record<string, BingxueOption>,
): AiGpuFeatureCatalog => {
  const heroMap = new Map<string, Hero>()
  const skillMap = new Map<string, Skill>()
  heroes.forEach((hero) => heroMap.set(aiHeroIdentity(hero), hero))
  skills.forEach((skill) => {
    skillMap.set(aiSkillIdentity(skill), skill)
    if (skill.name) skillMap.set(skill.name, skill)
    if (skill.name_jp) skillMap.set(skill.name_jp, skill)
    if (skill.sim_id) skillMap.set(skill.sim_id, skill)
  })
  return { heroes: heroMap, skills: skillMap, bingxue }
}

const parseActivationRate = (skill: Skill): number => {
  if (Number.isFinite(Number(skill.probability))) return Math.max(0, Math.min(1, Number(skill.probability)))
  const rates = String(skill.activation_rate ?? '').match(/\d+(?:\.\d+)?/g)?.map(Number) ?? []
  if (rates.length > 0) return Math.max(...rates) / 100
  return ['受動', '指揮', '兵種', '陣法'].includes(skill.type) ? 1 : 0.4
}

const skillText = (skill: Skill): string => [
  skill.name_jp,
  skill.name,
  skill.description_jp,
  skill.brief_description_jp,
  skill.damage_type,
  skill.battle_type,
  ...(skill.tags ?? []),
  ...(skill.battle_tags ?? []),
].filter(Boolean).join(' ')

const addSkillFeatures = (features: Float32Array, skill: Skill): void => {
  const text = skillText(skill)
  const activation = parseActivationRate(skill)
  const damageRate = Math.max(0, Number(skill.damage_rate_max) || 0)
  const dotRate = Math.max(0, Number(skill.dot_rate_max) || 0) * Math.max(1, Number(skill.dot_turns) || 1)
  const healRate = Math.max(0, Number(skill.heal_rate_max) || 0)
  const physical = /兵刃|武勇|bravery|physical/.test(text)
  const strategy = /計略|知略|strategy/.test(text)
  const damagePower = (damageRate + dotRate * 0.65) * activation

  if (physical && strategy) {
    features[0] += damagePower * 0.5
    features[1] += damagePower * 0.5
  } else if (strategy) {
    features[1] += damagePower
  } else {
    features[0] += damagePower
  }
  features[4] += healRate * activation
  if (skill.control_type || /混乱|無策|封撃|麻痺|威圧|疲弊|挑発|牽制|萎縮|回復不可/.test(text)) {
    features[5] += 35 * activation * Math.max(1, Number(skill.control_turns) || 1)
  }
  if (/発動確率|先攻|連撃|必中|洞察/.test(text)) features[6] += 24 * activation
  if (/被ダメージ.*低下|防御|統率.*増加|援護/.test(text)) features[2] += 22 * activation
  if (/速度.*増加|先攻/.test(text)) features[3] += 16 * activation
}

const addBingxueFeatures = (
  features: Float32Array,
  active: BingxueActive,
  catalog: Record<string, BingxueOption>,
): void => {
  const selected = [
    active.major,
    ...active.minors.flatMap((minor) => Array.from({ length: minor.level }, () => minor.name)),
  ].filter((name): name is string => Boolean(name))

  for (const name of selected) {
    const option = catalog[name]
    const text = `${name} ${option?.description_jp ?? option?.description ?? ''}`
    if (/兵刃|武勇|会心|通常攻撃|突撃/.test(text)) features[0] += 14
    if (/計略|知略|奇策|能動/.test(text)) features[1] += 14
    if (/被ダメージ|統率|防御|援護|抵抗/.test(text)) features[2] += 12
    if (/速度|先攻|機動|早駆/.test(text)) features[3] += 12
    if (/回復|救援|離反|攻心|仁愛|恩顧/.test(text)) features[4] += 14
    if (/混乱|無策|封撃|麻痺|威圧|疲弊|挑発|牽制|萎縮|制御/.test(text)) features[5] += 12
    if (/発動確率|必中|洞察|果敢|活路|兵家/.test(text)) features[6] += 11
    features[7] += 3
  }
}

const lineupFeatures = (
  lineup: AiWorkerLineupSnapshot,
  catalog: AiGpuFeatureCatalog,
): Float32Array => {
  const features = new Float32Array(AI_GPU_FEATURE_COUNT)
  for (const roleKey of roleKeys) {
    const role = lineup[roleKey]
    if (!role.heroKey) continue
    features[0] += Number(role.stats.val) || 0
    features[1] += Number(role.stats.int) || 0
    features[2] += Number(role.stats.lea) || 0
    features[3] += Number(role.stats.spd) || 0
    features[7] += Math.min(Number(role.stats.val) || 0, Number(role.stats.int) || 0) * 0.08

    const hero = catalog.heroes.get(role.heroKey)
    const roleSkills = [
      hero?.unique_skill ? catalog.skills.get(hero.unique_skill) ?? null : null,
      role.skill1Key ? catalog.skills.get(role.skill1Key) ?? null : null,
      role.skill2Key ? catalog.skills.get(role.skill2Key) ?? null : null,
    ]
    roleSkills.forEach((skill) => {
      if (skill) addSkillFeatures(features, skill)
    })
    addBingxueFeatures(features, role.bingxue, catalog.bingxue)
  }
  return features
}

// WorkerからGPUへそのまま転送できる、連続したFloat32配列を作る。
export const buildAiGpuFeatureBatch = (
  lineups: AiWorkerLineupSnapshot[],
  catalog: AiGpuFeatureCatalog,
): Float32Array => {
  const features = new Float32Array(lineups.length * AI_GPU_FEATURE_COUNT)
  lineups.forEach((lineup, index) => {
    features.set(lineupFeatures(lineup, catalog), index * AI_GPU_FEATURE_COUNT)
  })
  return features
}
