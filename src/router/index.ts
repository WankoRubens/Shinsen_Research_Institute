// Side-effect import: captures the raw window.location.hash at module-load
// time, BEFORE createRouter() below triggers vue-router's hash normalization
// (which prepends `/` and breaks our share/auth callback parsers). The order
// here is load-bearing — keep this import above createRouter().
// See src/lib/initial-hash.ts for the full explanation.
import '../lib/initial-hash'
import { peekInitialHash } from '../lib/initial-hash'
import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import AppLayout from '../layouts/AppLayout.vue'
import LineupBuilder from '../views/LineupBuilder.vue'
import ProfilesView from '../views/ProfilesView.vue'
import MyGroups from '../views/MyGroups.vue'
import SharesView from '../views/SharesView.vue'
import ProposalsView from '../views/ProposalsView.vue'
import BattleSimulator from '../views/BattleSimulator.vue'
import MockBattle from '../views/MockBattle.vue'
import AiLineupOptimizer from '../views/AiLineupOptimizer.vue'
import SettingsView from '../views/SettingsView.vue'
import HeroDatabaseView from '../views/HeroDatabaseView.vue'
import {
  canAccessPage,
  isPageName,
  isPagePublished,
  type PageName,
} from '../config/publishedPages'
import { fetchCurrentUserAccessRole } from '../lib/featureAccess'

const publishedRoute = (name: PageName, route: RouteRecordRaw): RouteRecordRaw[] =>
  isPagePublished(name) ? [route] : []

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: AppLayout,
    children: [
      { path: '', name: 'lineup', component: LineupBuilder },
      ...publishedRoute('profiles', {
        path: 'profiles',
        name: 'profiles',
        component: ProfilesView,
        meta: {
          title: '所持武将',
          description: '各設定は名前付きの所持データ（武将 + 戦法）です。メイン / サブ / 友人用など複数作成でき、適用後は編成シミュレータがその所持データを基準にします。',
        },
      }),
      ...publishedRoute('groups', {
        path: 'groups',
        name: 'groups',
        component: MyGroups,
        meta: {
          title: '保存した編成',
          // Cap mirrors MAX_TEAMS_PER_GROUP in types/group.ts — update both if changed.
          description: '各編成には最大10部隊まで保存できます。展開してプレビューを確認し、共有やスクリーンショットに使えます。',
        },
      }),
      ...publishedRoute('shares', {
        path: 'shares',
        name: 'shares',
        component: SharesView,
        meta: {
          title: '共有',
          description: '作成済みの共有リンクを管理します。固定、命名、コピー、削除ができます。',
        },
      }),
      ...publishedRoute('proposals', {
        path: 'proposals',
        name: 'proposals',
        component: ProposalsView,
        meta: {
          title: 'おすすめ編成',
          description: '公開された部隊の提案です。投票、編成への追加、プレビュー確認ができます。',
        },
      }),
      ...publishedRoute('battleSim', {
        path: 'battle-sim',
        name: 'battleSim',
        component: BattleSimulator,
        meta: {
          title: '戦闘シミュレータ',
          description: '保存した編成を使って、ターン制戦闘・ダメージ計算・戦法発動を試算します。',
        },
      }),
      ...publishedRoute('mockBattle', {
        path: 'mock-battle',
        name: 'mockBattle',
        component: MockBattle,
        meta: {
          title: '模擬対戦',
          description: '自軍編成と敵軍編成を作成し、1戦分のターンログを確認します。',
        },
      }),
      ...publishedRoute('aiLineup', {
        path: 'ai-lineup',
        name: 'aiLineup',
        component: AiLineupOptimizer,
        meta: {
          title: 'AI編成',
          description: '固定した武将・戦法をもとに、空き枠の組み合わせを総当たりで探索します。',
        },
      }),
      ...publishedRoute('settings', {
        path: 'settings',
        name: 'settings',
        component: SettingsView,
        meta: { title: '設定', description: '表示、外観、アカウント設定。' },
      }),
      ...publishedRoute('heroDb', {
        path: 'heroes',
        name: 'heroDb',
        component: HeroDatabaseView,
        meta: {
          title: '武将データベース',
          description: '編成時に使っている武将データを一覧表示します。',
        },
      }),
    ],
  },
  // Catch-all is critical: legacy share links (#<base64>), short share links
  // (#s/<slug>), and OAuth callbacks (#access_token=...) all hit the router with
  // a non-`/` path. Send them through LineupBuilder (no layout) so its onMounted
  // handler consumes the hash via initFromHash() before the URL is normalized
  // to `#/`.
  //
  // Guard differentiates real shares from typed garbage paths by inspecting
  // the captured hash: real shares come in as `#abc...` (no leading `/`),
  // while typed-by-hand URLs like `/#/foo` capture as `#/foo`. The latter
  // would otherwise leave the user on a chromeless LineupBuilder until F5,
  // since hash-only navigation doesn't re-fire onMounted to detect the
  // invalid blob. peek-not-consume so initFromHash can still process real
  // shares after the route mounts.
  {
    path: '/:pathMatch(.*)*',
    component: LineupBuilder,
    beforeEnter: () => {
      const raw = peekInitialHash()
      if (!raw || raw === '#' || raw.startsWith('#/')) {
        return { path: '/' }
      }
      return true
    },
  },
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

// GitHub Pages is a static host, so private features are bundled with the app.
// This guard keeps normal navigation restricted to users registered in
// public.feature_access_users. Supabase RLS remains the security boundary for
// server-side data.
router.beforeEach(async (to) => {
  if (!isPageName(to.name)) return true

  try {
    const role = await fetchCurrentUserAccessRole()
    if (canAccessPage(to.name, role)) return true
  } catch (error) {
    console.warn('Private-page access check failed:', error)
  }

  return { name: 'lineup' }
})
