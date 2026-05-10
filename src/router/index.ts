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
import GachaLogPage from '../views/GachaLogPage.vue'
import SettingsView from '../views/SettingsView.vue'
import ComingSoon from '../views/ComingSoon.vue'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: AppLayout,
    children: [
      { path: '', name: 'lineup', component: LineupBuilder },
      { path: 'profiles', name: 'profiles', component: ProfilesView },
      { path: 'groups', name: 'groups', component: MyGroups },
      { path: 'shares', name: 'shares', component: SharesView },
      { path: 'proposals', name: 'proposals', component: ProposalsView },
      { path: 'gacha-log', name: 'gachaLog', component: GachaLogPage },
      { path: 'settings', name: 'settings', component: SettingsView },
      { path: 'coming-soon/:topic?', name: 'comingSoon', component: ComingSoon },
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
