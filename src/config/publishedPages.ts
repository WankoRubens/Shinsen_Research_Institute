export const ALL_PAGE_NAMES = [
  'lineup',
  'profiles',
  'groups',
  'shares',
  'proposals',
  'battleSim',
  'mockBattle',
  'aiLineup',
  'heroDb',
  'settings',
] as const

export type PageName = typeof ALL_PAGE_NAMES[number]

const configuredPages = import.meta.env.VITE_PUBLISHED_PAGES?.trim()
const publishedPages = new Set<PageName>(
  configuredPages
    ? configuredPages
      .split(',')
      .map((name) => name.trim())
      .filter((name): name is PageName => ALL_PAGE_NAMES.includes(name as PageName))
    : ALL_PAGE_NAMES,
)

export const isPagePublished = (name: PageName): boolean => publishedPages.has(name)
