<!--
  Budtender dashboard — no kiosk nav, no checkboxes.
  Polls GET /api/sessions every 5 seconds.
  Shows sessions with selections, oldest-first.
-->
<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'

const sessions = ref([])
let pollTimer = null

async function fetchSessions() {
  try {
    const res = await fetch('/api/sessions', { cache: 'no-store' })
    if (res.ok) sessions.value = await res.json()
  } catch (e) {
    // Network error — keep showing last known state
  }
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
  pollTimer = setInterval(fetchSessions, 5000)
})

onUnmounted(() => clearInterval(pollTimer))
</script>

<template>
  <main class="p-8 max-w-3xl mx-auto">
    <h1 class="mb-6 text-2xl font-black tracking-wide">Budtender Dashboard</h1>

    <p v-if="sessions.length === 0" class="text-gray-400 text-lg">
      No active sessions.
    </p>

    <div v-else class="flex flex-col gap-4">
      <div
        v-for="s in sessions"
        :key="s.sessionId"
        class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
      >
        <div class="mb-3 text-xs font-bold uppercase tracking-widest text-gray-400">
          Last updated {{ timeSince(s.updatedAt) }}
        </div>
        <ul class="space-y-1">
          <li
            v-for="(item, id) in s.selections"
            :key="id"
            class="text-base text-gray-800"
          >
            {{ formatItem(item) }}
          </li>
        </ul>
      </div>
    </div>
  </main>
</template>
