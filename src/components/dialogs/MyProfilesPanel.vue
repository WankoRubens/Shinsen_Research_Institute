<template>
  <div v-loading="loading" class="min-h-[160px]">
    <!-- Header actions -->
    <div class="flex items-center gap-2 mb-3 flex-wrap">
      <el-button type="primary" :icon="Edit" @click="openInventoryEditor">
        所持武将・戦法を編集
      </el-button>
      <el-button type="primary" plain :icon="Plus" @click="openCreateDialog">
        現在の所持を新規設定として保存
      </el-button>
      <el-button :icon="Link" @click="openImportDialog">共有リンクから取り込む</el-button>
      <span v-if="!compact" class="ml-auto text-[11px] text-gray-400">
        所持設定には武将/戦法だけを保存します。部隊編成は含みません
      </span>
    </div>

    <p
      v-if="!loading && profiles.length === 0"
      class="text-center text-gray-400 py-8 text-sm"
    >
      まだ所持設定がありません。<br>
      上の「所持武将・戦法を編集」から所持内容を登録してください。
    </p>

    <el-table v-else-if="profiles.length > 0" :data="profiles" size="default" style="width: 100%">
      <el-table-column label="" width="44" align="center">
        <template #default="{ row }">
          <button
            @click="toggleDefault(row)"
            :title="row.is_default ? 'デフォルトを解除' : 'デフォルトに設定'"
            class="default-btn"
            :class="{ 'default-btn-on': row.is_default }"
          >
            <el-icon><component :is="row.is_default ? StarFilled : Star" /></el-icon>
          </button>
        </template>
      </el-table-column>

      <el-table-column label="名前" min-width="160">
        <template #default="{ row }">
          <div v-if="editingId === row.id" class="flex items-center gap-1">
            <el-input
              v-model="editingDraft"
              size="small"
              maxlength="50"
              placeholder="名前を入力"
              @keyup.enter="saveRename(row)"
              @keyup.esc="cancelRename"
              autofocus
            />
            <el-button size="small" type="primary" :icon="Check" @click="saveRename(row)" />
            <el-button size="small" :icon="Close" @click="cancelRename" />
          </div>
          <div v-else class="flex items-center gap-2 group">
            <span class="text-gray-800 font-medium truncate">{{ row.name }}</span>
            <span
              v-if="activeProfileId === row.id"
              class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 flex-shrink-0"
            >使用中</span>
            <el-button
              text
              size="small"
              :icon="Edit"
              class="opacity-0 group-hover:opacity-100"
              @click="startRename(row)"
            />
          </div>
        </template>
      </el-table-column>

      <el-table-column label="所持" width="120" align="center">
        <template #default="{ row }">
          <div class="text-xs text-gray-500 leading-tight">
            <div>{{ row.inv_h.length }} 武将</div>
            <div>{{ row.inv_s.length }} 戦法</div>
          </div>
        </template>
      </el-table-column>

      <el-table-column label="更新" width="90">
        <template #default="{ row }">
          <span class="text-xs text-gray-500">{{ relativeTime(row.updated_at) }}</span>
        </template>
      </el-table-column>

      <el-table-column label="" width="200" align="right">
        <template #default="{ row }">
          <div class="flex items-center justify-end gap-1">
            <el-button
              size="small"
              type="primary"
              @click="onApplyClick(row)"
            >
              適用
            </el-button>
            <el-tooltip content="この設定の共有リンクをコピー" placement="top">
              <el-button size="small" :icon="Share" @click="shareProfileLink(row)" />
            </el-tooltip>
            <el-popconfirm
              title="この設定を削除しますか？削除後は元に戻せません。"
              confirm-button-text="削除"
              cancel-button-text="キャンセル"
              confirm-button-type="danger"
              @confirm="removeProfile(row)"
            >
              <template #reference>
                <el-button size="small" type="danger" :icon="Delete" />
              </template>
            </el-popconfirm>
          </div>
        </template>
      </el-table-column>
    </el-table>

    <!-- Create-profile sub-dialog (asks for name) -->
    <el-dialog
      v-model="createDialogVisible"
      title="現在の所持を保存"
      width="340px"
      align-center
      append-to-body
    >
      <div class="flex flex-col gap-3 pb-1">
        <p class="text-xs text-gray-500 -mt-1 leading-relaxed">
          現在の所持（{{ ownedHeroes.length }} 武将, {{ ownedSkills.length }} 戦法）を新規設定として保存します
        </p>
        <el-input
          v-model="createName"
          maxlength="50"
          show-word-limit
          placeholder="例：メイン、サブ、友人A"
          @keyup.enter="submitCreate"
          autofocus
        />
        <el-checkbox v-model="createAsDefault">デフォルト設定にする</el-checkbox>
        <el-button
          type="primary"
          :loading="createSaving"
          @click="submitCreate"
          class="w-full !m-0"
        >
          保存
        </el-button>
      </div>
    </el-dialog>

    <!-- Import-from-share-link sub-dialog -->
    <el-dialog
      v-model="importDialogVisible"
      title="共有リンクから所持設定を取り込む"
      width="380px"
      align-center
      append-to-body
    >
      <div class="flex flex-col gap-3 pb-1">
        <p class="text-xs text-gray-500 -mt-1 leading-relaxed">
          相手から共有されたリンクを貼り付けてください（所持情報を含むリンクのみ）。取り込み後、あなたの所持設定として保存されます。
        </p>
        <el-input
          v-model="importUrl"
          placeholder="https://...#s/xxx または https://...#xxxx"
          clearable
          autofocus
        />
        <el-input
          v-model="importName"
          maxlength="50"
          show-word-limit
          placeholder="この設定の名前（必須）"
          @keyup.enter="submitImport"
        />
        <el-button
          type="primary"
          :loading="importLoading"
          @click="submitImport"
          class="w-full !m-0"
        >
          取り込む
        </el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Plus, Link, Edit, Close, Check, Delete, Star, StarFilled, Share,
} from '@element-plus/icons-vue'
import {
  createProfile, renameProfile,
  setDefaultProfile, deleteProfile, type Profile,
} from '../../lib/profiles'
import { getOrCreateProfileShareSlug } from '../../composables/useProfiles'
import { relativeTime } from '../../lib/time'
import { loadShare } from '../../lib/share'
import { makeSerializer } from '../../lib/lineupSerialize'
import { useData } from '../../composables/useData'
import { useInventory } from '../../composables/useInventory'
import { useActiveProfile } from '../../composables/useActiveProfile'
import { useProfiles } from '../../composables/useProfiles'

