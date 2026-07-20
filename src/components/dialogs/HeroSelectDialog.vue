<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="(value: boolean) => $emit('update:modelValue', value)"
    title="武将を選択"
    width="min(920px, 94vw)"
    class="hero-select-dialog"
    align-center
    append-to-body
  >
    <div class="h-[70dvh] max-h-[720px]">
      <HeroLibrary
        mode="select"
        :used-heroes="usedHeroes"
        :owned-heroes="ownedHeroes"
        :filter-owned="filterOwned"
        :allowed-rarities="[5, 4]"
        @update:filterOwned="(value: boolean) => $emit('update:filterOwned', value)"
        @select="(hero: Hero) => $emit('select', hero)"
      />
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import HeroLibrary from '../HeroLibrary.vue'
import type { Hero } from '../../composables/useData'

defineProps<{
  modelValue: boolean
  usedHeroes: Set<string>
  ownedHeroes: string[]
  filterOwned: boolean
}>()

defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'update:filterOwned', value: boolean): void
  (e: 'select', hero: Hero): void
}>()
</script>
