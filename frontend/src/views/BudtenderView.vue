<!--
  Budtender dashboard — polls GET /api/sessions every second.
  Ready orders appear first with order number + green badge.
-->
<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { computeAppliedDeals } from '@/composables/useBundles'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useAuth } from '@/composables/useAuth'
import QRCode from 'qrcode'

const { account, logout } = useAuth()

const sessions = ref([])
const qrCodes = ref({})   // sessionId → data URL
let pollTimer = null

function cartUrl(sessionId) {
  const origin = window.location.hostname === 'localhost'
    ? 'http://100.67.159.25:5173'
    : window.location.origin
  return `${origin}/cart/${sessionId}`
}

async function generateQr(sessionId) {
  if (qrCodes.value[sessionId]) return
  try {
    const canvas = document.createElement('canvas')
    await QRCode.toCanvas(canvas, cartUrl(sessionId), {
      width: 96, margin: 1, color: { dark: '#134e4a', light: '#ffffff' },
    })
    qrCodes.value[sessionId] = canvas.toDataURL('image/png')
  } catch (e) {
    console.error('QR generation failed:', e)
  }
}

watch(sessions, (list) => {
  for (const s of list) {
    if (Object.keys(s.selections).length) generateQr(s.sessionId)
  }
}, { deep: false })

