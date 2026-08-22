<template>
  <div class="ai-lineup-page flex-1 min-h-0 overflow-y-auto">
    <div class="mx-auto w-full max-w-7xl px-3 md:px-5 py-4 space-y-4">
      <section class="panel">
        <div class="page-head">
          <div>
            <p class="eyebrow">AI編成</p>
            <h2>テンプレ相手に勝率が高い組み合わせを探索</h2>
          </div>
          <el-button v-if="running" type="danger" :icon="CircleClose" @click="cancelOptimizer">
            探索を中止
          </el-button>
          <el-button v-else type="primary" :icon="VideoPlay" :disabled="!canOptimize" @click="runOptimizer">
            AI探索
          </el-button>
        </div>
      </section>

      <section class="panel lineup-panel">
        <div class="section-head">
          <div>
            <p class="eyebrow">固定条件</p>
            <h3>指定した枠は固定、空欄は探索対象</h3>
          </div>
          <div class="lineup-metrics">
            <TroopLevelSummary
              :levels="seedTroopLevels"
              :selected="seedTeam.troopType"
              selectable
              @select="setSeedTroopType"
            />
            <span class="cost-pill">Cost {{ teamCost(seedTeam) }}</span>
          </div>
        </div>

        <div class="lineup-grid">
          <LineupSlot
            v-for="role in roleConfigs"
            :key="role.key"
            :title="role.label"
            :role="role.key"
            v-model:hero="seedTeam[role.key].hero"
            v-model:skill1="seedTeam[role.key].skill1"
            v-model:skill2="seedTeam[role.key].skill2"
            v-model:stats="seedTeam[role.key].stats"
            v-model:breakthrough="seedTeam[role.key].breakthrough"
            v-model:bingxue="seedTeam[role.key].bingxue"
            :focused-skill-slot="picker.role === role.key ? picker.skillSlot : null"
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

      <section class="panel settings-panel">
        <div class="section-head">
          <div>
            <p class="eyebrow">探索設定</p>
            <h3>候補数と試行回数</h3>
          </div>
          <div class="estimate-pill">
            {{ candidatePoolMode === 'owned' ? '所持' : '全体' }}：
            S武将 {{ heroCandidates.length }} / 実装済みS・A戦法 {{ skillCandidates.length }}
          </div>
        </div>

        <div class="settings-grid">
          <label>
            <span>候補範囲</span>
            <el-segmented
              v-model="candidatePoolMode"
              :options="candidatePoolOptions"
              :disabled="running"
              @change="handleCandidatePoolChange"
            />
          </label>
          <label>
            <span>探索方法</span>
            <el-segmented
              v-model="searchSampleMode"
              :options="searchSampleModeOptions"
              :disabled="running"
              @change="clearOptimizerResults"
            />
          </label>
          <label>
            <span>探索サンプル数</span>
            <el-input-number
              v-model="sampleCount"
              :min="1"
              :disabled="running || searchSampleMode === 'all'"
              controls-position="right"
              @change="clearOptimizerResults"
            />
          </label>
          <label>
            <span>一次試行 / テンプレ</span>
            <el-input-number v-model="scoutRuns" :min="1" :max="200" :disabled="running" controls-position="right" />
          </label>
          <label>
            <span>最終試行 / テンプレ</span>
            <el-input-number v-model="finalRuns" :min="10" :max="1000" :disabled="running" controls-position="right" />
          </label>
          <label>
            <span>指定武将の位置</span>
            <div class="position-switch">
              <el-switch
                v-model="reorderFixedHeroes"
                inline-prompt
                active-text="可変"
                inactive-text="固定"
                :width="58"
                :disabled="running"
                @change="clearOptimizerResults"
              />
            </div>
          </label>
          <label class="tier-target-setting">
            <span>評価対象</span>
            <div class="tier-switches">
              <div v-for="option in templateTierOptions" :key="option.value" class="tier-switch-item">
                <strong>{{ option.label }}</strong>
                <el-switch
                  :model-value="selectedTemplateTiers[option.value]"
                  inline-prompt
                  active-text="対象"
                  inactive-text="除外"
                  :width="58"
                  :disabled="running"
                  @change="updateTemplateTier(option.value, Boolean($event))"
                />
                <small>{{ templateTierCounts[option.value] }}編成</small>
              </div>
            </div>
          </label>
        </div>

        <div class="status-row">
          <span>空き武将 {{ emptyHeroSlotCount }} 枠</span>
          <span>空き戦法 {{ emptySkillSlotCount }} 枠</span>
          <span>評価対象 {{ selectedTemplateTierLabel }}</span>
          <span>テンプレ {{ templateTeams.length }} 編成</span>
          <span>並列Worker {{ aiWorkerCount }} 個</span>
          <span>一次選別 {{ screeningBackendLabel }}</span>
          <span>兵学は主兵法＋副兵法5点の全設定パターン</span>
          <span>段階評価・上位周辺探索・軽量戦闘を使用</span>
          <span>武勇・知略差40以上は低い能力だけに依存する戦法を除外</span>
          <span>推定全組み合わせ {{ formatLargeNumber(estimatedCombinations) }}</span>
          <span>{{ reorderFixedHeroes ? '指定武将も主将/副将の配置替えを試行' : '指定武将の主将/副将位置を固定' }}</span>
          <span v-if="unsupportedFixedSkillNames.length" class="warning">
            「{{ unsupportedFixedSkillNames.join('、') }}」は戦法一覧で実装済みではないため使用できません。
          </span>
          <span v-if="!hasEnoughCandidates" class="warning">空き枠を埋める候補が不足しています。</span>
          <span v-else-if="searchSampleMode === 'sample'">
            {{ candidatePoolMode === 'owned' ? '所持中のS武将と実装済みS/A戦法' : 'S武将全体と実装済みS/A戦法全体' }}から
            ランダムに {{ formatNumber(sampleCount) }} 組を探索します。
          </span>
          <span v-else>
            条件を満たす全組み合わせを探索します（推定上限 {{ formatLargeNumber(estimatedCombinations) }} 組）。
          </span>
        </div>
      </section>

      <section v-if="running || topResults.length" class="panel results-panel">
        <div class="section-head">
          <div>
            <p class="eyebrow">探索結果</p>
            <h3>{{ resultHeading }}</h3>
          </div>
          <div v-if="running" class="progress-copy">
            {{ progressLabel }} {{ progress.done }} / {{ progress.total }} 組
          </div>
        </div>

        <el-progress
          v-if="running"
          :percentage="progressPercent"
          :stroke-width="8"
          striped
          striped-flow
        />

        <div v-if="topResults.length" class="result-grid" :class="{ 'is-detailed': showDetailedResults }">
          <article v-for="result in topResults" :key="result.id" class="result-card">
            <header>
              <span class="rank-badge">#{{ result.rank }}</span>
              <div>
                <h4>{{ result.lineup.name }}</h4>
                <p>勝率 {{ formatPercent(result.winRate) }} / 引分 {{ formatPercent(result.drawRate) }}</p>
              </div>
              <strong>{{ result.score.toFixed(1) }}</strong>
            </header>

            <div class="result-metrics">
              <span>兵力交換比 <b>{{ result.exchangeRatio.toFixed(2) }}</b></span>
              <span>評価 <b>{{ result.scoreTier }}</b></span>
              <span v-if="result.evaluationKind === 'gpu'">評価方式 <b>GPU概算</b></span>
              <span v-else>試行 <b>{{ formatNumber(result.totalRuns) }}</b></span>
            </div>

            <div v-if="showDetailedResults" class="result-lineup-scroll">
              <div class="result-lineup-detail">
                <AiResultRoleCard
                  v-for="role in roleConfigs"
                  :key="`${result.id}-${role.key}-detail`"
                  :title="role.label"
                  :role="result.lineup[role.key]"
                />
              </div>
            </div>

            <div v-else class="mini-lineup">
              <div v-for="role in roleConfigs" :key="`${result.id}-${role.key}`" class="mini-role">
                <img v-if="result.lineup[role.key].hero?.portrait" :src="result.lineup[role.key].hero?.portrait" loading="lazy" />
                <div class="mini-copy">
                  <span>{{ role.label }}</span>
                  <b>{{ heroName(result.lineup[role.key].hero) }}</b>
                  <small>{{ skillName(result.lineup[role.key].skill1) }} / {{ skillName(result.lineup[role.key].skill2) }}</small>
                </div>
              </div>
            </div>

            <div class="matchups">
              <div v-for="row in result.matchups.slice(0, 4)" :key="`${result.id}-${row.id}`">
                <span>{{ shortFormationName(row.name) }}</span>
                <b>{{ formatPercent(row.winRate) }}</b>
              </div>
            </div>
          </article>
        </div>
      </section>

      <el-empty v-else description="固定したい武将・戦法をセットして、AI探索を実行してください。" />
    </div>

    <el-dialog
      v-model="heroPickerVisible"
      title="武将を選択"
      width="min(920px, calc(100vw - 16px))"
      class="sim-picker-dialog"
      align-center
      append-to-body
    >
      <div class="picker-body">
        <HeroLibrary
          mode="select"
          :used-heroes="usedHeroNames"
          :owned-heroes="ownedHeroes"
          :filter-owned="candidatePoolMode === 'owned'"
          :allowed-rarities="[5, 4]"
          :show-troop-filter="false"
          @select="selectHeroFromLibrary"
        />
      </div>
    </el-dialog>

    <el-dialog
      v-model="skillPickerVisible"
      title="戦法を選択"
      width="min(760px, calc(100vw - 16px))"
      class="sim-picker-dialog"
      align-center
      append-to-body
    >
      <div class="picker-body">
        <SkillLibrary
          mode="select"
          precise-battle-implemented-only
          :used-skills="usedSkillNames"
          :owned-skills="ownedSkills"
          :filter-owned="candidatePoolMode === 'owned'"
          @select="selectSkillFromLibrary"
        />
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, reactive, ref } from 'vue'
import { CircleClose, VideoPlay } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import LineupSlot from '../components/LineupSlot.vue'
import AiResultRoleCard from '../components/ai/AiResultRoleCard.vue'
import HeroLibrary from '../components/HeroLibrary.vue'
import SkillLibrary from '../components/SkillLibrary.vue'
import TroopLevelSummary from '../components/lineup-builder/TroopLevelSummary.vue'
import type { BingxueActive, BingxueMinor, Lineup, RoleData } from '../composables/useLineups'
import { useTroopLevels } from '../composables/useTroopLevels'
import { useInventory } from '../composables/useInventory'
import { buildTemplateLookup, useData, type EnemyFormation, type Hero, type Skill } from '../composables/useData'
import {
  emptyAiOptimizerRole,
  useAiLineupOptimizerState,
  type AiOptimizerResult,
  type AiTemplateTier,
} from '../composables/useAiLineupOptimizerState'
import { battleSkillImplementation, battleSkillType, isExclusiveTeamSkillType } from '../lib/battleSkillEffects'
import { isAiSkillCompatibleWithStats } from '../lib/aiSkillCompatibility'
import { autoAllocatedHeroStats } from '../lib/aiHeroStatAllocation'
import { heroLevel50Stats } from '../lib/heroStats'
import { AiOptimizerWorkerPool, recommendedAiWorkerCount } from '../lib/aiOptimizerWorkerPool'
import {
  AI_GPU_COARSE_SCENARIOS,
  AI_GPU_SCREEN_CHUNK_SIZE,
  AI_GPU_SCREEN_SCENARIOS,
  AiOptimizerGpuScreener,
} from '../lib/aiOptimizerGpuScreener'
import {
  aiBingxuePatternsForHero,
  aiBingxuePatternCountForHero,
  cloneAiBingxue,
  hasConfiguredAiBingxue,
  randomAiBingxueForHero,
} from '../lib/aiBingxueSearch'
import {
  snapshotAiLineup,
  type AiWorkerEvaluationResult,
  type AiWorkerTemplate,
} from '../lib/aiOptimizerWorkerTypes'
import { normalizeTroopType } from '../constants/traits'
import type { TroopType } from '../constants/traits'

