<template>
  <div class="flex h-dvh w-full bg-parchment text-ink">
    <AppSidebar
      v-model:collapsed="sidebarCollapsed"
      v-model:mobileOpen="sidebarMobileOpen"
    />
    <main class="flex-1 min-w-0 flex flex-col overflow-hidden">
      <button
        class="md:hidden fixed top-3 left-3 z-50 w-9 h-9 rounded-full bg-white/90 border border-parchment-dim shadow flex items-center justify-center"
        @click="sidebarMobileOpen = true"
        aria-label="open menu"
      >
        <el-icon :size="18"><Menu /></el-icon>
      </button>
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Menu } from '@element-plus/icons-vue'
import AppSidebar from '../components/layout/AppSidebar.vue'

const sidebarCollapsed = ref(false)
const sidebarMobileOpen = ref(false)
</script>
