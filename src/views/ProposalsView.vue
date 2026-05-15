<template>
  <div class="flex-1 overflow-y-auto p-4 md:p-6">
    <div class="max-w-7xl">
      <div class="flex flex-wrap items-center gap-3">
        <span class="text-xs text-ink-mute font-bold tracking-wider">武將篩選</span>
        <el-select
          v-model="selectedHeroes"
          multiple
          collapse-tags
          collapse-tags-tooltip
          filterable
          placeholder="選擇武將以篩選包含該武將的提案"
          class="hero-filter"
          clearable
        >
          <el-option
            v-for="h in heroOptions"
            :key="h.value"
            :label="h.label"
            :value="h.value"
          />
        </el-select>
        <span v-if="selectedHeroes.length > 0" class="text-xs text-ink-mute">
          篩出 <span class="font-bold text-ink">{{ activeListLength }}</span> 筆
        </span>
      </div>

      <el-tabs v-model="activeTab" class="mt-4">
        <el-tab-pane label="熱門公開" name="public">
          <div v-loading="loadingPublic" class="min-h-[160px]">
            <p
              v-if="!loadingPublic && filteredPublic.length === 0"
              class="text-center text-ink-mute py-10 text-sm"
            >
              {{ publicProposals.length === 0 ? '目前還沒有公開提案。' : '篩選後沒有符合的提案。' }}
            </p>
            <template v-else>
              <div class="proposal-grid">
                <ProposalCard
                  v-for="p in filteredPublic"
                  :key="p.id"
                  :proposal="p"
                  :voted-direction="myVotes.get(p.id) ?? null"
                  :can-vote="isLoggedIn && !isOwnedByMe(p)"
                  :can-edit="isOwnedByMe(p)"
                  :current-user-name="displayName"
                  @upvote="onVote(p.id, 1)"
                  @downvote="onVote(p.id, -1)"
                  @import-to-group="onImportToGroup(p)"
                  @delete="onDelete(p)"
                  @toggle-public="onTogglePublic(p)"
                />
              </div>
              <div ref="publicSentinel" class="sentinel" aria-hidden="true" />
              <p v-if="loadingPublicMore" class="text-center text-ink-mute py-3 text-xs">
                載入中…
              </p>
              <p
                v-else-if="!publicHasMore && publicProposals.length > 0"
                class="text-center text-ink-mute py-3 text-xs"
              >
                已載完所有公開提案
              </p>
            </template>
          </div>
        </el-tab-pane>
        <el-tab-pane label="我的提案" name="mine" :disabled="!isLoggedIn">
          <div v-if="!isLoggedIn" class="text-center text-ink-mute py-10 text-sm">
            登入後可管理自己的提案。
          </div>
          <div v-else v-loading="loadingMine" class="min-h-[160px]">
            <p
              v-if="!loadingMine && filteredMine.length === 0"
              class="text-center text-ink-mute py-10 text-sm"
            >
              {{ myProposals.length === 0
                ? '還沒有任何提案。在配將模擬完成隊伍後，從側欄「另存為精選隊伍」建立。'
                : '篩選後沒有符合的提案。' }}
            </p>
            <div v-else class="proposal-grid">
              <ProposalCard
                v-for="p in filteredMine"
                :key="p.id"
                :proposal="p"
                :voted-direction="myVotes.get(p.id) ?? null"
                :can-vote="false"
                :can-edit="true"
                :current-user-name="displayName"
                @import-to-group="onImportToGroup(p)"
                @delete="onDelete(p)"
                @toggle-public="onTogglePublic(p)"
              />
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>

    <ExportTeamToGroupDialog
      v-model="exportDialogVisible"
      variant="import"
      :source="exportSource"
      :default-group-id="currentGroup?.id"
      @exported="onExported"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useProposals } from '../composables/useProposals'