type RoleKey = 'main' | 'vice1' | 'vice2'
type SkillSlotKey = 'skill1' | 'skill2'

const roleConfigs: Array<{ key: RoleKey; label: string }> = [
  { key: 'main', label: '主将' },
  { key: 'vice1', label: '副将' },
  { key: 'vice2', label: '副将' },
]
const roleKeys: RoleKey[] = roleConfigs.map((role) => role.key)
const skillSlotKeys: SkillSlotKey[] = ['skill1', 'skill2']

const { heroes, skills, bingxue, enemyFormations } = useData()
const emptyRole = emptyAiOptimizerRole
const {
  seedTeam,
  running,
  topResults,
  progress,
  resultPhase,
  sampleCount,
  scoutRuns,
  finalRuns,
  reorderFixedHeroes,
  candidatePoolMode,
  searchSampleMode,
  selectedTemplateTiers,
} = useAiLineupOptimizerState()
const { ownedHeroes, ownedSkills, ownedHeroBreakthroughs } = useInventory()
const seedTroopLevels = useTroopLevels(computed(() => seedTeam))

const picker = reactive<{ role: RoleKey | null; skillSlot: number | null }>({
  role: null,
  skillSlot: null,
})
const heroPickerVisible = ref(false)
const skillPickerVisible = ref(false)
const emptyConflictSet = new Set<string>()
const autoBreakthrough = 5
const finalistCount = 8
const SCREEN_RUN_LIMIT = 3
const MAX_SCREEN_SURVIVORS = 1000
const MAX_REFINED_SURVIVORS = 200
const MAX_NEIGHBOR_CANDIDATES = 10000
const PARALLEL_QUEUE_MULTIPLIER = 2
const aiWorkerCount = recommendedAiWorkerCount()
const evaluationCache = new Map<string, AiWorkerEvaluationResult>()
const cancelRequested = ref(false)
const screeningBackend = ref<'auto' | 'gpu' | 'cpu'>('auto')
let activeWorkerPool: AiOptimizerWorkerPool | null = null
let activeGpuScreener: AiOptimizerGpuScreener | null = null
const candidatePoolOptions = [
  { label: '所持のみ', value: 'owned' },
  { label: 'すべて', value: 'all' },
]
const searchSampleModeOptions = [
  { label: '数値指定', value: 'sample' },
  { label: '全通り', value: 'all' },
]
const templateTierOptions: Array<{ label: string; value: AiTemplateTier }> = [
  { label: 'Tier 0', value: 'tier0' },
  { label: 'Tier 0.5', value: 'tier05' },
  { label: 'Tier 1', value: 'tier1' },
]

const clearOptimizerResults = (): void => {
  topResults.value = []
  resultPhase.value = 'idle'
}

const updateTemplateTier = (tier: AiTemplateTier, enabled: boolean): void => {
  const selectedCount = templateTierOptions.filter((option) => selectedTemplateTiers[option.value]).length
  if (!enabled && selectedTemplateTiers[tier] && selectedCount <= 1) {
    ElMessage.warning('評価対象のTierを1つ以上選択してください。')
    return
  }
  selectedTemplateTiers[tier] = enabled
  clearOptimizerResults()
}

const breakthroughForHero = (hero: Hero): number => {
  if (candidatePoolMode.value === 'all') return autoBreakthrough
  return Math.min(5, Math.max(0, Math.trunc(Number(ownedHeroBreakthroughs.value[hero.name]) || 0)))
}

const handleCandidatePoolChange = (): void => {
  // Match fixed slots to the selected assumption as well: registered counts
  // for owned-only exploration, or max breakthrough for the full library.
  for (const role of roleKeys) {
    const hero = seedTeam[role].hero
    if (hero) seedTeam[role].breakthrough = breakthroughForHero(hero)
  }
  clearOptimizerResults()
}

const setSeedTroopType = (troopType: TroopType | null): void => {
  seedTeam.troopType = troopType
  topResults.value = []
  resultPhase.value = 'idle'
}

const heroByKey = computed(() => new Map(heroOptions.value.map((hero) => [heroKey(hero), hero])))
const skillByKey = computed(() => new Map(skillOptions.value.map((skill) => [skillKey(skill), skill])))
const heroByTemplateKey = computed(() => buildTemplateLookup(heroes.value))
const skillByTemplateKey = computed(() => buildTemplateLookup(skills.value))

const usedHeroNames = computed(() => new Set(roleKeys.map((role) => seedTeam[role].hero?.name).filter(Boolean) as string[]))
const usedSkillNames = computed(() => new Set(roleKeys.flatMap((role) => [
  seedTeam[role].skill1?.name,
  seedTeam[role].skill2?.name,
]).filter(Boolean) as string[]))

const heroOptions = computed(() =>
  uniqueBy(heroes.value, heroKey)
    .filter((hero) => isPlayableHero(hero))
    .sort((a, b) => heroName(a).localeCompare(heroName(b), 'ja')),
)

const skillOptions = computed(() =>
  uniqueBy(skills.value, skillKey)
    .filter((skill) => isSelectableBattleSkill(skill))
    .sort((a, b) => skillName(a).localeCompare(skillName(b), 'ja')),
)

const fixedHeroKeys = computed(() => new Set(roleKeys.map((role) => seedTeam[role].hero).filter(Boolean).map((hero) => heroIdentity(hero as Hero))))
const fixedSkillKeys = computed(() => new Set(roleKeys.flatMap((role) => [seedTeam[role].skill1, seedTeam[role].skill2]).filter(Boolean).map((skill) => skillIdentity(skill as Skill))))
const fixedConfiguredBingxueHeroKeys = computed(() => new Set(roleKeys
  .map((role) => seedTeam[role])
  .filter((role) => role.hero && hasConfiguredAiBingxue(role.bingxue))
  .map((role) => heroIdentity(role.hero as Hero))))
