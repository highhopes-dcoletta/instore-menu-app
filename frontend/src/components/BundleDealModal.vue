<script setup>
import { computed, ref, watch, nextTick } from 'vue'
import { useProductsStore } from '@/stores/products'
import { useSessionStore } from '@/stores/session'
import { useAnalytics } from '@/composables/useAnalytics'

const props = defineProps({
  bundle: { type: Object, required: true },
})
const emit = defineEmits(['close'])

const productsStore = useProductsStore()
const session = useSessionStore()
const { track } = useAnalytics()
const canvas = ref(null)

const matchingProducts = computed(() =>
  productsStore.products.filter(p =>
    props.bundle.match({
      name: p.Name,
      category: p.Category,
      unitWeight: p['Unit Weight'] ?? '',
      price: p.Price ?? 0,
      qty: 1,
    })
  )
)

const currentQty = computed(() =>
  Object.values(session.selections)
    .filter(item => props.bundle.match(item))
    .reduce((s, i) => s + i.qty, 0)
)

const needed = computed(() => Math.max(0, props.bundle.quantity - currentQty.value))
const isComplete = computed(() => currentQty.value >= props.bundle.quantity)

// ── Fireworks ─────────────────────────────────────────────────────────────────

const COLORS = [
  '#f59e0b', '#10b981', '#3b82f6', '#ec4899',
  '#a78bfa', '#f97316', '#14b8a6', '#facc15',
]

function launchFireworks() {
  const c = canvas.value
  if (!c) return
  c.width  = c.offsetWidth
  c.height = c.offsetHeight
  const ctx = c.getContext('2d')

  const particles = []

  function burst(x, y) {
    const color = COLORS[Math.floor(Math.random() * COLORS.length)]
    const count = 40 + Math.floor(Math.random() * 20)
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.3
      const speed = 3 + Math.random() * 5
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1,
        color,
        alpha: 1,
        size: 3 + Math.random() * 3,
        decay: 0.013 + Math.random() * 0.007,
      })
    }
  }

  // Staggered bursts across the modal
  burst(c.width * 0.25, c.height * 0.35)
  setTimeout(() => burst(c.width * 0.75, c.height * 0.25), 120)
  setTimeout(() => burst(c.width * 0.5,  c.height * 0.45), 240)
  setTimeout(() => burst(c.width * 0.15, c.height * 0.55), 360)
  setTimeout(() => burst(c.width * 0.85, c.height * 0.4),  480)

  let rafId
  function animate() {
    ctx.clearRect(0, 0, c.width, c.height)
    let alive = false
    for (const p of particles) {
      p.x  += p.vx
      p.y  += p.vy
      p.vy += 0.12          // gravity
      p.vx *= 0.98          // drag
      p.alpha -= p.decay
      if (p.alpha <= 0) continue
      alive = true
      ctx.globalAlpha = p.alpha
      ctx.fillStyle   = p.color
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
    if (alive) rafId = requestAnimationFrame(animate)
  }
  rafId = requestAnimationFrame(animate)

  // Clean up after 3s no matter what
  setTimeout(() => cancelAnimationFrame(rafId), 3000)
}

watch(isComplete, async (val, prev) => {
  if (val && !prev) {
    await nextTick()
    launchFireworks()
  }
})

// ── Cart helpers ──────────────────────────────────────────────────────────────

function cartQty(product) {
  return session.selections[product.id]?.qty ?? 0
}

function adjust(product, delta) {
  session.updateQuantity(product.id, {
    name: product.Name,
    unitWeight: product['Unit Weight'] ?? '',
    price: product.Price ?? 0,
    image: product.Image ?? null,
    category: product.Category ?? '',
  }, delta)
}

