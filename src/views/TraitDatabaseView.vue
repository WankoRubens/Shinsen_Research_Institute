<template>
  <div class="trait-db-page flex-1 min-h-0 overflow-y-auto p-3 md:p-5">
    <div class="mx-auto w-full max-w-[1500px]">
      <section class="trait-toolbar" aria-label="特性の検索と絞り込み">
        <label class="search-field">
          <el-icon :size="16"><Search /></el-icon>
          <input
            v-model="query"
            type="search"
            placeholder="特性名・効果・武将名を検索"
          />
        </label>

        <div class="rank-filter" role="group" aria-label="ランクで絞り込み">
          <button
            v-for="option in rankOptions"
            :key="option.value"
            type="button"
            :class="{ active: selectedRank === option.value }"
            @click="selectedRank = option.value"
          >
            {{ option.label }}
          </button>
        </div>

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
          <strong>{{ filteredTraits.length }}</strong> / {{ traitRows.length }} 特性
        </div>
      </section>

      <div class="trait-table-wrap">
        <table class="trait-table">
          <thead>
            <tr>
              <th class="rank-column">ランク</th>
              <th class="name-column">特性名</th>
              <th class="status-column">実装状況</th>
              <th>効果</th>
              <th class="heroes-column">所持武将</th>
              <th class="count-column">人数</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in filteredTraits" :key="row.name">
              <td data-label="ランク">
                <div class="rank-list">
                  <span
                    v-for="rank in row.ranks"
                    :key="rank"
                    class="rank-badge"
                    :class="`rank-${rank.toLowerCase()}`"
                  >
                    {{ rank }}
                  </span>
                </div>
              </td>
              <th scope="row" data-label="特性名">{{ row.name }}</th>
              <td data-label="実装状況">
                <span class="status-badge" :class="`status-${row.status}`">
                  {{ statusLabel(row.status) }}
                </span>
                <div class="status-detail">{{ row.implementationDetails.join('・') }}</div>
              </td>
              <td data-label="効果" class="description-cell">{{ row.description }}</td>
              <td data-label="所持武将">
                <div class="hero-list">
                  <span v-for="hero in row.heroes" :key="hero">{{ hero }}</span>
                </div>
              </td>
              <td data-label="人数" class="count-cell">{{ row.heroes.length }}</td>
            </tr>
            <tr v-if="filteredTraits.length === 0">
              <td colspan="6" class="empty-cell">条件に一致する特性がありません。</td>
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
import type { Trait } from '../composables/useData'
import { useData } from '../composables/useData'
import { useLocalizedGameData } from '../composables/useLocalizedGameData'
import { useTemplateParser } from '../composables/useTemplateParser'
import {
  traitImplementation,
  type TraitImplementationStatus,
} from '../lib/traitImplementation'

type TraitRank = Trait['rank']
type RankFilter = 'all' | TraitRank
type StatusFilter = 'all' | TraitImplementationStatus

interface TraitRow {
  name: string
  description: string
  ranks: TraitRank[]
  heroes: string[]
  status: TraitImplementationStatus
  implementationDetails: string[]
}

const rankPriority: Record<TraitRank, number> = { S: 0, A: 1, B: 2, C: 3 }
const rankOptions: Array<{ value: RankFilter; label: string }> = [
  { value: 'all', label: 'すべて' },
  { value: 'S', label: 'S' },
  { value: 'A', label: 'A' },
  { value: 'B', label: 'B' },
  { value: 'C', label: 'C' },
]
const statusOptions: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'すべて' },
  { value: 'implemented', label: '実装済み' },
  { value: 'partial', label: '一部実装' },
  { value: 'unimplemented', label: '未実装' },
]

const query = ref('')
const selectedRank = ref<RankFilter>('all')
const selectedStatus = ref<StatusFilter>('all')
const { heroes } = useData()
const { traitName, traitDescription } = useLocalizedGameData()
const { parseTextToPlain } = useTemplateParser()

const plainDescription = (trait: Trait): string => {
  const description = traitDescription(trait)
  return description ? parseTextToPlain(description, false, trait.vars) : '説明データがありません。'
}

// heroes.json は武将ごとに特性を持つため、同名特性を1行へ集約して所持武将をまとめる。
const traitRows = computed<TraitRow[]>(() => {
  const rows = new Map<string, {
    name: string
    description: string
    ranks: Set<TraitRank>
    heroes: Set<string>
    implementationStatuses: Set<Exclude<TraitImplementationStatus, 'partial'>>
    implementationDetails: Set<string>
  }>()

  heroes.value.forEach((hero) => {
    const heroName = hero.name_jp || hero.name
    ;(hero.traits ?? []).forEach((trait) => {
      const name = traitName(trait)
      if (!name) return
      const existing = rows.get(name) ?? {
        name,
        description: '',
        ranks: new Set<TraitRank>(),
        heroes: new Set<string>(),
        implementationStatuses: new Set<Exclude<TraitImplementationStatus, 'partial'>>(),
        implementationDetails: new Set<string>(),
      }
      const description = plainDescription(trait)
      if (!existing.description || existing.description === '説明データがありません。') {
        existing.description = description
      }
      existing.ranks.add(trait.rank)
      existing.heroes.add(heroName)
      const implementation = traitImplementation(trait)
      existing.implementationStatuses.add(implementation.status)
      existing.implementationDetails.add(implementation.detail)
      rows.set(name, existing)
    })
  })

  return [...rows.values()]
    .map((row) => ({
      name: row.name,
      description: row.description || '説明データがありません。',
      ranks: [...row.ranks].sort((a, b) => rankPriority[a] - rankPriority[b]),
      heroes: [...row.heroes].sort((a, b) => a.localeCompare(b, 'ja')),
      status: row.implementationStatuses.size > 1
        ? 'partial'
        : row.implementationStatuses.has('implemented') ? 'implemented' : 'unimplemented',
      implementationDetails: [...row.implementationDetails],
    }))
    .sort((a, b) => {
      const rankDifference = rankPriority[a.ranks[0] ?? 'C'] - rankPriority[b.ranks[0] ?? 'C']
      return rankDifference || a.name.localeCompare(b.name, 'ja')
    })
})

