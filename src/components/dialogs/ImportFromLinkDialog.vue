<template>
  <el-dialog
    v-model="visible"
    title="共有リンクから取り込む"
    width="600px"
    align-center
    @opened="onDialogOpened"
    @closed="onDialogClosed"
  >
    <!-- Step 1: paste link / slug -->
    <div v-if="phase === 'input'" class="flex flex-col gap-3">
      <p class="text-sm text-ink-soft">
        共有リンク（例: <code class="text-xs px-1 bg-surface-muted rounded">…/#s/abc123</code>）または slug を貼り付けてください。
      </p>
      <el-input
        ref="inputRef"
        v-model="rawInput"
        placeholder="共有リンクまたは slug を貼り付け"
        clearable
        :disabled="!isShareEnabled()"
        @keyup.enter="onLoad"
      />
      <p v-if="!isShareEnabled()" class="text-xs text-red-500">
        共有バックエンドが未設定のため、リンクから取り込めません。
      </p>
    </div>

    <!-- Step 2: loading spinner -->
    <div v-else-if="phase === 'loading'" class="text-center py-8 text-sm text-ink-mute">
      <el-icon class="is-loading mr-1.5" :size="16"><Loading /></el-icon>
      載入中…
    </div>

    <!-- Step 3a: error -->
    <div v-else-if="phase === 'error'" class="flex flex-col gap-3">
      <el-alert :title="errorMessage" type="error" :closable="false" show-icon />
      <el-button @click="resetToInput" plain>入力し直す</el-button>
    </div>

    <!-- Step 3b: ready to import -->
    <div v-else-if="phase === 'ready'" class="flex flex-col gap-4">
      <p class="text-sm text-ink-soft leading-relaxed">
        この共有には <strong class="text-ink">{{ totalTeams }}</strong> 部隊が含まれ、
        <strong class="text-ink">{{ hydratedGroups.length }}</strong> 個の編組に分かれています。取り込み方法を選択してください。
      </p>

      <!-- Mode picker — option-card pattern mirrors MergeOnSignInDialog so
           the two login-adjacent dialogs share the same visual language.
           Native radio inputs + label wrapper give a single-click target with
           top-aligned title + hint stacked. -->
      <div class="flex flex-col gap-2">
        <label
          class="option-card"
          :class="{ 'option-card--active': mode === 'set' }"
        >
          <input type="radio" class="option-card__radio" value="set" v-model="mode" />
          <div class="option-card__content">
            <span class="option-card__title">整組匯入</span>
            <span class="option-card__hint">
              {{ hydratedGroups.length }} 個の編組として追加
            </span>
          </div>
        </label>
        <label
          class="option-card"
          :class="{ 'option-card--active': mode === 'pick' }"
        >
          <input type="radio" class="option-card__radio" value="pick" v-model="mode" />
          <div class="option-card__content">
            <span class="option-card__title">挑選隊伍</span>
            <span class="option-card__hint">
              共有内容から部隊を選び、現在の編組へ追加または現在の部隊を上書き
            </span>
          </div>
        </label>
      </div>

      <!-- Set mode body: list of incoming groups as VersionCards -->
      <div v-if="mode === 'set'" class="flex flex-col gap-2">
        <VersionCard
          v-for="g in hydratedGroups"
          :key="g.key"
          :name="g.displayName"
          tag="匯入"
          tag-variant="highlight"
          :warning="g.collidesWithExisting ? '將自動加上「匯入-」前綴' : undefined"
        >
          <template #meta>
            <span><strong>{{ g.teams.length }}</strong> 隊</span>
            <span v-if="nonEmptyTeamCount(g.teams) !== g.teams.length">
              其中 <strong>{{ nonEmptyTeamCount(g.teams) }}</strong> 支非空
            </span>
          </template>
        </VersionCard>
      </div>

      <!-- Pick mode body: one VersionCard per source group; each card hosts
           a checkbox list of its teams. Visually matches the merge-on-sign-in
           dialog and the set-mode preview above. -->
      <div v-else class="flex flex-col gap-3">
        <div class="text-xs text-ink-mute">
          現在の編組の空き枠:
          <strong class="tabular-nums" :class="capacityLeft <= 0 ? 'text-red-500' : 'text-ink'">
            {{ capacityLeft }}
          </strong>
        </div>
        <div class="max-h-72 overflow-y-auto flex flex-col gap-2 pr-1">
          <VersionCard
            v-for="g in hydratedGroups"
            :key="g.key"
            :name="g.displayName"
            tag="編組"
          >
            <template #meta>
              <span><strong>{{ g.teams.length }}</strong> 隊</span>
            </template>
            <div class="pick-team-list">
              <el-checkbox
                v-for="(t, i) in g.teams"
                :key="`${g.key}::t${i}`"
                :model-value="pickedKeys.includes(`${g.key}::t${i}`)"
                :disabled="isPickDisabled(`${g.key}::t${i}`)"
                @update:model-value="(v: string | number | boolean) => togglePick(`${g.key}::t${i}`, !!v)"
              >
                <span class="text-sm text-ink">{{ t.name }}</span>
                <span v-if="isEmptyTeam(t)" class="text-[10px] ml-1.5 text-ink-mute">（空隊伍）</span>
              </el-checkbox>
            </div>
          </VersionCard>
        </div>
        <!-- Append vs overwrite: only meaningful when exactly 1 selected. -->
        <el-radio-group v-if="pickedKeys.length === 1" v-model="pickAction" class="!flex gap-4">
          <el-radio value="append">現在の編組に追加</el-radio>
          <el-radio value="overwrite">覆寫當前顯示的隊伍</el-radio>
        </el-radio-group>
        <p v-else-if="pickedKeys.length >= 2" class="text-xs text-ink-mute">
          {{ pickedKeys.length }} 部隊を選択中です。すべて現在の編組へ追加します（複数選択時は単一部隊の上書きはできません）。
        </p>

        <!-- Conflict preview against the destination (current) group. Same
             visual language as the legacy proposal-import dialog. -->
        <div
          v-if="hasPickConflict"
          class="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 leading-snug"
        >
          <p class="font-bold mb-1">現在の編組内の他部隊と重複しています</p>
          <p v-if="pickConflicts.heroes.length > 0">
            武将: <span class="font-mono">{{ pickConflicts.heroes.join('、') }}</span>
          </p>
          <p v-if="pickConflicts.skills.length > 0">
            戦法: <span class="font-mono">{{ pickConflicts.skills.join('、') }}</span>
          </p>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2 flex-wrap">
        <el-button class="!rounded-sm" @click="visible = false">取消</el-button>
        <el-button
          v-if="phase === 'input'"
          type="primary"
          class="!rounded-sm"
          :disabled="!canLoad"
          @click="onLoad"
        >載入</el-button>
        <template v-if="phase === 'ready' && mode === 'pick' && hasPickConflict">
          <el-button
            class="!rounded-sm"
            :disabled="!canImport"
            @click="onConfirm('leave-empty')"
          >留空匯入</el-button>
          <el-button
            type="primary"
            class="!rounded-sm"
            :disabled="!canImport"
            @click="onConfirm('overwrite')"
          >從原隊移除</el-button>
        </template>
        <el-button
          v-else-if="phase === 'ready'"
          type="primary"
          class="!rounded-sm"
          :disabled="!canImport"
          @click="onConfirm('leave-empty')"
        >匯入</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { ElInput } from 'element-plus'
