import { useData } from './useData'

export interface Segment {
  type: 'text' | 'status' | 'dmg' | 'scale' | 'stat'
  value?: string
  data?: any
}

const PLACEHOLDER_REGEX = /\{(\w+):([^\}]+)\}/g
const RANGE_REGEX = /(\d+(?:\.\d+)?%?)\s*(?:->|to|→)\s*(\d+(?:\.\d+)?%?)/g

const JP_STATUS_NAMES: Record<string, string> = {
  麻痺: '麻痺',
  混亂: '混乱',
  混乱: '混乱',
  無策: '無策',
  封擊: '封撃',
  封撃: '封撃',
  火傷: '火傷',
  水攻: '水攻',
  中毒: '中毒',
  消沉: '消沈',
  疲弊: '疲弊',
  威壓: '威圧',
  威圧: '威圧',
  挑釁: '挑発',
  牽制: '牽制',
  鐵壁: '鉄壁',
  閃避: '回避',
  會心: '会心',
  偽報: '偽報',
  畏縮: '畏縮',
  抵禦: '抵御',
  必中: '必中',
  先攻: '先攻',
  連擊: '連撃',
  破陣: '破陣',
  亂舞: '乱舞',
  奇謀: '奇謀',
  會心傷害率: '会心ダメージ率',
  奇謀傷害率: '奇謀ダメージ率',
  離反: '離反',
  攻心: '攻心',
  休養: '休養',
  禁療: '禁療',
  潰走: '潰走',
  洞察: '洞察',
  免疫: '免疫',
  援護: '援護',
  '發動機率增加·主動': '能動戦法発動確率上昇',
  '發動機率增加·突擊': '突撃戦法発動確率上昇',
  '發動機率增加·其他': '指定戦法発動確率上昇',
}

const JP_STATUS_DESCRIPTIONS: Record<string, string> = {
  鐵壁: '攻撃を受けた時、確率でダメージを防ぐ。発動ごとに1層消費し、層数または継続ターンが尽きると解除される。',
  禁療: '受ける回復量が低下する。',
  '發動機率增加·主動': '能動戦法の発動確率が上昇する。',
  '發動機率增加·突擊': '突撃戦法の発動確率が上昇する。',
  '發動機率增加·其他': '指定された戦法タイプの発動確率が上昇する。',
}

const JP_DAMAGE_TYPE_NAMES: Record<string, string> = {
  physical: '兵刃',
  tactical: '計略',
  strategy: '計略',
  true: '固定',
  謀略: '計略',
  真實: '固定',
}

const JP_STAT_NAMES: Record<string, string> = {
  lea: '統率',
  val: '武勇',
  int: '知略',
  pol: '政務',
  cha: '魅力',
  spd: '速度',
  統率: '統率',
  武勇: '武勇',
  智略: '知略',
  政務: '政務',
  魅力: '魅力',
  速度: '速度',
}

