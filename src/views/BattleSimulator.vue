<template>
  <div class="battle-page flex-1 min-h-0 overflow-y-auto">
    <div class="mx-auto w-full max-w-7xl px-3 md:px-5 py-4 space-y-4">
      <section class="panel simulator-lineup-panel">
        <div class="builder-head">
          <div>
            <p class="eyebrow">自軍編成</p>
            <h2>シミュレーション用編成</h2>
          </div>
          <div class="cost-pill">Cost {{ teamCost }}</div>
        </div>

        <div class="sim-lineup-grid">
          <LineupSlot
            v-for="role in roleConfigs"
            :key="role.key"
            :title="role.label"
            :role="role.key"
            v-model:hero="simTeam[role.key].hero"
            v-model:skill1="simTeam[role.key].skill1"
            v-model:skill2="simTeam[role.key].skill2"
            v-model:stats="simTeam[role.key].stats"
            v-model:breakthrough="simTeam[role.key].breakthrough"
            v-model:bingxue="simTeam[role.key].bingxue"
            :focused-skill-slot="skillPickerRole === role.key ? skillPickerSlot : null"
            :conflicting-skill-names="emptyConflictSet"
            @open-hero-select="openHeroPicker(role.key)"
            @open-skill-select="(slot: number) => openSkillPicker(role.key, slot)"
            @skill-drop="(slot: number, skill: Skill) => assignSkill(role.key, slot, skill)"
            @skill-slot-drop="() => undefined"
            @skill-drag-start="() => undefined"
            @skill-drag-end="() => undefined"
            @hero-drag-start="() => undefined"
            @hero-drag-end="() => undefined"
            @hero-drop="() => undefined"
          />
        </div>
      </section>

      <el-dialog v-model="heroPickerVisible" title="武将を選択" width="920px" class="sim-picker-dialog" append-to-body>
        <div class="picker-body">
          <HeroLibrary
            mode="select"
            :used-heroes="usedHeroNames"
            :owned-heroes="[]"
            :filter-owned="false"
            :allowed-rarities="[5, 4]"
            :show-troop-filter="false"
            @select="selectHeroFromLibrary"
          />
        </div>
      </el-dialog>

      <el-dialog v-model="skillPickerVisible" title="戦法を選択" width="760px" class="sim-picker-dialog" append-to-body>
        <div class="picker-body">
          <SkillLibrary
            mode="select"
            battle-implemented-only
            :used-skills="usedSkillNames"
            :owned-skills="[]"
            :filter-owned="false"
            @select="selectSkillFromLibrary"
          />
        </div>
      </el-dialog>

      <section class="panel builder-panel">
        <div class="builder-head">
          <div>
            <p class="eyebrow">自軍編成</p>
            <h2>シミュレーション用編成</h2>
          </div>
          <div class="cost-pill">Cost {{ teamCost }}</div>
        </div>

        <div class="role-grid">
          <article v-for="role in roleConfigs" :key="role.key" class="role-card">
            <header>
              <span class="role-badge">{{ role.label }}</span>
              <b>総兵力 10000</b>
            </header>

            <el-select
              :model-value="selectedHeroes[role.key]"
              filterable
              clearable
              class="w-full"
              placeholder="武将を選択"
              @change="(value: string) => setHero(role.key, value)"
              @clear="setHero(role.key, '')"
            >
              <el-option
                v-for="hero in heroOptions"
                :key="heroKey(hero)"
                :label="heroLabel(hero)"
                :value="heroKey(hero)"
              />
            </el-select>

            <div class="portrait-box" :class="{ empty: !simTeam[role.key].hero }">
              <img
                v-if="simTeam[role.key].hero?.portrait"
                :src="simTeam[role.key].hero?.portrait"
                :alt="heroName(simTeam[role.key])"
              >
              <span v-else>{{ role.label }}</span>
            </div>

            <h3>{{ heroName(simTeam[role.key]) }}</h3>

            <div class="role-controls">
              <label>
                <span>凸数</span>
                <el-input-number v-model="simTeam[role.key].breakthrough" :min="0" :max="7" size="small" controls-position="right" />
              </label>
              <label>
                <span>速度</span>
                <el-input-number v-model="simTeam[role.key].stats.spd" :min="1" :max="500" size="small" controls-position="right" />
              </label>
            </div>

            <div class="stacked-controls">
              <el-select
                :model-value="selectedSkill1[role.key]"
                filterable
                clearable
                placeholder="戦法1"
                @change="(value: string) => setSkill(role.key, 'skill1', value)"
                @clear="setSkill(role.key, 'skill1', '')"
              >
                <el-option
                  v-for="skill in skillOptions"
                  :key="skillKey(skill)"
                  :label="skillName(skill)"
                  :value="skillKey(skill)"
                />
              </el-select>
              <el-select
                :model-value="selectedSkill2[role.key]"
                filterable
                clearable
                placeholder="戦法2"
                @change="(value: string) => setSkill(role.key, 'skill2', value)"
                @clear="setSkill(role.key, 'skill2', '')"
              >
                <el-option
                  v-for="skill in skillOptions"
                  :key="skillKey(skill)"
                  :label="skillName(skill)"
                  :value="skillKey(skill)"
                />
              </el-select>
            </div>

            <div class="bingxue-panel">
              <div class="mini-title">兵法書</div>
              <el-select
                :model-value="simTeam[role.key].bingxue.direction ?? ''"
                clearable
                placeholder="系統"
                @change="(value: string) => setBingxueDirection(role.key, value)"
                @clear="setBingxueDirection(role.key, '')"
              >
                <el-option
                  v-for="direction in bingxueDirectionsFor(role.key)"
                  :key="direction"
                  :label="direction"
                  :value="direction"
                />
              </el-select>
              <el-select
                :model-value="simTeam[role.key].bingxue.major ?? ''"
                clearable
                :disabled="!simTeam[role.key].bingxue.direction"
                placeholder="主兵法"
                @change="(value: string) => setBingxueMajor(role.key, value)"
                @clear="setBingxueMajor(role.key, '')"
              >
                <el-option
                  v-for="major in bingxueMajorsFor(role.key)"
                  :key="major"
                  :label="bingxueName(major)"
                  :value="major"
                />
              </el-select>
              <el-select
                :model-value="simTeam[role.key].bingxue.minors.map((minor) => minor.name)"
                multiple
                collapse-tags
                collapse-tags-tooltip
                :max-collapse-tags="1"
                :disabled="!simTeam[role.key].bingxue.direction"
                placeholder="副兵法"
                @change="(values: string[]) => setBingxueMinors(role.key, values)"
              >
                <el-option
                  v-for="minor in bingxueMinorsFor(role.key)"
                  :key="minor"
                  :label="bingxueName(minor)"
                  :value="minor"
                />
              </el-select>
            </div>

            <div class="stat-line">
              <span>統率 {{ formatStat(simTeam[role.key].stats.lea) }}</span>
              <span>武勇 {{ formatStat(simTeam[role.key].stats.val) }}</span>
              <span>知略 {{ formatStat(simTeam[role.key].stats.int) }}</span>
              <span>速度 {{ formatStat(simTeam[role.key].stats.spd) }}</span>
            </div>
          </article>
        </div>
      </section>

      <section class="panel run-panel">
        <div class="auto-opponent-note">
          全テンプレ編成と各1000回ずつ戦闘し、平均結果と兵力交換比を計算します。
        </div>
        <el-button type="primary" class="run-btn" :icon="VideoPlay" :loading="running" :disabled="!canRun" @click="run">
          全テンプレ各1000回シミュレーション
        </el-button>
      </section>

      <el-alert
        v-if="!canRun"
        type="warning"
        show-icon
        :closable="false"
        title="自軍の主将・副将1・副将2を選択するとシミュレーションできます。"
      />

      <template v-if="batchResult">
        <section class="overview-grid">
          <div class="panel score-card">
            <div class="score-head">
              <div>
                <p class="eyebrow">総合評価</p>
                <h2>{{ batchResult.scoreTier }} <small>({{ (batchResult.scoreValue / 10).toFixed(2) }})</small></h2>
              </div>
            </div>
            <div class="metric-bars">
              <div v-for="metric in metricRows" :key="metric.key" class="metric-bar-row">
                <span>{{ metric.label }}</span>
                <div class="metric-track">
                  <i :style="{ width: `${metric.value}%`, background: metric.color }" />
                </div>
                <b :style="{ color: metric.color }">{{ metric.value }}</b>
              </div>
            </div>
          </div>

        </section>

        <section class="panel summary-strip">
          <div>
            <span>勝率</span>
            <b class="blue">{{ formatPercent(batchResult.allyWinRate) }}</b>
          </div>
          <div>
            <span>兵力交換比</span>
            <b class="orange">{{ batchResult.exchangeRatio.toFixed(2) }}</b>
          </div>
          <div>
            <span>平均残兵</span>
            <b>{{ formatNumber(batchResult.averageAllyHp) }} / {{ formatNumber(batchResult.averageEnemyHp) }}</b>
          </div>
          <div>
            <span>平均終了ターン</span>
            <b>{{ batchResult.averageTurns.toFixed(1) }}</b>
          </div>
        </section>

        <section class="detail-stack">
          <div class="panel analysis-panel">
            <div class="radar-lite">
              <div v-for="metric in metricRows" :key="`radar-${metric.key}`">
                <span>{{ metric.label }}</span>
                <b>{{ metric.value }}</b>
              </div>
            </div>
            <div class="analysis-copy">
              <h3>出力 / 爆発分析</h3>
              <div class="stat-box">
                <span>総与ダメージ <b class="blue">{{ formatNumber(allyDamageTotal) }}</b></span>
                <span>最高ターン火力 <b class="orange">{{ formatNumber(maxTurnDamage) }}</b></span>
                <span>8ターン与ダメージ <b class="red">{{ formatNumber(totalTurnDamage) }}</b></span>
                <span>平均終了ターン <b>{{ batchResult.averageTurns.toFixed(1) }}</b></span>
              </div>
            </div>
          </div>

          <ChartPanel title="ダメージ曲線">
            <LineSeries :series="damageSeries" />
          </ChartPanel>

          <div class="two-col">
            <ChartPanel title="制御分析">
              <HorizontalBars :items="controlBars" empty-label="制御効果なし" />
            </ChartPanel>
            <ChartPanel title="技能ダメージ占比">
              <PieList :segments="damagePie" empty-label="ダメージ戦法なし" />
            </ChartPanel>
          </div>

          <ChartPanel title="回復分析">
            <div class="stat-box stat-box--wide">
              <span>理論治療量 <b class="blue">{{ formatNumber(healingTheory) }}</b></span>
              <span>実際治療量 <b class="orange">{{ formatNumber(healingActual) }}</b></span>
              <span>治療有効率 <b class="red">{{ healingEfficiency.toFixed(2) }}</b></span>
            </div>
            <LineSeries :series="healingSeries" />
          </ChartPanel>

          <ChartPanel title="多穿分析">
            <div class="stat-box stat-box--wide">
              <span>平均傷兵 <b class="blue">{{ formatNumber(avgEnemyLoss) }}</b></span>
              <span>平均損失 <b class="orange">{{ formatNumber(avgAllyLoss) }}</b></span>
              <span>戦功損失比 <b class="red">{{ batchResult.exchangeRatio.toFixed(1) }}</b></span>
            </div>
            <div class="member-grid">
              <div v-for="member in allyMemberRows" :key="member.name" class="member-card">
                <div class="avatar">
                  <img v-if="member.portrait" :src="member.portrait" :alt="member.name">
                  <span v-else>{{ member.name.slice(0, 2) }}</span>
                </div>
                <b>{{ member.name }}</b>
                <small>残兵 {{ formatNumber(member.hp) }}</small>
              </div>
            </div>
            <LineSeries :series="troopSeries" />
          </ChartPanel>

          <ChartPanel title="全テンプレ編成への兵力交換比">
            <div class="matchup-table">
              <div
                v-for="row in matchupRows"
                :key="row.id"
                class="matchup-cell"
                :class="{ good: row.exchange >= 1.25, even: row.exchange >= 0.9 && row.exchange < 1.25, bad: row.exchange < 0.9 }"
              >
                <span>{{ shortFormationName(row.name) }}</span>
                <b>{{ row.exchange.toFixed(1) }}</b>
              </div>
            </div>
          </ChartPanel>
        </section>
      </template>

      <el-empty v-else description="自軍編成を組んで実行すると、テンプレ編成とのシミュレーション結果を表示できます。" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, reactive, ref, watch } from 'vue'
