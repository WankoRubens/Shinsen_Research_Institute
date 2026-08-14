<template>
  <div class="skill-db-page flex-1 min-h-0 overflow-y-auto p-3 md:p-5">
    <div class="mx-auto w-full max-w-[1600px]">
      <section class="skill-toolbar" aria-label="戦法の検索と絞り込み">
        <label class="search-field">
          <el-icon :size="16"><Search /></el-icon>
          <input
            v-model="query"
            type="search"
            placeholder="戦法名・効果・武将名を検索"
          />
        </label>

        <label class="type-filter">
          <span>種類</span>
          <select v-model="selectedType" aria-label="戦法タイプで絞り込み">
            <option value="all">すべて</option>
            <option v-for="type in BATTLE_SKILL_TYPE_PRIORITY" :key="type" :value="type">
              {{ type }}
            </option>
          </select>
        </label>

        <div class="status-filter" role="group" aria-label="実装状況で絞り込み">
          <button
            v-for="option in statusOptions"
            :key="option.value"
            type="button"
            :class="{ active: selectedStatus === option.value }"
            @click="selectedStatus = option.value"
          >
            {{ option.label }}
          </button>
        </div>

        <div class="result-count">
          <strong>{{ filteredSkills.length }}</strong> / {{ skillRows.length }} 戦法
        </div>
      </section>

      <div class="skill-table-wrap">
        <table class="skill-table">
          <thead>
            <tr>
              <th class="name-column">戦法名</th>
              <th class="type-column">種類</th>
              <th class="rate-column">発動率</th>
              <th class="status-column">実装状況</th>
              <th>効果（最大Lv）</th>
              <th class="source-column">由来</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in filteredSkills" :key="row.name">
              <th scope="row" data-label="戦法名">
                <div class="skill-name">{{ row.name }}</div>
                <span class="rarity-badge" :data-rarity="row.rarity">{{ row.rarity }}</span>
              </th>
              <td data-label="種類">
                <span class="type-badge" :data-type="row.type">{{ row.type }}</span>
              </td>
              <td data-label="発動率" class="rate-cell">{{ row.activationRate }}</td>
              <td data-label="実装状況">
                <span class="status-badge" :class="`status-${row.status}`">
                  {{ statusLabel(row.status) }}
                </span>
                <div class="status-detail">{{ row.implementationDetail }}</div>
              </td>
              <td data-label="効果（最大Lv）" class="description-cell">{{ row.description }}</td>
              <td data-label="由来">
                <div class="source-info">
                  <span class="origin-badge">{{ row.origin }}</span>
                  <span v-if="row.eventMaterial" class="event-material">
                    <strong>必要素材</strong>{{ row.eventMaterial }}
                  </span>
                  <span v-else-if="row.sourceHero">{{ row.sourceHero }}</span>
                </div>
              </td>
            </tr>
            <tr v-if="filteredSkills.length === 0" class="empty-row">
              <td colspan="6" class="empty-cell">条件に一致する戦法がありません。</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Search } from '@element-plus/icons-vue'
import { eventSkillMaterial } from '../constants/eventSkillMaterials'
import { formatRate } from '../constants/gameData'
import type { Skill } from '../composables/useData'
import { useData } from '../composables/useData'
import { useLocalizedGameData } from '../composables/useLocalizedGameData'
import { useTemplateParser } from '../composables/useTemplateParser'
import {
  BATTLE_SKILL_TYPE_PRIORITY,
  battleSkillImplementation,
  battleSkillType,
  type BattleSkillImplementationStatus,
  type BattleSkillType,
} from '../lib/battleSkillEffects'

type StatusFilter = 'all' | BattleSkillImplementationStatus
type TypeFilter = 'all' | BattleSkillType

interface SkillRow {
  name: string
  rarity: string
  type: BattleSkillType
  activationRate: string
  description: string
  sourceHero: string
  searchHeroes: string[]
  eventMaterial: string
  origin: string
  status: BattleSkillImplementationStatus
  implementationDetail: string
}

