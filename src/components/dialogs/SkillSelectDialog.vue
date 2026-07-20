<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="(v: boolean) => $emit('update:modelValue', v)"
    title="戦法を選択"
    width="min(760px, 94vw)"
    class="skill-select-dialog"
    align-center
    append-to-body
  >
    <div class="h-[70dvh] max-h-[720px]">
      <SkillLibrary
        mode="select"
        :used-skills="usedSkills"
        :owned-skills="ownedSkills"
        :filter-owned="filterOwned"
        @update:filterOwned="(value: boolean) => $emit('update:filterOwned', value)"
        @select="(skill: Skill) => $emit('select', skill)"
      />
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import SkillLibrary from '../SkillLibrary.vue'
import type { Skill } from '../../composables/useData'

defineProps<{
  modelValue: boolean
  usedSkills: Set<string>
  ownedSkills: string[]
  filterOwned: boolean
}>()
defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'update:filterOwned', v: boolean): void
  (e: 'select', skill: Skill): void
}>()
</script>
