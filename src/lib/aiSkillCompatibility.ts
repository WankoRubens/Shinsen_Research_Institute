import type { Skill } from '../composables/useData'

export type SkillStatAffinity = 'physical' | 'strategy' | 'mixed' | 'neutral'

// AI編成では、武勇と知略の差がこの値以上なら単一系統の戦法を適性判定する。
export const AI_SKILL_STAT_GAP = 40

const skillEffectText = (skill: Skill): string => [
  skill.description_jp,
  skill.brief_description_jp,
  skill.commander_description_jp,
  skill.description,
  skill.brief_description,
  skill.commander_description,
].filter(Boolean).join(' ')

/**
 * 戦法の説明と構造化データから、武勇系・知略系のどちらに属するかを判定する。
 * 両方のダメージや依存能力を含む戦法は mixed、どちらも明示しない補助戦法は neutral とする。
 */
export const skillStatAffinity = (skill: Skill): SkillStatAffinity => {
  const text = skillEffectText(skill)
  const damageType = String(skill.damage_type ?? '')

  const hasPhysicalEffect = damageType === '兵刃'
    || /兵刃(?:与)?ダメージ/.test(text)
    || /(?:武勇|武力)[^。、「」\n]{0,10}依存/.test(text)
    || /\{scale:(?:武勇|武力)\}/.test(text)
  const hasStrategyEffect = /^(?:計略|謀略)$/.test(damageType)
    || /(?:計略|謀略)(?:与)?ダメージ/.test(text)
    || /(?:知略|知力|智略)[^。、「」\n]{0,10}依存/.test(text)
    || /\{scale:(?:知略|知力|智略)\}/.test(text)

  if (hasPhysicalEffect && hasStrategyEffect) return 'mixed'
  if (hasPhysicalEffect) return 'physical'
  if (hasStrategyEffect) return 'strategy'
  return 'neutral'
}

/**
 * 能力差が40未満なら制限しない。40以上なら、低い能力だけに依存する戦法を候補から外す。
 */
export const isAiSkillCompatibleWithStats = (
  skill: Skill,
  valor: number,
  intelligence: number,
): boolean => {
  const affinity = skillStatAffinity(skill)
  if (valor - intelligence >= AI_SKILL_STAT_GAP) return affinity !== 'strategy'
  if (intelligence - valor >= AI_SKILL_STAT_GAP) return affinity !== 'physical'
  return true
}
