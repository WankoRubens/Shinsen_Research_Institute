<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="(v: boolean) => $emit('update:modelValue', v)"
    title="我的分享"
    width="640px"
    align-center
  >
    <div v-loading="loading" class="min-h-[120px]">
      <p v-if="!loading && shares.length === 0" class="text-center text-gray-400 py-8 text-sm">
        還沒有任何已建立的分享。<br>
        登入狀態下用右上角「分享」建立的連結會自動顯示在這裡。
      </p>
      <el-table v-else-if="shares.length > 0" :data="sortedShares" size="default" style="width: 100%">
        <el-table-column label="" width="44" align="center">
          <template #default="{ row }">
            <button
              @click="$emit('toggle-pin', row)"
              :title="row.pinned ? '取消釘選' : '釘選到頂端'"
              class="pin-btn"
              :class="{ 'pin-btn-on': row.pinned }"
            >
              <el-icon><component :is="row.pinned ? StarFilled : Star" /></el-icon>
            </button>
          </template>
        </el-table-column>
        <el-table-column label="名稱" min-width="180">
          <template #default="{ row }">
            <div v-if="editingSlug === row.slug" class="flex items-center gap-1">
              <el-input
                :model-value="editingDraft"
                @update:model-value="(v: string) => $emit('update:editingDraft', v)"
                size="small"
                maxlength="50"
                placeholder="輸入名稱"
                @keyup.enter="$emit('save-name', row)"
                @keyup.esc="$emit('cancel-edit')"
                autofocus
              />
              <el-button size="small" type="primary" :icon="Check" @click="$emit('save-name', row)" />
              <el-button size="small" :icon="Close" @click="$emit('cancel-edit')" />
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
                @click="$emit('start-edit', row)"
              />
            </div>
          </template>
        </el-table-column>
        <el-table-column label="連結" width="160">
          <template #default="{ row }">
            <button
              @click="$emit('copy-url', row.slug)"
              class="text-xs text-indigo-600 hover:text-indigo-800 hover:underline font-mono"
              title="點擊複製分享連結"
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
        <el-table-column label="" width="60" align="center">
          <template #default="{ row }">
            <el-popconfirm
              title="確定刪除這個分享？刪除後連結會立刻失效。"
              confirm-button-text="刪除"
              cancel-button-text="取消"
              confirm-button-type="danger"
              @confirm="$emit('remove', row)"
            >
              <template #reference>
                <el-button text size="small" type="danger" :icon="Delete" />
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { Star, StarFilled, Edit, Delete, Check, Close } from '@element-plus/icons-vue'
import type { MyShare } from '../../lib/share'

defineProps<{
  modelValue: boolean
  loading: boolean
  shares: MyShare[]
  sortedShares: MyShare[]
  editingSlug: string | null
  editingDraft: string
  relativeTime: (iso: string) => string
}>()
defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'update:editingDraft', v: string): void
  (e: 'toggle-pin', share: MyShare): void
  (e: 'start-edit', share: MyShare): void
  (e: 'save-name', share: MyShare): void
  (e: 'cancel-edit'): void
  (e: 'copy-url', slug: string): void
  (e: 'remove', share: MyShare): void
}>()
</script>