const unsupportedFixedSkillNames = computed(() => [...new Set(
  roleKeys
    .flatMap((role) => [seedTeam[role].skill1, seedTeam[role].skill2])
    .filter((skill): skill is Skill => Boolean(skill))
    .filter((skill) => battleSkillImplementation(skill).status !== 'implemented')
    .map((skill) => skillName(skill)),
)])
const fixedRoleCount = computed(() => roleKeys.filter((role) => seedTeam[role].hero).length)
const emptyHeroSlotCount = computed(() => roleKeys.filter((role) => !seedTeam[role].hero).length)
const emptySkillSlotCount = computed(() => roleKeys.reduce((sum, role) => {
  if (!seedTeam[role].hero) return sum + 2
  return sum + skillSlotKeys.filter((slot) => !seedTeam[role][slot]).length
}, 0))

const heroCandidates = computed(() =>
  uniqueBy(heroes.value, heroIdentity)
    .filter((hero) => isSearchHero(hero))
    .filter((hero) => candidatePoolMode.value === 'all' || ownedHeroes.value.includes(hero.name))
    .filter((hero) => !fixedHeroKeys.value.has(heroIdentity(hero)))
    .sort((a, b) => heroCandidateScore(b) - heroCandidateScore(a) || heroName(a).localeCompare(heroName(b), 'ja'))
)

const skillCandidates = computed(() =>
  uniqueBy(skills.value, skillIdentity)
    .filter((skill) => isSelectableBattleSkill(skill))
    .filter((skill) => isSearchSkill(skill))
    .filter((skill) => candidatePoolMode.value === 'all' || ownedSkills.value.includes(skill.name))
    .filter((skill) => !fixedSkillKeys.value.has(skillIdentity(skill)))
    .sort((a, b) => skillCandidateScore(b) - skillCandidateScore(a) || skillName(a).localeCompare(skillName(b), 'ja'))
)

const selectedTemplateTierSet = computed(() => new Set(
  templateTierOptions
    .filter((option) => selectedTemplateTiers[option.value])
    .map((option) => option.value),
))
const selectedTemplateTierLabel = computed(() => templateTierOptions
  .filter((option) => selectedTemplateTiers[option.value])
  .map((option) => option.label)
  .join('・'))
const templateTierCounts = computed<Record<AiTemplateTier, number>>(() => ({
  tier0: enemyFormations.value.filter((formation) => formation.tier === 'tier0').length,
  tier05: enemyFormations.value.filter((formation) => formation.tier === 'tier05').length,
  tier1: enemyFormations.value.filter((formation) => formation.tier === 'tier1').length,
}))

// 選択したTierに含まれるテンプレを、GPU一次選別とCPU精密評価で共通して使用する。
const templateTeams = computed(() => enemyFormations.value
  .filter((formation) => selectedTemplateTierSet.value.has((formation.tier ?? '') as AiTemplateTier))
  .map((formation) => ({
    formation,
    lineup: lineupFromTemplate(formation),
  })))

const allTemplateIds = computed(() => templateTeams.value.map(({ formation }) => formation.id))

const estimatedCombinations = computed(() => {
  const fixedRoleCountValue = fixedRoleCount.value
  const rolePatternCount = reorderFixedHeroes.value
    ? permutationCount(roleKeys.length, fixedRoleCountValue)
    : 1
  const heroCount = permutationCount(heroCandidates.value.length, emptyHeroSlotCount.value)
  const skillCount = permutationCount(skillCandidates.value.length, emptySkillSlotCount.value)
  const availableHeroes = [
    ...roleKeys.map((role) => seedTeam[role].hero).filter((hero): hero is Hero => Boolean(hero)),
    ...heroCandidates.value,
  ]
  const configurableCounts = availableHeroes
    .map((hero) => aiBingxuePatternCountForHero(hero))
    .filter((count) => count > 0)
  const averageBingxueCount = configurableCounts.length > 0
    ? Math.max(1, Math.round(configurableCounts.reduce((sum, count) => sum + count, 0) / configurableCounts.length))
    : 1
  const fixedBingxueCount = roleKeys.reduce((total, role) => {
    const roleData = seedTeam[role]
    if (!roleData.hero || hasConfiguredAiBingxue(roleData.bingxue)) return total
    return cappedProduct([total, Math.max(1, aiBingxuePatternCountForHero(roleData.hero))])
  }, 1)
  const randomBingxueCount = cappedPower(averageBingxueCount, emptyHeroSlotCount.value)
  return cappedProduct([
    rolePatternCount,
    heroCount,
    skillCount,
    fixedBingxueCount,
    randomBingxueCount,
  ].map((value) => Math.max(1, value)))
})

const hasEnoughCandidates = computed(() =>
  heroCandidates.value.length >= emptyHeroSlotCount.value
  && skillCandidates.value.length >= emptySkillSlotCount.value,
)
const canOptimize = computed(() =>
  !running.value
  && templateTeams.value.length > 0
  && hasEnoughCandidates.value
  && unsupportedFixedSkillNames.value.length === 0
)
const progressPercent = computed(() => progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0)
const screeningBackendLabel = computed(() => {
  if (screeningBackend.value === 'gpu') {
    return `WebGPU（全候補${AI_GPU_COARSE_SCENARIOS}通り→上位${AI_GPU_SCREEN_SCENARIOS}通り・4バッチ並列）`
  }
  if (screeningBackend.value === 'cpu') return 'CPU Worker'
  return 'GPU自動判定'
})
const showDetailedResults = computed(() => !running.value && (resultPhase.value === 'done' || resultPhase.value === 'cancelled'))
const resultHeading = computed(() => {
  if (resultPhase.value === 'screen') {
    return screeningBackend.value === 'gpu'
      ? `GPUで${templateTeams.value.length}編成を一次選別中`
      : `${templateTeams.value.length}編成を少数試行で段階評価中`
  }
  if (resultPhase.value === 'scout') return `一次候補を${templateTeams.value.length}編成で再評価中`
  if (resultPhase.value === 'neighbor') return '上位編成の周辺を探索中'
  if (resultPhase.value === 'final') return '一次結果を表示中 / 上位を最終再評価中'
  if (resultPhase.value === 'done') return '最終評価 上位 3 組'
  if (resultPhase.value === 'cancelled') return '中止時点の上位 3 組'
  return '勝率上位 3 組'
})
const progressLabel = computed(() => {
  if (resultPhase.value === 'final') return '最終再評価'
  if (resultPhase.value === 'neighbor') return '周辺探索'
  if (resultPhase.value === 'scout') return `${templateTeams.value.length}編成評価`
  const prefix = screeningBackend.value === 'gpu' ? 'GPU ' : ''
  return prefix + (searchSampleMode.value === 'all' ? '全通り一次選別' : 'モンテカルロ一次選別')
})

const setHero = (role: RoleKey, value: string) => {
  const hero = heroByKey.value.get(value) ?? null
  seedTeam[role].hero = hero
  seedTeam[role].skill1 = null
  seedTeam[role].skill2 = null
  seedTeam[role].bingxue = { direction: null, major: null, minors: [] }
  seedTeam[role].breakthrough = hero ? breakthroughForHero(hero) : 0
  seedTeam[role].stats = hero ? { ...heroLevel50Stats(hero) } : emptyRole().stats
  topResults.value = []
  resultPhase.value = 'idle'
}

const openHeroPicker = (role: RoleKey) => {
  picker.role = role
  picker.skillSlot = null
  heroPickerVisible.value = true
}

const selectHeroFromLibrary = (hero: Hero) => {
  if (!picker.role) return
  setHero(picker.role, heroKey(hero))
  heroPickerVisible.value = false
}

const openSkillPicker = (role: RoleKey, slot: number) => {
  picker.role = role
  picker.skillSlot = slot
  skillPickerVisible.value = true
}

const assignSkill = (role: RoleKey, slot: number, skill: Skill) => {
  const slotKey = slot === 1 ? 'skill1' : 'skill2'
  const nextSkill = skillByKey.value.get(skillKey(skill)) ?? skill
  clearExclusiveTeamSkill(seedTeam, nextSkill, role, slotKey)
  seedTeam[role][slotKey] = nextSkill
  topResults.value = []
  resultPhase.value = 'idle'
}

const selectSkillFromLibrary = (skill: Skill) => {
  if (!picker.role || !picker.skillSlot) return
  assignSkill(picker.role, picker.skillSlot, skill)
  skillPickerVisible.value = false
}

const cancelOptimizer = (): void => {
  if (!running.value) return
  cancelRequested.value = true
  // 実行中と待機中のGPU・Workerタスクをまとめて終了する。
  activeGpuScreener?.destroy()
  activeWorkerPool?.destroy()
}

