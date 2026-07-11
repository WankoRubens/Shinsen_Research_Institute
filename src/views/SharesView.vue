<template>
  <div class="flex-1 overflow-y-auto p-4 md:p-6">
    <div class="max-w-5xl">
      <div v-if="!isLoggedIn" class="p-6 rounded-xl border border-dashed border-divider bg-white text-ink-soft">
        <p class="mb-3 text-sm">{{ t('loginRequiredShares') }}</p>
        <el-button type="primary" @click="dialogs.open('auth')">{{ t('signInRegister') }}</el-button>
      </div>

      <MySharesPanel v-else />
    </div>
  </div>
</template>

<script setup lang="ts">
import MySharesPanel from '../components/dialogs/MySharesPanel.vue'
import { useAuth } from '../composables/useAuth'
import { useDialogs } from '../composables/useDialogs'
import { useLocale } from '../composables/useLocale'

const { isLoggedIn } = useAuth()
const dialogs = useDialogs()
const { t } = useLocale()
</script>
