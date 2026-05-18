<template>
  <div class="skills-preview">
    <!-- Hero names float ABOVE the table — no card frame, no border.
         The watermark strip below acts as the visual transition into the
         skills table; together they give the names a sense of "headers
         that aren't trapped inside a header row". -->
    <div class="hero-name-row">
      <div
        v-for="(role, i) in roles"
        :key="`n-${i}`"
        class="hero-name-col"
        :class="`hero-name-col--${role.key}`"
      >
        <span class="role-chip" :class="`role-chip--${role.key}`">{{ role.label }}</span>
        <span class="hero-name" :class="{ 'hero-name--main': role.key === 'main' }">
          {{ role.data.hero?.name ?? '—' }}
        </span>
        <span v-if="role.data.breakthrough > 0" class="break-chip">突{{ role.data.breakthrough }}</span>
      </div>
    </div>

    <!-- Watermark sits OUTSIDE the skills card as a divider — no background,
         no border, just a hairline + brand stamp. Tight vertical rhythm
         (small gap above + below) keeps it visually attached to both
         neighbours without looking like an interior table row. -->
    <div class="watermark-divider">
      <span class="wm-line" />
      <span class="wm-stamp">
        <span class="wm-icon font-brand">猫</span>
        <span class="wm-text font-brand">真戰配將</span>
      </span>
      <span class="wm-line wm-line--right" />
    </div>

    <!-- Skills + 兵學 fused into one card. -->
    <div class="skills-card">
      <div class="grid grid--skills">
        <div v-for="(role, i) in roles" :key="`s-${i}`" class="skill-col">
          <el-tooltip
            :content="uniqueSkills[i]?.brief_description || ''"
            :disabled="!uniqueSkills[i]?.brief_description"
            placement="top"
            effect="dark"
          >
            <div class="skill-cell skill-cell--unique" :class="{ 'skill-cell--empty': !uniqueSkills[i] }">
              <span class="own-tag">自</span>
              <span class="skill-text">{{ uniqueSkills[i]?.name ?? '—' }}</span>
            </div>
          </el-tooltip>
          <el-tooltip
            :content="role.data.skill1?.brief_description || ''"
            :disabled="!role.data.skill1?.brief_description"
            placement="top"
            effect="dark"
          >
            <div
              class="skill-cell"
              :class="{
                'skill-cell--empty': !role.data.skill1,
                'skill-cell--meta': isMetaSkill(role.data.skill1),
              }"
            >
              {{ role.data.skill1?.name ?? '—' }}
            </div>
          </el-tooltip>
          <el-tooltip
            :content="role.data.skill2?.brief_description || ''"
            :disabled="!role.data.skill2?.brief_description"
            placement="top"
            effect="dark"
          >
            <div
              class="skill-cell skill-cell--last"
              :class="{
                'skill-cell--empty': !role.data.skill2,
                'skill-cell--meta': isMetaSkill(role.data.skill2),
              }"
            >
              {{ role.data.skill2?.name ?? '—' }}
            </div>
          </el-tooltip>
        </div>
      </div>

      <!-- 兵學 fused into the bottom of the same card. Each column has its
           own colored block (direction palette: red/amber/purple/emerald)
           with no separate outer border — the card border already frames
           them. The colored direction header is the only chromatic accent. -->
      <div v-if="hasAnyBingxue" class="grid grid--bingxue">
        <div
          v-for="(role, i) in roles"
          :key="`b-${i}`"
          class="bingxue-col"
          :data-dir="role.data.bingxue.direction || undefined"
        >
          <template v-if="role.data.bingxue.direction">
            <div class="bingxue-header" :data-dir="role.data.bingxue.direction">
              <span class="bingxue-dir">{{ role.data.bingxue.direction }}</span>
              <span class="bingxue-major">{{ role.data.bingxue.major ? bingxueName(role.data.bingxue.major) : '—' }}</span>
            </div>
            <div v-if="role.data.bingxue.minors.length" class="bingxue-minors">
              <span
                v-for="(m, j) in role.data.bingxue.minors"
                :key="`${m.name}-${j}`"
                class="bingxue-minor"
                :data-dir="role.data.bingxue.direction"
              >
                {{ bingxueName(m.name) }} {{ roman(m.level) }}
              </span>
            </div>
          </template>
          <div v-else class="bingxue-empty">未設定 兵學</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Lineup } from '../../composables/useLineups'
