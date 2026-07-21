import { computed, ref, watch } from 'vue'
import { useAuth } from './useAuth'
import { fetchAccessRole } from '../lib/featureAccess'
import {
  isPageAccessControlEnabled,
  type AppAccessRole,
} from '../config/publishedPages'

const accessRole = ref<AppAccessRole>(isPageAccessControlEnabled ? 'general' : 'admin')
const checkingFullAccess = ref(false)
let requestVersion = 0
let watcherStarted = false

const refreshFullAccess = async (userId?: string): Promise<void> => {
  const version = ++requestVersion

  if (!isPageAccessControlEnabled) {
    accessRole.value = 'admin'
    checkingFullAccess.value = false
    return
  }
  if (!userId) {
    accessRole.value = 'general'
    checkingFullAccess.value = false
    return
  }

  checkingFullAccess.value = true
  try {
    const role = await fetchAccessRole(userId)
    if (version === requestVersion) accessRole.value = role
  } catch (error) {
    console.warn('Unable to check private-page access:', error)
    if (version === requestVersion) accessRole.value = 'general'
  } finally {
    if (version === requestVersion) checkingFullAccess.value = false
  }
}

export function useFeatureAccess() {
  const { user } = useAuth()

  if (!watcherStarted) {
    watcherStarted = true
    watch(
      () => user.value?.id,
      (userId) => { void refreshFullAccess(userId) },
      { immediate: true },
    )
  }

  return {
    accessRole: computed(() => accessRole.value),
    hasFullAccess: computed(() => accessRole.value === 'admin' || accessRole.value === 'member'),
    isAdmin: computed(() => accessRole.value === 'admin'),
    checkingFullAccess: computed(() => checkingFullAccess.value),
    refreshFullAccess: () => refreshFullAccess(user.value?.id),
  }
}