// Distribute `needed` items across matching products, cycling from index 0
function pickForMe() {
  const products = matchingProducts.value
  if (!products.length) return
  const count = needed.value
  track('bundle_pick_for_me_used', { bundle_id: props.bundle.id, bundle_label: props.bundle.label, items_added: count })
  let remaining = count
  let i = 0
  while (remaining > 0) {
    adjust(products[i % products.length], 1)
    i++
    remaining--
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
      @click.self="emit('close')"
    >
      <div class="relative w-full max-w-lg bg-white rounded-t-2xl p-6 max-h-[75vh] flex flex-col overflow-hidden">

        <!-- Fireworks canvas — sits over the modal, pointer-events off -->
        <canvas
          ref="canvas"
          class="absolute inset-0 w-full h-full pointer-events-none z-10"
        />

        <!-- Header -->
        <div class="relative z-20 flex items-start justify-between mb-3">
          <div>
            <div class="text-xs font-bold uppercase tracking-widest text-amber-500 mb-0.5">Deal</div>
            <h2 class="text-lg font-black text-gray-800 leading-snug">{{ bundle.label }}</h2>
          </div>
          <button @click="emit('close')" class="text-gray-400 hover:text-gray-600 text-3xl leading-none ml-4 mt-0.5">×</button>
        </div>

        <!-- Progress -->
        <div class="relative z-20 mb-4">
          <div class="flex items-center justify-between mb-1.5">
            <span class="text-xs text-gray-500">{{ currentQty }} / {{ bundle.quantity }} in cart</span>
            <span v-if="isComplete" class="text-xs font-bold text-green-600">🎉 Deal unlocked!</span>
            <template v-else>
              <span class="text-xs font-semibold text-amber-600">Add {{ needed }} more to unlock</span>
              <button
                @click="pickForMe"
                class="ml-3 px-2.5 py-1 rounded-lg bg-teal-500 text-white text-xs font-bold hover:bg-teal-600 transition-colors shrink-0"
              >Pick for me</button>
            </template>
          </div>
          <div class="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div
              class="h-full rounded-full transition-all duration-300"
              :class="isComplete ? 'bg-green-500' : 'bg-amber-400'"
              :style="{ width: Math.min(100, (currentQty / bundle.quantity) * 100) + '%' }"
            />
          </div>
        </div>

        <!-- Product list -->
        <ul class="relative z-20 overflow-y-auto flex-1 divide-y divide-gray-100">
          <li
            v-for="product in matchingProducts"
            :key="product.id"
            class="flex items-center gap-3 py-3"
          >
            <img
              v-if="product.Image"
              :src="product.Image"
              class="w-12 h-12 rounded-lg object-cover shrink-0"
            />
            <div v-else class="w-12 h-12 rounded-lg bg-gray-100 shrink-0" />
            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold text-gray-800 leading-snug">{{ product.Name }}</p>
              <p class="text-xs text-gray-400">{{ product['Unit Weight'] }}</p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <span class="text-sm font-semibold text-gray-600 tabular-nums">${{ product.Price }}</span>
              <div class="flex items-center gap-1">
                <button
                  @click="adjust(product, -1)"
                  :disabled="cartQty(product) === 0"
                  class="w-7 h-7 rounded-full border border-gray-300 text-gray-600 hover:border-teal-500 hover:text-teal-600 transition-colors text-sm flex items-center justify-center disabled:opacity-30"
                >−</button>
                <span class="w-5 text-center text-sm font-semibold tabular-nums text-gray-800">{{ cartQty(product) }}</span>
                <button
                  @click="adjust(product, 1)"
                  class="w-7 h-7 rounded-full bg-teal-500 text-white hover:bg-teal-600 transition-colors text-sm flex items-center justify-center"
                >+</button>
              </div>
            </div>
          </li>
        </ul>

        <!-- Done -->
        <div class="relative z-20 mt-4">
          <button
            @click="emit('close')"
            class="w-full py-3 rounded-xl font-bold text-sm transition-colors"
            :class="isComplete ? 'bg-teal-500 text-white hover:bg-teal-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
          >
            {{ isComplete ? '🎉 Done!' : 'Done' }}
          </button>
        </div>

      </div>
    </div>
  </Teleport>
</template>
