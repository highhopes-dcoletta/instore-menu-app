<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  products: { type: Array, required: true },
})

const emit = defineEmits(['select'])

// Layout constants
const W = 800, H = 500
const PAD = { top: 20, right: 20, bottom: 50, left: 60 }

// Magnifier lens
const LENS_R = 150        // radius of the lens circle (SVG units)
const ZOOM = 6            // magnification factor
const LENS_OFFSET_Y = -180 // lens center above finger
const PICKUP_R = LENS_R / ZOOM  // chart-space radius to gather nearby dots

const CATEGORY_COLORS = {
  FLOWER: '#22c55e',
  PRE_ROLLS: '#f59e0b',
  VAPORIZERS: '#3b82f6',
  CONCENTRATES: '#a855f7',
}
const DEFAULT_COLOR = '#6b7280'

// Simple hash for deterministic jitter
function hash(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

// Generate ~5-8 nice round tick values spanning [min, max]
function niceTicks(min, max) {
  const range = max - min
  if (range <= 0) return [min]
  const rough = range / 6
  const mag = Math.pow(10, Math.floor(Math.log10(rough)))
  const nice = [1, 2, 5, 10].map(m => m * mag).find(s => range / s <= 8) || mag * 10
  const start = Math.ceil(min / nice) * nice
  const ticks = []
  for (let v = start; v <= max; v += nice) {
    ticks.push(Math.round(v * 1e6) / 1e6)
  }
  return ticks
}

const extents = computed(() => {
  const ps = props.products
  if (!ps.length) return { minX: 0, maxX: 100, minY: 0, maxY: 40 }
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const p of ps) {
    if (p.Price < minX) minX = p.Price
    if (p.Price > maxX) maxX = p.Price
    if (p.Potency < minY) minY = p.Potency
    if (p.Potency > maxY) maxY = p.Potency
  }
  const dx = (maxX - minX) || 5
  const dy = (maxY - minY) || 2
  return {
    minX: Math.max(0, minX - dx * 0.1),
    maxX: maxX + dx * 0.1,
    minY: Math.max(0, minY - dy * 0.1),
    maxY: maxY + dy * 0.1,
  }
})

function scaleX(price) {
  const { minX, maxX } = extents.value
  const range = maxX - minX || 1
  return PAD.left + ((price - minX) / range) * (W - PAD.left - PAD.right)
}

function scaleY(potency) {
  const { minY, maxY } = extents.value
  const range = maxY - minY || 1
  return PAD.top + (1 - (potency - minY) / range) * (H - PAD.top - PAD.bottom)
}

const xTicks = computed(() => niceTicks(extents.value.minX, extents.value.maxX))
const yTicks = computed(() => niceTicks(extents.value.minY, extents.value.maxY))

const dots = computed(() =>
  props.products.map(p => {
    const h = hash(String(p.id))
    const jx = ((h % 100) / 100 - 0.5) * 6
    const jy = (((h >> 8) % 100) / 100 - 0.5) * 6
    return {
      product: p,
      cx: scaleX(p.Price) + jx,
      cy: scaleY(p.Potency) + jy,
      color: CATEGORY_COLORS[p.Category] || DEFAULT_COLOR,
    }
  })
)

const legendItems = computed(() => {
  const seen = new Set()
  const items = []
  for (const p of props.products) {
    if (!seen.has(p.Category)) {
      seen.add(p.Category)
      items.push({
        category: p.Category,
        color: CATEGORY_COLORS[p.Category] || DEFAULT_COLOR,
        label: p.Category.replace(/_/g, ' '),
      })
    }
  }
  return items
})

// ── Magnifier state ──────────────────────────────────────────────────────────
const svgEl = ref(null)
const touch = ref(null)  // { x, y } in SVG coords, or null
const dragged = ref(false)
const downPt = ref(null)
const TAP_THRESHOLD = 6  // SVG units — movement below this counts as a tap

function screenToSvg(screenX, screenY) {
  const svg = svgEl.value
  if (!svg) return null
  const ctm = svg.getScreenCTM()
  if (!ctm) return null
  const inv = ctm.inverse()
  return {
    x: inv.a * screenX + inv.c * screenY + inv.e,
    y: inv.b * screenX + inv.d * screenY + inv.f,
  }
}

