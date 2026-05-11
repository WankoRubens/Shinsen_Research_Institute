<template>
  <div class="group-preview">
    <div class="header">
      <div class="title-row">
        <span class="title font-brand">{{ resolvedTitle }}</span>
        <span class="team-count">{{ group.teams.length }} 隊</span>
      </div>
      <div v-if="author" class="author">by {{ author }}</div>
    </div>

    <div class="teams" :class="`teams--${resolvedLayout}`">
      <TeamPreviewCard
        v-for="(team, idx) in group.teams"
        :key="idx"
        :team="team"
        :density="density"
        :show-header="showTeamHeader"
        :show-watermark="showWatermark"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Lineup } from '../../composables/useLineups'
import TeamPreviewCard from './TeamPreviewCard.vue'

// Structural prop type — the preview is read-only and doesn't need Group's
// `id` field, so a hydrated share blob can be passed directly without first
// being upgraded to a full Group object.
interface PreviewGroup {
  name: string
  teams: Lineup[]
}

const props = withDefaults(defineProps<{
  group: PreviewGroup
  title?: string
  author?: string
  layout?: 'stack' | 'grid-2col' | 'auto'
  density?: 'compact' | 'regular'
  /** Forwarded to each TeamPreviewCard — hide per-team title bars when
   *  embedding a group preview inline (caller already labels the group). */
  showTeamHeader?: boolean
  showWatermark?: boolean
}>(), {
  layout: 'auto',
  density: 'compact',
  showTeamHeader: true,
  showWatermark: true,
})

const resolvedTitle = computed(() => props.title ?? props.group.name ?? '未命名編組')

// Auto picks stack for ≤3 teams (one column reads naturally), grid-2col for
// ≥4 teams to halve the screencap height. Caller can force either layout.
const resolvedLayout = computed(() => {
  if (props.layout !== 'auto') return props.layout
  return props.group.teams.length <= 3 ? 'stack' : 'grid-2col'
})
</script>

<style scoped>
.group-preview {
  background: #ffffff;
  border: 1px solid rgb(var(--color-divider));
  border-radius: 12px;
  padding: 18px;
}

.header {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-bottom: 13px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgb(var(--color-divider));
}
.title-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}
.title {
  font-size: 25px;
  font-weight: 700;
  color: rgb(var(--color-ink));
}
.team-count {
  font-size: 17px;
  color: rgb(var(--color-ink-soft));
  font-variant-numeric: tabular-nums;
}
.author {
  font-size: 16px;
  color: rgb(var(--color-ink-mute));
}

.teams {
  display: grid;
  gap: 13px;
}
.teams--stack { grid-template-columns: 1fr; }
/* auto-fit lets the grid collapse to a single column when the container is
   too narrow to honour the minimum card width. Min bumped to ~360px to
   match the larger 1.3x team cards — keeps 3-hero rows readable. */
.teams--grid-2col {
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
}
</style>