import { VideoPlay } from '@element-plus/icons-vue'
import LineupSlot from '../components/LineupSlot.vue'
import HeroLibrary from '../components/HeroLibrary.vue'
import SkillLibrary from '../components/SkillLibrary.vue'
import { useLineups, isEmptyTeam } from '../composables/useLineups'
import type { BingxueMinor, Lineup, RoleData } from '../composables/useLineups'
import { simulateBattleBatch, type BattleBatchResult, type BattleTurnStat } from '../lib/battleSimulator'
import { battleSkillType, isExclusiveTeamSkillType } from '../lib/battleSkillEffects'
import { BINGXUE_DIRECTIONS, useData, type BingxueDirection, type EnemyFormation, type Hero, type Skill } from '../composables/useData'
import { heroLevel50Stats } from '../lib/heroStats'

type RoleKey = 'main' | 'vice1' | 'vice2'

interface MatchupRow {
  id: string
  name: string
  exchange: number
  winRate: number
}

interface ChartSeries {
  label: string
  color: string
  values: number[]
}

interface Segment {
  label: string
  color: string
  value: number
}

const BATTLE_TURN_INDEX_LAST = 7
const TEMPLATE_SIM_RUNS = 1000
const { lineups } = useLineups()
const { heroes, skills, enemyFormations, bingxue: bingxueCatalog } = useData()

