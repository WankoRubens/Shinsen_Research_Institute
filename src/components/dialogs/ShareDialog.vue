<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="(v: boolean) => $emit('update:modelValue', v)"
    title="編成を共有"
    width="360px"
    align-center
  >
    <div class="flex flex-col gap-3">
      <div v-if="isLoggedIn" class="flex flex-col gap-1">
        <el-input
          :model-value="name"
          @update:model-value="(v: string) => $emit('update:name', v)"
          maxlength="50"
          placeholder="名稱（可選）"
          clearable
        />
        <p class="text-[11px] text-gray-400 leading-snug">
          この名前は「共有」一覧にだけ表示され、共有リンクや相手の画面には表示されません
        </p>
      </div>

      <div
        v-if="isLoggedIn"
        class="flex items-start justify-between gap-3 rounded border border-divider bg-highlight/50 px-3 py-2"
      >
        <div class="flex flex-col gap-0.5 min-w-0">
          <span class="text-sm">
            「<span class="font-bold">{{ displayName || '自分' }}</span> · <span class="font-bold">{{ groupName }}</span>」として公開共有
          </span>
          <span class="text-[11px] text-ink-mute leading-snug">
            <span class="font-bold">現在の部隊を共有</span> の場合のみ有効です。チェックすると公開「おすすめ編成」にも追加されます
          </span>
        </div>
        <el-switch v-model="asPublic" class="flex-shrink-0 mt-0.5" />
      </div>

      <el-button type="primary" plain size="large" @click="$emit('share', { scope: 'all', asPublic: false })" class="w-full !m-0">
        <div class="flex flex-col items-center">
          <span class="font-bold">すべて共有</span>
          <span class="text-xs opacity-80">全ての部隊 + 所持（バックアップ用）</span>
        </div>
      </el-button>
      <el-button type="success" plain size="large" @click="$emit('share', { scope: 'current', asPublic })" class="w-full !m-0">
        <div class="flex flex-col items-center">
          <span class="font-bold">現在の部隊を共有</span>
          <span class="text-xs opacity-80">現在編集中の1部隊のみ共有</span>
        </div>
      </el-button>
      <el-button type="warning" plain size="large" @click="$emit('share', { scope: 'inventory', asPublic: false })" class="w-full !m-0">
        <div class="flex flex-col items-center">
          <span class="font-bold">所持のみ共有</span>
          <span class="text-xs opacity-80">請教他人配將用</span>
        </div>
      </el-button>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

export type ShareScope = 'all' | 'current' | 'inventory'
export interface ShareEventPayload {
  scope: ShareScope
  asPublic: boolean
}

const props = defineProps<{
  modelValue: boolean
  name: string
  isLoggedIn: boolean
  displayName: string | null
  groupName: string
}>()
defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'update:name', v: string): void
  (e: 'share', payload: ShareEventPayload): void
}>()

const asPublic = ref(false)

// Reset on every open so a leftover toggle doesn't surprise a future share.
watch(() => props.modelValue, (now) => {
  if (now) asPublic.value = false
})
</script>
