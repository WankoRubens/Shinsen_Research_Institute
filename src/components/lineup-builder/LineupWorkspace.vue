<template>
  <div class="flex-1 flex flex-col h-full overflow-hidden">
    <!-- Lineup grid. Hero and skill libraries open as dialogs from each slot. -->
    <div
      class="flex-1 overflow-y-auto p-0.5 md:p-[10px] bg-slate-50"
      @click.self="$emit('clear-skill-focus')"
    >
      <div
        class="grid grid-cols-3 md:grid-cols-3 lg:grid-cols-3 gap-0.5 md:gap-3 pb-0 md:pb-0 h-auto"
        :class="{ 'lineup-shake': lineupShakeActive }"
        @click.self="$emit('clear-skill-focus')"
        @animationend="$emit('update:lineupShakeActive', false)"
      >
        <div
          v-for="slot in SLOTS"
          :key="slot.role"
          class="w-full md:min-w-0 md:h-full"
        >
          <LineupSlot
            :title="slot.title"
            :role="slot.role"
            v-model:hero="currentLineup[slot.role].hero"
            v-model:skill1="currentLineup[slot.role].skill1"
            v-model:skill2="currentLineup[slot.role].skill2"
            v-model:stats="currentLineup[slot.role].stats"
            v-model:breakthrough="currentLineup[slot.role].breakthrough"
            v-model:bingxue="currentLineup[slot.role].bingxue"
            :focused-skill-slot="currentSelectingSkillRole === slot.role ? currentSelectingSkillSlot : null"
            :is-swap-source="swapModeRole === slot.role"
            :swap-mode-active="swapModeRole !== null"
            :is-drag-target="dragSourceRole !== null && dragSourceRole !== slot.role"
            :skill-dragging="isSkillDragging"
            :conflicting-skill-names="conflictingSkillNames"
            @open-hero-select="$emit('open-hero-select', slot.role)"
            @open-skill-select="(slotIdx: number) => $emit('open-skill-select', slot.role, slotIdx)"
            @skill-drop="(slotIdx: number, skill: Skill) => $emit('skill-drop', slot.role, slotIdx, skill)"
            @skill-drag-start="(skill: Skill) => $emit('skill-drag-start', skill)"
            @skill-drag-end="$emit('skill-drag-end')"
            @skill-slot-drop="(srcRole: Role, srcSlot: number, tgtSlot: number) => $emit('skill-slot-drop', slot.role, srcRole, srcSlot, tgtSlot)"
            @open-detail="$emit('open-detail', slot.role)"
            @swap-click="$emit('swap-click', slot.role)"
            @hero-drag-start="$emit('hero-drag-start', slot.role)"
            @hero-drag-end="$emit('hero-drag-end')"
            @hero-drop="$emit('hero-drop', slot.role)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import LineupSlot from '../LineupSlot.vue'
import type { Skill } from '../../composables/useData'
import type { Lineup } from '../../composables/useLineups'

export type Role = 'main' | 'vice1' | 'vice2'
const SLOTS: Array<{ role: Role; title: string }> = [
  { role: 'main', title: '大将' },
  { role: 'vice1', title: '副将' },
  { role: 'vice2', title: '副将' },
]

defineProps<{
  currentLineup: Lineup
  currentSelectingSkillRole: Role | null
  currentSelectingSkillSlot: number | null
  swapModeRole: Role | null
  dragSourceRole: Role | null
  isSkillDragging: boolean
  conflictingSkillNames: Set<string>
  lineupShakeActive: boolean
}>()

defineEmits<{
  (e: 'update:lineupShakeActive', v: boolean): void
  (e: 'clear-skill-focus'): void
  (e: 'open-hero-select', role: Role): void
  (e: 'open-skill-select', role: Role, slotIdx: number): void
  (e: 'skill-drop', role: Role, slotIdx: number, skill: Skill): void
  (e: 'skill-drag-start', skill: Skill): void
  (e: 'skill-drag-end'): void
  (e: 'skill-slot-drop', targetRole: Role, sourceRole: Role, sourceSlotIdx: number, targetSlotIdx: number): void
  (e: 'open-detail', role: Role): void
  (e: 'swap-click', role: Role): void
  (e: 'hero-drag-start', role: Role): void
  (e: 'hero-drag-end'): void
  (e: 'hero-drop', role: Role): void
}>()
</script>