const roleConfigs: Array<{ key: RoleKey; label: string }> = [
  { key: 'main', label: '主将' },
  { key: 'vice1', label: '副将' },
  { key: 'vice2', label: '副将' },
]

// 編成画面と同じ RoleData 形にしておくと、通常編成・共有・戦闘計算へ同じデータを渡せる。
const emptyBattleRole = (): RoleData => ({
  hero: null,
  skill1: null,
  skill2: null,
  stats: { lea: 100, val: 100, int: 100, pol: 100, cha: 100, spd: 100 },
  breakthrough: 0,
  bingxue: { direction: null, major: null, minors: [] },
})

const templateBreakthrough = 5
const freePointsForBreakthrough = (breakthrough: number) => 50 + breakthrough * 10
const statKeysFromFocus = (focus?: string): Array<keyof RoleData['stats']> => {
  const keys: Array<keyof RoleData['stats']> = []
  if (!focus) return keys
  if (/速度/.test(focus)) keys.push('spd')
  if (/武勇|武/.test(focus)) keys.push('val')
  if (/知略|知/.test(focus)) keys.push('int')
  if (/統率|統/.test(focus)) keys.push('lea')
  return keys
}
const statsWithFocus = (hero: Hero | null, focus?: string, breakthrough = templateBreakthrough): RoleData['stats'] => {
  const stats = { ...emptyBattleRole().stats, ...heroLevel50Stats(hero) }
  const keys = statKeysFromFocus(focus)
  if (keys.length === 0) return stats
  let remaining = freePointsForBreakthrough(breakthrough)
  keys.forEach((key, index) => {
    const points = index === keys.length - 1 ? remaining : Math.floor(remaining / (keys.length - index))
    stats[key] = (stats[key] ?? 100) + points
    remaining -= points
  })
  return stats
}

const simTeam = reactive<Lineup>({
  name: 'シミュレーター編成',
  main: emptyBattleRole(),
  vice1: emptyBattleRole(),
  vice2: emptyBattleRole(),
})

const selectedHeroes = reactive<Record<RoleKey, string>>({ main: '', vice1: '', vice2: '' })
const selectedSkill1 = reactive<Record<RoleKey, string>>({ main: '', vice1: '', vice2: '' })
const selectedSkill2 = reactive<Record<RoleKey, string>>({ main: '', vice1: '', vice2: '' })
const running = ref(false)
const batchResult = ref<BattleBatchResult | null>(null)
const matchupRows = ref<MatchupRow[]>([])
const heroPickerRole = ref<RoleKey | null>(null)
const skillPickerRole = ref<RoleKey | null>(null)
const skillPickerSlot = ref<number | null>(null)
const heroPickerVisible = ref(false)
const skillPickerVisible = ref(false)
const emptyConflictSet = new Set<string>()

const roleSignature = (role: RoleData): string => JSON.stringify({
  hero: role.hero?.sim_id || role.hero?.name_jp || role.hero?.name || '',
  skill1: role.skill1?.sim_id || role.skill1?.id || role.skill1?.name_jp || role.skill1?.name || '',
  skill2: role.skill2?.sim_id || role.skill2?.id || role.skill2?.name_jp || role.skill2?.name || '',
  stats: role.stats,
  breakthrough: role.breakthrough,
  bingxue: role.bingxue,
})

watch(
  () => roleConfigs.map((role) => roleSignature(simTeam[role.key])).join('|'),
  () => {
    batchResult.value = null
    matchupRows.value = []
  },
)

const playableTeams = computed(() => lineups.map((team, index) => ({ team, index })).filter(({ team }) => !isEmptyTeam(team)))
const heroOptions = computed(() => [...heroes.value].sort((a, b) => heroNameForSort(a).localeCompare(heroNameForSort(b), 'ja')))
const skillOptions = computed(() =>
  uniqueBy(skills.value, skillKey)
    .filter((skill) => skillKey(skill).length > 0)
    .sort((a, b) => skillName(a).localeCompare(skillName(b), 'ja')),
)
const heroByKey = computed(() => new Map(heroes.value.map((hero) => [heroKey(hero), hero])))
const skillByKey = computed(() => new Map(skillOptions.value.map((skill) => [skillKey(skill), skill])))
const heroBySimId = computed(() => new Map(heroes.value.map((hero) => [hero.sim_id, hero]).filter(([id]) => !!id) as [string, Hero][]))
const skillBySimId = computed(() => new Map(skills.value.map((skill) => [skill.sim_id, skill]).filter(([id]) => !!id) as [string, Skill][]))
const usedHeroNames = computed(() => new Set([simTeam.main.hero?.name, simTeam.vice1.hero?.name, simTeam.vice2.hero?.name].filter(Boolean) as string[]))
const usedSkillNames = computed(() => new Set([
  simTeam.main.skill1?.name,
  simTeam.main.skill2?.name,
  simTeam.vice1.skill1?.name,
  simTeam.vice1.skill2?.name,
  simTeam.vice2.skill1?.name,
  simTeam.vice2.skill2?.name,
].filter(Boolean) as string[]))