import { useData, type Skill } from '../../composables/useData'

const { skills, bingxue: bingxueCatalog } = useData()

const props = defineProps<{
  team: Lineup
}>()

const findSkillByName = (name: string | null | undefined): Skill | null => {
  if (!name) return null
  return skills.value.find(s => s.name === name || s.name_jp === name) ?? null
}

const isMetaSkill = (s: Skill | null | undefined): boolean =>
  s?.type === '兵種' || s?.type === '陣法'

const roles = computed(() => [
  { key: 'main',  label: '主將', data: props.team.main },
  { key: 'vice1', label: '副將', data: props.team.vice1 },
  { key: 'vice2', label: '副將', data: props.team.vice2 },
])

const uniqueSkills = computed(() =>
  roles.value.map(r => findSkillByName(r.data.hero?.unique_skill)),
)

const bingxueName = (jp: string): string => bingxueCatalog.value[jp]?.name ?? jp
const roman = (n: number): string => ['', 'I', 'II', 'III', 'IV', 'V'][n] ?? String(n)
const hasAnyBingxue = computed(() =>
  roles.value.some(r => r.data.bingxue.direction),
)
</script>

<style scoped>
.skills-preview {
  display: flex;
  flex-direction: column;
  gap: 0;
}

/* Hero names: floating row, no border, no background, no card frame.
   Tight padding-bottom so the watermark divider below sits close. */
.hero-name-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  padding: 2px 6px 2px;
}
.hero-name-col {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 4px 4px;
  flex-wrap: wrap;
  min-height: 30px;
}

/* Role chip: 主將 amber gradient with shadow lift = the primary actor.
   Vice chips: neutral, quietly bordered. */
