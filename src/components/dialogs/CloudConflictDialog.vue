<template>
  <el-dialog
    v-model="visible"
    title="編組同步衝突"
    width="520px"
    :close-on-click-modal="false"
    :show-close="false"
    align-center
  >
    <template v-if="ctx">
      <p class="text-sm text-ink-soft mb-4 leading-relaxed">
        編組「<span class="font-bold text-ink">{{ ctx.serverRow.name }}</span>」在其他裝置已被更新。
        為避免覆蓋對方的修改，請選擇要保留的版本。
      </p>

      <div class="grid grid-cols-2 gap-3 mb-4">
        <section class="version-card">
          <header class="version-card__head">
            <span class="version-card__tag">本地</span>
            <span class="version-card__name font-brand truncate">{{ localGroup?.name ?? '—' }}</span>
          </header>
          <div class="version-card__meta">
            <span><strong>{{ localTeamCount }}</strong> 隊</span>
            <span>Cost <strong>{{ localCost }}</strong></span>
          </div>
        </section>

        <section class="version-card">
          <header class="version-card__head">
            <span class="version-card__tag version-card__tag--cloud">雲端</span>
            <span class="version-card__name font-brand truncate">{{ ctx.serverRow.name }}</span>
          </header>
          <div class="version-card__meta">
            <span><strong>{{ serverTeamCount }}</strong> 隊</span>
            <span>更新於 {{ serverUpdatedLabel }}</span>
          </div>
        </section>
      </div>

      <p class="text-[11px] text-ink-mute mb-4 leading-relaxed">
        · 採用雲端 — 用雲端版本取代本地該編組<br />
        · 以本地覆寫 — 用本地版本覆蓋雲端，捨棄對方裝置的修改<br />
        · 暫不同步 — 本次階段停用雲端同步，繼續本地編輯
      </p>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2 flex-wrap">
        <el-button class="!rounded-sm" :disabled="busy" @click="onDefer">暫不同步</el-button>
        <el-button class="!rounded-sm" :disabled="busy" @click="onUseServer">採用雲端</el-button>
        <el-button type="primary" class="!rounded-sm" :loading="busy" @click="onForceOverwrite">
          以本地覆寫
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useGroups } from '../../composables/useGroups'
import { useGroupPersistence } from '../../composables/useGroupPersistence'
import { isEmptyTeam } from '../../composables/useLineups'
import { isEmptyShareableLineup } from '../../lib/lineupSerialize'

const {
  cloudConflict,
  resolveConflictUseServer,
  resolveConflictForceOverwrite,
  resolveConflictDefer,
} = useGroupPersistence()
const { groups } = useGroups()

const busy = ref(false)
const ctx = computed(() => cloudConflict.value)

// el-dialog needs a writable model. Open whenever a conflict is queued; the
// resolution handlers null it out, which auto-closes via the computed setter.
const visible = computed({
  get: () => ctx.value !== null,
  set: (v) => {
    if (!v) resolveConflictDefer()
  },
})

const localGroup = computed(() =>
  ctx.value ? groups.find((g) => g.id === ctx.value!.localGroupId) ?? null : null,
)

// Counts exclude empty teams (no hero in any role) — same definition the
// rest of the app uses for previews and team chips.
const localTeamCount = computed(() =>
  (localGroup.value?.teams ?? []).reduce(
    (n, t) => (isEmptyTeam(t) ? n : n + 1),
    0,
  ),
)
const localCost = computed(() =>
  localGroup.value
    ? localGroup.value.teams.reduce(
        (sum, t) =>
          sum +
          (t.main.hero?.cost ?? 0) +
          (t.vice1.hero?.cost ?? 0) +
          (t.vice2.hero?.cost ?? 0),
        0,
      )
    : 0,
)

const serverTeamCount = computed(() =>
  (ctx.value?.serverRow.teams ?? []).reduce(
    (n, t) => (isEmptyShareableLineup(t) ? n : n + 1),
    0,
  ),
)
const serverUpdatedLabel = computed(() => {
  if (!ctx.value) return ''
  try {
    return new Date(ctx.value.serverRow.updated_at).toLocaleString('zh-TW')
  } catch {
    return ctx.value.serverRow.updated_at
  }
})

const onUseServer = async () => {
  busy.value = true
  try {
    await resolveConflictUseServer()
    ElMessage.success('已採用雲端版本')
  } finally {
    busy.value = false
  }
}

const onForceOverwrite = async () => {
  busy.value = true
  try {
    await resolveConflictForceOverwrite()
    ElMessage.success('已以本地版本覆寫雲端')
  } finally {
    busy.value = false
  }
}

const onDefer = () => {
  resolveConflictDefer()
  ElMessage.info('本次階段已停用雲端同步')
}
</script>

<style scoped>
.version-card {
  background: #ffffff;
  border: 1px solid rgb(var(--color-divider));
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.version-card__head {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.version-card__tag {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.5px;
  padding: 1px 6px;
  border-radius: 2px;
  color: rgb(var(--color-ink-soft, 71 85 105));
  background: rgb(var(--color-surface-muted));
  border: 1px solid rgb(var(--color-divider));
}
.version-card__tag--cloud {
  color: rgb(var(--color-focus));
  background: rgb(var(--color-highlight));
  border-color: rgb(var(--color-focus) / 0.55);
}
.version-card__name {
  font-size: 14px;
  font-weight: 700;
  color: rgb(var(--color-ink));
  min-width: 0;
}
.version-card__meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: rgb(var(--color-ink-soft, 71 85 105));
  font-variant-numeric: tabular-nums;
}
.version-card__meta strong {
  color: rgb(var(--color-ink));
  font-weight: 700;
}
</style>
