<template>
  <div class="ai-lineup-page flex-1 min-h-0 overflow-y-auto">
    <div class="mx-auto w-full max-w-7xl px-3 md:px-5 py-4 space-y-4">
      <section class="panel">
        <div class="page-head">
          <div>
            <p class="eyebrow">AI編成</p>
            <h2>テンプレ相手に勝率が高い組み合わせを探索</h2>
          </div>
          <el-button type="primary" :icon="VideoPlay" :loading="running" :disabled="!canOptimize" @click="runOptimizer">
            AI探索
          </el-button>
        </div>
      </section>

      <section class="panel">
        <div class="section-head">
          <div>
            <p class="eyebrow">固定条件</p>
            <h3>指定した枠は固定、空欄は探索対象</h3>
          </div>
          <span class="cost-pill">Cost {{ teamCost(seedTeam) }}</span>
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
            S武将 {{ heroCandidates.length }} / S・A戦法 {{ skillCandidates.length }}
          </div>
        </div>

        <div class="settings-grid">
          <label>
            <span>探索サンプル数</span>
            <el-input-number v-model="sampleCount" :min="1" :max="5000" controls-position="right" />
          </label>
          <label>
            <span>一次試行 / テンプレ</span>
            <el-input-number v-model="scoutRuns" :min="1" :max="200" controls-position="right" />
          </label>
          <label>
            <span>最終試行 / テンプレ</span>
            <el-input-number v-model="finalRuns" :min="10" :max="1000" controls-position="right" />
          </label>
        </div>

        <div class="status-row">
          <span>空き武将 {{ emptyHeroSlotCount }} 枠</span>
          <span>空き戦法 {{ emptySkillSlotCount }} 枠</span>
          <span>テンプレ {{ templateTeams.length }} 編成</span>
          <span>推定全組み合わせ {{ formatLargeNumber(estimatedCombinations) }}</span>
          <span>固定武将も主将/副将の配置替えを試行</span>
          <span v-if="!hasEnoughCandidates" class="warning">空き枠を埋める候補が不足しています。</span>
          <span v-else>S武将全体とS/A戦法全体からランダムに {{ formatNumber(sampleCount) }} 組を探索します。</span>
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

        <div v-if="topResults.length" class="result-grid">
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
              <span>試行 <b>{{ formatNumber(result.totalRuns) }}</b></span>
            </div>

            <div class="mini-lineup">
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
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, reactive, ref } from 'vue'
import { VideoPlay } from '@element-plus/icons-vue'
import LineupSlot from '../components/LineupSlot.vue'
import HeroLibrary from '../components/HeroLibrary.vue'
import SkillLibrary from '../components/SkillLibrary.vue'
import type { BingxueMinor, Lineup, RoleData } from '../composables/useLineups'
import { useData, type EnemyFormation, type Hero, type Skill } from '../composables/useData'
import {
  emptyAiOptimizerRole,
  useAiLineupOptimizerState,
  type AiOptimizerResult,
} from '../composables/useAiLineupOptimizerState'
import {
  IMPLEMENTED_BATTLE_SKILL_NAMES,
  simulateBattleBatch,
  type BattleBatchResult,
} from '../lib/battleSimulator'
import { battleSkillType, isExclusiveTeamSkillType } from '../lib/battleSkillEffects'
import { heroLevel50Stats } from '../lib/heroStats'

type RoleKey = 'main' | 'vice1' | 'vice2'
type SkillSlotKey = 'skill1' | 'skill2'

const roleConfigs: Array<{ key: RoleKey; label: string }> = [
  { key: 'main', label: '主将' },
  { key: 'vice1', label: '副将' },
  { key: 'vice2', label: '副将' },
]
const roleKeys: RoleKey[] = roleConfigs.map((role) => role.key)
const skillSlotKeys: SkillSlotKey[] = ['skill1', 'skill2']

const { heroes, skills, enemyFormations } = useData()
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
} = useAiLineupOptimizerState()

const picker = reactive<{ role: RoleKey | null; skillSlot: number | null }>({
  role: null,
  skillSlot: null,
})
const heroPickerVisible = ref(false)
const skillPickerVisible = ref(false)
const emptyConflictSet = new Set<string>()
const autoBreakthrough = 5
const finalistCount = 8

const heroByKey = computed(() => new Map(heroOptions.value.map((hero) => [heroKey(hero), hero])))
const skillByKey = computed(() => new Map(skillOptions.value.map((skill) => [skillKey(skill), skill])))
const heroBySimId = computed(() => new Map(heroes.value.map((hero) => [hero.sim_id, hero]).filter(([id]) => !!id) as [string, Hero][]))
const skillBySimId = computed(() => new Map(skills.value.map((skill) => [skill.sim_id, skill]).filter(([id]) => !!id) as [string, Skill][]))

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
const fixedRoleCount = computed(() => roleKeys.filter((role) => seedTeam[role].hero).length)
const emptyHeroSlotCount = computed(() => roleKeys.filter((role) => !seedTeam[role].hero).length)
const emptySkillSlotCount = computed(() => roleKeys.reduce((sum, role) => {
  if (!seedTeam[role].hero) return sum + 2
  return sum + skillSlotKeys.filter((slot) => !seedTeam[role][slot]).length
}, 0))