export function useTemplateParser() {
  const { statuses } = useData()

  const formatAsPercent = (n: number): string => {
    const pct = Math.round(n * 1000) / 10
    return pct % 1 === 0 ? `${pct.toFixed(0)}%` : `${pct}%`
  }

  const formatVarValue = (v: any, isMax: boolean, asPercent: boolean = false): string => {
    if (typeof v === 'number') {
      if (asPercent || (v > 0 && v < 1)) return formatAsPercent(v)
      return String(v)
    }
    if (v && typeof v === 'object' && 'base' in v) {
      const val = isMax ? (v.max ?? v.base) : v.base
      if (v.type === 'flat') return String(val)
      return typeof val === 'number' ? formatAsPercent(val) : String(val)
    }
    return String(v)
  }

  const statusName = (content: string, fallback?: string): string =>
    JP_STATUS_NAMES[content] || fallback || content

  const statusDescription = (content: string, fallback?: string): string =>
    JP_STATUS_DESCRIPTIONS[content] || fallback || '説明はまだありません'

  const statName = (content: string, fallback?: string): string =>
    JP_STAT_NAMES[content] || fallback || content

  const damageTypeName = (content: string, fallback?: string): string =>
    JP_DAMAGE_TYPE_NAMES[content] || (fallback ? JP_DAMAGE_TYPE_NAMES[fallback] || fallback : content)

  const parseText = (inputText: string, isMaxLevel: boolean = false, vars?: Record<string, any>): Segment[] => {
    if (!inputText) return []

    const text = inputText.replace(RANGE_REGEX, (_match, min, max) => isMaxLevel ? max : min)
    const segments: Segment[] = []
    let lastIndex = 0
    let match

    PLACEHOLDER_REGEX.lastIndex = 0

    while ((match = PLACEHOLDER_REGEX.exec(text)) !== null) {
      if (match.index > lastIndex) {
        segments.push({ type: 'text', value: text.substring(lastIndex, match.index) })
      }

      const type = match[1]
      const content = match[2]

      if (type === 'status') {
        const statusData = statuses.value[content]
        segments.push({
          type: 'status',
          data: {
            ...(statusData || {}),
            name: statusName(content, statusData?.name),
            description: statusDescription(content, statusData?.description),
          },
        })
      } else if (type === 'dmg') {
        const dmgData = statuses.value._damage_types?.[content]
        segments.push({
          type: 'dmg',
          data: {
            ...(dmgData || {}),
            name: damageTypeName(content, dmgData?.name),
          },
        })
      } else if (type === 'scale') {
        const parts = content.split(':')
        const statKey = parts[0]
        const value = parts[1] || null
        const statData = statuses.value._stats?.[statKey]

        segments.push({
          type: 'scale',
          data: {
            value,
            statInfo: statName(statKey, statData?.name),
          },
        })
      } else if (type === 'stat') {
        const statData = statuses.value._stats?.[content]
        segments.push({
          type: 'stat',
          data: {
            ...(statData || {}),
            name: statName(content, statData?.name),
          },
        })
      } else if (type === 'var') {
        if (vars && vars[content] !== undefined) {
          const v = vars[content]
          const nextCharIdx = PLACEHOLDER_REGEX.lastIndex
          const hasTrailingPercent = text[nextCharIdx] === '%'
          if (hasTrailingPercent) PLACEHOLDER_REGEX.lastIndex = nextCharIdx + 1
          segments.push({ type: 'text', value: formatVarValue(v, isMaxLevel, hasTrailingPercent) })
        } else {
          segments.push({ type: 'text', value: content })
        }
      } else {
        segments.push({ type: 'text', value: match[0] })
      }

      lastIndex = PLACEHOLDER_REGEX.lastIndex
    }

    if (lastIndex < text.length) {
      segments.push({ type: 'text', value: text.substring(lastIndex) })
    }

    return segments.map((seg) => {
      if (seg.type !== 'text' || !seg.value) return seg
      return {
        ...seg,
        value: seg.value
          .replace(/([\u4e00-\u9fff])(\d)/g, '$1 $2')
          .replace(/(\d(?:%)?)([\u4e00-\u9fff])/g, '$1 $2'),
      }
    })
  }

  const scaleText = (statInfo: string, value?: string): string => {
    const prefix = value || ''
    return `${prefix}${statInfo}の影響`
  }

  const parseTextToPlain = (inputText: string, isMaxLevel: boolean = false, vars?: Record<string, any>): string => {
    const segments = parseText(inputText, isMaxLevel, vars)
    return segments
      .map((seg) => {
        if (seg.type === 'text') return seg.value
        if (seg.type === 'status') return seg.data?.name || ''
        if (seg.type === 'dmg') return seg.data?.name || ''
        if (seg.type === 'scale') {
          if (!seg.data?.statInfo) return seg.data?.value || ''
          return scaleText(seg.data.statInfo, seg.data.value)
        }
        if (seg.type === 'stat') return seg.data?.name || ''
        return ''
      })
      .join('')
  }

  return {
    parseText,
    parseTextToPlain,
    scaleText,
  }
}
