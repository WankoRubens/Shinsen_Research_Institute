<template>
  <GachaSpectatorView v-if="gachaSpectatorBlob" :blob="gachaSpectatorBlob" />
  <el-container v-else direction="vertical" class="w-full bg-slate-50" style="height: 100dvh">
    <LineupHeader
      v-model:team-name="currentTeamName"
      :total-cost="totalCost"
      :troop-levels="troopLevels"
      :is-editing-inventory="isEditingInventory"
      :is-logged-in="isLoggedIn"
      :has-unseen-changelog="hasUnseenChangelog"
      :display-name="displayName"
      :active-profile-name="activeProfileName"
      @open-mobile-sidebar="mobileSidebarVisible = true"
      @start-editing-inventory="startEditingInventory"
      @cancel-editing-inventory="cancelEditingInventory"
      @save-inventory="saveInventory"
      @open-share="openShareDialog"
      @open-reset="openResetDialog"
      @open-changelog="openChangelogDialog"
      @open-auth="authDialogVisible = true"
      @user-menu="onUserMenu"
    />

    <el-main class="app-main p-0 overflow-hidden">
      
      <!-- View 1: Lineup Builder (Default) -->
      <div v-if="!isEditingInventory" class="flex flex-col md:flex-row h-full">
        <TeamSidebarStrip
          :lineups="lineups"
          :current-team-index="currentTeamIndex"
          @select="(idx: number) => currentTeamIndex = idx"
        />

        <MobileTeamDrawer
          v-model="mobileSidebarVisible"
          :lineups="lineups"
          :current-team-index="currentTeamIndex"
          @select="(idx: number) => { currentTeamIndex = idx; mobileSidebarVisible = false }"
        />

                <!-- Center: Lineup Builder Area -->
                <div class="flex-1 flex flex-col md:flex-row h-full overflow-hidden">
                  <div
                    class="flex-none md:flex-1 overflow-y-auto p-0.5 md:p-6 bg-slate-50"
                    @click.self="clearSkillFocus"
                  >
                     <!-- Mobile: Compact Grid | Desktop: Grid -->
                     <div
                       class="grid grid-cols-3 md:grid-cols-3 lg:grid-cols-3 gap-0.5 md:gap-4 pb-0 md:pb-0 h-auto"
                       :class="{ 'lineup-shake': lineupShakeActive }"
                       @click.self="clearSkillFocus"
                       @animationend="lineupShakeActive = false"
                     >
                        <div class="w-full md:min-w-0 md:h-full">
                          <LineupSlot
                            title="大將"
                            role="main"
                            v-model:hero="currentLineup.main.hero"
                            v-model:skill1="currentLineup.main.skill1"
                            v-model:skill2="currentLineup.main.skill2"
                            v-model:stats="currentLineup.main.stats"
                            v-model:equipTraits="currentLineup.main.equipTraits"
                            v-model:breakthrough="currentLineup.main.breakthrough"
                            v-model:bingxue="currentLineup.main.bingxue"
                            :focused-skill-slot="currentSelectingSkillRole === 'main' ? currentSelectingSkillSlot : null"
                            :is-swap-source="swapModeRole === 'main'"
                            :swap-mode-active="swapModeRole !== null"
                            :is-drag-target="dragSourceRole !== null && dragSourceRole !== 'main'"
                            :skill-dragging="isSkillDragging"
                            :conflicting-skill-names="conflictingSkillNames"
                            @open-hero-select="openHeroSelect('main')"
                            @open-skill-select="(slotIdx) => handleSkillSlotClick('main', slotIdx)"
                            @skill-drop="(slotIdx, skill) => handleSkillDrop('main', slotIdx, skill)"
                            @skill-drag-start="handleSkillDragStarted"
                            @skill-drag-end="handleSkillDragEnded"
                            @skill-slot-drop="(srcRole, srcSlot, tgtSlot) => handleSkillSlotDrop('main', srcRole, srcSlot, tgtSlot)"
                            @open-detail="openMobileDetail('main')"
                            @swap-click="handleSwapAction('main')"
                            @hero-drag-start="() => dragSourceRole = 'main'"
                            @hero-drag-end="() => dragSourceRole = null"
                            @hero-drop="() => handleHeroDrop('main')"
                          />
                        </div>
                        <div class="w-full md:min-w-0 md:h-full">
                          <LineupSlot
                            title="副將"
                            role="vice1"
                            v-model:hero="currentLineup.vice1.hero"
                            v-model:skill1="currentLineup.vice1.skill1"
                            v-model:skill2="currentLineup.vice1.skill2"
                            v-model:stats="currentLineup.vice1.stats"
                            v-model:equipTraits="currentLineup.vice1.equipTraits"
                            v-model:breakthrough="currentLineup.vice1.breakthrough"
                            v-model:bingxue="currentLineup.vice1.bingxue"
                            :focused-skill-slot="currentSelectingSkillRole === 'vice1' ? currentSelectingSkillSlot : null"
                            :is-swap-source="swapModeRole === 'vice1'"
                            :swap-mode-active="swapModeRole !== null"
                            :is-drag-target="dragSourceRole !== null && dragSourceRole !== 'vice1'"
                            :skill-dragging="isSkillDragging"
                            :conflicting-skill-names="conflictingSkillNames"
                            @open-hero-select="openHeroSelect('vice1')"
                            @open-skill-select="(slotIdx) => handleSkillSlotClick('vice1', slotIdx)"
                            @skill-drop="(slotIdx, skill) => handleSkillDrop('vice1', slotIdx, skill)"
                            @skill-drag-start="handleSkillDragStarted"
                            @skill-drag-end="handleSkillDragEnded"
                            @skill-slot-drop="(srcRole, srcSlot, tgtSlot) => handleSkillSlotDrop('vice1', srcRole, srcSlot, tgtSlot)"
                            @open-detail="openMobileDetail('vice1')"
                            @swap-click="handleSwapAction('vice1')"
                            @hero-drag-start="() => dragSourceRole = 'vice1'"
                            @hero-drag-end="() => dragSourceRole = null"
                            @hero-drop="() => handleHeroDrop('vice1')"
                          />
                        </div>
                        <div class="w-full md:min-w-0 md:h-full">
                          <LineupSlot
                            title="副將"
                            role="vice2"
                            v-model:hero="currentLineup.vice2.hero"
                            v-model:skill1="currentLineup.vice2.skill1"
                            v-model:skill2="currentLineup.vice2.skill2"
                            v-model:stats="currentLineup.vice2.stats"
                            v-model:equipTraits="currentLineup.vice2.equipTraits"
                            v-model:breakthrough="currentLineup.vice2.breakthrough"
                            v-model:bingxue="currentLineup.vice2.bingxue"
                            :focused-skill-slot="currentSelectingSkillRole === 'vice2' ? currentSelectingSkillSlot : null"
                            :is-swap-source="swapModeRole === 'vice2'"
                            :swap-mode-active="swapModeRole !== null"
                            :is-drag-target="dragSourceRole !== null && dragSourceRole !== 'vice2'"
                            :skill-dragging="isSkillDragging"
                            :conflicting-skill-names="conflictingSkillNames"
                            @open-hero-select="openHeroSelect('vice2')"
                            @open-skill-select="(slotIdx) => handleSkillSlotClick('vice2', slotIdx)"
                            @skill-drop="(slotIdx, skill) => handleSkillDrop('vice2', slotIdx, skill)"
                            @skill-drag-start="handleSkillDragStarted"
                            @skill-drag-end="handleSkillDragEnded"
                            @skill-slot-drop="(srcRole, srcSlot, tgtSlot) => handleSkillSlotDrop('vice2', srcRole, srcSlot, tgtSlot)"
                            @open-detail="openMobileDetail('vice2')"
                            @swap-click="handleSwapAction('vice2')"
                            @hero-drag-start="() => dragSourceRole = 'vice2'"
                            @hero-drag-end="() => dragSourceRole = null"
                            @hero-drop="() => handleHeroDrop('vice2')"
                          />
                        </div>
                     </div>
                  </div>
        
                                      <!-- Right: Library (Select Mode) - On mobile this is below the lineups -->
        
                                      <div class="flex-1 md:flex-none md:h-full w-full md:w-[45%] bg-white border-t md:border-t-0 md:border-l border-gray-200 flex flex-col shadow-xl z-40 min-h-0">
        
                                        <el-tabs v-model="activeTab" class="library-tabs flex-1 flex flex-col px-0 pt-0 md:px-4 md:pt-2" stretch>                                <el-tab-pane label="武將庫" name="heroes" class="h-full flex flex-col overflow-hidden">
                                   <HeroLibrary 
                                     mode="select" 
                                     :used-heroes="allUsedHeroNames" 
                                     :owned-heroes="ownedHeroes"
                                     :filter-owned="showOwnedOnly"
                                     @update:filterOwned="val => showOwnedOnly = val"
                                     @select="selectHeroFromLibrary" 
                                   />
                                </el-tab-pane>
                                <el-tab-pane label="戰法庫" name="skills" class="h-full flex flex-col overflow-hidden">
                                   <SkillLibrary
                                     mode="select"
                                     :used-skills="allUsedSkillNames"
                                     :owned-skills="ownedSkills"
                                     :filter-owned="showOwnedOnly"
                                     @update:filterOwned="val => showOwnedOnly = val"
                                     @select="selectSkillFromDialog"
                                     @skill-drag-start="handleSkillDragStarted"
                                     @skill-drag-end="handleSkillDragEnded"
                                   /> 
                                </el-tab-pane>          
                     </el-tabs>
                  </div>
                </div>
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
                  @open-equip="(idx) => { if (currentDetailRole) openEquipDialog(currentDetailRole, idx) }"
                />
        
            
        
    <EquipTraitDialog
      v-model="equipDialogVisible"
      :options="MOCK_EQUIP_TRAITS"
      @select="handleEquipSelect"
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
      @share="shareLineup"
    />

    <ResetDialog v-model="resetDialogVisible" @confirm="clearLineup" />

    <MySharesDialog
      v-model="mySharesDialogVisible"
      :loading="mySharesLoading"
      :shares="myShares"
      :editing-slug="editingSlug"
      v-model:editing-draft="editingDraft"
      @toggle-pin="togglePinShare"
      @start-edit="startEditShareName"
      @save-name="saveShareName"
      @cancel-edit="cancelEditShareName"
      @copy-url="copyShareUrl"
      @remove="removeMyShare"
    />

    <RenameDialog
      v-model="renameDialogVisible"
      v-model:name="renameInput"
      :saving="renameSaving"
      @submit="submitRename"
    />

    <!-- Changelog Dialog -->
    <ChangelogDialog v-model="changelogDialogVisible" />

    <!-- My Profiles Dialog -->
    <MyProfilesDialog v-model="myProfilesDialogVisible" />

    <!-- Gacha Log Dialog -->
    <GachaLogDialog v-model="gachaLogDialogVisible" />

    <AuthDialog v-model="authDialogVisible" @sign-in="onSignIn" />

    <AppFooter />

  </el-container>

  <SkillDragPreview :skill="draggingSkill" :pos="dragPos" />
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import LineupSlot from '../components/LineupSlot.vue'
import HeroLibrary from '../components/HeroLibrary.vue'
import SkillLibrary from '../components/SkillLibrary.vue'
import ChangelogDialog from '../components/dialogs/ChangelogDialog.vue'
import MyProfilesDialog from '../components/dialogs/MyProfilesDialog.vue'
import GachaLogDialog from '../components/dialogs/GachaLogDialog.vue'
import EquipTraitDialog from '../components/dialogs/EquipTraitDialog.vue'
import ResetDialog from '../components/dialogs/ResetDialog.vue'
import AuthDialog from '../components/dialogs/AuthDialog.vue'
import SkillSelectDialog from '../components/dialogs/SkillSelectDialog.vue'
import RenameDialog from '../components/dialogs/RenameDialog.vue'
import ShareDialog from '../components/dialogs/ShareDialog.vue'
import MySharesDialog from '../components/dialogs/MySharesDialog.vue'
import AppFooter from '../components/lineup-builder/AppFooter.vue'
import SkillDragPreview from '../components/lineup-builder/SkillDragPreview.vue'
import MobileTeamDrawer from '../components/lineup-builder/MobileTeamDrawer.vue'
import MobileSlotDetailDrawer from '../components/lineup-builder/MobileSlotDetailDrawer.vue'
import InventoryEditor from '../components/lineup-builder/InventoryEditor.vue'
import LineupHeader, { type UserMenuCmd } from '../components/lineup-builder/LineupHeader.vue'
import type { ResetTarget } from '../components/dialogs/ResetDialog.vue'
import type { ShareScope } from '../components/dialogs/ShareDialog.vue'
import TeamSidebarStrip from '../components/lineup-builder/TeamSidebarStrip.vue'
import GachaSpectatorView from '../components/GachaSpectatorView.vue'
import { LATEST_VERSION } from '../constants/changelog'