import { useAuth } from '../composables/useAuth'
import { useData } from '../composables/useData'
import { useGroups } from '../composables/useGroups'
import { useGroupPersistence } from '../composables/useGroupPersistence'
import { useDialogs } from '../composables/useDialogs'
import { useLineups } from '../composables/useLineups'
import type { Proposal, ImportConflictResolution } from '../types/group'
import type { Lineup } from '../composables/useLineups'
import { applyConflictResolution } from '../lib/teamConflicts'
import ProposalCard from '../components/preview/ProposalCard.vue'
import ExportTeamToGroupDialog, { type ExportSource } from '../components/dialogs/ExportTeamToGroupDialog.vue'

const { isLoggedIn, user, displayName } = useAuth()
const { heroes } = useData()
const {
  myProposals, publicProposals, myVotes,
  loadingMine, loadingPublic, loadingPublicMore, publicHasMore,
  refreshMine, refreshPublic, loadMorePublic,
  vote, remove, togglePublic,
} = useProposals()

// Default to "我的提案" for signed-in users — that's the management surface
// they came here to use. Anonymous visitors land on "熱門公開" since their
// "mine" tab is disabled anyway.
const activeTab = ref<'public' | 'mine'>(isLoggedIn.value ? 'mine' : 'public')
const selectedHeroes = ref<string[]>([])
const publicSentinel = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

const isOwnedByMe = (p: Proposal): boolean =>
  !!user.value && p.authorId === user.value.id

onMounted(() => {
  void refreshPublic()
  if (isLoggedIn.value) void refreshMine()
})

const attachObserver = (): void => {
  if (observer || !publicSentinel.value) return
  observer = new IntersectionObserver((entries) => {
    if (entries.some(e => e.isIntersecting)) void loadMorePublic()
  }, { rootMargin: '200px' })
  observer.observe(publicSentinel.value)
}
const detachObserver = (): void => {
  observer?.disconnect()
  observer = null
}

// Sentinel mounts/unmounts as the public tab toggles and as the list switches
// between empty-state and grid. flush:'post' so the ref is current before we
// (re)attach.
watch([publicSentinel, activeTab], () => {
  if (activeTab.value === 'public' && publicSentinel.value) attachObserver()
  else detachObserver()
}, { flush: 'post' })

watch(activeTab, (now) => {
  if (now === 'mine' && isLoggedIn.value) void refreshMine()
  if (now === 'public') void refreshPublic()
})

// Flip to "我的提案" the moment a mid-session login completes so the user
// lands on their management surface instead of having to switch manually.
watch(isLoggedIn, (loggedIn) => {
  if (loggedIn && activeTab.value === 'public') activeTab.value = 'mine'
})

onBeforeUnmount(detachObserver)

// Hero dropdown options sorted by rarity desc then cost desc to match the
// ordering players see elsewhere. Value is the CHT name — that's what the
// team's role.hero.name field stores and what filtering compares against.
const heroOptions = computed(() => {
  const numericRarity = (r: number | string | undefined): number =>
    typeof r === 'number' ? r : Number(r) || 0
  return [...heroes.value]
    .sort((a, b) => numericRarity(b.rarity) - numericRarity(a.rarity) || (b.cost ?? 0) - (a.cost ?? 0))
    .map(h => ({ value: h.name, label: h.name }))
})

const teamMatchesFilter = (p: Proposal): boolean => {
  if (selectedHeroes.value.length === 0) return true
  const names = new Set<string>()
  if (p.team.main.hero?.name) names.add(p.team.main.hero.name)
  if (p.team.vice1.hero?.name) names.add(p.team.vice1.hero.name)
  if (p.team.vice2.hero?.name) names.add(p.team.vice2.hero.name)
  // Union semantics: a proposal matches if it contains ANY selected hero.
  return selectedHeroes.value.some(n => names.has(n))
}

const filteredPublic = computed(() => publicProposals.value.filter(teamMatchesFilter))
const filteredMine = computed(() => myProposals.value.filter(teamMatchesFilter))

