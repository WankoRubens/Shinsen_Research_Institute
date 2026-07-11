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
          <span>Cost {{ teamCost(allyTeam) }}</span>
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
          <span>Cost {{ teamCost(enemyTeam) }}</span>
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
        <div class="result-head">
          <div>
            <p class="eyebrow">対戦結果</p>
            <h2>{{ outcomeLabel }}</h2>
          </div>
          <div class="summary-pills">
            <span>自軍 {{ formatNumber(result.summary.allyHp) }} / {{ formatNumber(result.summary.allyMaxHp) }}</span>
            <span>敵軍 {{ formatNumber(result.summary.enemyHp) }} / {{ formatNumber(result.summary.enemyMaxHp) }}</span>
            <span>{{ result.summary.turns }}ターン</span>
          </div>
        </div>

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
                    <strong>{{ block.actor ? `${block.actor}の行動` : 'SYSTEM' }}</strong>
                    <small v-if="block.actor">速度 {{ actorSpeed(block) }}</small>
                  </div>
                  <div v-if="block.actor" class="action-metrics">
                    <span>兵力 <b>{{ formatNumber(actorHp(block)) }}</b></span>
                    <span>撃破数 <b>{{ blockKills(block) }}</b></span>
                    <span>救援 <b>{{ formatNumber(blockHealing(block)) }}</b></span>
                  </div>
                </header>
                <ol>
                  <li
                    v-for="(entry, index) in block.entries"
                    :key="`${block.id}-${index}`"
                    :class="[{ 'is-damage': entry.valueType === 'damage', 'is-healing': entry.valueType === 'healing' }]"
                  >
                    <span class="log-effect">{{ entry.effect || entry.target || '効果' }}</span>
                    <span class="log-message">{{ entry.message }}</span>
                  </li>
                </ol>
              </section>
            </div>
          </article>
        </div>
      </section>

      <el-empty v-else description="自軍編成と敵軍編成を作成して、模擬対戦を実行してください。" />
    </div>

    <el-dialog v-model="heroPickerVisible" title="武将を選択" width="920px" class="sim-picker-dialog" append-to-body>
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

    <el-dialog v-model="skillPickerVisible" title="戦法を選択" width="760px" class="sim-picker-dialog" append-to-body>
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
import { simulateBattle, type BattleFighter, type BattleLogEntry, type BattleResult } from '../lib/battleSimulator'
import { battleSkillType, isExclusiveTeamSkillType } from '../lib/battleSkillEffects'
import { useLineups } from '../composables/useLineups'
import type { BingxueMinor, Lineup, RoleData } from '../composables/useLineups'
import { useData, type EnemyFormation, type Hero, type Skill } from '../composables/useData'
import { heroLevel50Stats } from '../lib/heroStats'

type RoleKey = 'main' | 'vice1' | 'vice2'
type BattleSideKey = 'ally' | 'enemy'
type LogSide = BattleLogEntry['side']
type PrepRow = { side: LogSide; message: string }
type PrepSection = { title: string; rows: PrepRow[] }
type ActionBlock = { id: string; side: LogSide; actor: string; entries: BattleLogEntry[] }

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
  main: emptyRole(),
  vice1: emptyRole(),
  vice2: emptyRole(),
})

const allyTeam = reactive<Lineup>(makeBattleTeam('自軍編成'))
const enemyTeam = reactive<Lineup>(makeBattleTeam('敵軍編成'))
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
const heroBySimId = computed(() => new Map(heroes.value.map((hero) => [hero.sim_id, hero]).filter(([id]) => !!id) as [string, Hero][]))
const skillBySimId = computed(() => new Map(skills.value.map((skill) => [skill.sim_id, skill]).filter(([id]) => !!id) as [string, Skill][]))
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

const fighterByActor = (side: LogSide, actor: string): BattleFighter | null => {
  if (!result.value || side === 'system') return null
  const fighters = side === 'ally' ? result.value.ally : result.value.enemy
  return fighters.find((fighter) => fighter.name === actor) ?? null
}

const rolesWithSide = () => [
  ...rolesOf(allyTeam).map((role) => ({ side: 'ally' as const, role })),
  ...rolesOf(enemyTeam).map((role) => ({ side: 'enemy' as const, role })),
].filter((item) => item.role.hero)

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

  const skillRows = entries
    .filter((entry) => entry.side !== 'system')
    .map((entry) => ({ side: entry.side, message: entry.message }))

  return [
    { title: '合戦開始', rows: battleStartRows.length ? battleStartRows : [{ side: 'system', message: '合戦開始' }] },
    { title: '士気の影響', rows: moraleRows },
    { title: '兵種の影響', rows: troopRows },
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

const groupedLogs = computed(() => {
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
      const actor = entry.actor || ''
      const previous = blocks[blocks.length - 1]
      if (previous && previous.side === entry.side && previous.actor === actor) {
        previous.entries.push(entry)
        return
      }
      blocks.push({
        id: `${turn}-${index}-${entry.side}-${actor || 'system'}`,
        side: entry.side,
        actor,
        entries: [entry],
      })
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
  const role = roleByActor(block.side, block.actor)
  return Number(role?.stats.spd ?? 0).toFixed(1)
}
const actorHp = (block: ActionBlock): number => {
  const firstActorTargetLog = block.entries.find((entry) => entry.target === block.actor && typeof entry.beforeHp === 'number')
  if (firstActorTargetLog?.beforeHp != null) return firstActorTargetLog.beforeHp
  return fighterByActor(block.side, block.actor)?.hp ?? 0
}
const blockHealing = (block: ActionBlock): number =>
  block.entries.reduce((sum, entry) => sum + (entry.valueType === 'healing' ? entry.amount ?? 0 : 0), 0)
const blockKills = (block: ActionBlock): number =>
  block.entries.filter((entry) => entry.valueType === 'damage' && entry.afterHp === 0 && (entry.beforeHp ?? 0) > 0).length

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
  target.main = cloneRole(source.main)
  target.vice1 = cloneRole(source.vice1)
  target.vice2 = cloneRole(source.vice2)
  normalizeExclusiveTeamSkills(target)
  result.value = null
}

const roleFromTemplateMember = (member: EnemyFormation['members'][number]): RoleData => {
  const hero = heroBySimId.value.get(member.commander_id) ?? null
  return {
    ...emptyRole(),
    hero,
    skill1: member.skill1_id ? skillBySimId.value.get(member.skill1_id) ?? null : null,
    skill2: member.skill2_id ? skillBySimId.value.get(member.skill2_id) ?? null : null,
    breakthrough: templateBreakthrough,
    stats: statsWithFocus(hero, member.stat_focus, templateBreakthrough),
  }
}

const lineupFromTemplate = (formation: EnemyFormation): Lineup => ({
  name: formation.name,
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

.summary-pills {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
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
.action-block strong,
.log-effect {
  font-weight: 800;
  color: #546579;
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
.side-ally .action-title strong,
.side-ally .log-message {
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

.side-enemy .log-message {
  color: #8f453d;
}

.is-damage .log-effect {
  color: #d85b27;
}

.is-healing .log-effect {
  color: #168a57;
}

.picker-body {
  max-height: 70vh;
  overflow: auto;
}

@media (max-width: 900px) {
  .lineup-grid {
    grid-template-columns: 1fr;
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
