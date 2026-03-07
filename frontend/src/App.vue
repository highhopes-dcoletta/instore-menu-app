<script setup>
import { computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useProductsStore } from '@/stores/products'
import { useSessionStore } from '@/stores/session'
import NavBar from '@/components/NavBar.vue'
import CartPanel from '@/components/CartPanel.vue'
import CartAnimation from '@/components/CartAnimation.vue'

const route = useRoute()
const router = useRouter()
const sessionStore = useSessionStore()
const productsStore = useProductsStore()

const isKioskFree = computed(() => route.path === '/budtender' || route.path.startsWith('/cart/'))
const showNavBar = computed(() => !isKioskFree.value)

// ─── Inactivity timeout (2 minutes) ─────────────────────────────────────────

const INACTIVITY_MS = 2 * 60 * 1000
let inactivityTimer = null

function resetTimer() {
  clearTimeout(inactivityTimer)
  inactivityTimer = setTimeout(onInactivity, INACTIVITY_MS)
}

async function onInactivity() {
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
      <p class="text-gray-500 text-lg">Loading menu...</p>
    </div>
    <div v-else-if="productsStore.error" class="flex items-center justify-center h-screen px-8 pr-72">
      <p class="text-center text-xl text-gray-700 max-w-lg leading-relaxed">
        Menu temporarily unavailable — please ask a budtender for assistance.
      </p>
    </div>
    <div v-else class="pr-72">
      <router-view />
    </div>
  </template>
</template>
