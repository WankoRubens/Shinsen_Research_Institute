<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="(v: boolean) => $emit('update:modelValue', v)"
    title="設定顯示名稱"
    width="340px"
    align-center
  >
    <div class="flex flex-col gap-3 pb-1">
      <p class="text-xs text-gray-500 -mt-1 mb-1">
        目前無實際功能，只是修改電腦版能看到的自訂名稱，未來考慮選擇性的與分享綁定。
      </p>
      <el-input
        :model-value="name"
        @update:model-value="(v: string) => $emit('update:name', v)"
        maxlength="30"
        show-word-limit
        placeholder="例：張三"
        @keyup.enter="$emit('submit')"
        autofocus
      />
      <el-button
        type="primary"
        :loading="saving"
        @click="$emit('submit')"
        class="w-full !m-0"
      >
        確定
      </el-button>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: boolean
  name: string
  saving: boolean
}>()
defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'update:name', v: string): void
  (e: 'submit'): void
}>()
</script>