import { Loading } from '@element-plus/icons-vue'
import { loadShare, isShareEnabled } from '../../lib/share'
import { hydrateShareableTeam } from '../../lib/lineupSerialize'
import { useData } from '../../composables/useData'
import { useGroups } from '../../composables/useGroups'
import { MAX_TEAMS_PER_GROUP } from '../../types/group'
import { useLineups, isEmptyTeam, type Lineup } from '../../composables/useLineups'
import type { ShareableData, ShareableLineup } from '../../constants/gameData'
import type { ImportConflictResolution } from '../../types/group'
import { buildCollisionPool, previewCollisions } from '../../lib/teamConflicts'
import VersionCard from '../preview/VersionCard.vue'

// Mode discriminator emitted to the parent.
//   - kind: 'set'   → import as N new groups (preserving the share's structure)
//   - kind: 'teams' → import a flat list of teams into the current group;
//                     when only 1 team and action='overwrite', the picked team
//                     replaces the currently-displayed team in place.
//                     `resolution` carries the user's pick for hero/skill
//                     collisions with OTHER teams in the current group.
export type ImportFromLinkPayload =
  | { kind: 'set'; groups: { name: string; teams: Lineup[] }[]; healed: string[] }
  | {
      kind: 'teams'
      teams: Lineup[]
      action: 'append' | 'overwrite'
      resolution: ImportConflictResolution
      healed: string[]
    }

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'import', payload: ImportFromLinkPayload): void
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
})

