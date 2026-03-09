<script setup>
import { ref, computed, nextTick } from 'vue'
import { useProductFilters } from '@/composables/useProductFilters'
import { GROUPERS, computeGroups } from '@/composables/useProductGrouping'
import FilterPanel from '@/components/FilterPanel.vue'
import ProductControls from '@/components/ProductControls.vue'
import ProductTable from '@/components/ProductTable.vue'

const { filtered, categoryProducts, facets } = useProductFilters((p) => p.Category === 'FLOWER')

// ── Grouping ──────────────────────────────────────────────────────────────────

const grouped          = ref(false)
const expandedKey      = ref(null)
const activeGrouperKey = ref('potency')

const activeGrouper = computed(
  () => GROUPERS.find(g => g.key === activeGrouperKey.value) ?? GROUPERS[0]
)
const pileGroups = computed(
  () => computeGroups(activeGrouper.value, filtered.value)
)
const expandedLabel = computed(
  () => pileGroups.value.find(g => g.key === expandedKey.value)?.label ?? ''
)
const expandedProducts = computed(() =>
  expandedKey.value
    ? filtered.value.filter(p => activeGrouper.value.groupFn(p) === expandedKey.value)
    : filtered.value
)

// ── Animation state ───────────────────────────────────────────────────────────

const animating   = ref(false)
const listShifted = ref(false)
const shiftPx     = ref(0)
const pileCounts  = ref({})

const sleep = ms => new Promise(r => setTimeout(r, ms))

// ── FLIP animation ────────────────────────────────────────────────────────────

async function enterGroupView() {
  // Step 1 — render pile placeholders, measure their positions
  animating.value = true
  await nextTick()
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))

  const pileRects = {}
  for (const g of activeGrouper.value.groupDefs) {
    const el = document.querySelector(`[data-pile="${g.key}"]`)
    if (el) pileRects[g.key] = el.getBoundingClientRect()
  }

  // Step 2 — measure placeholder row height, slide list down
  const placeholderRow = document.querySelector('.pile-anim-row')
  shiftPx.value = placeholderRow ? Math.round(placeholderRow.offsetHeight * 0.5) : 150
  listShifted.value = true
  await sleep(450)

  // Step 3 — capture thumbnail positions after the list has settled, then fly
  const rows = Array.from(document.querySelectorAll('[data-product-id]'))
  const snapshots = rows
    .map(row => {
      const product = filtered.value.find(p => String(p.id) === row.dataset.productId)
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

  // Init pile counts to 0 for badge animation
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

    // Fade out the row as its icon starts flying
    setTimeout(() => {
      row.style.transition = 'opacity 0.3s ease'
      row.style.opacity = '0'
    }, delay)

    // Increment badge count when icon lands
    setTimeout(() => {
      if (pileCounts.value[groupKey] !== undefined) pileCounts.value[groupKey]++
    }, delay + 700)

    requestAnimationFrame(() => {
      ghost.getBoundingClientRect()
      requestAnimationFrame(() => {
        ghost.style.transition = `transform 0.7s cubic-bezier(0.4,0,0.6,1) ${delay}ms, opacity 0.2s ease ${delay + 500}ms`
        ghost.style.transform  = `translate(${dx}px,${dy}px) scale(0.15)`
        ghost.style.opacity    = '0'
        setTimeout(() => ghost.remove(), 800 + delay)
      })
    })
  })

  // Step 4 — wait for last icon to land, then drop the list and go interactive
  // Pile cards stay in place — no component swap, no flash
  const lastDelay = Math.min((snapshots.length - 1) * 15, 500)
  await sleep(lastDelay + 800)

  animating.value   = false
  listShifted.value = false
  grouped.value     = true
}

function exitGroupView() {
  expandedKey.value = null
  grouped.value     = false
}
</script>

<template>
  <main class="flex gap-8 p-6">
    <div class="flex-1 min-w-0">

      <!-- Header -->
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-3">
          <h1 class="text-2xl font-black tracking-wide">Flower</h1>
          <span v-if="expandedKey" class="text-2xl font-black text-gray-400">· {{ expandedLabel }}</span>
        </div>

        <div class="flex items-center gap-2">
          <template v-if="grouped && !expandedKey">
            <button
              v-for="g in GROUPERS" :key="g.key"
              @click="activeGrouperKey = g.key; expandedKey = null"
              class="px-3 py-1.5 rounded-lg text-sm font-bold transition-colors"
              :class="activeGrouperKey === g.key
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
            v-if="!animating"
            @click="grouped ? exitGroupView() : enterGroupView()"
            class="px-4 py-2 rounded-xl text-sm font-bold transition-colors"
            :class="grouped
              ? 'bg-gray-100 text-gray-700 active:bg-gray-200'
              : 'bg-gray-800 text-white active:bg-teal-700'"
          >{{ grouped ? '☰ Show list' : '🃏 Group' }}</button>
        </div>
      </div>

      <!-- ① & ③ Pile cards — shown during animation AND as the final pile view -->
      <!--     Same DOM, no swap → no flash                                      -->
      <div v-if="(animating || grouped) && !expandedKey" class="pile-anim-row">
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

      <!-- ② List (slides down during animation) -->
      <div
        v-if="animating"
        :style="{
          transform: listShifted ? `translateY(${shiftPx}px)` : 'translateY(0)',
          transition: 'transform 0.45s cubic-bezier(0.4,0,0.2,1)',
        }"
      >
        <ProductTable :products="filtered" />
      </div>

      <!-- ② Normal list (no animation, not grouped) -->
      <template v-else-if="!grouped && !expandedKey">
        <ProductControls />
        <ProductTable :products="filtered" />
      </template>

      <!-- ④ Expanded pile → filtered list -->
      <ProductTable v-else-if="expandedKey" :products="expandedProducts" />

    </div>
    <aside class="w-40 shrink-0 pt-14">
      <FilterPanel :filters="['brand', 'strain', 'size', 'preground']" :products="categoryProducts" :facets="facets" />
    </aside>
  </main>
</template>

<style scoped>
/* ── Pile card row ────────────────────────────────────────────────────────── */
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
