<!--
  Budtender dashboard — polls GET /api/sessions every second.
  Ready orders appear first with order number + green badge.
-->
<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

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

onMounted(() => {
  fetchSessions()
  pollTimer = setInterval(fetchSessions, 1000)
})

onUnmounted(() => clearInterval(pollTimer))
</script>

<template>
  <main class="p-8 max-w-3xl mx-auto">

    <div class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-black tracking-wide">Active Orders</h1>
      <div class="flex items-center gap-4">
        <a href="/analytics" class="text-sm font-semibold text-teal-600 hover:text-teal-800 transition-colors">Analytics →</a>
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
  </main>
</template>