const heroCandidates = computed(() =>
  uniqueBy(heroes.value, heroIdentity)
    .filter((hero) => isSearchHero(hero))
    .filter((hero) => !fixedHeroKeys.value.has(heroIdentity(hero)))
    .sort((a, b) => heroCandidateScore(b) - heroCandidateScore(a) || heroName(a).localeCompare(heroName(b), 'ja'))
)

const skillCandidates = computed(() =>
  uniqueBy(skills.value, skillIdentity)
    .filter((skill) => isSelectableBattleSkill(skill))
    .filter((skill) => isSearchSkill(skill))
    .filter((skill) => !fixedSkillKeys.value.has(skillIdentity(skill)))
    .sort((a, b) => skillCandidateScore(b) - skillCandidateScore(a) || skillName(a).localeCompare(skillName(b), 'ja'))
)

const templateTeams = computed(() => enemyFormations.value.map((formation) => ({
  formation,
  lineup: lineupFromTemplate(formation),
})))

const estimatedCombinations = computed(() => {
  const fixedRoleCountValue = fixedRoleCount.value
  const rolePatternCount = permutationCount(roleKeys.length, fixedRoleCountValue)
  const heroCount = permutationCount(heroCandidates.value.length, emptyHeroSlotCount.value)
  const skillCount = permutationCount(skillCandidates.value.length, emptySkillSlotCount.value)
  return Math.max(1, rolePatternCount) * Math.max(1, heroCount) * Math.max(1, skillCount)
})

const hasEnoughCandidates = computed(() =>
  heroCandidates.value.length >= emptyHeroSlotCount.value
  && skillCandidates.value.length >= emptySkillSlotCount.value,
)
const canOptimize = computed(() =>
  !running.value
  && templateTeams.value.length > 0
  && hasEnoughCandidates.value
)
const progressPercent = computed(() => progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0)
const resultHeading = computed(() => {
  if (resultPhase.value === 'scout') return '一次探索中'
  if (resultPhase.value === 'final') return '一次結果を表示中 / 上位を最終再評価中'
  if (resultPhase.value === 'done') return '最終評価 上位 3 組'
  return '勝率上位 3 組'
})
const progressLabel = computed(() => resultPhase.value === 'final' ? '最終再評価' : '一次探索')