const statusOptions: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'すべて' },
  { value: 'implemented', label: '実装済み' },
  { value: 'partial', label: '一部実装' },
  { value: 'unimplemented', label: '未実装' },
]

const query = ref('')
const selectedType = ref<TypeFilter>('all')
const selectedStatus = ref<StatusFilter>('all')
const { heroes, skills } = useData()
const {
  heroName,
  skillName,
  skillDescription,
  skillCommanderDescription,
} = useLocalizedGameData()
const { parseTextToPlain } = useTemplateParser()

const heroNames = computed(() => new Map(
  heroes.value.flatMap((hero) => {
    const displayName = heroName(hero)
    return [hero.name, hero.name_jp, ...(hero.aliases ?? [])]
      .filter((name): name is string => Boolean(name))
      .map((name) => [name, displayName] as const)
  }),
))

// 固有・伝授・編成戦法の参照先から、各戦法に関係する武将名を検索用に逆引きする。
const skillHeroSearchNames = computed(() => {
  const canonicalSkillNames = new Map<string, string>()
  skills.value.forEach((skill) => {
    const canonicalName = skillName(skill)
    ;[skill.name, skill.name_jp, ...(skill.aliases ?? [])]
      .filter((name): name is string => Boolean(name))
      .forEach((name) => canonicalSkillNames.set(name, canonicalName))
  })

  const relatedHeroes = new Map<string, Set<string>>()
  heroes.value.forEach((hero) => {
    const searchableHeroNames = [hero.name, hero.name_jp, ...(hero.aliases ?? [])]
      .filter((name): name is string => Boolean(name))
    ;[hero.unique_skill, hero.teachable_skill, hero.assembly_skill]
      .filter((name): name is string => Boolean(name))
      .forEach((reference) => {
        const canonicalName = canonicalSkillNames.get(reference)
        if (!canonicalName) return
        const names = relatedHeroes.get(canonicalName) ?? new Set<string>()
        searchableHeroNames.forEach((name) => names.add(name))
        relatedHeroes.set(canonicalName, names)
      })
  })

  return new Map([...relatedHeroes].map(([name, related]) => [name, [...related]]))
})

const plainDescription = (skill: Skill): string => {
  const main = skillDescription(skill)
  const commander = skillCommanderDescription(skill)
  const parts = [
    main ? parseTextToPlain(main, true, skill.vars) : '',
    commander ? `大将効果：${parseTextToPlain(commander, true, skill.vars)}` : '',
  ].filter(Boolean)
  return parts.join('\n') || '説明データがありません。'
}

const sourceHeroName = (skill: Skill): string => {
  const source = skill.unique_hero || skill.source_hero || ''
  return heroNames.value.get(source) || source
}

const originLabel = (skill: Skill): string => {
  if (skill.is_unique) return '固有'
  if (skill.is_event_skill) return '事件'
  if (skill.is_teachable) return '伝授'
  if (skill.is_fixed) return '固定'
  return '汎用'
}

const skillRows = computed<SkillRow[]>(() => skills.value
  .map((skill) => {
    const implementation = battleSkillImplementation(skill)
    const name = skillName(skill)
    return {
      name,
      rarity: skill.rarity || '-',
      type: battleSkillType(skill),
      activationRate: formatRate(skill.activation_rate, true) || '100%',
      description: plainDescription(skill),
      sourceHero: sourceHeroName(skill),
      searchHeroes: skillHeroSearchNames.value.get(name) ?? [],
      eventMaterial: eventSkillMaterial(skill),
      origin: originLabel(skill),
      status: implementation.status,
      implementationDetail: implementation.detail,
    }
  })
  .sort((a, b) => {
    const typeOrder = BATTLE_SKILL_TYPE_PRIORITY.indexOf(a.type) - BATTLE_SKILL_TYPE_PRIORITY.indexOf(b.type)
    if (typeOrder !== 0) return typeOrder
    return a.name.localeCompare(b.name, 'ja')
  }))

