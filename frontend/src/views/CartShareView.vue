<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { calcQuota } from '@/utils/quotaCalc'
import { useAnalytics } from '@/composables/useAnalytics'
import { computeAppliedDeals } from '@/composables/useBundles'
import { useFeatureFlags } from '@/composables/useFeatureFlags'

const { t } = useI18n()

const route = useRoute()
const { track } = useAnalytics()
const { bundlesEnabled } = useFeatureFlags()
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

const appliedDeals = computed(() =>
  session.value ? computeAppliedDeals(session.value.selections) : []
)

const totalDiscount = computed(() => appliedDeals.value.reduce((s, d) => s + d.savings, 0))
const adjustedSubtotal = computed(() => subtotal.value - totalDiscount.value)

</script>

<template>
  <div class="min-h-screen bg-gray-50">

    <!-- Header -->
    <div class="bg-teal-600 text-white px-5 py-4">
      <div class="max-w-lg mx-auto">
        <div class="text-xs font-bold uppercase tracking-widest text-teal-200 mb-0.5">High Hopes</div>
        <h1 class="text-xl font-black">{{ t('cart.savedCart') }}</h1>
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
        <p class="text-gray-700 font-semibold">{{ t('cart.cartExpired') }}</p>
        <p class="text-gray-400 text-sm mt-1">{{ t('cart.cartExpiredSub') }}</p>
      </div>

      <!-- Unexpected error (non-404 failure) -->
      <div v-else-if="!session" class="text-center py-16">
        <p class="text-2xl mb-2">😕</p>
        <p class="text-gray-700 font-semibold">{{ t('cart.cantLoadCart') }}</p>
        <p class="text-gray-400 text-sm mt-1">Check the console for details.</p>
      </div>

      <!-- Cart items -->
      <template v-else-if="session">
        <p class="text-sm text-gray-400 mb-5">
          {{ t('cart.cartShareIntro') }}
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
            <p class="text-sm font-black uppercase tracking-wide leading-none mb-1">{{ t('cart.overLimitTitle') }}</p>
            <p class="text-sm leading-snug opacity-90">{{ t('cart.overLimitShareMessage') }}</p>
          </div>
        </div>

        <!-- Totals -->
        <div class="mt-6 bg-white rounded-2xl shadow-sm px-5 py-4 flex flex-col gap-2">
          <div class="flex justify-between text-sm"
            :class="bundlesEnabled && appliedDeals.length ? 'text-gray-400 line-through' : 'text-gray-500'">
            <span>{{ t('cart.subtotalBeforeTax') }}</span>
            <span class="tabular-nums">${{ subtotal.toFixed(2) }}</span>
          </div>
          <template v-if="bundlesEnabled">
            <div v-for="deal in appliedDeals" :key="deal.id" class="flex justify-between text-sm">
              <span class="font-semibold text-green-600">🎉 {{ deal.label }}</span>
              <span class="font-bold text-green-600 tabular-nums">-${{ deal.savings.toFixed(2) }}</span>
            </div>
            <div v-if="appliedDeals.length" class="flex justify-between text-sm text-gray-700 font-semibold">
              <span>{{ t('cart.dealPrice') }}</span>
              <span class="tabular-nums">${{ adjustedSubtotal.toFixed(2) }}</span>
            </div>
          </template>
          <div class="flex justify-between font-black text-gray-800 border-t border-gray-100 pt-2 mt-1">
            <span>{{ t('cart.estTotal') }}</span>
            <span class="tabular-nums">${{ ((bundlesEnabled ? adjustedSubtotal : subtotal) * 1.2).toFixed(2) }}</span>
          </div>
        </div>

        <p class="mt-6 text-center text-xs text-gray-400 leading-relaxed">
          {{ t('cart.cartDisclaimer') }}<br>
          {{ t('cart.cartDisclaimerSub') }}
        </p>
      </template>

    </div>
  </div>
</template>
