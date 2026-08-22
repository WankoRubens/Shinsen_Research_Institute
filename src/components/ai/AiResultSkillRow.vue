<template>
  <div class="skill-row">
    <span class="marker">{{ marker }}</span>
    <img v-if="skill?.icon" :src="skill.icon" alt="" />
    <div>
      <b>{{ skill ? skillName(skill) : fallbackName }}</b>
      <BriefDescription
        v-if="skill && skillBriefDescription(skill)"
        :text="skillBriefDescription(skill)"
        :vars="skill.vars"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import BriefDescription from '../BriefDescription.vue'
import type { Skill } from '../../composables/useData'
import { useLocalizedGameData } from '../../composables/useLocalizedGameData'

defineProps<{
  marker: string
  skill: Skill | null
  fallbackName: string
}>()

const {
  skillName,
  skillBriefDescription,
} = useLocalizedGameData()
</script>

<style scoped>
.skill-row {
  display: grid;
  grid-template-columns: 26px auto minmax(0, 1fr);
  align-items: center;
  gap: 7px;
  min-height: 46px;
  padding: 6px;
  border: 1px solid #e1e5ea;
  border-radius: 5px;
  background: #fff;
}

.marker {
  display: inline-flex;
  width: 26px;
  height: 26px;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  color: #9a4d00;
  background: #fff4c6;
  font-size: 11px;
  font-weight: 900;
}

img {
  width: 28px;
  height: 28px;
  border-radius: 4px;
  object-fit: cover;
  background: #edf0f3;
}

.skill-row > div {
  display: grid;
  min-width: 0;
  gap: 2px;
}

b {
  overflow: hidden;
  color: #263238;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:deep(.brief-description) {
  overflow: hidden;
  color: #7b8592;
  font-size: 10px;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