const filteredSkills = computed(() => {
  const keyword = query.value.trim().toLocaleLowerCase('ja')
  return skillRows.value.filter((row) => {
    if (selectedType.value !== 'all' && row.type !== selectedType.value) return false
    if (selectedStatus.value !== 'all' && row.status !== selectedStatus.value) return false
    if (!keyword) return true
    return [row.name, row.description, row.sourceHero, ...row.searchHeroes, row.type]
      .join(' ')
      .toLocaleLowerCase('ja')
      .includes(keyword)
  })
})

const statusLabel = (status: BattleSkillImplementationStatus): string => ({
  implemented: '実装済み',
  partial: '一部実装',
  unimplemented: '未実装',
})[status]
</script>

<style scoped>
.skill-db-page {
  background:
    linear-gradient(90deg, rgba(184, 134, 11, 0.04) 1px, transparent 1px),
    linear-gradient(rgba(31, 41, 51, 0.035) 1px, transparent 1px),
    #f6f1e8;
  background-size: 28px 28px, 28px 28px, auto;
}

.skill-toolbar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: grid;
  grid-template-columns: minmax(260px, 1fr) 150px auto auto;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  margin-bottom: 12px;
  background: #f6f1e8;
  box-shadow: 0 8px 12px -12px rgba(76, 55, 17, 0.55);
}

.search-field,
.type-filter {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 38px;
  border: 1px solid #cdbb8e;
  background: #fffaf0;
  padding: 0 11px;
  color: #8c7650;
}

.search-field input,
.type-filter select {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: #1f2933;
  font-size: 14px;
}

.type-filter span {
  flex: 0 0 auto;
  font-size: 12px;
  font-weight: 800;
}

.status-filter {
  display: flex;
  border: 1px solid #cdbb8e;
  background: #fffaf0;
}

.status-filter button {
  min-width: 42px;
  min-height: 36px;
  border-right: 1px solid #e1d4b2;
  padding: 0 10px;
  color: #6b5b36;
  font-size: 13px;
  font-weight: 700;
}

