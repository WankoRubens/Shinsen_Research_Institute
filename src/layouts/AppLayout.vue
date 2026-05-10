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
        @open-mobile-sidebar="dialogs.open('mobile-team-drawer')"
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
      />
      <button
        v-else
        class="md:hidden fixed top-3 left-3 z-50 w-9 h-9 rounded-full bg-white/90 border border-divider shadow flex items-center justify-center"
        @click="sidebarMobileOpen = true"
        aria-label="open menu"
      >
        <el-icon :size="18"><Menu /></el-icon>
      </button>
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Menu } from '@element-plus/icons-vue'
import AppSidebar from '../components/layout/AppSidebar.vue'
import LineupHeader, { type UserMenuCmd } from '../components/lineup-builder/LineupHeader.vue'
import { useLineups } from '../composables/useLineups'
import { useInventory } from '../composables/useInventory'
import { useTroopLevels } from '../composables/useTroopLevels'
import { useAuth } from '../composables/useAuth'
import { useActiveProfile } from '../composables/useActiveProfile'
import { useProfiles } from '../composables/useProfiles'
import { useDialogs } from '../composables/useDialogs'
import { useChangelog } from '../composables/useChangelog'
import { useData } from '../composables/useData'
import {
  createProfile, updateProfileInventory, type Profile,
} from '../lib/profiles'

const route = useRoute()
const router = useRouter()
const sidebarCollapsed = ref(false)
const sidebarMobileOpen = ref(false)

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
const { isLoggedIn, displayName, signOut } = useAuth()
const {
  activeProfile, activeProfileName, applyProfile, unloadProfile, syncActiveProfile, clearActiveProfile,
} = useActiveProfile()
const { profiles, refresh: refreshProfiles } = useProfiles()
const dialogs = useDialogs()
const { hasUnseen: hasUnseenChangelog } = useChangelog()
const { heroes, skills } = useData()

// CHT→JP name lookup so saved profiles stay translation-stable. Built once
// per data load via computed; the same logic exists in MyProfilesPanel — could
// be extracted to a shared util later (TODO post-i18n work).
const heroChtToJp = computed(() => new Map(heroes.value.map(h => [h.name, h.name_jp])))
const skillChtToJp = computed(() => new Map(skills.value.map(s => [s.name, s.name_jp])))
const inventoryAsJP = (h: string[], s: string[]): { inv_h: string[]; inv_s: string[] } => ({
  inv_h: h.map(n => heroChtToJp.value.get(n) ?? n),
  inv_s: s.map(n => skillChtToJp.value.get(n) ?? n),
})

const onApplyProfile = (id: string) => {
  if (isEditingInventory.value) {
    ElMessage.warning('請先儲存或取消庫存編輯')
    return
  }
  const p = profiles.value.find(x => x.id === id)
  if (!p) {
    ElMessage.error('找不到該角色配置，請重新整理頁面')
    return
  }
  applyProfile(p)
  ElMessage.success(`已套用「${p.name}」`)
}

const onUnloadProfile = () => {
  if (isEditingInventory.value) {
    ElMessage.warning('請先儲存或取消庫存編輯')
    return
  }
  unloadProfile()
  ElMessage.info('已切換為不使用任何角色配置')
}

// Commit the temp inventory to the active profile. saveInventory() copies
// temp → owned*, then we PATCH the row and re-sync local activeProfile so the
// pill / panel show the new counts immediately.
const onSaveInventoryToActive = async () => {
  const active = activeProfile.value
  if (!active) {
    ElMessage.error('沒有作用中的角色配置')
    return
  }
  saveInventory()
  try {
    const { inv_h, inv_s } = inventoryAsJP(ownedHeroes.value, ownedSkills.value)
    await updateProfileInventory(active.id, inv_h, inv_s)
    syncActiveProfile({ ...active, inv_h, inv_s, updated_at: new Date().toISOString() })
    void refreshProfiles().catch(() => { /* swallow */ })
    ElMessage.success(`已更新「${active.name}」`)
  } catch (e) {
    ElMessage.error(`儲存失敗：${(e as Error).message}`)
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
    ElMessage.success(`已建立並切換到「${name}」`)
  } catch (e) {
    ElMessage.error(`建立失敗：${(e as Error).message}`)
  }
}

const onUserMenu = async (cmd: UserMenuCmd) => {
  if (cmd === 'signout') {
    await signOut()
    clearActiveProfile()
    ElMessage.success('已登出')
  } else if (cmd === 'rename') {
    dialogs.open('rename')
  } else if (cmd === 'my-shares') {
    dialogs.open('my-shares')
  } else if (cmd === 'gacha-log') {
    dialogs.open('gacha-log')
  } else if (cmd === 'changelog') {
    dialogs.open('changelog')
  }
}
</script>