import { useData, Hero, Skill, Trait } from '../composables/useData'
import { MOCK_EQUIP_TRAITS, ShareableData, ShareableLineup, ShareableBingxue } from '../constants/gameData'
import { useLineups, type RoleData, type BingxueActive } from '../composables/useLineups'
import { useTroopLevels } from '../composables/useTroopLevels'
import { useInventory } from '../composables/useInventory'
import {
  createShare, loadShare, isShareEnabled,
  listMyShares, renameMyShare, pinMyShare, deleteMyShare, type MyShare,
} from '../lib/share'
import { handleAuthCallback, type OAuthProvider } from '../lib/auth'
import type { SpectatorBlob } from '../lib/gachaLog'
import { useAuth } from '../composables/useAuth'
import { useActiveProfile } from '../composables/useActiveProfile'
import { listMyProfiles } from '../lib/profiles'
import { consumeInitialHash } from '../lib/initial-hash'

const router = useRouter()

const { 
  lineups, 
  currentTeamIndex, 
  currentLineup, 
  currentTeamName, 
  allUsedHeroNames, 
  allUsedSkillNames, 
  totalCost,
  clearLineup: clearLineupData,
  swapRoles
} = useLineups()

const troopLevels = useTroopLevels(currentLineup)

const {
  ownedHeroes,
  ownedSkills,
  showOwnedOnly,
  isEditingInventory,
  tempOwnedHeroes,
  tempOwnedSkills,
  startEditingInventory,
  saveInventory,
  cancelEditingInventory,
  clearInventory
} = useInventory()

