<template>
  <!-- Desktop rail -->
  <aside
    class="app-sidebar hidden md:flex flex-col border-r border-parchment-dim bg-white/60 backdrop-blur-sm"
    :class="collapsed ? 'w-16' : 'w-56'"
  >
    <SidebarBody
      :collapsed="collapsed"
      :active-route="route.name as string"
      @toggle-collapse="$emit('update:collapsed', !collapsed)"
    />
  </aside>

  <!-- Mobile drawer -->
  <el-drawer
    :model-value="mobileOpen"
    direction="ltr"
    size="240px"
    :with-header="false"
    @update:model-value="(v: boolean) => $emit('update:mobileOpen', v)"
  >
    <SidebarBody
      :collapsed="false"
      :active-route="route.name as string"
      @nav="$emit('update:mobileOpen', false)"
    />
  </el-drawer>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import SidebarBody from './SidebarBody.vue'

defineProps<{ collapsed: boolean; mobileOpen: boolean }>()
defineEmits<{
  (e: 'update:collapsed', v: boolean): void
  (e: 'update:mobileOpen', v: boolean): void
}>()

const route = useRoute()
</script>

<style scoped>
.app-sidebar {
  transition: width 0.2s ease;
}
</style>
