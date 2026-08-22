import type { TroopType } from '../constants/traits'

export interface TroopSkillLike {
  name?: string | null
  name_jp?: string | null
  type?: string | null
  description?: string | null
  description_jp?: string | null
}

// 兵種戦法は、指定された部隊兵種を対応する特殊兵種へ進化させる。
// 戦法名を基準に持つことで、説明文の表記揺れに左右されず判定できる。
const TROOP_SKILL_REQUIREMENTS: Readonly<Record<string, TroopType>> = {
  三河弓兵隊: '弓兵',
  母衣武者: '騎兵',
  赤備え隊: '騎兵',
  薩摩鉄砲兵: '鉄砲',
  大太刀力士隊: '足軽',
  僧兵: '足軽',
  甲斐弓騎兵: '弓兵',
  鉄砲僧兵: '鉄砲',
  三河武士: '足軽',
  越後先手組: '騎兵',
  竜騎兵: '鉄砲',
  龍騎兵: '鉄砲',
  伊賀忍者: '弓兵',
}

export const requiredTroopTypeForSkill = (skill: TroopSkillLike): TroopType | null => {
  const name = skill.name_jp || skill.name || ''
  const namedRequirement = TROOP_SKILL_REQUIREMENTS[name]
  if (namedRequirement) return namedRequirement

  // 今後追加される兵種戦法は、日本語説明の冒頭から対応兵種を補完する。
  if (!/兵種|兵种/.test(String(skill.type ?? ''))) return null
  const description = String(skill.description_jp || skill.description || '').trim()
  if (/適応兵種[:：]\s*足軽|^足軽(?:が|を)/.test(description)) return '足軽'
  if (/適応兵種[:：]\s*弓兵|^弓兵(?:が|を)/.test(description)) return '弓兵'
  if (/適応兵種[:：]\s*騎兵|^騎兵(?:が|を)/.test(description)) return '騎兵'
  if (/適応兵種[:：]\s*鉄砲|^鉄砲(?:が|を)/.test(description)) return '鉄砲'
  if (/適応兵種[:：]\s*器械|^器械(?:が|を)/.test(description)) return '器械'
  return null
}

export const isSkillCompatibleWithTroopType = (
  skill: TroopSkillLike,
  troopType: TroopType | null,
): boolean => {
  if (!troopType) return true
  const requiredTroopType = requiredTroopTypeForSkill(skill)
  return requiredTroopType === null || requiredTroopType === troopType
}