// Equip Traits Logic (Shared / Mobile)
const equipDialogVisible = ref(false)
const currentEquipRole = ref<Role | null>(null)
const currentEquipSlotIdx = ref<number | null>(null)

const openEquipDialog = (role: Role, idx: number) => {
  currentEquipRole.value = role
  currentEquipSlotIdx.value = idx
  equipDialogVisible.value = true
}

const handleEquipSelect = (trait: Trait | null) => {
  if (currentEquipRole.value && currentEquipSlotIdx.value !== null) {
    const role = currentLineup.value[currentEquipRole.value]
    // Ensure array exists
    if (!role.equipTraits) role.equipTraits = [null, null, null, null]
    
    // Create new array to trigger reactivity
    const newTraits = [...role.equipTraits]
    newTraits[currentEquipSlotIdx.value] = trait ? { ...trait } : null // clone to avoid reference issues
    role.equipTraits = newTraits
    
    equipDialogVisible.value = false
  }
}

const activeTab = ref('heroes')
const skillSelectDialogVisible = ref(false)

const inventoryActiveTab = ref('heroes')

// Interaction State
type Role = 'main' | 'vice1' | 'vice2'
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
const mobileDetailVisible = ref(false)
const currentDetailRole = ref<Role | null>(null)

// UI State
const mobileSidebarVisible = ref(false)

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

