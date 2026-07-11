<template>
  <div class="hero-db-page flex-1 min-h-0 p-3 md:p-5">
    <div class="h-full grid grid-rows-[auto_minmax(0,1fr)] gap-3 min-h-0">
      <header class="rounded border border-[#d9c799] bg-[#fffaf0]/90 px-4 py-3 shadow-sm">
        <div class="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
          <div>
            <p class="text-xs font-bold text-[#a87918]">信長の野望 真戦</p>
            <h1 class="text-xl md:text-2xl font-bold text-[#1f2933]">武将データベース</h1>
          </div>
          <p class="text-xs md:text-sm text-[#6b5b36]">
            属性値・固有戦法・特性・ラベルで武将を確認できます。
          </p>
        </div>
      </header>

      <div class="min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-3">
        <div class="h-full rounded border border-[#d9c799] bg-[#fffaf0]/95 shadow-sm overflow-hidden min-h-[360px]">
        <HeroLibrary
          class="hero-library-washi"
          mode="browse"
          :used-heroes="emptyUsedHeroes"
          :owned-heroes="[]"
          :filter-owned="false"
          :show-troop-filter="false"
          :show-label-filter="true"
          v-model:selected-label="selectedLabel"
          @browse="selectHero"
        />
        </div>

      <aside class="rounded border border-[#d9c799] bg-[#fffaf0]/95 shadow-sm overflow-y-auto">
        <div v-if="selectedHero" class="p-4 space-y-4">
          <div class="grid grid-cols-[96px_minmax(0,1fr)] gap-3">
            <img
              :src="selectedHero.portrait"
              class="w-24 h-32 rounded border border-[#d9c799] object-cover object-top bg-[#eee2c8]"
              loading="lazy"
            />
            <div class="min-w-0 flex-1 flex flex-col">
              <div class="flex items-center gap-2 mb-1">
                <span class="text-lg font-bold text-[#1f2933] truncate">{{ selectedHero.name }}</span>
                <span
                  class="text-xs font-bold px-1.5 py-0.5 rounded text-white"
                  :class="rarityClass(selectedHero.rarity)"
                >
                  {{ rarityLabel(selectedHero.rarity) }}
                </span>
              </div>
              <div class="text-sm text-[#6b5b36]">Cost {{ selectedHero.cost }}</div>
              <div class="text-sm text-[#6b5b36]">
                {{ selectedHero.faction || '勢力不明' }}
                <span v-if="selectedHero.clan"> / {{ selectedHero.clan }}</span>
              </div>
              <div v-if="selectedLabels.length" class="flex flex-wrap gap-1 mt-2">
                <span
                  v-for="label in selectedLabels"
                  :key="label"
                  class="rounded border border-[#d4a536] bg-[#fff3c4] px-1.5 py-0.5 text-xs font-bold text-[#7a4d05]"
                >
                  {{ label }}
                </span>
              </div>
              <a
                v-if="selectedHero.detail_url"
                :href="selectedHero.detail_url"
                target="_blank"
                rel="noreferrer"
                class="inline-block mt-2 text-xs font-bold text-[#8a5a0a] hover:underline"
              >
                参照ページ
              </a>
              <div class="grid grid-cols-2 gap-1.5 mt-3">
                <div
                  v-for="key in profileStatKeys"
                  :key="key"
                  class="rounded border border-[#e1d4b2] bg-[#f8efd9] px-2 py-1.5"
                >
                  <div class="text-[11px] text-[#8c7650]">{{ statLabels[key] }}</div>
                  <div class="text-sm font-bold text-[#1f2933]">{{ formatStat(selectedHero.stats?.[key]) }}</div>
                </div>
              </div>
            </div>
          </div>

          <section>
            <h3 class="text-sm font-bold text-[#1f2933] mb-2 border-l-4 border-[#b8860b] pl-2">固有戦法</h3>
            <div class="rounded border border-[#d9c799] bg-[#f8efd9] p-3">
              <div class="flex items-center justify-between gap-2 mb-2">
                <div class="font-bold text-[#1f2933]">{{ uniqueSkill?.name_jp || uniqueSkill?.name || selectedHero.unique_skill || '---' }}</div>
                <span v-if="uniqueSkill?.type" class="text-xs rounded bg-[#fffaf0] border border-[#d4a536] px-1.5 py-0.5 text-[#7a4d05]">
                  {{ uniqueSkill.type }}
                </span>
              </div>
              <SkillDescription
                v-if="uniqueSkill"
                :description="displaySkillDescription(uniqueSkill)"
                :commander-description="displaySkillCommanderDescription(uniqueSkill)"
                :vars="uniqueSkill.vars"
                :is-max-level="true"
              />
              <p v-else class="text-sm text-[#8c7650]">固有戦法の詳細データがありません。</p>
            </div>
          </section>

          <section>
            <h3 class="text-sm font-bold text-[#1f2933] mb-2 border-l-4 border-[#b8860b] pl-2">特性</h3>
            <div v-if="selectedHero.traits?.length" class="space-y-2">
              <div
                v-for="trait in selectedHero.traits"
                :key="trait.name"
                class="rounded border border-[#e1d4b2] bg-[#fffaf0] p-2"
              >
                <div class="flex items-center gap-2">
                  <span class="text-xs font-bold rounded px-1.5 py-0.5 border" :class="traitRankClass(trait.rank)">
                    {{ trait.rank }}
                  </span>
                  <span class="font-bold text-sm text-[#1f2933]">{{ displayTraitName(trait) }}</span>
                </div>
                <p class="mt-1 text-xs leading-relaxed text-[#5c5140]">
                  {{ traitDescription(trait) }}
                </p>
              </div>
            </div>
            <p v-else class="text-sm text-[#8c7650]">特性データがありません。</p>
          </section>
        </div>

        <div v-else class="h-full min-h-[280px] flex items-center justify-center p-6 text-sm text-[#8c7650] text-center">
          武将を選択すると属性値、固有戦法、特性を表示します。
        </div>
      </aside>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import HeroLibrary from '../components/HeroLibrary.vue'
