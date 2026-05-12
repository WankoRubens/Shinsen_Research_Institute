<template>
  <div class="flex-1 overflow-y-auto p-4 md:p-6">
    <div class="max-w-4xl">
      <div v-if="!isLoggedIn" class="p-6 rounded-xl border border-dashed border-divider bg-white text-ink-soft">
        <p class="mb-3 text-sm">登入後才能建立、儲存、同步角色配置到雲端。</p>
        <el-button type="primary" @click="dialogs.open('auth')">登入 / 註冊</el-button>
      </div>

      <MyProfilesPanel v-else />
    </div>
  </div>
</template>

<script setup lang="ts">
import MyProfilesPanel from '../components/dialogs/MyProfilesPanel.vue'
import { useAuth } from '../composables/useAuth'
import { useDialogs } from '../composables/useDialogs'

const { isLoggedIn } = useAuth()
const dialogs = useDialogs()
</script>
