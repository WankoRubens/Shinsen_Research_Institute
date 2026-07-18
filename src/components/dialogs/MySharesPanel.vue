<template>
  <div v-loading="loading" class="min-h-[120px]">
    <p v-if="!loading && shares.length === 0" class="text-center text-gray-400 py-8 text-sm">
      まだ作成した共有はありません。<br>
      ログイン状態で「共有」ボタンから作成したリンクがここに表示されます。
    </p>
    <el-table v-else-if="shares.length > 0" :data="sortedShares" size="default" style="width: 100%">
      <el-table-column label="" width="44" align="center">
        <template #default="{ row }">
          <button
            @click="togglePin(row)"
            :title="row.pinned ? '固定を解除' : '上部に固定'"
            class="pin-btn"
            :class="{ 'pin-btn-on': row.pinned }"
          >
            <el-icon><component :is="row.pinned ? StarFilled : Star" /></el-icon>
          </button>
        </template>
      </el-table-column>
      <el-table-column label="名前" min-width="180">
        <template #default="{ row }">
          <div v-if="editingSlug === row.slug" class="flex items-center gap-1">
            <el-input
              v-model="editingDraft"
              size="small"
              maxlength="50"
              placeholder="名前を入力"
              @keyup.enter="saveName(row)"
              @keyup.esc="cancelEdit"
              autofocus
            />
            <el-button size="small" type="primary" :icon="Check" @click="saveName(row)" />
            <el-button size="small" :icon="Close" @click="cancelEdit" />
          </div>
          <div v-else class="flex items-center gap-2 group">
            <span :class="row.display_name ? 'text-gray-800' : 'text-gray-400 italic'">
              {{ row.display_name || '未命名' }}
            </span>
            <el-button
              text
              size="small"
              :icon="Edit"
              class="opacity-0 group-hover:opacity-100"
              @click="startEdit(row)"
            />
          </div>
        </template>
      </el-table-column>
      <el-table-column label="種類" width="110">
        <template #default="{ row }">
          <span class="kind-tag" :class="`kind-tag--${row.kind}`">
            {{ SHARE_KIND_LABELS[row.kind as ShareKind] ?? row.kind }}
          </span>
        </template>
      </el-table-column>
      <el-table-column label="リンク" width="160">
        <template #default="{ row }">
          <button
            @click="copyUrl(row.slug)"
            class="text-xs text-indigo-600 hover:text-indigo-800 hover:underline font-mono"
            title="クリックして共有リンクをコピー"
          >
            #s/{{ row.slug }}
          </button>
        </template>
      </el-table-column>
      <el-table-column label="更新" width="100">
        <template #default="{ row }">
          <span class="text-xs text-gray-500">{{ relativeTime(row.updated_at) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="" width="44" align="center">
        <template #default="{ row }">
          <el-button
            v-if="row.kind === 'lineup' || row.kind === 'group'"
            text
            size="small"
            :icon="View"
            title="預覽"
            @click="openPreview(row)"
          />
        </template>
      </el-table-column>
      <el-table-column label="" width="60" align="center">
        <template #default="{ row }">
          <el-popconfirm
            title="この共有を削除しますか？削除するとリンクはすぐ無効になります。"
            confirm-button-text="削除"
            cancel-button-text="キャンセル"
            confirm-button-type="danger"
            @confirm="remove(row)"
          >
            <template #reference>
              <el-button text size="small" type="danger" :icon="Delete" />
            </template>
          </el-popconfirm>
        </template>
      </el-table-column>
    </el-table>

    <el-drawer
      v-model="previewDrawerVisible"
      :title="previewTitle"
      direction="rtl"
      size="min(560px, 90vw)"
      :destroy-on-close="true"
    >
      <div v-loading="previewLoading" class="min-h-[200px]">
        <p v-if="!previewLoading && !preview && previewError" class="text-center text-red-500 text-sm py-8">
          {{ previewError }}
        </p>
        <TeamPreviewCard
          v-else-if="preview?.team"
          :team="preview.team"
          density="regular"
        />
        <GroupPreviewCard
          v-else-if="previewGroup"
          :group="previewGroup"
          density="compact"
        />
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Star, StarFilled, Edit, Delete, Check, Close, View } from '@element-plus/icons-vue'
import {
  listMyShares, loadShare, renameMyShare, pinMyShare, deleteMyShare,
  SHARE_KIND_LABELS, type MyShare, type ShareKind,
} from '../../lib/share'
import { relativeTime } from '../../lib/time'
import { useData } from '../../composables/useData'
import TeamPreviewCard from '../preview/TeamPreviewCard.vue'
import GroupPreviewCard from '../preview/GroupPreviewCard.vue'
import { hydrateShare, type HydratedShare } from '../preview/hydrateShare'
import type { ShareableData } from '../../constants/gameData'
import { isEmptyTeam } from '../../composables/useLineups'

const shares = ref<MyShare[]>([])
const loading = ref(false)
const editingSlug = ref<string | null>(null)
const editingDraft = ref('')

const sortedShares = computed(() =>
  [...shares.value].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    const aName = a.display_name?.trim() ?? ''
    const bName = b.display_name?.trim() ?? ''
    if (!!aName !== !!bName) return aName ? -1 : 1
    if (aName && bName) {
      const cmp = aName.localeCompare(bName, 'ja-JP')
      if (cmp !== 0) return cmp
    }
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  }),
)

