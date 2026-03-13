<script setup>
import { ref, computed, nextTick } from 'vue'
import { GROUPERS, computeGroups, perUnitLabel } from '@/composables/useProductGrouping'
import { useSessionStore } from '@/stores/session'
import { useCartAnimation } from '@/composables/useCartAnimation'
import { useAnalytics } from '@/composables/useAnalytics'
import { strainLabel } from '@/utils/strainLabels'
import { getPotencyLevel, perItemPotency } from '@/utils/potencyLevel'
import { useProductBundles } from '@/composables/useBundles'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import ProductTable from './ProductTable.vue'
import ProductModal from './ProductModal.vue'

const props = defineProps({
  products: { type: Array, required: true },
  columns:  { type: Array, default: () => ['name', 'strain', 'potency', 'price', 'stock'] },
  sortable: { type: Boolean, default: true },
  groupers: { type: Array, default: () => ['potency', 'strain', 'price'] },
})

// ── Grouping ───────────────────────────────────────────────────────────────

const grouped          = ref(false)
const expandedKey      = ref(null)   // level-1 pile selection
const subExpandedKey   = ref(null)   // level-2 sub-pile selection
const activeGrouperKey = ref(null)

const availableGroupers = computed(() =>
  GROUPERS.filter(g => props.groupers.includes(g.key))
)
const activeGrouper = computed(() =>
  availableGroupers.value.find(g => g.key === activeGrouperKey.value)
  ?? availableGroupers.value[0]
)
const pileGroups = computed(() => computeGroups(activeGrouper.value, props.products))

// Sub-grouper: next in list after active, cyclically; null if only 1 grouper
const subGrouper = computed(() => {
  if (availableGroupers.value.length <= 1) return null
  const idx = availableGroupers.value.findIndex(g => g.key === activeGrouper.value.key)
  return availableGroupers.value[(idx + 1) % availableGroupers.value.length]
})

// Level-1 labels / products
const expandedLabel = computed(() =>
  pileGroups.value.find(g => g.key === expandedKey.value)?.label ?? ''
)
const level1Products = computed(() =>
  expandedKey.value
    ? props.products.filter(p => activeGrouper.value.groupFn(p) === expandedKey.value)
    : props.products
)

// Level-2 sub-pile groups and labels
const subPileGroups = computed(() =>
  expandedKey.value && subGrouper.value
    ? computeGroups(subGrouper.value, level1Products.value)
    : []
)
const subExpandedLabel = computed(() =>
  subPileGroups.value.find(g => g.key === subExpandedKey.value)?.label ?? ''
)

// Level-2 products (within selected sub-pile)
const level2Products = computed(() =>
  subExpandedKey.value && subGrouper.value
    ? level1Products.value.filter(p => subGrouper.value.groupFn(p) === subExpandedKey.value)
    : level1Products.value
)

// Drill-down display mode
// Show sub-piles when: level-1 pile tapped, no sub-pile tapped, sub-grouper exists, and count > threshold
// Show cards when: level-1 pile tapped AND (no sub-grouper OR count ≤ threshold OR sub-pile tapped)
const CARD_THRESHOLD = 8
const showSubPiles = computed(() =>
  !!(expandedKey.value && !subExpandedKey.value && subGrouper.value && level1Products.value.length > CARD_THRESHOLD)
)
const showCards = computed(() =>
  !!(expandedKey.value && (!subGrouper.value || level1Products.value.length <= CARD_THRESHOLD || subExpandedKey.value))
)
const cardProducts = computed(() =>
  subExpandedKey.value ? level2Products.value : level1Products.value
)

// ── Cart helpers (for card view) ───────────────────────────────────────────

const session = useSessionStore()
const { fire: fireCartAnimation, fireToast, BUBBLE_DURATION } = useCartAnimation()
const { track } = useAnalytics()
const { activeBundlesForProduct } = useProductBundles()
const { bundlesEnabled } = useFeatureFlags()
const modalProduct = ref(null)

function qty(id) { return session.selections[id]?.qty ?? 0 }

function cartDest() {
  const list = document.querySelector('[data-cart-list]')
  if (list) {
    const last = list.lastElementChild
    const r = last ? last.getBoundingClientRect() : list.getBoundingClientRect()
    return [r.left + r.width / 2, last ? r.bottom + 28 : r.top + 28]
  }
  return [null, null]
}

