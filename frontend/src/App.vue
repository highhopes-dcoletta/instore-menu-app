<script setup>
import { computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useProductsStore } from '@/stores/products'
import { useSessionStore } from '@/stores/session'
import { useBundlesStore } from '@/stores/bundles'
import NavBar from '@/components/NavBar.vue'
import CartPanel from '@/components/CartPanel.vue'
import CartAnimation from '@/components/CartAnimation.vue'
import { useAnalytics } from '@/composables/useAnalytics'
import { envPrefix } from '@/router/index.js'

const { t } = useI18n()
const version = (envPrefix() + __APP_VERSION__ + ' · ' + __RELEASE_NAME__).trim()
function copyVersion() { navigator.clipboard.writeText(version) }

const route = useRoute()
const router = useRouter()
const sessionStore = useSessionStore()
const productsStore = useProductsStore()
const bundlesStore = useBundlesStore()

const isKioskFree = computed(() => route.path === '/budtender' || route.path === '/analytics' || route.path === '/bundles' || route.path === '/login' || route.path === '/auth' || route.path.startsWith('/cart/'))
const { track } = useAnalytics()
const showNavBar = computed(() => !isKioskFree.value)

// ─── Inactivity timeout (2 minutes) ─────────────────────────────────────────

const INACTIVITY_MS = 2 * 60 * 1000
let inactivityTimer = null

function resetTimer() {
  clearTimeout(inactivityTimer)
  inactivityTimer = setTimeout(onInactivity, INACTIVITY_MS)
}

async function onInactivity() {
  const itemCount = sessionStore.selectionCount
  if (itemCount > 0) track('session_abandoned', { item_count: itemCount })
  await sessionStore.clearSession()
  window.location.replace('/')
}

const ACTIVITY_EVENTS = ['click', 'touchstart', 'keydown', 'scroll']

// ─── Heartbeat (route tracking for budtender view) ──────────────────────────

const HEARTBEAT_INTERVAL_MS = 30 * 1000
let heartbeatTimer = null

function sendHeartbeat(routePath) {
  if (isKioskFree.value) return
  const id = sessionStore.sessionId
  if (!id) return
  fetch('/api/session/heartbeat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: id, route: routePath }),
  }).catch(() => {}) // fire-and-forget
}

watch(() => route.path, (newPath) => {
  sendHeartbeat(newPath)
})

onMounted(async () => {
  // Budtender page is designed to run on a separate device/tab.
  // It must NOT run initialize() — that would delete the kiosk's active session
  // from Flask (localStorage is shared across same-origin tabs).
  // It also doesn't need the inactivity timer.
  if (!isKioskFree.value) {
    await sessionStore.initialize()
    sendHeartbeat(route.path) // initial heartbeat
    heartbeatTimer = setInterval(() => sendHeartbeat(route.path), HEARTBEAT_INTERVAL_MS)
    for (const evt of ACTIVITY_EVENTS) {
      window.addEventListener(evt, resetTimer, { passive: true })
    }
    resetTimer()
  }

  productsStore.loadProducts() // intentionally not awaited — loading state handles UI
  bundlesStore.loadBundles()   // intentionally not awaited
})

onUnmounted(() => {
  clearTimeout(inactivityTimer)
  clearInterval(heartbeatTimer)
  for (const evt of ACTIVITY_EVENTS) {
    window.removeEventListener(evt, resetTimer)
  }
})
</script>

<template>
  <NavBar v-if="showNavBar" />
  <CartPanel v-if="showNavBar" />
  <CartAnimation />

  <!-- /budtender and /cart/:id never need kiosk chrome or product data -->
  <template v-if="isKioskFree">
    <router-view />
  </template>
  <template v-else>
    <div v-if="productsStore.loading" class="flex flex-col items-center justify-center h-screen gap-4 pr-72">
      <div class="h-10 w-10 animate-spin rounded-full border-4 border-teal-500 border-t-transparent"></div>
      <p class="text-gray-500 text-lg">{{ t('msg.loading') }}</p>
    </div>
    <div v-else-if="productsStore.error" class="flex items-center justify-center h-screen px-8 pr-72">
      <p class="text-center text-xl text-gray-700 max-w-lg leading-relaxed">
        {{ t('msg.unavailable') }}
      </p>
    </div>
    <div v-else class="pr-72">
      <div v-if="productsStore.usingCache" class="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs font-semibold text-amber-700 text-center">
        Live menu unavailable — showing last known product list
      </div>
      <router-view />
    </div>
  </template>

  <span data-version class="fixed bottom-2 left-6 text-[10px] text-gray-300 pointer-events-none select-none z-50">{{ version }}
    <svg @click.stop="copyVersion" class="inline-block w-2.5 h-2.5 ml-0.5 -mt-px pointer-events-auto cursor-pointer text-gray-400 hover:text-gray-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
  </span>
</template>
