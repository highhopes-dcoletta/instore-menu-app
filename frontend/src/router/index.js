import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import FlowerView from '@/views/FlowerView.vue'
import PreRollsView from '@/views/PreRollsView.vue'
import EdiblesView from '@/views/EdiblesView.vue'
import VapesView from '@/views/VapesView.vue'
import DabsView from '@/views/DabsView.vue'
import TincturesTopicalsView from '@/views/TincturesTopicalsView.vue'
import SleepView from '@/views/SleepView.vue'
import PainView from '@/views/PainView.vue'
import BudtenderView from '@/views/BudtenderView.vue'
import BundlesView from '@/views/BundlesView.vue'
import AnalyticsView from '@/views/AnalyticsView.vue'
import CartShareView from '@/views/CartShareView.vue'
import GuidedView from '@/views/GuidedView.vue'
import ScatterView from '@/views/ScatterView.vue'
import TerpenesView from '@/views/TerpenesView.vue'
import { useAuth, checkSessionExpiry, clearStaffSession } from '@/composables/useAuth'

const DEFAULT_TITLE = 'High Hopes Menu'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: HomeView },
    { path: '/guide', component: GuidedView },
    { path: '/flower', component: FlowerView },
    { path: '/pre-rolls', component: PreRollsView },
    { path: '/edibles', component: EdiblesView },
    { path: '/vapes', component: VapesView },
    { path: '/concentrates', component: DabsView },
    { path: '/tinctures-and-topicals', component: TincturesTopicalsView },
    { path: '/sleep', component: SleepView },
    { path: '/pain', component: PainView },
    { path: '/explore', component: ScatterView },
    { path: '/terpenes', component: TerpenesView },
    { path: '/budtender', component: BudtenderView, meta: { title: 'Budtender at High Hopes', requiresAuth: true } },
    { path: '/bundles', component: BundlesView, meta: { title: 'Bundles at High Hopes', requiresAuth: true } },
    { path: '/analytics', component: AnalyticsView, meta: { title: 'Analytics at High Hopes', requiresAuth: true } },
    { path: '/cart/:sessionId', component: CartShareView },
    { path: '/login', component: () => import('@/views/LoginView.vue'), meta: { title: 'Sign In' } },
    { path: '/auth', component: () => import('@/views/AuthCallbackView.vue'), meta: { title: 'Signing in...' } },
  ],
})

export function envPrefix() {
  const host = window.location.hostname
  if (host.includes('-stage') || host.includes('.stage')) return '[stage] '
  if (host === 'localhost' || host === '127.0.0.1') return '[local] '
  return ''
}

// MSAL is already initialized in main.js before the router is installed.
// The guard only needs to check the auth state.
router.beforeEach((to) => {
  // Expire stale staff sessions (30 min)
  checkSessionExpiry()

  const { isAuthenticated } = useAuth()

  // Authenticated user landed on /login or /auth — send them to their target
  if ((to.path === '/login' || to.path === '/auth') && isAuthenticated.value) {
    const target = to.query.redirect || sessionStorage.getItem('auth_redirect') || '/budtender'
    sessionStorage.removeItem('auth_redirect')
    return { path: target, replace: true }
  }

  // Protected route — send unauthenticated users to login
  if (to.meta.requiresAuth && !isAuthenticated.value) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }

  // Public kiosk route — clear any leftover staff session so the kiosk
  // browser doesn't stay signed in if a staff member used it by mistake
  if (!to.meta.requiresAuth && to.path !== '/login' && to.path !== '/auth' && isAuthenticated.value) {
    clearStaffSession()
  }
})

router.afterEach((to) => {
  const base = envPrefix() + (to.meta.title || DEFAULT_TITLE)
  document.title = `${base} (${__APP_VERSION__})`
})

export default router
