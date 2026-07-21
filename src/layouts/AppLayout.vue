<template>
  <div class="flex h-dvh w-full bg-white text-ink">
    <AppSidebar
      v-model:collapsed="sidebarCollapsed"
      v-model:mobileOpen="sidebarMobileOpen"
    />
    <main class="flex-1 min-w-0 flex flex-col overflow-hidden">
      <LineupHeader
        v-if="route.name === 'lineup'"
        v-model:team-name="currentTeamName"
        :total-cost="totalCost"
        :troop-levels="troopLevels"
        :is-editing-inventory="isEditingInventory"
        :is-logged-in="isLoggedIn"
        :has-unseen-changelog="hasUnseenChangelog"
        :display-name="displayName"
        :active-profile-name="activeProfileName"
        @open-mobile-sidebar="sidebarMobileOpen = true"
        @open-mobile-team-drawer="dialogs.open('mobile-team-drawer')"
        @start-editing-inventory="startEditingInventory"
        @cancel-editing-inventory="cancelEditingInventory"
        @save-inventory="saveInventory"
        @save-inventory-active="onSaveInventoryToActive"
        @save-inventory-new="onSaveInventoryToNew"
        @open-share="dialogs.open('share')"
        @open-reset="dialogs.open('reset')"
        @open-changelog="dialogs.open('changelog')"
        @open-auth="dialogs.open('auth')"
        @user-menu="onUserMenu"
        @apply-profile="onApplyProfile"
        @unload-profile="onUnloadProfile"
        @goto-profiles="router.push({ name: 'profiles' })"
        @import-from-link="dialogs.open('import-from-link')"
      />
      <PageHeader
        v-else
        :title="pageTitle"
        :description="pageDescription"
        :is-logged-in="isLoggedIn"
        :display-name="displayName"
        :has-unseen-changelog="hasUnseenChangelog"
        @open-mobile-sidebar="sidebarMobileOpen = true"
        @open-changelog="dialogs.open('changelog')"
        @open-auth="dialogs.open('auth')"
        @user-menu="onUserMenu"
      />
      <router-view />
    </main>

    <!-- User display-name rename dialog. Lives at the layout level so it's
         reachable from every page's UserControls menu, not just the lineup
         route. -->
    <RenameDialog
      v-model="renameDialogVisible"
      v-model:name="renameInput"
      :saving="renameSaving"
      @submit="submitRename"
    />

    <!-- Cloud-sync dialogs (Phase C). Live at the layout level so they
         surface regardless of which route the user is on when a merge /
         conflict needs resolving. -->
    <MergeOnSignInDialog />
    <CloudConflictDialog />

    <!-- Auth + changelog dialogs. Layout-level so login / 更新履歴 work
         from every route, not just the lineup builder. -->
    <ChangelogDialog v-model="changelogDialogVisible" />
    <AuthDialog v-model="authDialogVisible" @sign-in="onSignIn" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import AppSidebar from '../components/layout/AppSidebar.vue'
import LineupHeader from '../components/lineup-builder/LineupHeader.vue'
import PageHeader from '../components/layout/PageHeader.vue'
import RenameDialog from '../components/dialogs/RenameDialog.vue'
import MergeOnSignInDialog from '../components/dialogs/MergeOnSignInDialog.vue'
import CloudConflictDialog from '../components/dialogs/CloudConflictDialog.vue'
import ChangelogDialog from '../components/dialogs/ChangelogDialog.vue'
import AuthDialog from '../components/dialogs/AuthDialog.vue'
import type { UserMenuCmd } from '../components/layout/UserControls.vue'
import { useLineups } from '../composables/useLineups'
import { useInventory } from '../composables/useInventory'
import { useTroopLevels } from '../composables/useTroopLevels'
import { useAuth } from '../composables/useAuth'
import { useFeatureAccess } from '../composables/useFeatureAccess'
import { useActiveProfile } from '../composables/useActiveProfile'
import { useProfiles } from '../composables/useProfiles'
import { useDialogs } from '../composables/useDialogs'
import { useChangelog } from '../composables/useChangelog'
import { useLocale } from '../composables/useLocale'
import { useData } from '../composables/useData'
import { useGroupPersistence } from '../composables/useGroupPersistence'
import { makeSerializer } from '../lib/lineupSerialize'
import {
  createProfile, updateProfileInventory, type Profile,
} from '../lib/profiles'
import {
  canAccessPage,
  isPageAccessControlEnabled,
  isPageName,
} from '../config/publishedPages'

