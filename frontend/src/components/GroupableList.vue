<script setup>
import { ref, computed, nextTick } from 'vue'
import { GROUPERS, computeGroups } from '@/composables/useProductGrouping'
import ProductTable from './ProductTable.vue'

const props = defineProps({
  products: { type: Array, required: true },
  columns:  { type: Array, default: () => ['name', 'strain', 'potency', 'price', 'stock'] },
  sortable: { type: Boolean, default: true },
  // subset of grouper keys to offer; defaults to all
  groupers: { type: Array, default: () => GROUPERS.map(g => g.key) },
})

// ── Grouping ───────────────────────────────────────────────────────────────

const grouped          = ref(false)
const expandedKey      = ref(null)
const activeGrouperKey = ref(null)

const availableGroupers = computed(() =>
  GROUPERS.filter(g => props.groupers.includes(g.key))
)
const activeGrouper = computed(() =>
  availableGroupers.value.find(g => g.key === activeGrouperKey.value)
  ?? availableGroupers.value[0]
)
const pileGroups = computed(() => computeGroups(activeGrouper.value, props.products))
const expandedLabel = computed(
  () => pileGroups.value.find(g => g.key === expandedKey.value)?.label ?? ''
)
const expandedProducts = computed(() =>
  expandedKey.value
    ? props.products.filter(p => activeGrouper.value.groupFn(p) === expandedKey.value)
    : props.products
)

// ── Animation state ────────────────────────────────────────────────────────

const animating     = ref(false)
const exitAnimating = ref(false)
const listShifted   = ref(false)
const shiftPx       = ref(0)
const pileCounts    = ref({})

const sleep = ms => new Promise(r => setTimeout(r, ms))

// ── FLIP animation ─────────────────────────────────────────────────────────

