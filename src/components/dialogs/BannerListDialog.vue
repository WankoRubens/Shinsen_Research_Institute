<template>
  <el-dialog
    v-model="visible"
    title="池清單"
    width="420px"
    align-center
    append-to-body
  >
    <div class="flex flex-col gap-2">
      <el-button type="primary" :icon="Plus" plain @click="openCreate">新增池</el-button>

      <p
        v-if="banners.length === 0"
        class="text-center text-gray-400 py-6 text-sm"
      >
        還沒有任何池
      </p>

      <div
        v-for="b in banners"
        :key="b.id"
        class="flex items-center gap-2 px-2.5 py-2 rounded border transition-colors cursor-pointer group"
        :class="b.id === currentBannerId
          ? 'border-orange-300 bg-orange-50'
          : 'border-gray-200 hover:bg-gray-50'"
        @click="onPick(b.id)"
      >
        <el-icon v-if="b.id === currentBannerId" class="text-orange-500 flex-shrink-0">
          <Star />
        </el-icon>
        <div class="flex-1 min-w-0">
          <div class="font-bold text-sm truncate">{{ b.name }}</div>
          <div class="text-[10px] text-gray-500">
            池內 {{ b.hero_pool.length }} 武將
          </div>
        </div>
        <div class="flex gap-1">
          <el-button
            size="small"
            :icon="Edit"
            plain
            @click.stop="startRename(b)"
          />
          <el-popconfirm
            title="刪除此池與其全部紀錄？無法復原。"
            confirm-button-text="刪除"
            cancel-button-text="取消"
            confirm-button-type="danger"
            @confirm="confirmDelete(b)"
          >
            <template #reference>
              <el-button
                size="small"
                :icon="Delete"
                type="danger"
                plain
                @click.stop=""
              />
            </template>
          </el-popconfirm>
        </div>
      </div>
    </div>

    <!-- Create sub-dialog -->
    <el-dialog
      v-model="createVisible"
      title="新增池"
      width="340px"
      align-center
      append-to-body
    >
      <el-input
        v-model="nameDraft"
        size="default"
        placeholder="例：S5 攻城武將池"
        maxlength="50"
        @keyup.enter="submitCreate"
        autofocus
      />
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitCreate">建立</el-button>
      </template>
    </el-dialog>

    <!-- Rename sub-dialog -->
    <el-dialog
      v-model="renameVisible"
      title="重命名池"
      width="340px"
      align-center
      append-to-body
    >
      <el-input
        v-model="nameDraft"
        size="default"
        maxlength="50"
        @keyup.enter="submitRename"
        autofocus
      />
      <template #footer>
        <el-button @click="renameVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitRename">儲存</el-button>
      </template>
    </el-dialog>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElButton, ElDialog, ElIcon, ElInput, ElMessage, ElPopconfirm } from 'element-plus'
import { Delete, Edit, Plus, Star } from '@element-plus/icons-vue'
import { useGachaLog, type GachaBanner } from '../../composables/useGachaLog'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'created'): void
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const {
  banners,
  currentBannerId,
  selectBanner,
  createBanner,
  renameBanner,
  deleteBanner,
} = useGachaLog()

const nameDraft = ref('')
const saving = ref(false)
const createVisible = ref(false)
const renameVisible = ref(false)
const renameTargetId = ref<string | null>(null)

const onPick = async (id: string): Promise<void> => {
  try {
    await selectBanner(id)
    visible.value = false
  } catch (e) {
    ElMessage.error(`切換失敗：${(e as Error).message}`)
  }
}

const openCreate = (): void => {
  nameDraft.value = ''
  createVisible.value = true
}

const submitCreate = async (): Promise<void> => {
  const name = nameDraft.value.trim()
  if (!name) {
    ElMessage.warning('請輸入名稱')
    return
  }
  saving.value = true
  try {
    await createBanner(name)
    createVisible.value = false
    visible.value = false
    emit('created')
  } catch (e) {
    ElMessage.error(`建立失敗：${(e as Error).message}`)
  } finally {
    saving.value = false
  }
}

const startRename = (b: GachaBanner): void => {
  renameTargetId.value = b.id
  nameDraft.value = b.name
  renameVisible.value = true
}

const submitRename = async (): Promise<void> => {
  if (!renameTargetId.value) return
  const name = nameDraft.value.trim()
  if (!name) return
  saving.value = true
  try {
    await renameBanner(renameTargetId.value, name)
    renameVisible.value = false
    ElMessage.success('已重命名')
  } catch (e) {
    ElMessage.error(`重命名失敗：${(e as Error).message}`)
  } finally {
    saving.value = false
  }
}

const confirmDelete = async (b: GachaBanner): Promise<void> => {
  try {
    await deleteBanner(b.id)
    ElMessage.success('已刪除')
  } catch (e) {
    ElMessage.error(`刪除失敗：${(e as Error).message}`)
  }
}
</script>
