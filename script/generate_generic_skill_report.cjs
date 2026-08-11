const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const effectsPath = path.join(root, 'src', 'lib', 'battleSkillEffects.ts')
const skillsPath = path.join(root, '.build', 'skills.json')
const outputPath = path.join(root, 'docs', 'generic-battle-skills.md')

const effects = fs.readFileSync(effectsPath, 'utf8')
const skills = JSON.parse(fs.readFileSync(skillsPath, 'utf8'))
const generatedSection = effects
  .split('// DB戦法: ここから下は')[1]
  ?.split('// DB戦法: ここまで。')[0]

if (!generatedSection) throw new Error('Generated DB skill section was not found.')

const caseMatches = [...generatedSection.matchAll(/case '([^']+)'/g)]
const names = caseMatches.map((match) => match[1])
const skillByName = new Map()
skills.forEach((skill) => {
  if (skill.name) skillByName.set(skill.name, skill)
  if (skill.name_jp) skillByName.set(skill.name_jp, skill)
})

const typeOrder = ['受動', '兵種', '指揮', '陣法', '能動', '突撃', 'その他']
const groupedSkills = new Map(typeOrder.map((type) => [type, []]))

caseMatches.forEach((match, index) => {
  const name = match[1]
  const nextIndex = caseMatches[index + 1]?.index ?? generatedSection.length
  const block = generatedSection.slice(match.index, nextIndex)
  const type = block.match(/\/\/ 戦法タイプ: ([^\r\n]+)/)?.[1]?.trim() || 'その他'
  const normalizedType = typeOrder.includes(type) ? type : 'その他'
  groupedSkills.get(normalizedType).push(name)
})

const lines = [
  '# 個別ロジック未実装の戦法一覧',
  '',
  '> `battleSkillEffects.ts` に自動生成 `case` はありますが、戦法専用の手書きロジックには未移行です。',
  '> 現在は説明文を解析する汎用処理で動作します。戦法名を押すと詳細を開けます。',
  '',
  `**対象：${names.length}戦法**`,
  '',
  '## タイプ別件数',
  '',
  '| 戦法タイプ | 件数 |',
  '|---|---:|',
]

typeOrder.forEach((type) => {
  const count = groupedSkills.get(type).length
  if (count > 0) lines.push(`| ${type} | ${count} |`)
})

typeOrder.forEach((type) => {
  const group = groupedSkills.get(type)
  if (group.length === 0) return
  lines.push('', `## ${type}（${group.length}件）`, '')

  group
    .sort((a, b) => a.localeCompare(b, 'ja'))
    .forEach((name) => {
      const skill = skillByName.get(name)
      const description = String(skill?.description_jp || skill?.description || '説明データなし')
        .replace(/\s+/g, ' ')
        .trim()
      const activationRate = String(skill?.activation_rate || '').trim()
      const rateLabel = activationRate ? ` <code>発動率 ${activationRate}</code>` : ''
      lines.push(
        '<details>',
        `<summary><strong>${name}</strong>${rateLabel}</summary>`,
        '',
        `${name}：${description}`,
        '',
        '</details>',
        '',
      )
    })
})

fs.mkdirSync(path.dirname(outputPath), { recursive: true })
while (lines.at(-1) === '') lines.pop()
fs.writeFileSync(outputPath, `${lines.join('\n')}\n`, 'utf8')
console.log(`Wrote ${path.relative(root, outputPath)} (${names.length} skills).`)
