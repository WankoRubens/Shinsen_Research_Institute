<template>
  <div class="variant-card">
    <!-- Head row: author meta on the left, action cluster on the right.
         Putting actions inline with the author trims the card's vertical
         footprint and frees the bottom for the variant content itself. -->
    <div class="head">
      <div class="head-left">
        <span class="author">
          <span class="author-prefix">原作</span>
          <strong class="author-name">{{ firstAuthorDisplay }}</strong>
        </span>
        <el-tooltip
          v-if="contributorCount > 1"
          placement="top"
          effect="dark"
          :content="contributorTooltip"
        >
          <span class="chip chip--contrib">+{{ contributorCount - 1 }} 貢獻者</span>
        </el-tooltip>
        <span v-if="isMyContribution" class="chip chip--mine" title="あなたが投稿した派生案">
          我的
        </span>
        <span class="time" :title="`首次提交：${variant.firstSubmittedAt}`">
          · {{ relativeTime(variant.updatedAt) }}
        </span>
      </div>
      <div class="head-right">
        <el-popconfirm
          v-if="isMyContribution"
          title="この派生案への投稿を取り下げますか？最後の投稿者の場合、この派生案全体が削除されます"
          confirm-button-text="撤回"
          cancel-button-text="キャンセル"
          confirm-button-type="danger"
          :width="280"
          @confirm="$emit('withdraw')"
        >
          <template #reference>
            <button
              type="button"
              class="icon-btn icon-btn--danger"
              title="撤回我的提交"
              aria-label="撤回我的提交"
            >
              <el-icon :size="14"><CircleClose /></el-icon>
            </button>
          </template>
        </el-popconfirm>
        <button
          type="button"
          class="action-btn action-btn--icon"
          title="編成へ取り込む"
          aria-label="編成へ取り込む"
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
          <span>{{ variant.upvoteCount }}</span>
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
          <span>{{ variant.downvoteCount }}</span>
        </button>
      </div>
    </div>

    <!-- TeamSkillsPreview now embeds its own watermark as the bottom edge
         of the skills table, so the card body proper ends with brand —
         the bingxue strip sits below as a separate block. -->
    <TeamSkillsPreview :team="normalizedTeam" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { CaretTop, CaretBottom, Position, CircleClose } from '@element-plus/icons-vue'
import type { Variant, VariantContributor } from '../../lib/variants'
import { withCanonicalViceOrder } from '../../lib/lineup'
import { relativeTime } from '../../lib/time'
import TeamSkillsPreview from './TeamSkillsPreview.vue'

const props = defineProps<{
  variant: Variant
  firstAuthorName?: string | null
  contributors?: VariantContributor[]
  votedDirection: -1 | 1 | null
  isMyContribution: boolean
  isLoggedIn: boolean
}>()

defineEmits<{
  (e: 'upvote'): void
  (e: 'downvote'): void
  (e: 'import-to-group'): void
  (e: 'withdraw'): void
}>()

const normalizedTeam = computed(() => withCanonicalViceOrder(props.variant.team))

const firstAuthorDisplay = computed<string>(() => {
  if (props.firstAuthorName) return props.firstAuthorName
  const first = (props.contributors ?? [])[0]
  return first?.authorName ?? '匿名'
})

const contributorCount = computed(() => props.contributors?.length ?? 0)

const contributorTooltip = computed(() => {
  const list = props.contributors ?? []
  if (list.length === 0) return ''
  return list.map(c => c.authorName ?? '匿名').join('、')
})

const canVote = computed(() => props.isLoggedIn && !props.isMyContribution)
const voteTooltip = computed(() => {
  if (canVote.value) return ''
  if (props.isMyContribution) return '自分が参加している派生案には投票できません'
  return '登入後可投票'
})
</script>

<style scoped>
.variant-card {
  background: linear-gradient(180deg, #FFFBF1 0%, #FFFFFF 22%, #FFFFFF 100%);
  border: 1px solid rgb(var(--color-divider));
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(180, 83, 9, 0.06);
  transition: box-shadow 0.18s ease, border-color 0.18s ease;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.variant-card:hover {
  border-color: rgba(180, 83, 9, 0.4);
  box-shadow: 0 6px 18px rgba(180, 83, 9, 0.10), 0 2px 4px rgba(0, 0, 0, 0.05);
}

/* Head row: text-heavy left, action cluster right. Wrap on narrow widths
   so actions drop below author info instead of crushing. */
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  font-size: 12px;
  color: rgb(var(--color-ink-mute));
}
.head-left {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1 1 auto;
  flex-wrap: wrap;
}
.author {
  display: inline-flex;
  align-items: baseline;
  gap: 5px;
  overflow: hidden;
}
.author-prefix {
  font-size: 11px;
  color: rgb(var(--color-ink-mute));
  letter-spacing: 1px;
  flex-shrink: 0;
}
.author-name {
  font-size: 14px;
  font-weight: 700;
  color: #92400e;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 10em;
}

.chip {
  display: inline-flex;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.3px;
}
.chip--contrib {
  background: #f3f4f6;
  border: 1px solid rgb(var(--color-divider));
  color: rgb(var(--color-ink-soft));
  cursor: help;
}
.chip--mine {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border: 1px solid #f59e0b;
  color: #92400e;
}

.time {
  font-size: 11px;
  color: rgb(var(--color-ink-mute));
  font-variant-numeric: tabular-nums;
}

.head-right {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}
.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  color: rgb(var(--color-ink-mute));
  cursor: pointer;
  transition: background 0.12s, color 0.12s, border-color 0.12s;
}
.icon-btn:hover {
  background: rgb(var(--color-highlight));
  color: rgb(var(--color-ink));
}
.icon-btn--danger:hover {
  background: #fee2e2;
  color: #b91c1c;
  border-color: #fca5a5;
}
.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 999px;
  background: #ffffff;
  border: 1px solid rgb(var(--color-divider));
  color: rgb(var(--color-ink-soft));
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s, box-shadow 0.15s;
  font-variant-numeric: tabular-nums;
}
.action-btn:hover:not(.action-btn--disabled) {
  background: rgb(var(--color-highlight));
  border-color: rgb(var(--color-focus));
}
.action-btn--up {
  background: linear-gradient(180deg, #fef3c7 0%, #fde68a 100%);
  border-color: #f59e0b;
  color: #b45309;
  box-shadow: 0 1px 2px rgba(245, 158, 11, 0.2);
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
.action-btn--icon { padding: 4px 9px; }
</style>
