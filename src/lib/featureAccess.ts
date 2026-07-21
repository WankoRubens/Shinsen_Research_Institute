import { getSession, getValidAccessToken } from './auth'
import { fetchWithTimeout, restHeaders, SUPABASE_URL } from './supabase'
import {
  isPageAccessControlEnabled,
  type AppAccessRole,
} from '../config/publishedPages'

const accessCache = new Map<string, AppAccessRole>()

/**
 * Check whether the signed-in user is registered for private-page access.
 * RLS only lets a user read their own row, so this endpoint does not reveal
 * the rest of the allow list.
 */
export const fetchAccessRole = async (userId: string): Promise<AppAccessRole> => {
  if (!isPageAccessControlEnabled) return 'admin'
  if (!SUPABASE_URL) return 'general'

  const cached = accessCache.get(userId)
  if (cached !== undefined) return cached

  const token = await getValidAccessToken()
  if (!token) return 'general'

  const url = `${SUPABASE_URL}/rest/v1/feature_access_users`
    + `?user_id=eq.${encodeURIComponent(userId)}&select=user_id,access_role&limit=1`
  const response = await fetchWithTimeout(url, {
    headers: restHeaders(token),
  })
  if (!response.ok) throw new Error(`feature access check failed: ${response.status}`)

  const rows = await response.json() as Array<{
    user_id: string
    access_role: string
  }>
  const row = rows.find((item) => item.user_id === userId)
  const role: AppAccessRole = row?.access_role === 'admin'
    ? 'admin'
    : row?.access_role === 'member'
      ? 'member'
      : 'general'
  accessCache.set(userId, role)
  return role
}

export const fetchCurrentUserAccessRole = async (): Promise<AppAccessRole> => {
  if (!isPageAccessControlEnabled) return 'admin'
  const userId = getSession()?.user.id
  if (!userId) return 'general'
  return fetchAccessRole(userId)
}

export const clearFeatureAccessCache = (): void => {
  accessCache.clear()
}