const ensureSearchContinues = (): void => {
  if (cancelRequested.value) throw new Error('AI探索を中止しました。')
}

const runOptimizer = async () => {
  if (!canOptimize.value) return
  cancelRequested.value = false
  running.value = true
  topResults.value = []
  resultPhase.value = 'screen'
  screeningBackend.value = 'auto'
  progress.done = 0
  progress.total = 0
  try {
    // Workerにはテンプレを起動時に一度だけ渡し、各候補は武将・戦法IDと属性値だけ送る。
    const workerTemplates: AiWorkerTemplate[] = templateTeams.value.map(({ formation, lineup }) => ({
      id: formation.id,
      name: formation.name,
      lineup: snapshotAiLineup(lineup),
    }))
    const workerPool = new AiOptimizerWorkerPool(
      aiWorkerCount,
      heroes.value,
      skills.value,
      workerTemplates,
    )
    activeWorkerPool = workerPool

    // WebGPUが使える端末では、全21テンプレに対する一次選別だけをGPUへ任せる。
    // 最終的な順位は、この後のCPU Workerによる通常戦闘で必ず再評価する。
    activeGpuScreener = await AiOptimizerGpuScreener.create(
      heroes.value,
      skills.value,
      workerTemplates.map((template) => template.lineup),
      bingxue.value,
    )
    screeningBackend.value = activeGpuScreener ? 'gpu' : 'cpu'

    // 数値指定は重複を除いたモンテカルロ候補、全通りは候補を溜めず遅延列挙する。
    const initialCandidateFactory = (): Iterable<Lineup> => searchSampleMode.value === 'sample'
      ? buildMonteCarloLineups(sampleCount.value)
      : buildAllCandidateLineups()
    const initialTotal = searchSampleMode.value === 'sample'
      ? sampleCount.value
      : estimatedCombinations.value
    const screenKeep = Math.min(
      MAX_SCREEN_SURVIVORS,
      Math.max(finalistCount * 5, Math.ceil(Math.min(initialTotal, MAX_SCREEN_SURVIVORS * 10) * 0.1)),
    )
    const screenRuns = Math.max(1, Math.min(SCREEN_RUN_LIMIT, scoutRuns.value))

    // 第1段階は選択したTierの全テンプレを少数試行し、明らかに弱い候補を早く除外する。
    const screened = await evaluateScreenStage(workerPool, initialCandidateFactory, {
      runs: screenRuns,
      templateIds: allTemplateIds.value,
      idPrefix: 'screen',
      total: initialTotal,
      keep: screenKeep,
    })
    ensureSearchContinues()

    // 第2段階は一次選別を通過した候補だけを、選択したTierの全テンプレで評価する。
    resultPhase.value = 'scout'
    const refined = await evaluateCandidateStage(workerPool, screened.map((result) => result.lineup), {
      runs: scoutRuns.value,
      templateIds: allTemplateIds.value,
      idPrefix: 'scout',
      total: screened.length,
      keep: Math.min(MAX_REFINED_SURVIVORS, screened.length),
    })
    ensureSearchContinues()

    // 上位候補の武将または戦法を一部だけ変え、ランダム探索で見つけた山の周辺を掘る。
    resultPhase.value = 'neighbor'
    const neighborTarget = Math.min(
      MAX_NEIGHBOR_CANDIDATES,
      Math.max(100, Math.round((searchSampleMode.value === 'sample' ? initialTotal : sampleCount.value) * 0.2)),
    )
    const neighborCandidates = buildNeighborhoodLineups(refined, neighborTarget)
    let neighborRefined: AiOptimizerResult[] = []
    if (neighborCandidates.length > 0) {
      const neighborScreened = await evaluateScreenStage(workerPool, () => neighborCandidates, {
        runs: screenRuns,
        templateIds: allTemplateIds.value,
        idPrefix: 'neighbor-screen',
        total: neighborCandidates.length,
        keep: Math.min(MAX_SCREEN_SURVIVORS, Math.max(finalistCount * 3, Math.ceil(neighborCandidates.length * 0.1))),
      })
      neighborRefined = await evaluateCandidateStage(workerPool, neighborScreened.map((result) => result.lineup), {
        runs: scoutRuns.value,
        templateIds: allTemplateIds.value,
        idPrefix: 'neighbor',
        total: neighborScreened.length,
        keep: Math.min(MAX_REFINED_SURVIVORS, neighborScreened.length),
      })
      ensureSearchContinues()
    }

    const finalists = uniqueOptimizerResults([...refined, ...neighborRefined])
      .sort(compareOptimizerResults)
      .slice(0, finalistCount)
    topResults.value = rankedTopResults(finalists)
    resultPhase.value = 'final'
    await nextTick()
    await waitForPaint()

    // 最後に上位だけ試行数を増やし、少数試行の乱数ぶれを抑えて順位を確定する。
    const finalResults = await evaluateCandidateStage(workerPool, finalists.map((result) => result.lineup), {
      runs: finalRuns.value,
      templateIds: allTemplateIds.value,
      idPrefix: 'final',
      total: finalists.length,
      keep: finalists.length,
    })
    topResults.value = rankedTopResults(finalResults)
    resultPhase.value = 'done'
  } catch (error) {
    if (cancelRequested.value) {
      resultPhase.value = topResults.value.length > 0 ? 'cancelled' : 'idle'
      ElMessage.info('AI探索を中止しました。')
    } else {
      resultPhase.value = topResults.value.length > 0 ? resultPhase.value : 'idle'
      ElMessage.error(error instanceof Error ? error.message : 'AI探索中にエラーが発生しました。')
    }
  } finally {
    activeGpuScreener?.destroy()
    activeGpuScreener = null
    activeWorkerPool?.destroy()
    activeWorkerPool = null
    running.value = false
  }
}

interface EvaluationStageOptions {
  runs: number
  templateIds: string[]
  idPrefix: string
  total: number
  keep: number
  gpuScenarios?: number
}

// GPU一次選別に失敗した場合は、候補を作り直して同じ段階をCPU Workerで継続する。
const evaluateScreenStage = async (
  pool: AiOptimizerWorkerPool,
  candidateFactory: () => Iterable<Lineup>,
  options: EvaluationStageOptions,
): Promise<AiOptimizerResult[]> => {
  if (activeGpuScreener) {
    try {
      const coarseScenarios = options.total <= 1000
        ? AI_GPU_SCREEN_SCENARIOS
        : options.total <= 2000
          ? 256
          : AI_GPU_COARSE_SCENARIOS
      const coarseResults = await evaluateGpuCandidateStage(activeGpuScreener, candidateFactory(), {
        ...options,
        gpuScenarios: coarseScenarios,
      })
      if (coarseScenarios >= AI_GPU_SCREEN_SCENARIOS || coarseResults.length === 0) return coarseResults

      // 全候補は軽く絞り、最大1000組の上位だけを1024通りで再選別する。
      return await evaluateGpuCandidateStage(activeGpuScreener, coarseResults.map((result) => result.lineup), {
        ...options,
        idPrefix: `${options.idPrefix}-gpu1024`,
        total: coarseResults.length,
        keep: Math.min(options.keep, coarseResults.length),
        gpuScenarios: AI_GPU_SCREEN_SCENARIOS,
      })
    } catch (error) {
      if (cancelRequested.value) throw error
      activeGpuScreener.destroy()
      activeGpuScreener = null
      screeningBackend.value = 'cpu'
      topResults.value = []
    }
  }
  return evaluateCandidateStage(pool, candidateFactory(), options)
}