function addToCart(product, event) {
  const wasEmpty = session.selectionCount === 0
  const [dx, dy] = cartDest()
  fireCartAnimation(event.clientX, event.clientY, product.Image, dx, dy)
  if (wasEmpty) fireToast()
  track('add_to_cart', { source: 'group_card', product_id: product.id, product_name: product.Name, category: product.Category })
  setTimeout(() => session.updateQuantity(product.id, {
    name:        product.Name,
    unitWeight:  product['Unit Weight'] ?? '',
    price:       product.Price ?? 0,
    image:       product.Image ?? null,
    category:    product.Category ?? '',
    subcategory: product.Subcategory ?? '',
  }, 1, 'group_card'), BUBBLE_DURATION)
}

function removeFromCart(product) {
  session.updateQuantity(product.id, {
    name:       product.Name,
    unitWeight: product['Unit Weight'] ?? '',
    price:      product.Price ?? 0,
    image:      product.Image ?? null,
    category:   product.Category ?? '',
    subcategory: product.Subcategory ?? '',
  }, -1, 'group_card')
}

function strainColor(strain) {
  const s = (strain ?? '').toUpperCase()
  if (s === 'INDICA') return 'bg-purple-100 text-purple-700'
  if (s === 'SATIVA') return 'bg-orange-100 text-orange-700'
  if (s === 'HYBRID') return 'bg-green-100 text-green-700'
  if (s === 'CBD')    return 'bg-blue-100 text-blue-700'
  return 'bg-gray-100 text-gray-500'
}

// Lock the card's current size/position before it's pulled out of the grid flow
function onCardLeave(el) {
  const { left, top, width, height } = el.getBoundingClientRect()
  const parentRect = el.parentElement.getBoundingClientRect()
  el.style.position = 'absolute'
  el.style.left     = `${left - parentRect.left}px`
  el.style.top      = `${top  - parentRect.top}px`
  el.style.width    = `${width}px`
  el.style.height   = `${height}px`
}

function displayPrice(p) {
  const price = p.SalePrice ?? p.Price
  return price ? `$${price}` : null
}


// ── Animation state ────────────────────────────────────────────────────────

const showGrouperPicker = ref(false)

function selectGrouper(g) {
  session.reportJourney('group', `Grouped by ${g.label}`)
  showGrouperPicker.value = false
  activeGrouperKey.value = g.key
  expandedKey.value = null
  subExpandedKey.value = null
  if (!grouped.value) {
    enterGroupView()
  }
}

const animating        = ref(false)
const exitAnimating    = ref(false)
const pilesCollapsing  = ref(false)
const listShifted      = ref(false)
const shiftPx          = ref(0)
const pileCounts       = ref({})
const listRef       = ref(null)

const sleep = ms => new Promise(r => setTimeout(r, ms))

defineExpose({
  activeGrouperKey, activeGrouper, availableGroupers,
  grouped, animating, exitAnimating,
  showGrouperPicker, selectGrouper, exitGroupView,
})

const GHOSTS_PER_GROUP = 3

function sampleSnapshots(snapshots) {
  const seen = {}
  return snapshots.filter(s => {
    seen[s.groupKey] = (seen[s.groupKey] ?? 0) + 1
    return seen[s.groupKey] <= GHOSTS_PER_GROUP
  })
}

function spawnGhost(rect, src, extraStyle = '') {
  const ghost = document.createElement('div')
  ghost.style.cssText = `
    position:fixed;
    left:${rect.left}px; top:${rect.top}px;
    width:${rect.width}px; height:${rect.height}px;
    background-image:url(${src}); background-size:cover; background-color:#d1fae5;
    border-radius:8px; box-shadow:0 2px 8px rgba(0,0,0,0.3);
    pointer-events:none; z-index:200;
    will-change:transform,opacity;
    ${extraStyle}
  `
  document.body.appendChild(ghost)
  return ghost
}

function animateCounts(flightMs) {
  const STEPS = 14
  pileCounts.value = Object.fromEntries(pileGroups.value.map(g => [g.key, 0]))
  pileGroups.value.forEach(g => {
    const total = g.products.length
    for (let step = 1; step <= STEPS; step++) {
      setTimeout(() => {
        pileCounts.value[g.key] = Math.round((step / STEPS) * total)
      }, (step / STEPS) * flightMs)
    }
  })
}