const clearExclusiveTeamSkill = (team: Lineup, incoming: Skill, keepRole: RoleKey, keepSlot: 'skill1' | 'skill2') => {
  if (!isExclusiveTeamSkillType(incoming)) return
  const incomingType = battleSkillType(incoming)
  roleConfigs.forEach(({ key }) => {
    ;(['skill1', 'skill2'] as const).forEach((slot) => {
      if (key === keepRole && slot === keepSlot) return
      const current = team[key][slot]
      if (!current || battleSkillType(current) !== incomingType) return
      team[key][slot] = null
      if (slot === 'skill1') selectedSkill1[key] = ''
      else selectedSkill2[key] = ''
    })
  })
}

const normalizeExclusiveTeamSkills = (team: Lineup) => {
  const seen = new Set<string>()
  roleConfigs.forEach(({ key }) => {
    ;(['skill1', 'skill2'] as const).forEach((slot) => {
      const skill = team[key][slot]
      if (!skill || !isExclusiveTeamSkillType(skill)) return
      const type = battleSkillType(skill)
      if (!seen.has(type)) {
        seen.add(type)
        return
      }
      team[key][slot] = null
      if (team === simTeam) {
        if (slot === 'skill1') selectedSkill1[key] = ''
        else selectedSkill2[key] = ''
      }
    })
  })
}

// テンプレ敵編成は sim_id で武将・戦法を引き直し、通常の Lineup と同じ形へ変換する。
const roleFromTemplateMember = (member: EnemyFormation['members'][number]): RoleData => {
  const hero = heroBySimId.value.get(member.commander_id) ?? null
  return {
    ...emptyBattleRole(),
    hero,
    skill1: member.skill1_id ? skillBySimId.value.get(member.skill1_id) ?? null : null,
    skill2: member.skill2_id ? skillBySimId.value.get(member.skill2_id) ?? null : null,
    breakthrough: templateBreakthrough,
    stats: statsWithFocus(hero, member.stat_focus, templateBreakthrough),
  }
}

const lineupFromTemplate = (formation: EnemyFormation): Lineup => {
  const lineup: Lineup = {
    name: formation.name,
    main: roleFromTemplateMember(formation.members[0]),
    vice1: roleFromTemplateMember(formation.members[1]),
    vice2: roleFromTemplateMember(formation.members[2]),
  }
  normalizeExclusiveTeamSkills(lineup)
  return lineup
}

const templateTeams = computed(() => new Map(enemyFormations.value.map((formation) => [formation.id, lineupFromTemplate(formation)])))
const canRun = computed(() => Boolean(simTeam.main.hero && simTeam.vice1.hero && simTeam.vice2.hero && enemyFormations.value.length > 0))
const teamCost = computed(() => (simTeam.main.hero?.cost ?? 0) + (simTeam.vice1.hero?.cost ?? 0) + (simTeam.vice2.hero?.cost ?? 0))

// バトル結果の数値を、スクリーンショット風の評価バーへ表示しやすい配列に整える。
const metricRows = computed(() => {
  const metrics = batchResult.value?.metrics
  if (!metrics) return []
  return [
    { key: 'output', label: '出力', value: metrics.output, color: '#4ea5d9' },
    { key: 'burst', label: '爆発', value: metrics.burst, color: '#2f9fd0' },
    { key: 'multi', label: '多穿', value: metrics.multi, color: '#f06f59' },
    { key: 'recovery', label: '回復', value: metrics.recovery, color: '#eca69c' },
    { key: 'control', label: '制御', value: metrics.control, color: '#d92d12' },
    { key: 'destruction', label: '破壊力', value: metrics.destruction, color: '#e99a8c' },
    { key: 'stability', label: '安定性', value: metrics.stability, color: '#ee2e17' },
    { key: 'exchange', label: '兵力交換比', value: metrics.exchange, color: '#e89d92' },
  ]
})

const allySkillStats = computed(() => batchResult.value?.skillStats.filter((stat) => stat.side === 'ally') ?? [])
const allyDamageTotal = computed(() => allySkillStats.value.reduce((sum, stat) => sum + stat.avgDamage, 0))
const healingActual = computed(() => allySkillStats.value.reduce((sum, stat) => sum + stat.avgHealing, 0))
const healingEfficiency = computed(() => Math.min(1, healingActual.value / Math.max(1, (batchResult.value?.allyMaxHp ?? 1) * 0.6)))
const healingTheory = computed(() => healingActual.value / Math.max(0.1, healingEfficiency.value))
const totalTurnDamage = computed(() => (batchResult.value?.turnStats ?? []).reduce((sum, turn) => sum + turn.allyDamage, 0))
const maxTurnDamage = computed(() => Math.max(...(batchResult.value?.turnStats ?? []).map((turn) => turn.allyDamage), 0))
const avgEnemyLoss = computed(() => Math.max(0, (batchResult.value?.enemyMaxHp ?? 0) - (batchResult.value?.averageEnemyHp ?? 0)))
const avgAllyLoss = computed(() => Math.max(0, (batchResult.value?.allyMaxHp ?? 0) - (batchResult.value?.averageAllyHp ?? 0)))
const turnValues = (pick: (turn: BattleTurnStat) => number): number[] => (batchResult.value?.turnStats ?? []).map(pick)
const damageSeries = computed<ChartSeries[]>(() => [
  { label: '自軍与ダメージ', color: '#2f80ed', values: turnValues((turn) => turn.allyDamage) },
  { label: '敵軍与ダメージ', color: '#ff6b00', values: turnValues((turn) => turn.enemyDamage) },
])
const healingSeries = computed<ChartSeries[]>(() => [
  { label: '自軍回復', color: '#2f80ed', values: turnValues((turn) => turn.allyHealing) },
  { label: '敵軍回復', color: '#ff6b00', values: turnValues((turn) => turn.enemyHealing) },
])
const troopSeries = computed<ChartSeries[]>(() => {
  const names = roleNames(simTeam)
  return [0, 1, 2].map((idx) => ({
    label: names[idx] ?? `武将${idx + 1}`,
    color: ['#2f80ed', '#ff6b00', '#50b895'][idx],
    values: turnValues((turn) => turn.allyMembers[idx] ?? 0),
  }))
})
const damagePie = computed<Segment[]>(() => allySkillStats.value
  .filter((stat) => stat.avgDamage > 0)
  .slice(0, 8)
  .map((stat, index) => ({
    label: stat.skillName,
    value: stat.avgDamage,
    color: ['#6aa9df', '#f08a3c', '#56b893', '#d7b241', '#d870c8', '#855fd4', '#ef4f71', '#4ba3a1'][index % 8],
  })))
