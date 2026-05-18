<template>
  <el-drawer
    :model-value="modelValue"
    direction="rtl"
    :size="drawerSize"
    :with-header="false"
    :show-close="false"
    :destroy-on-close="false"
    class="variant-drawer"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div v-if="heroSet" class="drawer-body">
      <!-- Header: portraits ONLY. Hero names + role labels live inside each
           variant card below, so duplicating them here is noise. The 主將
           ring + a single amber accent on the stats bar carry the brand. -->
      <header class="set-header">
        <button
          type="button"
          class="close-btn"
          aria-label="關閉"
          @click="$emit('update:modelValue', false)"
        >
          <el-icon :size="18"><Close /></el-icon>
        </button>

        <div class="set-portraits">
          <div class="portrait-cell portrait-cell--main">
            <PreviewPortrait :src="mainHero?.portrait ?? null" :alt="mainHero?.name" :render="92" />
          </div>
          <div v-for="(v, idx) in viceHeroes" :key="`vh-${idx}`" class="portrait-cell">
            <PreviewPortrait :src="v?.portrait ?? null" :alt="v?.name" :render="92" />
          </div>
        </div>

        <div class="set-stats">
          <span class="stat">
            <span class="stat-num">{{ heroSet.variantCount }}</span>
            <span class="stat-label">變體</span>
          </span>
          <span class="stat-divider" />
          <span class="stat stat--up">
            <el-icon :size="13"><CaretTop /></el-icon>
            <span class="stat-num">{{ heroSet.totalUpvoteCount }}</span>
            <span class="stat-label">總贊</span>
          </span>
          <span class="stat-divider" />
          <span class="stat" :class="trendClass">
            <el-icon :size="13"><component :is="trendIcon" /></el-icon>
            <span class="stat-num">{{ trendDisplay }}</span>
            <span class="stat-label">近30天</span>
          </span>
        </div>
      </header>

      <!-- Controls: custom amber pill segmented control matches the project
           brand. Element Plus radio-buttons looked generic and broke the
           visual rhythm. -->
      <div class="controls">
        <span class="controls-label">排序</span>
        <div class="sort-pills" role="radiogroup" aria-label="變體排序方式">
          <button
            type="button"
            class="sort-pill"
            :class="{ 'sort-pill--active': variantSort === 'votes' }"
            role="radio"
            :aria-checked="variantSort === 'votes'"
            @click="$emit('sort', 'votes')"
          >
            <el-icon :size="12"><CaretTop /></el-icon>
            <span>投票</span>
          </button>
          <button
            type="button"
            class="sort-pill"
            :class="{ 'sort-pill--active': variantSort === 'latest' }"
            role="radio"
            :aria-checked="variantSort === 'latest'"
            @click="$emit('sort', 'latest')"
          >
            <el-icon :size="12"><Clock /></el-icon>
            <span>最新</span>
          </button>
        </div>
        <span class="controls-spacer" />
        <span v-if="consensusInfo" class="consensus-chip" :title="consensusInfo.tooltip">
          {{ consensusInfo.label }}
        </span>
      </div>

      <div class="variant-list" v-loading="loading">
        <p v-if="!loading && variants.length === 0" class="empty">
          這個英雄組合還沒有變體。
        </p>
        <VariantCard
          v-for="v in variants"
          :key="v.id"
          :variant="v"
          :first-author-name="firstAuthorName(v)"
          :contributors="contributorsFor(v.id)"
          :voted-direction="myVotes.get(v.id) ?? null"
          :is-my-contribution="myContributions.has(v.id)"
          :is-logged-in="isLoggedIn"
          @upvote="$emit('vote', { id: v.id, direction: 1 })"
          @downvote="$emit('vote', { id: v.id, direction: -1 })"
          @import-to-group="$emit('import-to-group', v)"
          @withdraw="$emit('withdraw', v)"
        />
      </div>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Close, CaretTop, Top, Bottom, Minus, Clock } from '@element-plus/icons-vue'