const filteredTraits = computed(() => {
  const keyword = query.value.trim().toLocaleLowerCase('ja')
  return traitRows.value.filter((row) => {
    if (selectedRank.value !== 'all' && !row.ranks.includes(selectedRank.value)) return false
    if (selectedStatus.value !== 'all' && row.status !== selectedStatus.value) return false
    if (!keyword) return true
    return [row.name, row.description, ...row.heroes]
      .join(' ')
      .toLocaleLowerCase('ja')
      .includes(keyword)
  })
})

const statusLabel = (status: TraitImplementationStatus): string => ({
  implemented: '実装済み',
  partial: '一部実装',
  unimplemented: '未実装',
})[status]
</script>

<style scoped>
.trait-db-page {
  background:
    linear-gradient(90deg, rgba(184, 134, 11, 0.04) 1px, transparent 1px),
    linear-gradient(rgba(31, 41, 51, 0.035) 1px, transparent 1px),
    #f6f1e8;
  background-size: 28px 28px, 28px 28px, auto;
}

.trait-toolbar {
  display: grid;
  grid-template-columns: minmax(240px, 1fr) auto auto auto;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.search-field {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 38px;
  border: 1px solid #cdbb8e;
  background: #fffaf0;
  padding: 0 11px;
  color: #8c7650;
}

.search-field input {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: #1f2933;
  font-size: 14px;
}

.rank-filter,
.status-filter {
  display: flex;
  border: 1px solid #cdbb8e;
  background: #fffaf0;
}

.rank-filter button,
.status-filter button {
  min-width: 42px;
  min-height: 36px;
  border-right: 1px solid #e1d4b2;
  padding: 0 10px;
  color: #6b5b36;
  font-size: 13px;
  font-weight: 700;
}

.rank-filter button:last-child,
.status-filter button:last-child { border-right: 0; }
.rank-filter button.active,
.status-filter button.active { background: #b86b13; color: #fff; }

.result-count {
  color: #6b5b36;
  font-size: 13px;
  white-space: nowrap;
}

.result-count strong { color: #a34f0b; font-size: 18px; }

.trait-table-wrap {
  overflow: auto;
  border: 1px solid #cdbb8e;
  background: #fffaf0;
  box-shadow: 0 2px 8px rgba(76, 55, 17, 0.08);
}

.trait-table {
  width: 100%;
  min-width: 900px;
  border-collapse: collapse;
  table-layout: fixed;
}

.trait-table th,
.trait-table td {
  border-bottom: 1px solid #e1d4b2;
  padding: 11px 12px;
  text-align: left;
  vertical-align: top;
  color: #3f392f;
  font-size: 13px;
  line-height: 1.6;
}

.trait-table thead th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: #eee2c8;
  color: #493b21;
  font-size: 12px;
  font-weight: 800;
}

.trait-table tbody th { color: #1f2933; font-size: 14px; }
.trait-table tbody tr:last-child th,
.trait-table tbody tr:last-child td { border-bottom: 0; }
.trait-table tbody tr:hover { background: #fff7e5; }

.rank-column { width: 78px; }
.name-column { width: 170px; }
.status-column { width: 132px; }
.heroes-column { width: 330px; }
.count-column { width: 64px; text-align: center !important; }
.count-cell { text-align: center !important; font-weight: 800; color: #a34f0b !important; }
.description-cell { white-space: pre-line; }

.rank-list,
.hero-list { display: flex; flex-wrap: wrap; gap: 5px; }

.rank-badge {
  display: inline-grid;
  place-items: center;
  min-width: 27px;
  height: 23px;
  border: 1px solid;
  font-size: 12px;
  font-weight: 800;
}

.rank-s { border-color: #d6a91f; background: #fff3bd; color: #815500; }
.rank-a { border-color: #aa85c9; background: #f2e8fa; color: #69408c; }
.rank-b { border-color: #78a7ca; background: #e8f3fb; color: #285f87; }
.rank-c { border-color: #aeb5bc; background: #f1f3f5; color: #58616a; }

.status-badge {
  display: inline-block;
  border: 1px solid;
  padding: 2px 7px;
  font-size: 12px;
  font-weight: 800;
  white-space: nowrap;
}

.status-implemented { border-color: #71ad80; background: #e8f6eb; color: #27693a; }
.status-partial { border-color: #d7a84e; background: #fff4d8; color: #815a0c; }
.status-unimplemented { border-color: #b8bec5; background: #f1f3f5; color: #616971; }
.status-detail { margin-top: 4px; color: #746953; font-size: 11px; line-height: 1.4; }

.hero-list span {
  border-left: 2px solid #d7bb77;
  padding-left: 6px;
  color: #4f6070;
  white-space: nowrap;
}

.empty-cell { padding: 48px 16px !important; text-align: center !important; color: #8c7650 !important; }

@media (max-width: 760px) {
  .trait-toolbar { grid-template-columns: 1fr; gap: 8px; }
  .rank-filter { width: 100%; }
  .status-filter { width: 100%; }
  .rank-filter button,
  .status-filter button { flex: 1; min-width: 0; padding: 0 6px; }
  .result-count { text-align: right; }
  .trait-table-wrap { border-left: 0; border-right: 0; }
  .trait-table { min-width: 930px; }
  .heroes-column { width: 270px; }
}
</style>
