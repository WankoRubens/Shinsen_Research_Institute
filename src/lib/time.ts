// "5分前" / "2日前" relative-time, no Intl dependency.
export const relativeTime = (iso: string): string => {
  const sec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (sec < 60) return 'たった今'
  if (sec < 3600) return `${Math.floor(sec / 60)}分前`
  if (sec < 86400) return `${Math.floor(sec / 3600)}時間前`
  if (sec < 86400 * 30) return `${Math.floor(sec / 86400)}日前`
  return new Date(iso).toLocaleDateString('ja-JP')
}
