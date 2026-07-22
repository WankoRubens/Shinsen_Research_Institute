<template>
  <el-container direction="vertical" class="w-full bg-slate-50 flex-1 min-h-0">
    <el-main class="app-main p-0 overflow-hidden">

      <!-- View 1: Lineup Builder (Default) -->
      <div v-if="!isEditingInventory" class="flex flex-col md:flex-row h-full">
        <TeamListPanel
          :lineups="lineups"
          :current-team-index="currentTeamIndex"
          @select="(idx: number) => currentTeamIndex = idx"
          @add-team="onAddTeam"
          @share="dialogs.open('share')"
          @save-as-proposal="onSaveAsProposal"
          @export-to-group="onExportTeamToOtherGroup"
          @remove-team="onRemoveTeam"
        />

        <MobileTeamDrawer
          v-model="mobileSidebarVisible"
          :lineups="lineups"
          :current-team-index="currentTeamIndex"
          @select="(idx: number) => { currentTeamIndex = idx; mobileSidebarVisible = false }"
          @remove-team="onRemoveTeam"
          @add-team="onAddTeam"
          @share="dialogs.open('share')"
          @export-to-group="onExportTeamToOtherGroup"
          @import-from-link="dialogs.open('import-from-link')"
        />

        <LineupWorkspace
          v-model:lineup-shake-active="lineupShakeActive"
          :current-lineup="currentLineup"
          :current-selecting-skill-role="currentSelectingSkillRole"
          :current-selecting-skill-slot="currentSelectingSkillSlot"
          :swap-mode-role="swapModeRole"
          :drag-source-role="dragSourceRole"
          :is-skill-dragging="isSkillDragging"
          :conflicting-skill-names="conflictingSkillNames"
          @clear-skill-focus="clearSkillFocus"
          @open-hero-select="openHeroSelect"
          @open-skill-select="handleSkillSlotClick"
          @skill-drop="handleSkillDrop"
          @skill-drag-start="handleSkillDragStarted"
          @skill-drag-end="handleSkillDragEnded"
          @skill-slot-drop="handleSkillSlotDrop"
          @open-detail="openMobileDetail"
          @swap-click="handleSwapAction"
          @hero-drag-start="(role) => dragSourceRole = role"
          @hero-drag-end="() => dragSourceRole = null"
          @hero-drop="handleHeroDrop"
        />
      </div>

      <InventoryEditor
        v-else
        v-model:active-tab="inventoryActiveTab"
        :owned-heroes="tempOwnedHeroes"
        :owned-skills="tempOwnedSkills"
        :hero-breakthroughs="tempOwnedHeroBreakthroughs"
        @update:ownedHeroes="val => tempOwnedHeroes = val"
        @update:ownedSkills="val => tempOwnedSkills = val"
        @update:heroBreakthroughs="val => tempOwnedHeroBreakthroughs = val"
      />
    </el-main>

    <MobileSlotDetailDrawer
      v-model="mobileDetailVisible"
      :role="currentDetailRole"
      :role-data="currentDetailRole ? currentLineup[currentDetailRole] : null"
    />

    <HeroSelectDialog
      v-model="heroSelectDialogVisible"
      :used-heroes="allUsedHeroNames"
      :owned-heroes="ownedHeroes"
      :filter-owned="showOwnedOnly"
      @update:filterOwned="(value: boolean) => showOwnedOnly = value"
      @select="selectHeroFromLibrary"
    />

    <SkillSelectDialog
      v-model="skillSelectDialogVisible"
      :used-skills="allUsedSkillNames"
      :owned-skills="ownedSkills"
      :filter-owned="showOwnedOnly"
      @update:filterOwned="(value: boolean) => showOwnedOnly = value"
      @select="selectSkillFromDialog"
    />

    <ShareDialog
      v-model="shareDialogVisible"
      v-model:name="shareNameInput"
      :is-logged-in="isLoggedIn"
      :display-name="displayName"
      :group-name="currentGroup.name"
      @share="onShareDialogSubmit"
    />

    <ResetDialog v-model="resetDialogVisible" @confirm="clearLineup" />


    <CreateProposalDialog
      v-model="createProposalDialogVisible"
      :is-logged-in="isLoggedIn"
      :submitting="proposalSubmitting"
      :default-name="currentLineup.name"
      @submit="onSubmitProposal"
    />

    <ExportTeamToGroupDialog
      v-model="exportTeamDialogVisible"
      variant="export"
      :source="exportTeamSource"
      :exclude-group-id="currentGroup?.id"
      @exported="onExportTeamConfirmed"
    />

    <ImportFromLinkDialog
      v-model="importFromLinkDialogVisible"
      @import="onImportFromLink"
    />
  </el-container>

  <SkillDragPreview :skill="draggingSkill" :pos="dragPos" />
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import ResetDialog from '../components/dialogs/ResetDialog.vue'
import HeroSelectDialog from '../components/dialogs/HeroSelectDialog.vue'
import SkillSelectDialog from '../components/dialogs/SkillSelectDialog.vue'
import ShareDialog from '../components/dialogs/ShareDialog.vue'
import CreateProposalDialog from '../components/dialogs/CreateProposalDialog.vue'
import ExportTeamToGroupDialog, { type ExportSource } from '../components/dialogs/ExportTeamToGroupDialog.vue'
import ImportFromLinkDialog, { type ImportFromLinkPayload } from '../components/dialogs/ImportFromLinkDialog.vue'
import SkillDragPreview from '../components/lineup-builder/SkillDragPreview.vue'
import MobileTeamDrawer from '../components/lineup-builder/MobileTeamDrawer.vue'
import MobileSlotDetailDrawer from '../components/lineup-builder/MobileSlotDetailDrawer.vue'
import InventoryEditor from '../components/lineup-builder/InventoryEditor.vue'
import LineupWorkspace, { type Role } from '../components/lineup-builder/LineupWorkspace.vue'
import type { ResetTarget } from '../components/dialogs/ResetDialog.vue'
import type { ShareScope, ShareEventPayload } from '../components/dialogs/ShareDialog.vue'
import TeamListPanel from '../components/lineup-builder/TeamListPanel.vue'

