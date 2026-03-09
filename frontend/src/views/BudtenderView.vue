<!--
  Budtender dashboard — polls GET /api/sessions every second.
  Ready orders appear first with order number + green badge.
  Analytics tab shows aggregate event stats from the last 30 days.
-->
<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const tab = ref('orders') // 'orders' | 'analytics'

// ── Orders ────────────────────────────────────────────────────────────────────

const sessions = ref([])
let pollTimer = null

async function fetchSessions() {
  try {
    const res = await fetch('/api/sessions', { cache: 'no-store' })
    if (res.ok) sessions.value = await res.json()
  } catch (e) {}
}

async function deleteSession(sessionId) {
  await fetch(`/api/session/${sessionId}`, { method: 'DELETE' })
  sessions.value = sessions.value.filter(s => s.sessionId !== sessionId)
}

async function clearAll() {
  await fetch('/api/sessions', { method: 'DELETE' })
  sessions.value = []
}

function timeSince(iso) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

function formatItem(item) {
  const parts = [item.name]
  if (item.unitWeight) parts.push(item.unitWeight)
  if (item.price != null) parts.push(`$${item.price}`)
  if (item.qty && item.qty > 1) parts.push(`×${item.qty}`)
  return parts.join(' — ')
}

// ── Analytics ─────────────────────────────────────────────────────────────────

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

function switchTab(t) {
  tab.value = t
  if (t === 'analytics' && !analytics.value) fetchAnalytics()
}

const SOURCE_LABELS = {
  browse:     'Browse',
  modal:      'Product detail',
  guided:     'Guided view',
  group_card: 'Group cards',
  drag:       'Drag to cart',
}

function pct(n, total) {
  if (!total) return '—'
  return `${Math.round((n / total) * 100)}%`
}

onMounted(() => {
  fetchSessions()
  pollTimer = setInterval(fetchSessions, 1000)
})

onUnmounted(() => clearInterval(pollTimer))
</script>

<template>
  <main class="p-8 max-w-3xl mx-auto">

    <!-- Tab bar -->
    <div class="flex items-center gap-1 mb-6 bg-gray-100 rounded-xl p-1 w-fit">
      <button
        @click="switchTab('orders')"
        class="px-5 py-2 rounded-lg text-sm font-bold transition-colors"
        :class="tab === 'orders' ? 'bg-white shadow text-gray-900' : 'text-gray-500'"
      >Orders</button>
      <button
        @click="switchTab('analytics')"
        class="px-5 py-2 rounded-lg text-sm font-bold transition-colors"
        :class="tab === 'analytics' ? 'bg-white shadow text-gray-900' : 'text-gray-500'"
      >Analytics</button>
    </div>

    <!-- ── Orders tab ── -->
    <template v-if="tab === 'orders'">
      <div class="flex items-center justify-between mb-4">
        <h1 class="text-2xl font-black tracking-wide">Active Orders</h1>
        <button
          v-if="sessions.length > 0"
          @click="clearAll"
          class="text-sm font-semibold text-red-500 [@media(hover:hover)]:hover:text-red-700 active:text-red-700 transition-colors"
        >Clear All</button>
      </div>

      <p v-if="sessions.length === 0" class="text-gray-400 text-lg">No active sessions.</p>

      <div v-else class="flex flex-col gap-4">
        <div
          v-for="s in sessions"
          :key="s.sessionId"
          :data-session-id="s.sessionId"
          :class="['rounded-xl border p-5 shadow-sm', s.ready ? 'border-teal-400 bg-teal-50' : 'border-gray-200 bg-white']"
        >
          <div class="flex items-center gap-3 mb-3">
            <div v-if="s.orderNumber != null" class="text-3xl font-black text-teal-600 tabular-nums leading-none w-12 shrink-0">
              #{{ String(s.orderNumber).padStart(2, '0') }}
            </div>
            <div class="flex-1 min-w-0">
              <span v-if="s.ready" class="inline-block bg-teal-500 text-white text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded-full mb-1">Ready</span>
              <div class="text-xs font-bold uppercase tracking-widest text-gray-400">
                {{ s.ready ? 'Submitted' : 'Last updated' }} {{ timeSince(s.updatedAt) }}
              </div>
            </div>
            <button
              @click="deleteSession(s.sessionId)"
              class="shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-gray-400 [@media(hover:hover)]:hover:bg-red-100 [@media(hover:hover)]:hover:text-red-500 active:bg-red-100 active:text-red-500 transition-colors text-lg leading-none"
            >×</button>
          </div>
          <ul class="space-y-1">
            <li v-for="(item, id) in s.selections" :key="id" class="text-base text-gray-800">
              {{ formatItem(item) }}
            </li>
          </ul>
        </div>
      </div>
    </template>

    <!-- ── Analytics tab ── -->
    <template v-else>
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-black tracking-wide">Analytics</h1>
        <div class="flex items-center gap-3">
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
                <span class="text-sm font-semibold text-gray-700">Guided view completions</span>
                <span class="text-lg font-black text-gray-900">{{ analytics.guided_completions }}</span>
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

        <p class="text-xs text-gray-400 text-right">Data from last {{ analytics.period_days }} days.</p>
      </div>

      <p v-else class="text-gray-400">No analytics data available.</p>
    </template>
  </main>
</template>
