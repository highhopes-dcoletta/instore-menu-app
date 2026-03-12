<script setup>
import { ref } from 'vue'
import { useAuth } from '@/composables/useAuth'

const { account, logout } = useAuth()

const analytics = ref(null)
const analyticsDays = ref(30)
const analyticsLoading = ref(false)

async function fetchAnalytics() {
  analyticsLoading.value = true
  try {
    const res = await fetch(`/api/analytics?days=${analyticsDays.value}`, { cache: 'no-store' })
    if (res.ok) analytics.value = await res.json()
  } catch (e) {}
  analyticsLoading.value = false
}

fetchAnalytics()

const SOURCE_LABELS = {
  browse:     'Browse',
  modal:      'Product detail',
  guided:     'Guided view',
  group_card: 'Group cards',
  drag:       'Drag to cart',
  cross_sell: 'Cross-sell',
}

function pct(n, total) {
  if (!total) return '—'
  return `${Math.round((n / total) * 100)}%`
}
</script>

<template>
  <main class="p-8 max-w-3xl mx-auto">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-black tracking-wide">Analytics</h1>
      <div class="flex items-center gap-3">
        <span v-if="account" class="text-sm text-gray-400">{{ account.name }}</span>
        <button @click="logout" class="text-sm font-semibold text-gray-400 hover:text-gray-600 transition-colors">Sign Out</button>
        <select
          v-model="analyticsDays"
          @change="fetchAnalytics"
          class="text-sm border border-gray-200 rounded-lg px-3 py-1.5 font-semibold bg-white"
        >
          <option :value="7">Last 7 days</option>
          <option :value="30">Last 30 days</option>
          <option :value="90">Last 90 days</option>
          <option :value="365">All time</option>
        </select>
        <button @click="fetchAnalytics" class="text-sm font-semibold text-teal-600 active:text-teal-800">Refresh</button>
      </div>
    </div>

    <p v-if="analyticsLoading" class="text-gray-400">Loading…</p>

    <div v-else-if="analytics" class="space-y-8">

      <!-- Summary stats -->
      <div class="grid grid-cols-4 gap-4">
        <div class="rounded-xl border border-gray-200 bg-white p-4">
          <p class="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Orders submitted</p>
          <p class="text-3xl font-black text-gray-900">{{ analytics.submitted_orders }}</p>
        </div>
        <div class="rounded-xl border border-gray-200 bg-white p-4">
          <p class="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Avg items / order</p>
          <p class="text-3xl font-black text-gray-900">{{ analytics.avg_items_submitted ?? '—' }}</p>
        </div>
        <div class="rounded-xl border border-gray-200 bg-white p-4">
          <p class="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Abandoned carts</p>
          <p class="text-3xl font-black text-gray-900">{{ analytics.abandoned_sessions }}</p>
          <p class="text-xs text-gray-400 mt-0.5">avg {{ analytics.avg_items_abandoned ?? '—' }} items</p>
        </div>
        <div class="rounded-xl border border-gray-200 bg-white p-4">
          <p class="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Total adds</p>
          <p class="text-3xl font-black text-gray-900">{{ analytics.total_adds }}</p>
          <p v-if="analytics.api_errors > 0" class="text-xs text-red-500 font-semibold mt-0.5">⚠ {{ analytics.api_errors }} API error{{ analytics.api_errors !== 1 ? 's' : '' }}</p>
        </div>
      </div>

      <!-- Adds by source -->
      <div class="rounded-xl border border-gray-200 bg-white p-5">
        <h2 class="text-sm font-black uppercase tracking-widest text-gray-500 mb-4">Adds by source</h2>
        <div v-if="analytics.total_adds > 0" class="space-y-3">
          <div v-for="(count, source) in analytics.adds_by_source" :key="source" class="flex items-center gap-3">
            <span class="w-32 text-sm font-semibold text-gray-700 shrink-0">{{ SOURCE_LABELS[source] ?? source }}</span>
            <div class="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
              <div class="h-2 rounded-full bg-teal-500" :style="`width:${pct(count, analytics.total_adds)}`" />
            </div>
            <span class="text-sm font-bold tabular-nums text-gray-700 w-16 text-right">{{ count }} <span class="text-gray-400 font-normal">({{ pct(count, analytics.total_adds) }})</span></span>
          </div>
        </div>
        <p v-else class="text-gray-400 text-sm">No data yet.</p>
      </div>

      <!-- Feature usage + top products side by side -->
      <div class="grid grid-cols-2 gap-4">

        <div class="rounded-xl border border-gray-200 bg-white p-5">
          <h2 class="text-sm font-black uppercase tracking-widest text-gray-500 mb-4">Feature usage</h2>
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-sm font-semibold text-gray-700">Product modal opens</span>
              <span class="text-lg font-black text-gray-900">{{ analytics.modal_opens }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm font-semibold text-gray-700">Guided view starts</span>
              <span class="text-lg font-black text-gray-900">{{ analytics.guided_starts }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm font-semibold text-gray-700">Guided view completions</span>
              <span class="text-lg font-black text-gray-900">
                {{ analytics.guided_completions }}
                <span v-if="analytics.guided_completion_rate != null" class="text-sm font-normal text-gray-400">({{ Math.round(analytics.guided_completion_rate * 100) }}%)</span>
              </span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm font-semibold text-gray-700">Cart share views</span>
              <span class="text-lg font-black text-gray-900">{{ analytics.cart_share_views }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm font-semibold text-gray-700">Group feature uses</span>
              <span class="text-lg font-black text-gray-900">{{ analytics.group_feature_uses }}</span>
            </div>
          </div>
        </div>

        <div class="rounded-xl border border-gray-200 bg-white p-5">
          <h2 class="text-sm font-black uppercase tracking-widest text-gray-500 mb-4">Top products by adds</h2>
          <ol class="space-y-2">
            <li v-for="(p, i) in analytics.top_products" :key="p.name" class="flex items-center gap-2">
              <span class="text-xs font-black text-gray-300 tabular-nums w-4">{{ i + 1 }}</span>
              <span class="text-sm text-gray-700 flex-1 truncate">{{ p.name }}</span>
              <span class="text-sm font-bold tabular-nums text-gray-900">{{ p.adds }}</span>
            </li>
            <li v-if="!analytics.top_products.length" class="text-gray-400 text-sm">No data yet.</li>
          </ol>
        </div>
      </div>

      <!-- Top filters -->
      <div class="rounded-xl border border-gray-200 bg-white p-5">
        <h2 class="text-sm font-black uppercase tracking-widest text-gray-500 mb-4">Top filters applied</h2>
        <div v-if="analytics.top_filters?.length" class="space-y-3">
          <div v-for="f in analytics.top_filters" :key="f.label" class="flex items-center gap-3">
            <span class="w-48 text-sm font-semibold text-gray-700 shrink-0 truncate">{{ f.label }}</span>
            <div class="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
              <div class="h-2 rounded-full bg-indigo-400" :style="`width:${pct(f.count, analytics.top_filters[0].count)}`" />
            </div>
            <span class="text-sm font-bold tabular-nums text-gray-700 w-8 text-right">{{ f.count }}</span>
          </div>
        </div>
        <p v-else class="text-gray-400 text-sm">No data yet.</p>
      </div>

      <p class="text-xs text-gray-400 text-right">Data from last {{ analytics.period_days }} days.</p>
    </div>

    <p v-else class="text-gray-400">No analytics data available.</p>
  </main>
</template>
