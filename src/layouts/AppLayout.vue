<template>
  <div class="flex h-dvh w-full bg-parchment text-ink">
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
        @open-share="dialogs.open('share')"
        @open-reset="dialogs.open('reset')"
        @open-changelog="dialogs.open('changelog')"
        @open-auth="dialogs.open('auth')"
        @user-menu="onUserMenu"
      />
      <button
        v-else
        class="md:hidden fixed top-3 left-3 z-50 w-9 h-9 rounded-full bg-white/90 border border-parchment-dim shadow flex items-center justify-center"
        @click="sidebarMobileOpen = true"
        aria-label="open menu"
      >
        <el-icon :size="18"><Menu /></el-icon>
      </button>
      <router-view />
      <AppFooter />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Menu } from '@element-plus/icons-vue'
import AppSidebar from '../components/layout/AppSidebar.vue'
import AppFooter from '../components/lineup-builder/AppFooter.vue'
import LineupHeader, { type UserMenuCmd } from '../components/lineup-builder/LineupHeader.vue'
import { useLineups } from '../composables/useLineups'
import { useInventory } from '../composables/useInventory'
import { useTroopLevels } from '../composables/useTroopLevels'
import { useAuth } from '../composables/useAuth'
import { useActiveProfile } from '../composables/useActiveProfile'
import { useDialogs } from '../composables/useDialogs'
import { useChangelog } from '../composables/useChangelog'

const route = useRoute()
const sidebarCollapsed = ref(false)
const sidebarMobileOpen = ref(false)

const { currentLineup, currentTeamName, totalCost } = useLineups()
const troopLevels = useTroopLevels(currentLineup)
const {
  isEditingInventory,
  startEditingInventory,
  cancelEditingInventory,
  saveInventory,
} = useInventory()
const { isLoggedIn, displayName, signOut } = useAuth()
const { activeProfileName, clearActiveProfile } = useActiveProfile()
const dialogs = useDialogs()
const { hasUnseen: hasUnseenChangelog } = useChangelog()

const onUserMenu = async (cmd: UserMenuCmd) => {
  if (cmd === 'signout') {
    await signOut()
    clearActiveProfile()
    ElMessage.success('已登出')
  } else if (cmd === 'rename') {
    dialogs.open('rename')
  } else if (cmd === 'my-shares') {
    dialogs.open('my-shares')
  } else if (cmd === 'my-profiles') {
    dialogs.open('my-profiles')
  } else if (cmd === 'gacha-log') {
    dialogs.open('gacha-log')
  } else if (cmd === 'changelog') {
    dialogs.open('changelog')
  }
}
</script>