const setHero = (role: RoleKey, value: string) => {
  const hero = heroByKey.value.get(value) ?? null
  seedTeam[role].hero = hero
  seedTeam[role].skill1 = null
  seedTeam[role].skill2 = null
  seedTeam[role].bingxue = { direction: null, major: null, minors: [] }
  seedTeam[role].breakthrough = hero ? autoBreakthrough : 0
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

const runOptimizer = async () => {
  if (!canOptimize.value) return
  running.value = true
  topResults.value = []
  resultPhase.value = 'scout'
  progress.done = 0
  progress.total = 0
  try {
    const candidates = buildMonteCarloLineups(sampleCount.value)
    progress.total = candidates.length + Math.min(finalistCount, candidates.length)

    const scoutResults: AiOptimizerResult[] = []
    for (const [index, lineup] of candidates.entries()) {
      scoutResults.push(evaluateLineup(lineup, scoutRuns.value, `scout-${index}`))
      progress.done += 1
      if (index % 2 === 0) await nextTick()
    }

    const finalists = scoutResults
      .sort(compareOptimizerResults)
      .slice(0, finalistCount)

    topResults.value = finalists
      .slice(0, 3)
      .map((result, index) => ({ ...result, rank: index + 1 }))
    resultPhase.value = 'final'
    await nextTick()
    await waitForPaint()

    const finalResults: AiOptimizerResult[] = []
    for (const [index, result] of finalists.entries()) {
      finalResults.push(evaluateLineup(result.lineup, finalRuns.value, `final-${index}`))
      progress.done += 1
      await nextTick()
    }

    topResults.value = finalResults
      .sort(compareOptimizerResults)
      .slice(0, 3)
      .map((result, index) => ({ ...result, rank: index + 1 }))
    resultPhase.value = 'done'
  } finally {
    running.value = false
  }
}

const evaluateLineup = (lineup: Lineup, runs: number, idPrefix: string): AiOptimizerResult => {
  const matchupResults = templateTeams.value.map(({ formation, lineup: enemy }) => {
    const result = simulateBattleBatch(lineup, enemy, {
      seed: `${idPrefix}-${formation.id}`,
      runs,
    })
    return { formation, result }
  })
  const average = (pick: (result: BattleBatchResult) => number) =>
    matchupResults.reduce((sum, item) => sum + pick(item.result), 0) / Math.max(1, matchupResults.length)
  const winRate = average((result) => result.allyWinRate)
  const drawRate = average((result) => result.drawRate)
  const exchangeRatio = average((result) => result.exchangeRatio)
  const score = average((result) => result.scoreValue)
  const matchups = matchupResults
    .map(({ formation, result }) => ({
      id: formation.id,
      name: formation.name,
      winRate: result.allyWinRate,
      exchangeRatio: result.exchangeRatio,
    }))
    .sort((a, b) => b.winRate - a.winRate || b.exchangeRatio - a.exchangeRatio)

  return {
    id: `${idPrefix}-${lineupSignature(lineup)}`,
    rank: 0,
    lineup: cloneLineup(lineup),
    winRate,
    drawRate,
    exchangeRatio,
    score,
    scoreTier: tierFromScore(score),
    totalRuns: runs * matchupResults.length,
    matchups,
  }
}

const buildMonteCarloLineups = (count: number): Lineup[] => {
  const lineups: Lineup[] = []
  const seen = new Set<string>()
  let attempts = 0
  const maxAttempts = Math.max(100, count * 80)
  while (lineups.length < count && attempts < maxAttempts) {
    attempts += 1
    const lineup = randomCandidateLineup(lineups.length + 1)
    if (!lineup) continue
    const signature = lineupSignature(lineup)
    if (seen.has(signature)) continue
    seen.add(signature)
    lineups.push(lineup)
  }
  return lineups
}

const randomCandidateLineup = (index: number): Lineup | null => {
  const team = emptyLineup('AI探索編成')
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

  const usedSkills = new Set(roleKeys.flatMap((role) => [team[role].skill1, team[role].skill2])
    .filter(Boolean)
    .map((skill) => skillIdentity(skill as Skill)))
  const exclusiveTypes = new Set(roleKeys.flatMap((role) => [team[role].skill1, team[role].skill2])
    .filter(Boolean)
    .filter((skill) => isExclusiveTeamSkillType(skill as Skill))
    .map((skill) => battleSkillType(skill as Skill)))

  const slots = roleKeys.flatMap((role) =>
    skillSlotKeys
      .filter((slot) => team[role].hero && !team[role][slot])
      .map((slot) => ({ role, slot })),
  )

  for (const { role, slot } of slots) {
    const candidates = skillCandidates.value.filter((skill) => {
      const key = skillIdentity(skill)
      const type = battleSkillType(skill)
      return !usedSkills.has(key) && (!isExclusiveTeamSkillType(skill) || !exclusiveTypes.has(type))
    })
    const skill = randomItem(candidates)
    if (!skill) return null

    team[role][slot] = skill
    usedSkills.add(skillIdentity(skill))
    if (isExclusiveTeamSkillType(skill)) exclusiveTypes.add(battleSkillType(skill))
  }

  team.name = `AI候補 ${index}`
  return team
}

const roleFromTemplateMember = (member: EnemyFormation['members'][number]): RoleData => {
  const hero = heroBySimId.value.get(member.commander_id) ?? null
  return {
    ...emptyRole(),
    hero,
    skill1: member.skill1_id ? skillBySimId.value.get(member.skill1_id) ?? null : null,
    skill2: member.skill2_id ? skillBySimId.value.get(member.skill2_id) ?? null : null,
    breakthrough: autoBreakthrough,
    stats: statsWithFocus(hero, member.stat_focus, autoBreakthrough),
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

const autoRole = (hero: Hero): RoleData => ({
  ...emptyRole(),
  hero,
  breakthrough: autoBreakthrough,
  stats: { ...heroLevel50Stats(hero) },
})

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
  main: cloneRole(lineup.main),
  vice1: cloneRole(lineup.vice1),
  vice2: cloneRole(lineup.vice2),
})

const emptyLineup = (name: string): Lineup => ({
  name,
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
const isSearchSkill = (skill: Skill): boolean => skill.rarity === 'S' || skill.rarity === 'A'
const isSelectableBattleSkill = (skill: Skill): boolean => {
  if (!skill || skill.is_fixed || skill.is_unique) return false
  const names = [skill.name_jp, skill.name].filter(Boolean) as string[]
  return names.some((name) => IMPLEMENTED_BATTLE_SKILL_NAMES.has(name))
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
  for (let i = 0; i < r; i += 1) total *= n - i
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
const formatLargeNumber = (value: number): string => value >= 1_000_000_000 ? value.toExponential(2) : formatNumber(value)
const formatPercent = (value: number): string => `${(value * 100).toFixed(1)}%`
const lineupSignature = (lineup: Lineup): string => roleKeys.map((role) => [
  heroIdentity(lineup[role].hero as Hero),
  lineup[role].skill1 ? skillIdentity(lineup[role].skill1) : '',
  lineup[role].skill2 ? skillIdentity(lineup[role].skill2) : '',
].join(':')).join('|')
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
  grid-template-columns: repeat(3, minmax(0, 1fr));
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

  .lineup-grid,
  .settings-grid,
  .result-grid {
    grid-template-columns: 1fr;
  }

  .result-metrics {
    grid-template-columns: 1fr;
  }
}
</style>
