<template>
  <aside class="hidden md:flex flex-col w-[260px] flex-shrink-0 border-r border-parchment-dim bg-parchment text-ink h-full overflow-hidden">
    <header class="px-4 py-3 border-b border-parchment-dim">
      <h2 class="text-sm font-bold tracking-wide">配將模擬</h2>
    </header>

    <!-- Group selector — stub until Phase 3d wires useGroups. -->
    <div class="px-4 py-2 text-xs text-ink-mute border-b border-parchment-dim flex items-center justify-between">
      <span>當前隊組 · <span class="font-bold text-ink">本陣</span></span>
      <el-icon class="opacity-40"><ArrowDown /></el-icon>
    </div>

    <div class="flex-1 overflow-y-auto py-1">
      <button
        v-for="(team, idx) in lineups"
        :key="idx"
        type="button"
        class="w-full flex items-center justify-between px-4 py-2 transition-colors text-left border-l-2"
        :class="currentTeamIndex === idx
          ? 'bg-parchment-soft border-amber-700'
          : 'border-transparent hover:bg-parchment-soft/60'"
        @click="$emit('select', idx)"
      >
        <div class="flex items-center gap-2 min-w-0">
          <span class="text-xs text-ink-mute w-4 text-right">{{ idx + 1 }}</span>
          <span class="text-sm truncate">{{ team.name }}</span>
        </div>
        <div class="flex items-center gap-2 flex-shrink-0">
          <span
            class="text-xs tabular-nums"
            :class="teamCost(team) > 20 ? 'text-red-500' : 'text-ink-mute'"
          >{{ teamCost(team) }}/20</span>
          <span
            v-if="hasUnsavedChanges(idx)"
            class="w-1.5 h-1.5 rounded-full bg-amber-700"
            aria-label="unsaved"
          />
        </div>
      </button>

      <button
        type="button"
        class="w-full px-4 py-2 mt-1 text-left text-xs text-ink-mute hover:text-ink hover:bg-parchment-soft/60 transition-colors flex items-center gap-1"
        @click="$emit('add-team')"
      >
        <el-icon :size="12"><Plus /></el-icon>
        <span>新增配將</span>
      </button>
    </div>

    <div class="border-t border-parchment-dim px-3 py-3 flex flex-col gap-1.5">
      <button class="action-row" @click="$emit('share')">
        <el-icon :size="14"><Share /></el-icon>
        <span>分享</span>
      </button>
      <button class="action-row" @click="$emit('save-as-proposal')">
        <el-icon :size="14"><Document /></el-icon>
        <span>另存為提案</span>
      </button>
      <button class="action-row" @click="$emit('add-to-group')">
        <el-icon :size="14"><Plus /></el-icon>
        <span>加入編組</span>
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ArrowDown, Share, Document, Plus } from '@element-plus/icons-vue'
import type { Lineup } from '../../composables/useLineups'

defineProps<{
  lineups: Lineup[]
  currentTeamIndex: number
}>()

defineEmits<{
  (e: 'select', idx: number): void
  (e: 'add-team'): void
  (e: 'share'): void
  (e: 'save-as-proposal'): void
  (e: 'add-to-group'): void
}>()

const teamCost = (team: Lineup): number =>
  (team.main.hero?.cost ?? 0)
  + (team.vice1.hero?.cost ?? 0)
  + (team.vice2.hero?.cost ?? 0)

// Phase 3d will compare against the last persisted snapshot to detect dirt.
// Until then, render no dot — matches the IMPLEMENTATION.md plan.
const hasUnsavedChanges = (_idx: number): boolean => false
</script>

<style scoped>
.action-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 13px;
  color: #475569;
  background: transparent;
  border: 1px solid transparent;
  transition: background 0.12s ease, border-color 0.12s ease, color 0.12s ease;
  text-align: left;
  cursor: pointer;
}
.action-row:hover {
  background: #F5F0E1;
  border-color: #EFE9D8;
  color: #1F2937;
}
</style>
