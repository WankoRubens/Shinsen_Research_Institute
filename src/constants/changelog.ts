// Changelog data. Append new versions to the top.
// LATEST_VERSION drives the one-time auto-open behavior.

export type ChangelogTag = 'feat' | 'fix' | 'ui' | 'data' | 'misc'

export interface ChangelogEntry {
  text: string
  tag?: ChangelogTag
}

export interface ChangelogVersion {
  version: string
  date: string
  entries: ChangelogEntry[]
  note?: string
}

export const TAG_LABELS: Record<ChangelogTag, string> = {
  feat: '新機能',
  fix: '修正',
  ui: 'UI',
  data: 'データ',
  misc: 'その他',
}

export const TAG_COLORS: Record<ChangelogTag, string> = {
  feat: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  fix: 'bg-rose-50 text-rose-700 border-rose-200',
  ui: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  data: 'bg-amber-50 text-amber-700 border-amber-200',
  misc: 'bg-gray-50 text-gray-600 border-gray-200',
}

export const CHANGELOG: ChangelogVersion[] = [
  {
    version: '0.1.0',
    date: '2026-07-22',
    entries: [
      { tag: 'feat', text: 'Githubアカウントでログインすれば' },
      { tag: 'feat', text: '編成を紹介できるようになりました。' },
    ],
  },
    {
    version: '0.0.1',
    date: '2026-07-15',
    entries: [
      { tag: 'feat', text: 'フリーらしいのでもらってきました。' },
    ],
  },
]

export const LATEST_VERSION = CHANGELOG[0].version
