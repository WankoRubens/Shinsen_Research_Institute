<template>
  <!-- Personal-collection card for the 我的提案 tab. Read-only display:
       only the visibility toggle is interactive, and it lives in the
       TeamPreviewCard header (before the title) via the title-prefix slot.
       Delete/import/vote actions were removed — the bottom meta panel
       was visual noise for what amounts to a quick visual catalog. -->
  <div class="proposal-card">
    <TeamPreviewCard
      :team="proposal.team"
      :title="proposal.name"
      density="compact"
      :bordered="false"
    >
      <template #title-prefix>
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
              :title="proposal.isPublic ? '點擊切換成私人' : '點擊切換成公開'"
              :aria-label="proposal.isPublic ? '切換成私人' : '切換成公開'"
              @click.stop
            >
              <el-icon :size="13">
                <component :is="proposal.isPublic ? View : Hide" />
              </el-icon>
              <span class="visibility-label">{{ proposal.isPublic ? '公開' : '私人' }}</span>
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
          <span class="visibility-label">{{ proposal.isPublic ? '公開' : '私人' }}</span>
        </span>
      </template>
    </TeamPreviewCard>
  </div>
</template>

<script setup lang="ts">
import { View, Hide } from '@element-plus/icons-vue'
import type { Proposal } from '../../types/group'
import TeamPreviewCard from './TeamPreviewCard.vue'

defineProps<{
  proposal: Proposal
  /** When true, the visibility chip becomes a clickable popconfirm trigger.
   *  Public listings (if any) would pass false so visitors see the state
   *  without being able to flip it. */
  canEdit: boolean
}>()

defineEmits<{
  (e: 'toggle-public'): void
}>()
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
.proposal-card:hover {
  border-color: rgba(180, 83, 9, 0.35);
  box-shadow: 0 6px 16px rgba(180, 83, 9, 0.10), 0 2px 4px rgba(0, 0, 0, 0.05);
}

/* Visibility chip: small pill with icon + label. Two palettes — private
   (neutral grey) and public (warm amber). Hover lifts only when clickable
   (i.e., NOT the --static variant rendered for non-owners). */
.visibility-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px 2px 6px;
  border-radius: 999px;
  background: #f3f4f6;
  border: 1px solid rgb(var(--color-divider));
  color: rgb(var(--color-ink-soft));
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.5px;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s, color 0.12s;
  line-height: 1.4;
  flex-shrink: 0;
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
.visibility-label {
  font-size: 11px;
  letter-spacing: 0.5px;
}
</style>