.role-chip {
  padding: 2px 7px;
  font-size: 10px;
  font-weight: 700;
  border-radius: 4px;
  letter-spacing: 1px;
  flex-shrink: 0;
  line-height: 1.3;
}
.role-chip--main {
  background: linear-gradient(135deg, #b45309 0%, #92400e 100%);
  color: #fff;
  box-shadow: 0 1px 2px rgba(180, 83, 9, 0.3);
}
.role-chip--vice1,
.role-chip--vice2 {
  background: rgb(var(--color-surface-muted));
  color: rgb(var(--color-ink-soft));
  border: 1px solid rgb(var(--color-divider));
}

.hero-name {
  font-size: 16px;
  font-weight: 700;
  color: rgb(var(--color-ink));
  letter-spacing: 0.3px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}
.hero-name--main { color: #92400e; }

.break-chip {
  padding: 1px 5px;
  font-size: 10px;
  font-weight: 700;
  border-radius: 3px;
  background: #fce7f3;
  color: #be185d;
  flex-shrink: 0;
}

/* Watermark sits as a divider between floating names and the skills card.
   No background, no enclosing border — purely a hairline + stamp. Vertical
   padding kept tight so it visually couples to both neighbours. */
.watermark-divider {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 12px 5px;
  background: transparent;
}

/* Skills card: contains skills + 兵學 only. No more watermark wrapper
   inside. */
.skills-card {
  border: 1px solid rgb(var(--color-divider));
  border-radius: 10px;
  overflow: hidden;
  background: #fff;
}
.wm-line {
  flex: 1;
  height: 1px;
  background: linear-gradient(to right,
    rgba(180, 83, 9, 0.4),
    rgba(180, 83, 9, 0.4) 60%,
    transparent);
}
.wm-line--right {
  background: linear-gradient(to left,
    rgba(180, 83, 9, 0.4),
    rgba(180, 83, 9, 0.4) 60%,
    transparent);
}
.wm-stamp {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  pointer-events: none;
}
.wm-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 1.5px solid #b45309;
  background: transparent;
  color: #b45309;
  font-weight: 700;
  font-size: 11px;
  line-height: 1;
}
.wm-text {
  font-weight: 700;
  color: #b45309;
  font-size: 11px;
  letter-spacing: 2.8px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
}

.skill-col {
  display: flex;
  flex-direction: column;
  border-right: 1px solid rgb(var(--color-divider));
}
.skill-col:last-child { border-right: none; }
.skill-cell {
  font-size: 14px;
  font-weight: 500;
  padding: 8px 8px;
  text-align: center;
  border-bottom: 1px solid rgb(var(--color-divider));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: default;
  transition: background 0.12s ease;
  line-height: 1.2;
}
.skill-cell--last { border-bottom: none; }
.skill-cell:hover { background: rgb(var(--color-highlight)); }
.skill-cell--empty { color: rgb(var(--color-ink-mute)); }
.skill-cell--meta {
  font-weight: 700;
  background: rgba(180, 83, 9, 0.05);
}
.skill-cell--meta:hover { background: rgba(180, 83, 9, 0.12); }
.skill-cell--unique {
  background: rgba(180, 83, 9, 0.06);
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
.skill-cell--unique:hover { background: rgba(180, 83, 9, 0.12); }
.own-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 4px;
  background: #b45309;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
}
.skill-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 兵學 grid: continuation of the same card. Heavy top border (2px) makes
   it read as a distinct section without using a different background, so
   the table reads as one coherent block divided by emphasis. Each column
   keeps its colored direction header for the 4-school palette. */
.grid--bingxue {
  border-top: 2px solid rgb(var(--color-divider));
}
/* Col is the height-filling container; minors content sits at the top with
   its natural height. The direction tint lives on the col so taller siblings
   in the same grid row stretch this one (via grid row alignment) but the
   colored band still covers the full height — no awkward empty strip. */
.bingxue-col {
  border-right: 1px solid rgb(var(--color-divider));
  display: flex;
  flex-direction: column;
  background: #fff;
}
.bingxue-col:last-child { border-right: none; }

.bingxue-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 9px;
  color: #fff;
  font-weight: 700;
  min-width: 0;
}
.bingxue-dir { font-size: 10px; opacity: 0.85; flex-shrink: 0; letter-spacing: 0.5px; }
.bingxue-major {
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* No flex: 1 — the minors block claims only its content height. align-content
   pins the chip line(s) to the top so even a stretched col never centers
   them in dead space. */
.bingxue-minors {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  padding: 5px 6px;
  align-content: flex-start;
}
.bingxue-minor {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 3px;
  border: 1px solid;
  white-space: nowrap;
  font-weight: 600;
}
.bingxue-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px 6px;
  color: rgb(var(--color-ink-mute));
  font-size: 11px;
  letter-spacing: 1px;
}

/* Direction palette: tints the col background (so the colored band covers
   any row-stretched height), the header bar, and the minor chips. The four
   schools (武略/陣立/機略/臨戰) read instantly. */
.bingxue-col[data-dir="武略"] { background: rgba(254, 226, 226, 0.35); }
.bingxue-header[data-dir="武略"] { background: #ef4444; }
.bingxue-minor[data-dir="武略"]  { background: #fee2e2; border-color: #fca5a5; color: #991b1b; }

.bingxue-col[data-dir="陣立"] { background: rgba(254, 243, 199, 0.35); }
.bingxue-header[data-dir="陣立"] { background: #d97706; }
.bingxue-minor[data-dir="陣立"]  { background: #fef3c7; border-color: #fcd34d; color: #92400e; }

.bingxue-col[data-dir="機略"] { background: rgba(243, 232, 255, 0.35); }
.bingxue-header[data-dir="機略"] { background: #a855f7; }
.bingxue-minor[data-dir="機略"]  { background: #f3e8ff; border-color: #d8b4fe; color: #6b21a8; }

.bingxue-col[data-dir="臨戰"] { background: rgba(209, 250, 229, 0.35); }
.bingxue-header[data-dir="臨戰"] { background: #10b981; }
.bingxue-minor[data-dir="臨戰"]  { background: #d1fae5; border-color: #6ee7b7; color: #065f46; }
</style>
