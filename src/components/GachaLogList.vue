<template>
  <div class="flex flex-col gap-3">
    <div v-if="props.draws.length === 0" class="text-center text-gray-400 py-10 text-sm">
      還沒有任何抽卡紀錄
    </div>

    <!-- Grouped (date-headered) mode -->
    <template v-if="!flat">
      <div
        v-for="group in grouped"
        :key="group.date"
        class="border-l-2 border-gray-200 pl-3"
      >
        <div class="flex items-baseline gap-2 mb-1.5">
          <div class="text-xs md:text-sm font-bold text-gray-700">{{ formatDate(group.date) }}</div>
          <div class="text-[10px] text-gray-400">{{ group.draws.length }} 筆</div>
          <div v-if="group.markedCount > 0" class="text-[10px] text-yellow-600">
            ★ {{ group.markedCount }}
          </div>
        </div>
        <div class="grid grid-cols-5 gap-1.5 lg:grid-cols-10">
          <DrawCard
            v-for="d in group.draws"
            :key="d.id"
            :draw="d"
            :hero="getHero(d)"
            :is-rare="rareSet.has(d.hero_jp)"
            :readonly="readonly"
            @contextmenu="onContextMenu($event, d)"
            @touchstart="onTouchStart($event, d)"
            @touchend="onTouchEnd"
            @touchcancel="onTouchEnd"
            @touchmove="onTouchEnd"
          />
        </div>
      </div>
    </template>

    <!-- Flat mode: single chronological list. Horizontal variant is a
         compact strip used by the picker tab to confirm what was just logged. -->
    <template v-else>
      <div
        :class="horizontal
          ? 'flex flex-row gap-1 overflow-x-auto pb-1'
          : 'grid grid-cols-5 gap-1.5 lg:grid-cols-10'"
      >
        <div
          v-for="(item, i) in flatItems"
          :key="item.draw.id"
          :class="horizontal ? 'w-12 lg:w-16 flex-shrink-0' : ''"
        >
          <DrawCard
            :draw="item.draw"
            :hero="getHero(item.draw)"
            :is-rare="rareSet.has(item.draw.hero_jp)"
            :readonly="readonly"
            :date-label="item.dateLabel"
            :index-from-end="props.draws.length - i"
            @contextmenu="onContextMenu($event, item.draw)"
            @touchstart="onTouchStart($event, item.draw)"
            @touchend="onTouchEnd"
            @touchcancel="onTouchEnd"
            @touchmove="onTouchEnd"
          />
        </div>
      </div>
    </template>

    <!-- Floating context menu (one shared instance, positioned at click coords) -->
    <Teleport to="body">
      <div
        v-if="menu.visible"
        class="fixed z-[3000] bg-white shadow-lg rounded-md border border-gray-200 py-1 min-w-[140px] animate-fade-in"
        :style="{ left: menu.x + 'px', top: menu.y + 'px' }"
        @click.stop
      >
        <div class="px-3 py-1.5 text-[11px] text-gray-500 border-b border-gray-100 truncate">
          {{ menuHeroName }} · {{ menuTime }}
        </div>
        <button
          class="w-full px-3 py-2 text-left text-sm hover:bg-yellow-50 text-yellow-700 flex items-center gap-2"
          @click="onAction('mark')"
        >
          <span class="text-base leading-none">★</span>
          {{ menu.draw && rareSet.has(menu.draw.hero_jp) ? '取消稀有' : '標記為稀有' }}
        </button>
        <button
          class="w-full px-3 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
          @click="onAction('delete')"
        >
          <el-icon><Delete /></el-icon>
          刪除
        </button>
      </div>
      <div
        v-if="menu.visible"
        class="fixed inset-0 z-[2999]"
        @click="closeMenu"
        @contextmenu.prevent="closeMenu"
      ></div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, PropType, reactive } from 'vue'
import { ElIcon } from 'element-plus'
import { Delete } from '@element-plus/icons-vue'
import type { Hero } from '../composables/useData'
import type { GachaDraw } from '../composables/useGachaLog'
import DrawCard from './GachaDrawCard.vue'

const props = defineProps({
  draws: { type: Array as PropType<GachaDraw[]>, required: true },
  heroByJp: { type: Object as PropType<Map<string, Hero>>, required: true },
  /** Set of JP hero names flagged rare for the current banner. Used to
   *  render the rare highlight per draw and label the context menu. */
  rareSet: {
    type: Object as PropType<Set<string>>,
    default: () => new Set<string>(),
  },
  readonly: { type: Boolean, default: false },
  /** When true, render a single chronological grid without per-day section
   *  headers. Used for the picker tab "what was just logged" strip. */
  flat: { type: Boolean, default: false },
  /** When true (only meaningful with flat=true), render a horizontal scrolling
   *  strip of compact half-size cards instead of a wrap-grid. */
  horizontal: { type: Boolean, default: false },
})

