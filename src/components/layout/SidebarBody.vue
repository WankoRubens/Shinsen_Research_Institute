<template>
  <div class="h-full flex flex-col py-3 px-2">
    <RouterLink
      to="/"
      class="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-highlight"
      :class="collapsed && 'justify-center'"
      @click="$emit('nav')"
    >
      <div class="w-8 h-8 rounded-full border border-brand text-brand flex items-center justify-center font-brand font-bold text-[15.4px] leading-none shrink-0">項</div>
      <div v-if="!collapsed" class="flex flex-col justify-center h-8 leading-none">
        <div class="font-brand font-bold text-ink text-[15.4px]">{{ t('brandName') }}</div>
        <div class="text-[11px] text-ink-mute tracking-wide mt-1"> SRI · v0.1</div>
      </div>
    </RouterLink>

    <div class="mt-4 flex-1 overflow-y-auto">
      <SidebarSection v-if="!collapsed" :label="t('primaryNav')" />
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

      <template v-if="soonNav.length">
        <SidebarSection v-if="!collapsed" :label="t('comingSoon')" class="mt-4" />
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
      </template>

      <SidebarSection v-if="!collapsed" :label="t('unlikely')" class="mt-4" />
      <SidebarLink
        v-for="item in wishNav"
        :key="item.name"
        :to="item.to"
        :icon="item.icon"
        :label="item.label"
        badge="?"
        :collapsed="collapsed"
        :active="activeRoute === item.name"
        @click="$emit('nav')"
      />
    </div>

    <div class="border-t border-divider pt-2 mt-2">
      <SidebarLink
        :to="{ name: 'settings' }"
        :icon="Setting"
        :label="t('settings')"
        :collapsed="collapsed"
        :active="activeRoute === 'settings'"
        @click="$emit('nav')"
      />
      <button
        class="hidden md:flex w-full items-center gap-2 px-3 py-2 mt-1 rounded-lg text-ink-mute hover:bg-highlight text-xs"
        :class="collapsed && 'justify-center'"
        @click="$emit('toggle-collapse')"
      >
        <el-icon :size="14"><Fold v-if="!collapsed" /><Expand v-else /></el-icon>
        <span v-if="!collapsed">{{ t('collapse') }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Component } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import {
  Grid, Flag, Document, Aim, Reading, Setting, Fold, Expand,
  User, Share,
} from '@element-plus/icons-vue'
import SidebarLink from './SidebarLink.vue'
import SidebarSection from './SidebarSection.vue'
import { useLocale } from '../../composables/useLocale'

defineProps<{ collapsed: boolean; activeRoute?: string }>()
defineEmits<{
  (e: 'nav'): void
  (e: 'toggle-collapse'): void
}>()

const { t } = useLocale()

type NavItem = {
  name: string
  to: RouteLocationRaw
  icon: Component
  label: string
  badge?: string
}

const primaryNav = computed<readonly NavItem[]>(() => [
  { name: 'lineup', to: { name: 'lineup' }, icon: Grid, label: t('lineup'), badge: t('workbench') },
  { name: 'profiles', to: { name: 'profiles' }, icon: User, label: t('profiles') },
  { name: 'groups', to: { name: 'groups' }, icon: Flag, label: t('groups') },
  { name: 'shares', to: { name: 'shares' }, icon: Share, label: t('shares') },
  { name: 'proposals', to: { name: 'proposals' }, icon: Document, label: t('proposals') },
  { name: 'battleSim', to: { name: 'battleSim' }, icon: Aim, label: t('battleSim'), badge: 'NEW' },
  { name: 'mockBattle', to: { name: 'mockBattle' }, icon: Aim, label: t('mockBattle'), badge: 'NEW' },
  { name: 'aiLineup', to: { name: 'aiLineup' }, icon: Aim, label: t('aiLineup'), badge: 'NEW' },
  { name: 'heroDb', to: { name: 'heroDb' }, icon: Reading, label: t('heroDb') },
])

const soonNav = computed<readonly NavItem[]>(() => [])

const wishNav = computed<readonly NavItem[]>(() => [])
</script>
