<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useProductsStore } from '@/stores/products'
import { useSessionStore } from '@/stores/session'
import { useCartAnimation } from '@/composables/useCartAnimation'
import { strainLabel } from '@/utils/strainLabels'
import { getPotencyLevel } from '@/utils/potencyLevel'
import { scoreProduct, getRecommendations } from '@/utils/recommendations'
import { useAnalytics } from '@/composables/useAnalytics'
import { useProductBundles } from '@/composables/useBundles'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import ProductModal from '@/components/ProductModal.vue'

const router = useRouter()
const productsStore = useProductsStore()
const session = useSessionStore()
const { fire: fireCartAnimation, fireToast, BUBBLE_DURATION } = useCartAnimation()
const { track } = useAnalytics()
const { activeBundlesForProduct } = useProductBundles()
const { bundlesEnabled } = useFeatureFlags()
track('guided_view_started')

// ── Wizard state ──────────────────────────────────────────────────────────────

const step = ref(1)
const answers = ref({ experience: null, effect: null, method: null })

const STEPS = [
  {
    key: 'experience',
    question: 'How familiar are you with cannabis?',
    options: [
      { value: 'new',        emoji: '🌱', label: 'New to this',     sub: 'Mild and approachable' },
      { value: 'occasional', emoji: '🌿', label: 'Occasional user', sub: 'Some experience' },
      { value: 'regular',    emoji: '💨', label: 'Regular user',    sub: 'I know what I like' },
    ],
  },
  {
    key: 'effect',
    question: 'What are you looking for today?',
    options: [
      { value: 'relax',    emoji: '😌', label: 'Relax & unwind',   sub: 'Take the edge off' },
      { value: 'sleep',    emoji: '😴', label: 'Help me sleep',    sub: 'Deep, restful sleep' },
      { value: 'energize', emoji: '⚡', label: 'Energy & focus',   sub: 'Get things done' },
      { value: 'social',   emoji: '🎉', label: 'Fun & social',     sub: 'Good vibes' },
      { value: 'pain',     emoji: '💪', label: 'Pain or stress',   sub: 'Relief and comfort' },
    ],
  },
  {
    key: 'method',
    question: 'How do you prefer to consume?',
    options: [
      { value: 'flower',  emoji: '🌸', label: 'Flower',         sub: 'Smoke or pack a bowl' },
      { value: 'edibles', emoji: '🍬', label: 'Edibles',        sub: 'Gummies, chocolates, drinks' },
      { value: 'vape',    emoji: '💨', label: 'Vape',           sub: 'Discreet and easy' },
      { value: 'any',     emoji: '🤷', label: 'No preference',  sub: 'Show me everything' },
    ],
  },
]

const currentStep = computed(() => STEPS[step.value - 1])
const showResults = computed(() => step.value > 3)

function choose(key, value) {
  answers.value[key] = value
  step.value++
  if (step.value > 3) {
    track('guided_view_completed', { ...answers.value })
  }
}

function back() {
  if (showResults.value) { step.value = 3 } else { step.value-- }
}

// ── Scoring ───────────────────────────────────────────────────────────────────

const recommendations = computed(() =>
  showResults.value ? getRecommendations(productsStore.products, answers.value) : []
)

// ── Modal ─────────────────────────────────────────────────────────────────────

const modalProduct = ref(null)

// ── Cart helpers ──────────────────────────────────────────────────────────────

function qty(id) {
  return session.selections[id]?.qty ?? 0
}

function cartDest() {
  const list = document.querySelector('[data-cart-list]')
  if (list) {
    const last = list.lastElementChild
    const r = last ? last.getBoundingClientRect() : list.getBoundingClientRect()
    return [r.left + r.width / 2, last ? r.bottom + 28 : r.top + 28]
  }
  return [null, null]
}

