<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="(v: boolean) => $emit('update:modelValue', v)"
    title="重置選項"
    width="320px"
    align-center
  >
    <div class="flex flex-col gap-3">
      <el-button type="danger" plain size="large" @click="$emit('confirm', 'current')" class="w-full !m-0">
        <div class="flex flex-col items-center">
          <span class="font-bold">重置當前隊伍</span>
          <span class="text-xs opacity-80">僅清空目前顯示的隊伍</span>
        </div>
      </el-button>
      <el-button type="warning" plain size="large" @click="$emit('confirm', 'inventory')" class="w-full !m-0">
        <div class="flex flex-col items-center">
          <span class="font-bold">清空庫存</span>
          <span class="text-xs opacity-80">移除所有已標記的擁有武將</span>
        </div>
      </el-button>
      <el-button type="danger" size="large" @click="$emit('confirm', 'all')" class="w-full !m-0">
        <div class="flex flex-col items-center">
          <span class="font-bold">全部重置</span>
          <span class="text-xs opacity-80">清空所有隊伍與庫存 (慎用)</span>
        </div>
      </el-button>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
export type ResetTarget = 'current' | 'inventory' | 'all'

defineProps<{ modelValue: boolean }>()
defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'confirm', target: ResetTarget): void
}>()
</script>
