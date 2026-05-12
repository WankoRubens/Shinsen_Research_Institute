<template>
  <GachaSpectatorView v-if="gachaSpectatorBlob" :blob="gachaSpectatorBlob" />
  <el-container v-else direction="vertical" class="w-full bg-slate-50 flex-1 min-h-0">
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
          @add-to-group="onAddToGroup"
        />

        <MobileTeamDrawer
          v-model="mobileSidebarVisible"
          :lineups="lineups"
          :current-team-index="currentTeamIndex"
          @select="(idx: number) => { currentTeamIndex = idx; mobileSidebarVisible = false }"
        />

        <LineupWorkspace
          v-model:active-tab="activeTab"
          v-model:show-owned-only="showOwnedOnly"
          v-model:lineup-shake-active="lineupShakeActive"
          :current-lineup="currentLineup"
          :owned-heroes="ownedHeroes"
          :owned-skills="ownedSkills"
          :all-used-hero-names="allUsedHeroNames"
          :all-used-skill-names="allUsedSkillNames"
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
          @select-hero-from-library="selectHeroFromLibrary"
          @select-skill-from-library="selectSkillFromDialog"
        />
      </div>

      <InventoryEditor
        v-else
        v-model:active-tab="inventoryActiveTab"
        :owned-heroes="tempOwnedHeroes"
        :owned-skills="tempOwnedSkills"
        @update:ownedHeroes="val => tempOwnedHeroes = val"
        @update:ownedSkills="val => tempOwnedSkills = val"
      />
    </el-main>

    <MobileSlotDetailDrawer
      v-model="mobileDetailVisible"
      :role="currentDetailRole"
      :role-data="currentDetailRole ? currentLineup[currentDetailRole] : null"
      @update:hero="(h) => { if (currentDetailRole) currentLineup[currentDetailRole].hero = h }"
    />

    <SkillSelectDialog
      v-model="skillSelectDialogVisible"
      :used-skills="allUsedSkillNames"
      :owned-skills="ownedSkills"
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


    <!-- Changelog Dialog -->
    <ChangelogDialog v-model="changelogDialogVisible" />

    <AuthDialog v-model="authDialogVisible" @sign-in="onSignIn" />

    <CreateProposalDialog
      v-model="createProposalDialogVisible"
      :is-logged-in="isLoggedIn"
      :submitting="proposalSubmitting"
      @submit="onSubmitProposal"
    />

    <ImportProposalDialog
      v-model="importProposalDialogVisible"
      :loading-mine="loadingMyProposals"
      :loading-public="loadingPublicProposals"
      :my-proposals="myProposals"
      :public-proposals="publicProposals"
      :lineups="lineups"
      :current-team-index="currentTeamIndex"
      :max-teams="MAX_TEAMS_PER_GROUP"
      @tab-change="onImportProposalTabChange"
      @import="onImportProposal"
    />
  </el-container>

  <SkillDragPreview :skill="draggingSkill" :pos="dragPos" />
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import ChangelogDialog from '../components/dialogs/ChangelogDialog.vue'
import ResetDialog from '../components/dialogs/ResetDialog.vue'
import AuthDialog from '../components/dialogs/AuthDialog.vue'
import SkillSelectDialog from '../components/dialogs/SkillSelectDialog.vue'
import ShareDialog from '../components/dialogs/ShareDialog.vue'
import CreateProposalDialog from '../components/dialogs/CreateProposalDialog.vue'
import ImportProposalDialog, { type ImportTarget } from '../components/dialogs/ImportProposalDialog.vue'
import SkillDragPreview from '../components/lineup-builder/SkillDragPreview.vue'
import MobileTeamDrawer from '../components/lineup-builder/MobileTeamDrawer.vue'
import MobileSlotDetailDrawer from '../components/lineup-builder/MobileSlotDetailDrawer.vue'
import InventoryEditor from '../components/lineup-builder/InventoryEditor.vue'
import LineupWorkspace, { type Role } from '../components/lineup-builder/LineupWorkspace.vue'
import type { ResetTarget } from '../components/dialogs/ResetDialog.vue'
import type { ShareScope, ShareEventPayload } from '../components/dialogs/ShareDialog.vue'
import TeamListPanel from '../components/lineup-builder/TeamListPanel.vue'
import GachaSpectatorView from '../components/GachaSpectatorView.vue'

