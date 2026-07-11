import { HERO_LABELS } from '../data/heroLabels'
import type { Hero } from '../composables/useData'

export const heroLabels = (hero: Pick<Hero, 'name' | 'name_jp' | 'aliases'> | null | undefined): string[] => {
  if (!hero) return []

  const keys = [hero.name_jp, hero.name, ...(hero.aliases ?? [])].filter(Boolean) as string[]
  for (const key of keys) {
    const labels = HERO_LABELS[key]
    if (labels?.length) return labels
  }

  return []
}

export const allHeroLabels = (): string[] => {
  return [...new Set(Object.values(HERO_LABELS).flat())].sort((a, b) => a.localeCompare(b, 'ja'))
}
