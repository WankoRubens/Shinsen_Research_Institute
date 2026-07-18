<template>
  <el-dialog
    v-model="visible"
    title="編成の同期競合"
    width="520px"
    :close-on-click-modal="false"
    :show-close="false"
    align-center
  >
    <template v-if="ctx">
      <p class="text-sm text-ink-soft mb-4 leading-relaxed">
        編成「<span class="font-bold text-ink">{{ ctx.serverRow.name }}</span>」は他の端末で更新されています。
        変更を上書きしないように、残すバージョンを選択してください。
      </p>

      <div class="grid grid-cols-2 gap-3 mb-4">
        <VersionCard :name="localGroup?.name ?? '—'" tag="本地">
          <template #meta>
            <span><strong>{{ localTeamCount }}</strong> 隊</span>
            <span>Cost <strong>{{ localCost }}</strong></span>
          </template>
        </VersionCard>

        <VersionCard :name="ctx.serverRow.name" tag="クラウド" tag-variant="highlight">
          <template #meta>
            <span><strong>{{ serverTeamCount }}</strong> 隊</span>
            <span>更新於 {{ serverUpdatedLabel }}</span>
          </template>
        </VersionCard>
      </div>

      <p class="text-[11px] text-ink-mute mb-4 leading-relaxed">
        ・クラウド版を採用: この端末の該当編成をクラウド版で置き換えます<br />
        ・ローカル版で上書き: ローカル版でクラウドを上書きします<br />
        ・今回は同期しない: このセッションではクラウド同期を止め、ローカル編集を続けます
      </p>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2 flex-wrap">
        <el-button class="!rounded-sm" :disabled="busy" @click="onDefer">今回は同期しない</el-button>
        <el-button class="!rounded-sm" :disabled="busy" @click="onUseServer">クラウド版を採用</el-button>
        <el-button type="primary" class="!rounded-sm" :loading="busy" @click="onForceOverwrite">
          ローカル版で上書き
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
import VersionCard from '../preview/VersionCard.vue'

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
    return new Date(ctx.value.serverRow.updated_at).toLocaleString('ja-JP')
  } catch {
    return ctx.value.serverRow.updated_at
  }
})

const onUseServer = async () => {
  busy.value = true
  try {
    await resolveConflictUseServer()
    ElMessage.success('クラウド版を採用しました')
  } finally {
    busy.value = false
  }
}

const onForceOverwrite = async () => {
  busy.value = true
  try {
    await resolveConflictForceOverwrite()
    ElMessage.success('ローカル版でクラウドを上書きしました')
  } finally {
    busy.value = false
  }
}

const onDefer = () => {
  resolveConflictDefer()
  ElMessage.info('このセッションではクラウド同期を停止しました')
}
</script>

