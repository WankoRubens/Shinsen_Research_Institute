<template>
  <div class="flex-1 overflow-y-auto p-6 md:p-10">
    <div class="max-w-4xl">
      <div class="text-xs text-ink-mute tracking-widest uppercase">庫存配置 / 角色快照</div>
      <h1 class="font-brand text-2xl md:text-3xl font-bold text-ink mt-1">角色管理</h1>
      <p class="mt-2 text-sm text-ink-mute leading-relaxed">
        每個角色配置是一份具名的庫存（武將 + 戰法）。可建立多份用於主帳 / 小號 / 朋友的庫存，套用後配將模擬會以該庫存為準。
      </p>

      <div v-if="!isLoggedIn" class="mt-6 p-6 rounded-xl border border-dashed border-divider bg-white text-ink-soft">
        <p class="mb-3 text-sm">登入後才能建立、儲存、同步角色配置到雲端。</p>
        <el-button type="primary" @click="dialogs.open('auth')">登入 / 註冊</el-button>
      </div>

      <div v-else class="mt-6 p-4 md:p-6 rounded-xl border border-divider bg-white">
        <MyProfilesPanel />
      </div>
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
