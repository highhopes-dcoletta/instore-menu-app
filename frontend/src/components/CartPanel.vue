<script setup>
import { computed, ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session'
import { useCartAnimation } from '@/composables/useCartAnimation'
import { useDragToCart } from '@/composables/useDragToCart'
import { calcQuota } from '@/utils/quotaCalc'

const session = useSessionStore()
const router = useRouter()
const { dismissToast, fireToast } = useCartAnimation()
const { isDragging, isOverCart } = useDragToCart()

const subtotal = computed(() =>
  Object.values(session.selections).reduce(
    (sum, item) => sum + (item.price ?? 0) * (item.qty ?? 1), 0
  )
)
const isEmpty = computed(() => Object.keys(session.selections).length === 0)
const quota = computed(() => calcQuota(session.selections))

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
const previousOrder = ref(null) // snapshot before submit

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
  const snapshot = { selections: { ...session.selections }, sessionId: session.sessionId }
  submitting.value = true
  const num = await session.submitOrder()
  submitting.value = false
  if (num != null) {
    previousOrder.value = snapshot
    orderNumber.value = num
    startCountdown()
  }
}

async function goBackToPreviousOrder() {
  clearInterval(countdownTimer)
  const { selections, sessionId } = previousOrder.value
  previousOrder.value = null
  orderNumber.value = null
  await session.restoreSession(selections, sessionId)
}

function decreaseQty(id, item) {
  if ((item.qty ?? 1) > 1) {
    session.updateQuantity(id, item, -1)
    return
  }
  const el = document.querySelector(`[data-cart-item="${id}"]`)
  if (!el) { session.updateQuantity(id, item, -1); return }
  el.style.animation = 'poof 0.4s ease-out forwards'
  setTimeout(() => session.updateQuantity(id, item, -1), 380)
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
  <div :class="[
    'fixed top-9 right-0 bottom-0 w-72 bg-white border-l border-gray-200 flex flex-col z-40 shadow-xl',
    isDragging ? (isOverCart ? 'ring-2 ring-teal-400 ring-inset' : 'ring-2 ring-gray-300 ring-inset') : '',
  ]">

    <!-- Header -->
    <div
      data-cart-counter
      class="px-4 py-3 border-b border-gray-100 text-xs font-bold uppercase tracking-widest shrink-0 flex items-center justify-between"
      :class="isOverCart ? 'text-teal-500' : 'text-gray-400'"
    >
      Your Cart
      <span v-if="isOverCart" class="normal-case tracking-normal font-semibold text-teal-500">Drop to add</span>
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

        <!-- Over-limit warning -->
        <div v-if="quota.pct >= 1 && !isEmpty" class="mt-2 rounded-lg bg-red-500 text-white px-3 py-2.5 flex items-start gap-2">
          <span class="text-lg leading-none shrink-0">⚠️</span>
          <div>
            <p class="text-xs font-black uppercase tracking-wide leading-none mb-0.5">Over Daily Limit</p>
            <p class="text-xs leading-snug opacity-90">Your cart exceeds the 28g daily limit. A budtender will assist you.</p>
          </div>
        </div>
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
                @click="decreaseQty(id, item)"
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

      <!-- Quota bar -->
      <div v-if="!isEmpty" class="px-4 py-3 border-t border-gray-100 shrink-0">
        <div class="flex items-center justify-between mb-1.5">
          <span class="text-xs text-gray-400">Daily limit</span>
          <span :class="['text-xs font-semibold tabular-nums', quota.pct >= 1 ? 'text-red-500' : quota.pct >= 0.7 ? 'text-amber-500' : 'text-gray-500']">
            {{ quota.usedGrams.toFixed(1) }} / 28g
          </span>
        </div>
        <div class="h-1.5 rounded-full bg-gray-100 overflow-hidden">
          <div
            :class="['h-full rounded-full transition-all duration-500', quota.pct >= 1 ? 'bg-red-500' : quota.pct >= 0.7 ? 'bg-amber-400' : 'bg-teal-500']"
            :style="{ width: (quota.pct * 100).toFixed(1) + '%' }"
          ></div>
        </div>
        <p v-if="quota.pct >= 1" class="mt-1.5 text-xs text-red-500 font-semibold">Daily limit reached</p>
      </div>

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
        <button
          @click="goBackToPreviousOrder"
          class="shrink-0 px-8 py-3 border border-gray-600 hover:border-gray-400 text-gray-400 hover:text-gray-200 font-semibold rounded-xl text-base transition-colors"
        >
          Go Back to Previous Order
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

<style>
@keyframes poof {
  0%   { transform: scale(1);    opacity: 1; filter: blur(0); }
  20%  { transform: scale(1.08); opacity: 1; filter: blur(0); }
  100% { transform: scale(0.1);  opacity: 0; filter: blur(8px); }
}
</style>
