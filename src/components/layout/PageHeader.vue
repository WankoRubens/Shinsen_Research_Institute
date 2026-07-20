<template>
  <el-header class="page-header bg-white sticky top-0 z-50 !h-auto">
    <div class="flex items-center px-3 md:px-5 min-h-[56px]">
      <el-button
        class="mobile-menu-button md:hidden !mr-1 flex-shrink-0"
        text
        title="主要機能メニューを開く"
        aria-label="主要機能メニューを開く"
        @click="$emit('open-mobile-sidebar')"
      >
        <el-icon :size="18"><Menu /></el-icon>
        <span>メニュー</span>
      </el-button>

      <div class="flex-1 min-w-0 flex items-center gap-3 py-2">
        <span class="accent-bar flex-shrink-0" aria-hidden="true"></span>
        <h1 class="font-brand text-lg md:text-xl font-bold text-ink tracking-tight leading-tight flex-shrink-0 max-w-[60vw] truncate">
          {{ title }}
        </h1>
        <template v-if="description">
          <span class="divider-line hidden md:inline-block flex-shrink-0" aria-hidden="true"></span>
          <p class="hidden md:block text-xs text-ink-mute leading-snug truncate">
            {{ description }}
          </p>
        </template>
      </div>

      <div class="flex items-center flex-shrink-0 pl-2">
        <UserControls
          :is-logged-in="isLoggedIn"
          :display-name="displayName"
          :has-unseen-changelog="hasUnseenChangelog"
          @open-changelog="$emit('open-changelog')"
          @open-auth="$emit('open-auth')"
          @user-menu="(cmd) => $emit('user-menu', cmd)"
        />
      </div>
    </div>
  </el-header>
</template>

<script setup lang="ts">
import { Menu } from '@element-plus/icons-vue'
import UserControls, { type UserMenuCmd } from './UserControls.vue'

defineProps<{
  title: string
  description?: string
  isLoggedIn: boolean
  displayName: string | null
  hasUnseenChangelog: boolean
}>()

defineEmits<{
  (e: 'open-mobile-sidebar'): void
  (e: 'open-changelog'): void
  (e: 'open-auth'): void
  (e: 'user-menu', cmd: UserMenuCmd): void
}>()
</script>

<style scoped>
.page-header {
  border-bottom: 1px solid rgb(var(--color-divider));
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.02);
}
/* Left-side colored marker — gives each page a clear "section" anchor. */
.accent-bar {
  width: 3px;
  height: 22px;
  border-radius: 2px;
  background: linear-gradient(
    180deg,
    rgb(var(--color-focus)) 0%,
    rgb(var(--color-focus) / 0.55) 100%
  );
}
/* Thin vertical separator between title and description. */
.divider-line {
  width: 1px;
  height: 18px;
  background: rgb(var(--color-divider));
}
.mobile-menu-button {
  width: 42px;
  height: 46px;
  padding: 3px 2px !important;
  flex-direction: column;
  gap: 1px;
  color: rgb(var(--color-ink-soft));
  font-size: 9px;
  line-height: 1;
}
</style>
