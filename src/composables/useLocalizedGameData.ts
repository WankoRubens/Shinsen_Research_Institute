import type { Hero, Skill, Trait } from './useData'

export function useLocalizedGameData() {
  const skillName = (skill: Skill | null | undefined): string =>
    skill?.name_jp || skill?.name || ''

  const skillDescription = (skill: Skill | null | undefined): string =>
    skill?.description_jp || ''

  const skillCommanderDescription = (skill: Skill | null | undefined): string =>
    skill?.commander_description_jp || ''

  const skillBriefDescription = (skill: Skill | null | undefined): string =>
    skill?.brief_description_jp || ''

  const heroName = (hero: Hero | null | undefined): string =>
    hero?.name_jp || hero?.name || ''

  const traitName = (trait: Trait | null | undefined): string =>
    trait?.name_jp || trait?.name || ''

  const traitDescription = (trait: Trait | null | undefined): string =>
    trait?.description_jp || ''

  return {
    skillName,
    skillDescription,
    skillCommanderDescription,
    skillBriefDescription,
    heroName,
    traitName,
    traitDescription,
  }
}
