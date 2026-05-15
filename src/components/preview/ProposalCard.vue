<template>
  <div class="proposal-card">
    <TeamPreviewCard
      :team="proposal.team"
      :title="proposal.name"
      density="compact"
    />
    <div class="meta">
      <p v-if="proposal.description" class="description">{{ proposal.description }}</p>
      <div class="bottom">
        <span class="author">
          {{ proposal.authorName || '匿名' }}
          <span class="dot">·</span>
          {{ relativeTime(proposal.updatedAt) }}
        </span>
        <div class="actions">
          <button
            type="button"
            class="action-btn"
            @click="$emit('import-to-group')"
          >
            <el-icon :size="14"><Plus /></el-icon>
            <span>匯入到編組</span>
          </button>
          <button
            type="button"
            class="action-btn"
            :class="{ 'action-btn--on': voted, 'action-btn--disabled': !canVote }"
            :disabled="!canVote"
            @click="$emit('vote')"
          >
            <el-icon :size="14"><CaretTop /></el-icon>
            <span>{{ proposal.voteCount }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { CaretTop, Plus } from '@element-plus/icons-vue'
import type { Proposal } from '../../types/group'
import { relativeTime } from '../../lib/time'
import TeamPreviewCard from './TeamPreviewCard.vue'

defineProps<{
  proposal: Proposal
  voted: boolean
  canVote: boolean
}>()
defineEmits<{
  (e: 'vote'): void
  (e: 'import-to-group'): void
}>()
</script>

<style scoped>
.proposal-card {
  background: #ffffff;
  border: 1px solid rgb(var(--color-divider));
  border-radius: 10px;
  overflow: hidden;
}
.meta {
  padding: 10px 14px;
  border-top: 1px solid rgb(var(--color-divider));
}
.description {
  font-size: 14px;
  color: rgb(var(--color-ink));
  margin: 0 0 8px 0;
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.author {
  font-size: 12px;
  color: rgb(var(--color-ink-mute));
}
.dot { margin: 0 4px; }
.actions {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 11px;
  border-radius: 999px;
  background: #ffffff;
  border: 1px solid rgb(var(--color-divider));
  color: rgb(var(--color-ink-soft));
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
  font-variant-numeric: tabular-nums;
}
.action-btn:hover:not(.action-btn--disabled) {
  background: rgb(var(--color-highlight));
  border-color: rgb(var(--color-focus));
}
.action-btn--on {
  background: #fef3c7;
  border-color: #f59e0b;
  color: #b45309;
}
.action-btn--disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
</style>