import PreviewPortrait from '../preview/PreviewPortrait.vue'
import VariantCard from '../preview/VariantCard.vue'
import type {
  HeroSetSummary,
  Variant,
  VariantContributor,
  VariantSort,
  VoteDirection,
} from '../../lib/variants'

const props = defineProps<{
  modelValue: boolean
  heroSet: HeroSetSummary | null
  variants: Variant[]
  contributorsByVariant: Map<string, VariantContributor[]>
  resolveAuthorName: (authorId: string | null) => string | null
  myVotes: Map<string, VoteDirection>
  myContributions: Set<string>
  isLoggedIn: boolean
  variantSort: VariantSort
  loading: boolean
}>()

defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'sort', sort: VariantSort): void
  (e: 'vote', payload: { id: string; direction: VoteDirection }): void
  (e: 'import-to-group', variant: Variant): void
  (e: 'withdraw', variant: Variant): void
}>()

const mainHero = computed(() => props.heroSet?.sampleTeam?.main?.hero ?? null)
const viceHeroes = computed(() => {
  const t = props.heroSet?.sampleTeam
  if (!t) return [null, null]
  const v1 = t.vice1?.hero ?? null
  const v2 = t.vice2?.hero ?? null
  const n1 = v1?.name ?? ''
  const n2 = v2?.name ?? ''
  return n1 <= n2 ? [v1, v2] : [v2, v1]
})

const drawerSize = computed(() => {
  if (typeof window === 'undefined') return '60%'
  return window.innerWidth < 768 ? '100%' : '60%'
})

const delta = computed(() => props.heroSet?.recentVoteDelta ?? 0)
const trendIcon = computed(() => {
  if (delta.value > 0) return Top
  if (delta.value < 0) return Bottom
  return Minus
})
const trendClass = computed(() => ({
  'stat--trend-up':   delta.value > 0,
  'stat--trend-down': delta.value < 0,
  'stat--trend-flat': delta.value === 0,
}))
const trendDisplay = computed(() => {
  if (delta.value > 0) return `+${delta.value}`
  if (delta.value < 0) return `${delta.value}`
  return '0'
})

// Surface insight from the variant distribution. >=60% concentration on a
// single variant → consensus; <40% → divergent meta. Thresholds chosen so
// chips don't appear too often (most sets won't qualify).
const consensusInfo = computed<{ label: string; tooltip: string } | null>(() => {
  if (props.variants.length < 2) return null
  const total = props.variants.reduce((s, v) => s + v.upvoteCount, 0)
  if (total < 10) return null
  const top = Math.max(...props.variants.map(v => v.upvoteCount))
  const share = top / total
  if (share >= 0.6) {
    return {
      label: '共識型',
      tooltip: `頂部變體佔 ${Math.round(share * 100)}% 贊數 — 玩家普遍認同單一配法`,
    }
  }
  if (share < 0.4) {
    return {
      label: '分歧型',
      tooltip: '贊數分散於多個變體 — 仍在被積極研究的活躍 meta',
    }
  }
  return null
})

const contributorsFor = (variantId: string): VariantContributor[] =>
  props.contributorsByVariant.get(variantId) ?? []

const firstAuthorName = (variant: Variant): string | null =>
  props.resolveAuthorName(variant.firstAuthorId)
</script>

<style scoped>
/* Drawer surface: warm amber gradient ties this surface to the rest of the
   brand (TeamPreviewCard, HeroSetCard) so it doesn't look like a generic
   Element Plus drawer that wandered in from someone else's app. */
.variant-drawer :deep(.el-drawer__body) {
  padding: 0;
  background: linear-gradient(180deg, #FFFBF1 0%, #FFFFFF 50%);
  overflow-y: auto;
}

.drawer-body {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 22px;
  min-height: 100%;
}

/* Set header: portraits + stats only, no labels and no names. The visual
   identity comes from the 主將 ring + amber stats bar; redundant text was
   stripped per design feedback. */
.set-header {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px 18px 14px;
  background: #ffffff;
  border: 1px solid rgba(180, 83, 9, 0.18);
  border-radius: 14px;
  box-shadow:
    0 2px 8px rgba(180, 83, 9, 0.05),
    inset 0 1px 0 rgba(180, 83, 9, 0.06);
}
.close-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: rgb(var(--color-ink-mute));
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 0.12s, color 0.12s;
  z-index: 1;
}
.close-btn:hover {
  background: rgb(var(--color-highlight));
  color: rgb(var(--color-ink));
}

