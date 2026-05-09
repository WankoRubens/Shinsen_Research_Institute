<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="(v: boolean) => $emit('update:modelValue', v)"
    title="加入編組"
    width="520px"
    align-center
  >
    <div class="flex flex-col gap-3">
      <el-tabs v-model="tab" class="proposal-tabs">
        <el-tab-pane label="我的提案" name="mine">
          <div v-if="loadingMine" class="text-center text-xs text-ink-mute py-4">載入中…</div>
          <div v-else-if="myProposals.length === 0" class="text-center text-xs text-ink-mute py-4">
            尚未建立任何提案。
          </div>
          <div v-else class="flex flex-col gap-1 max-h-72 overflow-y-auto">
            <button
              v-for="p in myProposals"
              :key="p.id"
              type="button"
              class="flex items-center justify-between gap-2 px-3 py-2 rounded border text-left transition-colors"
              :class="selectedId === p.id ? 'border-amber-700 bg-amber-50' : 'border-parchment-dim hover:bg-parchment-soft/60'"
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
            目前還沒有任何公開提案。
          </div>
          <div v-else class="flex flex-col gap-1 max-h-72 overflow-y-auto">
            <button
              v-for="p in publicProposals"
              :key="p.id"
              type="button"
              class="flex items-center justify-between gap-2 px-3 py-2 rounded border text-left transition-colors"
              :class="selectedId === p.id ? 'border-amber-700 bg-amber-50' : 'border-parchment-dim hover:bg-parchment-soft/60'"
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

      <div
        v-if="conflictPreview.length > 0"
        class="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
      >
        <p class="font-bold mb-1">偵測到衝突</p>
        <p class="leading-snug">
          匯入後，{{ conflictPreview.length }} 名武將會與當前隊組其它隊伍重複：
          <span class="font-mono">{{ conflictPreview.map(c => c.heroName).join('、') }}</span>
        </p>
      </div>

      <div class="flex justify-end gap-2 pt-1 border-t border-parchment-dim">
        <el-button @click="onCancel">取消</el-button>
        <template v-if="conflictPreview.length === 0">
          <el-button
            type="primary"
            :disabled="!selectedProposal"
            @click="onImport('overwrite')"
          >
            加入隊組
          </el-button>
        </template>
        <template v-else>
          <el-button :disabled="!selectedProposal" @click="onImport('leave-empty')">
            留空匯入
          </el-button>
          <el-button
            type="primary"
            :disabled="!selectedProposal"
            @click="onImport('overwrite')"
          >
            強制覆寫
          </el-button>
        </template>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { Proposal, ImportConflictResolution } from '../../types/group'

const props = defineProps<{
  modelValue: boolean
  loadingMine: boolean
  loadingPublic: boolean
  myProposals: Proposal[]
  publicProposals: Proposal[]
  /** Hero names already used across the current group's other teams. */
  usedHeroNames: Set<string>
}>()
const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'tab-change', tab: 'mine' | 'public'): void
  (e: 'import', payload: { proposal: Proposal; resolution: ImportConflictResolution }): void
}>()

const tab = ref<'mine' | 'public'>('mine')
const selectedId = ref<string | null>(null)

watch(tab, (t) => {
  selectedId.value = null
  emit('tab-change', t)
})

watch(() => props.modelValue, (now) => {
  if (now) {
    tab.value = 'mine'
    selectedId.value = null
    emit('tab-change', 'mine')
  }
})

const selectedProposal = computed<Proposal | null>(() => {
  if (!selectedId.value) return null
  const list = tab.value === 'mine' ? props.myProposals : props.publicProposals
  return list.find(p => p.id === selectedId.value) ?? null
})

// Per-role hero collisions between the picked proposal and the current group.
const conflictPreview = computed<{ role: 'main' | 'vice1' | 'vice2'; heroName: string }[]>(() => {
  const p = selectedProposal.value
  if (!p) return []
  const out: { role: 'main' | 'vice1' | 'vice2'; heroName: string }[] = []
  for (const role of ['main', 'vice1', 'vice2'] as const) {
    const h = p.team[role]?.hero
    if (h && props.usedHeroNames.has(h.name)) out.push({ role, heroName: h.name })
  }
  return out
})

const onCancel = () => emit('update:modelValue', false)

const onImport = (resolution: ImportConflictResolution) => {
  const p = selectedProposal.value
  if (!p) return
  emit('import', { proposal: p, resolution })
}
</script>

<style scoped>
.proposal-tabs :deep(.el-tabs__nav-wrap::after) {
  background-color: var(--el-border-color-lighter);
}
</style>