// 兵学を含む固定特徴量で候補をまとめてGPU評価し、上位だけを保持する。
const evaluateGpuCandidateStage = async (
  screener: AiOptimizerGpuScreener,
  candidates: Iterable<Lineup>,
  options: EvaluationStageOptions,
): Promise<AiOptimizerResult[]> => {
  progress.done = 0
  progress.total = options.total
  const retained: AiOptimizerResult[] = []
  const stageSeen = new Set<string>()
  const inFlight = new Set<Promise<void>>()
  let batch: Lineup[] = []
  let candidateIndex = 0

  const processBatch = async (currentBatch: Lineup[]): Promise<void> => {
    ensureSearchContinues()
    const scores = await screener.scoreBatch(currentBatch, options.gpuScenarios)
    ensureSearchContinues()

    currentBatch.forEach((lineup, index) => {
      const score = Math.max(0, Math.min(100, Number(scores[index]) || 0))
      const exchangeRatio = Math.min(9.99, score / Math.max(1, 100 - score))
      candidateIndex += 1
      insertRankedResult(retained, {
        id: `${options.idPrefix}-gpu-${candidateIndex}-${canonicalCandidateSignature(lineup)}`,
        rank: 0,
        lineup: cloneLineup(lineup),
        winRate: score / 100,
        drawRate: 0,
        exchangeRatio,
        score,
        scoreTier: tierFromScore(score),
        totalRuns: 0,
        matchups: [],
        evaluationKind: 'gpu',
      }, options.keep)
    })
    progress.done += currentBatch.length
    topResults.value = rankedTopResults(retained)
    await nextTick()
    await waitForPaint()
  }

  const submitBatch = async (): Promise<void> => {
    if (batch.length === 0) return
    const currentBatch = batch
    batch = []
    let task: Promise<void>
    task = processBatch(currentBatch).finally(() => inFlight.delete(task))
    inFlight.add(task)

    // 特徴量作成・GPU実行・結果読み戻しを最大4バッチまで重ねて待ち時間を隠す。
    if (inFlight.size >= screener.maxInFlightBatches) await Promise.race(inFlight)
  }

  try {
    for (const lineup of candidates) {
      ensureSearchContinues()
      const signature = canonicalCandidateSignature(lineup)
      if (stageSeen.has(signature)) continue
      stageSeen.add(signature)
      batch.push(lineup)
      if (batch.length >= AI_GPU_SCREEN_CHUNK_SIZE) await submitBatch()
    }
    await submitBatch()
    await Promise.all(inFlight)
  } catch (error) {
    // 先に失敗したバッチがあっても、残りのPromiseを回収して未処理例外を残さない。
    screener.destroy()
    await Promise.allSettled(inFlight)
    throw error
  }
  progress.total = progress.done
  return retained
}

const evaluateCandidateStage = async (
  pool: AiOptimizerWorkerPool,
  candidates: Iterable<Lineup>,
  options: EvaluationStageOptions,
): Promise<AiOptimizerResult[]> => {
  progress.done = 0
  progress.total = options.total
  const retained: AiOptimizerResult[] = []
  const stageSeen = new Set<string>()
  const inFlight = new Set<Promise<void>>()
  const queueLimit = Math.max(1, pool.size * PARALLEL_QUEUE_MULTIPLIER)
  let candidateIndex = 0

  for (const lineup of candidates) {
    ensureSearchContinues()
    const signature = canonicalCandidateSignature(lineup)
    if (stageSeen.has(signature)) continue
    stageSeen.add(signature)
    candidateIndex += 1
    const index = candidateIndex
    let task: Promise<void>
    task = evaluateLineup(pool, lineup, options.runs, options.idPrefix, options.templateIds, index)
      .then((result) => {
        insertRankedResult(retained, result, options.keep)
        progress.done += 1
        // Workerが1組を返すたびに、現在の上位3組を即座に表示する。
        topResults.value = rankedTopResults(retained)
      })
      .finally(() => inFlight.delete(task))
    inFlight.add(task)

    if (inFlight.size >= queueLimit) await Promise.race(inFlight)
  }
  await Promise.all(inFlight)
  // 全通り列挙や対称重複除外では推定上限と実評価数が異なるため、完了時に実数へ合わせる。
  progress.total = progress.done
  return retained
}

const evaluateLineup = async (
  pool: AiOptimizerWorkerPool,
  lineup: Lineup,
  runs: number,
  idPrefix: string,
  templateIds: string[],
  index: number,
): Promise<AiOptimizerResult> => {
  const signature = canonicalCandidateSignature(lineup)
  const cacheKey = `${signature}::${runs}::${templateIds.join(',')}`
  let evaluation = evaluationCache.get(cacheKey)
  if (!evaluation) {
    evaluation = await pool.evaluate(snapshotAiLineup(lineup), runs, signature, templateIds)
    evaluationCache.set(cacheKey, evaluation)
    // 長時間利用時もキャッシュが無制限に増えないよう、古い結果から破棄する。
    if (evaluationCache.size > 25000) {
      const oldestKey = evaluationCache.keys().next().value
      if (typeof oldestKey === 'string') evaluationCache.delete(oldestKey)
    }
  }

  return {
    id: `${idPrefix}-${index}-${signature}`,
    rank: 0,
    lineup: cloneLineup(lineup),
    winRate: evaluation.winRate,
    drawRate: evaluation.drawRate,
    exchangeRatio: evaluation.exchangeRatio,
    score: evaluation.score,
    scoreTier: tierFromScore(evaluation.score),
    totalRuns: evaluation.totalRuns,
    matchups: evaluation.matchups,
    evaluationKind: 'cpu',
  }
}

function* buildMonteCarloLineups(count: number): Generator<Lineup> {
  const seen = new Set<string>()
  let attempts = 0
  let generated = 0
  const maxAttempts = Math.max(100, count * 80)
  while (generated < count && attempts < maxAttempts) {
    attempts += 1
    const lineup = randomCandidateLineup(generated + 1)
    if (!lineup) continue
    const signature = canonicalCandidateSignature(lineup)
    if (seen.has(signature)) continue
    seen.add(signature)
    generated += 1
    yield lineup
  }
}

// 一次評価上位の編成から、武将または戦法を1か所だけ変えた近傍候補を作る。
const buildNeighborhoodLineups = (seeds: AiOptimizerResult[], count: number): Lineup[] => {
  if (seeds.length === 0 || count <= 0) return []
  const lineups: Lineup[] = []
  const seen = new Set(seeds.map((result) => canonicalCandidateSignature(result.lineup)))
  let attempts = 0
  const maxAttempts = Math.max(200, count * 60)

  while (lineups.length < count && attempts < maxAttempts) {
    const base = seeds[attempts % seeds.length]
    attempts += 1
    if (!base) continue
    const candidate = mutateCandidateLineup(base.lineup, lineups.length + 1)
    if (!candidate) continue
    const signature = canonicalCandidateSignature(candidate)
    if (seen.has(signature)) continue
    seen.add(signature)
    lineups.push(candidate)
  }
  return lineups
}

const mutateCandidateLineup = (base: Lineup, index: number): Lineup | null => {
  const team = cloneLineup(base)
  const mutableHeroRoles = roleKeys.filter((role) => {
    const hero = team[role].hero
    return hero && !fixedHeroKeys.value.has(heroIdentity(hero))
  })
  const mutableSkillSlots = roleKeys.flatMap((role) => skillSlotKeys
    .filter((slot) => {
      const skill = team[role][slot]
      return skill && !fixedSkillKeys.value.has(skillIdentity(skill))
    })
    .map((slot) => ({ role, slot })))
  const mutableBingxueRoles = roleKeys.filter((role) => {
    const hero = team[role].hero
    return hero
      && !fixedConfiguredBingxueHeroKeys.value.has(heroIdentity(hero))
      && aiBingxuePatternCountForHero(hero) > 0
  })

  // 武将・戦法・兵学のうち変更できる項目を1つ選び、上位候補の周辺を探索する。
  const mutationChoices = [
    ...Array.from({ length: mutableHeroRoles.length > 0 ? 6 : 0 }, () => 'hero' as const),
    ...Array.from({ length: mutableSkillSlots.length > 0 ? 9 : 0 }, () => 'skill' as const),
    ...Array.from({ length: mutableBingxueRoles.length > 0 ? 5 : 0 }, () => 'bingxue' as const),
  ]
  const mutationKind = randomItem(mutationChoices)
  if (!mutationKind) return null

  if (mutationKind === 'hero') {
    const role = randomItem(mutableHeroRoles)
    if (!role) return null
    const currentHero = team[role].hero
    const usedHeroes = new Set(roleKeys
      .filter((candidateRole) => candidateRole !== role)
      .map((candidateRole) => team[candidateRole].hero)
      .filter(Boolean)
      .map((hero) => heroIdentity(hero as Hero)))
    const replacements = heroCandidates.value.filter((hero) =>
      heroIdentity(hero) !== (currentHero ? heroIdentity(currentHero) : '')
      && !usedHeroes.has(heroIdentity(hero)))
    const hero = randomItem(replacements)
    if (!hero) return null
    team[role] = autoRole(hero)
  } else if (mutationKind === 'skill') {
    const target = randomItem(mutableSkillSlots)
    if (!target) return null
    team[target.role][target.slot] = null
  } else {
    const role = randomItem(mutableBingxueRoles)
    const hero = role ? team[role].hero : null
    if (!role || !hero) return null
    const currentSignature = bingxueSignature(team[role].bingxue)
    const alternatives = aiBingxuePatternsForHero(hero)
      .filter((pattern) => bingxueSignature(pattern) !== currentSignature)
    const selected = randomItem(alternatives)
    if (!selected) return null
    team[role].bingxue = cloneAiBingxue(selected)
  }

  normalizeExclusiveTeamSkills(team)
  fillRandomBingxueSlots(team)
  if (!fillRandomSkillSlots(team)) return null
  team.name = `AI周辺候補 ${index}`
  return team
}

