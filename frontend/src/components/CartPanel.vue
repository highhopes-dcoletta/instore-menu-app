<script setup>
import { computed, ref, watch, nextTick } from 'vue'
import { useSessionStore } from '@/stores/session'

const session = useSessionStore()

const subtotal = computed(() =>
  Object.values(session.selections).reduce(
    (sum, item) => sum + (item.price ?? 0) * (item.qty ?? 1), 0
  )
)
const isEmpty = computed(() => Object.keys(session.selections).length === 0)

// ── Wiggle on cart change ─────────────────────────────────────────────────────

const wiggle = ref(false)
let wiggleTimer = null

watch(() => session.selectionCount, () => {
  clearTimeout(wiggleTimer)
  wiggle.value = false
  nextTick(() => {
    wiggle.value = true
    wiggleTimer = setTimeout(() => (wiggle.value = false), 600)
  })
})

// ── Submit ────────────────────────────────────────────────────────────────────

const submitting = ref(false)
const orderNumber = ref(null)

async function sendToBudtender() {
  if (submitting.value || isEmpty.value) return
  submitting.value = true
  const num = await session.submitOrder()
  submitting.value = false
  if (num != null) orderNumber.value = num
}
</script>

<template>
  <div class="fixed top-9 right-0 bottom-0 w-72 bg-white border-l border-gray-200 flex flex-col z-40 shadow-xl">

    <!-- Header -->
    <div
      data-cart-counter
      class="px-4 py-3 border-b border-gray-100 text-xs font-bold uppercase tracking-widest text-gray-400 shrink-0"
    >
      Your Cart
    </div>

    <!-- Order confirmed view -->
    <div v-if="orderNumber != null" class="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
      <div class="text-6xl font-black text-teal-500 tabular-nums leading-none">
        #{{ String(orderNumber).padStart(2, '0') }}
      </div>
      <p class="text-gray-700 font-semibold text-sm leading-snug">
        Your order has been sent!<br>A budtender will call your number shortly.
      </p>
    </div>

    <!-- Active cart view -->
    <template v-else>

      <!-- Send to budtender button -->
      <div class="px-4 py-3 border-b border-gray-100 shrink-0">
        <button
          @click="sendToBudtender"
          :disabled="isEmpty || submitting"
          :class="[
            'w-full py-2 rounded-lg text-sm font-bold tracking-wide transition-colors',
            isEmpty
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-teal-500 text-white hover:bg-teal-600',
            wiggle && !isEmpty ? 'wiggle' : '',
          ]"
        >
          {{ submitting ? 'Sending…' : 'Send to Budtender' }}
        </button>
      </div>

      <!-- Empty state -->
      <div v-if="isEmpty" class="flex-1 flex items-center justify-center">
        <p class="text-gray-300 text-sm">Cart is empty</p>
      </div>

      <!-- Items -->
      <ul v-else class="flex-1 overflow-y-auto divide-y divide-gray-100">
        <li
          v-for="(item, id) in session.selections"
          :key="id"
          class="flex items-start justify-between px-4 py-3 gap-2"
        >
          <span class="text-sm text-gray-800 leading-snug flex-1 min-w-0">
            {{ item.name }}
            <span v-if="item.unitWeight" class="text-gray-500"> {{ item.unitWeight }}</span>
          </span>
          <div class="flex flex-col items-end gap-1.5 shrink-0">
            <span v-if="item.price != null" class="text-sm font-semibold text-gray-700 tabular-nums">
              ${{ item.price }}
            </span>
            <div class="flex items-center gap-1">
              <button
                @click="session.updateQuantity(id, item, -1)"
                class="w-6 h-6 rounded-full border border-gray-300 text-gray-600 hover:border-teal-500 hover:text-teal-600 transition-colors text-sm flex items-center justify-center"
              >−</button>
              <span class="w-5 text-center text-sm font-semibold tabular-nums text-gray-800">{{ item.qty }}</span>
              <button
                @click="session.updateQuantity(id, item, 1)"
                class="w-6 h-6 rounded-full bg-teal-500 text-white hover:bg-teal-600 transition-colors text-sm flex items-center justify-center"
              >+</button>
            </div>
          </div>
        </li>
      </ul>

      <!-- Totals -->
      <div v-if="!isEmpty" class="border-t border-gray-100 shrink-0">
        <div class="px-4 pt-3 pb-1 flex items-center justify-between">
          <span class="text-xs text-gray-400">before tax</span>
          <span class="text-sm font-semibold text-gray-600 tabular-nums">${{ subtotal.toFixed(2) }}</span>
        </div>
        <div class="px-4 pb-4 flex items-center justify-between">
          <span class="text-xs text-gray-500">after tax (20%)</span>
          <span class="text-base font-black text-gray-800 tabular-nums">${{ (subtotal * 1.2).toFixed(2) }}</span>
        </div>
      </div>

    </template>
  </div>
</template>

<style scoped>
@keyframes wiggle {
  0%   { transform: translateX(0); }
  15%  { transform: translateX(-5px) rotate(-1deg); }
  30%  { transform: translateX(5px) rotate(1deg); }
  45%  { transform: translateX(-4px); }
  60%  { transform: translateX(4px); }
  75%  { transform: translateX(-2px); }
  90%  { transform: translateX(2px); }
  100% { transform: translateX(0); }
}
.wiggle {
  animation: wiggle 0.6s ease-in-out;
}
</style>