import { useData, Hero, Skill } from '../composables/useData'

import { ShareableData, ShareableLineup } from '../constants/gameData'
import { useLineups, defaultStats, type Lineup } from '../composables/useLineups'
import { useGroups } from '../composables/useGroups'
import { MAX_TEAMS_PER_GROUP } from '../types/group'
import { useGroupPersistence } from '../composables/useGroupPersistence'
import { applyBlobToState, makeSerializer } from '../lib/lineupSerialize'
import { useInventory } from '../composables/useInventory'
import {
  createShare, loadShare, isShareEnabled, type ShareKind,
} from '../lib/share'
import { handleAuthCallback } from '../lib/auth'
import { useAuth } from '../composables/useAuth'
import { useActiveProfile } from '../composables/useActiveProfile'
import { useDialogs } from '../composables/useDialogs'
import { useProposals } from '../composables/useProposals'
import { applyConflictResolution } from '../lib/teamConflicts'
import type { ImportConflictResolution } from '../types/group'
import { useChangelog } from '../composables/useChangelog'
import { useProfiles } from '../composables/useProfiles'
import { consumeInitialHash } from '../lib/initial-hash'
import { heroLevel50Stats } from '../lib/heroStats'

const router = useRouter()

const {
  lineups,
  currentTeamIndex,
  currentLineup,
  allUsedHeroNames,
  allUsedSkillNames,
  clearLineup: clearLineupData,
  swapRoles,
  addTeam,
  addTeamFromSnapshot,
  removeTeamFromCurrent,
  ensureTeamCount,
} = useLineups()

const {
  groups,
  currentGroup,
  currentGroupIndex,
  setCurrentGroup,
  replaceGroups,
  regenerateCurrentGroupId,
  resetToDefault: resetGroupsToDefault,
  appendTeamToGroup,
  addGroup,
} = useGroups()

const {
  createFromLineup: createProposalFromLineup,
} = useProposals()

const {
  ownedHeroes,
  ownedSkills,
  ownedHeroBreakthroughs,
  showOwnedOnly,
  isEditingInventory,
  tempOwnedHeroes,
  tempOwnedSkills,
  tempOwnedHeroBreakthroughs,
  clearInventory,
} = useInventory()

const dialogs = useDialogs()
const { hasUnseen: hasUnseenChangelog } = useChangelog()

const heroSelectDialogVisible = dialogs.useDialog('hero-select')
const skillSelectDialogVisible = dialogs.useDialog('skill-select')
const resetDialogVisible = dialogs.useDialog('reset')
const shareDialogVisible = dialogs.useDialog('share')
const authDialogVisible = dialogs.useDialog('auth')
const mobileDetailVisible = dialogs.useDialog('mobile-slot-detail')
const mobileSidebarVisible = dialogs.useDialog('mobile-team-drawer')
const createProposalDialogVisible = dialogs.useDialog('create-proposal')
const exportTeamDialogVisible = dialogs.useDialog('export-team-to-group')
const importFromLinkDialogVisible = dialogs.useDialog('import-from-link')

// Snapshot the team to export at the moment the user clicks the menu entry.
// Captured here (not read live) so the dialog can sit open across edits to
// the live team without the snapshot mutating underneath the user.
const exportTeamSource = ref<ExportSource | null>(null)

const inventoryActiveTab = ref('heroes')

// Interaction State
const currentSelectingHeroRole = ref<Role | null>(null)
const currentSelectingSkillRole = ref<Role | null>(null)
const currentSelectingSkillSlot = ref<number | null>(null)

// Swap State
const swapModeRole = ref<Role | null>(null)
const dragSourceRole = ref<Role | null>(null)

// Skill drag preview
const draggingSkill = ref<Skill | null>(null)
const dragPos = ref({ x: 0, y: 0 })
const isSkillDragging = computed(() => draggingSkill.value !== null)

const onDragOverDoc = (e: DragEvent) => {
  dragPos.value = { x: e.clientX, y: e.clientY }
}

const handleSkillDragStarted = (skill: Skill) => {
  draggingSkill.value = skill
  document.addEventListener('dragover', onDragOverDoc)
}

const handleSkillDragEnded = () => {
  draggingSkill.value = null
  document.removeEventListener('dragover', onDragOverDoc)
}

// Mobile Detail State
const currentDetailRole = ref<Role | null>(null)

