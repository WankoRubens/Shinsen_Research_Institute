<template>
  <div class="proposal-card">
    <TeamPreviewCard
      :team="proposal.team"
      :title="proposal.name"
      density="compact"
      :bordered="false"
    />
    <div class="meta">
      <div class="meta-left">
        <span class="author" :title="rawAuthor">{{ displayedAuthor }}</span>
        <span class="dot">·</span>
        <span class="time">{{ relativeTime(proposal.updatedAt) }}</span>
        <el-popconfirm
          v-if="canEdit"
          :title="proposal.isPublic
            ? '確定設為私人？其他人將無法看見此提案'
            : '確定公開此提案？所有人都能看見和投票'"
          confirm-button-text="確定"
          cancel-button-text="取消"
          :width="260"
          @confirm="$emit('toggle-public')"
        >
          <template #reference>
            <button
              type="button"
              class="visibility-chip"
              :class="{ 'visibility-chip--public': proposal.isPublic }"
              :title="proposal.isPublic ? '切換成私人' : '切換成公開'"
              :aria-label="proposal.isPublic ? '切換成私人' : '切換成公開'"
              @click.stop
            >
              <el-icon :size="13">
                <component :is="proposal.isPublic ? View : Hide" />
              </el-icon>
            </button>
          </template>
        </el-popconfirm>
        <span
          v-else
          class="visibility-chip visibility-chip--static"
          :class="{ 'visibility-chip--public': proposal.isPublic }"
          :title="proposal.isPublic ? '公開' : '私人'"
        >
          <el-icon :size="13">
            <component :is="proposal.isPublic ? View : Hide" />
          </el-icon>
        </span>
      </div>
      <div class="actions">
        <el-popconfirm
          v-if="canEdit"
          :title="`刪除「${proposal.name}」？無法復原`"
          confirm-button-text="刪除"
          cancel-button-text="取消"
          confirm-button-type="danger"
          :width="240"
          @confirm="$emit('delete')"
        >
          <template #reference>
            <button
              type="button"
              class="icon-btn icon-btn--danger hover-reveal"
              title="刪除提案"
              aria-label="刪除提案"
              @click.stop
            >
              <el-icon :size="14"><Delete /></el-icon>
            </button>
          </template>
        </el-popconfirm>
        <button
          type="button"
          class="action-btn action-btn--icon"
          title="匯入到編組"
          aria-label="匯入到編組"
          @click="$emit('import-to-group')"
        >
          <el-icon :size="14"><Position /></el-icon>
        </button>
        <button
          type="button"
          class="action-btn action-btn--vote"
          :class="{ 'action-btn--up': votedDirection === 1, 'action-btn--disabled': !canVote }"
          :disabled="!canVote"
          :title="voteTooltip"
          @click="$emit('upvote')"
        >
          <el-icon :size="14"><CaretTop /></el-icon>
          <span>{{ proposal.upvoteCount }}</span>
        </button>
        <button
          type="button"
          class="action-btn action-btn--vote"
          :class="{ 'action-btn--down': votedDirection === -1, 'action-btn--disabled': !canVote }"
          :disabled="!canVote"
          :title="voteTooltip"
          @click="$emit('downvote')"
        >
          <el-icon :size="14"><CaretBottom /></el-icon>
          <span>{{ proposal.downvoteCount }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { CaretTop, CaretBottom, Position, Delete, View, Hide } from '@element-plus/icons-vue'
import type { Proposal } from '../../types/group'
import { relativeTime } from '../../lib/time'
import TeamPreviewCard from './TeamPreviewCard.vue'

const props = defineProps<{
  proposal: Proposal
  /** -1 = current user downvoted, 1 = upvoted, null = no vote on this card. */
  votedDirection: -1 | 1 | null
  canVote: boolean
  canEdit: boolean
  /** Current user's display name. When canEdit is true (the card belongs to the
   *  signed-in user), this overrides the stored snapshot so renames take effect
   *  immediately without a backfill. Capped at 10 chars in display either way. */
  currentUserName?: string | null
}>()
defineEmits<{
  (e: 'upvote'): void
  (e: 'downvote'): void
  (e: 'import-to-group'): void
  (e: 'delete'): void
  (e: 'toggle-public'): void
}>()

const rawAuthor = computed(() => {
  if (props.canEdit && props.currentUserName) return props.currentUserName
  return props.proposal.authorName || '匿名'
})
const displayedAuthor = computed(() => {
  const s = rawAuthor.value
  return s.length > 10 ? s.slice(0, 10) + '…' : s
})

// Disabled-state tooltip distinguishes the two reasons canVote is false:
// — own proposal (mine tab or own card in public tab): you can't vote on
//   your own work, so the tooltip clarifies the rule rather than nudging
//   them to sign in;
// — not signed in: prompt to sign in.
// canVote === true → no tooltip (action is available).
const voteTooltip = computed(() => {
  if (props.canVote) return ''
  if (props.canEdit) return '無法為自己的提案投票'
  return '登入後可投票'
})
</script>

<style scoped>
.proposal-card {
  background: #ffffff;
  border: 1px solid rgb(var(--color-divider));
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  transition: box-shadow 0.18s ease, border-color 0.18s ease;
}
/* No translate on hover — the card stays in place and only the shadow/border
   intensify. Translating clipped against overflow:hidden was making the top
   edge appear to vanish during the transition. */
.proposal-card:hover {
  border-color: rgba(180, 83, 9, 0.35);
  box-shadow: 0 6px 16px rgba(180, 83, 9, 0.10), 0 2px 4px rgba(0, 0, 0, 0.05);
}

/* Single-row meta panel: left = author info + visibility chip,
   right = delete (hover-revealed) + import + upvote + downvote. */
.meta {
  padding: 10px 14px;
  border-top: 1px solid rgb(var(--color-divider));
  background: linear-gradient(180deg, #FFFBF1 0%, #ffffff 70%);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 36px;
}
.meta-left {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: rgb(var(--color-ink-mute));
  min-width: 0;
  flex: 1 1 auto;
}
.author {
  font-weight: 600;
  color: rgb(var(--color-ink-soft));
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dot { opacity: 0.6; }

.visibility-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border-radius: 999px;
  background: #f3f4f6;
  border: 1px solid rgb(var(--color-divider));
  color: rgb(var(--color-ink-soft));
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s, color 0.12s;
}
.visibility-chip:hover:not(.visibility-chip--static) {
  background: rgb(var(--color-highlight));
  border-color: rgb(var(--color-focus));
  color: rgb(var(--color-ink));
}
.visibility-chip--public {
  background: #fef3c7;
  border-color: #fcd34d;
  color: #92400e;
}
.visibility-chip--public:hover:not(.visibility-chip--static) {
  background: #fde68a;
  border-color: #f59e0b;
}
.visibility-chip--static { cursor: default; }

/* hover-reveal: applied to the delete button so it stays out of the way
   until the card is hovered or focused. Keeps the row visually quiet for
   the common case (browsing). */
.hover-reveal {
  opacity: 0;
  transition: opacity 0.15s ease;
}
.proposal-card:hover .hover-reveal,
.hover-reveal:focus-visible { opacity: 1; }

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: rgb(var(--color-ink-mute));
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}
.icon-btn:hover {
  background: rgb(var(--color-highlight));
  color: rgb(var(--color-ink));
}
.icon-btn--danger:hover {
  background: #fee2e2;
  color: #b91c1c;
}

.actions {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  flex-shrink: 0;
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
/* Active states for the vote buttons: amber for upvote, slate for downvote.
   The colour pairing reads instantly without needing to read the count. */
.action-btn--up {
  background: #fef3c7;
  border-color: #f59e0b;
  color: #b45309;
}
.action-btn--down {
  background: #e0e7ff;
  border-color: #6366f1;
  color: #3730a3;
}
.action-btn--disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
/* Icon-only variant: square pill, no inner text. Same height as the vote
   pills so the row stays visually balanced. */
.action-btn--icon {
  padding: 4px 9px;
}
</style>