withDefaults(defineProps<{ compact?: boolean }>(), { compact: false })
const emit = defineEmits<{ (e: 'close-request'): void }>()

const { heroes, skills } = useData()
const router = useRouter()
const {
  ownedHeroes, ownedSkills, ownedHeroBreakthroughs, isEditingInventory, startEditingInventory,
} = useInventory()
const {
  applyProfile, syncActiveProfile, activeProfileId, activeProfile,
} = useActiveProfile()
const { profiles, loading, refresh } = useProfiles()

// Inline rename
const editingId = ref<string | null>(null)
const editingDraft = ref('')

// Create-profile sub-dialog
const createDialogVisible = ref(false)
const createName = ref('')
const createAsDefault = ref(false)
const createSaving = ref(false)

// Import-from-share-link sub-dialog
const importDialogVisible = ref(false)
const importUrl = ref('')
const importName = ref('')
const importLoading = ref(false)

// Open the lineup builder directly in inventory-management mode so users do
// not have to discover the profile dropdown before registering owned items.
const openInventoryEditor = async () => {
  if (!isEditingInventory.value) startEditingInventory()
  emit('close-request')
  await router.push({ name: 'lineup' })
}

// Share the serializer factory with AppLayout / LineupBuilder so alias
// handling stays consistent across all CHT→JP profile-stable mappings.
const serializer = computed(() =>
  makeSerializer({ heroes: heroes.value, skills: skills.value }),
)

