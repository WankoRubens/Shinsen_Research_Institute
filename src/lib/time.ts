// "5 分鐘前" / "2 天前" relative-time, no Intl dependency.
export const relativeTime = (iso: string): string => {
  const sec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (sec < 60) return '剛剛'
  if (sec < 3600) return `${Math.floor(sec / 60)} 分鐘前`
  if (sec < 86400) return `${Math.floor(sec / 3600)} 小時前`
  if (sec < 86400 * 30) return `${Math.floor(sec / 86400)} 天前`
  return new Date(iso).toLocaleDateString('zh-Hant')
}