const activeListLength = computed(() =>
  activeTab.value === 'public' ? filteredPublic.value.length : filteredMine.value.length,
)

const onVote = async (id: string, direction: 1 | -1) => {
  if (!isLoggedIn.value) {
    ElMessage.warning('請先登入')
    return
  }
  try {
    await vote(id, direction)
  } catch (e) {
    ElMessage.error(`投票失敗：${(e as Error).message}`)
  }
}

const onDelete = async (p: Proposal) => {
  try {
    await remove(p.id)
    ElMessage.success(`已刪除「${p.name}」`)
  } catch (e) {
    ElMessage.error(`刪除失敗：${(e as Error).message}`)
  }
}

const onTogglePublic = async (p: Proposal) => {
  const wasPublic = p.isPublic
  try {
    await togglePublic(p.id, !wasPublic)
    ElMessage.success(wasPublic ? '已設為私人' : '已公開')
    // Mirror the change into the public feed: going public re-fetches so the
    // newly-public proposal appears at the appropriate position; going private
    // just strips it from the local public list.
    if (wasPublic) {
      publicProposals.value = publicProposals.value.filter(x => x.id !== p.id)
    } else {
      void refreshPublic()
    }
  } catch (e) {
    ElMessage.error(`切換失敗：${(e as Error).message}`)
  }
}

// Export-to-group: parameterize the shared dialog with the proposal's team
// snapshot. excludeGroupId is intentionally omitted — from the proposal page,
// every local group is a valid destination including whatever is currently
// active in the builder.
const dialogs = useDialogs()
const { groups, currentGroup, currentGroupIndex, appendTeamToGroup } = useGroups()
const { addTeamFromSnapshot } = useLineups()
const { flushLocalAutosave } = useGroupPersistence()
const exportDialogVisible = dialogs.useDialog('export-team-to-group')
const exportSource = ref<ExportSource | null>(null)

const onImportToGroup = (p: Proposal) => {
  // Deep-clone so the proposal's frozen team blob never aliases reactive state.
  const team: Lineup = JSON.parse(JSON.stringify(p.team))
  exportSource.value = { team, displayName: p.name }
  exportDialogVisible.value = true
}

const onExported = ({
  destGroupIdx,
  resolution,
}: {
  destGroupIdx: number
  resolution: ImportConflictResolution
}) => {
  const src = exportSource.value
  if (!src) return
  const destGroup = groups[destGroupIdx]
  if (!destGroup) return
  applyConflictResolution(src.team, destGroup.teams, resolution)
  // When the destination is the currently active group, route through
  // useLineups.addTeamFromSnapshot so the lineups mirror stays in lockstep.
  // appendTeamToGroup only mutates groups[idx].teams — it doesn't fire the
  // currentGroup watcher (in-place push doesn't change group identity), so a
  // direct call leaves the builder's team list stale until the user switches
  // groups and back. Routing through useLineups for the current-group case
  // keeps the new team visible immediately.
  const isCurrent = destGroupIdx === currentGroupIndex.value
  const ok = isCurrent
    ? addTeamFromSnapshot(src.team)
    : appendTeamToGroup(destGroupIdx, src.team)
  if (!ok) {
    ElMessage.error('該編組已滿，無法加入')
    return
  }
  flushLocalAutosave()
  exportSource.value = null
  ElMessage.success(`已將「${src.displayName}」匯入到「${destGroup.name}」`)
}
</script>

<style scoped>
.hero-filter {
  min-width: 320px;
  max-width: 520px;
  flex: 1;
}

/* Responsive 1 / 2 / 3-column layout for proposal cards. xl breakpoint
   (≥1280px viewport) is when we have enough width for three compact cards
   side-by-side without squeezing the 3-hero row inside each card. */
.proposal-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
}
@media (min-width: 768px) {
  .proposal-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (min-width: 1280px) {
  .proposal-grid { grid-template-columns: repeat(3, 1fr); }
}

.sentinel {
  height: 1px;
  width: 100%;
}
</style>
