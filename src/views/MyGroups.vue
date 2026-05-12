<template>
  <div class="flex-1 overflow-y-auto p-4 md:p-6">
    <div class="max-w-7xl">
      <div v-if="groups.length === 0" class="p-6 rounded-xl border border-dashed border-divider bg-white text-ink-soft text-sm">
        還沒有任何編組。
      </div>

      <el-collapse v-else v-model="expanded" class="group-collapse">
        <el-collapse-item
          v-for="(g, idx) in groups"
          :key="g.id"
          :name="g.id"
        >
          <template #title>
            <div class="flex items-baseline gap-3 w-full pr-3">
              <span class="font-brand text-lg font-bold text-ink">{{ g.name }}</span>
              <span class="text-xs text-ink-mute">{{ visibleTeams(g).length }} 隊</span>
              <span
                v-if="idx === currentGroupIndex"
                class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200"
              >使用中</span>
              <span class="ml-auto text-xs text-ink-mute">
                Cost {{ groupCost(g) }}
              </span>
            </div>
          </template>

          <div v-if="visibleTeams(g).length === 0" class="text-sm text-ink-mute py-3">
            這個編組還沒有任何隊伍。切換到此編組並在配將模擬建立隊伍。
          </div>
          <GroupPreviewCard
            v-else
            :group="{ name: g.name, teams: visibleTeams(g) }"
            density="compact"
          />
        </el-collapse-item>
      </el-collapse>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGroups } from '../composables/useGroups'
import GroupPreviewCard from '../components/preview/GroupPreviewCard.vue'
import type { Group } from '../types/group'
import { isEmptyTeam, type Lineup } from '../composables/useLineups'

const { groups, currentGroupIndex } = useGroups()

// el-collapse model is an array of opened item names. Default empty so all
// groups are folded — heavy webp portraits only download when the user expands.
const expanded = ref<string[]>([])

// Hide empty team slots from the preview once a group has any real content,
// so the screencap shows only meaningful teams. Cached in a Map keyed by
// group id so the template can read the same filtered list three times
// (count chip, empty-state check, GroupPreviewCard prop) without re-running
// the filter on every reactive read.
const visibleTeamsByGroup = computed<Map<string, Lineup[]>>(() => {
  const m = new Map<string, Lineup[]>()
  for (const g of groups) {
    m.set(g.id, g.teams.filter((t: Lineup) => !isEmptyTeam(t)))
  }
  return m
})

const visibleTeams = (g: Group): Lineup[] =>
  visibleTeamsByGroup.value.get(g.id) ?? []

const groupCost = (g: Group): number =>
  g.teams.reduce((sum, t) => sum +
    (t.main.hero?.cost ?? 0) +
    (t.vice1.hero?.cost ?? 0) +
    (t.vice2.hero?.cost ?? 0), 0)
</script>

<style scoped>
/* Element Plus el-collapse ships with a top and bottom border on the
   wrapper plus a bottom border on each item. With our custom card-style
   header those defaults render as a duplicate hairline above/below the
   card. Zero them so only our intentional 1px border shows. */
.group-collapse {
  border-top: none;
  border-bottom: none;
}
.group-collapse :deep(.el-collapse-item) {
  border-bottom: none;
}
.group-collapse :deep(.el-collapse-item__header) {
  font-size: inherit;
  background: #ffffff;
  border-radius: 8px;
  padding: 0 16px;
  margin-bottom: 8px;
  border: 1px solid rgb(var(--color-divider));
}
.group-collapse :deep(.el-collapse-item__wrap) {
  background: transparent;
  border-bottom: none;
}
.group-collapse :deep(.el-collapse-item__content) {
  padding: 8px 0 16px 0;
}
</style>