const controlBars = computed(() => Object.entries(batchResult.value?.controlStats ?? {})
  .sort((a, b) => b[1] - a[1])
  .slice(0, 8)
  .map(([label, value]) => ({ label, value })))
const allyMemberRows = computed(() => {
  const heroes = [simTeam.main.hero, simTeam.vice1.hero, simTeam.vice2.hero]
  const last = batchResult.value?.turnStats[BATTLE_TURN_INDEX_LAST]?.allyMembers ?? []
  return heroes.map((hero, index) => ({
    name: hero?.name_jp || hero?.name || `武将${index + 1}`,
    portrait: hero?.portrait || '',
    hp: last[index] ?? 0,
  }))
})

const setHero = (role: RoleKey, value: string) => {
  const hero = heroByKey.value.get(value) ?? null
  selectedHeroes[role] = hero ? heroKey(hero) : ''
  simTeam[role].hero = hero
  simTeam[role].skill1 = null
  simTeam[role].skill2 = null
  selectedSkill1[role] = ''
  selectedSkill2[role] = ''
  simTeam[role].bingxue = { direction: null, major: null, minors: [] }
  if (hero) simTeam[role].stats = { ...simTeam[role].stats, ...heroLevel50Stats(hero) }
  batchResult.value = null
}

// 武将・戦法・兵学を変更したら、古いシミュレーション結果は必ず破棄する。
const setSkill = (role: RoleKey, slot: 'skill1' | 'skill2', value: string) => {
  const skill = skillByKey.value.get(value) ?? null
  if (slot === 'skill1') selectedSkill1[role] = skill ? skillKey(skill) : ''
  else selectedSkill2[role] = skill ? skillKey(skill) : ''
  if (skill) clearExclusiveTeamSkill(simTeam, skill, role, slot)
  simTeam[role][slot] = skill
  batchResult.value = null
}

const openHeroPicker = (role: RoleKey) => {
  heroPickerRole.value = role
  heroPickerVisible.value = true
}

const selectHeroFromLibrary = (hero: Hero) => {
  if (!heroPickerRole.value) return
  setHero(heroPickerRole.value, heroKey(hero))
  heroPickerVisible.value = false
}

const openSkillPicker = (role: RoleKey, slot: number) => {
  skillPickerRole.value = role
  skillPickerSlot.value = slot
  skillPickerVisible.value = true
}

const assignSkill = (role: RoleKey, slot: number, skill: Skill) => {
  setSkill(role, slot === 1 ? 'skill1' : 'skill2', skillKey(skill))
}

const selectSkillFromLibrary = (skill: Skill) => {
  if (!skillPickerRole.value || !skillPickerSlot.value) return
  assignSkill(skillPickerRole.value, skillPickerSlot.value, skill)
  skillPickerVisible.value = false
}

const setBingxueDirection = (role: RoleKey, value: string) => {
  simTeam[role].bingxue = value ? { direction: value as BingxueDirection, major: null, minors: [] } : { direction: null, major: null, minors: [] }
  batchResult.value = null
}
const setBingxueMajor = (role: RoleKey, value: string) => {
  simTeam[role].bingxue.major = value || null
  batchResult.value = null
}
const setBingxueMinors = (role: RoleKey, values: string[]) => {
  simTeam[role].bingxue.minors = values.slice(0, 5).map((name): BingxueMinor => ({ name, level: 1 }))
  batchResult.value = null
}
const bingxueDirectionsFor = (role: RoleKey): BingxueDirection[] => {
  const available = simTeam[role].hero?.bingxue
  return BINGXUE_DIRECTIONS.filter((direction) => Boolean(available?.[direction]))
}
const bingxueMajorsFor = (role: RoleKey): string[] => {
  const direction = simTeam[role].bingxue.direction
  return direction ? simTeam[role].hero?.bingxue?.[direction]?.major ?? [] : []
}
const bingxueMinorsFor = (role: RoleKey): string[] => {
  const direction = simTeam[role].bingxue.direction
  return direction ? simTeam[role].hero?.bingxue?.[direction]?.minor ?? [] : []
}

const tierFromScore = (value: number): string => {
  if (value >= 86) return 'T0'
  if (value >= 72) return 'T0.5'
  if (value >= 58) return 'T1'
  if (value >= 44) return 'T1.5'
  if (value >= 30) return 'T2'
  return 'T3'
}