type Phase = 'input' | 'loading' | 'error' | 'ready'

const phase = ref<Phase>('input')
const rawInput = ref('')
const errorMessage = ref('')
const inputRef = ref<InstanceType<typeof ElInput> | null>(null)

// Hydrated payload — set on a successful load.
interface HydratedGroup {
  key: string  // stable for v-for / picking
  displayName: string
  collidesWithExisting: boolean
  teams: Lineup[]
}
interface FlatTeam {
  key: string
  team: Lineup
}

const hydratedGroups = ref<HydratedGroup[]>([])
const healingReport = ref<string[]>([])
const mode = ref<'set' | 'pick'>('set')
const pickedKeys = ref<string[]>([])
const pickAction = ref<'append' | 'overwrite'>('append')

const { heroes, skills } = useData()
const { groups } = useGroups()
const { lineups } = useLineups()

// Total team count in the loaded share (informational).
const totalTeams = computed(() =>
  hydratedGroups.value.reduce((acc, g) => acc + g.teams.length, 0),
)

// Used by VersionCard meta slot to surface "X 隊 / 其中 Y 支非空" when the
// incoming group contains placeholder/empty teams alongside real ones.
const nonEmptyTeamCount = (teams: Lineup[]): number =>
  teams.reduce((n, t) => (isEmptyTeam(t) ? n : n + 1), 0)

// Pick-mode: how many more teams the current group can hold.
const capacityLeft = computed(() => Math.max(0, MAX_TEAMS_PER_GROUP - lineups.length))

// Flat (key, team) projection of hydratedGroups — only used by onConfirm
// to resolve pickedKeys back to actual Lineup payloads. Rendering iterates
// hydratedGroups directly so each source group becomes its own card.
const flatTeams = computed<FlatTeam[]>(() => {
  const out: FlatTeam[] = []
  for (const g of hydratedGroups.value) {
    for (let i = 0; i < g.teams.length; i++) {
      out.push({ key: `${g.key}::t${i}`, team: g.teams[i] })
    }
  }
  return out
})

// Per-row disabled state — recomputed against pickedKeys.length so the
// user can't over-select beyond capacity. Already-picked rows stay
// enabled so the user can untick them.
const isPickDisabled = (key: string): boolean => {
  if (pickedKeys.value.includes(key)) return false
  return pickedKeys.value.length >= capacityLeft.value
}

// Aggregate hero/skill collisions across all picked teams vs. the
// destination (current) group. In overwrite mode the team about to be
// replaced is excluded from the pool — it's going away anyway. Dedup is
// natural via Set inside buildCollisionPool + the union below.
const { currentTeamIndex } = useLineups()

// Pool only depends on lineups + which team (if any) is being overwritten.
// Splitting it out from pickConflicts means re-picking doesn't rebuild it.
const collisionPool = computed(() => {
  const excludeIdx =
    pickAction.value === 'overwrite' && pickedKeys.value.length === 1
      ? currentTeamIndex.value
      : undefined
  return buildCollisionPool(lineups, excludeIdx)
})

const pickConflicts = computed<{ heroes: string[]; skills: string[] }>(() => {
  if (mode.value !== 'pick' || pickedKeys.value.length === 0) {
    return { heroes: [], skills: [] }
  }
  const pool = collisionPool.value
  const heroes = new Set<string>()
  const skills = new Set<string>()
  for (const ft of flatTeams.value) {
    if (!pickedKeys.value.includes(ft.key)) continue
    const c = previewCollisions(ft.team, pool)
    c.heroes.forEach((n) => heroes.add(n))
    c.skills.forEach((n) => skills.add(n))
  }
  return { heroes: [...heroes], skills: [...skills] }
})

