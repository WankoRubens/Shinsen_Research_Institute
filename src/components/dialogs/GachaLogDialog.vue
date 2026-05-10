<template>
  <el-dialog
    v-model="visible"
    :show-close="isMobile"
    width="80%"
    :fullscreen="isMobile"
    align-center
    append-to-body
    :close-on-click-modal="true"
    class="gacha-dialog"
  >
    <!-- Custom header: editable banner name as title, no extra "抽卡紀錄" wrapper -->
    <template #header>
      <div class="flex items-center gap-2 pr-8">
        <template v-if="!editingName">
          <h2
            class="text-lg md:text-xl font-bold text-gray-800 truncate cursor-pointer hover:text-orange-600 transition-colors"
            :title="banners.length === 0 ? '尚無池' : '點擊重命名'"
            @click="startRenameTitle"
          >
            {{ currentBanner?.name || '抽卡紀錄' }}
          </h2>
          <el-button
            size="small"
            :icon="List"
            plain
            @click="bannerListVisible = true"
          >池清單</el-button>
        </template>
        <template v-else>
          <el-input
            v-model="nameDraft"
            size="default"
            maxlength="50"
            class="!w-56"
            @keyup.enter="submitRenameTitle"
            @keyup.esc="cancelRenameTitle"
            autofocus
          />
          <el-button size="small" type="primary" :icon="Check" @click="submitRenameTitle" />
          <el-button size="small" :icon="Close" @click="cancelRenameTitle" />
        </template>
      </div>
    </template>

    <div v-loading="isLoading" class="flex flex-col gap-3 h-full min-h-0">
      <!-- Empty banners state -->
      <div
        v-if="banners.length === 0"
        class="flex flex-col items-center justify-center py-16 text-center"
      >
        <p class="text-sm text-gray-500 mb-3">還沒有任何抽卡池</p>
        <el-button type="primary" :icon="Plus" @click="bannerListVisible = true">建立第一個池</el-button>
      </div>

      <template v-else-if="currentBanner && !editingPool">
        <!-- Stats bar: pity + counts + actions -->
        <div class="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg p-3">
          <div class="flex items-center gap-3 flex-wrap">
            <div class="flex items-baseline gap-1.5 flex-shrink-0">
              <span class="text-xs text-orange-700 font-bold">距上次稀有</span>
              <span class="text-xl md:text-2xl font-bold tabular-nums text-orange-600">{{ pityCount }}</span>
              <span class="text-xs text-gray-500">/ 6 抽</span>
            </div>
            <div class="flex gap-3 text-xs text-gray-700 flex-shrink-0 ml-auto">
              <span>總計 <b class="text-gray-900">{{ totalDraws }}</b></span>
              <span>稀有抽數 <b class="text-yellow-600">★{{ markedCount }}</b></span>
              <span>池內 <b class="text-gray-900">{{ currentBanner.hero_pool.length }}</b></span>
            </div>
          </div>
          <!-- Pity progress: 6 segments. The 6th is the guaranteed slot —
               game's pity rule is "5 misses + 6th must be rare", so once the
               counter exceeds 5 the user has logged a guaranteed-rare without
               marking it yet. Hint them to fix it in the history. -->
          <div class="mt-2">
            <div class="flex gap-1">
              <div
                v-for="i in 6"
                :key="i"
                class="flex-1 h-3 rounded-sm transition-colors"
                :class="segmentClass(i)"
              ></div>
            </div>
            <div
              v-if="pityCount > 5"
              class="mt-1.5 text-[11px] md:text-xs text-amber-700 flex items-center gap-1"
            >
              <span>💡</span>
              依保底機制，這 6 抽通常會出 1 個較好的；右鍵可標記為稀有以重置計數
            </div>
          </div>
          <div class="flex gap-2 mt-2 flex-wrap">
            <el-button size="small" :icon="Edit" plain @click="startEditPool">編輯池內武將</el-button>
            <el-button
              size="small"
              :icon="Share"
              :disabled="currentDraws.length === 0"
              plain
              @click="onShare"
            >分享</el-button>
          </div>
        </div>

        <!-- Tabs: picker / log+stats merged -->
        <el-tabs v-model="activeTab" class="gacha-tabs flex-1">
          <el-tab-pane label="快速登錄" name="picker">
            <div class="flex flex-col h-full gap-2">
              <!-- Top: chronological history strip — horizontal scroll, half-
                   size cards. Newest first, day-transition cards show a small
                   date badge so the user can scan break points. -->
              <div
                v-if="currentDraws.length > 0"
                class="flex-shrink-0 border-b border-gray-200 pb-2"
              >
                <div class="flex items-center gap-2 mb-1.5">
                  <span class="text-[11px] text-gray-500 font-bold">本池紀錄</span>
                  <span class="text-[10px] text-gray-400">{{ currentDraws.length }} 筆 · 最新在左</span>
                  <span class="text-[10px] text-gray-400 ml-auto">右鍵或長按開啟動作選單</span>
                </div>
                <GachaLogList
                  :draws="currentDraws"
                  :hero-by-jp="heroByJp"
                  flat
                  horizontal
                  :rare-set="currentRareSet"
                  @toggle-rare="onToggleHeroRare"
                  @delete="onDeleteDraw"
                />
              </div>
              <!-- Bottom: hero picker fills the remaining space -->
              <div class="flex-1 min-h-0 overflow-hidden">
                <GachaHeroPicker
                  :heroes="heroes"
                  :pool="currentBanner.hero_pool"
                  :marked-per-hero="markedPerHero"
                  @select="onSelectHero"
                  @edit-pool="startEditPool"
                />
              </div>
            </div>
          </el-tab-pane>
          <el-tab-pane :label="`紀錄與統計 (${currentDraws.length})`" name="log">
            <div class="flex flex-col h-full">
              <!-- Stats summary at top -->
              <div v-if="currentDraws.length > 0" class="flex flex-col gap-2 mb-3">
                <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div class="bg-gray-50 rounded p-2 text-center">
                    <div class="text-[10px] text-gray-500">總抽卡</div>
                    <div class="text-base md:text-lg font-bold tabular-nums">{{ totalDraws }}</div>
                  </div>
                  <div class="bg-gray-50 rounded p-2 text-center">
                    <div class="text-[10px] text-gray-500">稀有抽數</div>
                    <div class="text-base md:text-lg font-bold tabular-nums text-yellow-600">★{{ markedCount }}</div>
                  </div>
                  <div class="bg-gray-50 rounded p-2 text-center">
                    <div class="text-[10px] text-gray-500">稀有中位數</div>
                    <div class="text-base md:text-lg font-bold tabular-nums">{{ medianGap ?? '—' }}</div>
                  </div>
                  <div class="bg-gray-50 rounded p-2 text-center">
                    <div class="text-[10px] text-gray-500">距上次稀有</div>
                    <div class="text-base md:text-lg font-bold tabular-nums text-orange-600">{{ pityCount }}</div>
                  </div>
                </div>
                <details class="bg-gray-50 rounded p-2">
                  <summary class="text-xs font-bold text-gray-700 cursor-pointer">出現頻率 Top 10</summary>
                  <div class="space-y-1 mt-2">
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
                        class="w-20 md:w-32 truncate font-medium"
                        :class="markedPerHero.get(row.jp) ? 'text-yellow-800' : ''"
                      >{{ heroByJp.get(row.jp)?.name || row.jp }}</span>
                      <div class="flex-1 bg-white rounded h-2 overflow-hidden border border-gray-100">
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
                </details>
              </div>

              <div class="flex items-center gap-2 mb-2 flex-shrink-0">
                <span class="text-[11px] text-gray-400 ml-auto">右鍵或長按開啟動作選單</span>
              </div>
              <div class="flex-1 overflow-y-auto px-0.5">
                <GachaLogList
                  :draws="currentDraws"
                  :hero-by-jp="heroByJp"
                  :rare-set="currentRareSet"
                  @toggle-rare="onToggleHeroRare"
                  @delete="onDeleteDraw"
                />
              </div>
            </div>
          </el-tab-pane>
        </el-tabs>
      </template>

      <!-- Pool edit mode: takes over the dialog body, replaces tabs -->
      <template v-else-if="currentBanner && editingPool">
        <div class="flex items-center gap-2 mb-2 flex-shrink-0">
          <span class="text-sm font-bold text-gray-700">編輯池內武將</span>
          <span class="text-[11px] text-gray-400">已選 {{ poolDraftCht.length }} 位</span>
          <div class="ml-auto flex gap-1">
            <el-button size="small" @click="cancelEditPool">取消</el-button>
            <el-button
              size="small"
              type="primary"
              :loading="savingPool"
              :icon="Check"
              @click="submitEditPool"
            >完成</el-button>
          </div>
        </div>
        <div class="flex-1 min-h-0 md:border md:border-gray-200 md:rounded md:p-2">
          <GachaPoolEditor
            :heroes="heroes"
            v-model="poolDraftCht"
          />
        </div>
      </template>
    </div>

    <!-- Banner-list sub-dialog -->
    <BannerListDialog v-model="bannerListVisible" @created="onBannerCreated" />
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import {
  ElButton,
  ElDialog,
  ElInput,
  ElMessage,
  ElTabPane,
  ElTabs,
} from 'element-plus'
import { Check, Close, Edit, List, Plus, Share } from '@element-plus/icons-vue'
import { useData, type Hero } from '../../composables/useData'
import { computeMedianGap, computeTopHeroes, useGachaLog } from '../../composables/useGachaLog'
import { createShare } from '../../lib/share'
import { getSession } from '../../lib/auth'
import GachaHeroPicker from '../GachaHeroPicker.vue'
import GachaLogList from '../GachaLogList.vue'
import GachaPoolEditor from '../GachaPoolEditor.vue'
import BannerListDialog from './BannerListDialog.vue'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>()

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const { heroes } = useData()
const {
  banners,
  currentBanner,
  currentBannerId,
  currentRareSet,
  isLoading,
  currentDraws,
  pityCount,
  totalDraws,
  markedCount,
  drawsPerHero,
  markedPerHero,
  loadBanners,
  loadDraws,
  renameBanner,
  updateBannerPool,
  logDraw,
  toggleHeroRare,
  deleteDraw,
} = useGachaLog()

