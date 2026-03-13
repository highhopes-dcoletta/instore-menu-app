<script setup>
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSessionStore } from '@/stores/session'
import { useCartAnimation } from '@/composables/useCartAnimation'
import { useAnalytics } from '@/composables/useAnalytics'
import { perUnitLabel } from '@/composables/useProductGrouping'

const { t } = useI18n()

const props = defineProps({
  product: { type: Object, required: true },
})
const emit = defineEmits(['close'])

const session = useSessionStore()
const { fire: fireCartAnimation, fireToast, BUBBLE_DURATION } = useCartAnimation()
const { track } = useAnalytics()

const qty = computed(() => session.selections[props.product.id]?.qty ?? 0)

const maxTerpValue = computed(() => {
  if (!props.product.Terpenes?.length) return 1
  return Math.max(...props.product.Terpenes.map(t => t.value)) || 1
})

// ── Terpene view toggle ────────────────────────────────────────────────────────

const terpView = ref('terpenes') // 'terpenes' | 'aromas'
const terpSection = ref(null)

const aromaGroups = computed(() => {
  const terps = props.product.Terpenes
  if (!terps?.length) return []
  const map = new Map()
  for (const terp of terps) {
    for (const a of terp.aromas ?? []) {
      if (!map.has(a)) map.set(a, { label: a, type: 'aroma', terpenes: [] })
      map.get(a).terpenes.push({ name: terp.name, value: terp.value })
    }
    for (const e of terp.effects ?? []) {
      if (!map.has(e)) map.set(e, { label: e, type: 'effect', terpenes: [] })
      map.get(e).terpenes.push({ name: terp.name, value: terp.value })
    }
  }
  const groups = [...map.values()]
  groups.sort((a, b) => b.terpenes.length - a.terpenes.length || a.label.localeCompare(b.label))
  for (const g of groups) g.terpenes.sort((a, b) => b.value - a.value)
  return groups
})

function captureChipPositions() {
  const positions = new Map()
  if (!terpSection.value) return positions
  for (const el of terpSection.value.querySelectorAll('[data-chip]')) {
    const key = el.dataset.chip
    if (positions.has(key)) continue // only first occurrence
    const r = el.getBoundingClientRect()
    positions.set(key, { x: r.left, y: r.top, w: r.width, h: r.height })
  }
  return positions
}

// Debug: set to 1 for normal speed
const ANIM_SCALE = 1

const switching = ref(false)

