// Side-effect import: captures the raw window.location.hash at module-load
// time, BEFORE createRouter() below triggers vue-router's hash normalization
// (which prepends `/` and breaks our share/auth callback parsers). The order
// here is load-bearing — keep this import above createRouter().
// See src/lib/initial-hash.ts for the full explanation.
import '../lib/initial-hash'
import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import AppLayout from '../layouts/AppLayout.vue'
import LineupBuilder from '../views/LineupBuilder.vue'
import MyGroups from '../views/MyGroups.vue'
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
      { path: 'groups', name: 'groups', component: MyGroups },
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
  { path: '/:pathMatch(.*)*', component: LineupBuilder },
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
})