const aggregateTemplateResults = (results: BattleBatchResult[]): BattleBatchResult | null => {
  if (results.length === 0) return null
  const totalRuns = results.reduce((sum, result) => sum + result.runs, 0)
  const weighted = (pick: (result: BattleBatchResult) => number) =>
    results.reduce((sum, result) => sum + pick(result) * result.runs, 0) / Math.max(1, totalRuns)

  const first = results[0]
  const skillMap = new Map<string, BattleBatchResult['skillStats'][number] & { _runs: number }>()
  results.forEach((result) => {
    result.skillStats.forEach((stat) => {
      const existing = skillMap.get(stat.key)
      if (existing) {
        existing.activations += stat.avgActivations * result.runs
        existing.damage += stat.avgDamage * result.runs
        existing.healing += stat.avgHealing * result.runs
        existing._runs += result.runs
      } else {
        skillMap.set(stat.key, {
          ...stat,
          activations: stat.avgActivations * result.runs,
          damage: stat.avgDamage * result.runs,
          healing: stat.avgHealing * result.runs,
          _runs: result.runs,
        })
      }
    })
  })

  const skillStats = [...skillMap.values()].map((stat) => ({
    ...stat,
    activations: stat.activations,
    damage: stat.damage,
    healing: stat.healing,
    avgActivations: stat.activations / Math.max(1, stat._runs),
    avgDamage: stat.damage / Math.max(1, stat._runs),
    avgHealing: stat.healing / Math.max(1, stat._runs),
    _runs: undefined,
  })).map(({ _runs, ...stat }) => stat)

  const turnStats = first.turnStats.map((turn, index) => ({
    ...turn,
    allyDamage: weighted((result) => result.turnStats[index]?.allyDamage ?? 0),
    enemyDamage: weighted((result) => result.turnStats[index]?.enemyDamage ?? 0),
    allyHealing: weighted((result) => result.turnStats[index]?.allyHealing ?? 0),
    enemyHealing: weighted((result) => result.turnStats[index]?.enemyHealing ?? 0),
    allyHp: weighted((result) => result.turnStats[index]?.allyHp ?? 0),
    enemyHp: weighted((result) => result.turnStats[index]?.enemyHp ?? 0),
    allyMembers: turn.allyMembers.map((_, memberIndex) => weighted((result) => result.turnStats[index]?.allyMembers[memberIndex] ?? 0)),
    enemyMembers: turn.enemyMembers.map((_, memberIndex) => weighted((result) => result.turnStats[index]?.enemyMembers[memberIndex] ?? 0)),
  }))

  const controlKeys = new Set(results.flatMap((result) => Object.keys(result.controlStats)))
  const controlStats = Object.fromEntries([...controlKeys].map((key) => [key, weighted((result) => result.controlStats[key] ?? 0)]))
  const metrics = {
    output: Math.round(weighted((result) => result.metrics.output)),
    burst: Math.round(weighted((result) => result.metrics.burst)),
    multi: Math.round(weighted((result) => result.metrics.multi)),
    recovery: Math.round(weighted((result) => result.metrics.recovery)),
    control: Math.round(weighted((result) => result.metrics.control)),
    destruction: Math.round(weighted((result) => result.metrics.destruction)),
    stability: Math.round(weighted((result) => result.metrics.stability)),
    exchange: Math.round(weighted((result) => result.metrics.exchange)),
  }
  const scoreValue = Math.round(weighted((result) => result.scoreValue))

  return {
    ...first,
    runs: totalRuns,
    allyWins: results.reduce((sum, result) => sum + result.allyWins, 0),
    enemyWins: results.reduce((sum, result) => sum + result.enemyWins, 0),
    draws: results.reduce((sum, result) => sum + result.draws, 0),
    allyWinRate: weighted((result) => result.allyWinRate),
    enemyWinRate: weighted((result) => result.enemyWinRate),
    drawRate: weighted((result) => result.drawRate),
    averageTurns: weighted((result) => result.averageTurns),
    averageAllyHp: weighted((result) => result.averageAllyHp),
    averageEnemyHp: weighted((result) => result.averageEnemyHp),
    skillStats,
    exchangeRatio: weighted((result) => result.exchangeRatio),
    scoreTier: tierFromScore(scoreValue),
    scoreValue,
    metrics,
    turnStats,
    controlStats,
  }
}