.set-portraits {
  display: grid;
  grid-template-columns: repeat(3, max-content);
  justify-content: center;
  gap: 18px;
  padding-right: 32px;
  padding-left: 32px;
}
.portrait-cell {
  position: relative;
  display: flex;
  justify-content: center;
}
/* 主將 ring: layered amber → white shadow rings give the portrait a
   "framed" look without an extra DOM node. Subordinate viable but the
   main slot now reads instantly. */
.portrait-cell--main :deep(.preview-portrait) {
  box-shadow:
    0 0 0 2px #b45309,
    0 0 0 4px #fff,
    0 0 0 5px rgba(180, 83, 9, 0.25);
}

/* Stats bar: amber-tinted band that ties the header together with the
   skill tables below (which use the same amber accents). */
.set-stats {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 18px;
  padding: 10px 16px;
  background: linear-gradient(90deg, rgba(180, 83, 9, 0.04) 0%, rgba(180, 83, 9, 0.08) 50%, rgba(180, 83, 9, 0.04) 100%);
  border: 1px solid rgba(180, 83, 9, 0.12);
  border-radius: 999px;
  font-size: 13px;
  color: rgb(var(--color-ink-mute));
  font-variant-numeric: tabular-nums;
}
.stat {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.stat-num {
  font-weight: 700;
  font-size: 15px;
  color: rgb(var(--color-ink));
}
.stat-label {
  font-size: 11px;
  letter-spacing: 0.5px;
}
.stat-divider {
  width: 1px;
  height: 16px;
  background: rgba(180, 83, 9, 0.2);
}
.stat--up { color: #b45309; }
.stat--up .stat-num { color: #92400e; }
.stat--trend-up   { color: #15803d; }
.stat--trend-up   .stat-num { color: #166534; }
.stat--trend-down { color: #b91c1c; }
.stat--trend-down .stat-num { color: #991b1b; }
.stat--trend-flat { color: rgb(var(--color-ink-mute)); }

/* Controls row: amber-themed segmented control replaces the off-brand
   Element Plus radio. Container is a soft amber pill; active segment is
   filled amber with white text. */
.controls {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 4px;
}
.controls-label {
  font-size: 12px;
  font-weight: 700;
  color: rgb(var(--color-ink-mute));
  letter-spacing: 1px;
}
.controls-spacer { flex: 1; }
.sort-pills {
  display: inline-flex;
  gap: 3px;
  padding: 3px;
  background: rgba(180, 83, 9, 0.06);
  border: 1px solid rgba(180, 83, 9, 0.18);
  border-radius: 999px;
}
.sort-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 12px;
  border: none;
  background: transparent;
  color: rgb(var(--color-ink-mute));
  font-size: 12px;
  font-weight: 600;
  border-radius: 999px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, box-shadow 0.15s;
}
.sort-pill:hover:not(.sort-pill--active) {
  background: rgba(180, 83, 9, 0.08);
  color: rgb(var(--color-ink-soft));
}
.sort-pill--active {
  background: linear-gradient(135deg, #b45309 0%, #92400e 100%);
  color: #fff;
  box-shadow: 0 1px 3px rgba(180, 83, 9, 0.35);
}

.consensus-chip {
  padding: 4px 11px;
  border-radius: 999px;
  background: linear-gradient(135deg, rgba(180, 83, 9, 0.08) 0%, rgba(180, 83, 9, 0.14) 100%);
  border: 1px solid rgba(180, 83, 9, 0.3);
  color: #92400e;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.5px;
  cursor: help;
}

.variant-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 120px;
}
.empty {
  text-align: center;
  color: rgb(var(--color-ink-mute));
  padding: 36px 0;
  font-size: 13px;
}
</style>
