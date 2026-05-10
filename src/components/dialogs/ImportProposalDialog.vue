<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="(v: boolean) => $emit('update:modelValue', v)"
    title="加入編組"
    width="540px"
    align-center
  >
    <div class="flex flex-col gap-3">
      <el-tabs v-model="tab" class="proposal-tabs">
        <el-tab-pane label="我的精選" name="mine">
          <div v-if="loadingMine" class="text-center text-xs text-ink-mute py-4">載入中…</div>
          <div v-else-if="myProposals.length === 0" class="text-center text-xs text-ink-mute py-4">
            尚未儲存任何精選隊伍。
          </div>
          <div v-else class="flex flex-col gap-1 max-h-60 overflow-y-auto">
            <button
              v-for="p in myProposals"
              :key="p.id"
              type="button"
              class="flex items-center justify-between gap-2 px-3 py-2 rounded border text-left transition-colors"
              :class="selectedId === p.id ? 'border-focus bg-highlight' : 'border-divider hover:bg-highlight/60'"
              @click="selectedId = p.id"
            >
              <div class="flex flex-col gap-0.5 min-w-0">
                <span class="text-sm font-bold truncate">{{ p.name }}</span>
                <span class="text-[11px] text-ink-mute truncate">
                  {{ p.authorName || '匿名' }} · {{ p.isPublic ? '公開' : '私人' }}
                </span>
              </div>
              <span class="text-xs text-ink-mute tabular-nums flex-shrink-0">♥ {{ p.voteCount }}</span>
            </button>
          </div>
        </el-tab-pane>

        <el-tab-pane label="公開列表" name="public">
          <div v-if="loadingPublic" class="text-center text-xs text-ink-mute py-4">載入中…</div>
          <div v-else-if="publicProposals.length === 0" class="text-center text-xs text-ink-mute py-4">
            目前還沒有任何公開精選隊伍。
          </div>
          <div v-else class="flex flex-col gap-1 max-h-60 overflow-y-auto">
            <button
              v-for="p in publicProposals"
              :key="p.id"
              type="button"
              class="flex items-center justify-between gap-2 px-3 py-2 rounded border text-left transition-colors"
              :class="selectedId === p.id ? 'border-focus bg-highlight' : 'border-divider hover:bg-highlight/60'"
              @click="selectedId = p.id"
            >
              <div class="flex flex-col gap-0.5 min-w-0">
                <span class="text-sm font-bold truncate">{{ p.name }}</span>
                <span class="text-[11px] text-ink-mute truncate">
                  {{ p.authorName || '匿名' }} · {{ p.isPublic ? '公開' : '私人' }}
                </span>
              </div>
              <span class="text-xs text-ink-mute tabular-nums flex-shrink-0">♥ {{ p.voteCount }}</span>
            </button>
          </div>
        </el-tab-pane>
      </el-tabs>

      <!-- Target selector — where the imported team lands. Append is the
           default unless the group is full; overwrite is always available
           and slots into the current team in place (preserving its name). -->
      <div class="flex flex-col gap-1.5 rounded border border-divider bg-highlight/40 px-3 py-2">
        <span class="text-xs text-ink-mute">匯入位置</span>
        <el-radio-group v-model="target" size="small">
          <el-radio value="append" :disabled="groupFull">
            加入為新隊伍
            <span class="text-[11px] text-ink-mute ml-0.5">
              （{{ groupFull ? `已滿 ${maxTeams}/${maxTeams}` : `目前 ${lineups.length}/${maxTeams}` }}）
            </span>
          </el-radio>
          <el-radio value="overwrite">
            覆寫目前隊伍 ({{ currentTeamName }})
          </el-radio>
        </el-radio-group>
        <p
          v-if="target === 'overwrite' && currentTeamHeroCount > 0"
          class="text-[11px] text-amber-800 leading-snug"
        >
          ⚠ 目前隊伍已配置 {{ currentTeamHeroCount }} 名武將，覆寫後將被取代。
        </p>
      </div>

      <div
        v-if="conflictPreview.heroes.length > 0 || conflictPreview.skills.length > 0"
        class="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 leading-snug"
      >
        <p class="font-bold mb-1">與其它隊伍重複</p>
        <p v-if="conflictPreview.heroes.length > 0">
          武將：<span class="font-mono">{{ conflictPreview.heroes.map(c => c.name).join('、') }}</span>
        </p>
        <p v-if="conflictPreview.skills.length > 0">
          戰法：<span class="font-mono">{{ conflictPreview.skills.map(c => c.name).join('、') }}</span>
        </p>
      </div>

      <!-- Two button modes:
           * No conflict — single primary; label reflects `target`.
           * With conflict — split into 留空匯入 / 從原隊移除. The 'overwrite'
             argument here is the *resolution* dimension (touch the origin
             teams' rows). The `target` dimension (append vs overwrite the
             current team) is independent and still controls *where* the
             imported team lands. -->
      <div class="flex justify-end gap-2 pt-1 border-t border-divider">
        <el-button @click="onCancel">取消</el-button>
        <template v-if="!hasAnyConflict">
          <el-button
            type="primary"
            :disabled="!selectedProposal || !canConfirm"
            @click="onImport('overwrite')"
          >
            {{ target === 'overwrite' ? '覆寫目前隊伍' : '加入為新隊伍' }}
          </el-button>
        </template>
        <template v-else>
          <el-button :disabled="!selectedProposal || !canConfirm" @click="onImport('leave-empty')">
            留空匯入
          </el-button>
          <el-button
            type="primary"
            :disabled="!selectedProposal || !canConfirm"
            @click="onImport('overwrite')"
          >
            從原隊移除
          </el-button>
        </template>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { Proposal, ImportConflictResolution } from '../../types/group'