.status-filter button:last-child { border-right: 0; }
.status-filter button.active { background: #b86b13; color: #fff; }

.result-count {
  color: #6b5b36;
  font-size: 13px;
  white-space: nowrap;
}

.result-count strong { color: #a34f0b; font-size: 18px; }

.skill-table-wrap {
  overflow: auto;
  border: 1px solid #cdbb8e;
  background: #fffaf0;
  box-shadow: 0 2px 8px rgba(76, 55, 17, 0.08);
}

.skill-table {
  width: 100%;
  min-width: 1120px;
  border-collapse: collapse;
  table-layout: fixed;
}

.skill-table th,
.skill-table td {
  border-bottom: 1px solid #e1d4b2;
  padding: 11px 12px;
  text-align: left;
  vertical-align: top;
  color: #3f392f;
  font-size: 13px;
  line-height: 1.6;
}

.skill-table thead th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: #eee2c8;
  color: #493b21;
  font-size: 12px;
  font-weight: 800;
}

.skill-table tbody th { color: #1f2933; font-size: 14px; }
.skill-table tbody tr:last-child th,
.skill-table tbody tr:last-child td { border-bottom: 0; }
.skill-table tbody tr:hover { background: #fff7e5; }

.name-column { width: 170px; }
.type-column { width: 86px; }
.rate-column { width: 82px; }
.status-column { width: 150px; }
.source-column { width: 170px; }
.skill-name { margin-bottom: 5px; }
.description-cell { white-space: pre-line; }
.rate-cell { color: #a34f0b !important; font-weight: 800; }

.rarity-badge,
.type-badge,
.origin-badge,
.status-badge {
  display: inline-block;
  border: 1px solid;
  padding: 2px 7px;
  font-size: 11px;
  font-weight: 800;
  line-height: 1.4;
  white-space: nowrap;
}

.rarity-badge[data-rarity="S"] { border-color: #d8a514; background: #fff4bd; color: #765400; }
.rarity-badge[data-rarity="A"] { border-color: #9b7abb; background: #f1e9f8; color: #65417e; }
.rarity-badge { border-color: #aeb6bf; background: #f1f3f5; color: #606a73; }

.type-badge[data-type="受動"] { border-color: #89939d; background: #eef1f3; color: #4d5964; }
.type-badge[data-type="兵種"] { border-color: #4d91bd; background: #e6f4fb; color: #276480; }
.type-badge[data-type="指揮"] { border-color: #bf8d37; background: #fff1d6; color: #74500d; }
.type-badge[data-type="陣法"] { border-color: #8972b0; background: #f0ebf8; color: #59447d; }
.type-badge[data-type="能動"] { border-color: #4b9b71; background: #e8f6ee; color: #246541; }
.type-badge[data-type="突撃"] { border-color: #c46b61; background: #faece9; color: #81392f; }

.status-implemented { border-color: #71ad80; background: #e8f6eb; color: #27693a; }
.status-partial { border-color: #d7a84e; background: #fff4d8; color: #815a0c; }
.status-unimplemented { border-color: #b8bec5; background: #f1f3f5; color: #616971; }
.status-detail { margin-top: 4px; color: #746953; font-size: 11px; line-height: 1.4; }

.source-info {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  color: #4f6070;
}

.event-material {
  display: grid;
  gap: 2px;
  line-height: 1.45;
}

.event-material strong {
  color: #8b4d13;
  font-size: 11px;
}

.origin-badge { border-color: #d7bb77; background: #fff6df; color: #765412; }
.empty-cell { padding: 48px 16px !important; text-align: center !important; color: #8c7650 !important; }

@media (max-width: 980px) {
  .skill-toolbar { grid-template-columns: minmax(220px, 1fr) 150px; gap: 8px; }
  .result-count { text-align: right; }
}

@media (max-width: 620px) {
  .skill-toolbar { top: -12px; grid-template-columns: 1fr; }
  .status-filter { width: 100%; }
  .status-filter button { flex: 1; min-width: 0; padding: 0 5px; }
  .result-count { text-align: right; }

  .skill-table-wrap {
    overflow: visible;
    border: 0;
    background: transparent;
    box-shadow: none;
  }

  .skill-table {
    display: block;
    min-width: 0;
  }

  .skill-table thead { display: none; }

  .skill-table tbody {
    display: grid;
    gap: 8px;
  }

  .skill-table tbody tr {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr);
    grid-template-areas:
      "name type"
      "rate status"
      "description description"
      "source source";
    border: 1px solid #cdbb8e;
    background: #fffaf0;
    box-shadow: 0 2px 6px rgba(76, 55, 17, 0.06);
  }

  .skill-table tbody th,
  .skill-table tbody td {
    min-width: 0;
    border-bottom: 0;
    padding: 9px 10px;
    overflow-wrap: anywhere;
  }

  .skill-table tbody th {
    grid-area: name;
    font-size: 16px;
  }

  .skill-table td[data-label="種類"] {
    grid-area: type;
    text-align: right;
  }

  .skill-table td[data-label="発動率"] {
    grid-area: rate;
  }

  .skill-table td[data-label="実装状況"] {
    grid-area: status;
  }

  .skill-table td[data-label="効果（最大Lv）"] {
    grid-area: description;
    border-top: 1px solid #eadfc4;
  }

  .skill-table td[data-label="由来"] {
    grid-area: source;
    border-top: 1px solid #eadfc4;
  }

  .skill-table td[data-label="発動率"]::before,
  .skill-table td[data-label="実装状況"]::before,
  .skill-table td[data-label="効果（最大Lv）"]::before,
  .skill-table td[data-label="由来"]::before {
    content: attr(data-label);
    display: block;
    margin-bottom: 4px;
    color: #8b6a2c;
    font-size: 11px;
    font-weight: 800;
  }

  .skill-table .source-info { flex-wrap: wrap; }
  .skill-table tbody tr.empty-row { display: block; }
  .skill-table .empty-cell { display: block; }
}
</style>