const resetDialogVisible = ref(false)
const openResetDialog = () => {
  resetDialogVisible.value = true
}

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

const shareDialogVisible = ref(false)
const openShareDialog = () => {
  shareNameInput.value = ''
  shareDialogVisible.value = true
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
  [`${prefix}_eq`]: role.equipTraits?.map(t => t ? {n: t.name, r: t.rank, d: t.description} : null),
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
// in. Reset on every dialog open so it doesn't carry over between actions.
const shareNameInput = ref('')

const shareLineup = async (type: ShareScope) => {
  const data: ShareableData = { v: 2 }
  if (type === 'inventory' || type === 'all') {
    data.inv_h = ownedHeroes.value.map(n => heroToJp(n) ?? n)
    data.inv_s = ownedSkills.value.map(n => skillToJp(n) ?? n)
  }
  if (type === 'current') {
    data.lineups = [serializeLineup(currentLineup.value)]
  }
  if (type === 'all') {
    data.lineups = lineups.map(serializeLineup)
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

  let url: string
  if (isShareEnabled()) {
    try {
      const slug = await createShare(data, shareName ? { displayName: shareName } : undefined)
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

  if (data.lineups && Array.isArray(data.lineups)) {
    data.lineups.forEach((l, i) => {
      if (i >= lineups.length) return
      const target = lineups[i]
      if (l.name) target.name = l.name
      const restore = (prefix: string, role: RoleData) => {
        const safeL = l as any
        const hName = safeL[prefix]
        if (hName) role.hero = findHeroByKey(hName) || null
        const s1Name = safeL[prefix + '_s1']
        if (s1Name) role.skill1 = findSkillByKey(s1Name) || null
        const s2Name = safeL[prefix + '_s2']
        if (s2Name) role.skill2 = findSkillByKey(s2Name) || null
        if (safeL[prefix + '_st']) role.stats = safeL[prefix + '_st']
        if (safeL[prefix + '_eq']) {
          role.equipTraits = safeL[prefix + '_eq'].map((t: any) => t ? { name: t.n, rank: t.r, description: t.d, active: true } : null)
        }
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
      restore('m', target.main)
      restore('v1', target.vice1)
      restore('v2', target.vice2)
    })
  }
}

// Snapshot current state under a recovery key before OAuth full-page redirect,
// so handleAuthCallback's success path can restore the lineup the user was
// building. 5-minute TTL so a stale snapshot from days ago doesn't surprise.
const RECOVERY_KEY = 'nobunaga.auth.recovery'
const RECOVERY_TTL_MS = 5 * 60 * 1000

const snapshotForRecovery = () => {
  const blob: ShareableData = { v: 2 }
  blob.lineups = lineups.map(serializeLineup)
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

// --- Changelog ---
// Single localStorage key stores the last version the user dismissed the
// changelog for. Mismatch with LATEST_VERSION → auto-open + show red dot.
// First-time users (no stored value) also see the dialog once.
const CHANGELOG_SEEN_KEY = 'nobunaga.changelog.lastSeen'
const changelogDialogVisible = ref(false)
const hasUnseenChangelog = ref(false)

const checkUnseenChangelog = () => {
  hasUnseenChangelog.value = localStorage.getItem(CHANGELOG_SEEN_KEY) !== LATEST_VERSION
}

const openChangelogDialog = () => {
  changelogDialogVisible.value = true
}

// Persist seen state when the user dismisses the dialog (any close path).
watch(changelogDialogVisible, (now, prev) => {
  if (prev && !now) {
    localStorage.setItem(CHANGELOG_SEEN_KEY, LATEST_VERSION)
    hasUnseenChangelog.value = false
  }
})

// --- Auth ---
const {
  isLoggedIn, displayName, needsDisplayName,
  signIn, signOut, updateDisplayName, refreshFromStorage,
  sessionExpiredCount,
} = useAuth()
const authDialogVisible = ref(false)
const renameDialogVisible = ref(false)
const renameInput = ref('')
const renameSaving = ref(false)

const onSignIn = (provider: OAuthProvider) => {
  authDialogVisible.value = false
  snapshotForRecovery()
  signIn(provider)  // full-page redirect — nothing after this runs
}

const myProfilesDialogVisible = ref(false)
const gachaLogDialogVisible = ref(false)
// Set by initFromHash when an incoming share is a v3 gacha-log snapshot.
// Non-null switches the whole UI to spectator mode (no edit affordances).
const gachaSpectatorBlob = ref<SpectatorBlob | null>(null)
const { applyProfile, clearActiveProfile, activeProfileName } = useActiveProfile()

// Auto-apply the user's default profile after initFromHash settles. Skips
// when (a) the user isn't logged in, (b) inventory was already filled by a
// share link / OAuth recovery, or (c) the user has no default profile —
// keeping fresh-page-loads silent for users who haven't opted in.
const tryAutoLoadDefaultProfile = async (): Promise<void> => {
  if (!isLoggedIn.value) return
  if (ownedHeroes.value.length > 0 || ownedSkills.value.length > 0) return
  try {
    const profiles = await listMyProfiles()
    const def = profiles.find(p => p.is_default)
    if (def) {
      applyProfile(def)
      ElMessage.info(`已載入預設角色配置：${def.name}`)
    }
  } catch (e) {
    // Silent fail — first-time users without grants/profiles shouldn't get
    // an error toast on page load. Surfaces in console for debugging.
    console.warn('[profiles] auto-load default skipped:', e)
  }
}

const onUserMenu = async (cmd: UserMenuCmd) => {
  if (cmd === 'signout') {
    await signOut()
    clearActiveProfile()
    ElMessage.success('已登出')
  } else if (cmd === 'rename') {
    openRenameDialog()
  } else if (cmd === 'my-shares') {
    openMySharesDialog()
  } else if (cmd === 'my-profiles') {
    myProfilesDialogVisible.value = true
  } else if (cmd === 'gacha-log') {
    gachaLogDialogVisible.value = true
  } else if (cmd === 'changelog') {
    openChangelogDialog()
  }
}

// --- My Shares ---
const mySharesDialogVisible = ref(false)
const mySharesLoading = ref(false)
const myShares = ref<MyShare[]>([])
// Inline rename: track which row (slug) is editing + the draft value.
const editingSlug = ref<string | null>(null)
const editingDraft = ref('')

// React to involuntary session expiration (refresh token revoked). The user
// did NOT click "sign out" — their token genuinely died (revoked elsewhere,
// password changed, refresh window exceeded). Quietly transition the UI:
// close auth-only dialogs, drop the active profile name, and show a single
// warning toast. The lineup/inventory data is left intact so the user
// doesn't lose work — they can keep building offline or share anonymously.
watch(sessionExpiredCount, () => {
  myProfilesDialogVisible.value = false
  mySharesDialogVisible.value = false
  gachaLogDialogVisible.value = false
  renameDialogVisible.value = false
  clearActiveProfile()
  ElMessage.warning('登入已過期，請重新登入以同步雲端資料')
})

const openMySharesDialog = async () => {
  mySharesDialogVisible.value = true
  mySharesLoading.value = true
  try {
    myShares.value = await listMyShares()
  } catch (e) {
    ElMessage.error(`載入失敗：${(e as Error).message}`)
  } finally {
    mySharesLoading.value = false
  }
}

const startEditShareName = (s: MyShare) => {
  editingSlug.value = s.slug
  editingDraft.value = s.display_name ?? ''
}

const cancelEditShareName = () => {
  editingSlug.value = null
  editingDraft.value = ''
}

const saveShareName = async (s: MyShare) => {
  const next = editingDraft.value.trim()
  if (next === (s.display_name ?? '').trim()) {
    cancelEditShareName()
    return
  }
  try {
    await renameMyShare(s.slug, next || null)
    s.display_name = next || null
    s.updated_at = new Date().toISOString()
    cancelEditShareName()
    ElMessage.success('已更新')
  } catch (e) {
    ElMessage.error(`更新失敗：${(e as Error).message}`)
  }
}

const removeMyShare = async (s: MyShare) => {
  try {
    await deleteMyShare(s.slug)
    myShares.value = myShares.value.filter(x => x.slug !== s.slug)
    ElMessage.success('已刪除')
  } catch (e) {
    ElMessage.error(`刪除失敗：${(e as Error).message}`)
  }
}

const togglePinShare = async (s: MyShare) => {
  const next = !s.pinned
  try {
    await pinMyShare(s.slug, next)
    s.pinned = next  // mutate in place; sortedMyShares is a computed off myShares
    s.updated_at = new Date().toISOString()
  } catch (e) {
    ElMessage.error(`${next ? '釘選' : '取消釘選'}失敗：${(e as Error).message}`)
  }
}

// Sort: pinned first, then named (alphabetical), then unnamed (most recent first).

const copyShareUrl = (slug: string) => {
  const url = `${window.location.origin}${window.location.pathname}#s/${slug}`
  navigator.clipboard.writeText(url).then(() => {
    ElMessage.success('連結已複製')
  }).catch(() => {
    ElMessage.error('複製失敗')
  })
}

const openRenameDialog = () => {
  renameInput.value = displayName.value
  renameDialogVisible.value = true
}

const submitRename = async () => {
  const name = renameInput.value.trim()
  if (!name) {
    ElMessage.warning('名稱不可為空')
    return
  }
  renameSaving.value = true
  try {
    await updateDisplayName(name)
    renameDialogVisible.value = false
    ElMessage.success('名稱已更新')
  } catch (e) {
    ElMessage.error(`更新失敗：${(e as Error).message}`)
  } finally {
    renameSaving.value = false
  }
}

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
      // First-time prompt: ask new users to pick a display name.
      if (needsDisplayName.value) {
        renameInput.value = displayName.value  // prefill with email prefix
        renameDialogVisible.value = true
      }
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
  checkUnseenChangelog()
  const consumedHash = await initFromHash()
  // Fire-and-forget: the auto-load sequencing only depends on initFromHash
  // (share/recovery should win if present). No reason to block the changelog
  // open on a Supabase round-trip — they don't conflict, and `consumedHash`
  // already gates the changelog independently.
  void tryAutoLoadDefaultProfile()
  // Auto-open changelog only when nothing else is competing for the user's
  // attention. Triggers for both first-time visitors and returning users on
  // a release day (LATEST_VERSION mismatch).
  if (hasUnseenChangelog.value && !consumedHash) {
    changelogDialogVisible.value = true
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
  height: calc(100dvh - var(--el-header-height) - 32px);
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