const activeTab = ref<'picker' | 'log'>('picker')

// Reactive viewport-mobile flag for el-dialog fullscreen prop. Updates on
// resize/orientation changes. 768px matches Tailwind's md breakpoint.
const mq = window.matchMedia('(max-width: 767px)')
const isMobile = ref(mq.matches)
const onMqChange = (e: MediaQueryListEvent) => { isMobile.value = e.matches }
mq.addEventListener('change', onMqChange)
onUnmounted(() => mq.removeEventListener('change', onMqChange))

// Inline title rename state
const editingName = ref(false)
const nameDraft = ref('')
const startRenameTitle = (): void => {
  if (!currentBanner.value) return
  nameDraft.value = currentBanner.value.name
  editingName.value = true
}
const cancelRenameTitle = (): void => {
  editingName.value = false
}
const submitRenameTitle = async (): Promise<void> => {
  if (!currentBanner.value) return
  const name = nameDraft.value.trim()
  if (!name || name === currentBanner.value.name) {
    editingName.value = false
    return
  }
  try {
    await renameBanner(currentBanner.value.id, name)
    editingName.value = false
    ElMessage.success('已重命名')
  } catch (e) {
    ElMessage.error(`重命名失敗：${(e as Error).message}`)
  }
}

const bannerListVisible = ref(false)

