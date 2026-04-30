<template>
  <div class="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 py-8 px-4">
    <div class="max-w-3xl mx-auto">
      <!-- Header -->
      <div class="bg-white rounded-lg shadow-md p-5 mb-4">
        <div class="text-[11px] text-gray-400 mb-1">抽卡紀錄分享</div>
        <h1 class="text-xl md:text-2xl font-bold text-gray-800">{{ blob.banner?.name || '未命名抽卡池' }}</h1>
        <div v-if="blob.meta?.display_name" class="text-xs text-gray-500 mt-1">
          來自：{{ blob.meta.display_name }}
        </div>
        <div class="text-[10px] text-gray-400 mt-1">
          快照於 {{ snapshotTime }}
        </div>
      </div>

      <!-- Stats -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        <div class="bg-white rounded-lg shadow-sm p-3 text-center">
          <div class="text-[10px] text-gray-500">總抽卡</div>
          <div class="text-2xl font-bold tabular-nums">{{ totalDraws }}</div>
        </div>
        <div class="bg-white rounded-lg shadow-sm p-3 text-center">
          <div class="text-[10px] text-gray-500">稀有抽數</div>
          <div class="text-2xl font-bold tabular-nums text-yellow-600">★{{ markedCount }}</div>
        </div>
        <div class="bg-white rounded-lg shadow-sm p-3 text-center">
          <div class="text-[10px] text-gray-500">距上次稀有</div>
          <div class="text-2xl font-bold tabular-nums text-orange-600">{{ pity }}</div>
        </div>
        <div class="bg-white rounded-lg shadow-sm p-3 text-center">
          <div class="text-[10px] text-gray-500">稀有中位數</div>
          <div class="text-2xl font-bold tabular-nums">{{ medianGap ?? '—' }}</div>
        </div>
      </div>

      <!-- Top heroes -->
      <div v-if="topHeroes.length > 0" class="bg-white rounded-lg shadow-sm p-4 mb-4">
        <div class="text-xs font-bold text-gray-700 mb-2">出現頻率 Top 10</div>
        <div class="space-y-1">
          <div
            v-for="(row, i) in topHeroes"
            :key="row.jp"
            class="flex items-center gap-2 text-xs px-1.5 py-0.5 rounded transition-colors"
            :class="markedPerHero.get(row.jp)
              ? 'bg-yellow-50 ring-1 ring-yellow-200'
              : ''"
          >
            <span class="text-[10px] text-gray-400 w-4 text-right">{{ i + 1 }}</span>
            <span
              class="w-24 md:w-32 truncate font-medium"
              :class="markedPerHero.get(row.jp) ? 'text-yellow-800' : ''"
            >{{ heroByJp.get(row.jp)?.name || row.jp }}</span>
            <div class="flex-1 bg-gray-100 rounded h-3 overflow-hidden">
              <div
                class="h-full"
                :class="markedPerHero.get(row.jp) ? 'bg-yellow-400' : 'bg-blue-400'"
                :style="{ width: ((row.count / topHeroes[0].count) * 100) + '%' }"
              ></div>
            </div>
            <span class="tabular-nums w-8 text-right">{{ row.count }}</span>
            <span v-if="markedPerHero.get(row.jp)" class="text-yellow-500 text-sm leading-none">★</span>
          </div>
        </div>
      </div>

      <!-- Timeline -->
      <div class="bg-white rounded-lg shadow-sm p-4 mb-4">
        <div class="text-xs font-bold text-gray-700 mb-3">時間軸</div>
        <GachaLogList
          :draws="draws"
          :hero-by-jp="heroByJp"
          :rare-set="rareSet"
          readonly
        />
      </div>

      <!-- CTA back to app -->
      <div class="text-center pt-4">
        <a
          :href="rootHref"
          class="inline-block px-4 py-2 bg-orange-500 text-white text-sm rounded shadow hover:bg-orange-600 transition-colors"
        >
          我也想記錄我的抽卡 →
        </a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, PropType } from 'vue'
import { useData } from '../composables/useData'
import GachaLogList from './GachaLogList.vue'
import type { Hero } from '../composables/useData'
import {
  computeMedianGap,
  computeTopHeroes,
  type GachaDraw,
} from '../composables/useGachaLog'
import type { SpectatorBlob } from '../lib/gachaLog'

const props = defineProps({
  blob: { type: Object as PropType<SpectatorBlob>, required: true },
})

const { heroes } = useData()

const heroByJp = computed<Map<string, Hero>>(() => {
  const m = new Map<string, Hero>()
  for (const h of heroes.value) {
    const key = h.name_jp || h.name
    if (key) m.set(key, h)
  }
  return m
})

// Snapshot blob carries banner.rare_heroes — same model as the live view.
const rareSet = computed<Set<string>>(() => new Set(props.blob.banner?.rare_heroes ?? []))

// Synthesize GachaDraw[] (with stable index-based ids) for GachaLogList.
// IDs are not used by the readonly view but keep the type contract clean.
const draws = computed<GachaDraw[]>(() =>
  props.blob.draws.map((d, i) => ({
    id: -i - 1,
    banner_id: '',
    hero_jp: d.hero_jp,
    rarity: d.rarity,
    note: null,
    drawn_at: d.drawn_at,
  })),
)

const totalDraws = computed(() => draws.value.length)

const markedCount = computed(() => {
  const rare = rareSet.value
  if (rare.size === 0) return 0
  return draws.value.reduce((n, d) => n + (rare.has(d.hero_jp) ? 1 : 0), 0)
})

const pity = computed(() => {
  const rare = rareSet.value
  let count = 0
  for (const d of draws.value) {
    if (rare.has(d.hero_jp)) return count
    count++
  }
  return count
})

const medianGap = computed<number | null>(() => {
  const rare = rareSet.value
  const positions: number[] = []
  draws.value.forEach((d, i) => { if (rare.has(d.hero_jp)) positions.push(i) })
  return computeMedianGap(positions)
})

const drawsPerHero = computed<Map<string, number>>(() => {
  const m = new Map<string, number>()
  for (const d of draws.value) m.set(d.hero_jp, (m.get(d.hero_jp) ?? 0) + 1)
  return m
})

// Per-rare-hero draw count: drawsPerHero filtered to keys in the rare set.
const markedPerHero = computed<Map<string, number>>(() => {
  const rare = rareSet.value
  if (rare.size === 0) return new Map<string, number>()
  const m = new Map<string, number>()
  for (const [jp, count] of drawsPerHero.value) {
    if (rare.has(jp)) m.set(jp, count)
  }
  return m
})

const topHeroes = computed(() => computeTopHeroes(drawsPerHero.value))

const snapshotTime = computed(() => {
  try {
    return new Date(props.blob.meta.snapshot_at).toLocaleString()
  } catch { return props.blob.meta.snapshot_at }
})

const rootHref = computed(() => `${location.origin}${location.pathname}`)
</script>