// Actions
const handleSwapAction = (role: Role) => {
  if (swapModeRole.value === null) {
    swapModeRole.value = role
  } else if (swapModeRole.value === role) {
    swapModeRole.value = null
  } else {
    swapRoles(swapModeRole.value, role)
    swapModeRole.value = null
    ElMessage.success('枠を入れ替えました')
  }
}

const handleHeroDrop = (targetRole: Role) => {
  if (dragSourceRole.value && dragSourceRole.value !== targetRole) {
    swapRoles(dragSourceRole.value, targetRole)
    ElMessage.success('枠を入れ替えました')
  }
  dragSourceRole.value = null
}

const openHeroSelect = (role: Role) => {
  if (swapModeRole.value !== null) {
    handleSwapAction(role)
    return
  }
  currentSelectingHeroRole.value = role
  heroSelectDialogVisible.value = true
}

const openMobileDetail = (role: Role) => {
  currentDetailRole.value = role
  mobileDetailVisible.value = true
}

const handleSkillSlotClick = (role: Role, slotIdx: number) => {
  currentSelectingSkillRole.value = role
  currentSelectingSkillSlot.value = slotIdx
  skillSelectDialogVisible.value = true
}

const handleSkillDrop = (role: Role, slotIdx: number, skill: Skill) => {
  const targetRole = currentLineup.value[role]
  if (slotIdx === 1) targetRole.skill1 = skill
  if (slotIdx === 2) targetRole.skill2 = skill
  ElMessage.success(`${skill.name_jp || skill.name}を習得しました`)
}

const handleSkillSlotDrop = (targetRole: Role, sourceRole: Role, sourceSlotIdx: number, targetSlotIdx: number) => {
  const src = currentLineup.value[sourceRole]
  const tgt = currentLineup.value[targetRole]
  const srcSkill = sourceSlotIdx === 1 ? src.skill1 : src.skill2
  const tgtSkill = targetSlotIdx === 1 ? tgt.skill1 : tgt.skill2
  if (targetSlotIdx === 1) tgt.skill1 = srcSkill
  else tgt.skill2 = srcSkill
  if (sourceSlotIdx === 1) src.skill1 = tgtSkill
  else src.skill2 = tgtSkill
}

// Assign a hero into a role. When the hero actually changes, reset that role's
// stats to the new hero's base and clear breakthrough — the previous values
// were relative to the old hero and no longer apply. This reset lives here (the
// explicit user-assignment path) rather than in a LineupSlot watch, so that
// switching teams or restoring saved data — which also change props.hero —
// never wipe the user's breakthrough/stat allocation.
const assignHeroToRole = (role: Role, hero: Hero) => {
  const slot = currentLineup.value[role]
  if (slot.hero?.name === hero.name) return
  slot.hero = hero
  // Fall back to defaultStats for any key the hero data is missing, so the
  // single source of truth lives in useLineups (no divergent literals).
  slot.stats = { ...defaultStats, ...heroLevel50Stats(hero) }
  slot.breakthrough = ownedHeroBreakthroughs.value[hero.name] ?? 0
}

const selectHeroFromLibrary = (hero: Hero) => {
  const selectedFromDialog = heroSelectDialogVisible.value
  if (currentSelectingHeroRole.value) {
    assignHeroToRole(currentSelectingHeroRole.value, hero)
    ElMessage.success(`${hero.name_jp || hero.name}を選択しました`)
  } else {
    if (!currentLineup.value.main.hero) assignHeroToRole('main', hero)
    else if (!currentLineup.value.vice1.hero) assignHeroToRole('vice1', hero)
    else if (!currentLineup.value.vice2.hero) assignHeroToRole('vice2', hero)
    else assignHeroToRole('main', hero)
  }
  if (selectedFromDialog) {
    heroSelectDialogVisible.value = false
    currentSelectingHeroRole.value = null
  }
}

const SKILL_SLOT_SEQUENCE: {r: Role, s: 1 | 2}[] = [
  {r: 'main', s: 1}, {r: 'main', s: 2},
  {r: 'vice1', s: 1}, {r: 'vice1', s: 2},
  {r: 'vice2', s: 1}, {r: 'vice2', s: 2},
]

const advanceFocus = () => {
  const currentIdx = SKILL_SLOT_SEQUENCE.findIndex(
    item => item.r === currentSelectingSkillRole.value && item.s === currentSelectingSkillSlot.value
  )
  if (currentIdx !== -1 && currentIdx < SKILL_SLOT_SEQUENCE.length - 1) {
    const next = SKILL_SLOT_SEQUENCE[currentIdx + 1]
    handleSkillSlotClick(next.r, next.s)
  } else {
    // Last slot was just filled — clear focus so the next pick goes back to
    // the auto-target flow instead of being stuck on the final slot.
    clearSkillFocus()
  }
}

const findFirstEmptySkillSlot = () => {
  for (const {r, s} of SKILL_SLOT_SEQUENCE) {
    const role = currentLineup.value[r]
    const slot = s === 1 ? role.skill1 : role.skill2
    if (!slot) return {r, s}
  }
  return null
}

const lineupShakeActive = ref(false)
const triggerLineupShake = () => {
  lineupShakeActive.value = false
  // Force restart the animation by toggling on next frame
  requestAnimationFrame(() => { lineupShakeActive.value = true })
}

const clearSkillFocus = () => {
  currentSelectingSkillRole.value = null
  currentSelectingSkillSlot.value = null
}