// ── FLIP animation ─────────────────────────────────────────────────────────

async function enterGroupView() {
  track('group_feature_used', { grouper: activeGrouper.value.key })
  animating.value = true
  await nextTick()
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))

  const pileRects = {}
  for (const g of activeGrouper.value.groupDefs) {
    const el = document.querySelector(`[data-pile="${g.key}"]`)
    if (el) pileRects[g.key] = el.getBoundingClientRect()
  }

  const placeholderRow = document.querySelector('.pile-anim-row')
  shiftPx.value = placeholderRow ? Math.round(placeholderRow.offsetHeight * 0.5) : 150
  listShifted.value = true
  await sleep(450)

  const rows = Array.from(document.querySelectorAll('[data-product-id]'))
  const allSnapshots = rows
    .map(row => {
      const product = props.products.find(p => String(p.id) === row.dataset.productId)
      if (!product) return null
      const img = row.querySelector('img')
      if (!img) return null
      return { rect: img.getBoundingClientRect(), groupKey: activeGrouper.value.groupFn(product), src: product.Image }
    })
    .filter(s => s && s.rect.width > 0)

  const samples = sampleSnapshots(allSnapshots)

  const flightMs = samples.length > 0 ? (samples.length - 1) * 35 + 800 : 800
  animateCounts(flightMs)

  samples.forEach(({ rect, groupKey, src }, i) => {
    const target = pileRects[groupKey]
    if (!target) return
    const ghost = spawnGhost(rect, src)
    const dx = target.left + target.width  / 2 - (rect.left + rect.width  / 2)
    const dy = target.top  + target.height / 2 - (rect.top  + rect.height / 2)
    const delay = i * 35
    requestAnimationFrame(() => {
      ghost.getBoundingClientRect()
      requestAnimationFrame(() => {
        ghost.style.transition = `transform 0.7s cubic-bezier(0.4,0,0.6,1) ${delay}ms, opacity 0.2s ease ${delay + 500}ms`
        ghost.style.transform  = `translate(${dx}px,${dy}px) scale(1.8)`
        ghost.style.opacity    = '0'
        setTimeout(() => ghost.remove(), 800 + delay)
      })
    })
  })

  // Wait for icons to land, then fade the list out before switching to grouped state
  await sleep(flightMs)
  if (listRef.value) {
    listRef.value.style.transition = 'opacity 0.3s ease'
    listRef.value.style.opacity = '0'
  }
  await sleep(320)

  animating.value   = false
  listShifted.value = false
  grouped.value     = true
}

async function exitGroupView() {
  expandedKey.value    = null
  subExpandedKey.value = null

  const pileRects = {}
  for (const g of pileGroups.value) {
    const el = document.querySelector(`[data-pile="${g.key}"]`)
    if (el) pileRects[g.key] = el.getBoundingClientRect()
  }
  const pileRow = document.querySelector('.pile-anim-row')
  shiftPx.value = pileRow ? Math.round(pileRow.offsetHeight * 0.5) : 150
  listShifted.value = true
  exitAnimating.value = true

  await nextTick()
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))

  if (listRef.value) {
    listRef.value.style.transition = ''
    listRef.value.style.opacity = '0'
  }

  const rows = Array.from(document.querySelectorAll('[data-product-id]'))
  const allSnapshots = rows
    .map(row => {
      const product = props.products.find(p => String(p.id) === row.dataset.productId)
      if (!product) return null
      const img = row.querySelector('img')
      if (!img) return null
      return { rect: img.getBoundingClientRect(), groupKey: activeGrouper.value.groupFn(product), src: product.Image }
    })
    .filter(s => s && s.rect.width > 0)

  const samples = sampleSnapshots(allSnapshots)

  samples.forEach(({ rect, groupKey, src }, i) => {
    const pileRect = pileRects[groupKey]
    if (!pileRect) return
    const delay = i * 35
    const dx = pileRect.left + pileRect.width  / 2 - (rect.left + rect.width  / 2)
    const dy = pileRect.top  + pileRect.height / 2 - (rect.top  + rect.height / 2)
    const ghost = spawnGhost(rect, src, `transform:translate(${dx}px,${dy}px) scale(1.8);opacity:1;`)
    requestAnimationFrame(() => {
      ghost.getBoundingClientRect()
      requestAnimationFrame(() => {
        ghost.style.transition = `transform 0.7s cubic-bezier(0.4,0,0.6,1) ${delay}ms`
        ghost.style.transform  = 'translate(0,0) scale(1)'
        setTimeout(() => {
          ghost.style.transition = 'opacity 0.2s ease'
          ghost.style.opacity = '0'
          setTimeout(() => ghost.remove(), 200)
        }, delay + 700)
      })
    })
  })

  // Collapse piles at the same time as ghosts fly
  pilesCollapsing.value = true

  await sleep(200)
  listShifted.value = false

  const lastDelay = samples.length > 0 ? (samples.length - 1) * 35 : 0
  await sleep(lastDelay + 700)

  if (listRef.value) {
    listRef.value.style.transition = 'opacity 0.3s ease'
    listRef.value.style.opacity = '1'
  }
  await sleep(320)

  exitAnimating.value   = false
  grouped.value         = false
  pilesCollapsing.value = false
  activeGrouperKey.value = null
}
</script>

