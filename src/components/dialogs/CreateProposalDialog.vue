<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="(v: boolean) => $emit('update:modelValue', v)"
    title="おすすめ編成として保存"
    width="380px"
    align-center
  >
    <div class="flex flex-col gap-3">
      <div class="flex flex-col gap-1">
        <label class="text-xs text-ink-mute">部隊名</label>
        <el-input
          v-model="name"
          maxlength="50"
          placeholder="例如：突騎奇襲一波流"
          show-word-limit
          clearable
        />
      </div>

      <div
        v-if="isLoggedIn"
        class="flex items-center justify-between pt-1 border-t border-divider"
      >
        <div class="flex flex-col gap-0.5">
          <span class="text-sm">公開共有</span>
          <span class="text-[11px] text-ink-mute leading-snug">
            有効にすると「おすすめ編成」の公開一覧に表示されます
          </span>
        </div>
        <el-switch v-model="isPublic" />
      </div>
      <p v-else class="text-[11px] text-ink-mute leading-snug">
        未ログイン時はローカル下書きとして保存されます。ログイン後は公開共有を選べます。
      </p>

      <div class="flex justify-end gap-2 pt-1">
        <el-button @click="onCancel">キャンセル</el-button>
        <el-button type="primary" :disabled="!nameValid" :loading="submitting" @click="onSubmit">
          保存
        </el-button>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

const props = defineProps<{
  modelValue: boolean
  isLoggedIn: boolean
  submitting: boolean
}>()
const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'submit', payload: { name: string; isPublic: boolean }): void
}>()

const name = ref('')
const isPublic = ref(false)

const nameValid = computed(() => name.value.trim().length > 0)

// Reset on open so a previous submission doesn't leak back into a new one.
watch(() => props.modelValue, (now) => {
  if (now) {
    name.value = ''
    isPublic.value = false
  }
})

const onCancel = () => emit('update:modelValue', false)

const onSubmit = () => {
  if (!nameValid.value) return
  emit('submit', {
    name: name.value.trim(),
    isPublic: props.isLoggedIn ? isPublic.value : false,
  })
}
</script>
