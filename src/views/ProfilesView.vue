<template>
  <div class="flex-1 overflow-y-auto p-4 md:p-6">
    <div class="max-w-4xl">
      <div v-if="!isLoggedIn" class="p-6 rounded-xl border border-dashed border-divider bg-white text-ink-soft">
        <p class="mb-3 text-sm">{{ t('loginRequiredProfiles') }}</p>
        <div class="flex items-center gap-2 flex-wrap">
          <el-button type="primary" @click="dialogs.open('auth')">{{ t('signInRegister') }}</el-button>
          <el-button :icon="Edit" @click="openLocalInventoryEditor">
            この端末で所持を編集
          </el-button>
        </div>
      </div>

      <MyProfilesPanel v-else />
    </div>
  </div>
</template>

<script setup lang="ts">
import { Edit } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import MyProfilesPanel from '../components/dialogs/MyProfilesPanel.vue'
import { useAuth } from '../composables/useAuth'
import { useDialogs } from '../composables/useDialogs'
import { useInventory } from '../composables/useInventory'
import { useLocale } from '../composables/useLocale'

const router = useRouter()
const { isLoggedIn } = useAuth()
const dialogs = useDialogs()
const { t } = useLocale()
const { isEditingInventory, startEditingInventory } = useInventory()

const openLocalInventoryEditor = async () => {
  if (!isEditingInventory.value) startEditingInventory()
  await router.push({ name: 'lineup' })
}
</script>