import { useData, Hero, Skill } from '../composables/useData'

import { ShareableData, ShareableLineup, ShareableBingxue } from '../constants/gameData'
import { useLineups, makeTeam, type RoleData, type BingxueActive, type Lineup } from '../composables/useLineups'
import { useGroups, MAX_TEAMS_PER_GROUP } from '../composables/useGroups'
import { useInventory } from '../composables/useInventory'
import {
  createShare, loadShare, isShareEnabled, type ShareKind,
} from '../lib/share'
import { handleAuthCallback, type OAuthProvider } from '../lib/auth'
import type { SpectatorBlob } from '../lib/gachaLog'
import { useAuth } from '../composables/useAuth'
import { useActiveProfile } from '../composables/useActiveProfile'
import { useDialogs } from '../composables/useDialogs'
import { useProposals } from '../composables/useProposals'
import type { Proposal, ImportConflictResolution } from '../types/group'
import { useChangelog } from '../composables/useChangelog'
import { useProfiles } from '../composables/useProfiles'
import { consumeInitialHash } from '../lib/initial-hash'

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
  ensureTeamCount,
  emptyRole: makeEmptyRole,
} = useLineups()

const { currentGroup, replaceGroups } = useGroups()

const {
  myProposals,
  publicProposals,
  loadingMine: loadingMyProposals,
  loadingPublic: loadingPublicProposals,
  refreshMine: refreshMyProposals,
  refreshPublic: refreshPublicProposals,
  createFromLineup: createProposalFromLineup,
} = useProposals()

const {
  ownedHeroes,
  ownedSkills,
  showOwnedOnly,
  isEditingInventory,
  tempOwnedHeroes,
  tempOwnedSkills,
  clearInventory,
} = useInventory()

const dialogs = useDialogs()
const { hasUnseen: hasUnseenChangelog, changelogDialogVisible } = useChangelog()

const skillSelectDialogVisible = dialogs.useDialog('skill-select')
const resetDialogVisible = dialogs.useDialog('reset')
const shareDialogVisible = dialogs.useDialog('share')
const authDialogVisible = dialogs.useDialog('auth')
const mobileDetailVisible = dialogs.useDialog('mobile-slot-detail')
const mobileSidebarVisible = dialogs.useDialog('mobile-team-drawer')
const createProposalDialogVisible = dialogs.useDialog('create-proposal')
const importProposalDialogVisible = dialogs.useDialog('import-proposal')

const activeTab = ref<'heroes' | 'skills'>('heroes')

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
    ElMessage.success('已交換槽位')
  }
}

const handleHeroDrop = (targetRole: Role) => {
  if (dragSourceRole.value && dragSourceRole.value !== targetRole) {
    swapRoles(dragSourceRole.value, targetRole)
    ElMessage.success('已交換槽位')
  }
  dragSourceRole.value = null
}

const openHeroSelect = (role: Role) => {
  if (swapModeRole.value !== null) {
    handleSwapAction(role)
    return
  }
  currentSelectingHeroRole.value = role
  activeTab.value = 'heroes'
}

const openMobileDetail = (role: Role) => {
  currentDetailRole.value = role
  mobileDetailVisible.value = true
}

const handleSkillSlotClick = (role: Role, slotIdx: number) => {
  currentSelectingSkillRole.value = role
  currentSelectingSkillSlot.value = slotIdx
  activeTab.value = 'skills'
}

