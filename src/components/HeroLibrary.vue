<template>
  <div class="flex flex-col h-full min-h-0">
    <!-- Filters -->
    <div class="p-0 md:p-2 border-b border-gray-100 space-y-1 md:space-y-2">
      <div class="flex justify-between items-center px-1 md:px-0 pt-1 md:pt-0">
        <el-input
          v-model="searchQuery"
          placeholder="武将を検索..."
          clearable
          prefix-icon="Search"
          class="flex-1 mr-1 md:mr-2"
          size="small"
        />
        <button
          v-if="mode === 'manage'"
          class="px-2 py-1 text-xs rounded border mr-2 transition-colors flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
          :class="allFilteredOwned
            ? 'bg-amber-500 text-white border-amber-500 hover:bg-amber-600'
            : 'bg-white text-gray-600 border-gray-300 hover:border-amber-500 hover:text-amber-600'"
          :disabled="filteredHeroes.length === 0"
          :title="allFilteredOwned ? '絞り込み結果の所持チェックをすべて外す' : '絞り込み結果をすべて所持済みにする'"
          @click="toggleSelectAllFiltered"
        >
          {{ allFilteredOwned ? '全選択解除' : '全選択' }}
        </button>
        <el-switch
          :model-value="filterOwned"
          @update:model-value="(val: string | number | boolean) => $emit('update:filterOwned', Boolean(val))"
          inline-prompt
          active-text="所持済み"
          inactive-text="すべて"
          v-if="mode === 'select'"
        />
         <div v-else class="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded">
           所持編集モード
         </div>
      </div>

      <div class="space-y-1 pb-1 px-1 md:px-0">
        <div v-if="showLabelFilter && availableLabels.length" class="flex items-start gap-1">
          <span class="text-xs text-gray-400 w-8 flex-shrink-0 mt-1">ラベル</span>
          <div class="flex-1 space-y-1">
            <div class="flex items-center gap-1 flex-wrap">
              <button
                class="px-2 py-0.5 text-xs rounded border transition-colors"
                :class="showLabelOptions
                  ? 'bg-slate-700 text-white border-slate-700'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-slate-400'"
                @click="showLabelOptions = !showLabelOptions"
              >
                ラベル
              </button>
              <button
                v-if="selectedLabelValue"
                class="px-2 py-0.5 text-xs rounded border border-amber-200 bg-amber-50 text-amber-700 font-bold hover:bg-amber-100"
                @click="clearLabel"
              >
                {{ selectedLabelValue }} ✕
              </button>
            </div>
            <div v-if="showLabelOptions" class="flex gap-1 flex-wrap rounded border border-gray-100 bg-slate-50 p-1">
              <button
                v-for="label in availableLabels"
                :key="'label-' + label"
                class="px-2 py-0.5 text-xs rounded border transition-colors"
                :class="selectedLabelValue === label
                  ? 'bg-amber-500 text-white border-amber-500'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-amber-300'"
                @click="toggleLabel(label)"
              >
                {{ label }}
              </button>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-1">
          <span class="text-xs text-gray-400 w-8 flex-shrink-0">Cost</span>
          <div class="flex gap-1 flex-wrap flex-1">
            <button
              v-for="c in availableCosts"
              :key="'cost-' + c"
              class="px-2 py-0.5 text-xs rounded border transition-colors"
              :class="selectedCost === c
                ? 'bg-blue-500 text-white border-blue-500'
                : 'bg-white text-gray-500 border-gray-300 hover:border-blue-300'"
              @click="toggleCost(c)"
            >{{ c }}</button>
          </div>
          <button
            v-if="hasActiveFilters"
            class="text-xs font-bold text-red-500 hover:text-red-700 transition-colors flex-shrink-0"
            @click="resetFilters"
          >✕</button>
        </div>
        <div class="flex items-center gap-1">
          <span class="text-xs text-gray-400 w-8 flex-shrink-0">勢力</span>
          <div class="flex gap-1 flex-wrap">
            <button
              v-for="f in factions"
              :key="'fac-' + f"
              class="px-2 py-0.5 text-xs rounded border transition-colors"
              :class="selectedFaction === f
                ? 'bg-amber-500 text-white border-amber-500'
                : 'bg-white text-gray-500 border-gray-300 hover:border-amber-300'"
              @click="toggleFaction(f)"
            >{{ f }}</button>
          </div>
        </div>
        <div class="flex items-start gap-1 flex-wrap md:flex-nowrap">
          <span class="hidden md:block text-xs text-gray-400 w-8 flex-shrink-0 mt-0.5">家門</span>
          <button
            type="button"
            class="md:hidden w-full min-h-8 flex items-center justify-between rounded border border-gray-200 bg-white px-2 text-xs text-gray-600"
            :aria-expanded="mobileClanExpanded"
            @click="mobileClanExpanded = !mobileClanExpanded"
          >
            <span>
              家門
              <strong v-if="selectedClan" class="ml-1 text-emerald-700">{{ selectedClan }}</strong>
            </span>
            <el-icon :class="mobileClanExpanded ? 'rotate-180' : ''" class="transition-transform"><ArrowDown /></el-icon>
          </button>
          <div
            class="w-full md:w-auto gap-1 flex-wrap"
            :class="mobileClanExpanded ? 'flex' : 'hidden md:flex'"
          >
            <button
              v-for="c in clans"
              :key="'clan-' + c"
              class="px-2 py-0.5 text-xs rounded border transition-colors"
              :class="selectedClan === c
                ? 'bg-emerald-500 text-white border-emerald-500'
                : 'bg-white text-gray-500 border-gray-300 hover:border-emerald-300'"
              @click="toggleClan(c)"
            >{{ c }}</button>
          </div>
        </div>
        <div v-if="showTroopFilter" class="flex items-center gap-1">
          <span class="text-xs text-gray-400 w-8 flex-shrink-0">兵種</span>
          <div class="flex gap-1 flex-wrap">
            <button
              v-for="tt in TROOP_TYPES"
              :key="'troop-' + tt"
              class="px-2 py-0.5 text-xs rounded border transition-colors"
              :class="selectedTroopTypes.has(tt)
                ? 'bg-red-500 text-white border-red-500'
                : 'bg-white text-gray-500 border-gray-300 hover:border-red-300'"
              @click="toggleTroopType(tt)"
            >{{ tt }}</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Grid -->
    <div class="flex-1 overflow-y-auto p-0 md:p-2">
      <div v-if="filteredHeroes.length === 0" class="text-center py-10 text-gray-400">
        条件に合う武将がありません
      </div>
      <div
        class="grid gap-1 md:gap-2"
        :class="mode === 'manage' ? 'grid-cols-5 sm:grid-cols-8 md:grid-cols-10' : 'grid-cols-4 md:grid-cols-5'"
      >
        <div 
          v-for="hero in filteredHeroes" 
          :key="hero.name + hero.faction" 
          class="relative transition-all"
          :class="{ 
            'opacity-50 grayscale cursor-not-allowed': mode === 'select' && isUsed(hero.name),
            'opacity-40': mode === 'select' && filterOwned && !props.ownedHeroes.includes(hero.name),
            'grayscale opacity-60': mode === 'manage' && !props.ownedHeroes.includes(hero.name),
            'cursor-pointer hover:scale-105': (mode === 'manage') || mode === 'browse' || (mode === 'select' && !isUsed(hero.name))
          }"
          @click="handleClick(hero)"
        >
          <HeroCard :hero="hero" :show-aptitude="mode !== 'manage'" :compact="mode === 'manage'" />

          <div
            v-if="mode === 'manage' && props.ownedHeroes.includes(hero.name)"
            class="absolute left-1 right-1 top-1 z-30 grid h-6 grid-cols-[22px_minmax(24px,1fr)_22px] overflow-hidden rounded border border-amber-300 bg-white/95 shadow-sm"
            @click.stop
          >
            <button
              type="button"
              class="flex items-center justify-center text-amber-800 disabled:text-gray-300"
              :disabled="breakthroughOf(hero.name) === 0"
              :aria-label="`${hero.name_jp || hero.name}の凸数を減らす`"
              @click.stop="adjustBreakthrough(hero.name, -1)"
            >
              <el-icon><Minus /></el-icon>
            </button>
            <span class="flex items-center justify-center whitespace-nowrap border-x border-amber-200 text-[10px] font-bold text-amber-800">
              {{ breakthroughOf(hero.name) }}凸
            </span>
            <button
              type="button"
              class="flex items-center justify-center text-amber-800 disabled:text-gray-300"
              :disabled="breakthroughOf(hero.name) === 5"
              :aria-label="`${hero.name_jp || hero.name}の凸数を増やす`"
              @click.stop="adjustBreakthrough(hero.name, 1)"
            >
              <el-icon><Plus /></el-icon>
            </button>
          </div>
          
          <!-- Used Label (Select Mode) -->
          <div v-if="mode === 'select' && isUsed(hero.name)" class="absolute inset-0 flex items-center justify-center z-20">
             <span class="bg-black/70 text-white text-xs px-2 py-1 rounded font-bold">編成中</span>
          </div>

          <!-- Unowned Label (Manage Mode) -->
           <div v-if="mode === 'manage' && !props.ownedHeroes.includes(hero.name)" class="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
             <!-- Icon only for compact mode? Or just dimming is enough? -->
             <!-- <span class="bg-gray-800/70 text-white text-xs px-1 py-0.5 rounded">未擁有</span> -->
             <el-icon class="text-white bg-black/50 rounded-full p-1" :size="20"><Close /></el-icon>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, PropType, watch } from 'vue'
