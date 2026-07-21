import { getValidAccessToken } from './auth'
import { fetchWithTimeout, restHeaders, SUPABASE_URL } from './supabase'
import type { AppAccessRole } from '../config/publishedPages'

export interface FeatureAccessUser {
  userId: string
  displayName: string
  email: string
  provider: string
  accessRole: AppAccessRole
  lastSignInAt: string | null
}

interface FeatureAccessUserRow {
  user_id: string
  display_name: string | null
  email: string | null
  provider: string | null
  access_role: string | null
  last_sign_in_at: string | null
}

const adminRpc = async (name: string, body: Record<string, unknown>): Promise<Response> => {
  if (!SUPABASE_URL) throw new Error('Supabaseが設定されていません。')
  const token = await getValidAccessToken()
  if (!token) throw new Error('ログインが必要です。')

  return fetchWithTimeout(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { ...restHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export const listFeatureAccessUsers = async (): Promise<FeatureAccessUser[]> => {
  const response = await adminRpc('list_feature_access_users', {})
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`ユーザー一覧の取得に失敗しました (${response.status}): ${detail}`)
  }

  const rows = await response.json() as FeatureAccessUserRow[]
  return rows.map((row) => ({
    userId: row.user_id,
    displayName: row.display_name?.trim() || row.email?.split('@')[0] || 'ユーザー',
    email: row.email ?? '',
    provider: row.provider ?? '',
    accessRole: row.access_role === 'admin'
      ? 'admin'
      : row.access_role === 'member'
        ? 'member'
        : 'general',
    lastSignInAt: row.last_sign_in_at,
  }))
}

export const setFeatureAccessRole = async (
  userId: string,
  role: 'member' | 'general',
): Promise<void> => {
  const response = await adminRpc('set_feature_access_role', {
    p_user_id: userId,
    p_access_role: role,
  })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`権限の更新に失敗しました (${response.status}): ${detail}`)
  }
}
