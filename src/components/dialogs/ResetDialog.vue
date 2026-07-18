<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="(v: boolean) => $emit('update:modelValue', v)"
    title="リセット項目"
    width="320px"
    align-center
  >
    <div class="flex flex-col gap-3">
      <el-button type="danger" plain size="large" @click="$emit('confirm', 'team')" class="w-full !m-0">
        <div class="flex flex-col items-center">
          <span class="font-bold">現在の部隊をリセット</span>
          <span class="text-xs opacity-80">現在表示中の部隊だけを空にします</span>
        </div>
      </el-button>
      <el-button type="danger" plain size="large" @click="$emit('confirm', 'group')" class="w-full !m-0">
        <div class="flex flex-col items-center">
          <span class="font-bold">現在の編成をリセット</span>
          <span class="text-xs opacity-80">現在の編成内の全ての部隊を空にします</span>
        </div>
      </el-button>
      <el-button type="warning" plain size="large" @click="$emit('confirm', 'inventory')" class="w-full !m-0">
        <div class="flex flex-col items-center">
          <span class="font-bold">所持をクリア</span>
          <span class="text-xs opacity-80">この端末で所持済みにした武将と戦法を解除します</span>
        </div>
      </el-button>
      <el-button type="danger" size="large" @click="$emit('confirm', 'all')" class="w-full !m-0">
        <div class="flex flex-col items-center">
          <span class="font-bold">すべてリセット</span>
          <span class="text-xs opacity-80">全ての編成と所持を空にします（注意）</span>
        </div>
      </el-button>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
export type ResetTarget = 'team' | 'group' | 'inventory' | 'all'

defineProps<{ modelValue: boolean }>()
defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'confirm', target: ResetTarget): void
}>()
</script>