const selectSkillFromDialog = (skill: Skill) => {
  // 1. Use focused slot if any.
  // 2. Otherwise auto-target the first empty slot in the standard sequence.
  // 3. If none empty, shake the lineup grid to tell the user to focus a slot.
  const selectedFromDialog = skillSelectDialogVisible.value
  const hadFocus = !!currentSelectingSkillRole.value && currentSelectingSkillSlot.value !== null
  let targetRole = currentSelectingSkillRole.value
  let targetSlot = currentSelectingSkillSlot.value as 1 | 2 | null

  if (!hadFocus) {
    const empty = findFirstEmptySkillSlot()
    if (!empty) {
      triggerLineupShake()
      ElMessage.warning('すべての戦法枠が埋まっています。先に上書きしたい枠をクリックしてください')
      return
    }
    targetRole = empty.r
    targetSlot = empty.s
  }

  const role = currentLineup.value[targetRole!]
  if (targetSlot === 1) role.skill1 = skill
  if (targetSlot === 2) role.skill2 = skill
  ElMessage.success(`${skill.name_jp || skill.name}を習得しました`)

  if (selectedFromDialog) {
    skillSelectDialogVisible.value = false
    clearSkillFocus()
    return
  }

  // Only advance focus when the user explicitly focused a slot first.
  // Auto-targeted picks should keep focus cleared so subsequent clicks
  // continue to use the "fill next empty" flow.
  if (hadFocus) {
    currentSelectingSkillRole.value = targetRole
    currentSelectingSkillSlot.value = targetSlot
    advanceFocus()
  }
}

// Conflict detection: 兵種 and 陣法 may only have one active per team.
// Returns the set of skill names that participate in a duplicate group.
const conflictingSkillNames = computed(() => {
  const buckets: Record<string, string[]> = { '兵種': [], '陣法': [] }
  for (const {r, s} of SKILL_SLOT_SEQUENCE) {
    const role = currentLineup.value[r]
    const skill = s === 1 ? role.skill1 : role.skill2
    if (!skill) continue
    if (skill.type in buckets) buckets[skill.type].push(skill.name)
  }
  const out = new Set<string>()
  for (const names of Object.values(buckets)) {
    if (names.length > 1) names.forEach(n => out.add(n))
  }
  return out
})

const clearLineup = (type: ResetTarget) => {
  if (type === 'team') {
    clearLineupData('team')
    ElMessage.info('現在の部隊をリセットしました')
  }
  if (type === 'group') {
    // Clear teams in the current group, then regenerate its id so the next
    // cloud push removes the old (stale) cloud row instead of PATCH-ing it
    // — keeps the "reset this group" intent honest across local + cloud.
    clearLineupData('group')
    regenerateCurrentGroupId()
    ElMessage.info('現在の編成をリセットしました')
  }
  if (type === 'inventory') {
    clearInventory()
    ElMessage.info('所持をクリアしました')
  }
  if (type === 'all') {
    // Wipe groups[] back to a single default group (fresh id) and clear
    // inventory. The fresh id again ensures stale cloud rows get cleaned
    // up by stale-detect rather than silently overwritten.
    resetGroupsToDefault()
    clearInventory()
    ElMessage.info('すべてのデータをリセットしました')
  }
  // Synchronously persist so an immediate F5 / logout doesn't lose the
  // reset (the watcher's 800ms debounce would otherwise race the unload).
  flushLocalAutosave()
  resetDialogVisible.value = false
}

// Share / autosave / OAuth-recovery all serialize through the same factory
// in src/lib/lineupSerialize.ts so the JP-name mapping and field-name
// conventions live in one place. The maps are built once per call (cheap)
// from the current heroes/skills refs.
const serializer = computed(() =>
  makeSerializer({ heroes: heroes.value, skills: skills.value }),
)
const heroToJp = (cht: string | undefined): string | undefined =>
  serializer.value.toJpHero(cht)
const skillToJp = (cht: string | undefined): string | undefined =>
  serializer.value.toJpSkill(cht)
const serializeLineup = (l: Lineup): ShareableLineup =>
  serializer.value.serializeLineup(l)

// Optional name for the next share — entered in the share dialog when logged
// in. Reset whenever the share dialog opens so it doesn't carry over between
// actions.
const shareNameInput = ref('')
watch(shareDialogVisible, (now) => { if (now) shareNameInput.value = '' })