<template>
  <div>
    <!-- Breadcrumb when drilled in -->
    <div v-if="grouped && expandedKey" class="flex items-center gap-1.5 font-black text-gray-400 text-sm mb-3">
      <button
        @click="expandedKey = null; subExpandedKey = null"
        class="hover:text-gray-700 transition-colors"
      >All piles</button>
      <span>›</span>
      <button
        v-if="subExpandedKey"
        @click="subExpandedKey = null"
        class="hover:text-gray-700 transition-colors"
      >{{ expandedLabel }}</button>
      <span v-else class="text-gray-700">{{ expandedLabel }}</span>
      <template v-if="subExpandedKey">
        <span>›</span>
        <span class="text-gray-700">{{ subExpandedLabel }}</span>
      </template>
    </div>


    <!-- Level-1 pile cards — shown during animation and while grouped (at top level) -->
    <div
      v-if="(animating || grouped || exitAnimating) && !expandedKey"
      class="pile-anim-row"
      :style="pilesCollapsing ? { transform: 'translateY(-24px)', opacity: '0', transition: 'transform 0.35s ease, opacity 0.35s ease', pointerEvents: 'none' } : {}"
    >
      <div
        v-for="(g, i) in pileGroups"
        :key="g.key"
        :data-pile="g.key"
        class="ph-card"
        :class="{ 'ph-card--active': grouped }"
        :style="`--i:${i}`"
        @click="grouped ? (session.reportJourney('group', `Drilled into ${g.label}`), expandedKey = g.key, subExpandedKey = null) : undefined"
      >
        <div class="ph-back ph-back-2" :style="{ background: g.bg }">
          <img v-if="g.products[2]?.Image" :src="g.products[2].Image" class="ph-back-img" />
        </div>
        <div class="ph-back ph-back-1" :style="{ background: g.bg }">
          <img v-if="g.products[1]?.Image" :src="g.products[1].Image" class="ph-back-img" />
        </div>
        <div class="ph-front" :style="{ background: g.bg }">
          <div class="ph-image">
            <img v-if="g.products[0]?.Image" :src="g.products[0].Image" :alt="g.label" />
            <span v-else class="text-5xl">🌿</span>
          </div>
          <div class="ph-info">
            <p class="ph-label">{{ g.label }}</p>
            <p class="ph-sub" :style="{ color: g.accent }">{{ g.sub }}</p>
            <p v-if="grouped" class="ph-hint">Tap to browse →</p>
          </div>
        </div>
        <div
          v-if="animating ? pileCounts[g.key] > 0 : true"
          class="ph-badge"
          :key="g.key"
          :style="{ background: g.accent }"
        >{{ animating ? pileCounts[g.key] : g.products.length }}</div>
      </div>
    </div>

    <!-- Level-2 sub-pile cards — shown when a level-1 pile is tapped and count > threshold -->
    <div v-else-if="showSubPiles" class="pile-anim-row">
      <div
        v-for="(g, i) in subPileGroups"
        :key="g.key"
        class="ph-card ph-card--active"
        :style="`--i:${i}`"
        @click="session.reportJourney('group', `Drilled into ${g.label}`); subExpandedKey = g.key"
      >
        <div class="ph-back ph-back-2" :style="{ background: g.bg }">
          <img v-if="g.products[2]?.Image" :src="g.products[2].Image" class="ph-back-img" />
        </div>
        <div class="ph-back ph-back-1" :style="{ background: g.bg }">
          <img v-if="g.products[1]?.Image" :src="g.products[1].Image" class="ph-back-img" />
        </div>
        <div class="ph-front" :style="{ background: g.bg }">
          <div class="ph-image">
            <img v-if="g.products[0]?.Image" :src="g.products[0].Image" :alt="g.label" />
            <span v-else class="text-5xl">🌿</span>
          </div>
          <div class="ph-info">
            <p class="ph-label">{{ g.label }}</p>
            <p class="ph-sub" :style="{ color: g.accent }">{{ g.sub }}</p>
            <p class="ph-hint">Tap to browse →</p>
          </div>
        </div>
        <div class="ph-badge" :style="{ background: g.accent }">{{ g.products.length }}</div>
      </div>
    </div>

    <!-- Product cards — shown when count is low enough (or at deepest drill level) -->
    <TransitionGroup
      v-else-if="showCards"
      tag="div"
      name="card"
      class="grid grid-cols-4 gap-4 mt-2 relative"
      @leave="onCardLeave"
    >
      <div
        v-for="(p, i) in cardProducts"
        :key="p.id"
        :style="`--card-i:${i}`"
        class="rounded-xl border border-gray-200 bg-white overflow-hidden flex flex-col cursor-pointer active:opacity-75 transition-opacity"
        @click="modalProduct = p"
      >
        <!-- Image -->
        <div class="aspect-square bg-gray-100 overflow-hidden">
          <img v-if="p.Image" :src="p.Image" :alt="p.Name" class="w-full h-full object-cover" />
          <div v-else class="w-full h-full flex items-center justify-center text-gray-300 text-4xl">🌿</div>
        </div>

        <!-- Info -->
        <div class="p-3 flex flex-col gap-1 flex-1">
          <p class="font-bold text-sm leading-tight line-clamp-2" :class="{ 'deal-glow': bundlesEnabled && activeBundlesForProduct(p).length }">{{ p.Name }}</p>

          <div class="flex flex-wrap gap-1 mt-0.5">
            <span
              v-if="p.StaffPick"
              class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-yellow-100 border border-yellow-300 text-yellow-700 text-xs font-bold leading-none"
            >⭐ Staff Pick</span>
            <span
              v-if="p.CBD"
              class="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold leading-none"
            >CBD</span>
            <span
              v-if="p.Cannabinoids?.some(c => c.name === 'CBN')"
              class="inline-flex items-center px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold leading-none"
            >CBN</span>
            <span
              v-if="p.HighCBG"
              class="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold leading-none"
            >CBG</span>
          </div>

          <div class="flex items-center gap-1.5 flex-wrap mt-0.5">
            <span
              v-if="p.Strain"
              class="text-xs font-semibold px-1.5 py-0.5 rounded-full"
              :class="strainColor(p.Strain)"
            >{{ strainLabel(p.Strain) }}</span>
            <span
              v-if="p['Unit Weight']"
              class="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500"
            >{{ p['Unit Weight'] }}</span>
          </div>

          <!-- Potency -->
          <div v-if="getPotencyLevel(p)" class="flex items-center gap-1.5 mt-1">
            <div class="flex gap-0.5">
              <div
                v-for="n in 4" :key="n"
                class="w-2 h-2 rounded-full"
                :class="n <= getPotencyLevel(p).dots ? getPotencyLevel(p).color : 'bg-gray-200'"
              />
            </div>
            <span class="text-xs text-gray-500">{{ getPotencyLevel(p).label }}</span>
            <span v-if="p.Potency != null" class="text-xs font-semibold text-gray-600 tabular-nums">· {{ perItemPotency(p) }}{{ p['Potency Unit'] }}</span>
          </div>

          <!-- Price + cart -->
          <div class="flex items-center justify-between mt-auto pt-2">
            <div class="flex flex-col leading-tight">
              <span class="text-teal-600 font-black text-sm">{{ displayPrice(p) }}</span>
              <span v-if="perUnitLabel(p)" class="text-gray-400 text-xs">{{ perUnitLabel(p) }}</span>
            </div>
            <div v-if="qty(p.id) > 0" class="flex items-center gap-1.5">
              <button
                @click.stop="removeFromCart(p)"
                class="w-7 h-7 rounded-full bg-gray-100 text-gray-700 font-black flex items-center justify-center active:bg-gray-200 transition-colors text-lg leading-none"
              >−</button>
              <span class="font-bold text-sm tabular-nums">{{ qty(p.id) }}</span>
              <button
                @click.stop="addToCart(p, $event)"
                class="w-7 h-7 rounded-full bg-teal-500 text-white font-black flex items-center justify-center active:bg-teal-400 transition-colors text-lg leading-none"
              >+</button>
            </div>
            <button
              v-else
              @click.stop="addToCart(p, $event)"
              class="w-7 h-7 rounded-full bg-teal-500 text-white font-black flex items-center justify-center active:bg-teal-400 transition-colors text-lg leading-none"
            >+</button>
          </div>
        </div>
      </div>
    </TransitionGroup>

    <!-- List during enter/exit animation (shifted) -->
    <div
      v-if="animating || exitAnimating"
      ref="listRef"
      :style="{
        transform: listShifted ? `translateY(${shiftPx}px)` : 'translateY(0)',
        transition: 'transform 0.45s cubic-bezier(0.4,0,0.2,1)',
      }"
    >
      <ProductTable :products="products" :columns="columns" :sortable="sortable" />
    </div>

    <!-- Normal list -->
    <ProductTable
      v-else-if="!grouped && !exitAnimating"
      :products="products"
      :columns="columns"
      :sortable="sortable"
    />
  </div>

  <ProductModal
    v-if="modalProduct"
    :product="modalProduct"
    @close="modalProduct = null"
  />
