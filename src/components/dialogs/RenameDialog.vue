<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="(v: boolean) => $emit('update:modelValue', v)"
    title="表示名を設定"
    width="340px"
    align-center
  >
    <div class="flex flex-col gap-3 pb-1">
      <p class="text-xs text-gray-500 -mt-1 mb-1">
        現在はデスクトップ版で見えるカスタム名だけを変更します。今後、共有との紐付けも検討します。
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
        決定
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