import SkillDescription from '../components/SkillDescription.vue'
import type { Hero, Skill, Trait } from '../composables/useData'
import { useData } from '../composables/useData'
import { useLocalizedGameData } from '../composables/useLocalizedGameData'
import { useTemplateParser } from '../composables/useTemplateParser'
import { heroLabels } from '../lib/heroLabels'

type StatKey = 'lea' | 'val' | 'int' | 'pol' | 'cha' | 'spd'

const emptyUsedHeroes = new Set<string>()
const selectedHero = ref<Hero | null>(null)
const selectedLabel = ref('')
const { skills } = useData()
const { parseTextToPlain } = useTemplateParser()
const {
  skillDescription: displaySkillDescription,
  skillCommanderDescription: displaySkillCommanderDescription,
  traitName: displayTraitName,
  traitDescription: displayTraitDescription,
} = useLocalizedGameData()

const profileStatKeys: StatKey[] = ['val', 'pol', 'int', 'cha', 'lea', 'spd']
const statLabels: Record<StatKey, string> = {
  lea: '統率',
  val: '武勇',
  int: '知略',
  pol: '政治',
  cha: '魅力',
  spd: '速度',
}

const formatStat = (value: number | string | null | undefined) => {
  if (value === null || value === undefined || value === '') return '-'
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric.toFixed(2) : String(value)
}

const selectedLabels = computed(() => heroLabels(selectedHero.value))

const uniqueSkill = computed<Skill | null>(() => {
  const name = selectedHero.value?.unique_skill
  if (!name) return null
  return skills.value.find((skill) =>
    skill.name === name ||
    skill.name_jp === name ||
    skill.aliases?.includes(name)
  ) ?? null
})

const selectHero = (hero: Hero) => {
  selectedHero.value = hero
}

const rarityLabel = (rarity: number | string) => {
  const value = Number(rarity)
  if (value === 5) return 'S'
  if (value === 4) return 'A'
  return `R${rarity}`
}

const rarityClass = (rarity: number | string) => {
  const value = Number(rarity)
  if (value === 5) return 'bg-yellow-500'
  if (value === 4) return 'bg-purple-500'
  return 'bg-blue-500'
}

const traitRankClass = (rank: string) => {
  if (rank === 'S') return 'bg-yellow-50 text-yellow-700 border-yellow-200'
  if (rank === 'A') return 'bg-purple-50 text-purple-700 border-purple-200'
  if (rank === 'B') return 'bg-blue-50 text-blue-700 border-blue-200'
  return 'bg-gray-50 text-gray-600 border-gray-200'
}

const traitDescription = (trait: Trait) => {
  const description = displayTraitDescription(trait)
  if (!description) return '説明データがありません。'
  return parseTextToPlain(description, false, trait.vars)
}
</script>

<style scoped>
.hero-db-page {
  background:
    linear-gradient(90deg, rgba(184, 134, 11, 0.04) 1px, transparent 1px),
    linear-gradient(rgba(31, 41, 51, 0.035) 1px, transparent 1px),
    #f6f1e8;
  background-size: 28px 28px, 28px 28px, auto;
}

.hero-library-washi :deep(.border-gray-100),
.hero-library-washi :deep(.border-gray-200),
.hero-library-washi :deep(.border-gray-300) {
  border-color: #d9c799;
}

.hero-library-washi :deep(.text-gray-400),
.hero-library-washi :deep(.text-gray-500),
.hero-library-washi :deep(.text-gray-600) {
  color: #6b5b36;
}

.hero-library-washi :deep(.bg-white) {
  background-color: #fffaf0;
}

.hero-library-washi :deep(.bg-slate-50),
.hero-library-washi :deep(.bg-gray-100) {
  background-color: #f8efd9;
}

.hero-library-washi :deep(button) {
  border-radius: 4px;
}

.hero-library-washi :deep(.el-input__wrapper) {
  background-color: #fffaf0;
  border: 1px solid #d9c799;
  box-shadow: none;
}
</style>