const run = () => {
  if (!canRun.value) return
  running.value = true
  try {
    normalizeExclusiveTeamSkills(simTeam)
    // 代表相手は置かず、全テンプレ編成を同じ試行回数で評価する。
    const seed = `battle-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const results: BattleBatchResult[] = []
    matchupRows.value = enemyFormations.value.map((formation) => {
      const team = templateTeams.value.get(formation.id)
      if (!team) return null
      const result = simulateBattleBatch(simTeam, team, { seed: `${seed}-template-${formation.id}`, runs: TEMPLATE_SIM_RUNS })
      results.push(result)
      return { id: formation.id, name: formation.name, exchange: result.exchangeRatio, winRate: result.allyWinRate }
    }).filter(Boolean) as MatchupRow[]
    batchResult.value = aggregateTemplateResults(results)
  } finally {
    running.value = false
  }
}

const heroKey = (hero: Hero): string => hero.sim_id || hero.name
const skillKey = (skill: Skill): string => skill.sim_id || skill.id || skill.name_jp || skill.name
const heroName = (role: RoleData): string => role.hero?.name_jp || role.hero?.name || '武将未選択'
const heroNameForSort = (hero: Hero): string => hero.name_jp || hero.name
const heroLabel = (hero: Hero): string => `${hero.name_jp || hero.name} / ${hero.faction_jp || hero.faction} / Cost ${hero.cost}`
const skillName = (skill: Skill): string => skill.name_jp || skill.name
const bingxueName = (name: string): string => bingxueCatalog.value[name]?.name_jp || bingxueCatalog.value[name]?.name || name
const formatNumber = (value: number): string => Math.round(value).toLocaleString()
const formatPercent = (value: number): string => `${(value * 100).toFixed(1)}%`
const formatStat = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined || value === '') return '-'
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric.toFixed(2) : String(value)
}
const shortFormationName = (name: string): string => {
  const cleaned = name.replace(/（.*?）/g, '')
  const parts = cleaned.split(/[・,、/]/).map((part) => part.trim()).filter(Boolean)
  return parts.length > 0 ? parts.slice(0, 3).join('・') : cleaned
}
const roleNames = (team: Lineup): string[] => [team.main.hero, team.vice1.hero, team.vice2.hero].map((hero, index) => hero?.name_jp || hero?.name || `武将${index + 1}`)

function uniqueBy<T>(items: T[], keyOf: (item: T) => string): T[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = keyOf(item)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const ChartPanel = defineComponent({
  name: 'ChartPanel',
  props: { title: { type: String, required: true } },
  setup(props, { slots }) {
    return () => h('section', { class: 'panel chart-panel' }, [h('h3', props.title), slots.default?.()])
  },
})

// SVG ではなく通常DOMで描く軽量チャート。単一HTML出力でも崩れにくくするため inline style を使う。
const HorizontalBars = defineComponent({
  name: 'HorizontalBars',
  props: {
    items: { type: Array as () => Array<{ label: string; value: number }>, required: true },
    emptyLabel: { type: String, default: 'データなし' },
  },
  setup(props) {
    return () => {
      if (props.items.length === 0) return h('div', { class: 'metric-empty' }, props.emptyLabel)
      const max = Math.max(...props.items.map((item) => item.value), 1)
      return h('div', { style: { display: 'grid', gap: '10px' } }, props.items.map((item) => h('div', { style: { display: 'grid', gridTemplateColumns: '92px minmax(0, 1fr) 54px', gap: '10px', alignItems: 'center', fontSize: '12px' } }, [
        h('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, title: item.label }, item.label),
        h('div', { style: { height: '20px', background: '#e8edf2', borderRadius: '4px', overflow: 'hidden' } }, [
          h('i', { style: { display: 'block', height: '100%', width: `${Math.max(4, (item.value / max) * 100)}%`, background: '#368cc7' } }),
        ]),
        h('b', { style: { fontVariantNumeric: 'tabular-nums' } }, item.value.toFixed(1)),
      ])))
    }
  },
})

const PieList = defineComponent({
  name: 'PieList',
  props: {
    segments: { type: Array as () => Segment[], required: true },
    emptyLabel: { type: String, default: 'データなし' },
  },
  setup(props) {
    return () => {
      const total = props.segments.reduce((sum, segment) => sum + segment.value, 0)
      if (!total) return h('div', { class: 'metric-empty' }, props.emptyLabel)
      return h('div', { style: { display: 'grid', gap: '10px' } }, props.segments.map((segment) => h('div', { style: { display: 'grid', gridTemplateColumns: '120px minmax(0, 1fr) 48px', gap: '10px', alignItems: 'center', fontSize: '12px' } }, [
        h('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, title: segment.label }, segment.label),
        h('div', { style: { height: '20px', background: '#e8edf2', borderRadius: '4px', overflow: 'hidden' } }, [
          h('i', { style: { display: 'block', height: '100%', width: `${Math.max(4, (segment.value / total) * 100)}%`, background: segment.color } }),
        ]),
        h('b', { style: { fontVariantNumeric: 'tabular-nums' } }, `${Math.round((segment.value / total) * 100)}%`),
      ])))
    }
  },
})

// ダメージ・回復・残兵推移を共通で描く小さな SVG ラインチャート。
const LineSeries = defineComponent({
  name: 'LineSeries',
  props: { series: { type: Array as () => ChartSeries[], required: true } },
  setup(props) {
    const width = 720
    const height = 260
    const pad = 34

    return () => {
      const max = Math.max(...props.series.flatMap((item) => item.values), 1)
      const point = (value: number, index: number, count: number) => {
        const x = pad + (count <= 1 ? 0 : (index / (count - 1)) * (width - pad * 2))
        const y = height - pad - (value / max) * (height - pad * 2)
        return `${x.toFixed(1)},${y.toFixed(1)}`
      }

      return h('div', { style: { display: 'grid', gap: '10px' } }, [
        h('svg', { viewBox: `0 0 ${width} ${height}`, style: { width: '100%', height: '260px', display: 'block', background: '#fbfdff', border: '1px solid #e2e8f0', borderRadius: '6px' }, role: 'img' }, [
          ...[0, 1, 2, 3, 4].map((step) => {
            const y = pad + step * ((height - pad * 2) / 4)
            return h('line', { x1: pad, y1: y, x2: width - pad, y2: y, stroke: '#e8edf2', 'stroke-width': 1 })
          }),
          ...Array.from({ length: 8 }, (_, index) => {
            const x = pad + (index / 7) * (width - pad * 2)
            return h('text', { x, y: height - 10, 'text-anchor': 'middle', fill: '#64748b', 'font-size': 11 }, `${index + 1}`)
          }),
          ...props.series.map((series) => {
            const points = series.values.map((value, index) => point(value, index, series.values.length)).join(' ')
            return h('g', {}, [
              h('polyline', { points, fill: 'none', stroke: series.color, 'stroke-width': 4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
              ...series.values.map((value, index) => {
                const [x, y] = point(value, index, series.values.length).split(',')
                return h('circle', { cx: x, cy: y, r: 4, fill: '#fff', stroke: series.color, 'stroke-width': 3 })
              }),
            ])
          }),
        ]),
        h('div', { style: { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '12px' } }, props.series.map((series) => h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700 } }, [
          h('i', { style: { width: '18px', height: '4px', borderRadius: '999px', background: series.color, display: 'inline-block' } }),
          series.label,
        ]))),
      ])
    }
  },
})
</script>

<style scoped>
.battle-page { background: #f4efe8; color: #2f383d; }
.panel { background: rgba(255, 255, 255, 0.78); border: 1px solid #d8cdbc; border-radius: 8px; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04); }
.builder-panel { display: none; }
.simulator-lineup-panel { padding: 14px; }
.builder-head, .score-head { display: flex; align-items: start; justify-content: space-between; gap: 12px; }
.builder-head h2 { margin: 0; font-size: 22px; font-weight: 900; }
.eyebrow { margin: 0 0 4px; font-size: 14px; font-weight: 800; }
.cost-pill { color: #b45309; font-weight: 900; font-variant-numeric: tabular-nums; }
.sim-lineup-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 12px; align-items: stretch; }
.sim-lineup-grid > * { min-height: 0; }
.picker-body { height: min(72vh, 720px); min-height: 480px; display: flex; }
.role-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 12px; }
.role-card { display: grid; gap: 10px; padding: 12px; background: #fbf4e9; border: 1px solid #d7c7b1; border-radius: 8px; }
.role-card header { display: flex; justify-content: space-between; align-items: center; color: #6b7280; font-weight: 800; }
.role-badge { padding: 4px 8px; background: #7b8790; color: #fff; border-radius: 6px; font-weight: 900; }
.portrait-box { aspect-ratio: 1.05; display: grid; place-items: center; overflow: hidden; background: #7898ad; border: 6px solid #efe2cf; color: #eef7fb; font-size: 30px; font-weight: 900; }
.portrait-box.empty { opacity: .65; }
.portrait-box img { width: 100%; height: 100%; object-fit: cover; }
.role-card h3 { margin: 0; text-align: center; font-size: 18px; font-weight: 900; }
.role-controls { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.role-controls label { display: grid; gap: 4px; font-size: 11px; color: #64748b; }
.stacked-controls, .bingxue-panel { display: grid; gap: 8px; }
.bingxue-panel { padding: 8px; background: #fff7ed; border: 1px solid #ead4ac; }
.mini-title { color: #92400e; font-size: 12px; font-weight: 900; }
.stat-line { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px; padding: 8px; background: #f5eadc; border: 1px solid #d8c8b3; font-size: 12px; font-weight: 800; }
.run-panel { padding: 12px; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; align-items: center; }
.auto-opponent-note { color: #64748b; font-size: 13px; line-height: 1.5; }
.run-btn { min-height: 40px; }
.overview-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; }
.score-card { padding: 22px 24px; }
.score-card h2 { margin: 0; color: #f0a397; font-size: 38px; line-height: 1; font-weight: 900; }
.score-card h2 small { font-size: 16px; }
.metric-bars { display: grid; gap: 13px; margin-top: 24px; }
.metric-bar-row { display: grid; grid-template-columns: 88px minmax(0, 1fr) 44px; gap: 12px; align-items: center; font-weight: 700; }
.metric-track { height: 22px; background: #d8d8d8; overflow: hidden; }
.metric-track i { display: block; height: 100%; }
.match-card { overflow: hidden; }
.match-card header, .match-row { display: grid; grid-template-columns: minmax(0, 1fr) 88px; align-items: center; }
.match-card header { min-height: 50px; color: #f18b1f; background: #fff8ed; border-bottom: 1px solid #ead4ac; font-weight: 900; }
.match-card.disadvantage header { color: #6389a7; background: #f3f8fb; }
.match-card header > *, .match-row > * { padding: 12px 14px; text-align: center; }
.match-row { border-bottom: 1px solid #ead4ac; font-weight: 800; }
.match-card.disadvantage .match-row { border-color: #c9d8e3; }
.match-row span, .matchup-cell span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.summary-strip { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); padding: 14px; }
.summary-strip div { display: grid; gap: 3px; text-align: center; border-right: 1px solid #d8cdbc; }
.summary-strip div:last-child { border-right: 0; }
.summary-strip span { color: #64748b; font-size: 12px; }
.summary-strip b, .blue { color: #2f80ed; }
.orange { color: #e5a23b; }
.red { color: #f0522f; }
.detail-stack { display: grid; gap: 16px; }
.analysis-panel { display: grid; grid-template-columns: 330px minmax(0, 1fr); gap: 18px; align-items: center; padding: 14px; }
.radar-lite { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.radar-lite div { display: flex; justify-content: space-between; padding: 8px; background: #eff6ff; border: 1px solid #dbeafe; font-weight: 800; }
.analysis-copy h3, .chart-panel h3 { margin: 0 0 14px; font-weight: 900; font-size: 22px; }
.chart-panel { padding: 20px; }
.stat-box { border: 1px solid #9fb1bf; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 18px; padding: 16px 18px; font-weight: 800; }
.stat-box--wide { margin-bottom: 20px; }
.two-col { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.h-bars, .pie-list, .line-list { display: grid; gap: 8px; }
.h-bar, .pie-row { display: grid; grid-template-columns: 90px minmax(0, 1fr) 48px; align-items: center; gap: 8px; font-size: 12px; }
.h-bar i, .pie-row i { height: 22px; background: #368cc7; }
.line-series { display: grid; gap: 8px; }
.line-series b { display: inline-flex; align-items: center; gap: 6px; }
.line-series i { width: 18px; height: 3px; display: inline-block; }
.turn-bars { display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); gap: 4px; }
.turn-bars span { padding: 6px 4px; background: #f1f5f9; text-align: center; font-size: 11px; font-variant-numeric: tabular-nums; }
.member-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin: 16px 0 24px; }
.member-card { display: grid; gap: 7px; justify-items: center; padding: 12px; background: #eee2d5; border: 1px solid #d6c2a9; }
.avatar { width: 120px; aspect-ratio: 1; display: grid; place-items: center; overflow: hidden; background: #7393aa; color: #ecf3f7; font-size: 24px; font-weight: 900; border: 4px solid #f5eadc; }
.avatar img { width: 100%; height: 100%; object-fit: cover; }
.matchup-table { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 3px; }
.matchup-cell { min-height: 34px; display: grid; grid-template-columns: minmax(0, 1fr) 44px; align-items: center; gap: 6px; padding: 7px 10px; font-size: 13px; font-weight: 800; background: #f7eadf; }
.matchup-cell.good { background: #e6f5df; color: #37b24d; }
.matchup-cell.even { background: #fff0df; color: #e07a34; }
.matchup-cell.bad { background: #fde7df; color: #e54d2e; }
.metric-empty { padding: 18px 14px; text-align: center; color: #64748b; font-size: 12px; }
@media (max-width: 980px) {
  .sim-lineup-grid, .role-grid, .run-panel, .overview-grid, .summary-strip, .analysis-panel, .two-col { grid-template-columns: 1fr; }
  .summary-strip div { border-right: 0; border-bottom: 1px solid #d8cdbc; padding: 8px 0; }
  .matchup-table, .member-grid { grid-template-columns: 1fr; }
}
</style>
