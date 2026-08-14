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
              <th class="name-column">特性名</th>
              <th class="status-column">実装状況</th>
              <th>効果</th>
              <th class="heroes-column">所持武将</th>
              <th class="count-column">人数</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in filteredTraits" :key="row.name">
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
            <tr v-if="filteredTraits.length === 0" class="empty-row">
              <td colspan="5" class="empty-cell">条件に一致する特性がありません。</td>
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

type StatusFilter = 'all' | TraitImplementationStatus

interface TraitRow {
  name: string
  description: string
  heroes: string[]
  searchHeroes: string[]
  status: TraitImplementationStatus
  implementationDetails: string[]
}

const statusOptions: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'すべて' },
  { value: 'implemented', label: '実装済み' },
  { value: 'partial', label: '一部実装' },
  { value: 'unimplemented', label: '未実装' },
]

const query = ref('')
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
    heroes: Set<string>
    searchHeroes: Set<string>
    implementationStatuses: Set<Exclude<TraitImplementationStatus, 'partial'>>
    implementationDetails: Set<string>
  }>()

  heroes.value.forEach((hero) => {
    const heroName = hero.name_jp || hero.name
    const searchableHeroNames = [hero.name, hero.name_jp, ...(hero.aliases ?? [])]
      .filter((name): name is string => Boolean(name))
    ;(hero.traits ?? []).forEach((trait) => {
      const name = traitName(trait)
      if (!name) return
      const existing = rows.get(name) ?? {
        name,
        description: '',
        heroes: new Set<string>(),
        searchHeroes: new Set<string>(),
        implementationStatuses: new Set<Exclude<TraitImplementationStatus, 'partial'>>(),
        implementationDetails: new Set<string>(),
      }
      const description = plainDescription(trait)
      if (!existing.description || existing.description === '説明データがありません。') {
        existing.description = description
      }
      existing.heroes.add(heroName)
      searchableHeroNames.forEach((name) => existing.searchHeroes.add(name))
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
      heroes: [...row.heroes].sort((a, b) => a.localeCompare(b, 'ja')),
      searchHeroes: [...row.searchHeroes],
      status: row.implementationStatuses.size > 1
        ? 'partial'
        : row.implementationStatuses.has('implemented') ? 'implemented' : 'unimplemented',
      implementationDetails: [...row.implementationDetails],
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ja'))
})

const filteredTraits = computed(() => {
  const keyword = query.value.trim().toLocaleLowerCase('ja')
  return traitRows.value.filter((row) => {
    if (selectedStatus.value !== 'all' && row.status !== selectedStatus.value) return false
    if (!keyword) return true
    return [row.name, row.description, ...row.searchHeroes]
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
  position: sticky;
  top: 0;
  z-index: 10;
  display: grid;
  grid-template-columns: minmax(240px, 1fr) auto auto;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  margin-bottom: 12px;
  background: #f6f1e8;
  box-shadow: 0 8px 12px -12px rgba(76, 55, 17, 0.55);
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

.name-column { width: 170px; }
.status-column { width: 132px; }
.heroes-column { width: 330px; }
.count-column { width: 64px; text-align: center !important; }
.count-cell { text-align: center !important; font-weight: 800; color: #a34f0b !important; }
.description-cell { white-space: pre-line; }

.hero-list { display: flex; flex-wrap: wrap; gap: 5px; }

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
  .trait-toolbar { top: -12px; grid-template-columns: 1fr; gap: 8px; }
  .status-filter { width: 100%; }
  .status-filter button { flex: 1; min-width: 0; padding: 0 6px; }
  .result-count { text-align: right; }

  .trait-table-wrap {
    overflow: visible;
    border: 0;
    background: transparent;
    box-shadow: none;
  }

  .trait-table {
    display: block;
    min-width: 0;
  }

  .trait-table thead { display: none; }

  .trait-table tbody {
    display: grid;
    gap: 8px;
  }

  .trait-table tbody tr {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      "name status"
      "description description"
      "heroes count";
    border: 1px solid #cdbb8e;
    background: #fffaf0;
    box-shadow: 0 2px 6px rgba(76, 55, 17, 0.06);
  }

  .trait-table tbody th,
  .trait-table tbody td {
    min-width: 0;
    border-bottom: 0;
    padding: 9px 10px;
    overflow-wrap: anywhere;
  }

  .trait-table tbody th {
    grid-area: name;
    align-self: center;
    font-size: 16px;
  }

  .trait-table td[data-label="実装状況"] {
    grid-area: status;
    text-align: right;
  }

  .trait-table td[data-label="効果"] {
    grid-area: description;
    border-top: 1px solid #eadfc4;
  }

  .trait-table td[data-label="所持武将"] {
    grid-area: heroes;
    border-top: 1px solid #eadfc4;
  }

  .trait-table td[data-label="人数"] {
    grid-area: count;
    align-self: stretch;
    display: flex;
    align-items: flex-end;
    justify-content: flex-end;
    gap: 4px;
    border-top: 1px solid #eadfc4;
    white-space: nowrap;
  }

  .trait-table td[data-label="効果"]::before,
  .trait-table td[data-label="所持武将"]::before {
    content: attr(data-label);
    display: block;
    margin-bottom: 4px;
    color: #8b6a2c;
    font-size: 11px;
    font-weight: 800;
  }

  .trait-table td[data-label="人数"]::before {
    content: "人数";
    color: #8b6a2c;
    font-size: 11px;
    font-weight: 800;
  }

  .trait-table tbody tr.empty-row { display: block; }
  .trait-table .empty-cell { display: block; }
}
</style>