// 固定条件と候補条件を満たす編成を、配列へ溜めず1組ずつ全列挙する。
function* buildAllCandidateLineups(): Generator<Lineup> {
  // 探索開始時点の候補を固定し、実行中に画面設定が変わっても列挙内容を変えない。
  const heroes = [...heroCandidates.value]
  const skills = [...skillCandidates.value]
  let index = 0

  // 指定武将の配置パターンを順に作る。
  for (const placedTeam of fixedHeroPlacementLineups()) {
    // 残りの武将枠へ、重複なしですべての武将順列を入れる。
    for (const heroTeam of fillAllHeroSlots(placedTeam, heroes)) {
      normalizeExclusiveTeamSkills(heroTeam)
      // 固定していない兵学を、武将ごとの主兵法＋副兵法5点の全設定へ展開する。
      for (const bingxueTeam of fillAllBingxueSlots(heroTeam)) {
        // 残りの戦法枠へ、能力適性と兵種・陣法の制約を満たすすべての戦法順列を入れる。
        for (const completedTeam of fillAllSkillSlots(bingxueTeam, skills)) {
          index += 1
          completedTeam.name = `AI候補 ${index}`
          yield completedTeam
        }
      }
    }
  }
}

// 指定済み武将を、位置固定なら元の枠へ、位置可変なら主将・副将の全配置へ展開する。
function* fixedHeroPlacementLineups(): Generator<Lineup> {
  if (!reorderFixedHeroes.value) {
    const team = emptyLineup('AI探索編成')
    roleKeys.forEach((role) => {
      if (seedTeam[role].hero) team[role] = cloneRole(seedTeam[role])
    })
    yield team
    return
  }

  const fixedBlocks = roleKeys
    .map((role) => seedTeam[role])
    .filter((role) => role.hero)
    .map((role) => cloneRole(role))

  for (const assignedRoles of orderedSelections(roleKeys, fixedBlocks.length)) {
    const team = emptyLineup('AI探索編成')
    fixedBlocks.forEach((block, index) => {
      const role = assignedRoles[index]
      if (role) team[role] = cloneRole(block)
    })
    yield team
  }
}

// 空いている武将枠へ、候補武将を重複なしで全通り割り当てる。
function* fillAllHeroSlots(team: Lineup, candidates: Hero[]): Generator<Lineup> {
  const emptyRoles = roleKeys.filter((role) => !team[role].hero)
  const working = cloneLineup(team)

  function* visit(slotIndex: number, available: Hero[]): Generator<Lineup> {
    if (slotIndex >= emptyRoles.length) {
      yield cloneLineup(working)
      return
    }

    const role = emptyRoles[slotIndex]
    if (!role) return
    for (const [candidateIndex, hero] of available.entries()) {
      working[role] = autoRole(hero)
      const remaining = available.filter((_, index) => index !== candidateIndex)
      yield* visit(slotIndex + 1, remaining)
    }
    working[role] = emptyRole()
  }

  yield* visit(0, candidates)
}

// 画面で兵学を指定した武将はその設定を維持し、空欄の武将だけ全有効パターンへ展開する。
function* fillAllBingxueSlots(team: Lineup): Generator<Lineup> {
  const working = cloneLineup(team)
  const roles = roleKeys.filter((role) => working[role].hero && !hasConfiguredAiBingxue(working[role].bingxue))

  function* visit(roleIndex: number): Generator<Lineup> {
    if (roleIndex >= roles.length) {
      yield cloneLineup(working)
      return
    }

    const role = roles[roleIndex]
    const hero = role ? working[role].hero : null
    if (!role || !hero) return
    const patterns = aiBingxuePatternsForHero(hero)
    if (patterns.length === 0) {
      yield* visit(roleIndex + 1)
      return
    }
    for (const pattern of patterns) {
      working[role].bingxue = cloneAiBingxue(pattern)
      yield* visit(roleIndex + 1)
    }
    working[role].bingxue = { direction: null, major: null, minors: [] }
  }

  yield* visit(0)
}

// 空いている戦法枠へ、候補戦法を重複なし・能力適性ありで全通り割り当てる。
function* fillAllSkillSlots(team: Lineup, candidates: Skill[]): Generator<Lineup> {
  const working = cloneLineup(team)
  const slots = roleKeys.flatMap((role) =>
    skillSlotKeys
      .filter((slot) => working[role].hero && !working[role][slot])
      .map((slot) => ({ role, slot })),
  )
  const usedSkills = new Set(roleKeys.flatMap((role) => [working[role].skill1, working[role].skill2])
    .filter(Boolean)
    .map((skill) => skillIdentity(skill as Skill)))
  const exclusiveTypes = new Set(roleKeys.flatMap((role) => [working[role].skill1, working[role].skill2])
    .filter(Boolean)
    .filter((skill) => isExclusiveTeamSkillType(skill as Skill))
    .map((skill) => battleSkillType(skill as Skill)))

  function* visit(slotIndex: number): Generator<Lineup> {
    if (slotIndex >= slots.length) {
      yield cloneLineup(working)
      return
    }

    const slot = slots[slotIndex]
    if (!slot) return
    const roleStats = working[slot.role].stats
    for (const skill of candidates) {
      const key = skillIdentity(skill)
      const type = battleSkillType(skill)
      if (usedSkills.has(key)) continue
      if (!isAiSkillCompatibleWithStats(skill, Number(roleStats.val), Number(roleStats.int))) continue
      if (isExclusiveTeamSkillType(skill) && exclusiveTypes.has(type)) continue

      working[slot.role][slot.slot] = skill
      usedSkills.add(key)
      if (isExclusiveTeamSkillType(skill)) exclusiveTypes.add(type)

      yield* visit(slotIndex + 1)

      working[slot.role][slot.slot] = null
      usedSkills.delete(key)
      if (isExclusiveTeamSkillType(skill)) exclusiveTypes.delete(type)
    }
  }

  yield* visit(0)
}

// n個から重複なしでr個を選ぶ順列を、全パターン返す。
function* orderedSelections<T>(items: T[], count: number): Generator<T[]> {
  if (count <= 0) {
    yield []
    return
  }
  if (items.length < count) return

  for (const [index, item] of items.entries()) {
    const remaining = items.filter((_, candidateIndex) => candidateIndex !== index)
    for (const tail of orderedSelections(remaining, count - 1)) {
      yield [item, ...tail]
    }
  }
}

const randomCandidateLineup = (index: number): Lineup | null => {
  const team = emptyLineup('AI探索編成')
  if (reorderFixedHeroes.value) {
    const fixedBlocks = shuffled(roleKeys
      .map((role) => seedTeam[role])
      .filter((role) => role.hero)
      .map((role) => cloneRole(role)))
    const availableRoles = shuffled([...roleKeys])

    for (const block of fixedBlocks) {
      const role = takeRandom(availableRoles)
      if (!role) return null
      team[role] = cloneRole(block)
    }
  } else {
    // 位置固定時は、指定済みの主将・副将を元の枠へそのまま配置する。
    for (const role of roleKeys) {
      if (seedTeam[role].hero) team[role] = cloneRole(seedTeam[role])
    }
  }

  normalizeExclusiveTeamSkills(team)
  const usedHeroes = new Set(roleKeys.map((role) => team[role].hero).filter(Boolean).map((hero) => heroIdentity(hero as Hero)))
  const availableHeroes = heroCandidates.value.filter((hero) => !usedHeroes.has(heroIdentity(hero)))

  for (const role of roleKeys) {
    if (team[role].hero) continue
    const hero = takeRandom(availableHeroes)
    if (!hero) return null
    team[role] = autoRole(hero)
    usedHeroes.add(heroIdentity(hero))
  }

  fillRandomBingxueSlots(team)
  if (!fillRandomSkillSlots(team)) return null

  team.name = `AI候補 ${index}`
  return team
}

// モンテカルロ探索では、未指定の各武将へ設定可能な兵学を一様に1組選ぶ。
const fillRandomBingxueSlots = (team: Lineup): void => {
  for (const role of roleKeys) {
    const roleData = team[role]
    if (!roleData.hero || hasConfiguredAiBingxue(roleData.bingxue)) continue
    roleData.bingxue = randomAiBingxueForHero(roleData.hero)
  }
}

const fillRandomSkillSlots = (team: Lineup): boolean => {
  const usedSkills = new Set(roleKeys.flatMap((role) => [team[role].skill1, team[role].skill2])
    .filter(Boolean)
    .map((skill) => skillIdentity(skill as Skill)))
  const exclusiveTypes = new Set(roleKeys.flatMap((role) => [team[role].skill1, team[role].skill2])
    .filter(Boolean)
    .filter((skill) => isExclusiveTeamSkillType(skill as Skill))
    .map((skill) => battleSkillType(skill as Skill)))
  const slots = roleKeys.flatMap((role) => skillSlotKeys
    .filter((slot) => team[role].hero && !team[role][slot])
    .map((slot) => ({ role, slot })))

  for (const { role, slot } of slots) {
    const roleStats = team[role].stats
    const candidates = skillCandidates.value.filter((skill) => {
      const key = skillIdentity(skill)
      const type = battleSkillType(skill)
      return !usedSkills.has(key)
        && isAiSkillCompatibleWithStats(skill, Number(roleStats.val), Number(roleStats.int))
        && (!isExclusiveTeamSkillType(skill) || !exclusiveTypes.has(type))
    })
    const skill = randomItem(candidates)
    if (!skill) return false
    team[role][slot] = skill
    usedSkills.add(skillIdentity(skill))
    if (isExclusiveTeamSkillType(skill)) exclusiveTypes.add(battleSkillType(skill))
  }
  return true
}