const shareLineup = async (type: ShareScope) => {
  // Default to v2 (flat single-team / inventory). The 'all' branch below
  // upgrades to v3 to carry the group envelope.
  const data: ShareableData = { v: 2 }
  if (type === 'inventory' || type === 'all') {
    data.inv_h = ownedHeroes.value.map(n => heroToJp(n) ?? n)
    data.inv_s = ownedSkills.value.map(n => skillToJp(n) ?? n)
    data.inv_bt = Object.fromEntries(
      Object.entries(ownedHeroBreakthroughs.value)
        .filter(([, count]) => count > 0)
        .map(([name, count]) => [heroToJp(name) ?? name, count]),
    )
  }
  if (type === 'current') {
    data.lineups = [serializeLineup(currentLineup.value)]
  }
  if (type === 'all') {
    // v3 envelope keeps the group name with the teams. Single-group only
    // until multi-group UI ships in Phase 3e/6; the schema scales.
    data.v = 3
    data.groups = [{
      name: currentGroup.value.name,
      teams: lineups.map(serializeLineup),
    }]
  }

  const origin = `${window.location.origin}${window.location.pathname}`
  const buildLegacyUrl = () => {
    const json = JSON.stringify(data)
    const b64 = btoa(unescape(encodeURIComponent(json)))
    return `${origin}#${b64}`
  }

  // Only logged-in shares can be named — anon shares aren't listed anywhere.
  // (Local var name avoids shadowing the displayName computed from useAuth.)
  const shareName = isLoggedIn.value ? shareNameInput.value.trim() : ''

  const kind: ShareKind = type === 'current' ? 'lineup' : type === 'all' ? 'group' : 'inventory'

  let url: string
  if (isShareEnabled()) {
    try {
      const slug = await createShare(data, { kind, ...(shareName ? { displayName: shareName } : {}) })
      url = `${origin}#s/${slug}`
    } catch (e) {
      console.warn('[share] short URL failed, using long URL fallback:', e)
      url = buildLegacyUrl()
    }
  } else {
    url = buildLegacyUrl()
  }

  navigator.clipboard.writeText(url).then(() => {
    ElMessage.success('共有リンクをクリップボードにコピーしました')
    shareDialogVisible.value = false
    shareNameInput.value = ''
  }).catch(() => {
    ElMessage.error('コピーに失敗しました。手動でURLをコピーしてください')
  })
}

// ShareDialog emits {scope, asPublic}. Honour asPublic only for 'current'
// scope (matching the dialog's helper text). Both paths run sequentially so
// the user always gets the share URL even if proposal publish fails.
const onShareDialogSubmit = async (payload: ShareEventPayload) => {
  const { scope, asPublic } = payload
  // Capture before shareLineup() resets shareNameInput.
  const proposalName = shareNameInput.value.trim()
    || `${currentGroup.value.name} · ${currentLineup.value.name}`
  await shareLineup(scope)
  if (scope === 'current' && asPublic && isLoggedIn.value) {
    try {
      await createProposalFromLineup(currentLineup.value, {
        name: proposalName,
        isPublic: true,
        authorName: displayName.value || null,
      })
      ElMessage.success('公開「おすすめ編成」へ追加しました')
    } catch (e) {
      ElMessage.error(`公開おすすめ編成の投稿に失敗しました: ${(e as Error).message}`)
    }
  }
}

const { heroes, skills } = useData()

// Restore in-memory state from a ShareableData blob — share links, OAuth
// recovery, and localStorage autosave all go through here. The healing pass
// (soft-null on unresolved JP keys) lives inside applyBlobToState so a
// renamed hero / skill upstream doesn't silently leave stale fields behind.
const restoreFromBlob = (data: ShareableData) => {
  const report = applyBlobToState(data, {
    heroes: heroes.value,
    skills: skills.value,
    ownedHeroes,
    ownedSkills,
    ownedHeroBreakthroughs,
    showOwnedOnly,
    lineups,
    ensureTeamCount,
    replaceGroups,
  })
  if (report.activeIndex != null && report.activeIndex >= 0 && report.activeIndex < groups.length) {
    setCurrentGroup(report.activeIndex)
  }
  if (report.healed.length > 0) {
    ElMessage.warning(
      `解析できない武将または戦法を ${report.healed.length} 件、自動で削除しました（データ更新後）`,
    )
  }
}

// Snapshot/consume recovery is provided by useGroupPersistence (so AppLayout's
// login button can also snapshot). LineupBuilder still owns the consumeRecovery
// trigger inside onMounted because that's where the post-redirect restore
// sequence is orchestrated.

// --- Auth ---
const {
  isLoggedIn, displayName, needsDisplayName,
  refreshFromStorage,
  sessionExpiredCount,
} = useAuth()

// TeamListPanel actions
const onAddTeam = () => {
  if (!addTeam()) ElMessage.info(`現在の編成は上限に達しています（${MAX_TEAMS_PER_GROUP} 部隊）`)
}

const onRemoveTeam = (idx: number) => {
  const team = lineups[idx]
  if (!team) return
  const removedName = team.name
  const wasLast = lineups.length === 1
  if (!removeTeamFromCurrent(idx)) return
  // Synchronously persist so an F5 / logout right after delete doesn't
  // lose the change (the autosave watcher's 800ms debounce would race
  // page unload otherwise). Same pattern as the reset handler.
  flushLocalAutosave()
  if (wasLast) {
    ElMessage.info(`「${removedName}」を削除し、空の部隊を自動作成しました`)
  } else {
    ElMessage.info(`「${removedName}」を削除しました`)
  }
}

const proposalSubmitting = ref(false)

const onSaveAsProposal = () => {
  // createProposal RLS gates on auth — short-circuit to the auth dialog so
  // anon users see the reason instead of a generic 401.
  if (!isLoggedIn.value) {
    ElMessage.info('おすすめ編成を保存するには先にログインしてください')
    authDialogVisible.value = true
    return
  }
  createProposalDialogVisible.value = true
}

