<template>
  <div class="h-full flex flex-col py-3 px-2">
    <!-- Brand -->
    <RouterLink
      to="/"
      class="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-parchment-soft"
      @click="$emit('nav')"
    >
      <div class="w-8 h-8 rounded-md bg-amber-700 text-white flex items-center justify-center font-brand text-sm shrink-0">信</div>
      <div v-if="!collapsed" class="leading-tight">
        <div class="font-brand font-bold text-ink text-sm">真戰配將</div>
        <div class="text-[10px] text-ink-mute tracking-wide">SHINSEI · v1.0</div>
      </div>
    </RouterLink>

    <div class="mt-4 flex-1 overflow-y-auto">
      <SidebarSection v-if="!collapsed" label="主要功能" />
      <SidebarLink
        v-for="item in primaryNav"
        :key="item.name"
        :to="item.to"
        :icon="item.icon"
        :label="item.label"
        :badge="item.badge"
        :collapsed="collapsed"
        :active="activeRoute === item.name"
        @click="$emit('nav')"
      />

      <SidebarSection v-if="!collapsed" label="即將推出" class="mt-4" />
      <SidebarLink
        v-for="item in soonNav"
        :key="item.name"
        :to="item.to"
        :icon="item.icon"
        :label="item.label"
        badge="SOON"
        :collapsed="collapsed"
        :active="activeRoute === item.name"
        @click="$emit('nav')"
      />
    </div>

    <!-- Footer: settings + collapse -->
    <div class="border-t border-parchment-dim pt-2 mt-2">
      <SidebarLink
        :to="{ name: 'settings' }"
        :icon="Setting"
        label="設定"
        :collapsed="collapsed"
        :active="activeRoute === 'settings'"
        @click="$emit('nav')"
      />
      <button
        class="hidden md:flex w-full items-center gap-2 px-3 py-2 mt-1 rounded-lg text-ink-mute hover:bg-parchment-soft text-xs"
        @click="$emit('toggle-collapse')"
      >
        <el-icon :size="14"><Fold v-if="!collapsed" /><Expand v-else /></el-icon>
        <span v-if="!collapsed">收合</span>
      </button>

      <div
        v-if="!collapsed"
        class="px-3 pt-3 mt-2 border-t border-parchment-dim text-[10px] text-ink-mute leading-relaxed space-y-0.5"
      >
        <div class="break-all">聯絡：yt.neko.vision@gmail.com</div>
        <div>Discord：neko.vision</div>
        <a
          href="https://forms.gle/mnMAqAzP595ygCrJ9"
          target="_blank"
          rel="noopener"
          class="inline-block text-amber-700 hover:underline"
        >建議或回報</a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Component } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import { Grid, Flag, Document, Aim, Reading, Setting, Fold, Expand } from '@element-plus/icons-vue'
import SidebarLink from './SidebarLink.vue'
import SidebarSection from './SidebarSection.vue'

defineProps<{ collapsed: boolean; activeRoute?: string }>()
defineEmits<{
  (e: 'nav'): void
  (e: 'toggle-collapse'): void
}>()

type NavItem = {
  name: string
  to: RouteLocationRaw
  icon: Component
  label: string
  badge?: string
}

const primaryNav: readonly NavItem[] = [
  { name: 'lineup', to: { name: 'lineup' }, icon: Grid, label: '配將模擬', badge: '工作台' },
  { name: 'groups', to: { name: 'groups' }, icon: Flag, label: '我的編組' },
  { name: 'proposals', to: { name: 'proposals' }, icon: Document, label: '配將提案' },
  { name: 'gachaLog', to: { name: 'gachaLog' }, icon: Document, label: '抽卡紀錄' },
]

const soonNav: readonly NavItem[] = [
  { name: 'battleSim', to: { name: 'comingSoon', params: { topic: 'battle-sim' } }, icon: Aim, label: '戰鬥模擬' },
  { name: 'heroPedia', to: { name: 'comingSoon', params: { topic: 'hero-pedia' } }, icon: Reading, label: '武將圖鑑' },
]
</script>
