<template>
  <div class="mock-battle-page flex-1 min-h-0 overflow-y-auto">
    <div class="mx-auto w-full max-w-7xl px-3 md:px-5 py-4 space-y-4">
      <section class="panel">
        <div class="match-head">
          <div>
            <p class="eyebrow">模擬対戦</p>
            <h2>自軍編成 vs 敵軍編成</h2>
          </div>
          <el-button type="primary" :icon="VideoPlay" :loading="running" :disabled="!canRun" @click="runBattle">
            模擬対戦
          </el-button>
        </div>
      </section>

      <section class="side-block">
        <div class="side-title">
          <h3>自軍編成</h3>
          <div class="side-metrics">
            <TroopLevelSummary
              :levels="allyTroopLevels"
              :selected="allyTeam.troopType"
              selectable
              @select="setTroopType('ally', $event)"
            />
            <span>Cost {{ teamCost(allyTeam) }}</span>
          </div>
        </div>
        <div class="load-row">
          <el-select
            v-model="selectedLoadKey.ally"
            filterable
            clearable
            placeholder="テンプレ編成・保存した編成を呼び出す"
            @change="(value: string) => loadPreset('ally', value)"
          >
            <el-option-group label="保存した編成">
              <el-option
                v-for="option in savedLineupOptions"
                :key="`ally-${option.key}`"
                :label="option.label"
                :value="option.key"
              />
            </el-option-group>
            <el-option-group label="テンプレ編成">
              <el-option
                v-for="option in templateLineupOptions"
                :key="`ally-${option.key}`"
                :label="option.label"
                :value="option.key"
              />
            </el-option-group>
          </el-select>
        </div>
        <div class="lineup-grid">
          <LineupSlot
            v-for="role in roleConfigs"
            :key="`ally-${role.key}`"
            :title="role.label"
            :role="role.key"
            v-model:hero="allyTeam[role.key].hero"
            v-model:skill1="allyTeam[role.key].skill1"
            v-model:skill2="allyTeam[role.key].skill2"
            v-model:stats="allyTeam[role.key].stats"
            v-model:breakthrough="allyTeam[role.key].breakthrough"
            v-model:bingxue="allyTeam[role.key].bingxue"
            :focused-skill-slot="picker.side === 'ally' && picker.role === role.key ? picker.skillSlot : null"
            :conflicting-skill-names="emptyConflictSet"
            @open-hero-select="openHeroPicker('ally', role.key)"
            @open-skill-select="(slot: number) => openSkillPicker('ally', role.key, slot)"
            @skill-drop="(slot: number, skill: Skill) => assignSkill('ally', role.key, slot, skill)"
            @skill-slot-drop="() => undefined"
            @skill-drag-start="() => undefined"
            @skill-drag-end="() => undefined"
            @hero-drag-start="() => undefined"
            @hero-drag-end="() => undefined"
            @hero-drop="() => undefined"
          />
        </div>
      </section>

      <section class="side-block">
        <div class="side-title">
          <h3>敵軍編成</h3>
          <div class="side-metrics">
            <TroopLevelSummary
              :levels="enemyTroopLevels"
              :selected="enemyTeam.troopType"
              selectable
              @select="setTroopType('enemy', $event)"
            />
            <span>Cost {{ teamCost(enemyTeam) }}</span>
          </div>
        </div>
        <div class="load-row">
          <el-select
            v-model="selectedLoadKey.enemy"
            filterable
            clearable
            placeholder="テンプレ編成・保存した編成を呼び出す"
            @change="(value: string) => loadPreset('enemy', value)"
          >
            <el-option-group label="保存した編成">
              <el-option
                v-for="option in savedLineupOptions"
                :key="`enemy-${option.key}`"
                :label="option.label"
                :value="option.key"
              />
            </el-option-group>
            <el-option-group label="テンプレ編成">
              <el-option
                v-for="option in templateLineupOptions"
                :key="`enemy-${option.key}`"
                :label="option.label"
                :value="option.key"
              />
            </el-option-group>
          </el-select>
        </div>
        <div class="lineup-grid">
          <LineupSlot
            v-for="role in roleConfigs"
            :key="`enemy-${role.key}`"
            :title="role.label"
            :role="role.key"
            v-model:hero="enemyTeam[role.key].hero"
            v-model:skill1="enemyTeam[role.key].skill1"
            v-model:skill2="enemyTeam[role.key].skill2"
            v-model:stats="enemyTeam[role.key].stats"
            v-model:breakthrough="enemyTeam[role.key].breakthrough"
            v-model:bingxue="enemyTeam[role.key].bingxue"
            :focused-skill-slot="picker.side === 'enemy' && picker.role === role.key ? picker.skillSlot : null"
            :conflicting-skill-names="emptyConflictSet"
            @open-hero-select="openHeroPicker('enemy', role.key)"
            @open-skill-select="(slot: number) => openSkillPicker('enemy', role.key, slot)"
            @skill-drop="(slot: number, skill: Skill) => assignSkill('enemy', role.key, slot, skill)"
            @skill-slot-drop="() => undefined"
            @skill-drag-start="() => undefined"
            @skill-drag-end="() => undefined"
            @hero-drag-start="() => undefined"
            @hero-drag-end="() => undefined"
            @hero-drop="() => undefined"
          />
        </div>
      </section>

      <section v-if="result" class="panel result-panel">
        <div class="battle-report-scroll">
          <div class="battle-report">
            <header class="report-scoreboard">
              <div class="report-side-summary side-ally">
                <div class="casualty-pair">
                  <span>戦死 <b>{{ formatNumber(sideSummary('ally').dead) }}</b></span>
                  <span>負傷 <b>{{ formatNumber(sideSummary('ally').wounded) }}</b></span>
                </div>
                <div class="troop-total">
                  <strong>兵力 {{ formatNumber(sideSummary('ally').hp) }} / {{ formatNumber(sideSummary('ally').maxHp) }}</strong>
                  <div class="troop-gauge"><i :style="{ width: `${sideSummary('ally').hpRate}%` }"></i></div>
                </div>
              </div>

              <div class="result-emblem" :class="`outcome-${result.summary.outcome}`">
                <small>{{ result.summary.turns }}ターン</small>
                <b>{{ outcomeShortLabel }}</b>
              </div>

              <div class="report-side-summary side-enemy">
                <div class="troop-total">
                  <strong>兵力 {{ formatNumber(sideSummary('enemy').hp) }} / {{ formatNumber(sideSummary('enemy').maxHp) }}</strong>
                  <div class="troop-gauge"><i :style="{ width: `${sideSummary('enemy').hpRate}%` }"></i></div>
                </div>
                <div class="casualty-pair">
                  <span>戦死 <b>{{ formatNumber(sideSummary('enemy').dead) }}</b></span>
                  <span>負傷 <b>{{ formatNumber(sideSummary('enemy').wounded) }}</b></span>
                </div>
              </div>
            </header>

            <div class="report-team-names">
              <strong>{{ allyTeam.name || '自軍編成' }}</strong>
              <span>対戦結果</span>
              <strong>{{ enemyTeam.name || '敵軍編成' }}</strong>
            </div>

            <div class="report-member-grid">
              <article
                v-for="member in battleReportMembers"
                :key="`${member.side}-${member.roleKey}`"
                class="report-member"
                :class="`side-${member.side}`"
              >
                <div class="member-role" :class="{ commander: member.roleKey === 'main' }">
                  {{ member.roleKey === 'main' ? '大将' : '副将' }}
                </div>
                <img v-if="member.portrait" :src="member.portrait" :alt="member.name" loading="lazy" />
                <div v-else class="member-portrait-empty">画像なし</div>
                <strong class="member-name">{{ member.name }}</strong>
                <div class="member-troops">
                  <span>兵力</span>
                  <b>{{ formatNumber(member.hp) }}</b>
                </div>
                <div class="member-skill-list">
                  <section v-for="skill in member.skills" :key="skill.key" class="member-skill-stat">
                    <h4>{{ skill.name }}</h4>
                    <dl>
                      <div><dt>発動</dt><dd>{{ formatNumber(skill.activations) }}</dd></div>
                      <div><dt>撃破</dt><dd>{{ formatNumber(skill.damage) }}</dd></div>
                      <div><dt>救援</dt><dd>{{ formatNumber(skill.healing) }}</dd></div>
                    </dl>
                  </section>
                </div>
              </article>
            </div>
          </div>
        </div>

        <h3 class="detail-log-title">ターン別詳細ログ</h3>
        <div class="log-groups">
          <article v-for="group in groupedLogs" :key="group.turn" class="log-group">
            <div class="battle-turn-banner">
              <span>{{ group.title }}</span>
            </div>

            <div v-if="group.turn === 0" class="prep-sections">
              <section v-for="section in group.prepSections" :key="section.title" class="prep-section">
                <h4>{{ section.title }}</h4>
                <ol>
                  <li v-for="(row, index) in section.rows" :key="`${section.title}-${index}`" :class="`side-${row.side}`">
                    <span class="prep-side">{{ sideLabel(row.side) }}</span>
                    <span class="prep-message">{{ row.message }}</span>
                  </li>
                </ol>
              </section>
            </div>

            <div v-else class="action-blocks">
              <section
                v-for="block in group.blocks"
                :key="block.id"
                class="action-block"
                :class="`side-${block.side}`"
              >
                <header>
                  <img
                    v-if="actorPortrait(block)"
                    :src="actorPortrait(block)"
                    class="action-portrait"
                    loading="lazy"
                  />
                  <div class="action-title">
                    <span class="log-side">{{ sideLabel(block.side) }}</span>
                    <strong>{{ actionBlockTitle(block) }}</strong>
                    <small v-if="block.actor">速度 {{ actorSpeed(block) }}</small>
                  </div>
                  <div v-if="block.actor" class="action-metrics">
                    <span>兵力 <b>{{ formatNumber(actorHp(block)) }}</b></span>
                    <span>撃破数 <b>{{ formatNumber(blockKills(block)) }}</b></span>
                    <span>救援 <b>{{ formatNumber(blockHealing(block)) }}</b></span>
                  </div>
                </header>
                <ol>
                  <li
                    v-for="(entry, index) in block.entries"
                    :key="`${block.id}-${index}`"
                    :class="[{ 'is-damage': entry.valueType === 'damage', 'is-healing': entry.valueType === 'healing' }]"
                  >
                    <span class="log-effect">{{ entry.effect || '' }}</span>
                    <span class="log-message">
                      <span
                        v-for="(part, partIndex) in logMessageParts(entry)"
                        :key="`${block.id}-${index}-${partIndex}`"
                        :class="`log-part--${part.tone}`"
                      >{{ part.text }}</span>
                    </span>
                  </li>
                </ol>
              </section>
            </div>
          </article>
        </div>
      </section>

      <el-empty v-else description="自軍編成と敵軍編成を作成して、模擬対戦を実行してください。" />
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
          :used-heroes="pickerUsedHeroNames"
          :owned-heroes="[]"
          :filter-owned="false"
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
          battle-implemented-only
          :used-skills="pickerUsedSkillNames"
          :owned-skills="[]"
          :filter-owned="false"
          @select="selectSkillFromLibrary"
        />
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { VideoPlay } from '@element-plus/icons-vue'
import LineupSlot from '../components/LineupSlot.vue'
import HeroLibrary from '../components/HeroLibrary.vue'
import SkillLibrary from '../components/SkillLibrary.vue'
import TroopLevelSummary from '../components/lineup-builder/TroopLevelSummary.vue'
import { simulateBattle, type BattleFighter, type BattleLogEntry, type BattleResult } from '../lib/battleSimulator'
import { battleSkillType, isExclusiveTeamSkillType } from '../lib/battleSkillEffects'
import { useLineups } from '../composables/useLineups'
import type { BingxueMinor, Lineup, RoleData } from '../composables/useLineups'
import { useTroopLevels } from '../composables/useTroopLevels'
import { buildTemplateLookup, useData, type EnemyFormation, type Hero, type Skill } from '../composables/useData'
import { heroLevel50Stats } from '../lib/heroStats'
import { normalizeTroopType } from '../constants/traits'
import type { TroopType } from '../constants/traits'

