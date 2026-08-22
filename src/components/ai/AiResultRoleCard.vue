<template>
  <article class="result-role-card">
    <header class="role-head">
      <div>
        <span>{{ title }}</span>
        <strong>{{ heroName }}</strong>
      </div>
      <div v-if="role.hero" class="breakthrough" :aria-label="`${role.breakthrough}凸`">
        <span v-for="n in maxBreakthrough" :key="n" :class="{ filled: n <= role.breakthrough }">★</span>
      </div>
    </header>

    <div v-if="role.hero" class="role-body">
      <HeroCard :hero="role.hero" hide-name class="portrait" />

      <div class="stats" aria-label="属性値と属性ポイント">
        <div v-for="stat in statRows" :key="stat.key" class="stat-row">
          <span>{{ stat.label }}</span>
          <b>{{ formatStat(stat.value) }}</b>
          <small :class="stat.bonus > 0 ? 'positive' : stat.bonus < 0 ? 'negative' : ''">
            {{ formatBonus(stat.bonus) }}
          </small>
        </div>
      </div>

      <div v-if="role.bingxue.direction" class="bingxue" :class="bingxueClass">
        <div class="bingxue-head">
          <span>{{ role.bingxue.direction }}</span>
          <b>{{ role.bingxue.major || '主兵法未選択' }}</b>
        </div>
        <div v-if="role.bingxue.minors.length" class="bingxue-minors">
          <span v-for="minor in role.bingxue.minors" :key="`${minor.name}-${minor.level}`">
            {{ minor.name }} {{ roman(minor.level) }}
          </span>
        </div>
      </div>
      <div v-else class="bingxue empty">兵学未設定</div>

      <div class="skills">
        <SkillRow marker="主" :skill="uniqueSkill" :fallback-name="role.hero.unique_skill || '固有戦法なし'" />
        <SkillRow marker="2" :skill="role.skill1" fallback-name="戦法未設定" />
        <SkillRow marker="3" :skill="role.skill2" fallback-name="戦法未設定" />
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import HeroCard from '../HeroCard.vue'
import SkillRow from './AiResultSkillRow.vue'
import type { RoleData } from '../../composables/useLineups'
import { useData } from '../../composables/useData'

const props = defineProps<{
  title: string
  role: RoleData
}>()

const { skills } = useData()
const statDefinitions = [
  { key: 'lea', label: '統率' },
  { key: 'val', label: '武勇' },
  { key: 'int', label: '知略' },
  { key: 'pol', label: '政治' },
  { key: 'cha', label: '魅力' },
  { key: 'spd', label: '速度' },
] as const

const heroName = computed(() => props.role.hero?.name_jp || props.role.hero?.name || '未選択')
const maxBreakthrough = computed(() => Math.max(0, Math.min(5, Number(props.role.hero?.rarity) || 5)))
const uniqueSkill = computed(() => {
  const name = props.role.hero?.unique_skill
  if (!name) return null
  return skills.value.find((skill) => skill.name === name || skill.name_jp === name) ?? null
})
const statRows = computed(() => statDefinitions.map(({ key, label }) => {
  const value = Number(props.role.stats[key]) || 0
  const base = Number(props.role.hero?.stats?.[key]) || 0
  return { key, label, value, bonus: value - base }
}))
const bingxueClass = computed(() => {
  const direction = props.role.bingxue.direction
  if (direction === '武略') return 'martial'
  if (direction === '陣立') return 'formation'
  if (direction === '機略') return 'strategy'
  if (direction === '臨戦') return 'battle'
  return ''
})

const formatStat = (value: number): string => value.toFixed(2)
const formatBonus = (value: number): string => {
  if (Math.abs(value) < 0.005) return '+0'
  const formatted = Number.isInteger(value) ? value.toFixed(0) : value.toFixed(2)
  return value > 0 ? `+${formatted}` : formatted
}
const roman = (level: number): string => ['', 'I', 'II', 'III', 'IV', 'V'][level] ?? String(level)
</script>

<style scoped>
.result-role-card {
  min-width: 0;
  overflow: hidden;
  border: 1px solid #ddd3c5;
  border-radius: 6px;
  background: #fff;
}

.role-head {
  display: flex;
  min-height: 52px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 7px 9px;
  border-bottom: 1px solid #e4dbcf;
}

.role-head > div:first-child {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.role-head span {
  color: #8490a0;
  font-size: 11px;
  font-weight: 800;
}

.role-head strong {
  overflow: hidden;
  color: #263238;
  font-size: 15px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.breakthrough {
  display: flex;
  flex-shrink: 0;
  gap: 1px;
}

.breakthrough span {
  color: #c8ced5;
  font-size: 13px;
}

.breakthrough .filled {
  color: #e86b17;
}

.role-body {
  display: grid;
  gap: 8px;
  padding: 8px;
}

.portrait {
  width: 100%;
  aspect-ratio: 3 / 4;
  overflow: hidden;
  border: 0;
  box-shadow: none;
}

.stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  border: 1px solid #e1e5ea;
  border-radius: 5px;
  overflow: hidden;
  background: #e1e5ea;
  gap: 1px;
}

.stat-row {
  display: grid;
  grid-template-columns: auto minmax(38px, 1fr) auto;
  align-items: center;
  gap: 4px;
  min-width: 0;
  padding: 5px 6px;
  background: #fff;
  white-space: nowrap;
}

.stat-row span,
.stat-row small {
  color: #8a94a3;
  font-size: 10px;
}

.stat-row b {
  overflow: hidden;
  color: #263238;
  font-size: 11px;
  text-align: right;
  text-overflow: ellipsis;
}

.stat-row small.positive {
  color: #0a9f78;
}

.stat-row small.negative {
  color: #dc4b4b;
}

.bingxue {
  overflow: hidden;
  border: 1px solid #d5dae0;
  border-radius: 5px;
}

.bingxue-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 5px 7px;
  color: #fff;
  background: #788694;
}

.bingxue-head span {
  flex-shrink: 0;
  font-size: 10px;
  opacity: 0.8;
}

.bingxue-head b {
  overflow: hidden;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bingxue.martial .bingxue-head { background: #ef4d4d; }
.bingxue.formation .bingxue-head { background: #d77a00; }
.bingxue.strategy .bingxue-head { background: #9855d8; }
.bingxue.battle .bingxue-head { background: #12b981; }

.bingxue-minors {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1px;
  background: #e6e9ed;
}

.bingxue-minors span {
  overflow: hidden;
  padding: 4px 3px;
  color: #53606e;
  background: #f8fafb;
  font-size: 9px;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bingxue.empty {
  padding: 7px;
  border-style: dashed;
  color: #8a94a3;
  font-size: 11px;
  text-align: center;
}

.skills {
  display: grid;
  gap: 6px;
}
</style>