function onPointerDown(e) {
  const pt = screenToSvg(e.clientX, e.clientY)
  if (pt) {
    touch.value = pt
    downPt.value = pt
    dragged.value = false
  }
}
function onPointerMove(e) {
  if (touch.value === null) return
  const pt = screenToSvg(e.clientX, e.clientY)
  if (pt) {
    touch.value = pt
    if (downPt.value) {
      const dx = pt.x - downPt.value.x
      const dy = pt.y - downPt.value.y
      if (dx * dx + dy * dy > TAP_THRESHOLD * TAP_THRESHOLD) {
        dragged.value = true
      }
    }
  }
}
function onPointerUp() {
  if (!touch.value) return
  // Only select on a quick tap, not after dragging
  if (!dragged.value) {
    const nearest = nearestDot.value
    if (nearest) emit('select', nearest.product)
  }
  touch.value = null
  downPt.value = null
}
function onPointerCancel() {
  touch.value = null
  downPt.value = null
}

// Dots within the lens pickup radius
const lensNeighbors = computed(() => {
  if (!touch.value) return []
  const tx = touch.value.x
  const ty = touch.value.y
  const r2 = PICKUP_R * PICKUP_R
  return dots.value.filter(d => {
    const dx = d.cx - tx
    const dy = d.cy - ty
    return dx * dx + dy * dy <= r2
  })
})

// Nearest dot to touch point (for tap-to-select on lift)
const nearestDot = computed(() => {
  if (!touch.value) return null
  const tx = touch.value.x
  const ty = touch.value.y
  let best = null, bestD2 = 18 * 18  // max 18px away (hit area)
  for (const d of dots.value) {
    const dx = d.cx - tx
    const dy = d.cy - ty
    const d2 = dx * dx + dy * dy
    if (d2 < bestD2) { best = d; bestD2 = d2 }
  }
  return best
})

// Lens center position (clamped to keep lens fully inside viewBox)
const lensCenter = computed(() => {
  if (!touch.value) return { x: 0, y: 0 }
  const tx = touch.value.x
  const ty = touch.value.y
  // Default: above finger. If too close to top, show below.
  const above = ty + LENS_OFFSET_Y - LENS_R > 0
  const rawY = above ? ty + LENS_OFFSET_Y : ty - LENS_OFFSET_Y
  return {
    x: Math.max(LENS_R + 2, Math.min(W - LENS_R - 2, tx)),
    y: Math.max(LENS_R + 2, Math.min(H - LENS_R - 2, rawY)),
  }
})

// Map a dot's chart position into lens-local position
function lensX(d) {
  return lensCenter.value.x + (d.cx - touch.value.x) * ZOOM
}
function lensY(d) {
  return lensCenter.value.y + (d.cy - touch.value.y) * ZOOM
}
</script>

