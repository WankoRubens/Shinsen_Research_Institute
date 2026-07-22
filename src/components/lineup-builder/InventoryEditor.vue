<template>
  <div class="h-full bg-white flex flex-col">
    <div class="w-full md:container md:mx-auto h-full flex flex-col p-0 md:p-4">
      <el-tabs
        :model-value="activeTab"
        @update:model-value="(v: string) => $emit('update:activeTab', v)"
        class="inventory-tabs flex-1 flex flex-col"
        type="border-card"
      >
        <el-tab-pane :label="t('heroInventory')" name="heroes" class="h-full flex flex-col overflow-hidden">
          <HeroLibrary
            mode="manage"
            :used-heroes="[]"
            :owned-heroes="ownedHeroes"
            :hero-breakthroughs="heroBreakthroughs"
            @update:ownedHeroes="(val: string[]) => $emit('update:ownedHeroes', val)"
            @update:heroBreakthroughs="(val: Record<string, number>) => $emit('update:heroBreakthroughs', val)"
          />
        </el-tab-pane>
        <el-tab-pane :label="t('skillInventory')" name="skills" class="h-full flex flex-col overflow-hidden">
          <SkillLibrary
            mode="manage"
            :used-skills="new Set()"
            :owned-skills="ownedSkills"
            @update:ownedSkills="(val: string[]) => $emit('update:ownedSkills', val)"
          />
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script setup lang="ts">
import HeroLibrary from '../HeroLibrary.vue'
import SkillLibrary from '../SkillLibrary.vue'
import { useLocale } from '../../composables/useLocale'

const { t } = useLocale()

defineProps<{
  activeTab: string
  ownedHeroes: string[]
  ownedSkills: string[]
  heroBreakthroughs: Record<string, number>
}>()
defineEmits<{
  (e: 'update:activeTab', v: string): void
  (e: 'update:ownedHeroes', v: string[]): void
  (e: 'update:ownedSkills', v: string[]): void
  (e: 'update:heroBreakthroughs', v: Record<string, number>): void
}>()
</script>