type RoleKey = 'main' | 'vice1' | 'vice2'
type BattleSideKey = 'ally' | 'enemy'
type LogSide = BattleLogEntry['side']
type PrepRow = { side: LogSide; message: string }
type PrepSection = { title: string; rows: PrepRow[] }
type ActionBlock = {
  id: string
  side: LogSide
  actor: string
  troops: number
  speed?: number
  isAction: boolean
  entries: BattleLogEntry[]
}
type LogMessageTone = 'text' | 'ally-name' | 'enemy-name' | 'damage' | 'healing' | 'status'
type LogMessagePart = { text: string; tone: LogMessageTone }
type ReportSkillStat = {
  key: string
  name: string
  activations: number
  damage: number
  healing: number
}
type ReportMember = {
  side: BattleSideKey
  roleKey: RoleKey
  name: string
  portrait: string
  hp: number
  skills: ReportSkillStat[]
}

const { lineups } = useLineups()
const { heroes, skills, enemyFormations } = useData()

const roleConfigs: Array<{ key: RoleKey; label: string }> = [
  { key: 'main', label: '主将' },
  { key: 'vice1', label: '副将' },
  { key: 'vice2', label: '副将' },
]

const emptyRole = (): RoleData => ({
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
  const stats = { ...emptyRole().stats, ...heroLevel50Stats(hero) }
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
const hydratedStats = (role: RoleData): RoleData['stats'] => {
  const isUninitialized = role.hero && Object.values(role.stats).every((value) => Number(value) === 100)
  return isUninitialized ? statsWithFocus(role.hero) : { ...role.stats }
}

const makeBattleTeam = (name: string): Lineup => ({
  name,
  troopType: null,
  main: emptyRole(),
  vice1: emptyRole(),
  vice2: emptyRole(),
})

const allyTeam = reactive<Lineup>(makeBattleTeam('自軍編成'))
const enemyTeam = reactive<Lineup>(makeBattleTeam('敵軍編成'))
const allyTroopLevels = useTroopLevels(computed(() => allyTeam))
const enemyTroopLevels = useTroopLevels(computed(() => enemyTeam))
const result = ref<BattleResult | null>(null)
const running = ref(false)
const heroPickerVisible = ref(false)
const skillPickerVisible = ref(false)
const emptyConflictSet = new Set<string>()
const selectedLoadKey = reactive<Record<BattleSideKey, string>>({ ally: '', enemy: '' })

const picker = reactive<{
  side: BattleSideKey | null
  role: RoleKey | null
  skillSlot: number | null
}>({
  side: null,
  role: null,
  skillSlot: null,
})

const heroOptions = computed(() => [...heroes.value].sort((a, b) => heroName(a).localeCompare(heroName(b), 'ja')))
const skillOptions = computed(() => uniqueBy(skills.value, skillKey).sort((a, b) => skillName(a).localeCompare(skillName(b), 'ja')))
const heroByKey = computed(() => new Map(heroOptions.value.map((hero) => [heroKey(hero), hero])))
const skillByKey = computed(() => new Map(skillOptions.value.map((skill) => [skillKey(skill), skill])))
const heroByTemplateKey = computed(() => buildTemplateLookup(heroes.value))
const skillByTemplateKey = computed(() => buildTemplateLookup(skills.value))
const savedLineupOptions = computed(() => lineups
  .map((lineup, index) => ({ key: `saved:${index}`, label: `${index + 1}. ${lineup.name || '保存した編成'}`, lineup }))
  .filter((option) => rolesOf(option.lineup).some((role) => role.hero)))
const templateLineupOptions = computed(() => enemyFormations.value.map((formation) => ({
  key: `template:${formation.id}`,
  label: formation.name,
  formation,
})))

const selectedTeam = (side: BattleSideKey): Lineup => side === 'ally' ? allyTeam : enemyTeam
const rolesOf = (team: Lineup): RoleData[] => [team.main, team.vice1, team.vice2]
const setTroopType = (side: BattleSideKey, troopType: TroopType | null): void => {
  selectedTeam(side).troopType = troopType
  result.value = null
}
const canRun = computed(() => rolesOf(allyTeam).some((role) => role.hero) && rolesOf(enemyTeam).some((role) => role.hero))
const usedHeroNamesForSide = (side: BattleSideKey | null): Set<string> => {
  if (!side) return new Set()
  const names = rolesOf(selectedTeam(side)).map((role) => role.hero?.name).filter(Boolean) as string[]
  return new Set(names)
}
const usedSkillNamesForSide = (side: BattleSideKey | null): Set<string> => {
  if (!side) return new Set()
  const names = rolesOf(selectedTeam(side)).flatMap((role) => [role.skill1?.name, role.skill2?.name]).filter(Boolean) as string[]
  return new Set(names)
}
const pickerUsedHeroNames = computed(() => usedHeroNamesForSide(picker.side))
const pickerUsedSkillNames = computed(() => usedSkillNamesForSide(picker.side))

const clearExclusiveTeamSkill = (team: Lineup, incoming: Skill, keepRole: RoleKey, keepSlot: 'skill1' | 'skill2') => {
  if (!isExclusiveTeamSkillType(incoming)) return
  const incomingType = battleSkillType(incoming)
  roleConfigs.forEach(({ key }) => {
    ;(['skill1', 'skill2'] as const).forEach((slot) => {
      if (key === keepRole && slot === keepSlot) return
      const current = team[key][slot]
      if (!current || battleSkillType(current) !== incomingType) return
      team[key][slot] = null
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
    })
  })
}

const sideTeamName = (side: LogSide): string => {
  if (side === 'ally') return allyTeam.name || '自軍'
  if (side === 'enemy') return enemyTeam.name || '敵軍'
  return 'SYSTEM'
}

const roleByActor = (side: LogSide, actor: string): RoleData | null => {
  if (!actor || side === 'system') return null
  return rolesOf(selectedTeam(side)).find((role) => {
    const hero = role.hero
    return hero && (hero.name === actor || hero.name_jp === actor)
  }) ?? null
}

const rolesWithSide = () => [
  ...rolesOf(allyTeam).map((role) => ({ side: 'ally' as const, role })),
  ...rolesOf(enemyTeam).map((role) => ({ side: 'enemy' as const, role })),
].filter((item) => item.role.hero)

const heroNameSides = computed(() => {
  const names = new Map<string, Set<BattleSideKey>>()
  rolesWithSide().forEach(({ side, role }) => {
    const heroNames = [role.hero?.name_jp, role.hero?.name].filter(Boolean) as string[]
    heroNames.forEach((name) => {
      const sides = names.get(name) ?? new Set<BattleSideKey>()
      sides.add(side)
      names.set(name, sides)
    })
  })
  return names
})

const makePrepSections = (entries: BattleLogEntry[]): PrepSection[] => {
  const battleStartRows = entries
    .filter((entry) => entry.side === 'system' && !/準備ターン/.test(entry.message))
    .map((entry) => ({ side: entry.side, message: entry.message }))

  const moraleRows: PrepRow[] = [
    { side: 'ally', message: `${sideTeamName('ally')} 士気100.00、与ダメージ100%` },
    { side: 'enemy', message: `${sideTeamName('enemy')} 士気100.00、与ダメージ100%` },
  ]

  const troopRows: PrepRow[] = [
    { side: 'ally', message: `${sideTeamName('ally')} 兵種属性100.00%` },
    { side: 'enemy', message: `${sideTeamName('enemy')} 兵種属性100.00%` },
  ]

  const bingxueRows = rolesWithSide().flatMap(({ side, role }): PrepRow[] => {
    const names = [
      role.bingxue.major,
      ...role.bingxue.minors.map((minor) => `${minor.name}Lv.${minor.level}`),
    ].filter(Boolean)
    if (names.length === 0) return []
    return names.map((name) => ({
      side,
      message: `[${role.hero?.name_jp || role.hero?.name}] ${name} の強化を獲得`,
    }))
  })

  const traitRows = entries
    .filter((entry) => entry.effect === '特性')
    .map((entry) => ({ side: entry.side, message: entry.message }))

  const skillRows = entries
    .filter((entry) => entry.side !== 'system' && entry.effect !== '特性' && entry.effect !== '兵学')
    .map((entry) => ({ side: entry.side, message: entry.message }))

  return [
    { title: '合戦開始', rows: battleStartRows.length ? battleStartRows : [{ side: 'system', message: '合戦開始' }] },
    { title: '士気の影響', rows: moraleRows },
    { title: '兵種の影響', rows: troopRows },
    { title: '特性の影響', rows: traitRows.length ? traitRows : [{ side: 'system', message: '常時特性効果なし' }] },
    { title: '軍学・兵学による影響', rows: bingxueRows.length ? bingxueRows : [{ side: 'system', message: '兵学効果なし' }] },
    { title: '戦法の影響', rows: skillRows.length ? skillRows : [{ side: 'system', message: '準備ターンに発動した戦法はありません' }] },
  ]
}

const outcomeLabel = computed(() => {
  if (!result.value) return ''
  if (result.value.summary.outcome === 'ally') return '自軍勝利'
  if (result.value.summary.outcome === 'enemy') return '敵軍勝利'
  return '引き分け'
})

const outcomeShortLabel = computed(() => {
  if (!result.value || result.value.summary.outcome === 'draw') return '分'
  return result.value.summary.outcome === 'ally' ? '勝' : '敗'
})

const fightersForSide = (side: BattleSideKey): BattleFighter[] =>
  result.value?.[side] ?? []

const sideSummary = (side: BattleSideKey) => {
  const fighters = fightersForSide(side)
  const hp = fighters.reduce((sum, fighter) => sum + fighter.hp, 0)
  // fighter.maxHp は戦死者分だけ減るため、表示上の初期兵力は残兵・負傷・戦死から復元する。
  const maxHp = fighters.reduce((sum, fighter) => sum + fighter.hp + fighter.wounded + fighter.dead, 0)
  return {
    hp,
    maxHp,
    wounded: fighters.reduce((sum, fighter) => sum + fighter.wounded, 0),
    dead: fighters.reduce((sum, fighter) => sum + fighter.dead, 0),
    hpRate: maxHp > 0 ? Math.max(0, Math.min(100, hp / maxHp * 100)) : 0,
  }
}

const reportSkillStat = (
  side: BattleSideKey,
  roleKey: RoleKey,
  name: string,
  fallbackKey: string,
): ReportSkillStat => {
  const stat = result.value?.skillStats.find((item) =>
    item.side === side && item.role === roleKey && item.skillName === name)
  return {
    key: `${fallbackKey}:${name}`,
    name,
    activations: stat?.activations ?? 0,
    damage: stat?.damage ?? 0,
    healing: stat?.healing ?? 0,
  }
}

const normalAttackStat = (
  side: BattleSideKey,
  roleKey: RoleKey,
  actorName: string,
): ReportSkillStat => {
  const entries = result.value?.logs.filter((entry) =>
    entry.side === side
    && entry.actor === actorName
    && /の(?:計略)?通常攻撃[:：]/.test(entry.message)
    && entry.valueType === 'damage') ?? []
  return {
    key: `${side}:${roleKey}:normal-attack`,
    name: '通常攻撃',
    activations: entries.length,
    damage: entries.reduce((sum, entry) => sum + (entry.amount ?? 0), 0),
    healing: 0,
  }
}

const reportMember = (side: BattleSideKey, roleKey: RoleKey): ReportMember | null => {
  const role = selectedTeam(side)[roleKey]
  const fighter = fightersForSide(side).find((item) => item.role === roleKey)
  if (!role.hero || !fighter) return null
  const uniqueSkill = role.hero.unique_skill
    ? skillOptions.value.find((skill) =>
        skill.name === role.hero?.unique_skill || skill.name_jp === role.hero?.unique_skill)
    : null
  const uniqueName = uniqueSkill
    ? skillName(uniqueSkill)
    : role.hero.unique_skill || '固有戦法なし'
  const configuredSkills = [
    reportSkillStat(side, roleKey, uniqueName, `${side}:${roleKey}:unique`),
    role.skill1
      ? reportSkillStat(side, roleKey, skillName(role.skill1), `${side}:${roleKey}:skill1`)
      : { key: `${side}:${roleKey}:skill1`, name: '戦法未設定', activations: 0, damage: 0, healing: 0 },
    role.skill2
      ? reportSkillStat(side, roleKey, skillName(role.skill2), `${side}:${roleKey}:skill2`)
      : { key: `${side}:${roleKey}:skill2`, name: '戦法未設定', activations: 0, damage: 0, healing: 0 },
    normalAttackStat(side, roleKey, fighter.name),
  ]
  return {
    side,
    roleKey,
    name: fighter.name,
    portrait: role.hero.portrait || '',
    hp: fighter.hp,
    skills: configuredSkills,
  }
}

const battleReportMembers = computed<ReportMember[]>(() => [
  ...roleConfigs.map(({ key }) => reportMember('ally', key)),
  ...roleConfigs.map(({ key }) => reportMember('enemy', key)),
].filter(Boolean) as ReportMember[])

const groupedLogs = computed(() => {
  const troopKey = (side: LogSide, actor: string) => `${side}:${actor}`
  const currentTroops = new Map<string, number>()
  ;(result.value?.ally ?? []).forEach((fighter) => {
    currentTroops.set(troopKey('ally', fighter.name), fighter.hp + fighter.wounded + fighter.dead)
  })
  ;(result.value?.enemy ?? []).forEach((fighter) => {
    currentTroops.set(troopKey('enemy', fighter.name), fighter.hp + fighter.wounded + fighter.dead)
  })

  const groups = new Map<number, BattleLogEntry[]>()
  ;(result.value?.logs ?? []).forEach((entry) => {
    if (entry.side === 'system' && /^ターン\d+$/.test(entry.message)) return
    const list = groups.get(entry.turn) ?? []
    list.push(entry)
    groups.set(entry.turn, list)
  })
  return [...groups.entries()].sort((a, b) => a[0] - b[0]).map(([turn, entries]) => {
    const blocks: ActionBlock[] = []
    entries.forEach((entry, index) => {
      const actor = entry.actionActor || entry.actor || ''
      const side = entry.actionSide || entry.side
      const isAction = Boolean(entry.actionActor)
      const previous = blocks[blocks.length - 1]
      if (previous && previous.side === side && previous.actor === actor && previous.isAction === isAction) {
        previous.entries.push(entry)
        if (entry.target && entry.targetSide && typeof entry.afterHp === 'number') {
          currentTroops.set(troopKey(entry.targetSide, entry.target), entry.afterHp)
        }
        return
      }
      blocks.push({
        id: `${turn}-${index}-${side}-${actor || 'system'}`,
        side,
        actor,
        troops: entry.actionActorHp ?? entry.actorHp ?? currentTroops.get(troopKey(side, actor)) ?? 0,
        speed: entry.actionActorSpeed,
        isAction,
        entries: [entry],
      })

      if (entry.target && entry.targetSide && typeof entry.afterHp === 'number') {
        currentTroops.set(troopKey(entry.targetSide, entry.target), entry.afterHp)
      }
    })
    return {
      turn,
      title: turn === 0 ? '準備ターン' : `${turn}ターン目`,
      blocks,
      prepSections: turn === 0 ? makePrepSections(entries) : [],
    }
  })
})

const actorPortrait = (block: ActionBlock): string => roleByActor(block.side, block.actor)?.hero?.portrait || ''
const actorSpeed = (block: ActionBlock): string => {
  // 戦闘ログに保存された実速度を優先し、伊賀忍者などの戦闘中補正も表示する。
  if (typeof block.speed === 'number') return block.speed.toFixed(2)
  const role = roleByActor(block.side, block.actor)
  return Number(role?.stats.spd ?? 0).toFixed(2)
}
const actorHp = (block: ActionBlock): number => block.troops
const actionBlockTitle = (block: ActionBlock): string => {
  if (!block.actor) return 'SYSTEM'
  return block.isAction ? `${block.actor}の行動` : `${block.actor}のターン開始効果`
}

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const normalizedLogMessage = (entry: BattleLogEntry): string => {
  const message = entry.message.replace(
    /^(?:味方|敵|自軍|敵軍)\s+(?:大将|副将)の通常攻撃[:：]\s*/,
    entry.actor ? `${entry.actor}の通常攻撃：` : '通常攻撃：',
  )
  return message
}
const sideNameTone = (side: LogSide): LogMessageTone => side === 'ally' ? 'ally-name' : 'enemy-name'
const harmfulStatusPattern = '火傷|水攻め|中毒|消沈|潰走|混乱|無策|封撃|麻痺|挑発|畏縮|疲弊|威圧|回復不可'
const isHarmfulStatusTarget = (name: string, offset: number, message: string): boolean =>
  new RegExp(`^に(?:${harmfulStatusPattern})`).test(message.slice(offset + name.length))
const heroNameTone = (name: string, entry: BattleLogEntry, offset: number, message: string): LogMessageTone => {
  const isActor = entry.actor === name && entry.side !== 'system'
  const isTarget = entry.target === name && Boolean(entry.targetSide)
  // 両軍に同名武将がいる場合、通常攻撃文の「○○の」は発動者、それ以外は対象として色分けする。
  if (isActor && isTarget && entry.side !== entry.targetSide) {
    return message.startsWith(`${name}の`, offset)
      ? sideNameTone(entry.side)
      : sideNameTone(entry.targetSide!)
  }
  if (isTarget) return sideNameTone(entry.targetSide!)
  // 旧バージョンで保存された対象情報のない状態付与ログも、文脈から敵味方を復元する。
  if (entry.side !== 'system' && isHarmfulStatusTarget(name, offset, message)) {
    return sideNameTone(entry.side === 'ally' ? 'enemy' : 'ally')
  }
  if (isActor) return sideNameTone(entry.side)
  if (entry.actionActor === name && entry.actionSide) return entry.actionSide === 'ally' ? 'ally-name' : 'enemy-name'
  const sides = heroNameSides.value.get(name)
  if (sides?.size === 1) return sides.has('ally') ? 'ally-name' : 'enemy-name'
  return 'text'
}
const logMessageParts = (entry: BattleLogEntry): LogMessagePart[] => {
  const message = normalizedLogMessage(entry)
  const heroNames = [...heroNameSides.value.keys()].sort((a, b) => b.length - a.length)
  const tokens = [
    ...heroNames.map(escapeRegExp),
    '\\d[\\d,]*(?:\\.\\d+)?\\s*ダメージ',
    '\\d[\\d,]*(?:\\.\\d+)?\\s*(?:回復|蓄積|復帰)',
    '合計\\d[\\d,]*',
    '負傷(?:兵)?\\d[\\d,]*(?:・戦死\\d[\\d,]*)?',
    '戦死\\d[\\d,]*',
    harmfulStatusPattern,
  ]
  if (tokens.length === 0) return [{ text: message, tone: 'text' }]
  const tokenPattern = new RegExp(tokens.join('|'), 'g')
  const parts: LogMessagePart[] = []
  let cursor = 0
  for (const match of message.matchAll(tokenPattern)) {
    const offset = match.index ?? 0
    if (offset > cursor) parts.push({ text: message.slice(cursor, offset), tone: 'text' })
    const text = match[0]
    if (heroNameSides.value.has(text)) parts.push({ text, tone: heroNameTone(text, entry, offset, message) })
    else if (/ダメージ|負傷|戦死/.test(text)) parts.push({ text, tone: 'damage' })
    else if (/回復|蓄積|復帰|合計/.test(text)) parts.push({ text, tone: 'healing' })
    else if (new RegExp(`^(?:${harmfulStatusPattern})$`).test(text)) parts.push({ text, tone: 'status' })
    else parts.push({ text, tone: 'text' })
    cursor = offset + text.length
  }
  if (cursor < message.length) parts.push({ text: message.slice(cursor), tone: 'text' })
  return parts
}

const blockHealing = (block: ActionBlock): number =>
  block.entries.reduce(
    (sum, entry) =>
      sum +
      (entry.valueType === 'healing'
        ? entry.amount ?? Math.max(0, (entry.afterHp ?? 0) - (entry.beforeHp ?? 0))
        : 0),
    0,
  )
const blockKills = (block: ActionBlock): number =>
  block.entries.reduce(
    (sum, entry) =>
      sum +
      (entry.valueType === 'damage'
        ? entry.amount ?? Math.max(0, (entry.beforeHp ?? 0) - (entry.afterHp ?? 0))
        : 0),
    0,
  )

const cloneRole = (role: RoleData): RoleData => ({
  hero: role.hero,
  skill1: role.skill1,
  skill2: role.skill2,
  stats: hydratedStats(role),
  breakthrough: role.breakthrough,
  bingxue: {
    direction: role.bingxue.direction,
    major: role.bingxue.major,
    minors: role.bingxue.minors.map((minor): BingxueMinor => ({ ...minor })),
  },
})

const copyLineupInto = (target: Lineup, source: Lineup, fallbackName: string) => {
  target.name = source.name || fallbackName
  target.troopType = source.troopType ?? null
  target.main = cloneRole(source.main)
  target.vice1 = cloneRole(source.vice1)
  target.vice2 = cloneRole(source.vice2)
  normalizeExclusiveTeamSkills(target)
  result.value = null
}

const roleFromTemplateMember = (member: EnemyFormation['members'][number]): RoleData => {
  const hero = heroByTemplateKey.value.get(member.commander_id) ?? null
  const base = emptyRole()
  return {
    ...base,
    hero,
    skill1: member.skill1_id ? skillByTemplateKey.value.get(member.skill1_id) ?? null : null,
    skill2: member.skill2_id ? skillByTemplateKey.value.get(member.skill2_id) ?? null : null,
    breakthrough: templateBreakthrough,
    stats: statsWithFocus(hero, member.stat_focus, templateBreakthrough),
    bingxue: member.bingxue
      ? {
          direction: member.bingxue.direction,
          major: member.bingxue.major,
          minors: member.bingxue.minors.map((minor) => ({ ...minor })),
        }
      : base.bingxue,
  }
}

const lineupFromTemplate = (formation: EnemyFormation): Lineup => ({
  name: formation.name,
  troopType: normalizeTroopType(formation.troop_types?.[0] ?? ''),
  main: roleFromTemplateMember(formation.members[0]),
  vice1: roleFromTemplateMember(formation.members[1]),
  vice2: roleFromTemplateMember(formation.members[2]),
})

const loadPreset = (side: BattleSideKey, key: string) => {
  if (!key) return
  const target = selectedTeam(side)
  if (key.startsWith('saved:')) {
    const index = Number(key.slice('saved:'.length))
    const source = lineups[index]
    if (source) copyLineupInto(target, source, side === 'ally' ? '自軍編成' : '敵軍編成')
    return
  }

  if (key.startsWith('template:')) {
    const id = key.slice('template:'.length)
    const formation = enemyFormations.value.find((item) => item.id === id)
    if (formation) copyLineupInto(target, lineupFromTemplate(formation), formation.name)
  }
}

const openHeroPicker = (side: BattleSideKey, role: RoleKey) => {
  picker.side = side
  picker.role = role
  picker.skillSlot = null
  heroPickerVisible.value = true
}

const openSkillPicker = (side: BattleSideKey, role: RoleKey, slot: number) => {
  picker.side = side
  picker.role = role
  picker.skillSlot = slot
  skillPickerVisible.value = true
}

const selectHeroFromLibrary = (hero: Hero) => {
  if (!picker.side || !picker.role) return
  setHero(picker.side, picker.role, heroKey(hero))
  heroPickerVisible.value = false
}

const selectSkillFromLibrary = (skill: Skill) => {
  if (!picker.side || !picker.role || !picker.skillSlot) return
  assignSkill(picker.side, picker.role, picker.skillSlot, skill)
  skillPickerVisible.value = false
}

const setHero = (side: BattleSideKey, role: RoleKey, value: string) => {
  const team = selectedTeam(side)
  const hero = heroByKey.value.get(value) ?? null
  team[role].hero = hero
  team[role].skill1 = null
  team[role].skill2 = null
  team[role].bingxue = { direction: null, major: null, minors: [] }
  if (hero) team[role].stats = { ...team[role].stats, ...heroLevel50Stats(hero) }
  result.value = null
}

const assignSkill = (side: BattleSideKey, role: RoleKey, slot: number, skill: Skill) => {
  const team = selectedTeam(side)
  const nextSkill = skillByKey.value.get(skillKey(skill)) ?? skill
  const slotKey = slot === 1 ? 'skill1' : 'skill2'
  clearExclusiveTeamSkill(team, nextSkill, role, slotKey)
  team[role][slotKey] = nextSkill
  result.value = null
}

const runBattle = () => {
  if (!canRun.value) return
  running.value = true
  try {
    normalizeExclusiveTeamSkills(allyTeam)
    normalizeExclusiveTeamSkills(enemyTeam)
    const seed = `mock-${Date.now()}-${Math.random().toString(36).slice(2)}`
    result.value = simulateBattle(allyTeam, enemyTeam, { seed })
  } finally {
    running.value = false
  }
}

const heroKey = (hero: Hero): string => hero.sim_id || hero.name
const skillKey = (skill: Skill): string => skill.sim_id || skill.id || skill.name_jp || skill.name
const heroName = (hero: Hero): string => hero.name_jp || hero.name
const skillName = (skill: Skill): string => skill.name_jp || skill.name
const teamCost = (team: Lineup): number => rolesOf(team).reduce((sum, role) => sum + (role.hero?.cost ?? 0), 0)
const formatNumber = (value: number): string => Math.round(value).toLocaleString()
const sideLabel = (side: BattleLogEntry['side']): string => {
  if (side === 'ally') return '自軍'
  if (side === 'enemy') return '敵軍'
  return 'SYSTEM'
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
</script>

<style scoped>
.mock-battle-page {
  background: #f5efe6;
}

.panel,
.side-block {
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid #dfd1bf;
  border-radius: 8px;
  padding: 16px;
}

.match-head,
.result-head,
.side-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.match-head h2,
.result-head h2,
.side-title h3 {
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

.side-title {
  margin-bottom: 12px;
}

.side-metrics {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
}

.load-row {
  margin-bottom: 12px;
}

.load-row :deep(.el-select) {
  width: 100%;
}

.side-title span,
.summary-pills span {
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

.lineup-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.lineup-grid > * {
  min-width: 0;
}

.summary-pills {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.battle-report-scroll {
  overflow-x: auto;
  border: 1px solid #9cacba;
  background: #dce6ee;
}

.battle-report {
  min-width: 960px;
  color: #263238;
  background:
    linear-gradient(90deg, rgba(44, 116, 171, 0.09) 0 50%, rgba(174, 73, 56, 0.09) 50% 100%),
    #e9eef1;
}

.report-scoreboard {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 90px minmax(0, 1fr);
  align-items: center;
  min-height: 76px;
  border-bottom: 1px solid #95a8b7;
  background: linear-gradient(90deg, #8eb5d3 0 46%, #c8d3dc 50%, #cf9e98 54% 100%);
}

.report-side-summary {
  display: grid;
  grid-template-columns: auto minmax(220px, 1fr);
  align-items: center;
  gap: 22px;
  padding: 10px 18px;
}

.report-side-summary.side-enemy {
  grid-template-columns: minmax(220px, 1fr) auto;
  text-align: right;
}

.casualty-pair {
  display: flex;
  gap: 14px;
  font-size: 14px;
  white-space: nowrap;
}

.casualty-pair span {
  display: grid;
  gap: 2px;
}

.casualty-pair b {
  font-size: 18px;
}

.troop-total {
  display: grid;
  gap: 5px;
  font-size: 17px;
}

.troop-gauge {
  height: 10px;
  overflow: hidden;
  border: 2px solid #52616b;
  border-radius: 3px;
  background: #7c858a;
}

.troop-gauge i {
  display: block;
  height: 100%;
  background: #73d6e6;
}

.side-enemy .troop-gauge i {
  margin-left: auto;
  background: #e58b74;
}

.result-emblem {
  width: 72px;
  height: 72px;
  justify-self: center;
  display: grid;
  place-content: center;
  text-align: center;
  border: 5px ridge #b68a2d;
  border-radius: 50%;
  background: #d5a83b;
  box-shadow: 0 2px 8px rgba(50, 43, 28, 0.28);
  color: #fff8d4;
}

.result-emblem small {
  font-size: 10px;
  line-height: 1;
}

.result-emblem b {
  font-size: 31px;
  line-height: 1.05;
}

.result-emblem.outcome-enemy { background: #9f5d49; }
.result-emblem.outcome-draw { background: #6f8290; }

.report-team-names {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 16px;
  padding: 10px 22px;
  border-bottom: 1px solid #aab8c2;
  font-size: 18px;
}

.report-team-names strong:last-child { text-align: right; }
.report-team-names span { color: #6d7b85; font-size: 13px; font-weight: 800; }

.report-member-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
}

.report-member {
  position: relative;
  min-width: 0;
  padding: 10px 6px 12px;
  border-right: 1px solid rgba(104, 124, 139, 0.35);
  text-align: center;
}

.report-member:nth-child(3) { border-right: 3px solid #8d9ca7; }
.report-member:last-child { border-right: 0; }

.member-role {
  min-height: 25px;
  margin-bottom: 6px;
  display: grid;
  place-items: center;
  color: #3c4850;
  font-weight: 900;
}

.member-role.commander {
  border: 1px solid #d0a632;
  background: linear-gradient(180deg, #fff3a5, #d6a72d);
  color: #5c3c00;
}

.report-member img,
.member-portrait-empty {
  width: 100%;
  aspect-ratio: 0.82;
  border: 2px solid #d8b84a;
  background: #d4dce1;
  object-fit: cover;
  object-position: top;
}

.member-portrait-empty {
  display: grid;
  place-items: center;
  color: #7b8790;
}

.member-name {
  display: block;
  min-height: 29px;
  padding: 5px 2px 2px;
  font-size: 15px;
}

.member-troops {
  display: flex;
  justify-content: space-between;
  gap: 6px;
  padding: 5px 7px;
  border: 1px solid #aeb8bf;
  background: rgba(255, 255, 255, 0.48);
  font-size: 13px;
}

.member-skill-list {
  display: grid;
  gap: 6px;
  margin-top: 8px;
}

.member-skill-stat {
  overflow: hidden;
  border: 1px solid rgba(142, 151, 156, 0.35);
  background: rgba(255, 255, 255, 0.32);
}

.member-skill-stat h4 {
  min-height: 30px;
  margin: 0;
  padding: 5px 3px;
  display: grid;
  place-items: center;
  border-bottom: 1px solid rgba(142, 151, 156, 0.35);
  background: #f8f2dc;
  color: #544419;
  font-size: 13px;
  line-height: 1.25;
}

.member-skill-stat dl {
  margin: 0;
  padding: 4px 7px;
  display: grid;
  gap: 2px;
}

.member-skill-stat dl div {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 5px;
  font-size: 12px;
}

.member-skill-stat dt { color: #68747c; }
.member-skill-stat dd { margin: 0; text-align: right; font-weight: 800; }

.detail-log-title {
  margin: 18px 0 0;
  padding-left: 10px;
  border-left: 4px solid #b8860b;
  font-size: 18px;
}

.log-groups {
  margin-top: 16px;
  display: grid;
  gap: 12px;
}

.log-group {
  border: 1px solid #e0d4c5;
  border-radius: 8px;
  background: #fffaf2;
  overflow: hidden;
}

.battle-turn-banner {
  margin: 0;
  min-height: 54px;
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    linear-gradient(90deg, rgba(30, 99, 160, 0.92), rgba(255, 255, 255, 0.18) 45%, rgba(169, 58, 44, 0.92)),
    #d8e1e8;
  border-bottom: 1px solid #c1b29f;
}

.battle-turn-banner span {
  padding: 2px 22px 6px;
  color: #ffd666;
  font-size: 30px;
  font-weight: 900;
  line-height: 1;
  text-shadow: 0 2px 0 #5f2d11, 0 0 8px rgba(255, 255, 255, 0.6);
}

.prep-sections {
  display: grid;
  gap: 10px;
  padding: 12px;
  background: linear-gradient(180deg, rgba(230, 238, 244, 0.94), rgba(247, 248, 246, 0.94));
}

.prep-section {
  border: 1px solid #c9d1d6;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.7);
  overflow: hidden;
}

.prep-section h4 {
  margin: 0;
  padding: 8px 12px;
  border-bottom: 1px solid #aeb7bd;
  color: #263238;
  font-size: 14px;
  font-weight: 900;
}

.prep-section ol,
.action-block ol {
  list-style: none;
  margin: 0;
  padding: 0;
}

.prep-section li {
  display: grid;
  grid-template-columns: 76px minmax(0, 1fr);
  gap: 10px;
  padding: 8px 12px;
  border-top: 1px solid #dde2e4;
  font-size: 13px;
}

.prep-section li:first-child {
  border-top: 0;
}

.prep-side {
  font-weight: 900;
}

.prep-message {
  min-width: 0;
  color: #263238;
}

.action-blocks {
  display: grid;
  gap: 10px;
  padding: 12px;
  background: linear-gradient(180deg, rgba(235, 239, 238, 0.94), rgba(248, 247, 241, 0.94));
}

.action-block {
  border: 1px solid #eadccb;
  border-radius: 8px;
  background: #fffdf8;
  overflow: hidden;
}

.action-block header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: linear-gradient(90deg, rgba(205, 224, 238, 0.9), rgba(245, 240, 230, 0.92));
  border-bottom: 1px solid #eadccb;
}

.action-portrait {
  width: 54px;
  height: 54px;
  border-radius: 8px;
  border: 1px solid #9eb2c2;
  object-fit: cover;
  object-position: top;
  background: #eef2f4;
  flex: 0 0 auto;
}

.action-title {
  min-width: 0;
  display: grid;
  gap: 2px;
  flex: 1;
}

.action-title strong {
  font-size: 17px;
}

.action-title small {
  color: #6f6557;
  font-weight: 800;
}

.action-metrics {
  display: grid;
  grid-template-columns: repeat(3, auto);
  gap: 12px;
  color: #6b5a40;
  font-weight: 800;
  white-space: nowrap;
}

.action-metrics b {
  color: #263238;
  font-size: 17px;
}

.action-block li {
  display: grid;
  grid-template-columns: 128px minmax(0, 1fr);
  gap: 10px;
  padding: 11px 12px;
  border-top: 1px solid #ded6ca;
  font-size: 15px;
  line-height: 1.55;
}

.action-block li:first-child {
  border-top: 0;
}

.log-side,
.action-block strong {
  font-weight: 800;
  color: #546579;
}

.log-effect {
  color: #263238;
  font-weight: 800;
}

.side-ally .log-side {
  color: #2f80ed;
}

.side-enemy .log-side {
  color: #d85b27;
}

.side-system .log-side {
  color: #667085;
}

.side-ally .prep-side,
.side-ally .action-title strong {
  color: #1f7ed6;
}

.side-enemy .prep-side,
.side-enemy .action-title strong {
  color: #bf5144;
}

.log-message {
  min-width: 0;
  color: #263238;
}

.log-part--ally-name,
.log-part--enemy-name,
.log-part--damage,
.log-part--healing,
.log-part--status {
  font-weight: 800;
}

.log-part--ally-name {
  color: #1672d4;
}

.log-part--enemy-name {
  color: #c4473a;
}

.log-part--damage {
  color: #d83b2d;
}

.log-part--healing {
  color: #79a900;
}

.log-part--status {
  color: #c15a20;
}

.is-damage .log-effect {
  color: #d83b2d;
}

.is-healing .log-effect {
  color: #79a900;
}

.picker-body {
  max-height: 70vh;
  overflow: auto;
}

@media (max-width: 900px) {
  .side-block {
    padding: 6px;
  }

  .lineup-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 4px;
  }

  .match-head,
  .result-head,
  .side-title {
    align-items: stretch;
    flex-direction: column;
  }

  .summary-pills {
    justify-content: flex-start;
  }

  .battle-turn-banner span {
    font-size: 24px;
  }

  .action-block header {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .action-metrics {
    width: 100%;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
  }

  .action-block li {
    grid-template-columns: 1fr;
    gap: 4px;
  }
}
</style>
