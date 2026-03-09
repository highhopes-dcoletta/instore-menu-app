<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useProductsStore } from '@/stores/products'
import { useSessionStore } from '@/stores/session'
import { useCartAnimation } from '@/composables/useCartAnimation'
import { strainLabel } from '@/utils/strainLabels'

const router = useRouter()
const productsStore = useProductsStore()
const session = useSessionStore()
const { fire: fireCartAnimation, fireToast, BUBBLE_DURATION } = useCartAnimation()

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
}

function back() {
  if (showResults.value) { step.value = 3 } else { step.value-- }
}

// ── Scoring ───────────────────────────────────────────────────────────────────

function scoreProduct(p) {
  let score = 0
  const strain  = (p.Strain ?? '').toUpperCase()
  const cat     = p.Category ?? ''
  const potency = p.Potency ?? 0
  const tags    = p.Tags ?? []
  const { effect, experience } = answers.value

  if (effect === 'relax') {
    if (strain === 'INDICA') score += 4
    else if (strain === 'HYBRID') score += 2
    else if (strain === 'SATIVA') score -= 1
  } else if (effect === 'sleep') {
    if (strain === 'INDICA') score += 4
    else if (strain === 'HYBRID') score += 1
    else if (strain === 'SATIVA') score -= 2
    if (tags.includes('Sleep')) score += 5
  } else if (effect === 'energize') {
    if (strain === 'SATIVA') score += 4
    else if (strain === 'HYBRID') score += 2
    else if (strain === 'INDICA') score -= 1
  } else if (effect === 'social') {
    if (strain === 'HYBRID') score += 4
    else if (strain === 'SATIVA') score += 3
    else if (strain === 'INDICA') score += 1
    if (cat === 'EDIBLES') score += 2
  } else if (effect === 'pain') {
    if (strain === 'INDICA') score += 3
    else if (strain === 'HYBRID') score += 1
    if (['TINCTURE', 'TOPICAL'].includes(cat)) score += 4
    if (potency >= 20) score += 2
  }

  if (experience === 'new') {
    if (potency > 0 && potency <= 12) score += 3
    else if (potency >= 20) score -= 3
    if (cat === 'EDIBLES') score += 1
  } else if (experience === 'regular') {
    if (potency >= 25) score += 2
  }

  return score
}

const recommendations = computed(() => {
  if (!showResults.value) return []

  let pool = productsStore.products

  const { method } = answers.value
  if (method === 'flower')  pool = pool.filter(p => p.Category === 'FLOWER' || p.Category === 'PRE_ROLLS')
  else if (method === 'edibles') pool = pool.filter(p => p.Category === 'EDIBLES')
  else if (method === 'vape')    pool = pool.filter(p => p.Category === 'VAPORIZERS')

  // Score and deduplicate by name (best variant per product)
  const byName = new Map()
  for (const p of pool) {
    const score = scoreProduct(p)
    if (!byName.has(p.Name) || score > byName.get(p.Name)._score) {
      byName.set(p.Name, { ...p, _score: score })
    }
  }

  return [...byName.values()]
    .sort((a, b) => b._score - a._score)
    .slice(0, 8)
})

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
    <div class="flex gap-6 mt-10">
      <button
        v-if="step > 1"
        @click="back"
        class="text-gray-500 text-sm active:text-white transition-colors"
      >← Back</button>
      <button
        @click="router.push('/')"
        class="text-gray-500 text-sm active:text-white transition-colors"
      >Browse full menu</button>
    </div>
  </main>

  <!-- Results screen -->
  <main v-else class="p-8 bg-gray-950 min-h-[calc(100vh-3rem)]">
    <div class="max-w-6xl mx-auto">
      <div class="flex items-center justify-between mb-2">
        <h1 class="text-white text-2xl font-black">Our top picks for you</h1>
        <button @click="router.push('/')" class="text-gray-500 text-sm active:text-white transition-colors">
          Browse full menu →
        </button>
      </div>
      <p class="text-gray-500 text-sm mb-8">Add items to your cart and show your budtender when you're ready.</p>

      <div class="grid grid-cols-4 gap-4">
        <div
          v-for="p in recommendations"
          :key="p.id"
          class="rounded-2xl bg-gray-800 overflow-hidden flex flex-col"
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
            <div class="flex items-center gap-1.5 flex-wrap mt-0.5">
              <span
                v-if="p.Strain"
                class="text-xs font-semibold px-1.5 py-0.5 rounded-full"
                :class="strainColor(p.Strain)"
              >{{ strainLabel(p.Strain) }}</span>
              <span v-if="p.Potency" class="text-xs text-gray-400">{{ p.Potency }}{{ p['Potency Unit'] }}</span>
            </div>
            <div class="flex items-center justify-between mt-auto pt-2">
              <span class="text-teal-400 font-black text-sm">{{ displayPrice(p) }}</span>

              <!-- +/- controls -->
              <div v-if="qty(p.id) > 0" class="flex items-center gap-2">
                <button
                  @click="remove(p)"
                  class="w-7 h-7 rounded-full bg-gray-700 text-white font-black flex items-center justify-center active:bg-teal-600 transition-colors text-lg leading-none"
                >−</button>
                <span class="text-white font-bold text-sm tabular-nums">{{ qty(p.id) }}</span>
                <button
                  @click="add(p, $event)"
                  class="w-7 h-7 rounded-full bg-teal-600 text-white font-black flex items-center justify-center active:bg-teal-500 transition-colors text-lg leading-none"
                >+</button>
              </div>
              <button
                v-else
                @click="add(p, $event)"
                class="w-7 h-7 rounded-full bg-teal-600 text-white font-black flex items-center justify-center active:bg-teal-500 transition-colors text-lg leading-none"
              >+</button>
            </div>
          </div>
        </div>
      </div>

      <button @click="back" class="mt-8 text-gray-500 text-sm active:text-white transition-colors">
        ← Change my answers
      </button>
    </div>
  </main>
</template>