function switchTerpView(newView) {
  if (newView === terpView.value || switching.value) return
  switching.value = true

  // ── Phase 1: Capture + fade out old ──────────────────────────────────────────
  const oldPos = captureChipPositions()

  // Fade out old scaffold elements
  const fadeOutDuration = 200 * ANIM_SCALE
  if (terpSection.value) {
    for (const el of terpSection.value.querySelectorAll('[data-scaffold]')) {
      el.animate(
        [{ opacity: 1 }, { opacity: 0 }],
        { duration: fadeOutDuration, easing: 'ease-in', fill: 'forwards' }
      )
    }
    // Crossfade card backgrounds toward transparent
    for (const el of terpSection.value.querySelectorAll('[data-card]')) {
      el.animate(
        [{ backgroundColor: getComputedStyle(el).backgroundColor }, { backgroundColor: 'transparent' }],
        { duration: fadeOutDuration, easing: 'ease-in', fill: 'forwards' }
      )
    }
  }

  // ── Phase 2: Swap view after fade-out completes ────────────────────────────
  setTimeout(() => {
    terpView.value = newView
    nextTick(() => {
      if (!terpSection.value) { switching.value = false; return }

      // ── Phase 3: Fade in new scaffold ──────────────────────────────────────
      const fadeInDuration = 300 * ANIM_SCALE
      const fadeInDelay = 200 * ANIM_SCALE
      for (const el of terpSection.value.querySelectorAll('[data-scaffold]')) {
        el.animate(
          [{ opacity: 0 }, { opacity: 1 }],
          { duration: fadeInDuration, delay: fadeInDelay, easing: 'ease-out', fill: 'backwards' }
        )
      }

      // Fade in new card backgrounds from transparent
      for (const el of terpSection.value.querySelectorAll('[data-card]')) {
        const target = getComputedStyle(el).backgroundColor
        el.animate(
          [{ backgroundColor: 'transparent' }, { backgroundColor: target }],
          { duration: fadeInDuration, delay: fadeInDelay, easing: 'ease-out', fill: 'backwards' }
        )
      }

      // ── Phase 4: FLIP chips ────────────────────────────────────────────────
      const flipDuration = 400 * ANIM_SCALE
      const seen = new Set()
      for (const el of terpSection.value.querySelectorAll('[data-chip]')) {
        const key = el.dataset.chip
        if (seen.has(key)) continue
        seen.add(key)
        const old = oldPos.get(key)
        const r = el.getBoundingClientRect()
        if (!old) {
          el.animate(
            [{ opacity: 0, transform: 'scale(0.6)' }, { opacity: 1, transform: 'scale(1)' }],
            { duration: 300 * ANIM_SCALE, delay: 150 * ANIM_SCALE, easing: 'cubic-bezier(0.2, 0, 0.2, 1)', fill: 'backwards' }
          )
          continue
        }
        const dx = old.x - r.left
        const dy = old.y - r.top
        const sx = old.w / (r.width || 1)
        const sy = old.h / (r.height || 1)
        if (Math.abs(dx) < 2 && Math.abs(dy) < 2 && Math.abs(sx - 1) < 0.05) continue
        el.animate(
          [
            { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` },
            { transform: 'translate(0, 0) scale(1, 1)' },
          ],
          { duration: flipDuration, easing: 'cubic-bezier(0.2, 0, 0.2, 1)' }
        )
      }

      setTimeout(() => { switching.value = false }, flipDuration)
    })
  }, fadeOutDuration)
}

const pricePerGram = computed(() => {
  const price = props.product.Price
  const weight = props.product['Unit Weight']
  if (!price || !weight) return null
  const match = weight.match(/([\d.\/]+)\s*(oz|g)/i)
  if (!match) return null
  let grams
  if (match[2].toLowerCase() === 'g') {
    grams = parseFloat(match[1])
  } else {
    const parts = match[1].split('/')
    const oz = parts.length === 2 ? parseFloat(parts[0]) / parseFloat(parts[1]) : parseFloat(parts[0])
    grams = oz * 28.3495
  }
  if (!grams || grams <= 0) return null
  return (price / grams).toFixed(2)
})

function updateQty(delta, event) {
  if (delta > 0) {
    const wasEmpty = session.selectionCount === 0
    fireCartAnimation(event.clientX, event.clientY, props.product.Image, null, null)
    if (wasEmpty) fireToast()
    track('add_to_cart', { source: 'modal', product_id: props.product.id, product_name: props.product.Name, category: props.product.Category })
    setTimeout(() => session.updateQuantity(props.product.id, {
      name: props.product.Name ?? '',
      unitWeight: props.product['Unit Weight'] ?? '',
      price: props.product.Price ?? 0,
      image: props.product.Image ?? null,
      category: props.product.Category ?? '',
      subcategory: props.product.Subcategory ?? '',
    }, delta, 'modal'), BUBBLE_DURATION)
  } else {
    session.updateQuantity(props.product.id, {
      name: props.product.Name ?? '',
      unitWeight: props.product['Unit Weight'] ?? '',
      price: props.product.Price ?? 0,
      image: props.product.Image ?? null,
      category: props.product.Category ?? '',
      subcategory: props.product.Subcategory ?? '',
    }, delta, 'modal')
  }
}

function onKey(e) {
  if (e.key === 'Escape') emit('close')
}
onMounted(() => {
  window.addEventListener('keydown', onKey)
  track('product_modal_opened', { product_id: props.product.id, product_name: props.product.Name, category: props.product.Category })
  session.reportJourney('view', `Viewed ${props.product.Name}`)
})
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      @click.self="emit('close')"
    >
      <!-- Modal card -->
      <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-6 p-8 max-h-[90vh] overflow-y-auto">

        <!-- Close button -->
        <button
          @click="emit('close')"
          class="absolute top-4 right-4 text-gray-400 hover:text-gray-700 text-2xl leading-none"
          :aria-label="t('msg.close')"
        >&times;</button>

        <!-- Image -->
        <img
          v-if="product.Image"
          :src="product.Image"
          :alt="product.Name"
          class="w-48 h-48 object-cover rounded-xl mb-6"
        />

        <!-- Name -->
        <h2 class="text-3xl font-black text-gray-800 mb-2">{{ product.Name }}</h2>

        <!-- Price -->
        <div v-if="product.Price != null" class="mb-4">
          <span class="text-lg text-gray-700">${{ Number(product.Price).toFixed(2) }}</span>
          <span v-if="perUnitLabel(product)" class="ml-2 text-sm text-gray-400">{{ perUnitLabel(product) }}</span>
        </div>

        <!-- Details -->
        <div class="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600 mb-4"
          v-if="product.Potency || product.CBD || product.Strain || pricePerGram">
          <span v-if="product.Potency">
            THC {{ product.Potency }}{{ product['Potency Unit'] || '%' }}
          </span>
          <span v-if="product.CBD">
            CBD {{ product.CBD }}{{ product['CBD Unit'] || '%' }}
          </span>
          <span v-if="product.Strain">{{ product.Strain }}</span>
          <span v-if="pricePerGram">${{ pricePerGram }}/g</span>
        </div>

        <!-- Cannabinoids -->
        <div v-if="product.Cannabinoids?.length" class="mb-4">
          <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Cannabinoids</h3>
          <div class="flex flex-wrap gap-2">
            <span
              v-for="c in product.Cannabinoids" :key="c.name"
              class="px-2.5 py-1 rounded-lg bg-purple-50 border border-purple-100 text-purple-700 text-xs font-semibold"
            >{{ c.name }} {{ c.value }}{{ c.unit }}</span>
          </div>
        </div>

        <!-- Terpenes -->
        <div v-if="product.Terpenes?.length" ref="terpSection" class="mb-4">
          <!-- Tab bar -->
          <div class="flex border-b border-gray-200 mb-3">
            <button
              @click="switchTerpView('terpenes')"
              class="px-3 pb-2 text-xs font-semibold transition-colors border-b-2 -mb-px"
              :class="terpView === 'terpenes'
                ? 'border-teal-500 text-teal-600'
                : 'border-transparent text-gray-400 hover:text-gray-600'"
            >Terpenes</button>
            <button
              @click="switchTerpView('aromas')"
              class="px-3 pb-2 text-xs font-semibold transition-colors border-b-2 -mb-px"
              :class="terpView === 'aromas'
                ? 'border-amber-500 text-amber-600'
                : 'border-transparent text-gray-400 hover:text-gray-600'"
            >Aromas &amp; Effects</button>
          </div>

          <!-- Terpene-focused view -->
          <div v-if="terpView === 'terpenes'" class="space-y-2.5">
            <div v-for="terp in product.Terpenes" :key="terp.name"
              data-card class="rounded-xl bg-gray-50 px-3 py-2.5">
              <div class="flex items-center justify-between mb-1.5">
                <span :data-chip="'terp-'+terp.name"
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/80 border border-gray-200 text-xs font-semibold text-gray-700 leading-tight"
                >{{ terp.name }} <span class="text-gray-400 tabular-nums">{{ terp.value }}%</span></span>
              </div>
              <div data-scaffold class="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div class="h-full rounded-full transition-all"
                  :style="{ width: Math.max(terp.value / maxTerpValue * 100, 4) + '%' }"
                  :class="terp.value / maxTerpValue > 0.6 ? 'bg-teal-500' : terp.value / maxTerpValue > 0.25 ? 'bg-teal-400' : 'bg-teal-300'" />
              </div>
              <div v-if="terp.aromas?.length || terp.effects?.length" class="flex flex-wrap gap-1 mt-2">
                <span v-for="a in terp.aromas" :key="'a-'+a"
                  :data-chip="'aroma-'+a"
                  class="px-2 py-0.5 rounded-full bg-amber-100/70 text-amber-700 text-xs font-semibold leading-tight"
                >{{ a }}</span>
                <span v-for="e in terp.effects" :key="'e-'+e"
                  :data-chip="'effect-'+e"
                  class="px-2 py-0.5 rounded-full bg-teal-100/70 text-teal-700 text-xs font-semibold leading-tight"
                >{{ e }}</span>
              </div>
            </div>
          </div>

          <!-- Aroma/effect-focused view -->
          <div v-else class="space-y-2.5">
            <div v-for="group in aromaGroups" :key="group.label"
              data-card class="rounded-xl px-3 py-2.5"
              :class="group.type === 'aroma' ? 'bg-amber-50/60' : 'bg-teal-50/60'">
              <div class="flex items-center gap-1.5 mb-1.5 flex-wrap">
                <span :data-chip="(group.type === 'aroma' ? 'aroma-' : 'effect-')+group.label"
                  class="px-2 py-0.5 rounded-full text-xs font-semibold leading-tight"
                  :class="group.type === 'aroma'
                    ? 'bg-amber-100/70 text-amber-700'
                    : 'bg-teal-100/70 text-teal-700'"
                >{{ group.label }}</span>
                <span data-scaffold class="text-[10px] font-medium text-gray-400">{{ group.type }}</span>
              </div>
              <div class="flex flex-wrap gap-1.5">
                <span v-for="t in group.terpenes" :key="t.name"
                  :data-chip="'terp-'+t.name"
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/80 border border-gray-200 text-xs font-semibold text-gray-700 leading-tight"
                >{{ t.name }} <span class="text-gray-400 tabular-nums">{{ t.value }}%</span></span>
              </div>
            </div>
          </div>
        </div>

        <!-- Description -->
        <p v-if="product.Description" class="text-gray-500 leading-relaxed mb-6">
          {{ product.Description }}
        </p>

        <!-- Cart control -->
        <div class="flex items-center gap-3 mt-2">
          <template v-if="qty === 0">
            <button
              @click="updateQty(1, $event)"
              class="flex-1 py-3 rounded-xl bg-teal-500 text-white font-bold text-base hover:bg-teal-600 active:bg-teal-700 transition-colors"
            >{{ t('cart.addToCart') }}</button>
          </template>
          <template v-else>
            <button
              @click="updateQty(-1, $event)"
              class="w-11 h-11 rounded-full border border-gray-300 text-gray-600 hover:border-teal-500 hover:text-teal-600 transition-colors text-xl leading-none flex items-center justify-center"
            >−</button>
            <span class="w-8 text-center text-lg font-bold tabular-nums">{{ qty }}</span>
            <button
              @click="updateQty(1, $event)"
              class="w-11 h-11 rounded-full bg-teal-500 text-white hover:bg-teal-600 transition-colors text-xl leading-none flex items-center justify-center"
            >+</button>
          </template>
        </div>

      </div>
    </div>
  </Teleport>
</template>
