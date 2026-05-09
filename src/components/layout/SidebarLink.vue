<template>
  <RouterLink
    :to="to"
    class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors"
    :class="[
      active ? 'bg-amber-50 text-amber-800 font-bold' : 'text-ink-soft hover:bg-parchment-soft',
      collapsed && 'justify-center px-2',
    ]"
  >
    <el-icon :size="16" class="shrink-0"><component :is="icon" /></el-icon>
    <span v-if="!collapsed" class="flex-1 truncate">{{ label }}</span>
    <span
      v-if="!collapsed && badge"
      class="text-[10px] px-1.5 py-0.5 rounded-full bg-parchment-dim text-ink-mute font-normal"
    >{{ badge }}</span>
  </RouterLink>
</template>

<script setup lang="ts">
import type { Component } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

defineProps<{
  to: RouteLocationRaw
  icon: Component
  label: string
  badge?: string
  collapsed?: boolean
  active?: boolean
}>()
</script>