<template>
  <div>
    <svg
      ref="svgEl"
      :viewBox="`0 0 ${W} ${H}`"
      class="w-full select-none"
      style="max-height: 70vh; touch-action: none"
      @pointerdown.prevent="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerCancel"
      @pointerleave="onPointerCancel"
    >
      <!-- X axis line -->
      <line
        :x1="PAD.left" :y1="H - PAD.bottom"
        :x2="W - PAD.right" :y2="H - PAD.bottom"
        stroke="#9ca3af" stroke-width="1"
      />
      <!-- Y axis line -->
      <line
        :x1="PAD.left" :y1="PAD.top"
        :x2="PAD.left" :y2="H - PAD.bottom"
        stroke="#9ca3af" stroke-width="1"
      />

      <!-- X ticks + labels -->
      <g v-for="v in xTicks" :key="'x' + v">
        <line :x1="scaleX(v)" :y1="H - PAD.bottom" :x2="scaleX(v)" :y2="H - PAD.bottom + 6" stroke="#9ca3af" />
        <line :x1="scaleX(v)" :y1="PAD.top" :x2="scaleX(v)" :y2="H - PAD.bottom" stroke="#e5e7eb" stroke-width="0.5" />
        <text :x="scaleX(v)" :y="H - PAD.bottom + 20" text-anchor="middle" fill="#6b7280" font-size="12">${{ v }}</text>
      </g>

      <!-- Y ticks + labels -->
      <g v-for="v in yTicks" :key="'y' + v">
        <line :x1="PAD.left - 6" :y1="scaleY(v)" :x2="PAD.left" :y2="scaleY(v)" stroke="#9ca3af" />
        <line :x1="PAD.left" :y1="scaleY(v)" :x2="W - PAD.right" :y2="scaleY(v)" stroke="#e5e7eb" stroke-width="0.5" />
        <text :x="PAD.left - 10" :y="scaleY(v) + 4" text-anchor="end" fill="#6b7280" font-size="12">{{ v }}%</text>
      </g>

      <!-- Axis labels -->
      <text :x="(PAD.left + W - PAD.right) / 2" :y="H - 5" text-anchor="middle" fill="#9ca3af" font-size="13" font-weight="bold">Price</text>
      <text :x="14" :y="(PAD.top + H - PAD.bottom) / 2" text-anchor="middle" fill="#9ca3af" font-size="13" font-weight="bold" transform-origin="14 260" transform="rotate(-90, 14, 260)">THC %</text>

      <!-- Product dots (no labels — the lens shows them) -->
      <g v-for="d in dots" :key="d.product.id">
        <circle
          :cx="d.cx" :cy="d.cy" r="6"
          :fill="d.color"
          fill-opacity="0.75"
          :stroke="d.color"
          stroke-width="1.5"
          stroke-opacity="0.9"
          style="pointer-events: none"
        />
      </g>

      <!-- Crosshair at touch point -->
      <g v-if="touch" style="pointer-events: none">
        <line :x1="touch.x - 10" :y1="touch.y" :x2="touch.x + 10" :y2="touch.y" stroke="#9ca3af" stroke-width="0.75" />
        <line :x1="touch.x" :y1="touch.y - 10" :x2="touch.x" :y2="touch.y + 10" stroke="#9ca3af" stroke-width="0.75" />
      </g>

      <!-- Magnifier lens -->
      <g v-if="touch" style="pointer-events: none">
        <defs>
          <clipPath id="lens-clip">
            <circle :cx="lensCenter.x" :cy="lensCenter.y" :r="LENS_R" />
          </clipPath>
        </defs>

        <!-- Lens background -->
        <circle :cx="lensCenter.x" :cy="lensCenter.y" :r="LENS_R" fill="white" stroke="#d1d5db" stroke-width="2" />

        <!-- Zoomed dots + labels, clipped to lens -->
        <g clip-path="url(#lens-clip)">
          <g v-for="d in lensNeighbors" :key="'lens-' + d.product.id">
            <circle
              :cx="lensX(d)" :cy="lensY(d)" r="10"
              :fill="d.color" fill-opacity="0.8"
              :stroke="d.color" stroke-width="2" stroke-opacity="0.9"
            />
            <text
              :x="lensX(d) + 16" :y="lensY(d) - 2"
              text-anchor="start" fill="#1f2937" font-size="9" font-weight="600"
            >{{ d.product.Name }}</text>
            <text
              :x="lensX(d) + 16" :y="lensY(d) + 9"
              text-anchor="start" fill="#6b7280" font-size="8"
            >${{ Number(d.product.Price).toFixed(2) }} · {{ d.product.Potency }}%</text>
          </g>
        </g>

        <!-- Lens border (on top) -->
        <circle :cx="lensCenter.x" :cy="lensCenter.y" :r="LENS_R" fill="none" stroke="#9ca3af" stroke-width="2.5" />

        <!-- Line from touch point to lens -->
        <line
          :x1="touch.x" :y1="touch.y"
          :x2="lensCenter.x" :y2="lensCenter.y > touch.y ? lensCenter.y - LENS_R : lensCenter.y + LENS_R"
          stroke="#9ca3af" stroke-width="1" stroke-dasharray="4 3"
        />
      </g>
    </svg>

    <!-- Hint text -->
    <p v-if="!touch" class="text-xs text-gray-400 text-center mt-1">Touch and drag to magnify</p>

    <!-- Legend -->
    <div class="flex flex-wrap gap-4 justify-center mt-2 text-sm text-gray-600">
      <span v-for="item in legendItems" :key="item.category" class="flex items-center gap-1.5">
        <span class="inline-block w-3 h-3 rounded-full" :style="{ backgroundColor: item.color }"></span>
        {{ item.label }}
      </span>
    </div>
  </div>
</template>
