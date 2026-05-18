<template>
  <button
    type="button"
    class="hero-set-card"
    :class="{ 'hero-set-card--active': active }"
    :aria-label="`${heroNames.join(' + ')}：${summary.variantCount} 個變體`"
    @click="$emit('open')"
  >
    <div class="portraits">
      <div class="portrait-cell portrait-cell--main">
        <PreviewPortrait :src="mainHero?.portrait ?? null" :alt="mainHero?.name" :render="68" />
        <span class="role-tag role-tag--main" title="主將">主</span>
      </div>
      <div v-for="(v, idx) in viceHeroes" :key="`v-${idx}`" class="portrait-cell">
        <PreviewPortrait :src="v?.portrait ?? null" :alt="v?.name" :render="68" />
      </div>
    </div>

    <div class="names">
      <span class="name name--main">{{ mainHero?.name ?? '—' }}</span>
      <span class="name-sep">·</span>
      <span class="name">{{ viceHeroes[0]?.name ?? '—' }}</span>
      <span class="name-sep">·</span>
      <span class="name">{{ viceHeroes[1]?.name ?? '—' }}</span>
    </div>

    <div class="stats">
      <span class="stat">
        <span class="stat-num">{{ summary.variantCount }}</span>
        <span class="stat-label">變體</span>
      </span>
      <span class="stat-divider" />
      <span class="stat">
        <el-icon :size="12" class="stat-icon stat-icon--up"><CaretTop /></el-icon>
        <span class="stat-num">{{ summary.totalUpvoteCount }}</span>
      </span>
      <span class="stat-divider" />
      <span class="stat" :class="trendClass" :title="trendTitle">
        <el-icon :size="12">
          <component :is="trendIcon" />
        </el-icon>
        <span class="stat-num">{{ trendDisplay }}</span>
      </span>
    </div>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { CaretTop, Top, Bottom, Minus } from '@element-plus/icons-vue'
import PreviewPortrait from './PreviewPortrait.vue'
import type { HeroSetSummary } from '../../lib/variants'

const props = defineProps<{
  summary: HeroSetSummary
  active?: boolean
}>()

defineEmits<{ (e: 'open'): void }>()

// Pull a representative variant's heroes for portrait/name display. The
// sample is the top-voted variant in the set — its hero composition IS the
// HeroSet by definition, so it's safe to read identity from any variant.
const team = computed(() => props.summary.sampleTeam)
const mainHero = computed(() => team.value?.main?.hero ?? null)
const viceHeroes = computed(() => [
  team.value?.vice1?.hero ?? null,
  team.value?.vice2?.hero ?? null,
])
const heroNames = computed(() =>
  [mainHero.value?.name, viceHeroes.value[0]?.name, viceHeroes.value[1]?.name]
    .filter(Boolean) as string[],
)

// 30-day delta: arrow + signed count. Zero gets a flat indicator so the
// stat strip never reads as a missing field.
const delta = computed(() => props.summary.recentVoteDelta)
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
const trendTitle = computed(() => `近 30 天淨投票 ${trendDisplay.value}`)
</script>

<style scoped>
/* Resting state is a quiet card; hover lifts the shadow + tints the border
   amber to match the project's brand. Selected state (active) keeps the
   amber border without hover to signal "this is currently open in the
   drawer". */
.hero-set-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 14px 12px;
  background: #ffffff;
  border: 1px solid rgb(var(--color-divider));
  border-radius: 12px;
  cursor: pointer;
  text-align: left;
  font: inherit;
  color: inherit;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.12s ease;
  width: 100%;
}
.hero-set-card:hover {
  border-color: rgba(180, 83, 9, 0.45);
  box-shadow: 0 6px 16px rgba(180, 83, 9, 0.10), 0 2px 4px rgba(0, 0, 0, 0.05);
}
.hero-set-card--active {
  border-color: #b45309;
  box-shadow: 0 0 0 1px #b45309, 0 6px 16px rgba(180, 83, 9, 0.12);
}

.portraits {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.portrait-cell {
  position: relative;
  display: flex;
  justify-content: center;
}
.portrait-cell--main :deep(.preview-portrait) {
  box-shadow: 0 0 0 2px #b45309, 0 0 0 3px #fff;
}
/* 主將 tag: amber pill nudged onto the portrait corner. Keep it small —
   the visual ring already differentiates the main slot; the chip is for
   accessibility and ambiguous cases (similar-looking portraits). */
.role-tag--main {
  position: absolute;
  top: -4px;
  left: 50%;
  transform: translateX(-50%);
  padding: 1px 6px;
  background: linear-gradient(135deg, #b45309 0%, #92400e 100%);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  border-radius: 999px;
  letter-spacing: 0.5px;
  pointer-events: none;
}

.names {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  font-size: 13px;
  color: rgb(var(--color-ink));
  line-height: 1.3;
}
.name {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 5em;
}
.name--main { color: #92400e; }
.name-sep { color: rgb(var(--color-ink-mute)); opacity: 0.5; }

.stats {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid rgb(var(--color-divider));
  font-size: 12px;
  color: rgb(var(--color-ink-mute));
  font-variant-numeric: tabular-nums;
}
.stat {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
.stat-num { font-weight: 700; color: rgb(var(--color-ink-soft)); }
.stat-label { font-size: 11px; }
.stat-divider {
  width: 1px;
  height: 12px;
  background: rgb(var(--color-divider));
}
.stat-icon--up { color: #b45309; }

/* Trend palette: green for positive, red for negative, neutral grey for
   zero. Subtle so the eye notices direction without screaming. */
.stat--trend-up   { color: #15803d; }
.stat--trend-up   .stat-num { color: #166534; }
.stat--trend-down { color: #b91c1c; }
.stat--trend-down .stat-num { color: #991b1b; }
.stat--trend-flat { color: rgb(var(--color-ink-mute)); opacity: 0.7; }
</style>
