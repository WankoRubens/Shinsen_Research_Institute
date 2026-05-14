<template>
  <el-drawer
    :model-value="modelValue"
    @update:model-value="(v: boolean) => $emit('update:modelValue', v)"
    direction="ltr"
    size="280px"
    :with-header="false"
    class="!bg-white"
  >
    <div class="h-full bg-white text-ink flex flex-col">
      <header class="px-4 py-3 border-b border-divider">
        <h2 class="text-sm font-bold tracking-wide">配將模擬</h2>
      </header>
      <div class="px-4 py-2 text-xs text-ink-mute border-b border-divider">
        當前隊組 · <span class="font-bold text-ink">預設</span>
      </div>
      <div class="flex-1 min-h-0 overflow-y-auto py-1">
        <div
          v-for="(team, idx) in lineups"
          :key="idx"
          role="button"
          tabindex="0"
          class="w-full flex items-center justify-between px-4 py-2 transition-colors text-left border-l-2 cursor-pointer"
          :class="currentTeamIndex === idx
            ? 'bg-highlight border-focus'
            : 'border-transparent hover:bg-highlight'"
          @click="$emit('select', idx)"
          @keydown.enter="$emit('select', idx)"
          @keydown.space.prevent="$emit('select', idx)"
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
            <!-- Empty team → instant delete. Non-empty → popconfirm. Always
                 visible on mobile (no hover affordance). -->
            <span
              v-if="isEmptyTeam(team)"
              class="row-action"
              @click.stop="$emit('remove-team', idx)"
              @keydown.enter.stop="$emit('remove-team', idx)"
              @keydown.space.stop.prevent="$emit('remove-team', idx)"
              role="button"
              tabindex="0"
              :aria-label="`刪除 ${team.name}`"
            >
              <el-icon :size="14"><Delete /></el-icon>
            </span>
            <el-popconfirm
              v-else
              :title="`刪除「${team.name}」？無法復原`"
              confirm-button-text="刪除"
              cancel-button-text="取消"
              confirm-button-type="danger"
              :width="220"
              @confirm="$emit('remove-team', idx)"
            >
              <template #reference>
                <span
                  class="row-action"
                  @click.stop
                  role="button"
                  tabindex="0"
                  :aria-label="`刪除 ${team.name}`"
                >
                  <el-icon :size="14"><Delete /></el-icon>
                </span>
              </template>
            </el-popconfirm>
          </div>
        </div>
      </div>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import { Delete } from '@element-plus/icons-vue'
import { type Lineup, isEmptyTeam } from '../../composables/useLineups'

defineProps<{
  modelValue: boolean
  lineups: Lineup[]
  currentTeamIndex: number
}>()
defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'select', idx: number): void
  (e: 'remove-team', idx: number): void
}>()

const teamCost = (team: Lineup): number =>
  (team.main.hero?.cost ?? 0)
  + (team.vice1.hero?.cost ?? 0)
  + (team.vice2.hero?.cost ?? 0)
</script>

<style scoped>
.row-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  color: #94a3b8;
  cursor: pointer;
  transition: color 0.12s ease, background 0.12s ease;
}
.row-action:hover, .row-action:focus {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.08);
  outline: none;
}
</style>
