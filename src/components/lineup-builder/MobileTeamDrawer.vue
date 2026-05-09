<template>
  <el-drawer
    :model-value="modelValue"
    @update:model-value="(v: boolean) => $emit('update:modelValue', v)"
    direction="ltr"
    size="280px"
    :with-header="false"
    class="bg-gray-900"
  >
    <div class="h-full bg-gray-900 p-4 flex flex-col gap-4 overflow-y-auto">
      <div class="text-white font-bold text-lg border-b border-gray-700 pb-2 mb-2">隊伍列表</div>
      <div
        v-for="(team, idx) in lineups"
        :key="idx"
        class="flex items-center gap-3 p-2 rounded cursor-pointer transition-colors"
        :class="currentTeamIndex === idx ? 'bg-gray-800 border border-indigo-500' : 'hover:bg-gray-800 border border-transparent'"
        @click="$emit('select', idx)"
      >
        <div class="w-10 h-10 rounded-full border-2 border-gray-600 flex items-center justify-center text-white font-bold bg-gray-700 overflow-hidden">
          <img
            v-if="team.main.hero"
            :src="team.main.hero.portrait"
            class="w-full h-full object-cover"
          />
          <span v-else>{{ idx + 1 }}</span>
        </div>
        <div class="flex-1">
          <div class="text-indigo-300 font-bold text-sm">{{ team.name }}</div>
          <div class="text-gray-400 text-xs truncate">
            {{ team.main.hero?.name || '無大將' }} / {{ team.vice1.hero?.name || '-' }} / {{ team.vice2.hero?.name || '-' }}
          </div>
        </div>
        <el-icon v-if="currentTeamIndex === idx" class="text-indigo-500"><Check /></el-icon>
      </div>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import { Check } from '@element-plus/icons-vue'
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
</script>
