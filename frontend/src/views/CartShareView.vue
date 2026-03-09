<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { calcQuota } from '@/utils/quotaCalc'
import { useAnalytics } from '@/composables/useAnalytics'

const route = useRoute()
const { track } = useAnalytics()
const session = ref(null)
const notFound = ref(false)
const loading = ref(true)

onMounted(async () => {
  try {
    const res = await fetch(`/api/session/${route.params.sessionId}`)
    console.log('[CartShare] status:', res.status)
    if (res.status === 404) { notFound.value = true; return }
    if (!res.ok) { notFound.value = true; return }
    const data = await res.json()
    console.log('[CartShare] data:', JSON.stringify(data))
    session.value = data
    track('cart_share_viewed', { session_id: route.params.sessionId })
  } catch (e) {
    console.error('[CartShare] error:', e)
    notFound.value = true
  } finally {
    loading.value = false
  }
})

const subtotal = computed(() => {
  if (!session.value) return 0
  return Object.values(session.value.selections).reduce(
    (sum, item) => sum + (item.price ?? 0) * (item.qty ?? 1), 0
  )
})

const quota = computed(() => session.value ? calcQuota(session.value.selections) : null)

</script>

<template>
  <div class="min-h-screen bg-gray-50">

    <!-- Header -->
    <div class="bg-teal-600 text-white px-5 py-4">
      <div class="max-w-lg mx-auto">
        <div class="text-xs font-bold uppercase tracking-widest text-teal-200 mb-0.5">High Hopes</div>
        <h1 class="text-xl font-black">Your Saved Cart</h1>
      </div>
    </div>

    <div class="max-w-lg mx-auto px-5 py-6">

      <!-- Loading -->
      <div v-if="loading" class="flex justify-center py-16">
        <div class="h-8 w-8 animate-spin rounded-full border-4 border-teal-500 border-t-transparent"></div>
      </div>

      <!-- Not found / expired / any error -->
      <div v-else-if="notFound" class="text-center py-16">
        <p class="text-2xl mb-2">😕</p>
        <p class="text-gray-700 font-semibold">This cart has expired.</p>
        <p class="text-gray-400 text-sm mt-1">Kiosk carts expire after 15 minutes of inactivity.</p>
      </div>

      <!-- Unexpected error (non-404 failure) -->
      <div v-else-if="!session" class="text-center py-16">
        <p class="text-2xl mb-2">😕</p>
        <p class="text-gray-700 font-semibold">Couldn't load this cart.</p>
        <p class="text-gray-400 text-sm mt-1">Check the console for details.</p>
      </div>

      <!-- Cart items -->
      <template v-else-if="session">
        <p class="text-sm text-gray-400 mb-5">
          Here's what was in the cart when you scanned. See the budtender to place your order!
        </p>

        <ul class="flex flex-col gap-4">
          <li
            v-for="(item, id) in session.selections"
            :key="id"
            class="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-4"
          >
            <img
              v-if="item.image"
              :src="item.image"
              class="w-16 h-16 rounded-xl object-cover shrink-0"
            />
            <div class="flex-1 min-w-0">
              <p class="font-bold text-gray-800 leading-snug">{{ item.name }}</p>
              <p v-if="item.unitWeight" class="text-sm text-gray-400">{{ item.unitWeight }}</p>
              <p v-if="item.price != null" class="text-sm font-semibold text-teal-600 mt-0.5">${{ item.price }}</p>
            </div>
            <div class="shrink-0 text-right">
              <span class="text-sm font-bold text-gray-600">×{{ item.qty ?? 1 }}</span>
            </div>
          </li>
        </ul>

        <!-- Over-limit warning -->
        <div v-if="quota?.overLimit" class="mt-4 rounded-2xl bg-red-500 text-white px-4 py-3 flex items-start gap-3">
          <span class="text-xl leading-none shrink-0">⚠️</span>
          <div>
            <p class="text-sm font-black uppercase tracking-wide leading-none mb-1">Over Daily Limit</p>
            <p class="text-sm leading-snug opacity-90">This cart exceeds the 28g daily limit. A budtender will help you adjust your order when you visit.</p>
          </div>
        </div>

        <!-- Totals -->
        <div class="mt-6 bg-white rounded-2xl shadow-sm px-5 py-4 flex flex-col gap-2">
          <div class="flex justify-between text-sm text-gray-500">
            <span>Subtotal (before tax)</span>
            <span class="tabular-nums">${{ subtotal.toFixed(2) }}</span>
          </div>
          <div class="flex justify-between font-black text-gray-800">
            <span>Est. total (20% tax)</span>
            <span class="tabular-nums">${{ (subtotal * 1.2).toFixed(2) }}</span>
          </div>
        </div>

        <p class="mt-6 text-center text-xs text-gray-400 leading-relaxed">
          Prices and availability are subject to change.<br>
          This cart is for reference only — place your order at the kiosk or with a budtender.
        </p>
      </template>

    </div>
  </div>
</template>