const heroByJp = computed<Map<string, Hero>>(() => {
  const m = new Map<string, Hero>()
  for (const h of heroes.value) {
    const key = h.name_jp || h.name
    if (key) m.set(key, h)
  }
  return m
})

const heroByCht = computed<Map<string, Hero>>(() => {
  const m = new Map<string, Hero>()
  for (const h of heroes.value) m.set(h.name, h)
  return m
})

// Color tiers for the 6-segment pity bar. Slot 6 uses a deeper amber instead
// of red — the user is free to never mark anything; this is informational.
const segmentClass = (slot: number): string => {
  if (slot > pityCount.value) return 'bg-white border border-yellow-200'
  if (slot === 6) return 'bg-amber-600'
  if (slot >= 4) return 'bg-orange-500'
  return 'bg-yellow-400'
}

const medianGap = computed<number | null>(() => {
  // Position indices of rare-hero draws within the current log; gaps between
  // consecutive positions give the per-rare interval distribution.
  const rare = currentRareSet.value
  const positions: number[] = []
  currentDraws.value.forEach((d, i) => {
    if (rare.has(d.hero_jp)) positions.push(i)
  })
  return computeMedianGap(positions)
})

const topHeroes = computed<{ jp: string; count: number }[]>(() =>
  computeTopHeroes(drawsPerHero.value),
)

