<template>
  <div class="flex-1 overflow-y-auto p-6 md:p-10">
    <div class="max-w-5xl">
      <div class="text-xs text-ink-mute tracking-widest uppercase">已建立的分享連結</div>
      <h1 class="font-brand text-2xl md:text-3xl font-bold text-ink mt-1">我的分享</h1>
      <p class="mt-2 text-sm text-ink-mute leading-relaxed">
        所有已建立的分享連結。可釘選到頂端、命名、複製連結、刪除。
      </p>

      <div v-if="!isLoggedIn" class="mt-6 p-6 rounded-xl border border-dashed border-divider bg-white text-ink-soft">
        <p class="mb-3 text-sm">登入後分享的連結會列在這裡，方便管理與重複使用。</p>
        <el-button type="primary" @click="dialogs.open('auth')">登入 / 註冊</el-button>
      </div>

      <div v-else class="mt-6 p-4 md:p-6 rounded-xl border border-divider bg-white">
        <MySharesPanel />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import MySharesPanel from '../components/dialogs/MySharesPanel.vue'
import { useAuth } from '../composables/useAuth'
import { useDialogs } from '../composables/useDialogs'

const { isLoggedIn } = useAuth()
const dialogs = useDialogs()
</script>