</template>

<style scoped>
.pile-anim-row {
  display: flex;
  gap: 40px;
  justify-content: center;
  align-items: flex-start;
  flex-wrap: wrap;
  padding: 48px 0;
}

.ph-card {
  position: relative;
  width: 180px;
  height: 228px;
  animation: ph-in 0.35s cubic-bezier(0.34, 1.4, 0.64, 1) both;
  animation-delay: calc(var(--i) * 70ms);
}
.ph-card--active {
  cursor: pointer;
  transition: transform 0.12s ease;
}
.ph-card--active:active { transform: scale(0.95); }

@keyframes ph-in {
  from { opacity: 0; transform: translateY(-20px) scale(0.9); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

.ph-back {
  position: absolute;
  inset: 0;
  border-radius: 16px;
  overflow: hidden;
}
.ph-back-2 { transform: rotate(-5deg) translate(-6px, 10px); filter: brightness(0.5); }
.ph-back-1 { transform: rotate(-2.5deg) translate(-3px, 5px); filter: brightness(0.7); }
.ph-back-img { width: 100%; height: 100%; object-fit: cover; }

.ph-front {
  position: absolute;
  inset: 0;
  border-radius: 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.ph-image {
  flex: 1;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}
.ph-image img { width: 100%; height: 100%; object-fit: cover; }
.ph-info    { padding: 12px 12px 10px; }
.ph-label   { font-weight: 900; font-size: 17px; line-height: 1; color: white; }
.ph-sub     { font-size: 11px; margin-top: 3px; }
.ph-hint    { font-size: 10px; color: rgba(255,255,255,0.35); margin-top: 5px; }

.ph-badge {
  position: absolute;
  top: -10px; right: -10px;
  width: 32px; height: 32px;
  border-radius: 50%;
  color: white;
  font-weight: 900;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.4);
  animation: badge-pop 0.3s cubic-bezier(0.34, 1.6, 0.64, 1);
}
@keyframes badge-pop {
  from { transform: scale(0.4); }
  to   { transform: scale(1); }
}

/* Product card TransitionGroup */
.card-move {
  transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}
.card-enter-active {
  transition:
    opacity    0.3s ease                   calc(var(--card-i, 0) * 45ms),
    transform  0.35s cubic-bezier(0.34, 1.3, 0.64, 1) calc(var(--card-i, 0) * 45ms);
}
.card-leave-active {
  transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.4, 0, 1, 1);
}
.card-enter-from {
  opacity: 0;
  transform: translateY(18px) scale(0.92);
}
.card-leave-to {
  opacity: 0;
  transform: translateY(-16px) scale(0.88);
}
</style>
