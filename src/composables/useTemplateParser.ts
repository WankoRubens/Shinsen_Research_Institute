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
  奇謀: '奇謀',
  攻心: '攻心',
}

const JP_STAT_NAMES: Record<string, string> = {
  lea: '統率',
  val: '武勇',
  int: '智略',
  pol: '政務',
  cha: '魅力',
  spd: '速度',
  統率: '統率',
  武勇: '武勇',
  智略: '智略',
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

  const statName = (content: string, fallback?: string): string =>
    JP_STAT_NAMES[content] || fallback || content

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
            description: statusData?.description || '説明はまだありません',
          },
        })
      } else if (type === 'dmg') {
        const dmgData = statuses.value._damage_types?.[content]
        segments.push({
          type: 'dmg',
          data: dmgData || { name: content },
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