const emit = defineEmits<{
  (e: 'toggle-rare', heroJp: string): void
  (e: 'delete', id: number): void
}>()

// ---------- grouped (default) layout ----------

interface DayGroup {
  date: string
  draws: GachaDraw[]
  markedCount: number
}

const grouped = computed<DayGroup[]>(() => {
  const rare = props.rareSet
  const groups = new Map<string, DayGroup>()
  for (const d of props.draws) {
    const key = toDateKey(d.drawn_at)
    const isRare = rare.has(d.hero_jp)
    const g = groups.get(key)
    if (g) {
      g.draws.push(d)
      if (isRare) g.markedCount++
    } else {
      groups.set(key, { date: key, draws: [d], markedCount: isRare ? 1 : 0 })
    }
  }
  return Array.from(groups.values())
})

// ---------- flat layout: emit a date label whenever the date changes ----------

interface FlatItem {
  draw: GachaDraw
  /** Set on first card, and on any card whose date differs from the previous
   *  (more recent) card. UI shows it as a small overlay so the user can scan
   *  for day boundaries without separate section headers. */
  dateLabel: string | null
}

const flatItems = computed<FlatItem[]>(() => {
  const items: FlatItem[] = []
  let prevDate: string | null = null
  for (const d of props.draws) {
    const key = toDateKey(d.drawn_at)
    items.push({
      draw: d,
      dateLabel: key !== prevDate ? formatDate(key) : null,
    })
    prevDate = key
  }
  return items
})

// ---------- helpers ----------

const toDateKey = (iso: string): string => {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const formatDate = (key: string): string => {
  const today = toDateKey(new Date().toISOString())
  if (key === today) return '今天'
  const yest = new Date()
  yest.setDate(yest.getDate() - 1)
  if (key === toDateKey(yest.toISOString())) return '昨天'
  // Render as MM-DD for compactness in card overlays
  return key.slice(5)
}

const formatTime = (iso: string): string => {
  const d = new Date(iso)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

const getHero = (d: GachaDraw): Hero | undefined => props.heroByJp.get(d.hero_jp)

// ---------- shared floating context menu ----------

interface MenuState {
  visible: boolean
  x: number
  y: number
  draw: GachaDraw | null
}
const menu = reactive<MenuState>({ visible: false, x: 0, y: 0, draw: null })

const menuHeroName = computed(() => {
  if (!menu.draw) return ''
  return getHero(menu.draw)?.name || menu.draw.hero_jp
})
const menuTime = computed(() => menu.draw ? formatTime(menu.draw.drawn_at) : '')

const openMenuAt = (x: number, y: number, draw: GachaDraw): void => {
  const menuWidth = 160
  const menuHeight = 110
  const clampedX = Math.min(x, window.innerWidth - menuWidth - 8)
  const clampedY = Math.min(y, window.innerHeight - menuHeight - 8)
  menu.x = Math.max(4, clampedX)
  menu.y = Math.max(4, clampedY)
  menu.draw = draw
  menu.visible = true
}

const closeMenu = (): void => {
  menu.visible = false
  menu.draw = null
}

const onContextMenu = (evt: MouseEvent, draw: GachaDraw): void => {
  if (props.readonly) return
  evt.preventDefault()
  openMenuAt(evt.clientX, evt.clientY, draw)
}

const onAction = (kind: 'mark' | 'delete'): void => {
  const d = menu.draw
  if (!d) return
  closeMenu()
  if (kind === 'mark') emit('toggle-rare', d.hero_jp)
  else emit('delete', d.id)
}

// ---------- mobile long-press fallback ----------

let longPressTimer: ReturnType<typeof setTimeout> | null = null
const LONG_PRESS_MS = 450

const onTouchStart = (evt: TouchEvent, draw: GachaDraw): void => {
  if (props.readonly) return
  const t = evt.touches[0]
  if (!t) return
  const x = t.clientX
  const y = t.clientY
  longPressTimer = setTimeout(() => {
    longPressTimer = null
    openMenuAt(x, y, draw)
  }, LONG_PRESS_MS)
}
const onTouchEnd = (): void => {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
}

onBeforeUnmount(() => {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
})
</script>

<style scoped>
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fade-in {
  animation: fadeIn 0.12s ease-out;
}
</style>