const onSubmitProposal = async (payload: { name: string; comment: string; isPublic: boolean }) => {
  proposalSubmitting.value = true
  try {
    // Display-name cap (10 chars) lives inside createFromLineup so both
    // create paths stay consistent without callers having to remember it.
    await createProposalFromLineup(currentLineup.value, {
      name: payload.name,
      description: payload.comment || undefined,
      isPublic: payload.isPublic,
      authorName: displayName.value || null,
    })
    createProposalDialogVisible.value = false
    ElMessage.success('おすすめ編成を保存しました')
  } catch (e) {
    ElMessage.error(`作成に失敗しました: ${(e as Error).message}`)
  } finally {
    proposalSubmitting.value = false
  }
}

// Export-to-group: snapshot the focused team and open the picker. The
// destination dialog excludes the current group (via currentGroup.id), so
// the user only ever picks "somewhere else". Deep-clone here so a later
// edit to the live team can't mutate the snapshot held by the dialog.
const onExportTeamToOtherGroup = () => {
  if (groups.length <= 1) {
    ElMessage.info('他の編成がありません。先に「保存した編成」で新しい編成を作成してください')
    return
  }
  const live = currentLineup.value
  const cloned: Lineup = JSON.parse(JSON.stringify(live))
  exportTeamSource.value = { team: cloned, displayName: live.name }
  exportTeamDialogVisible.value = true
}

const onExportTeamConfirmed = ({
  destGroupIdx,
  resolution,
}: {
  destGroupIdx: number
  resolution: ImportConflictResolution
}) => {
  const src = exportTeamSource.value
  if (!src) return
  const destGroup = groups[destGroupIdx]
  if (!destGroup) return
  applyConflictResolution(src.team, destGroup.teams, resolution)
  // Branch on isCurrent so the lineups mirror stays in lockstep when the
  // destination IS the active group. The dialog's excludeGroupId pre-filter
  // makes this benign in normal flow, but cross-tab edits between dialog
  // open and confirm could shift `currentGroupIndex` into the picked slot —
  // mirror the ProposalsView pattern so the call site is structurally
  // correct regardless of UX guards above it.
  const isCurrent = destGroupIdx === currentGroupIndex.value
  const ok = isCurrent
    ? addTeamFromSnapshot(src.team)
    : appendTeamToGroup(destGroupIdx, src.team)
  if (!ok) {
    ElMessage.error('その編成は上限に達しているため追加できません')
    return
  }
  flushLocalAutosave()
  exportTeamSource.value = null
  ElMessage.success(`「${src.displayName}」を「${destGroup.name}」へ取り込みました`)
}

// Surface healing aggregate as a single info toast — share blobs created on
// older data versions may reference renamed hero/skill keys; the hydrator
// resets unresolvable roles to empty (see lineupSerialize.restoreRoleInto),
// and the count tells the user how many entries were dropped.
const reportHealedFromImport = (healed: string[]): void => {
  if (healed.length === 0) return
  ElMessage.warning(`解析できない武将または戦法を ${healed.length} 件、自動で削除しました（データバージョン差異）`)
}