async function enterGroupView() {
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
  const snapshots = rows
    .map(row => {
      const product = props.products.find(p => String(p.id) === row.dataset.productId)
      if (!product) return null
      const img = row.querySelector('img')
      if (!img) return null
      return {
        rect:     img.getBoundingClientRect(),
        groupKey: activeGrouper.value.groupFn(product),
        src:      product.Image,
        row,
      }
    })
    .filter(s => s && s.rect.width > 0)

  pileCounts.value = Object.fromEntries(pileGroups.value.map(g => [g.key, 0]))

  snapshots.forEach(({ rect, groupKey, src, row }, i) => {
    const target = pileRects[groupKey]
    if (!target) return

    const ghost = document.createElement('div')
    ghost.style.cssText = `
      position:fixed;
      left:${rect.left}px; top:${rect.top}px;
      width:${rect.width}px; height:${rect.height}px;
      background-image:url(${src}); background-size:cover; background-color:#d1fae5;
      border-radius:8px; box-shadow:0 2px 8px rgba(0,0,0,0.3);
      pointer-events:none; z-index:200;
    `
    document.body.appendChild(ghost)

    const dx = target.left + target.width  / 2 - (rect.left + rect.width  / 2)
    const dy = target.top  + target.height / 2 - (rect.top  + rect.height / 2)
    const delay = Math.min(i * 15, 500)

    setTimeout(() => {
      row.style.transition = 'opacity 0.3s ease'
      row.style.opacity = '0'
    }, delay)

    setTimeout(() => {
      if (pileCounts.value[groupKey] !== undefined) pileCounts.value[groupKey]++
    }, delay + 700)

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

  const lastDelay = Math.min((snapshots.length - 1) * 15, 500)
  await sleep(lastDelay + 800)

  animating.value   = false
  listShifted.value = false
  grouped.value     = true
}

async function exitGroupView() {
  expandedKey.value = null

  // Capture pile positions and shift amount before any state changes
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

  // Hide all rows before we start flying
  const rows = Array.from(document.querySelectorAll('[data-product-id]'))
  rows.forEach(row => { row.style.opacity = '0'; row.style.transition = '' })

  const snapshots = rows
    .map(row => {
      const product = props.products.find(p => String(p.id) === row.dataset.productId)
      if (!product) return null
      const img = row.querySelector('img')
      if (!img) return null
      return {
        rect:     img.getBoundingClientRect(),
        groupKey: activeGrouper.value.groupFn(product),
        src:      product.Image,
        row,
      }
    })
    .filter(s => s && s.rect.width > 0)

  // Fly each icon from its pile back to its row
  snapshots.forEach(({ rect, groupKey, src, row }, i) => {
    const pileRect = pileRects[groupKey]
    if (!pileRect) return

    const delay = Math.min(i * 15, 500)
    const dx = pileRect.left + pileRect.width  / 2 - (rect.left + rect.width  / 2)
    const dy = pileRect.top  + pileRect.height / 2 - (rect.top  + rect.height / 2)

    // Ghost starts at pile center (large), flies back to row (normal size)
    const ghost = document.createElement('div')
    ghost.style.cssText = `
      position:fixed;
      left:${rect.left}px; top:${rect.top}px;
      width:${rect.width}px; height:${rect.height}px;
      background-image:url(${src}); background-size:cover; background-color:#d1fae5;
      border-radius:8px; box-shadow:0 2px 8px rgba(0,0,0,0.3);
      pointer-events:none; z-index:200;
      transform: translate(${dx}px,${dy}px) scale(1.8);
      opacity: 1;
    `
    document.body.appendChild(ghost)

    requestAnimationFrame(() => {
      ghost.getBoundingClientRect()
      requestAnimationFrame(() => {
        ghost.style.transition = `transform 0.7s cubic-bezier(0.4,0,0.6,1) ${delay}ms`
        ghost.style.transform  = `translate(0,0) scale(1)`

        // When icon lands: fade row in, fade ghost out
        setTimeout(() => {
          row.style.transition = 'opacity 0.3s ease'
          row.style.opacity = '1'
          ghost.style.transition = 'opacity 0.2s ease'
          ghost.style.opacity = '0'
          setTimeout(() => ghost.remove(), 200)
        }, delay + 700)
      })
    })
  })

  // Slide list back up
  await sleep(200)
  listShifted.value = false

  // Wait for last icon to land, then clean up
  const lastDelay = Math.min((snapshots.length - 1) * 15, 500)
  await sleep(lastDelay + 800)

  exitAnimating.value = false
  grouped.value       = false
}
</script>

<template>
  <div>
    <!-- Controls bar -->
    <div class="flex items-center gap-2 justify-end mb-3">
      <span
        v-if="grouped && expandedKey"
        class="mr-auto text-lg font-black text-gray-400"
      >· {{ expandedLabel }}</span>

      <template v-if="grouped && !expandedKey">
        <button
          v-for="g in availableGroupers" :key="g.key"
          @click="activeGrouperKey = g.key; expandedKey = null"
          class="px-3 py-1.5 rounded-lg text-sm font-bold transition-colors"
          :class="activeGrouper.key === g.key
            ? 'bg-teal-600 text-white'
            : 'bg-gray-100 text-gray-600 active:bg-gray-200'"
        >{{ g.icon }} {{ g.label }}</button>
      </template>

      <button
        v-if="expandedKey"
        @click="expandedKey = null"
        class="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 text-sm font-bold active:bg-gray-200 transition-colors"
      >← All piles</button>

      <button
        v-if="!animating && !exitAnimating"
        @click="grouped ? exitGroupView() : enterGroupView()"
        class="px-4 py-2 rounded-xl text-sm font-bold transition-colors"
        :class="grouped
          ? 'bg-gray-100 text-gray-700 active:bg-gray-200'
          : 'bg-gray-800 text-white active:bg-teal-700'"
      >{{ grouped ? '☰ Show list' : '🃏 Group' }}</button>
    </div>

    <!-- Pile cards — shown during enter/exit animation and while grouped -->
    <div v-if="(animating || grouped || exitAnimating) && !expandedKey" class="pile-anim-row">
      <div
        v-for="(g, i) in pileGroups"
        :key="g.key"
        :data-pile="g.key"
        class="ph-card"
        :class="{ 'ph-card--active': grouped }"
        :style="`--i:${i}`"
        @click="grouped ? expandedKey = g.key : undefined"
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
          :key="animating ? pileCounts[g.key] : g.key"
          :style="{ background: g.accent }"
        >{{ animating ? pileCounts[g.key] : g.products.length }}</div>
      </div>
    </div>

    <!-- List during enter/exit animation (shifted) -->
    <div
      v-if="animating || exitAnimating"
      :style="{
        transform: listShifted ? `translateY(${shiftPx}px)` : 'translateY(0)',
        transition: 'transform 0.45s cubic-bezier(0.4,0,0.2,1)',
      }"
    >
      <ProductTable :products="products" :columns="columns" :sortable="sortable" />
    </div>

    <!-- Normal list -->
    <ProductTable
      v-else-if="!grouped && !expandedKey && !exitAnimating"
      :products="products"
      :columns="columns"
      :sortable="sortable"
    />

    <!-- Expanded pile list -->
    <ProductTable
      v-else-if="expandedKey"
      :products="expandedProducts"
      :columns="columns"
      :sortable="sortable"
    />
  </div>
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
</style>
