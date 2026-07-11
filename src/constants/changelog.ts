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
    version: '0.4.2',
    date: '2026-06-24',
    entries: [
      { tag: 'fix', text: '部隊切り替えや再読み込み後に、武将の突破や属性値がリセットされる問題を修正しました。' },
      { tag: 'fix', text: 'おすすめ編成で他人の公開案が誤って自分の案として表示される問題を修正し、提案削除機能を追加しました。' },
    ],
  },
  {
    version: '0.4.1',
    date: '2026-06-09',
    entries: [
      { tag: 'data', text: '今季イベント戦法を追加しました。' },
    ],
    note: '所持編集モードをオフにすると、追加されたイベント戦法を確認できます。',
  },
  {
    version: '0.4.0',
    date: '2026-05-18',
    entries: [
      { tag: 'ui', text: '全体レイアウトを見直し、主要画面の操作と表示を整理しました。' },
    ],
  },
  {
    version: '0.3.3',
    date: '2026-05-12',
    entries: [
      { tag: 'ui', text: '各機能ページのヘッダー表示を統一しました。' },
    ],
  },
  {
    version: '0.3.2',
    date: '2026-05-09',
    entries: [
      { tag: 'data', text: '武将名、戦法名、兵種、勢力、家族、コスト、レア度などのデータを更新しました。' },
      { tag: 'fix', text: '名前変更後の古い共有リンクでも、別名から自動的に該当武将・戦法へ対応できるようにしました。' },
      { tag: 'ui', text: '左側の部隊一覧が横スクロールしないよう調整しました。' },
    ],
  },
  {
    version: '0.3.1',
    date: '2026-05-03',
    entries: [
      { tag: 'feat', text: '部隊数の上限を5部隊から10部隊に拡張しました。既存データと共有リンクはそのまま利用できます。' },
      { tag: 'ui', text: 'フッターリンクを「要望/報告」に変更し、機能要望も送りやすくしました。' },
      { tag: 'data', text: '一部武将の名称、属性、兵学データを更新しました。' },
    ],
  },
  {
    version: '0.2.1',
    date: '2026-04-27',
    entries: [
      { tag: 'fix', text: 'ログインの安定性を改善し、通信揺れによる意図しないログアウトを減らしました。' },
      { tag: 'fix', text: 'ログイン期限切れ時にページを再読み込みせず、編集中のデータを保持するようにしました。' },
    ],
  },
  {
    version: '0.2.0',
    date: '2026-04-26',
    entries: [
      { tag: 'feat', text: '所持設定を複数保存し、必要に応じて切り替えられるようにしました。' },
      { tag: 'feat', text: '共有リンクから所持設定を取り込めるようにしました。' },
      { tag: 'feat', text: '所持編集に全選択/全解除を追加しました。' },
      { tag: 'ui', text: 'ユーザーメニューを用途別に整理しました。' },
      { tag: 'misc', text: '今後の機能追加に向けて内部構造を整理しました。' },
    ],
  },
  {
    version: '0.1.0',
    date: '2026-04-26',
    entries: [
      { tag: 'feat', text: '更新履歴ダイアログを追加しました。' },
      { tag: 'feat', text: 'Google / GitHub ログインと共有リンク管理を追加しました。' },
      { tag: 'feat', text: '単隊、全編成、所持データの共有リンクを作成できるようにしました。' },
    ],
  },
]

export const LATEST_VERSION = CHANGELOG[0].version