const route = useRoute()
const router = useRouter()
const sidebarCollapsed = ref(false)
const sidebarMobileOpen = ref(false)
const { t } = useLocale()

// Title / description for the shared PageHeader. Routes declare these
// statically via meta; the coming-soon page picks dynamic values per :topic.
const COMING_SOON_META: Record<string, { title: string; description: string }> = {
  'battle-sim': {
    title: '戦闘シミュレーション',
    description: '両軍の編成から戦闘の流れを自動で推演します。',
  },
  'hero-db': {
    title: '武将データベース',
    description: '各武将の属性、適性、おすすめ編成での人気度を横断比較します。編成提案ではなく、データ閲覧用のページです。現在開発中です。',
  },
}
const pageTitle = computed<string>(() => {
  if (route.name === 'battleSim') return t('battleSim')
  if (route.name === 'mockBattle') return t('mockBattle')
  if (route.name === 'settings') return t('settings')
  if (route.name === 'profiles') return t('profiles')
  if (route.name === 'groups') return t('groups')
  if (route.name === 'shares') return t('shares')
  if (route.name === 'proposals') return t('proposals')
  if (route.name === 'comingSoon') {
    const topic = String(route.params.topic ?? '')
    if (topic === 'hero-db') return t('heroDb')
    return COMING_SOON_META[topic]?.title ?? '準備中'
  }
  return String(route.meta.title ?? route.name ?? '')
})
const pageDescription = computed<string | undefined>(() => {
  if (route.name === 'battleSim') return t('battleDescription')
  if (route.name === 'mockBattle') return t('mockBattleDescription')
  if (route.name === 'settings') return t('settingsDescription')
  if (route.name === 'comingSoon') {
    const topic = String(route.params.topic ?? '')
    return COMING_SOON_META[topic]?.description ?? 'この機能はまだ公開されていません。'
  }
  const d = route.meta.description
  return typeof d === 'string' ? d : undefined
})

const { currentLineup, currentTeamName, totalCost } = useLineups()
const troopLevels = useTroopLevels(currentLineup)
const {
  isEditingInventory,
  startEditingInventory,
  cancelEditingInventory,
  saveInventory,
  ownedHeroes,
  ownedSkills,
} = useInventory()
const { isLoggedIn, displayName, signIn, signOut, updateDisplayName } = useAuth()
const { accessRole, checkingFullAccess } = useFeatureAccess()
const {
  activeProfile, activeProfileName, applyProfile, unloadProfile, syncActiveProfile, clearActiveProfile,
} = useActiveProfile()
const { profiles, refresh: refreshProfiles } = useProfiles()
const dialogs = useDialogs()
const { hasUnseen: hasUnseenChangelog, changelogDialogVisible } = useChangelog()
const { heroes, skills } = useData()
const { flushPendingCloudPush, flushLocalAutosave, snapshotForRecovery } = useGroupPersistence()

const authDialogVisible = dialogs.useDialog('auth')

// Signing out while a restricted page is open must immediately return the
// user to the public workspace; route guards only run during navigation.
watch(
  [() => route.name, accessRole, checkingFullAccess],
  ([routeName, role, checking]) => {
    if (
      isPageAccessControlEnabled
      && !checking
      && isPageName(routeName)
      && !canAccessPage(routeName, role)
    ) {
      void router.replace({ name: 'lineup' })
    }
  },
  { immediate: true },
)

// OAuth full-page redirect — snapshot in-progress lineup so the post-redirect
// mount can restore it. Snapshot itself is harmless from non-lineup routes
// (it just captures the current state, which on those routes is whatever
// the user last had in the builder).
const onSignIn = (provider: Parameters<typeof signIn>[0]) => {
  try {
    authDialogVisible.value = false
    snapshotForRecovery()
    signIn(provider)
  } catch (e) {
    authDialogVisible.value = true
    const message = (e as Error).message === 'auth not configured'
      ? 'ログイン設定がありません。.env に VITE_SUPABASE_URL を設定してください。'
      : `ログイン開始に失敗しました: ${(e as Error).message}`
    ElMessage.error(message)
  }
}