import { ArrowDown, Close, Minus, Plus } from '@element-plus/icons-vue'
import { useData, Hero } from '../composables/useData'
import { TROOP_TYPES } from '../constants/traits'
import HeroCard from './HeroCard.vue'
import { allHeroLabels, heroLabels } from '../lib/heroLabels'

const { heroes } = useData()
const emit = defineEmits([
  'select',
  'browse',
  'update:ownedHeroes',
  'update:heroBreakthroughs',
  'update:filterOwned',
  'update:selectedLabel',
])

const props = defineProps({
  usedHeroes: { type: Object as PropType<Set<string> | string[]>, default: () => [] },
  mode: { type: String as PropType<'browse' | 'select' | 'manage'>, default: 'select' },
  ownedHeroes: { type: Array as PropType<string[]>, default: () => [] },
  heroBreakthroughs: { type: Object as PropType<Record<string, number>>, default: () => ({}) },
  filterOwned: { type: Boolean, default: false },
  allowedRarities: { type: Array as PropType<Array<number | string>>, default: () => [] },
  showTroopFilter: { type: Boolean, default: false },
  showLabelFilter: { type: Boolean, default: false },
  selectedLabel: { type: String, default: '' },
  labelOptions: { type: Array as PropType<string[]>, default: () => [] },
})