const onImportFromLink = (payload: ImportFromLinkPayload) => {
  if (payload.kind === 'set') {
    // Replace-on-pristine: when the user's local state is the post-reset
    // default (single empty 預設 group, empty inventory), the imported
    // groups REPLACE local rather than appending. This avoids leaving a
    // dead empty placeholder at index 0 — without it, a later cloud restore
    // would land currentGroupIndex on the placeholder instead of the user's
    // real content (the "login lands on empty default" bug).
    if (isPristineDefaultState()) {
      const next = payload.groups.map((ig) => ({
        name: ig.name,
        teams: ig.teams.slice(0, MAX_TEAMS_PER_GROUP).map(
          (t) => JSON.parse(JSON.stringify(t)) as Lineup,
        ),
      }))
      const truncated = payload.groups.reduce(
        (n, ig) => n + Math.max(0, ig.teams.length - MAX_TEAMS_PER_GROUP),
        0,
      )
      replaceGroups(next)
      // replaceGroups defaults currentGroupIndex to 0 — that's the first
      // imported group, which is what we want here.
      flushLocalAutosave()
      reportHealedFromImport(payload.healed)
      if (truncated > 0) {
        ElMessage.warning(`${next.length} 個の編成を取り込みましたが、容量上限により ${truncated} 部隊をスキップしました`)
      } else {
        ElMessage.success(`${next.length} 個の編成を取り込みました`)
      }
      return
    }
    // Otherwise: append each incoming group as a NEW group. Prefix with
    // "取り込み-" when the display name collides with an existing group - keeps
    // the picker unambiguous on subsequent edits.
    const existing = new Set(groups.map((g) => g.name))
    let firstNewIdx: number | null = null
    let added = 0
    let truncated = 0
    for (const ig of payload.groups) {
      const finalName = existing.has(ig.name) ? `取り込み-${ig.name}` : ig.name
      const newIdx = addGroup(finalName)
      if (firstNewIdx === null) firstNewIdx = newIdx
      existing.add(finalName)
      // Push teams into the new group. appendTeamToGroup honors
      // MAX_TEAMS_PER_GROUP — log a truncation hint if any team is dropped.
      let pushed = 0
      for (const t of ig.teams) {
        const clone: Lineup = JSON.parse(JSON.stringify(t))
        if (appendTeamToGroup(newIdx, clone)) {
          pushed += 1
        } else {
          truncated += 1
        }
      }
      if (pushed > 0) added += 1
    }
    // Switch to the first new group so the user sees their import immediately.
    if (firstNewIdx !== null) setCurrentGroup(firstNewIdx)
    flushLocalAutosave()
    reportHealedFromImport(payload.healed)
    if (truncated > 0) {
      ElMessage.warning(`${added} 個の編成を追加しましたが、容量上限により ${truncated} 部隊をスキップしました`)
    } else {
      ElMessage.success(`${added} 個の編成を追加しました`)
    }
    return
  }
  // payload.kind === 'teams'
  // Apply hero/skill conflict resolution against the destination (current)
  // group BEFORE pushing. In overwrite mode the team about to be replaced is
  // excluded from the pool — it's going away. Mutates each incoming clone
  // and (for 'overwrite' resolution) the destination's other teams in place.
  //
  // Cascading mutation is intentional: applyConflictResolution rebuilds the
  // collision pool internally on each call, so iteration N+1 sees the
  // partially-mutated `lineups` from iteration N. The final state is
  // order-independent (same hero cleared once is idempotent), but resist
  // any "optimization" that pre-computes the pool once before the loop —
  // that would re-introduce collisions the prior iteration just cleared.
  const excludeIdx =
    payload.action === 'overwrite' ? currentTeamIndex.value : undefined
  const clones: Lineup[] = payload.teams.map(
    (t) => JSON.parse(JSON.stringify(t)) as Lineup,
  )
  for (const clone of clones) {
    applyConflictResolution(clone, lineups, payload.resolution, excludeIdx)
  }

  if (payload.action === 'overwrite') {
    // Exactly one team picked (validated by the dialog). Mirror onImportProposal's
    // role-level assignment so LineupSlot's bound proxies stay stable; the
    // team name is taken from the incoming team.
    const incoming = clones[0]
    const dest = currentLineup.value
    dest.name = incoming.name
    dest.main = incoming.main
    dest.vice1 = incoming.vice1
    dest.vice2 = incoming.vice2
    flushLocalAutosave()
    reportHealedFromImport(payload.healed)
    ElMessage.success('現在表示中の部隊を上書きしました')
    return
  }
  // append
  let added = 0
  for (const clone of clones) {
    if (addTeamFromSnapshot(clone)) added += 1
  }
  flushLocalAutosave()
  reportHealedFromImport(payload.healed)
  if (added === clones.length) {
    ElMessage.success(`${added} 部隊を現在の編成に追加しました`)
  } else {
    ElMessage.warning(`${added} 部隊を追加しました。残りは容量上限により追加できませんでした`)
  }
}

const { clearActiveProfile } = useActiveProfile()
const { tryAutoApplyDefault } = useProfiles()

// React to involuntary session expiration (refresh token revoked). The user
// did NOT click "sign out" — their token genuinely died (revoked elsewhere,
// password changed, refresh window exceeded). Quietly transition the UI:
// close any open overlay, drop the active profile name, and show a single
// warning toast. The lineup/inventory data is left intact so the user
// doesn't lose work — they can keep building offline or share anonymously.
watch(sessionExpiredCount, () => {
  dialogs.close()
  clearActiveProfile()
  ElMessage.warning('ログイン期限が切れました。クラウド同期するには再ログインしてください')
})

