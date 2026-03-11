<script setup>
import { computed, onMounted, onUnmounted } from 'vue'
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
const version = (envPrefix() + __APP_VERSION__).trim()

const route = useRoute()
const router = useRouter()
const sessionStore = useSessionStore()
const productsStore = useProductsStore()
const bundlesStore = useBundlesStore()

const isKioskFree = computed(() => route.path === '/budtender' || route.path === '/analytics' || route.path === '/bundles' || route.path.startsWith('/cart/'))
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
  router.push('/')
}

const ACTIVITY_EVENTS = ['click', 'touchstart', 'keydown', 'scroll']

onMounted(async () => {
  // Budtender page is designed to run on a separate device/tab.
  // It must NOT run initialize() — that would delete the kiosk's active session
  // from Flask (localStorage is shared across same-origin tabs).
  // It also doesn't need the inactivity timer.
  if (!isKioskFree.value) {
    await sessionStore.initialize()
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

  <span data-version class="fixed bottom-1 left-1 text-[10px] text-gray-300 pointer-events-none select-none z-50">{{ version }}</span>
</template>