const roleFromTemplateMember = (member: EnemyFormation['members'][number]): RoleData => {
  const hero = heroByTemplateKey.value.get(member.commander_id) ?? null
  const base = emptyRole()
  return {
    ...base,
    hero,
    skill1: member.skill1_id ? skillByTemplateKey.value.get(member.skill1_id) ?? null : null,
    skill2: member.skill2_id ? skillByTemplateKey.value.get(member.skill2_id) ?? null : null,
    breakthrough: autoBreakthrough,
    stats: statsWithFocus(hero, member.stat_focus, autoBreakthrough),
    bingxue: member.bingxue
      ? {
          direction: member.bingxue.direction,
          major: member.bingxue.major,
          minors: member.bingxue.minors.map((minor) => ({ ...minor })),
        }
      : base.bingxue,
  }
}

const lineupFromTemplate = (formation: EnemyFormation): Lineup => {
  const lineup: Lineup = {
    name: formation.name,
    troopType: normalizeTroopType(formation.troop_types?.[0] ?? ''),
    main: roleFromTemplateMember(formation.members[0]),
    vice1: roleFromTemplateMember(formation.members[1]),
    vice2: roleFromTemplateMember(formation.members[2]),
  }
  normalizeExclusiveTeamSkills(lineup)
  return lineup
}

const statsWithFocus = (hero: Hero | null, focus?: string, breakthrough = autoBreakthrough): RoleData['stats'] => {
  const stats = { ...emptyRole().stats, ...heroLevel50Stats(hero) }
  const keys: Array<keyof RoleData['stats']> = []
  if (/速度/.test(focus ?? '')) keys.push('spd')
  if (/武勇|武/.test(focus ?? '')) keys.push('val')
  if (/知略|知/.test(focus ?? '')) keys.push('int')
  if (/統率|統/.test(focus ?? '')) keys.push('lea')
  let remaining = 50 + breakthrough * 10
  keys.forEach((key, index) => {
    const points = index === keys.length - 1 ? remaining : Math.floor(remaining / (keys.length - index))
    stats[key] = (stats[key] ?? 100) + points
    remaining -= points
  })
  return stats
}

const autoRole = (hero: Hero): RoleData => {
  const breakthrough = breakthroughForHero(hero)
  const uniqueSkill = hero.unique_skill
    ? skillByTemplateKey.value.get(hero.unique_skill) ?? null
    : null

  return {
    ...emptyRole(),
    hero,
    breakthrough,
    // 空き枠へ自動選出した武将は、固有戦法の依存属性へ追加ポイントも配分する。
    stats: autoAllocatedHeroStats(hero, uniqueSkill, breakthrough),
  }
}

const hydratedStats = (role: RoleData): RoleData['stats'] => {
  const isUninitialized = role.hero && Object.values(role.stats).every((value) => Number(value) === 100)
  return isUninitialized ? { ...heroLevel50Stats(role.hero) } : { ...role.stats }
}

const cloneRole = (role: RoleData): RoleData => ({
  hero: role.hero,
  skill1: role.skill1,
  skill2: role.skill2,
  stats: hydratedStats(role),
  breakthrough: role.hero ? role.breakthrough : 0,
  bingxue: {
    direction: role.bingxue.direction,
    major: role.bingxue.major,
    minors: role.bingxue.minors.map((minor): BingxueMinor => ({ ...minor })),
  },
})

const cloneLineup = (lineup: Lineup): Lineup => ({
  name: lineup.name,
  troopType: lineup.troopType ?? null,
  main: cloneRole(lineup.main),
  vice1: cloneRole(lineup.vice1),
  vice2: cloneRole(lineup.vice2),
})

const emptyLineup = (name: string): Lineup => ({
  name,
  troopType: seedTeam.troopType ?? null,
  main: emptyRole(),
  vice1: emptyRole(),
  vice2: emptyRole(),
})

const clearExclusiveTeamSkill = (team: Lineup, incoming: Skill, keepRole: RoleKey, keepSlot: SkillSlotKey) => {
  if (!isExclusiveTeamSkillType(incoming)) return
  const incomingType = battleSkillType(incoming)
  roleKeys.forEach((role) => {
    skillSlotKeys.forEach((slot) => {
      if (role === keepRole && slot === keepSlot) return
      const current = team[role][slot]
      if (!current || battleSkillType(current) !== incomingType) return
      team[role][slot] = null
    })
  })
}

const normalizeExclusiveTeamSkills = (team: Lineup) => {
  const seen = new Set<string>()
  roleKeys.forEach((role) => {
    skillSlotKeys.forEach((slot) => {
      const skill = team[role][slot]
      if (!skill || !isExclusiveTeamSkillType(skill)) return
      const type = battleSkillType(skill)
      if (!seen.has(type)) {
        seen.add(type)
        return
      }
      team[role][slot] = null
    })
  })
}

const isPlayableHero = (hero: Hero): boolean => Number(hero.rarity) >= 4 || hero.rarity === 'S' || hero.rarity === 'A'
const isSearchHero = (hero: Hero): boolean => Number(hero.rarity) === 5 || hero.rarity === 'S'
const isSearchSkill = (skill: Skill): boolean =>
  (skill.rarity === 'S' || skill.rarity === 'A')
  // 重農主義は内政専用なので、実装済み表示になっても戦闘用のAI候補へは入れない。
  && ![skill.name_jp, skill.name].includes('重農主義')
const isSelectableBattleSkill = (skill: Skill): boolean => {
  if (!skill || skill.is_fixed || skill.is_unique) return false
  return battleSkillImplementation(skill).status === 'implemented'
}

const heroCandidateScore = (hero: Hero): number => {
  const stats = heroLevel50Stats(hero)
  return (Number(hero.cost) || 0) * 100
    + (Number(hero.rarity) || 0) * 30
    + stats.val + stats.int + stats.lea + stats.spd * 0.6
}

const skillCandidateScore = (skill: Skill): number => {
  const rarity = skill.rarity === 'S' ? 100 : skill.rarity === 'A' ? 60 : 30
  const typeBonus = isExclusiveTeamSkillType(skill) ? 6 : 0
  const rate = Number(skill.damage_rate_max ?? skill.heal_rate_max ?? 0)
  return rarity + typeBonus + rate * 0.05
}

const compareOptimizerResults = (a: AiOptimizerResult, b: AiOptimizerResult) =>
  b.winRate - a.winRate
  || b.exchangeRatio - a.exchangeRatio
  || b.score - a.score

const insertRankedResult = (results: AiOptimizerResult[], result: AiOptimizerResult, limit: number): void => {
  let low = 0
  let high = results.length
  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    const current = results[middle]
    if (current && compareOptimizerResults(result, current) < 0) high = middle
    else low = middle + 1
  }
  results.splice(low, 0, result)
  if (results.length > Math.max(1, limit)) results.length = Math.max(1, limit)
}

const uniqueOptimizerResults = (results: AiOptimizerResult[]): AiOptimizerResult[] => {
  const bestBySignature = new Map<string, AiOptimizerResult>()
  results.forEach((result) => {
    const key = canonicalCandidateSignature(result.lineup)
    const current = bestBySignature.get(key)
    if (!current || compareOptimizerResults(result, current) < 0) bestBySignature.set(key, result)
  })
  return [...bestBySignature.values()]
}

const rankedTopResults = (results: AiOptimizerResult[]): AiOptimizerResult[] =>
  [...results]
    .sort(compareOptimizerResults)
    .slice(0, 3)
    .map((result, index) => ({ ...result, rank: index + 1 }))

const tierFromScore = (value: number): string => {
  if (value >= 86) return 'T0'
  if (value >= 72) return 'T0.5'
  if (value >= 58) return 'T1'
  if (value >= 44) return 'T1.5'
  if (value >= 30) return 'T2'
  return 'T3'
}

const permutationCount = (n: number, r: number): number => {
  if (r <= 0) return 1
  if (n < r) return 0
  let total = 1
  for (let i = 0; i < r; i += 1) {
    const factor = n - i
    if (total > Number.MAX_SAFE_INTEGER / factor) return Number.MAX_SAFE_INTEGER
    total *= factor
  }
  return total
}