const handleSkillDrop = (role: Role, slotIdx: number, skill: Skill) => {
  const targetRole = currentLineup.value[role]
  if (slotIdx === 1) targetRole.skill1 = skill
  if (slotIdx === 2) targetRole.skill2 = skill
  ElMessage.success(`已習得 ${skill.name}`)
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

const selectHeroFromLibrary = (hero: Hero) => {
  if (currentSelectingHeroRole.value) {
    currentLineup.value[currentSelectingHeroRole.value].hero = hero
    ElMessage.success(`已選擇 ${hero.name}`)
  } else {
    if (!currentLineup.value.main.hero) currentLineup.value.main.hero = hero
    else if (!currentLineup.value.vice1.hero) currentLineup.value.vice1.hero = hero
    else if (!currentLineup.value.vice2.hero) currentLineup.value.vice2.hero = hero
    else currentLineup.value.main.hero = hero 
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
  const hadFocus = !!currentSelectingSkillRole.value && currentSelectingSkillSlot.value !== null
  let targetRole = currentSelectingSkillRole.value
  let targetSlot = currentSelectingSkillSlot.value as 1 | 2 | null

  if (!hadFocus) {
    const empty = findFirstEmptySkillSlot()
    if (!empty) {
      triggerLineupShake()
      ElMessage.warning('所有戰法欄位都已滿，請先點擊欲覆寫的欄位')
      return
    }
    targetRole = empty.r
    targetSlot = empty.s
  }

  const role = currentLineup.value[targetRole!]
  if (targetSlot === 1) role.skill1 = skill
  if (targetSlot === 2) role.skill2 = skill
  ElMessage.success(`已習得 ${skill.name}`)

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
  if (type === 'current') {
    clearLineupData('current')
    ElMessage.info('當前隊伍已重置')
  }
  if (type === 'all') {
    clearLineupData('all')
    clearInventory()
    ElMessage.info('所有資料已重置')
  }
  if (type === 'inventory') {
    clearInventory()
    ElMessage.info('庫存已清空')
  }
  resetDialogVisible.value = false
}

const serializeBx = (bx?: BingxueActive): ShareableBingxue | undefined =>
  bx?.direction
    ? { d: bx.direction, m: bx.major, n: bx.minors.map(mi => ({ n: mi.name, l: mi.level })) }
    : undefined

// CHT → JP name mapping happens only at share/restore boundary.
// Internal state stays CHT (rest of app filters by CHT name).
// Maps are built once per data load and reused across every share serialization
// (each call would otherwise scan the whole heroes/skills array per lookup).
const heroChtToJp = computed(() =>
  new Map(heroes.value.map(h => [h.name, h.name_jp])))
const skillChtToJp = computed(() =>
  new Map(skills.value.map(s => [s.name, s.name_jp])))
const heroToJp = (cht: string | undefined): string | undefined =>
  cht ? (heroChtToJp.value.get(cht) ?? cht) : undefined
const skillToJp = (cht: string | undefined): string | undefined =>
  cht ? (skillChtToJp.value.get(cht) ?? cht) : undefined

// Computed keys widen to `string` in TS, so the explicit Partial cast is the
// honest contract — the runtime field names (`m_s1`, `v1_s1`, etc.) match
// ShareableLineup by convention. Typos in the template literals would silently
// produce ignored fields; the cast at least keeps callers honest about shape.
const serializeRole = (role: RoleData, prefix: 'm' | 'v1' | 'v2'): Partial<ShareableLineup> => ({
  [prefix]: heroToJp(role.hero?.name),
  [`${prefix}_s1`]: skillToJp(role.skill1?.name),
  [`${prefix}_s2`]: skillToJp(role.skill2?.name),
  [`${prefix}_st`]: role.stats,
  [`${prefix}_bt`]: role.breakthrough,
  [`${prefix}_bx`]: serializeBx(role.bingxue),
}) as Partial<ShareableLineup>

const serializeLineup = (l: typeof lineups[number]): ShareableLineup => ({
  name: l.name,
  ...serializeRole(l.main, 'm'),
  ...serializeRole(l.vice1, 'v1'),
  ...serializeRole(l.vice2, 'v2'),
})

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
    ElMessage.success('分享連結已複製到剪貼簿！')
    shareDialogVisible.value = false
    shareNameInput.value = ''
  }).catch(() => {
    ElMessage.error('複製失敗，請手動複製網址')
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
        description: '',
        isPublic: true,
        authorName: displayName.value || null,
      })
      ElMessage.success('已同時加入公開「精選隊伍」庫')
    } catch (e) {
      ElMessage.error(`公開精選隊伍發佈失敗：${(e as Error).message}`)
    }
  }
}

const { heroes, skills } = useData()