// CHT→JP name lookup so saved profiles stay translation-stable. Uses the
// shared serializer factory (which also handles aliases) so the mapping
// rules stay in one place — see lineupSerialize.ts.
const serializer = computed(() =>
  makeSerializer({ heroes: heroes.value, skills: skills.value }),
)
const inventoryAsJP = (h: string[], s: string[]): { inv_h: string[]; inv_s: string[] } => ({
  inv_h: h.map(n => serializer.value.toJpHero(n) ?? n),
  inv_s: s.map(n => serializer.value.toJpSkill(n) ?? n),
})

const onApplyProfile = (id: string) => {
  if (isEditingInventory.value) {
    ElMessage.warning('先に所持編集を保存またはキャンセルしてください')
    return
  }
  const p = profiles.value.find(x => x.id === id)
  if (!p) {
    ElMessage.error('対象の設定が見つかりません。ページを再読み込みしてください')
    return
  }
  applyProfile(p)
  ElMessage.success(`「${p.name}」を適用しました`)
}

const onUnloadProfile = () => {
  if (isEditingInventory.value) {
    ElMessage.warning('先に所持編集を保存またはキャンセルしてください')
    return
  }
  unloadProfile()
  ElMessage.info('所持設定を使用しない状態に切り替えました')
}

// Commit the temp inventory to the active profile. saveInventory() copies
// temp → owned*, then we PATCH the row and re-sync local activeProfile so the
// pill / panel show the new counts immediately.
const onSaveInventoryToActive = async () => {
  const active = activeProfile.value
  if (!active) {
    ElMessage.error('有効な所持設定がありません')
    return
  }
  saveInventory()
  try {
    const { inv_h, inv_s } = inventoryAsJP(ownedHeroes.value, ownedSkills.value)
    await updateProfileInventory(active.id, inv_h, inv_s)
    syncActiveProfile({ ...active, inv_h, inv_s, updated_at: new Date().toISOString() })
    void refreshProfiles().catch(() => { /* swallow */ })
    ElMessage.success(`「${active.name}」を更新しました`)
  } catch (e) {
    ElMessage.error(`保存に失敗しました: ${(e as Error).message}`)
  }
}

// Save current edits as a new profile and switch to it. saveInventory()
// commits the temp first; createProfile uses the freshly committed inventory.
const onSaveInventoryToNew = async (name: string) => {
  saveInventory()
  try {
    const { inv_h, inv_s } = inventoryAsJP(ownedHeroes.value, ownedSkills.value)
    const created: Profile = await createProfile({ name, inv_h, inv_s })
    applyProfile(created)
    void refreshProfiles().catch(() => { /* swallow */ })
    ElMessage.success(`「${name}」を作成して切り替えました`)
  } catch (e) {
    ElMessage.error(`作成に失敗しました: ${(e as Error).message}`)
  }
}

const renameDialogVisible = dialogs.useDialog('rename')
const renameInput = ref('')
const renameSaving = ref(false)
watch(renameDialogVisible, (now) => {
  if (now) renameInput.value = displayName.value ?? ''
})
const submitRename = async () => {
  const name = renameInput.value.trim()
  if (!name) {
    ElMessage.warning('名前は空にできません')
    return
  }
  renameSaving.value = true
  try {
    await updateDisplayName(name)
    renameDialogVisible.value = false
    ElMessage.success('名前を更新しました')
  } catch (e) {
    ElMessage.error(`更新に失敗しました: ${(e as Error).message}`)
  } finally {
    renameSaving.value = false
  }
}

const onUserMenu = async (cmd: UserMenuCmd) => {
  if (cmd === 'signout') {
    // Flush local FIRST (synchronous): the user's in-flight edits made within
    // ~800ms of clicking logout sit in the debounced autosave timer and would
    // otherwise be lost when the page transitions / reloads after signout.
    // Then flush cloud (async) so any pending push completes before the auth
    // token is invalidated.
    flushLocalAutosave()
    await flushPendingCloudPush()
    await signOut()
    clearActiveProfile()
    ElMessage.success('ログアウトしました')
  } else if (cmd === 'rename') {
    dialogs.open('rename')
  } else if (cmd === 'changelog') {
    dialogs.open('changelog')
  }
}
</script>