const cappedProduct = (values: number[]): number => {
  let total = 1
  for (const value of values) {
    if (total > Number.MAX_SAFE_INTEGER / value) return Number.MAX_SAFE_INTEGER
    total *= value
  }
  return total
}

const cappedPower = (base: number, exponent: number): number => {
  let total = 1
  for (let index = 0; index < exponent; index += 1) {
    if (total > Number.MAX_SAFE_INTEGER / base) return Number.MAX_SAFE_INTEGER
    total *= base
  }
  return total
}

const heroKey = (hero: Hero): string => hero.sim_id || hero.name
const skillKey = (skill: Skill): string => skill.sim_id || skill.id || skill.name_jp || skill.name
const heroIdentity = (hero: Hero): string => hero.sim_id || hero.name_jp || hero.name
const skillIdentity = (skill: Skill): string => skill.sim_id || skill.id || skill.name_jp || skill.name
const heroName = (hero: Hero | null): string => hero?.name_jp || hero?.name || '武将未選択'
const skillName = (skill: Skill | null): string => skill?.name_jp || skill?.name || '未設定'
const teamCost = (team: Lineup): number => roleKeys.reduce((sum, role) => sum + (team[role].hero?.cost ?? 0), 0)
const formatNumber = (value: number): string => Math.round(value).toLocaleString()
const formatLargeNumber = (value: number): string => {
  const displayValue = Math.min(Math.round(value), Number.MAX_SAFE_INTEGER).toLocaleString('ja-JP')
  return value >= Number.MAX_SAFE_INTEGER ? `${displayValue}以上` : displayValue
}
const formatPercent = (value: number): string => `${(value * 100).toFixed(1)}%`
const roleSignature = (role: RoleData): string => [
  role.hero ? heroIdentity(role.hero) : '',
  role.skill1 ? skillIdentity(role.skill1) : '',
  role.skill2 ? skillIdentity(role.skill2) : '',
  role.breakthrough,
  ...(['lea', 'val', 'int', 'pol', 'cha', 'spd'] as const).map((stat) => Number(role.stats[stat]).toFixed(2)),
  role.bingxue.direction ?? '',
  role.bingxue.major ?? '',
  ...role.bingxue.minors.map((minor) => `${minor.name}:${minor.level}`).sort(),
].join(':')
const bingxueSignature = (value: BingxueActive): string => [
  value.direction ?? '',
  value.major ?? '',
  ...value.minors.map((minor) => `${minor.name}:${minor.level}`).sort(),
].join(':')

const lineupSignature = (lineup: Lineup): string => [
  lineup.troopType ?? '',
  roleSignature(lineup.main),
  roleSignature(lineup.vice1),
  roleSignature(lineup.vice2),
].join('|')

const canonicalCandidateSignature = (lineup: Lineup): string => {
  if (!reorderFixedHeroes.value) return lineupSignature(lineup)
  // 副将1・副将2は戦闘上同じ役割なので、可変探索では入れ替えを同一候補として扱う。
  const viceSignatures = [roleSignature(lineup.vice1), roleSignature(lineup.vice2)].sort()
  return [lineup.troopType ?? '', roleSignature(lineup.main), ...viceSignatures].join('|')
}
const shortFormationName = (name: string): string => {
  const cleaned = name.replace(/（.*?）/g, '')
  const parts = cleaned.split(/[・,、/]/).map((part) => part.trim()).filter(Boolean)
  return parts.length > 0 ? parts.slice(0, 3).join('・') : cleaned
}

function uniqueBy<T>(items: T[], keyOf: (item: T) => string): T[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = keyOf(item)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function randomItem<T>(items: T[]): T | null {
  if (items.length === 0) return null
  return items[Math.floor(Math.random() * items.length)]
}

function takeRandom<T>(items: T[]): T | null {
  if (items.length === 0) return null
  const index = Math.floor(Math.random() * items.length)
  const [item] = items.splice(index, 1)
  return item ?? null
}

function shuffled<T>(items: T[]): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const current = out[i]
    out[i] = out[j]
    out[j] = current
  }
  return out
}

function waitForPaint(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => window.setTimeout(resolve, 0))
  })
}

</script>

<style scoped>
.ai-lineup-page {
  background: #f5efe6;
}

.panel {
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid #dfd1bf;
  border-radius: 8px;
  padding: 16px;
}

.page-head,
.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.page-head h2,
.section-head h3 {
  margin: 0;
  font-size: 22px;
  font-weight: 900;
  color: #263238;
}

.eyebrow {
  margin: 0 0 2px;
  font-size: 12px;
  color: #7b8a9a;
  font-weight: 700;
}

.lineup-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 12px;
}

.lineup-grid > * {
  min-width: 0;
}

.lineup-metrics {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
}

.cost-pill,
.estimate-pill {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  background: #f7f2ea;
  border: 1px solid #e2d4c1;
  color: #9a5b12;
  font-size: 12px;
  font-weight: 800;
}

.estimate-pill.warn {
  color: #b91c1c;
  border-color: #fecaca;
  background: #fff1f2;
}

.settings-panel {
  display: grid;
  gap: 14px;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.settings-grid label {
  display: grid;
  gap: 6px;
}

.settings-grid span {
  font-size: 12px;
  font-weight: 800;
  color: #6f6557;
}

.settings-grid :deep(.el-segmented) {
  width: 100%;
}

.position-switch {
  display: flex;
  align-items: center;
  min-height: 32px;
}

.tier-target-setting {
  grid-column: span 2;
}

.tier-switches {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.tier-switch-item {
  display: grid;
  grid-template-columns: minmax(52px, auto) auto minmax(42px, 1fr);
  align-items: center;
  gap: 7px;
  min-height: 32px;
  padding: 5px 8px;
  border: 1px solid #e2d4c1;
  border-radius: 6px;
  background: #fbf8f2;
}

.tier-switch-item strong {
  color: #40382f;
  font-size: 12px;
}

.tier-switch-item small {
  color: #807466;
  font-size: 11px;
  white-space: nowrap;
}

.status-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 12px;
  color: #5c6470;
  font-weight: 700;
}

.status-row span {
  padding: 4px 8px;
  border-radius: 999px;
  background: #f7f2ea;
  border: 1px solid #e2d4c1;
}

.status-row .warning {
  color: #b91c1c;
  border-color: #fecaca;
  background: #fff1f2;
}

.results-panel {
  display: grid;
  gap: 14px;
}

.progress-copy {
  color: #6f6557;
  font-size: 12px;
  font-weight: 900;
}

.result-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.result-grid.is-detailed {
  grid-template-columns: 1fr;
}

.result-card {
  display: grid;
  gap: 12px;
  border: 1px solid #dfd1bf;
  border-radius: 8px;
  padding: 12px;
  background: #fffaf2;
}

.result-card header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
}

.rank-badge {
  width: 38px;
  height: 38px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #b86b1d;
  color: white;
  font-weight: 900;
}

.result-card h4 {
  margin: 0;
  color: #263238;
  font-weight: 900;
}

.result-card p {
  margin: 2px 0 0;
  font-size: 12px;
  color: #6f6557;
  font-weight: 700;
}

.result-card header strong {
  color: #2f80ed;
  font-size: 22px;
}

.result-metrics,
.matchups {
  display: grid;
  gap: 6px;
  font-size: 12px;
}

.result-metrics {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.result-metrics span,
.matchups div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  background: #f7f2ea;
  color: #5c6470;
  min-width: 0;
}

.result-metrics b,
.matchups b {
  color: #b86b1d;
}

.mini-lineup {
  display: grid;
  gap: 8px;
}

.result-lineup-scroll {
  width: 100%;
  overflow-x: auto;
  overscroll-behavior-inline: contain;
}

.result-lineup-detail {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  min-width: 860px;
}

.mini-role {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr);
  gap: 8px;
  align-items: center;
}

.mini-role img {
  width: 48px;
  height: 58px;
  border-radius: 6px;
  object-fit: cover;
  object-position: top;
  border: 1px solid #d7c7b4;
  background: #f1ebe4;
}

.mini-copy {
  display: grid;
  min-width: 0;
}

.mini-copy span {
  color: #7b8a9a;
  font-size: 11px;
  font-weight: 800;
}

.mini-copy b,
.mini-copy small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mini-copy b {
  color: #263238;
  font-size: 14px;
}

.mini-copy small {
  color: #6f6557;
  font-size: 11px;
}

@media (max-width: 900px) {
  .page-head,
  .section-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .settings-grid,
  .result-grid {
    grid-template-columns: 1fr;
  }

  .tier-target-setting {
    grid-column: auto;
  }

  .tier-switches {
    grid-template-columns: repeat(3, minmax(150px, 1fr));
    overflow-x: auto;
    padding-bottom: 2px;
  }

  .lineup-panel {
    padding: 6px;
  }

  .lineup-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 4px;
  }

  .result-metrics {
    grid-template-columns: 1fr;
  }
}
</style>
