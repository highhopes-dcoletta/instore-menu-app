<script setup>
import { computed, ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session'
import { useProductsStore } from '@/stores/products'
import { useCartAnimation } from '@/composables/useCartAnimation'
import { useDragToCart } from '@/composables/useDragToCart'
import { calcQuota } from '@/utils/quotaCalc'
import { useAnalytics } from '@/composables/useAnalytics'
import { useBundles } from '@/composables/useBundles'
import ProductModal from '@/components/ProductModal.vue'
import QRCode from 'qrcode'

const { track } = useAnalytics()

const session = useSessionStore()
const productsStore = useProductsStore()

// ── Out-of-stock notifications ────────────────────────────────────────────────

watch(() => productsStore.outOfStockNotice, (names) => {
  if (!names.length) return
  const listed = names.slice(0, 2).join(', ')
  const extra = names.length > 2 ? ` + ${names.length - 2} more` : ''
  fireToast(`Removed from cart (out of stock): ${listed}${extra}`)
  productsStore.outOfStockNotice = []
})
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

const { appliedDeals, totalDiscount, nearDeals } = useBundles(computed(() => session.selections))
const adjustedSubtotal = computed(() => subtotal.value - totalDiscount.value)

// ── Cross-sell suggestions ────────────────────────────────────────────────────

const COMPLEMENTS = {
  FLOWER:       ['EDIBLES', 'VAPORIZERS'],
  PRE_ROLLS:    ['EDIBLES', 'VAPORIZERS'],
  EDIBLES:      ['FLOWER', 'VAPORIZERS'],
  VAPORIZERS:   ['EDIBLES', 'FLOWER'],
  CONCENTRATES: ['EDIBLES', 'FLOWER'],
  TINCTURES:    ['EDIBLES', 'FLOWER'],
  TOPICALS:     ['EDIBLES', 'FLOWER'],
}

const crossSellProducts = computed(() => {
  if (isEmpty.value) return []
  const cartIds = new Set(Object.keys(session.selections))
  const cartCategories = new Set(Object.values(session.selections).map(i => i.category))
  // Collect complement categories not already in cart
  const targets = new Set()
  for (const cat of cartCategories) {
    for (const c of (COMPLEMENTS[cat] ?? [])) {
      if (!cartCategories.has(c)) targets.add(c)
    }
  }
  if (!targets.size) return []
  // Pick top 2 by popularity (products array is already in Dutchie/popularity order)
  const picks = []
  for (const p of productsStore.products) {
    if (picks.length >= 2) break
    if (targets.has(p.Category) && !cartIds.has(p.id)) picks.push(p)
  }
  return picks
})

const modalProduct = ref(null)

function addCrossSell(product) {
  session.updateQuantity(product.id, {
    name: product.Name,
    unitWeight: product['Unit Weight'] ?? '',
    price: product.Price ?? 0,
    image: product.Image ?? null,
    category: product.Category ?? '',
  }, 1)
  track('add_to_cart', { source: 'cross_sell', product_id: product.id, product_name: product.Name, category: product.Category })
}

// ── QR code ───────────────────────────────────────────────────────────────────

const qrDataUrl = ref(null)

const PHONE_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 24">
  <!-- Shopping cart -->
  <path d="M0.5 2h2.5l2.5 8h7.5" stroke="#134e4a" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="3.5" y="5" width="8" height="5" rx="1" fill="#134e4a"/>
  <circle cx="5.5" cy="12.5" r="1.5" fill="#134e4a"/>
  <circle cx="10" cy="12.5" r="1.5" fill="#134e4a"/>
  <!-- Arrow right -->
  <path d="M14 7.5h3.5" stroke="#134e4a" stroke-width="1.8" stroke-linecap="round"/>
  <path d="M15.8 5.8l1.7 1.7-1.7 1.7" stroke="#134e4a" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <!-- Phone -->
  <rect x="19.5" y="0.5" width="12" height="23" rx="2.5" fill="#134e4a"/>
  <rect x="21.5" y="3" width="8" height="16" fill="white"/>
  <circle cx="25.5" cy="21.5" r="1.2" fill="white"/>
</svg>`

async function generateQrWithIcon(url) {
  const SIZE = 200
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  await QRCode.toCanvas(canvas, url, { width: SIZE, margin: 1, color: { dark: '#134e4a', light: '#ffffff' } })

  const ctx = canvas.getContext('2d')
  const iconW = 48
  const iconH = 36
  const cx = SIZE / 2
  const cy = SIZE / 2

  // White rounded-rect behind icon
  ctx.fillStyle = 'white'
  ctx.beginPath()
  ctx.roundRect(cx - iconW / 2 - 5, cy - iconH / 2 - 5, iconW + 10, iconH + 10, 8)
  ctx.fill()

  // Draw cart→phone icon
  const blob = new Blob([PHONE_ICON_SVG], { type: 'image/svg+xml' })
  const svgUrl = URL.createObjectURL(blob)
  await new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      ctx.drawImage(img, cx - iconW / 2, cy - iconH / 2, iconW, iconH)
      URL.revokeObjectURL(svgUrl)
      resolve()
    }
    img.onerror = (e) => { URL.revokeObjectURL(svgUrl); reject(e) }
    img.src = svgUrl
  })

  return canvas.toDataURL('image/png')
}

watch(() => session.sessionId, async (id) => {
  if (!id) { qrDataUrl.value = null; return }
  const origin = window.location.hostname === 'localhost'
    ? 'http://100.67.159.25:5173'
    : window.location.origin
  const url = `${origin}/cart/${id}`
  try {
    qrDataUrl.value = await generateQrWithIcon(url)
  } catch (e) {
    console.error('QR icon generation failed, falling back to plain QR:', e)
    try {
      const canvas = document.createElement('canvas')
      await QRCode.toCanvas(canvas, url, { width: 200, margin: 1, color: { dark: '#134e4a', light: '#ffffff' } })
      qrDataUrl.value = canvas.toDataURL('image/png')
    } catch (e2) {
      console.error('QR code fallback failed:', e2)
      qrDataUrl.value = null
    }
  }
}, { immediate: true })

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
  const itemCount = session.selectionCount
  const totalValue = Object.values(session.selections).reduce((s, i) => s + (i.price ?? 0) * (i.qty ?? 1), 0)
  const num = await session.submitOrder()
  submitting.value = false
  if (num != null) {
    track('order_submitted', { item_count: itemCount, total_value: Math.round(totalValue * 100) / 100 })
    previousOrder.value = snapshot
    orderNumber.value = num
    startCountdown()
  } else {
    fireToast('Failed to send order — please try again.')
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
        <div v-if="quota.overLimit && !isEmpty" class="mt-2 rounded-lg bg-red-500 text-white px-3 py-2.5 flex items-start gap-2">
          <span class="text-lg leading-none shrink-0">⚠️</span>
          <div>
            <p class="text-xs font-black uppercase tracking-wide leading-none mb-0.5">Over Daily Limit</p>
            <p class="text-xs leading-snug opacity-90">Your cart exceeds the 28g daily limit. A budtender will assist you.</p>
          </div>
        </div>
      </div>

      <!-- QR code -->
      <div v-if="qrDataUrl && !isEmpty" class="px-4 pt-1 pb-3 border-b border-gray-100 shrink-0 flex flex-col items-center gap-2">
        <div class="flex items-center gap-2 w-full">
          <div class="flex-1 h-px bg-gray-200"></div>
          <span class="text-xs font-bold text-gray-400 uppercase tracking-widest">or</span>
          <div class="flex-1 h-px bg-gray-200"></div>
        </div>
        <p class="text-center text-xs font-semibold text-gray-500">Copy your cart to your phone!</p>
        <img :src="qrDataUrl" width="200" height="200" alt="Cart QR code" class="rounded-lg" />
      </div>

      <!-- Empty state -->
      <div v-if="isEmpty" class="flex-1 flex items-center justify-center">
        <p class="text-gray-300 text-sm">Cart is empty</p>
      </div>

      <!-- Items + quota + totals scroll together -->
      <div v-else class="flex-1 overflow-y-auto">
        <ul data-cart-list class="divide-y divide-gray-100">
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

        <!-- Quota bar — anchored directly below items -->
        <div class="px-4 py-3 border-t border-gray-100">
          <div class="flex items-center justify-between mb-1.5">
            <span class="text-xs text-gray-400">Daily limit</span>
            <span :class="['text-xs font-semibold tabular-nums', quota.overLimit ? 'text-red-500' : quota.pct >= 0.7 ? 'text-amber-500' : 'text-gray-500']">
              {{ quota.usedGrams.toFixed(1) }} / 28g
            </span>
          </div>
          <div class="h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div
              :class="['h-full rounded-full transition-all duration-500', quota.overLimit ? 'bg-red-500' : quota.pct >= 0.7 ? 'bg-amber-400' : 'bg-teal-500']"
              :style="{ width: (quota.pct * 100).toFixed(1) + '%' }"
            ></div>
          </div>
          <p v-if="quota.overLimit" class="mt-1.5 text-xs text-red-500 font-semibold">Daily limit reached</p>
        </div>

        <!-- Near-deal nudges -->
        <div v-if="nearDeals.length" class="border-t border-gray-100 px-4 py-2 flex flex-col gap-1.5">
          <div
            v-for="deal in nearDeals"
            :key="deal.id"
            class="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2"
          >
            <span class="text-base leading-none shrink-0">🎯</span>
            <span class="text-xs text-amber-800 leading-snug">
              Add {{ deal.needed }} more for<br>
              <span class="font-semibold">{{ deal.label }}</span>
            </span>
          </div>
        </div>

        <!-- Totals — anchored directly below quota bar -->
        <div class="border-t border-gray-100">
          <div class="px-4 pt-3 pb-1 flex items-center justify-between">
            <span class="text-xs text-gray-400">before tax</span>
            <span class="text-sm font-semibold tabular-nums" :class="appliedDeals.length ? 'text-gray-400 line-through' : 'text-gray-600'">${{ subtotal.toFixed(2) }}</span>
          </div>
          <div v-for="deal in appliedDeals" :key="deal.id" class="px-4 py-0.5 flex items-center justify-between">
            <span class="text-xs font-semibold text-green-600">🎉 {{ deal.label }}</span>
            <span class="text-sm font-bold text-green-600 tabular-nums">-${{ deal.savings.toFixed(2) }}</span>
          </div>
          <div v-if="appliedDeals.length" class="px-4 pb-1 flex items-center justify-between">
            <span class="text-xs text-gray-500 font-semibold">deal price</span>
            <span class="text-sm font-bold text-gray-700 tabular-nums">${{ adjustedSubtotal.toFixed(2) }}</span>
          </div>
          <div class="px-4 pb-4 flex items-center justify-between">
            <span class="text-xs text-gray-500">after tax (20%)</span>
            <span class="text-base font-black text-gray-800 tabular-nums">${{ (adjustedSubtotal * 1.2).toFixed(2) }}</span>
          </div>
        </div>

        <!-- Cross-sell suggestions -->
        <div v-if="crossSellProducts.length" class="border-t border-gray-100 px-4 py-3">
          <p class="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">You might also like</p>
          <div class="flex flex-col gap-2">
            <div
              v-for="p in crossSellProducts"
              :key="p.id"
              class="flex items-center gap-2.5 cursor-pointer"
              @click="modalProduct = p"
            >
              <img
                v-if="p.Image"
                :src="p.Image"
                class="w-10 h-10 rounded-lg object-cover shrink-0 bg-gray-100"
              />
              <div v-else class="w-10 h-10 rounded-lg bg-gray-100 shrink-0" />
              <div class="flex-1 min-w-0">
                <p class="text-xs font-semibold text-gray-800 leading-snug truncate">{{ p.Name }}</p>
                <p class="text-xs text-gray-400">{{ p['Unit Weight'] || p.Category?.toLowerCase().replace('_', ' ') }}</p>
              </div>
              <div class="flex items-center gap-1.5 shrink-0">
                <span v-if="p.Price != null" class="text-xs font-semibold text-gray-600 tabular-nums">${{ p.Price }}</span>
                <button
                  @click.stop="addCrossSell(p)"
                  class="w-6 h-6 rounded-full bg-teal-500 text-white hover:bg-teal-600 transition-colors text-sm flex items-center justify-center leading-none"
                >+</button>
              </div>
            </div>
          </div>
        </div>
      </div>

    </template>
  </div>

  <ProductModal
    v-if="modalProduct"
    :product="modalProduct"
    @close="modalProduct = null"
  />

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
