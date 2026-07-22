export const ALL_PAGE_NAMES = [
  'lineup',
  'freeLineup',
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

export type AppAccessRole = 'admin' | 'member' | 'general'

// Pages that remain available to every visitor on the public GitHub Pages
// build. Other published pages require an authenticated allow-list entry when
// VITE_PAGE_ACCESS_CONTROL is enabled.
export const PUBLIC_PAGE_NAMES: readonly PageName[] = [
  'lineup',
  'freeLineup',
  'profiles',
  'groups',
  'shares',
  'proposals',
  'heroDb',
]

const publicPages = new Set<PageName>(PUBLIC_PAGE_NAMES)
const adminOnlyPages = new Set<PageName>(['settings'])

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

export const isPagePublic = (name: PageName): boolean => publicPages.has(name)

export const isPageAccessControlEnabled =
  import.meta.env.VITE_PAGE_ACCESS_CONTROL?.trim().toLowerCase() === 'true'

export const requiresFullAccess = (name: PageName): boolean =>
  isPagePublished(name) && isPageAccessControlEnabled && !isPagePublic(name)

export const requiresAdminAccess = (name: PageName): boolean =>
  requiresFullAccess(name) && adminOnlyPages.has(name)

export const canAccessPage = (name: PageName, role: AppAccessRole): boolean => {
  if (!isPagePublished(name)) return false
  if (!isPageAccessControlEnabled || isPagePublic(name)) return true
  if (requiresAdminAccess(name)) return role === 'admin'
  return role === 'admin' || role === 'member'
}

export const isPageName = (value: unknown): value is PageName =>
  typeof value === 'string' && ALL_PAGE_NAMES.includes(value as PageName)