const hasPickConflict = computed(
  () => pickConflicts.value.heroes.length > 0 || pickConflicts.value.skills.length > 0,
)

const canLoad = computed(() => rawInput.value.trim().length > 0 && isShareEnabled())
const canImport = computed(() => {
  if (phase.value !== 'ready') return false
  if (mode.value === 'set') return hydratedGroups.value.length > 0
  if (pickedKeys.value.length === 0) return false
  if (pickAction.value === 'overwrite' && pickedKeys.value.length !== 1) return false
  // Append capacity check: total picked must fit. Disabled-state on individual
  // items prevents over-pick, but overwrite mode (single pick) is exempt.
  if (pickAction.value === 'append' && pickedKeys.value.length > capacityLeft.value) {
    return false
  }
  return true
})

// Strip URL noise so the user can paste a full link — we look for the last
// `s/` segment, which is the share-route prefix in the SPA router.
const extractSlug = (input: string): string => {
  const trimmed = input.trim()
  const idx = trimmed.lastIndexOf('s/')
  if (idx >= 0) return trimmed.slice(idx + 2).split(/[?#]/)[0]
  return trimmed.split(/[?#]/)[0]
}

const resetToInput = () => {
  phase.value = 'input'
  errorMessage.value = ''
  hydratedGroups.value = []
  healingReport.value = []
  pickedKeys.value = []
  pickAction.value = 'append'
  mode.value = 'set'
  nextTick(() => inputRef.value?.focus())
}

const onDialogOpened = () => {
  // Always re-enter at the input step; focus the input for paste convenience.
  nextTick(() => inputRef.value?.focus())
}

const onDialogClosed = () => {
  rawInput.value = ''
  resetToInput()
}

const togglePick = (key: string, checked: boolean) => {
  if (checked) {
    if (!pickedKeys.value.includes(key)) pickedKeys.value = [...pickedKeys.value, key]
  } else {
    pickedKeys.value = pickedKeys.value.filter((k) => k !== key)
  }
  // When picks drop back to ≤1, overwrite mode is allowed; keep current
  // pickAction unless it just became invalid (2+ → still append only).
  if (pickedKeys.value.length >= 2 && pickAction.value === 'overwrite') {
    pickAction.value = 'append'
  }
}

// Whether an incoming group name already exists in the user's groups[];
// surfaces a "本地-" prefix warning at preview time so the user understands
// the rename will happen on import.
const existingNames = computed(() => new Set(groups.map((g) => g.name)))

const onLoad = async () => {
  if (!canLoad.value) return
  const slug = extractSlug(rawInput.value)
  if (!slug) {
    errorMessage.value = '有効なリンクまたは slug を入力してください'
    phase.value = 'error'
    return
  }
  phase.value = 'loading'
  let blob: unknown
  try {
    blob = await loadShare(slug)
  } catch (e) {
    const msg = (e as Error).message
    if (/not found/i.test(msg)) errorMessage.value = '共有内容が見つかりません（削除された可能性があります）'
    else if (/invalid share slug/i.test(msg)) errorMessage.value = '連結格式錯誤'
    else errorMessage.value = `載入失敗：${msg}`
    phase.value = 'error'
    return
  }

  const data = blob as ShareableData
  if (typeof data !== 'object' || data === null) {
    errorMessage.value = '共有形式を識別できません'
    phase.value = 'error'
    return
  }
  if (data.v !== undefined && (data.v < 1 || data.v > 4)) {
    errorMessage.value = `対応していない共有形式です（バージョン ${data.v}）`
    phase.value = 'error'
    return
  }

  // Hydrate into per-group team lists. v3/v4 use `groups`; v1/v2 use `lineups`
  // (treat as an unnamed single group). Inventory (inv_h / inv_s) is
  // intentionally NOT applied — import-from-link only brings in teams /
  // groups, never overwrites the user's inventory.
  const deps = { heroes: heroes.value, skills: skills.value }
  const allHealed: string[] = []
  const resultGroups: HydratedGroup[] = []
  if (data.groups && data.groups.length > 0) {
    data.groups.forEach((g, gi) => {
      const teams = (g.teams ?? []).map((l: ShareableLineup, i: number) => {
        const r = hydrateShareableTeam(l, i, deps)
        allHealed.push(...r.healed)
        return r.team
      })
      const name = (g.name ?? '').trim() || `共有編組 ${gi + 1}`
      resultGroups.push({
        key: `g${gi}`,
        displayName: name,
        collidesWithExisting: existingNames.value.has(name),
        teams,
      })
    })
  } else if (data.lineups && data.lineups.length > 0) {
    const teams = data.lineups.map((l: ShareableLineup, i: number) => {
      const r = hydrateShareableTeam(l, i, deps)
      allHealed.push(...r.healed)
      return r.team
    })
    const name = '取り込んだ編組'
    resultGroups.push({
      key: 'g0',
      displayName: name,
      collidesWithExisting: existingNames.value.has(name),
      teams,
    })
  } else {
    errorMessage.value = 'この共有には部隊データが含まれていません'
    phase.value = 'error'
    return
  }

  hydratedGroups.value = resultGroups
  healingReport.value = Array.from(new Set(allHealed))

  // Default mode: 'set' when there's more than 1 group, otherwise 'pick'
  // (single-team shares are most often used as "import this one team").
  mode.value = totalTeams.value > 1 && resultGroups.length > 1 ? 'set' : 'pick'
  pickedKeys.value = []
  pickAction.value = 'append'
  phase.value = 'ready'
}

// `resolution` only matters when mode === 'pick'. The single-button branch
// passes 'leave-empty' for parity with the no-conflict case (the helper
// becomes a no-op when there are no collisions).
const onConfirm = (resolution: ImportConflictResolution = 'leave-empty') => {
  if (!canImport.value) return
  if (mode.value === 'set') {
    emit('import', {
      kind: 'set',
      groups: hydratedGroups.value.map((g) => ({
        name: g.displayName,
        teams: g.teams,
      })),
      healed: healingReport.value,
    })
  } else {
    const picked = flatTeams.value.filter((t) => pickedKeys.value.includes(t.key))
    emit('import', {
      kind: 'teams',
      teams: picked.map((p) => p.team),
      action: pickAction.value,
      resolution,
      healed: healingReport.value,
    })
  }
  visible.value = false
}

// Mode/action sync: if user flips between set/pick, reset selection-bound
// state so the footer-disabled state behaves consistently.
watch(mode, () => {
  if (mode.value === 'set') {
    pickedKeys.value = []
  }
})

</script>

<style scoped>
.pick-team-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.pick-team-list :deep(.el-checkbox) {
  height: auto;
  margin-right: 0;
}
.pick-team-list :deep(.el-checkbox__label) {
  font-size: 13px;
}

/* Mirror MergeOnSignInDialog's option-card styling so the two
   login-adjacent dialogs share the same visual language. */
.option-card {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  background: #ffffff;
  border: 1px solid rgb(var(--color-divider));
  border-radius: 8px;
  cursor: pointer;
  transition: background 120ms ease, border-color 120ms ease;
}
.option-card:hover {
  border-color: rgb(var(--color-focus) / 0.45);
}
.option-card--active {
  background: rgb(var(--color-highlight));
  border-color: rgb(var(--color-focus));
}
.option-card__radio {
  flex-shrink: 0;
  margin-top: 3px;
  width: 16px;
  height: 16px;
  accent-color: rgb(var(--color-focus));
  cursor: pointer;
}
.option-card__content {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}
.option-card__title {
  font-size: 14px;
  font-weight: 700;
  color: rgb(var(--color-ink));
  line-height: 1.3;
}
.option-card__hint {
  font-size: 12px;
  color: rgb(var(--color-ink-mute, 148 163 184));
  line-height: 1.5;
}
.option-card--active .option-card__title {
  color: rgb(var(--color-focus));
}
</style>