const currentInventoryAsJP = (): { inv_h: string[]; inv_s: string[]; inv_bt: Record<string, number> } => ({
  inv_h: ownedHeroes.value.map(n => serializer.value.toJpHero(n) ?? n),
  inv_s: ownedSkills.value.map(n => serializer.value.toJpSkill(n) ?? n),
  inv_bt: Object.fromEntries(
    Object.entries(ownedHeroBreakthroughs.value)
      .filter(([, count]) => count > 0)
      .map(([hero, count]) => [serializer.value.toJpHero(hero) ?? hero, count]),
  ),
})

const safeRefresh = async () => {
  try {
    await refresh()
  } catch (e) {
    ElMessage.error(`読み込みに失敗しました: ${(e as Error).message}`)
  }
}

onMounted(safeRefresh)

const openCreateDialog = () => {
  if (isEditingInventory.value) {
    ElMessage.warning('先に所持編集を保存またはキャンセルしてください')
    return
  }
  createName.value = ''
  createAsDefault.value = profiles.value.length === 0
  createDialogVisible.value = true
}

const submitCreate = async () => {
  const name = createName.value.trim()
  if (!name) {
    ElMessage.warning('名前は空にできません')
    return
  }
  createSaving.value = true
  try {
    const { inv_h, inv_s, inv_bt } = currentInventoryAsJP()
    const created = await createProfile({ name, inv_h, inv_s, inv_bt })
    let defaultMarkFailed = false
    if (createAsDefault.value) {
      try {
        await setDefaultProfile(created.id)
      } catch (e) {
        defaultMarkFailed = true
        console.warn('[profiles] setDefault after create failed:', e)
      }
    }
    createDialogVisible.value = false
    if (defaultMarkFailed) {
      ElMessage.warning(`「${name}」は保存しましたが、デフォルト設定にできませんでした。手動で星をクリックしてください`)
    } else {
      ElMessage.success(`「${name}」を保存しました`)
    }
    safeRefresh()
  } catch (e) {
    ElMessage.error(`保存に失敗しました: ${(e as Error).message}`)
  } finally {
    createSaving.value = false
  }
}

const onApplyClick = async (p: Profile) => {
  if (isEditingInventory.value) {
    ElMessage.warning('先に所持編集を保存またはキャンセルしてください')
    return
  }
  const wouldOverwriteData = activeProfileId.value !== p.id &&
    (ownedHeroes.value.length > 0 || ownedSkills.value.length > 0)
  if (wouldOverwriteData) {
    try {
      await ElMessageBox.confirm(
        `「${p.name}」で現在の所持（${p.inv_h.length} 武将, ${p.inv_s.length} 戦法）を上書きしますか？現在の所持を設定として保存していない場合は失われます。`,
        '所持設定を適用',
        { confirmButtonText: '適用', cancelButtonText: 'キャンセル', type: 'warning' },
      )
    } catch {
      return
    }
  }
  applyProfile(p)
  ElMessage.success(`「${p.name}」を適用しました`)
  emit('close-request')
}

// Mint (or reuse) a short slug-based share URL for this profile's inventory.
// useProfiles caches the slug per profile within the session and invalidates
// on inventory fingerprint change, so spam-clicking only writes once.
const shareProfileLink = async (p: Profile) => {
  try {
    const slug = await getOrCreateProfileShareSlug(p)
    const url = `${location.origin}${location.pathname}#s/${slug}`
    await navigator.clipboard.writeText(url)
    ElMessage.success(`「${p.name}」の共有リンクをコピーしました`)
  } catch (e) {
    ElMessage.error(`共有に失敗しました: ${(e as Error).message}`)
  }
}

const removeProfile = async (p: Profile) => {
  try {
    await deleteProfile(p.id)
    profiles.value = profiles.value.filter(x => x.id !== p.id)
    if (activeProfile.value?.id === p.id) syncActiveProfile(null)
    ElMessage.success('削除しました')
  } catch (e) {
    ElMessage.error(`削除に失敗しました: ${(e as Error).message}`)
  }
}