// ---------- pool editing ----------

// HeroLibrary uses CHT names internally; we convert to/from JP at the
// boundary so the DB keeps a stable JP-name pool.
const editingPool = ref(false)
const poolDraftCht = ref<string[]>([])
const savingPool = ref(false)

const startEditPool = (): void => {
  if (!currentBanner.value) return
  // Pools are S-tier-only by design; drop any pre-existing non-S entries
  // when loading the draft so the editor stays consistent with what it shows.
  const chts: string[] = []
  for (const jp of currentBanner.value.hero_pool) {
    const h = heroByJp.value.get(jp)
    if (h && Number(h.rarity) === 5) chts.push(h.name)
  }
  poolDraftCht.value = chts
  editingPool.value = true
}

const cancelEditPool = (): void => {
  editingPool.value = false
  poolDraftCht.value = []
}

const submitEditPool = async (): Promise<void> => {
  if (!currentBanner.value) return
  // CHT → JP via heroByCht map. Override-added heroes without name_jp fall
  // back to CHT name (matches the convention in profiles + log entries).
  const jpList: string[] = []
  for (const cht of poolDraftCht.value) {
    const h = heroByCht.value.get(cht)
    if (!h) continue
    if (Number(h.rarity) !== 5) continue  // pool is S-tier only
    jpList.push(h.name_jp || h.name)
  }
  savingPool.value = true
  try {
    await updateBannerPool(currentBanner.value.id, jpList)
    editingPool.value = false
    poolDraftCht.value = []
    ElMessage.success('池內武將已更新')
  } catch (e) {
    ElMessage.error(`儲存失敗：${(e as Error).message}`)
  } finally {
    savingPool.value = false
  }
}

// ---------- dialog lifecycle ----------

watch(visible, async (now) => {
  if (!now) {
    // Reset transient state on close so the next open is consistent.
    editingPool.value = false
    editingName.value = false
    return
  }
  try {
    await loadBanners()
    if (currentBannerId.value) await loadDraws(currentBannerId.value)
  } catch (e) {
    ElMessage.error(`載入失敗：${(e as Error).message}`)
  }
})

// When banner switches (via BannerListDialog), refresh draws.
watch(currentBannerId, async (id) => {
  if (!id || !visible.value) return
  try {
    await loadDraws(id)
  } catch (e) {
    ElMessage.error(`載入失敗：${(e as Error).message}`)
  }
})

// Newly created banner has empty pool — drop user straight into pool-edit
// mode so they can populate it before logging draws. currentBannerId is
// already updated by useGachaLog.createBanner before this fires.
const onBannerCreated = (): void => {
  startEditPool()
}

// ---------- actions ----------

const onSelectHero = async (hero: Hero): Promise<void> => {
  try {
    await logDraw(hero)
  } catch (e) {
    ElMessage.error(`登錄失敗：${(e as Error).message}`)
  }
}

const onToggleHeroRare = async (heroJp: string): Promise<void> => {
  try {
    await toggleHeroRare(heroJp)
  } catch (e) {
    ElMessage.error(`標記失敗：${(e as Error).message}`)
  }
}

