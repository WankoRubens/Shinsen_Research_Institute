<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="(v: boolean) => $emit('update:modelValue', v)"
    title="分享配置"
    width="340px"
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
          此名稱僅顯示於「我的分享」列表，不會出現在分享連結或對方畫面
        </p>
      </div>

      <el-button type="primary" plain size="large" @click="$emit('share', 'all')" class="w-full !m-0">
        <div class="flex flex-col items-center">
          <span class="font-bold">分享全部</span>
          <span class="text-xs opacity-80">所有隊伍 + 庫存 (備份用)</span>
        </div>
      </el-button>
      <el-button type="success" plain size="large" @click="$emit('share', 'current')" class="w-full !m-0">
        <div class="flex flex-col items-center">
          <span class="font-bold">分享當前隊伍</span>
          <span class="text-xs opacity-80">僅分享目前編輯的隊伍 1 隊</span>
        </div>
      </el-button>
      <el-button type="warning" plain size="large" @click="$emit('share', 'inventory')" class="w-full !m-0">
        <div class="flex flex-col items-center">
          <span class="font-bold">僅分享庫存</span>
          <span class="text-xs opacity-80">請教他人配將用</span>
        </div>
      </el-button>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
export type ShareScope = 'all' | 'current' | 'inventory'

defineProps<{
  modelValue: boolean
  name: string
  isLoggedIn: boolean
}>()
defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'update:name', v: string): void
  (e: 'share', scope: ShareScope): void
}>()
</script>