const toggleDefault = async (p: Profile) => {
  try {
    await setDefaultProfile(p.is_default ? null : p.id)
    safeRefresh()
  } catch (e) {
    ElMessage.error(`設定に失敗しました: ${(e as Error).message}`)
  }
}

const startRename = (p: Profile) => {
  editingId.value = p.id
  editingDraft.value = p.name
}
const cancelRename = () => {
  editingId.value = null
  editingDraft.value = ''
}
const saveRename = async (p: Profile) => {
  const next = editingDraft.value.trim()
  if (!next) {
    ElMessage.warning('名前は空にできません')
    return
  }
  if (next === p.name) {
    cancelRename()
    return
  }
  try {
    await renameProfile(p.id, next)
    p.name = next
    p.updated_at = new Date().toISOString()
    if (activeProfile.value?.id === p.id) syncActiveProfile({ ...p })
    cancelRename()
    ElMessage.success('更新しました')
  } catch (e) {
    ElMessage.error(`更新に失敗しました: ${(e as Error).message}`)
  }
}

const openImportDialog = () => {
  if (isEditingInventory.value) {
    ElMessage.warning('先に所持編集を保存またはキャンセルしてください')
    return
  }
  importUrl.value = ''
  importName.value = ''
  importDialogVisible.value = true
}

const parseShareInput = (input: string): { slug?: string; base64?: string } => {
  let payload = input.trim()
  const hashIdx = payload.indexOf('#')
  if (hashIdx >= 0) payload = payload.slice(hashIdx + 1)
  payload = payload.replace(/^\//, '')
  if (!payload) throw new Error('リンクが空です')
  if (payload.startsWith('s/')) return { slug: payload.slice(2) }
  return { base64: payload }
}

interface ShareBlobLike {
  inv_h?: unknown
  inv_s?: unknown
  inv_bt?: unknown
  inventory?: unknown
}

const submitImport = async () => {
  const url = importUrl.value.trim()
  const name = importName.value.trim()
  if (!url) {
    ElMessage.warning('共有リンクを貼り付けてください')
    return
  }
  if (!name) {
    ElMessage.warning('設定名を入力してください')
    return
  }
  importLoading.value = true
  try {
    const parsed = parseShareInput(url)
    let blob: ShareBlobLike
    if (parsed.slug) {
      blob = (await loadShare(parsed.slug)) as ShareBlobLike
    } else {
      const json = decodeURIComponent(escape(atob(parsed.base64!)))
      blob = JSON.parse(json) as ShareBlobLike
    }
    const inv_h = Array.isArray(blob.inv_h) ? blob.inv_h.filter((x): x is string => typeof x === 'string')
      : Array.isArray(blob.inventory) ? blob.inventory.filter((x): x is string => typeof x === 'string')
      : []
    const inv_s = Array.isArray(blob.inv_s) ? blob.inv_s.filter((x): x is string => typeof x === 'string') : []
    const inv_bt: Record<string, number> = {}
    if (blob.inv_bt && typeof blob.inv_bt === 'object' && !Array.isArray(blob.inv_bt)) {
      for (const [hero, rawCount] of Object.entries(blob.inv_bt as Record<string, unknown>)) {
        const count = Math.min(5, Math.max(0, Math.trunc(Number(rawCount) || 0)))
        if (count > 0) inv_bt[hero] = count
      }
    }
    if (inv_h.length === 0 && inv_s.length === 0) {
      throw new Error('リンク内に所持データがありません')
    }
    await createProfile({ name, inv_h, inv_s, inv_bt })
    importDialogVisible.value = false
    ElMessage.success(`「${name}」を取り込みました（${inv_h.length} 武将, ${inv_s.length} 戦法）`)
    safeRefresh()
  } catch (e) {
    ElMessage.error(`取り込みに失敗しました: ${(e as Error).message}`)
  } finally {
    importLoading.value = false
  }
}

</script>

<style scoped>
.default-btn {
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
.default-btn:hover {
  background: #f1f5f9;
  color: #94a3b8;
}
.default-btn-on,
.default-btn-on:hover {
  color: #f59e0b;
}
.default-btn-on:hover {
  background: #fef3c7;
}
</style>