// Restore in-memory state from a ShareableData blob (used by share links AND
// by sign-in recovery). Lookups try JP first (v2), CHT second (v1 / legacy).
const restoreFromBlob = (data: ShareableData) => {
  const findHeroByKey = (key: string) =>
    heroes.value.find(h => h.name_jp === key || h.name === key || h.aliases?.includes(key))
  const findSkillByKey = (key: string) =>
    skills.value.find(s => s.name_jp === key || s.name === key || s.aliases?.includes(key))
  // Drop empty strings — legacy Supabase rows from before the pipeline
  // emitted `name_jp = null` for override-added skills may contain `""` keys
  // that find nothing and would otherwise survive via the `?? k` fallback.
  const toCht = <T extends { name: string }>(arr: string[], finder: (k: string) => T | undefined): string[] =>
    arr.map(k => finder(k)?.name ?? k).filter(Boolean)

  if (data.inventory) ownedHeroes.value = toCht(data.inventory, findHeroByKey)
  if (data.inv_h) ownedHeroes.value = toCht(data.inv_h, findHeroByKey)
  if (data.inv_s) ownedSkills.value = toCht(data.inv_s, findSkillByKey)

  if ((data.inv_h && data.inv_h.length > 0) || (data.inv_s && data.inv_s.length > 0) || (data.inventory && data.inventory.length > 0)) {
    showOwnedOnly.value = true
  }

  // Per-role hydrate — used by both v2 (in-place mutate active group's teams)
  // and v3 (build fresh teams to push through replaceGroups).
  const restoreRole = (prefix: string, role: RoleData, l: ShareableLineup) => {
    const safeL = l as any
    const hName = safeL[prefix]
    if (hName) role.hero = findHeroByKey(hName) || null
    const s1Name = safeL[prefix + '_s1']
    if (s1Name) role.skill1 = findSkillByKey(s1Name) || null
    const s2Name = safeL[prefix + '_s2']
    if (s2Name) role.skill2 = findSkillByKey(s2Name) || null
    if (safeL[prefix + '_st']) role.stats = safeL[prefix + '_st']
    const bt = safeL[prefix + '_bt']
    if (typeof bt === 'number') role.breakthrough = Math.max(0, Math.min(5, bt))
    const bx = safeL[prefix + '_bx']
    if (bx && bx.d) {
      role.bingxue = {
        direction: bx.d,
        major: bx.m ?? null,
        minors: Array.isArray(bx.n) ? bx.n.map((mi: any) => ({ name: mi.n, level: mi.l })) : [],
      }
    }
  }

  const hydrateTeam = (target: Lineup, l: ShareableLineup) => {
    if (l.name) target.name = l.name
    restoreRole('m', target.main, l)
    restoreRole('v1', target.vice1, l)
    restoreRole('v2', target.vice2, l)
  }

  // v3 — wipe-and-replace via the groups envelope. Used by share-all links
  // and by post-OAuth recovery snapshots.
  if (data.groups && Array.isArray(data.groups) && data.groups.length > 0) {
    const incoming = data.groups.map((g) => {
      const teams = (g.teams || []).slice(0, MAX_TEAMS_PER_GROUP).map((l, i) => {
        const team = makeTeam(i)
        hydrateTeam(team, l)
        return team
      })
      // Guarantee at least one team per group so the UI never renders an
      // empty lineups array.
      if (teams.length === 0) teams.push(makeTeam(0))
      return { name: g.name || '預設', teams }
    })
    replaceGroups(incoming)
  } else if (data.lineups && Array.isArray(data.lineups)) {
    // v2 legacy — populate the active group's teams in place.
    ensureTeamCount(data.lineups.length)
    data.lineups.forEach((l, i) => {
      if (i >= lineups.length) return
      hydrateTeam(lineups[i], l)
    })
  }
}

// Snapshot current state under a recovery key before OAuth full-page redirect,
// so handleAuthCallback's success path can restore the lineup the user was
// building. 5-minute TTL so a stale snapshot from days ago doesn't surprise.
const RECOVERY_KEY = 'nobunaga.auth.recovery'
const RECOVERY_TTL_MS = 5 * 60 * 1000

const snapshotForRecovery = () => {
  const blob: ShareableData = { v: 3 }
  blob.groups = [{
    name: currentGroup.value.name,
    teams: lineups.map(serializeLineup),
  }]
  blob.inv_h = ownedHeroes.value.map(n => heroToJp(n) ?? n)
  blob.inv_s = ownedSkills.value.map(n => skillToJp(n) ?? n)
  localStorage.setItem(RECOVERY_KEY, JSON.stringify({ blob, ts: Date.now() }))
}