const searchQuery = ref('')
const debouncedSearchQuery = ref('')
let debounceTimer: any = null

watch(searchQuery, (newVal) => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debouncedSearchQuery.value = newVal
  }, 200)
})

const selectedCost = ref<number | null>(null)
const selectedFaction = ref<string | null>(null)
const selectedClan = ref<string | null>(null)
const selectedTroopTypes = ref<Set<string>>(new Set())
const showLabelOptions = ref(false)
const mobileClanExpanded = ref(false)

const allowedRaritySet = computed(() => new Set(props.allowedRarities.map((rarity) => Number(rarity))))
const libraryHeroes = computed(() => heroes.value.filter((hero) => {
  if (allowedRaritySet.value.size === 0) return true
  return allowedRaritySet.value.has(Number(hero.rarity))
}))

const heroFactionLabel = (hero: Hero): string => hero.faction_jp || hero.faction || ''
const heroClanLabel = (hero: Hero): string => hero.clan_jp || hero.clan || ''
const heroSearchText = (hero: Hero): string => [
  hero.name_jp,
  hero.name,
  hero.faction_jp,
  hero.faction,
  hero.clan_jp,
  hero.clan,
].filter(Boolean).join(' ')

const factions = computed(() => {
  return [...new Set(libraryHeroes.value.map(heroFactionLabel))].filter(Boolean).sort()
})

