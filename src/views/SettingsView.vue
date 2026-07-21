<template>
  <div class="flex-1 overflow-y-auto px-3 md:px-5 py-4">
    <div class="max-w-3xl flex flex-col gap-6">
      <section v-if="isAdmin" class="settings-card">
        <header class="settings-card__head">
          <div class="flex items-center gap-2">
            <h2 class="font-brand text-xl font-bold text-ink">機能アクセス管理</h2>
            <span class="access-count">認可者 {{ memberCount }}人</span>
          </div>
          <el-button
            :icon="Refresh"
            circle
            plain
            :loading="usersLoading"
            title="再読み込み"
            @click="loadAccessUsers"
          />
        </header>

        <el-input
          v-model="userSearch"
          :prefix-icon="Search"
          clearable
          placeholder="名前・メールで検索"
          class="mb-3"
        />

        <div v-if="usersLoading && !accessUsers.length" class="access-empty">
          読み込み中...
        </div>
        <div v-else-if="usersError" class="access-error">{{ usersError }}</div>
        <div v-else-if="!filteredAccessUsers.length" class="access-empty">
          該当するユーザーはいません。
        </div>
        <div v-else class="access-list">
          <div v-for="accessUser in filteredAccessUsers" :key="accessUser.userId" class="access-row">
            <div class="access-user">
              <strong>{{ accessUser.displayName }}</strong>
              <span v-if="accessUser.email">{{ accessUser.email }}</span>
              <span v-else-if="accessUser.provider">{{ accessUser.provider }}</span>
            </div>

            <div class="access-actions">
              <span class="access-role" :class="`access-role--${accessUser.accessRole}`">
                {{ roleLabel(accessUser.accessRole) }}
              </span>
              <el-button
                v-if="accessUser.accessRole === 'general'"
                type="primary"
                plain
                :icon="Check"
                :loading="updatingUserId === accessUser.userId"
                @click="changeAccess(accessUser, 'member')"
              >
                認可する
              </el-button>
              <el-button
                v-else-if="accessUser.accessRole === 'member'"
                type="danger"
                plain
                :icon="Close"
                :loading="updatingUserId === accessUser.userId"
                @click="changeAccess(accessUser, 'general')"
              >
                認可解除
              </el-button>
            </div>
          </div>
        </div>
      </section>

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
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Check, Close, Refresh, Search } from '@element-plus/icons-vue'
import { useAuth } from '../composables/useAuth'
import { useFeatureAccess } from '../composables/useFeatureAccess'
import { useGroupPersistence } from '../composables/useGroupPersistence'
import { useLocale } from '../composables/useLocale'
import {
  listFeatureAccessUsers,
  setFeatureAccessRole,
  type FeatureAccessUser,
} from '../lib/featureAccessAdmin'
import type { AppAccessRole } from '../config/publishedPages'

const { isLoggedIn } = useAuth()
const { isAdmin } = useFeatureAccess()
const { cloudSyncEnabled, cloudStatus, setCloudSyncEnabled } = useGroupPersistence()
const { t } = useLocale()

const accessUsers = ref<FeatureAccessUser[]>([])
const usersLoading = ref(false)
const usersError = ref('')
const userSearch = ref('')
const updatingUserId = ref<string | null>(null)

const memberCount = computed(() =>
  accessUsers.value.filter((user) => user.accessRole === 'member').length,
)

const filteredAccessUsers = computed(() => {
  const query = userSearch.value.trim().toLocaleLowerCase('ja')
  if (!query) return accessUsers.value
  return accessUsers.value.filter((user) =>
    `${user.displayName} ${user.email} ${user.provider}`.toLocaleLowerCase('ja').includes(query),
  )
})

const roleLabel = (role: AppAccessRole): string => {
  if (role === 'admin') return '管理者'
  if (role === 'member') return '認可者'
  return '一般'
}

const loadAccessUsers = async (): Promise<void> => {
  if (!isAdmin.value || usersLoading.value) return
  usersLoading.value = true
  usersError.value = ''
  try {
    accessUsers.value = await listFeatureAccessUsers()
  } catch (error) {
    usersError.value = error instanceof Error ? error.message : 'ユーザー一覧を取得できませんでした。'
  } finally {
    usersLoading.value = false
  }
}

const changeAccess = async (
  accessUser: FeatureAccessUser,
  role: 'member' | 'general',
): Promise<void> => {
  if (updatingUserId.value) return
  updatingUserId.value = accessUser.userId
  try {
    await setFeatureAccessRole(accessUser.userId, role)
    accessUser.accessRole = role
    ElMessage.success(role === 'member' ? '認可者に追加しました。' : '認可を解除しました。')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '権限を更新できませんでした。')
  } finally {
    updatingUserId.value = null
  }
}

watch(isAdmin, (admin) => {
  if (admin && !accessUsers.value.length) void loadAccessUsers()
}, { immediate: true })

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
.settings-card__head {
  justify-content: space-between;
}
.access-count {
  padding: 2px 8px;
  border-radius: 999px;
  background: rgb(var(--color-highlight));
  color: rgb(var(--color-ink-mute));
  font-size: 12px;
  font-weight: 600;
}
.access-list {
  border-top: 1px solid rgb(var(--color-divider));
}
.access-row {
  min-height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 0;
  border-bottom: 1px solid rgb(var(--color-divider));
}
.access-user {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.access-user strong,
.access-user span {
  overflow-wrap: anywhere;
}
.access-user strong {
  color: rgb(var(--color-ink));
  font-size: 14px;
}
.access-user span {
  color: rgb(var(--color-ink-mute));
  font-size: 12px;
}
.access-actions {
  flex: none;
  display: flex;
  align-items: center;
  gap: 10px;
}
.access-role {
  min-width: 50px;
  text-align: center;
  font-size: 12px;
  font-weight: 700;
}
.access-role--admin { color: #a54d00; }
.access-role--member { color: #147b54; }
.access-role--general { color: rgb(var(--color-ink-mute)); }
.access-empty,
.access-error {
  padding: 24px 4px;
  text-align: center;
  font-size: 13px;
}
.access-empty { color: rgb(var(--color-ink-mute)); }
.access-error { color: #c2413b; }

@media (max-width: 520px) {
  .settings-card {
    padding: 16px;
  }
  .access-row {
    align-items: flex-start;
    flex-direction: column;
  }
  .access-actions {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