// Returns true if a competing UI was shown (toast / rename dialog) — caller
// uses this to suppress the changelog auto-open so it doesn't overlay them.
const initFromHash = async (): Promise<boolean> => {
  // Use the hash captured at module-load time (see lib/initial-hash.ts) —
  // vue-router rewrites location.hash on init by prepending a `/`, which
  // breaks URLSearchParams (auth) and slug detection (share).
  const initialHash = consumeInitialHash()
  const rawHash = initialHash.replace(/^#/, '')

  // 1. OAuth callback first — must consume the auth hash before share-loading.
  // handleAuthCallback cleans the URL via history.replaceState; we then sync
  // router state with router.replace('/') so it doesn't get stuck on the
  // catch-all path the user originally landed on.
  try {
    if (handleAuthCallback(initialHash)) {
      refreshFromStorage()
      const recovered = consumeRecovery()
      ElMessage.success(recovered ? 'ログインしました。設定を復元しました' : 'ログインしました')
      // First-time prompt: ask new users to pick a display name. AppLayout
      // owns the rename dialog and prefills the input when it opens.
      if (needsDisplayName.value) dialogs.open('rename')
      router.replace('/')
      return true
    }
  } catch (e) {
    ElMessage.error(`ログインに失敗しました: ${(e as Error).message}`)
    router.replace('/')
    return true
  }

  // 2. Share link (slug or legacy base64).
  if (rawHash && rawHash !== '/') {
    try {
      let data: ShareableData
      if (rawHash.startsWith('s/')) {
        data = (await loadShare(rawHash.slice(2))) as ShareableData
      } else {
        const json = decodeURIComponent(escape(atob(rawHash)))
        data = JSON.parse(json) as ShareableData
      }
      restoreFromBlob(data)
      ElMessage.success('共有された設定を読み込みました')
      router.replace('/')
    } catch (e) {
      ElMessage.error('無効な共有リンクです')
      router.replace('/')
    }
    return true
  }
  return false
}

// Autosave + restore — survives reload for both anon and signed-in users.
// restoreFromLocalStorage is a no-op if a share link or OAuth recovery has
// already mutated state (those paths win by convention — explicit intent
// beats ambient autosave). enableAutosave installs the deep watcher + the
// cross-tab BroadcastChannel listener. tryBootstrapCloudSync runs the
// anon→signed-in handoff (2x2 silent paths + the explicit merge dialog).
const {
  restoreFromLocalStorage,
  enableAutosave,
  tryBootstrapCloudSync,
  flushLocalAutosave,
  isPristineDefaultState,
  consumeRecovery,
  healingReport: autosaveHealingReport,
} = useGroupPersistence()

watch(autosaveHealingReport, (keys) => {
  if (keys.length === 0) return
  ElMessage.warning(
    `解析できない武将または戦法を ${keys.length} 件、自動で削除しました（データ更新後）`,
  )
})

onMounted(async () => {
  const consumedHash = await initFromHash()
  // restoreFromLocalStorage internally guards on isPristineDefaultState — if
  // a share link, OAuth recovery snapshot, or anything else already populated
  // the UI in this tick, this is a no-op.
  restoreFromLocalStorage()
  // Fire-and-forget: the auto-load sequencing only depends on initFromHash
  // (share/recovery should win if present). No reason to block the changelog
  // open on a Supabase round-trip — they don't conflict, and `consumedHash`
  // already gates the changelog independently.
  void tryAutoApplyDefault()
  // Enable autosave AFTER all the restore paths have had a chance to run.
  // Doing it earlier risks capturing transient pre-restore state into
  // localStorage. enableAutosave also flips the post-mount-ready latch
  // inside useGroupPersistence so later session events trigger bootstrap.
  enableAutosave()
  // Bootstrap cloud sync once the local restore + autosave watcher are
  // settled. If signed in, this fetches the cloud rows and runs the 2x2
  // merge decision (silent for 3 of 4 corners, dialog for both-non-empty).
  // No-op for anon users; runs again automatically on `persisted` session
  // events (post-OAuth callback).
  void tryBootstrapCloudSync()
  // Auto-open changelog only when nothing else is competing for the user's
  // attention. Triggers for both first-time visitors and returning users on
  // a release day (LATEST_VERSION mismatch).
  if (hasUnseenChangelog.value && !consumedHash) {
    dialogs.open('changelog')
  }
})
</script>

<style>
body {
  margin: 0;
  overflow: hidden;
}
/* Element Plus' lock-scroll adds `width: calc(100% - <scrollbarWidth>)`
   (and sometimes padding-right) to body when a modal/drawer mask opens,
   to compensate for the disappearing scrollbar. But our body is already
   `overflow: hidden` so there is no scrollbar to compensate for — the
   shrunk width just makes the content scale down from the top-left and
   leaves a white stripe on the right/bottom. Neutralize all of them. */
body.el-popup-parent--hidden,
html.el-popup-parent--hidden {
  width: 100% !important;
  padding-right: 0 !important;
  padding-bottom: 0 !important;
  overflow: hidden !important;
}
/* Mobile: compact header (height 50px, no horizontal padding). */
.app-header {
  --el-header-height: 60px;
  height: var(--el-header-height);
}
.app-main {
  flex: 1;
  min-height: 0;
}
@media (max-width: 767px) {
  .app-header {
    --el-header-height: 50px;
  }
  /* Tighten Element Plus button default margin between siblings on mobile. */
  .app-header .el-button + .el-button {
    margin-left: 4px;
  }
}
/* Tighten the gap between the hero/skill library tab header and its panel content.
   Element Plus default is margin: 0 0 15px; which leaves too much dead space. */
.el-tabs--top > .el-tabs__header.is-top {
  margin-bottom: 6px;
}
@media (max-width: 767px) {
  .el-tabs--top > .el-tabs__header.is-top {
    margin-bottom: 2px;
  }
}
/* Library tabs (hero/skill library): shorter header row (80% of EP default 40px). */
.library-tabs .el-tabs__item {
  height: 32px;
  line-height: 32px;
}
.library-tabs .el-tabs__nav-wrap::after {
  height: 1px;
}
/* Inventory editor (庫存編輯) — tighten the border-card tab panel.
   Default .el-tabs--border-card content padding is 15px; shrink on mobile
   and trim the header row to match the 80% rule used elsewhere. */
.inventory-tabs.el-tabs--border-card > .el-tabs__header .el-tabs__item {
  height: 32px;
  line-height: 32px;
}
@media (max-width: 767px) {
  .inventory-tabs.el-tabs--border-card {
    border: 0;
    box-shadow: none;
  }
  .inventory-tabs.el-tabs--border-card > .el-tabs__content {
    padding: 0;
  }
  .inventory-tabs.el-tabs--border-card > .el-tabs__header {
    margin-bottom: 0;
  }
}
.el-tabs {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.el-tabs__content {
  flex: 1;
  overflow: hidden; 
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.el-tab-pane {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.skill-select-dialog .el-dialog__body {
  padding: 10px 20px 20px;
  overflow: hidden;
}
@keyframes lineup-shake {
  0%, 100% { transform: translateX(0); }
  20%      { transform: translateX(-6px); }
  40%      { transform: translateX(6px); }
  60%      { transform: translateX(-4px); }
  80%      { transform: translateX(4px); }
}
.lineup-shake {
  animation: lineup-shake 0.4s ease-in-out;
}

</style>