import type { Lineup } from '../../composables/useLineups'

export type ImportTarget = 'append' | 'overwrite'

const props = defineProps<{
  modelValue: boolean
  loadingMine: boolean
  loadingPublic: boolean
  myProposals: Proposal[]
  publicProposals: Proposal[]
  /** Live snapshot of the current group's teams. */
  lineups: Lineup[]
  /** Index of the team that gets replaced under 'overwrite' target. */
  currentTeamIndex: number
  /** Per-group cap; mirrored in the radio label. */
  maxTeams: number
}>()
const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'tab-change', tab: 'mine' | 'public'): void
  (e: 'import', payload: { proposal: Proposal; resolution: ImportConflictResolution; target: ImportTarget }): void
}>()

const tab = ref<'mine' | 'public'>('mine')
const selectedId = ref<string | null>(null)
const target = ref<ImportTarget>('append')

const groupFull = computed(() => props.lineups.length >= props.maxTeams)
const currentTeam = computed(() => props.lineups[props.currentTeamIndex] ?? null)
const currentTeamName = computed(() => currentTeam.value?.name ?? '—')
const currentTeamHeroCount = computed(() => {
  const t = currentTeam.value
  if (!t) return 0
  let c = 0
  if (t.main.hero) c++
  if (t.vice1.hero) c++
  if (t.vice2.hero) c++
  return c
})

watch(tab, (t) => {
  selectedId.value = null
  emit('tab-change', t)
})

watch(() => props.modelValue, (now) => {
  if (now) {
    tab.value = 'mine'
    selectedId.value = null
    // Default target follows capacity. Append unless we're at the cap.
    target.value = groupFull.value ? 'overwrite' : 'append'
    emit('tab-change', 'mine')
  }
})

const selectedProposal = computed<Proposal | null>(() => {
  if (!selectedId.value) return null
  const list = tab.value === 'mine' ? props.myProposals : props.publicProposals
  return list.find(p => p.id === selectedId.value) ?? null
})

// Hero AND skill names already in OTHER teams — the collision pool that
// the picked proposal is checked against. When target is 'overwrite' the
// current team is excluded (it's about to be replaced wholesale).
const collisionPool = computed<{ heroes: Set<string>; skills: Set<string> }>(() => {
  const heroes = new Set<string>()
  const skills = new Set<string>()
  props.lineups.forEach((team, idx) => {
    if (target.value === 'overwrite' && idx === props.currentTeamIndex) return
    for (const role of ['main', 'vice1', 'vice2'] as const) {
      const r = team[role]
      if (r.hero) heroes.add(r.hero.name)
      if (r.skill1) skills.add(r.skill1.name)
      if (r.skill2) skills.add(r.skill2.name)
    }
  })
  return { heroes, skills }
})

interface ConflictItem { role: 'main' | 'vice1' | 'vice2'; slot?: 'skill1' | 'skill2'; name: string }

const conflictPreview = computed<{ heroes: ConflictItem[]; skills: ConflictItem[] }>(() => {
  const p = selectedProposal.value
  if (!p) return { heroes: [], skills: [] }
  const heroes: ConflictItem[] = []
  const skills: ConflictItem[] = []
  for (const role of ['main', 'vice1', 'vice2'] as const) {
    const r = p.team[role]
    if (r?.hero && collisionPool.value.heroes.has(r.hero.name)) {
      heroes.push({ role, name: r.hero.name })
    }
    if (r?.skill1 && collisionPool.value.skills.has(r.skill1.name)) {
      skills.push({ role, slot: 'skill1', name: r.skill1.name })
    }
    if (r?.skill2 && collisionPool.value.skills.has(r.skill2.name)) {
      skills.push({ role, slot: 'skill2', name: r.skill2.name })
    }
  }
  return { heroes, skills }
})

const hasAnyConflict = computed(() =>
  conflictPreview.value.heroes.length > 0 || conflictPreview.value.skills.length > 0,
)

// True only when the chosen target is actually executable. Append + full
// group is the only blocked combination today (radio is also disabled but
// guard belt-and-braces).
const canConfirm = computed(() => !(target.value === 'append' && groupFull.value))

const onCancel = () => emit('update:modelValue', false)

const onImport = (resolution: ImportConflictResolution) => {
  const p = selectedProposal.value
  if (!p || !canConfirm.value) return
  emit('import', { proposal: p, resolution, target: target.value })
}
</script>

<style scoped>
.proposal-tabs :deep(.el-tabs__nav-wrap::after) {
  background-color: var(--el-border-color-lighter);
}
</style>