async function fetchSessions() {
  try {
    const res = await fetch('/api/sessions', { cache: 'no-store' })
    if (res.ok) {
      const all = await res.json()
      sessions.value = all.filter(s => !s.sessionId.startsWith('e2e-') && !s.sessionId.startsWith('test-'))
    }
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

function duration(iso) {
  if (!iso) return '—'
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (isNaN(diff) || diff < 0) return '—'
  const m = Math.floor(diff / 60)
  const s = diff % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function isActive(iso) {
  if (!iso) return false
  return (Date.now() - new Date(iso).getTime()) < 10000
}

function isIdle(iso) {
  if (!iso) return true
  return (Date.now() - new Date(iso).getTime()) > 30000
}

const ROUTE_LABELS = {
  '/': 'Home',
  '/flower': 'Flower',
  '/pre-rolls': 'Pre-Rolls',
  '/edibles': 'Edibles',
  '/vapes': 'Vapes',
  '/concentrates': 'Dabs',
  '/tinctures-and-topicals': 'Tinctures & Topicals',
  '/sleep': 'Sleep',
  '/pain': 'Pain',
  '/guide': 'Guided Experience',
  '/explore': 'Explore',
  '/terpenes': 'Terpenes',
}

function routeLabel(route) {
  return route ? (ROUTE_LABELS[route] || route) : '—'
}

const PHASES = ['browsing', 'shopping', 'submitted']
const PHASE_LABELS = { browsing: 'Browsing', shopping: 'Shopping', submitted: 'Submitted' }

// Journey timeline
const expandedJourneys = ref({}) // sessionId → boolean

function toggleJourney(sessionId) {
  expandedJourneys.value[sessionId] = !expandedJourneys.value[sessionId]
}

function visibleSteps(session) {
  const journey = session.journey || []
  if (journey.length <= 5 || expandedJourneys.value[session.sessionId]) return journey
  return journey.slice(-5)
}

function stepLabel(step) {
  if (step.type === 'navigate') return `Viewed ${ROUTE_LABELS[step.label] || step.label}`
  return step.label // all other types have pre-formatted labels
}

function stepColor(type) {
  if (type === 'add') return 'text-green-700 font-semibold'
  if (type === 'remove') return 'text-red-500 font-semibold'
  if (type === 'submit') return 'text-teal-600 font-bold'
  if (type === 'search') return 'text-indigo-500'
  if (type === 'filter') return 'text-amber-600'
  if (type === 'sort') return 'text-amber-600'
  if (type === 'view') return 'text-blue-500'
  if (type === 'guide') return 'text-purple-500'
  if (type === 'terpene') return 'text-pink-500'
  if (type === 'group') return 'text-amber-600'
  if (type === 'bundle') return 'text-amber-600 font-semibold'
  if (type === 'share') return 'text-blue-500 font-semibold'
  if (type === 'locale') return 'text-gray-500'
  if (type === 'tab') return 'text-gray-500'
  if (type === 'action') return 'text-gray-600'
  return 'text-gray-500' // navigate and unknown
}

function stepPrefix(type) {
  if (type === 'add') return '+ '
  if (type === 'remove') return '\u2212 '
  return ''
}

const computeDeals = computeAppliedDeals
const { bundlesEnabled } = useFeatureFlags()

function subtotal(selections) {
  return Object.values(selections).reduce((s, i) => s + (i.price ?? 0) * (i.qty ?? 1), 0)
}

function formatItem(item) {
  const parts = [item.name]
  if (item.unitWeight) parts.push(item.unitWeight)
  if (item.price != null) parts.push(`$${item.price}`)
  if (item.qty && item.qty > 1) parts.push(`×${item.qty}`)
  return parts.join(' — ')
}

onMounted(() => {
  fetchSessions()
  pollTimer = setInterval(fetchSessions, 1000)
})

onUnmounted(() => clearInterval(pollTimer))
</script>

<template>
  <main class="p-8 max-w-3xl mx-auto">

    <div class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-black tracking-wide">Kiosk Activity</h1>
      <div class="flex items-center gap-4">
        <span v-if="account" class="text-sm text-gray-400">{{ account.name }}</span>
        <a href="/bundles" class="text-sm font-semibold text-teal-600 hover:text-teal-800 transition-colors">Bundles →</a>
        <a href="/analytics" class="text-sm font-semibold text-teal-600 hover:text-teal-800 transition-colors">Analytics →</a>
        <button @click="logout" class="text-sm font-semibold text-gray-400 hover:text-gray-600 transition-colors">Sign Out</button>
        <button
          v-if="sessions.length > 0"
          @click="clearAll"
          class="text-sm font-semibold text-red-500 [@media(hover:hover)]:hover:text-red-700 active:text-red-700 transition-colors"
        >Clear All</button>
      </div>
    </div>

    <p v-if="sessions.length === 0" class="text-gray-400 text-lg">No active sessions.</p>

    <div v-else class="flex flex-col gap-4">
      <div
        v-for="s in sessions"
        :key="s.sessionId"
        :data-session-id="s.sessionId"
        :class="[
          'rounded-xl border p-5 shadow-sm',
          s.ready ? 'border-teal-400 bg-teal-50'
            : !Object.keys(s.selections).length ? 'border-gray-300 bg-gray-50'
            : 'border-gray-200 bg-white'
        ]"
      >
        <!-- Journey timeline -->
        <div v-if="s.journey && s.journey.length" class="mb-3">
          <!-- Collapse indicator -->
          <button
            v-if="s.journey.length > 5 && !expandedJourneys[s.sessionId]"
            @click="toggleJourney(s.sessionId)"
            class="text-xs text-teal-600 font-semibold mb-1 hover:text-teal-800"
          >··· Show all ({{ s.journey.length }})</button>
          <button
            v-else-if="s.journey.length > 5 && expandedJourneys[s.sessionId]"
            @click="toggleJourney(s.sessionId)"
            class="text-xs text-teal-600 font-semibold mb-1 hover:text-teal-800"
          >Show less</button>

          <div class="relative pl-4">
            <!-- Vertical line -->
            <div class="absolute left-[5px] top-1 bottom-1 w-px bg-gray-200"></div>

            <div
              v-for="(step, i) in visibleSteps(s)"
              :key="i"
              class="relative flex items-baseline gap-2 py-0.5"
            >
              <!-- Node dot -->
              <span :class="[
                'absolute -left-4 top-[5px] w-2.5 h-2.5 rounded-full border-2 shrink-0',
                i === visibleSteps(s).length - 1
                  ? 'bg-teal-500 border-teal-500'
                  : 'bg-white border-gray-300'
              ]"></span>
              <!-- Label -->
              <span :class="['text-xs leading-tight', stepColor(step.type)]">{{ stepPrefix(step.type) }}{{ stepLabel(step) }}</span>
              <!-- Relative time -->
              <span class="text-[10px] text-gray-400 whitespace-nowrap ml-auto">{{ timeSince(step.ts) }}</span>
            </div>
          </div>
        </div>
        <div v-else class="flex items-center gap-1 mb-3 text-xs font-semibold">
          <span class="px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">Just arrived</span>
        </div>

        <div class="flex items-center gap-3 mb-3">
          <div v-if="s.orderNumber != null" class="text-3xl font-black text-teal-600 tabular-nums leading-none w-12 shrink-0">
            #{{ String(s.orderNumber).padStart(2, '0') }}
          </div>
          <div class="flex-1 min-w-0">
            <!-- Activity indicator + viewing page (hide for submitted orders — kiosk has moved on) -->
            <div v-if="!s.ready" class="flex items-center gap-2 mb-1">
              <span :class="[
                'inline-block w-2.5 h-2.5 rounded-full shrink-0',
                isActive(s.updatedAt) ? 'bg-green-400 animate-pulse' :
                isIdle(s.updatedAt) ? 'bg-gray-300' : 'bg-green-400'
              ]"></span>
              <span class="text-sm text-gray-700">
                Viewing: <strong>{{ routeLabel(s.currentRoute) }}</strong>
              </span>
            </div>
            <div class="flex items-center gap-3 text-xs text-gray-400 font-semibold">
              <span v-if="s.startedAt">{{ duration(s.startedAt) }}</span>
              <span v-if="s.ready" class="inline-block bg-teal-500 text-white text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded-full">Ready</span>
              <span v-else>{{ timeSince(s.updatedAt) }}</span>
            </div>
          </div>
          <img
            v-if="qrCodes[s.sessionId] && Object.keys(s.selections).length"
            :src="qrCodes[s.sessionId]"
            width="96" height="96"
            class="rounded-lg shrink-0"
            :alt="`QR for session ${s.sessionId}`"
          />
          <button
            @click="deleteSession(s.sessionId)"
            title="Dismiss session"
            class="shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-gray-400 [@media(hover:hover)]:hover:bg-red-100 [@media(hover:hover)]:hover:text-red-500 active:bg-red-100 active:text-red-500 transition-colors text-lg leading-none"
          >×</button>
        </div>

        <!-- Cart items (only if non-empty) -->
        <ul v-if="Object.keys(s.selections).length" class="space-y-1">
          <li v-for="(item, id) in s.selections" :key="id" class="text-base text-gray-800">
            {{ formatItem(item) }}
          </li>
        </ul>
        <p v-else class="text-sm text-gray-400 italic">Just browsing — no items yet</p>

        <!-- Deals -->
        <template v-if="bundlesEnabled && Object.keys(s.selections).length && computeDeals(s.selections).length">
          <div class="mt-3 pt-3 border-t border-gray-200 space-y-1">
            <div v-for="deal in computeDeals(s.selections)" :key="deal.id"
              class="flex items-center justify-between text-sm"
            >
              <span class="font-semibold text-green-700">🎉 {{ deal.label }}</span>
              <span class="font-bold text-green-700 tabular-nums">-${{ deal.savings.toFixed(2) }}</span>
            </div>
          </div>
          <div class="mt-2 flex items-center justify-between text-sm">
            <span class="text-gray-500">Subtotal after deals</span>
            <span class="font-black text-gray-800 tabular-nums">
              ${{ (subtotal(s.selections) - computeDeals(s.selections).reduce((t, d) => t + d.savings, 0)).toFixed(2) }}
            </span>
          </div>
        </template>
      </div>
    </div>
  </main>
</template>