function add(product, event) {
  const wasEmpty = session.selectionCount === 0
  const [dx, dy] = cartDest()
  fireCartAnimation(event.clientX, event.clientY, product.Image, dx, dy)
  if (wasEmpty) fireToast()
  track('add_to_cart', { source: 'guided', product_id: product.id, product_name: product.Name, category: product.Category })
  setTimeout(() => session.updateQuantity(product.id, {
    name: product.Name,
    unitWeight: product['Unit Weight'] ?? '',
    price: product.Price ?? 0,
    image: product.Image ?? null,
    category: product.Category ?? '',
  }, 1), BUBBLE_DURATION)
}

function remove(product) {
  session.updateQuantity(product.id, {
    name: product.Name,
    unitWeight: product['Unit Weight'] ?? '',
    price: product.Price ?? 0,
    image: product.Image ?? null,
    category: product.Category ?? '',
  }, -1)
}

// ── Strain badge color ────────────────────────────────────────────────────────

function strainColor(strain) {
  const s = (strain ?? '').toUpperCase()
  if (s === 'INDICA')  return 'bg-purple-100 text-purple-700'
  if (s === 'SATIVA')  return 'bg-orange-100 text-orange-700'
  if (s === 'HYBRID')  return 'bg-green-100 text-green-700'
  if (s === 'CBD')     return 'bg-blue-100 text-blue-700'
  return 'bg-gray-100 text-gray-500'
}

function displayPrice(p) {
  const price = p.SalePrice ?? p.Price
  return price ? `$${price}` : null
}

</script>

