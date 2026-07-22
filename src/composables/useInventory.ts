import { ref } from 'vue'
import { useProfiles } from './useProfiles'

export type HeroBreakthroughMap = Record<string, number>

// State
const ownedHeroes = ref<string[]>([])
const ownedSkills = ref<string[]>([])
const ownedHeroBreakthroughs = ref<HeroBreakthroughMap>({})
const showOwnedOnly = ref(false)

const isEditingInventory = ref(false)
const tempOwnedHeroes = ref<string[]>([])
const tempOwnedSkills = ref<string[]>([])
const tempOwnedHeroBreakthroughs = ref<HeroBreakthroughMap>({})

// Actions
const startEditingInventory = () => {
  tempOwnedHeroes.value = [...ownedHeroes.value]
  tempOwnedSkills.value = [...ownedSkills.value]
  tempOwnedHeroBreakthroughs.value = { ...ownedHeroBreakthroughs.value }
  isEditingInventory.value = true
}

const saveInventory = () => {
  ownedHeroes.value = [...tempOwnedHeroes.value]
  ownedSkills.value = [...tempOwnedSkills.value]
  const ownedSet = new Set(ownedHeroes.value)
  ownedHeroBreakthroughs.value = Object.fromEntries(
    Object.entries(tempOwnedHeroBreakthroughs.value)
      .filter(([name, count]) => ownedSet.has(name) && count > 0)
      .map(([name, count]) => [name, Math.min(5, Math.max(0, Math.trunc(count)))]),
  )
  isEditingInventory.value = false
  // Manual save = explicit user intent. Block tryAutoApplyDefault from
  // overwriting on a still-pending session resolution.
  useProfiles().markUserTouched()
}

const cancelEditingInventory = () => {
  isEditingInventory.value = false
}

const clearInventory = () => {
  ownedHeroes.value = []
  ownedSkills.value = []
  ownedHeroBreakthroughs.value = {}
}

export function useInventory() {
  return {
    ownedHeroes,
    ownedSkills,
    ownedHeroBreakthroughs,
    showOwnedOnly,
    isEditingInventory,
    tempOwnedHeroes,
    tempOwnedSkills,
    tempOwnedHeroBreakthroughs,
    startEditingInventory,
    saveInventory,
    cancelEditingInventory,
    clearInventory
  }
}
