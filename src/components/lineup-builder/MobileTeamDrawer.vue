<template>
  <el-drawer
    :model-value="modelValue"
    @update:model-value="(v: boolean) => $emit('update:modelValue', v)"
    direction="ltr"
    size="280px"
    :with-header="false"
    class="!bg-parchment"
  >
    <div class="h-full bg-parchment text-ink flex flex-col">
      <header class="px-4 py-3 border-b border-parchment-dim">
        <h2 class="text-sm font-bold tracking-wide">配將模擬</h2>
      </header>
      <div class="px-4 py-2 text-xs text-ink-mute border-b border-parchment-dim">
        當前隊組 · <span class="font-bold text-ink">預設</span>
      </div>
      <div class="flex-1 min-h-0 overflow-y-auto py-1">
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
          <span
            class="text-xs tabular-nums"
            :class="teamCost(team) > 20 ? 'text-red-500' : 'text-ink-mute'"
          >{{ teamCost(team) }}/20</span>
        </button>
      </div>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import type { Lineup } from '../../composables/useLineups'

defineProps<{
  modelValue: boolean
  lineups: Lineup[]
  currentTeamIndex: number
}>()
defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'select', idx: number): void
}>()

const teamCost = (team: Lineup): number =>
  (team.main.hero?.cost ?? 0)
  + (team.vice1.hero?.cost ?? 0)
  + (team.vice2.hero?.cost ?? 0)
</script>
