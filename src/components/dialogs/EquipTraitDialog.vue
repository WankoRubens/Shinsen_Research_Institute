<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="(v: boolean) => $emit('update:modelValue', v)"
    title="選擇裝備特性"
    width="300px"
    align-center
    append-to-body
  >
    <div class="grid grid-cols-2 gap-2">
      <div
        v-for="opt in options"
        :key="opt.name"
        class="p-2 border rounded cursor-pointer hover:bg-gray-50 text-center text-xs"
        @click="$emit('select', opt)"
      >
        <div class="font-bold text-gray-700">{{ opt.name }}</div>
        <div class="text-[10px] text-gray-500">{{ opt.description }}</div>
      </div>
      <div
        class="p-2 border rounded cursor-pointer hover:bg-red-50 text-center text-xs text-red-500 border-red-100"
        @click="$emit('select', null)"
      >
        移除
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import type { Trait } from '../../composables/useData'

defineProps<{ modelValue: boolean; options: Trait[] }>()
defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'select', trait: Trait | null): void
}>()
</script>
