const fs = require('fs')

const path = 'src/lib/battleSkillEffects.ts'
const skills = require('../.build/skills.json')
let text = fs.readFileSync(path, 'utf8')

const startMarker = '    // DB戦法: ここから下は .build/skills.json から戦法名ごとに展開した個別case。'
const existingStart = text.indexOf(startMarker)
if (existingStart >= 0) {
  const existingEnd = text.indexOf('    // DB戦法: ここまで。', existingStart)
  const afterEndLine = text.indexOf('\n', existingEnd)
  text = text.slice(0, existingStart) + text.slice(afterEndLine + 1)
}

const existingManualCases = [...text.matchAll(/case '([^']+)': \{/g)].map((match) => match[1])
const manualSet = new Set(existingManualCases)
const seen = new Set()

const escapeCaseName = (value) => String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")
const oneLine = (value) =>
  String(value || '')
    .replace(/<[^>]*>/g, '')
    .replace(/\{[^}]+}/g, '')
    .replace(/\s+/g, ' ')
    .trim()

const rate = (value) => {
  if (value == null) return null
  if (typeof value === 'number') return Math.abs(value) <= 3 ? Number((value * 100).toFixed(2)) : value
  if (typeof value === 'object') {
    const number = typeof value.max === 'number' ? value.max : value.base
    if (number == null) return null
    return Math.abs(number) <= 3 ? Number((number * 100).toFixed(2)) : number
  }
  return null
}

const firstVarRate = (skill, keys) => {
  for (const key of keys) {
    const value = rate(skill.vars && skill.vars[key])
    if (value != null) return value
  }
  return null
}

const controlNames = (skill) => {
  const text = [skill.description_jp, skill.description, skill.control_type].filter(Boolean).join(' ')
  return ['無策', '封撃', '麻痺', '混乱', '挑発', '畏縮', '疲弊', '威圧', '回復不可'].filter((name) => text.includes(name))
}

const battleType = (skill) => {
  const normalize = (text) => {
    if (!text) return null
    if (/兵種|兵种|troop/i.test(text)) return '兵種'
    if (/陣法|陣形|阵法|formation/i.test(text)) return '陣法'
    if (/指揮|指挥|command/i.test(text)) return '指揮'
    if (/突撃|突擊|突击|assault/i.test(text)) return '突撃'
    if (/受動|被動|被动|passive/i.test(text)) return '受動'
    if (/能動|主動|主动|active/i.test(text)) return '能動'
    return null
  }
  return normalize(skill.type)
    || normalize(skill.category)
    || normalize(skill.category_jp)
    || normalize(skill.game8_kind)
    || normalize([skill.description_jp, skill.description].filter(Boolean).join(' '))
    || '能動'
}

const generatedBlocks = []

