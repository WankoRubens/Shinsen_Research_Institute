<template>
  <div class="hidden md:flex w-20 bg-gray-900 flex-col items-center py-4 gap-4 flex-shrink-0 z-50 overflow-y-auto overflow-x-hidden">
    <div
      v-for="(team, idx) in lineups"
      :key="idx"
      class="w-12 h-12 rounded-full border-2 cursor-pointer flex items-center justify-center text-white font-bold transition-all relative group"
      :class="currentTeamIndex === idx ? 'border-indigo-500 bg-gray-800' : 'border-gray-600 hover:border-gray-400 bg-gray-800'"
      @click="$emit('select', idx)"
    >
      <img
        v-if="team.main.hero"
        :src="team.main.hero.portrait"
        class="w-full h-full rounded-full object-cover opacity-80"
      />
      <span v-else>{{ idx + 1 }}</span>

      <div class="absolute left-full ml-2 bg-gray-900 text-white text-xs px-3 py-2 rounded w-max opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl border border-gray-700">
        <div class="font-bold border-b border-gray-700 pb-1 mb-1 text-indigo-300">{{ team.name }}</div>
        <div class="space-y-0.5 text-gray-300">
          <div>大將: {{ team.main.hero?.name || '-' }}</div>
          <div>副將: {{ team.vice1.hero?.name || '-' }}</div>
          <div>副將: {{ team.vice2.hero?.name || '-' }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Lineup } from '../../composables/useLineups'

defineProps<{
  lineups: Lineup[]
  currentTeamIndex: number
}>()
defineEmits<{
  (e: 'select', idx: number): void
}>()
</script>