const consumeRecovery = (): boolean => {
  const raw = localStorage.getItem(RECOVERY_KEY)
  if (!raw) return false
  localStorage.removeItem(RECOVERY_KEY)
  try {
    const { blob, ts } = JSON.parse(raw) as { blob: ShareableData; ts: number }
    if (Date.now() - ts > RECOVERY_TTL_MS) return false
    restoreFromBlob(blob)
    return true
  } catch {
    return false
  }
}

// --- Auth ---
const {
  isLoggedIn, displayName, needsDisplayName,
  signIn, refreshFromStorage,
  sessionExpiredCount,
} = useAuth()

const onSignIn = (provider: OAuthProvider) => {
  authDialogVisible.value = false
  snapshotForRecovery()
  signIn(provider)  // full-page redirect — nothing after this runs
}

// TeamListPanel actions
const onAddTeam = () => {
  if (!addTeam()) ElMessage.info(`當前隊組已滿（${MAX_TEAMS_PER_GROUP} 隊）`)
}

const proposalSubmitting = ref(false)

const onSaveAsProposal = () => {
  // createProposal RLS gates on auth — short-circuit to the auth dialog so
  // anon users see the reason instead of a generic 401.
  if (!isLoggedIn.value) {
    ElMessage.info('請先登入才能儲存精選隊伍')
    authDialogVisible.value = true
    return
  }
  createProposalDialogVisible.value = true
}

const onSubmitProposal = async (payload: { name: string; description: string; isPublic: boolean }) => {
  proposalSubmitting.value = true
  try {
    await createProposalFromLineup(currentLineup.value, {
      name: payload.name,
      description: payload.description,
      isPublic: payload.isPublic,
      authorName: displayName.value || null,
    })
    createProposalDialogVisible.value = false
    ElMessage.success('精選隊伍已儲存')
  } catch (e) {
    ElMessage.error(`建立失敗：${(e as Error).message}`)
  } finally {
    proposalSubmitting.value = false
  }
}

const onAddToGroup = () => {
  // Group-full is no longer a hard block — overwrite-current-team is always
  // available as an alternative target. The dialog renders its radio
  // accordingly.
  importProposalDialogVisible.value = true
  refreshMyProposals()
}

const onImportProposalTabChange = (tab: 'mine' | 'public') => {
  if (tab === 'public' && publicProposals.value.length === 0) {
    refreshPublicProposals()
  }
}

