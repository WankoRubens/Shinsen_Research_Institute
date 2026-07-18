<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="(v: boolean) => $emit('update:modelValue', v)"
    title="アカウントにログイン"
    width="340px"
    align-center
  >
    <div class="flex flex-col gap-3 pb-1">
      <p class="text-xs text-gray-500 text-center -mt-1 mb-1 leading-relaxed">
        ログイン方法を選択すると、作成した共有リンクをアカウントに紐付けられます
      </p>
      <button
        @click="$emit('sign-in', 'google')"
        class="oauth-btn oauth-btn-google"
      >
        <svg class="w-[18px] h-[18px] flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
          <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
          <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
          <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
          <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
        </svg>
        <span>Google アカウントで続ける</span>
      </button>
      <button
        @click="$emit('sign-in', 'github')"
        class="oauth-btn oauth-btn-github"
      >
        <svg class="w-[18px] h-[18px] flex-shrink-0 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
        </svg>
        <span>GitHub アカウントで続ける</span>
      </button>
      <p class="text-xs text-gray-400 text-center mt-3 leading-relaxed">
        ログインは任意です。ログインしなくても基本機能は利用できます
      </p>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import type { OAuthProvider } from '../../lib/auth'

defineProps<{ modelValue: boolean }>()
defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'sign-in', provider: OAuthProvider): void
}>()
</script>

<style scoped>
.oauth-btn {
  width: 100%;
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 0 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
  border: 1px solid transparent;
}
.oauth-btn:focus-visible {
  outline: 2px solid #6366f1;
  outline-offset: 2px;
}
.oauth-btn-google {
  background: #ffffff;
  color: #1f1f1f;
  border-color: #dadce0;
}
.oauth-btn-google:hover {
  background: #f8f9fa;
  border-color: #c4c6c9;
  box-shadow: 0 1px 2px rgba(60, 64, 67, 0.08);
}
.oauth-btn-google:active {
  background: #f1f3f4;
}
.oauth-btn-github {
  background: #24292f;
  color: #ffffff;
  border-color: #24292f;
}
.oauth-btn-github:hover {
  background: #32383f;
  border-color: #32383f;
}
.oauth-btn-github:active {
  background: #1c2128;
}
</style>