for (const skill of skills) {
  const name = skill.name_jp || skill.name
  if (!name || manualSet.has(name) || seen.has(name)) continue
  seen.add(name)

  const comments = []
  comments.push(`戦法タイプ: ${battleType(skill)}`)
  const summary = oneLine(skill.brief_description_jp || skill.description_jp || skill.brief_description || skill.description)
  if (summary) comments.push(summary.length > 140 ? `${summary.slice(0, 137)}...` : summary)

  const damageRate = rate(skill.damage_rate_max) ?? firstVarRate(skill, [
    'damage_rate',
    'dmg_rate',
    'dmg',
    'dmg1',
    'damage_1',
    'damage',
    'prep_strategy_rate',
    'strategy_rate',
    'counter_damage_rate',
    'normal_atk_dmg',
    'fire_damage_rate',
    'commander_dmg_rate',
  ])
  const healRate = rate(skill.heal_rate_max) ?? firstVarRate(skill, ['heal_rate', 'heal', 'recovery_rate', 'enhanced_heal_rate'])
  const extraDamageRate = firstVarRate(skill, ['damage_2', 'dmg2', 'extra_damage_rate'])
  const dotRate = rate(skill.dot_rate_max)
  const controls = controlNames(skill)
  const buffValue = firstVarRate(skill, [
    'stat_buff',
    'stat_inc',
    'leadership_buff',
    'intelligence_buff',
    'valor_buff_at_threshold',
    'speed_buff',
    'valor_speed_buff',
    'ally_valor_speed_buff',
    'damage_buff',
    'damage_buff_base',
    'dmg_boost',
    'strategy_rate_buff',
    'dmg_reduce',
    'damage_reduction',
    'dmg_red',
    'stat_debuff',
    'leadership_debuff',
    'damage_debuff',
  ])

  const target = skill.target_jp || skill.target || '対象'
  const kind = skill.damage_type === '計略' || /計略|謀略|智略|知略/.test(summary) ? '計略' : '兵刃'

  if (damageRate != null) comments.push(`${target}に${kind}ダメージ（ダメージ率${damageRate}%）を与える`)
  if (extraDamageRate != null) comments.push(`追加効果として別判定のダメージ（ダメージ率${extraDamageRate}%）を扱う`)
  if (healRate != null) comments.push(`${target}を回復（回復率${healRate}%）する`)
  if (controls.length > 0) comments.push(`${controls.join('・')}を付与する`)
  if (skill.dot_name && dotRate != null) comments.push(`${skill.dot_name}状態を付与し、継続ダメージ（ダメージ率${dotRate}%）を処理する`)
  if (buffValue != null) comments.push(`戦法説明にある能力値/与ダメ/被ダメ補正（${buffValue}%または${buffValue}）を反映する`)
  if (comments.length === 0) comments.push('DBの戦法説明に基づく効果を実行する')

  const commentLines = [...new Set(comments)]
    .slice(0, 5)
    .map((comment) => `      // ${comment}`)
    .join('\n')

  const body = []
  const damageKind = kind === '計略' ? 'strategy' : 'physical'
  if (buffValue != null) body.push('      applyDatabaseBuffs(ctx, h)')
  if (damageRate != null) {
    body.push(`      databaseTargets(ctx, h, 'damage').forEach((target) => {`)
    body.push(`        h.dealSkillDamage(ctx, target, ${damageRate}, '${damageKind}')`)
    body.push('      })')
  }
  if (extraDamageRate != null) {
    body.push(`      if (h.roll(ctx.rng, chanceFrom(ctx.skill, ['extra_trigger_chance', 'extra_prob', 'extra_chance'], 1))) {`)
    body.push(`        const target = h.chooseTarget(ctx.enemies, ctx.rng)`)
    body.push(`        if (target) h.dealSkillDamage(ctx, target, ${extraDamageRate}, '${damageKind}')`)
    body.push('      }')
  }
  if (healRate != null) {
    body.push(`      databaseTargets(ctx, h, 'heal').forEach((target) => {`)
    body.push(`        h.healBySkill(ctx, target, ${healRate}, databaseHealKind(ctx.skill))`)
    body.push('      })')
  }
  if (controls.length > 0) {
    body.push(`      databaseTargets(ctx, h, 'control').forEach((target) => {`)
    body.push(`        ${JSON.stringify(controls)}.forEach((name) => {`)
    body.push(`          if (h.roll(ctx.rng, chanceFrom(ctx.skill, ['status_chance', 'debuff_rate', 'random_rate', 'pressure_rate', 'fatigue_rate'], 1))) {`)
    body.push(`            h.addControl(ctx, target, name, durationFromDatabase(ctx.skill, 1))`)
    body.push('          }')
    body.push('        })')
    body.push('      })')
  }
  if (skill.dot_name && dotRate != null) body.push('      applyDatabaseDot(ctx, h)')
  if (body.length === 0) body.push('      return applyDatabaseSkillEffect(ctx, h)')
  else body.push('      return true')

  generatedBlocks.push(`
    case '${escapeCaseName(name)}': {
${commentLines}
${body.join('\n')}
    }`)
}

const generated = `
    // DB戦法: ここから下は .build/skills.json から戦法名ごとに展開した個別case。
    // 精度を上げたい戦法は、該当case内を回天転運のような手書き処理に置き換える。${generatedBlocks.join('')}
    // DB戦法: ここまで。
`

const before = text
text = text.replace(
  /\n    default:\r?\n      return applyDatabaseSkillEffect\(ctx, h\)\r?\n  }/,
  `${generated}
    default:
      return false
  }`,
)

if (text === before) {
  text = before.replace(
    /\n    default:\r?\n      return false\r?\n  }/,
    `${generated}
    default:
      return false
  }`,
  )
}

if (text === before) {
  throw new Error('Could not find default fallback to replace')
}

fs.writeFileSync(path, text, 'utf8')
console.log(`Generated ${generatedBlocks.length} DB skill cases. Manual cases kept: ${existingManualCases.length}.`)