const clans = computed(() => {
  const counts = new Map<string, number>()
  for (const h of libraryHeroes.value) {
    const clan = heroClanLabel(h)
    if (!clan) continue
    counts.set(clan, (counts.get(clan) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c)
})

const availableCosts = computed(() => {
  return [...new Set(libraryHeroes.value.map(h => h.cost))].sort((a, b) => b - a)
})

const availableLabels = computed(() => props.labelOptions.length ? props.labelOptions : allHeroLabels())
const selectedLabelValue = computed(() => props.selectedLabel)

const toggleCost = (cost: number) => {
  selectedCost.value = selectedCost.value === cost ? null : cost
}

const toggleFaction = (faction: string) => {
  selectedFaction.value = selectedFaction.value === faction ? null : faction
}

const toggleClan = (clan: string) => {
  selectedClan.value = selectedClan.value === clan ? null : clan
}

const toggleTroopType = (tt: string) => {
  const next = new Set(selectedTroopTypes.value)
  next.has(tt) ? next.delete(tt) : next.add(tt)
  selectedTroopTypes.value = next
}

const toggleLabel = (label: string) => {
  emit('update:selectedLabel', selectedLabelValue.value === label ? '' : label)
}

const clearLabel = () => {
  emit('update:selectedLabel', '')
}

const heroHasTroopType = (h: Hero, types: Set<string>): boolean => {
  return (h.traits || []).some(t =>
    t.affinity?.troop_types?.some(tt => types.has(tt))
  )
}

const activeFilterCount = computed(() =>
  (selectedCost.value == null ? 0 : 1) +
  (selectedFaction.value == null ? 0 : 1) +
  (selectedClan.value == null ? 0 : 1) +
  (props.showTroopFilter ? selectedTroopTypes.value.size : 0) +
  (props.showLabelFilter && selectedLabelValue.value ? 1 : 0)
)
const hasActiveFilters = computed(() => activeFilterCount.value > 0)

const resetFilters = () => {
  selectedCost.value = null
  selectedFaction.value = null
  selectedClan.value = null
  selectedTroopTypes.value = new Set()
  clearLabel()
}

const filteredHeroes = computed(() => {
  return libraryHeroes.value.filter(h => {
    if (debouncedSearchQuery.value && !heroSearchText(h).includes(debouncedSearchQuery.value)) return false
    if (selectedFaction.value && heroFactionLabel(h) !== selectedFaction.value) return false
    if (selectedCost.value !== null && h.cost !== selectedCost.value) return false
    if (selectedClan.value && heroClanLabel(h) !== selectedClan.value) return false
    if (props.showTroopFilter && selectedTroopTypes.value.size > 0 && !heroHasTroopType(h, selectedTroopTypes.value)) return false
    if (props.showLabelFilter && selectedLabelValue.value && !heroLabels(h).includes(selectedLabelValue.value)) return false
    if (props.mode === 'select' && props.filterOwned && !props.ownedHeroes.includes(h.name)) return false
    return true
  })
})

const isUsed = (name: string) => {
  if (Array.isArray(props.usedHeroes)) {
    return props.usedHeroes.includes(name)
  }
  return (props.usedHeroes as Set<string>).has(name)
}

const toggleOwned = (name: string) => {
  const newOwned = [...props.ownedHeroes]
  if (newOwned.includes(name)) {
    newOwned.splice(newOwned.indexOf(name), 1)
    const nextBreakthroughs = { ...props.heroBreakthroughs }
    delete nextBreakthroughs[name]
    emit('update:heroBreakthroughs', nextBreakthroughs)
  } else {
    newOwned.push(name)
  }
  emit('update:ownedHeroes', newOwned)
}

const breakthroughOf = (name: string): number =>
  Math.min(5, Math.max(0, Math.trunc(Number(props.heroBreakthroughs[name]) || 0)))

const adjustBreakthrough = (name: string, delta: number) => {
  if (!props.ownedHeroes.includes(name)) return
  const next = { ...props.heroBreakthroughs }
  const value = Math.min(5, Math.max(0, breakthroughOf(name) + delta))
  if (value === 0) delete next[name]
  else next[name] = value
  emit('update:heroBreakthroughs', next)
}

// Select-all toggle for manage mode: scopes the action to whatever the user
// has currently filtered (search + cost/faction/clan/troop). Toggle behavior
// avoids needing two separate buttons — re-clicking after a "select all"
// becomes a "deselect all" of the same scope.
const allFilteredOwned = computed(() =>
  filteredHeroes.value.length > 0 &&
  filteredHeroes.value.every(h => props.ownedHeroes.includes(h.name))
)

const toggleSelectAllFiltered = () => {
  const filteredNames = filteredHeroes.value.map(h => h.name)
  if (allFilteredOwned.value) {
    const filteredSet = new Set(filteredNames)
    emit('update:ownedHeroes', props.ownedHeroes.filter(n => !filteredSet.has(n)))
    const nextBreakthroughs = { ...props.heroBreakthroughs }
    for (const name of filteredSet) delete nextBreakthroughs[name]
    emit('update:heroBreakthroughs', nextBreakthroughs)
  } else {
    const ownedSet = new Set(props.ownedHeroes)
    const newOwned = [...props.ownedHeroes]
    for (const n of filteredNames) if (!ownedSet.has(n)) newOwned.push(n)
    emit('update:ownedHeroes', newOwned)
  }
}

const handleClick = (hero: Hero) => {
  if (props.mode === 'manage') {
    toggleOwned(hero.name)
  } else if (props.mode === 'browse') {
    emit('browse', hero)
  } else {
    // Select mode
    // Check if used
    if (isUsed(hero.name)) return
    // Check if owned (if we enforce ownership, strictly speaking yes, but usually just visual warning)
    // Let's assume user can only select what they own if filter is on, otherwise allow ghosting? 
    // Usually "Inventory" implies you can only use what you have. 
    // But for a builder, maybe allow all? Let's assume allow all unless filtered.
    emit('select', hero)
  }
}
</script>