<template>
  <!-- Step screens -->
  <main v-if="!showResults" class="flex flex-col items-center justify-center min-h-[calc(100vh-3rem)] p-8 bg-gray-950">
    <!-- Progress dots -->
    <div class="flex gap-2 mb-10">
      <div
        v-for="n in 3" :key="n"
        class="w-2.5 h-2.5 rounded-full transition-colors"
        :class="n <= step ? 'bg-teal-400' : 'bg-gray-700'"
      />
    </div>

    <!-- Question -->
    <h1 class="text-white text-3xl font-black text-center mb-10 max-w-lg">
      {{ currentStep.question }}
    </h1>

    <!-- Options -->
    <div
      class="grid gap-4 w-full max-w-2xl"
      :class="currentStep.options.length <= 3 ? 'grid-cols-3' : 'grid-cols-3 sm:grid-cols-5'"
    >
      <button
        v-for="opt in currentStep.options"
        :key="opt.value"
        @click="choose(currentStep.key, opt.value)"
        class="flex flex-col items-center justify-center gap-2 rounded-2xl bg-gray-800 text-white p-6 active:bg-teal-700 transition-colors aspect-square"
      >
        <span class="text-4xl">{{ opt.emoji }}</span>
        <span class="font-black text-base text-center leading-tight">{{ opt.label }}</span>
        <span class="text-xs text-gray-400 text-center leading-tight">{{ opt.sub }}</span>
      </button>
    </div>

    <!-- Back / Skip -->
    <div class="flex gap-4 mt-10">
      <button
        v-if="step > 1"
        @click="back"
        class="px-5 py-3 rounded-xl bg-gray-800 text-white font-bold text-base active:bg-gray-700 transition-colors"
      >← Back</button>
      <button
        @click="router.push('/')"
        class="px-5 py-3 rounded-xl bg-gray-800 text-white font-bold text-base active:bg-gray-700 transition-colors"
      >Browse full menu</button>
    </div>
  </main>

  <!-- Results screen -->
  <main v-else class="p-8 bg-gray-950 min-h-[calc(100vh-3rem)]">
    <div class="max-w-6xl mx-auto">
      <div class="flex items-center justify-between mb-2">
        <h1 class="text-white text-2xl font-black">Our top picks for you</h1>
        <button
          @click="router.push('/')"
          class="px-5 py-3 rounded-xl bg-gray-800 text-white font-bold text-base active:bg-gray-700 transition-colors"
        >Browse full menu →</button>
      </div>
      <p class="text-gray-500 text-sm mb-8">Add items to your cart and show your budtender when you're ready.</p>

      <div class="grid grid-cols-4 gap-4">
        <div
          v-for="p in recommendations"
          :key="p.id"
          class="rounded-2xl bg-gray-800 overflow-hidden flex flex-col cursor-pointer active:opacity-80 transition-opacity"
          @click="modalProduct = p"
        >
          <!-- Image -->
          <div class="aspect-square bg-gray-700 overflow-hidden">
            <img
              v-if="p.Image"
              :src="p.Image"
              :alt="p.Name"
              class="w-full h-full object-cover"
            />
            <div v-else class="w-full h-full flex items-center justify-center text-gray-600 text-4xl">🌿</div>
          </div>

          <!-- Info -->
          <div class="p-3 flex flex-col gap-1 flex-1">
            <p class="text-white font-bold text-sm leading-tight line-clamp-2">{{ p.Name }}</p>
            <div v-if="bundlesEnabled && activeBundlesForProduct(p).length" class="flex flex-wrap gap-1 mt-1">
              <span
                v-for="bundle in activeBundlesForProduct(p)"
                :key="bundle.id"
                class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-bold leading-none bg-amber-500/20 border border-amber-500/30 text-amber-300"
              >🎉 {{ bundle.label }}</span>
            </div>
            <div class="flex items-center gap-1.5 flex-wrap mt-0.5">
              <span
                v-if="p.Strain"
                class="text-xs font-semibold px-1.5 py-0.5 rounded-full"
                :class="strainColor(p.Strain)"
              >{{ strainLabel(p.Strain) }}</span>
              <span
                v-if="p['Unit Weight']"
                class="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-gray-700 text-gray-300"
              >{{ p['Unit Weight'] }}</span>
            </div>
            <!-- Potency indicator -->
            <div v-if="getPotencyLevel(p)" class="flex items-center gap-1.5 mt-1">
              <div class="flex gap-0.5">
                <div
                  v-for="n in 4" :key="n"
                  class="w-2 h-2 rounded-full"
                  :class="n <= getPotencyLevel(p).dots ? getPotencyLevel(p).color : 'bg-gray-600'"
                />
              </div>
              <span class="text-xs font-semibold text-gray-300">
                {{ getPotencyLevel(p).label }} · {{ p.Potency }}{{ p['Potency Unit'] }}
              </span>
            </div>
            <div class="flex items-center justify-between mt-auto pt-2">
              <span class="text-teal-400 font-black text-sm">{{ displayPrice(p) }}</span>

              <!-- +/- controls -->
              <div v-if="qty(p.id) > 0" class="flex items-center gap-2">
                <button
                  @click.stop="remove(p)"
                  class="w-7 h-7 rounded-full bg-gray-700 text-white font-black flex items-center justify-center active:bg-teal-600 transition-colors text-lg leading-none"
                >−</button>
                <span class="text-white font-bold text-sm tabular-nums">{{ qty(p.id) }}</span>
                <button
                  @click.stop="add(p, $event)"
                  class="w-7 h-7 rounded-full bg-teal-600 text-white font-black flex items-center justify-center active:bg-teal-500 transition-colors text-lg leading-none"
                >+</button>
              </div>
              <button
                v-else
                @click.stop="add(p, $event)"
                class="w-7 h-7 rounded-full bg-teal-600 text-white font-black flex items-center justify-center active:bg-teal-500 transition-colors text-lg leading-none"
              >+</button>
            </div>
          </div>
        </div>
      </div>

      <button
        @click="back"
        class="mt-8 px-5 py-3 rounded-xl bg-gray-800 text-white font-bold text-base active:bg-gray-700 transition-colors"
      >← Change my answers</button>
    </div>
  </main>

  <ProductModal
    v-if="modalProduct"
    :product="modalProduct"
    @close="modalProduct = null"
  />
</template>