const onImportProposal = (payload: {
  proposal: Proposal
  resolution: ImportConflictResolution
  target: ImportTarget
}) => {
  const { proposal, resolution, target } = payload

  // Deep-clone so the proposal's frozen team blob never aliases into our
  // reactive state — subsequent mutations would otherwise leak back to the
  // proposal object cached in useProposals.myProposals / publicProposals.
  const team: Lineup = JSON.parse(JSON.stringify(proposal.team))

  // Collision pool: hero AND skill names already in OTHER teams. When
  // overwriting the current team, skip it (it's about to be replaced).
  const heroPool = new Set<string>()
  const skillPool = new Set<string>()
  lineups.forEach((l, i) => {
    if (target === 'overwrite' && i === currentTeamIndex.value) return
    for (const role of ['main', 'vice1', 'vice2'] as const) {
      const r = l[role]
      if (r.hero) heroPool.add(r.hero.name)
      if (r.skill1) skillPool.add(r.skill1.name)
      if (r.skill2) skillPool.add(r.skill2.name)
    }
  })

  if (resolution === 'leave-empty') {
    // Drop the colliding piece (hero whole role; skill just that slot) so
    // the imported team lands without stomping originals. Hero clear
    // implicitly drops the role's skills too — skill checks below are then
    // skipped via `continue` against the now-stale local `r`.
    for (const role of ['main', 'vice1', 'vice2'] as const) {
      const r = team[role]
      if (r?.hero && heroPool.has(r.hero.name)) {
        team[role] = makeEmptyRole()
        continue  // load-bearing: r is stale after the assignment above
      }
      if (r?.skill1 && skillPool.has(r.skill1.name)) r.skill1 = null
      if (r?.skill2 && skillPool.has(r.skill2.name)) r.skill2 = null
    }
  } else if (resolution === 'overwrite') {
    // Mirror image: clear the same piece on the originating team(s) so the
    // imported team lands intact.
    const incomingHeroes = new Set<string>()
    const incomingSkills = new Set<string>()
    for (const role of ['main', 'vice1', 'vice2'] as const) {
      const r = team[role]
      if (r?.hero) incomingHeroes.add(r.hero.name)
      if (r?.skill1) incomingSkills.add(r.skill1.name)
      if (r?.skill2) incomingSkills.add(r.skill2.name)
    }
    lineups.forEach((l, i) => {
      if (target === 'overwrite' && i === currentTeamIndex.value) return
      for (const role of ['main', 'vice1', 'vice2'] as const) {
        const r = l[role]
        if (r.hero && incomingHeroes.has(r.hero.name)) {
          l[role] = makeEmptyRole()
          continue  // see leave-empty branch — r is stale after this
        }
        if (r.skill1 && incomingSkills.has(r.skill1.name)) r.skill1 = null
        if (r.skill2 && incomingSkills.has(r.skill2.name)) r.skill2 = null
      }
    })
  }

  if (target === 'append') {
    if (!addTeamFromSnapshot(team)) {
      ElMessage.error('當前隊組已滿，無法加入')
      return
    }
  } else {
    // Overwrite in place — preserve the existing team's name (the user's
    // mental label) and replace the three role payloads. Mutating fields
    // individually keeps the same proxy identity that LineupSlot is bound to.
    const dest = currentLineup.value
    dest.main = team.main
    dest.vice1 = team.vice1
    dest.vice2 = team.vice2
  }

  importProposalDialogVisible.value = false
  ElMessage.success(
    `已將「${proposal.name}」${target === 'overwrite' ? '覆寫至' : '加入'}當前隊組`,
  )
}

// Set by initFromHash when an incoming share is a v3 gacha-log snapshot.
// Non-null switches the whole UI to spectator mode (no edit affordances).
const gachaSpectatorBlob = ref<SpectatorBlob | null>(null)
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
  ElMessage.warning('登入已過期，請重新登入以同步雲端資料')
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
      ElMessage.success(recovered ? '登入成功，已還原配置' : '登入成功')
      // First-time prompt: ask new users to pick a display name. AppLayout
      // owns the rename dialog and prefills the input when it opens.
      if (needsDisplayName.value) dialogs.open('rename')
      router.replace('/')
      return true
    }
  } catch (e) {
    ElMessage.error(`登入失敗：${(e as Error).message}`)
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
      // v3 = gacha-log snapshot — render spectator UI instead of restoring
      // into the lineup builder. Anything that v3 doesn't carry (lineups,
      // inventory) stays untouched, so the URL is purely a viewer experience.
      const maybeBlob = data as Partial<SpectatorBlob>
      if (maybeBlob?.v === 3 && maybeBlob?.kind === 'gacha_log') {
        gachaSpectatorBlob.value = maybeBlob as SpectatorBlob
        return true
      }
      restoreFromBlob(data)
      ElMessage.success('已載入分享的配置')
      router.replace('/')
    } catch (e) {
      ElMessage.error('無效的分享連結')
      router.replace('/')
    }
    return true
  }
  return false
}

onMounted(async () => {
  const consumedHash = await initFromHash()
  // Fire-and-forget: the auto-load sequencing only depends on initFromHash
  // (share/recovery should win if present). No reason to block the changelog
  // open on a Supabase round-trip — they don't conflict, and `consumedHash`
  // already gates the changelog independently.
  void tryAutoApplyDefault()
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
/* Tighten the gap between the 武將庫/戰法庫 tab header and its panel content.
   Element Plus default is margin: 0 0 15px; which leaves too much dead space. */
.el-tabs--top > .el-tabs__header.is-top {
  margin-bottom: 6px;
}
@media (max-width: 767px) {
  .el-tabs--top > .el-tabs__header.is-top {
    margin-bottom: 2px;
  }
}
/* Library tabs (武將庫/戰法庫): shorter header row (80% of EP default 40px). */
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