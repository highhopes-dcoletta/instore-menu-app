<script setup>
import { computed, ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session'
import { useCartAnimation } from '@/composables/useCartAnimation'

const session = useSessionStore()
const router = useRouter()
const { dismissToast, fireToast } = useCartAnimation()

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
    wiggleTimer = setTimeout(() => (wiggle.value = false), 1200)
  })
})

// ── Submit ────────────────────────────────────────────────────────────────────

const submitting = ref(false)
const orderNumber = ref(null)
const countdown = ref(0)
let countdownTimer = null

function startCountdown() {
  countdown.value = 15
  countdownTimer = setInterval(() => {
    countdown.value--
    if (countdown.value <= 0) {
      clearInterval(countdownTimer)
      orderNumber.value = null
      router.push('/')
    }
  }, 1000)
}

async function sendToBudtender() {
  if (submitting.value || isEmpty.value) return
  dismissToast()
  submitting.value = true
  const num = await session.submitOrder()
  submitting.value = false
  if (num != null) {
    orderNumber.value = num
    startCountdown()
  }
}

function resetToMenu() {
  clearInterval(countdownTimer)
  orderNumber.value = null
  router.push('/')
}

// ── Inactivity reminder ───────────────────────────────────────────────────────

const REMINDER_MS = 20 * 1000
let reminderTimer = null

function resetReminderTimer() {
  clearTimeout(reminderTimer)
  if (!isEmpty.value && orderNumber.value == null) {
    reminderTimer = setTimeout(() => {
      fireToast("When you're done, tap Send to Budtender")
      clearTimeout(wiggleTimer)
      wiggle.value = false
      nextTick(() => {
        wiggle.value = true
        wiggleTimer = setTimeout(() => (wiggle.value = false), 1200)
      })
    }, REMINDER_MS)
  }
}

watch(isEmpty, resetReminderTimer)

const REMINDER_EVENTS = ['click', 'touchstart', 'keydown', 'scroll']

onMounted(() => {
  for (const evt of REMINDER_EVENTS) window.addEventListener(evt, resetReminderTimer, { passive: true })
})

onUnmounted(() => {
  clearInterval(countdownTimer)
  clearTimeout(reminderTimer)
  for (const evt of REMINDER_EVENTS) window.removeEventListener(evt, resetReminderTimer)
})
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
      <ul v-else data-cart-list class="flex-1 overflow-y-auto divide-y divide-gray-100">
        <li
          v-for="(item, id) in session.selections"
          :key="id"
          :data-cart-item="id"
          class="flex items-center justify-between px-4 py-3 gap-2"
        >
          <img
            v-if="item.image"
            :src="item.image"
            class="w-10 h-10 rounded-lg object-cover shrink-0"
          />
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

  <!-- Order confirmation overlay -->
  <Teleport to="body">
    <Transition name="confirm">
      <div v-if="orderNumber != null" class="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-gray-950 text-white overflow-y-auto py-8">
        <div class="text-xs font-bold uppercase tracking-widest text-teal-400">Order submitted</div>
        <div class="text-[7rem] font-black text-teal-400 tabular-nums leading-none">
          #{{ String(orderNumber).padStart(2, '0') }}
        </div>
        <p class="text-gray-300 font-semibold text-lg text-center leading-snug">
          Please give your order number to the budtender!
        </p>
        <p class="text-gray-500 text-sm tabular-nums">
          Returning to menu in {{ countdown }}…
        </p>
        <button
          @click="resetToMenu"
          class="shrink-0 px-8 py-4 bg-teal-500 hover:bg-teal-400 text-white font-bold rounded-xl text-lg transition-colors"
        >
          Start a new order!
        </button>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.confirm-enter-active,
.confirm-leave-active {
  transition: opacity 0.4s ease;
}
.confirm-enter-from,
.confirm-leave-to {
  opacity: 0;
}

@keyframes wiggle {
  0%   { transform: translateX(0); }
  8%   { transform: translateX(-5px) rotate(-1deg); }
  16%  { transform: translateX(5px) rotate(1deg); }
  24%  { transform: translateX(-4px) rotate(-0.75deg); }
  32%  { transform: translateX(4px) rotate(0.75deg); }
  42%  { transform: translateX(-3px) rotate(-0.5deg); }
  52%  { transform: translateX(3px) rotate(0.5deg); }
  63%  { transform: translateX(-2px); }
  74%  { transform: translateX(2px); }
  84%  { transform: translateX(-1px); }
  93%  { transform: translateX(1px); }
  100% { transform: translateX(0); }
}
.wiggle {
  animation: wiggle 1.2s ease-out;
}
</style>
