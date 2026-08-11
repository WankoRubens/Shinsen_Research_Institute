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

const names = [...generatedSection.matchAll(/case '([^']+)'/g)].map((match) => match[1])
const skillByName = new Map()
skills.forEach((skill) => {
  if (skill.name) skillByName.set(skill.name, skill)
  if (skill.name_jp) skillByName.set(skill.name_jp, skill)
})

const lines = [
  '# 個別ロジック未実装の戦法一覧',
  '',
  'この一覧は、`battleSkillEffects.ts` に自動生成された個別 `case` はあるものの、',
  '戦法説明に合わせた専用の手書きロジックへまだ置き換えていない戦法です。',
  '現在は説明文を解析する汎用処理で動作します。',
  '',
  `対象：${names.length}戦法`,
  '',
  '## 一覧',
  '',
]

names.forEach((name) => {
  const skill = skillByName.get(name)
  const description = String(skill?.description_jp || skill?.description || '説明データなし')
    .replace(/\s+/g, ' ')
    .trim()
  lines.push(`- ${name}：${description}`)
})

fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, `${lines.join('\n')}\n`, 'utf8')
console.log(`Wrote ${path.relative(root, outputPath)} (${names.length} skills).`)