const refresh = async () => {
  loading.value = true
  try {
    shares.value = await listMyShares()
  } catch (e) {
    ElMessage.error(`載入失敗：${(e as Error).message}`)
  } finally {
    loading.value = false
  }
}

onMounted(refresh)

const startEdit = (s: MyShare) => {
  editingSlug.value = s.slug
  editingDraft.value = s.display_name ?? ''
}

const cancelEdit = () => {
  editingSlug.value = null
  editingDraft.value = ''
}

const saveName = async (s: MyShare) => {
  const next = editingDraft.value.trim()
  if (next === (s.display_name ?? '').trim()) {
    cancelEdit()
    return
  }
  try {
    await renameMyShare(s.slug, next || null)
    s.display_name = next || null
    s.updated_at = new Date().toISOString()
    cancelEdit()
    ElMessage.success('更新しました')
  } catch (e) {
    ElMessage.error(`更新失敗：${(e as Error).message}`)
  }
}

const remove = async (s: MyShare) => {
  try {
    await deleteMyShare(s.slug)
    shares.value = shares.value.filter(x => x.slug !== s.slug)
    ElMessage.success('削除しました')
  } catch (e) {
    ElMessage.error(`削除に失敗しました: ${(e as Error).message}`)
  }
}

const togglePin = async (s: MyShare) => {
  const next = !s.pinned
  try {
    await pinMyShare(s.slug, next)
    s.pinned = next
    s.updated_at = new Date().toISOString()
  } catch (e) {
    ElMessage.error(`${next ? '固定' : '固定解除'}に失敗しました: ${(e as Error).message}`)
  }
}

const copyUrl = (slug: string) => {
  const url = `${window.location.origin}${window.location.pathname}#s/${slug}`
  navigator.clipboard.writeText(url).then(() => {
    ElMessage.success('リンクをコピーしました')
  }).catch(() => {
    ElMessage.error('複製失敗')
  })
}

// --- Preview drawer ---
const { heroes, skills } = useData()
const previewDrawerVisible = ref(false)
const previewLoading = ref(false)
const preview = ref<HydratedShare | null>(null)
const previewTitle = ref('')
const previewError = ref('')

// Filter empty team slots out of a group preview. If every team is empty
// (unusual for a share) we keep the original list so the drawer still has
// something to render rather than collapsing to nothing.
const previewGroup = computed(() => {
  const g = preview.value?.group
  if (!g) return null
  const filled = g.teams.filter(t => !isEmptyTeam(t))
  return {
    name: g.name,
    teams: filled.length > 0 ? filled : g.teams,
  }
})

const openPreview = async (s: MyShare) => {
  previewTitle.value = s.display_name || `#s/${s.slug}`
  preview.value = null
  previewError.value = ''
  previewDrawerVisible.value = true
  previewLoading.value = true
  try {
    const blob = (await loadShare(s.slug)) as ShareableData
    preview.value = hydrateShare(blob, { heroes: heroes.value, skills: skills.value })
    if (!preview.value.team && !preview.value.group) {
      previewError.value = 'この共有にはプレビューできる部隊内容がありません'
    }
  } catch (e) {
    previewError.value = `載入失敗：${(e as Error).message}`
  } finally {
    previewLoading.value = false
  }
}
</script>

<style scoped>
.pin-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: transparent;
  border: none;
  color: #cbd5e1;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}
.pin-btn:hover {
  background: #f1f5f9;
  color: #94a3b8;
}
.pin-btn-on,
.pin-btn-on:hover {
  color: #f59e0b;
}
.pin-btn-on:hover {
  background: #fef3c7;
}

.kind-tag {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  border: 1px solid;
  white-space: nowrap;
}
.kind-tag--lineup    { background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe; }
.kind-tag--group     { background: #faf5ff; color: #6d28d9; border-color: #ddd6fe; }
.kind-tag--inventory { background: #f0fdf4; color: #15803d; border-color: #bbf7d0; }
.kind-tag--profile   { background: #fef3c7; color: #b45309; border-color: #fcd34d; }
</style>