const onDeleteDraw = async (drawId: number): Promise<void> => {
  try {
    await deleteDraw(drawId)
    ElMessage.success('已刪除')
  } catch (e) {
    ElMessage.error(`刪除失敗：${(e as Error).message}`)
  }
}

const onShare = async (): Promise<void> => {
  if (!currentBanner.value) return
  const blob = {
    v: 3,
    kind: 'gacha_log',
    banner: {
      name: currentBanner.value.name,
      rare_heroes: currentBanner.value.rare_heroes,
    },
    draws: currentDraws.value.map(d => ({
      hero_jp: d.hero_jp,
      rarity: d.rarity,
      drawn_at: d.drawn_at,
    })),
    meta: {
      snapshot_at: new Date().toISOString(),
      // Surface the sharer's name in the spectator header. Falls back to
      // null for users who haven't set a display name — spectator hides
      // the "來自：" line entirely in that case.
      display_name: getSession()?.user.display_name ?? null,
    },
  }
  try {
    const slug = await createShare(blob, { kind: 'gacha_log' })
    const url = `${location.origin}${location.pathname}#s/${slug}`
    await navigator.clipboard.writeText(url).catch(() => undefined)
    ElMessage.success('已建立分享連結並複製到剪貼簿')
  } catch (e) {
    ElMessage.error(`分享失敗：${(e as Error).message}`)
  }
}
</script>

<style scoped>
/* el-tabs by default has natural height. To make tab-pane content fill the
   remaining body height, the whole tabs chain must be flex-column with the
   pane fed `height: 100%`. Without this, the pane just collapses and the
   inner `h-full` content resolves to 0. */
.gacha-tabs {
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.gacha-tabs :deep(.el-tabs__content) {
  flex: 1 1 0;
  min-height: 0;
  padding-top: 4px;
}
.gacha-tabs :deep(.el-tab-pane) {
  height: 100%;
}
.gacha-tabs :deep(.el-tabs__nav-wrap)::after {
  height: 1px;
}
</style>

<!-- Non-scoped: el-dialog with append-to-body teleports the .gacha-dialog
     box outside this component's DOM, so scoped :deep() cannot reach it
     (Vue scoped requires a [data-v-XXX] ancestor; teleport breaks the
     chain). Unique class name keeps these effectively local. -->
<style>
/* Cap dialog height and let the body scroll when content (Top 10 open,
   long pool editor, etc.) exceeds the viewport.
   CRITICAL override: Element Plus's `is-fullscreen` rule sets
   `overflow: auto` on .el-dialog, making the WHOLE dialog scroll.
   Forcing `overflow: hidden` makes the body become the scroll container. */
.gacha-dialog {
  /* DEFINITE height (not max-height) — `flex: 1 1 0` on the body needs a
     resolved parent height to actually expand. With max-height the dialog
     auto-sizes to content and the inner h-full chain collapses. */
  height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.gacha-dialog.is-fullscreen {
  height: 100vh;
}
/* Element Plus reserves margin-right on the header for the close button even
   when :show-close="false". Without this, desktop (close button hidden) gets
   a phantom right gap in the title row. */
.gacha-dialog .el-dialog__header {
  flex-shrink: 0;
  margin-right: 0;
}
.gacha-dialog .el-dialog__body {
  flex: 1 1 0;
  overflow-y: auto;
  min-height: 0;
}
/* Mobile fullscreen: shrink Element Plus's default padding (~20px around
   everything + extra header-bottom + footer-top) so the pool grid and log
   strip use the actual viewport width. Desktop keeps roomy defaults. */
@media (max-width: 767px) {
  .gacha-dialog.is-fullscreen {
    padding: 0;
  }
  .gacha-dialog.is-fullscreen .el-dialog__header {
    padding: 12px 12px 8px;
  }
  .gacha-dialog.is-fullscreen .el-dialog__headerbtn {
    top: 4px;
    right: 4px;
  }
  .gacha-dialog.is-fullscreen .el-dialog__body {
    padding: 0 8px 8px;
  }
}
</style>
