<template>
  <div class="flex-1 overflow-y-auto px-3 md:px-5 py-4">
    <div class="max-w-3xl flex flex-col gap-6">
      <section class="settings-card">
        <header class="settings-card__head">
          <h2 class="font-brand text-xl font-bold text-ink">{{ t('cloudSync') }}</h2>
          <span class="text-sm text-ink-mute">{{ t('cloudSyncHelp') }}</span>
        </header>

        <div v-if="!isLoggedIn" class="text-base text-ink-mute">
          {{ t('cloudSignInHelp') }}
        </div>

        <template v-else>
          <div class="flex items-center justify-between flex-wrap gap-3">
            <div class="flex flex-col gap-1.5 min-w-0 flex-1">
              <span class="text-base" :class="statusClass">{{ statusLabel }}</span>
            </div>
            <el-switch
              v-model="syncOn"
              :loading="cloudStatus === 'syncing'"
              size="large"
              inline-prompt
              :active-text="t('enabled')"
              :inactive-text="t('disabled')"
            />
          </div>

          <ul class="settings-card__notes">
            <li>{{ t('cloudNoteLocal') }}</li>
            <li>{{ t('cloudNoteConflict') }}</li>
            <li>{{ t('cloudNoteShare') }}</li>
          </ul>
        </template>
      </section>

      <section class="settings-card">
        <header class="settings-card__head">
          <h2 class="font-brand text-xl font-bold text-ink">{{ t('otherSettings') }}</h2>
          <span class="text-sm text-ink-mute">{{ t('otherSettingsHelp') }}</span>
        </header>
        <p class="text-base text-ink-mute">{{ t('comingLater') }}</p>
      </section>

      <section class="settings-card">
        <header class="settings-card__head">
          <h2 class="font-brand text-xl font-bold text-ink">参考情報</h2>
          <span class="text-sm text-ink-mute">データ・ロジックの参照元</span>
        </header>
        <p class="text-base text-ink-mute">
          戦闘シミュレーションのロジック検討では nobunaga-shinsen-sim.jp を参考にしています。
        </p>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAuth } from '../composables/useAuth'
import { useGroupPersistence } from '../composables/useGroupPersistence'
import { useLocale } from '../composables/useLocale'

const { isLoggedIn } = useAuth()
const { cloudSyncEnabled, cloudStatus, setCloudSyncEnabled } = useGroupPersistence()
const { t } = useLocale()

const syncOn = computed({
  get: () => cloudSyncEnabled.value,
  set: (v) => setCloudSyncEnabled(v),
})

const statusLabel = computed(() => {
  if (!cloudSyncEnabled.value) return t('cloudOff')
  switch (cloudStatus.value) {
    case 'syncing': return t('cloudSyncing')
    case 'conflict': return t('cloudConflict')
    case 'offline': return t('cloudOffline')
    case 'error': return t('cloudError')
    case 'idle':
    default: return t('cloudIdle')
  }
})

const statusClass = computed(() => {
  if (!cloudSyncEnabled.value) return 'text-ink-mute'
  switch (cloudStatus.value) {
    case 'syncing': return 'text-focus'
    case 'conflict':
    case 'error': return 'text-red-600'
    case 'offline': return 'text-amber-700'
    default: return 'text-ink-mute'
  }
})
</script>

<style scoped>
.settings-card {
  background: #ffffff;
  border: 1px solid rgb(var(--color-divider));
  border-radius: 8px;
  padding: 20px 22px;
}
.settings-card__head {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgb(var(--color-divider));
  flex-wrap: wrap;
}
.settings-card__notes {
  list-style: disc;
  padding-left: 22px;
  margin: 16px 0 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  line-height: 1.55;
  color: rgb(var(--color-ink-mute, 148 163 184));
}
</style>
