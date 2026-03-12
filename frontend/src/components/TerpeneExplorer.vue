<script setup>
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import ProductModal from '@/components/ProductModal.vue'

const props = defineProps({
  products: { type: Array, required: true },
})

const TERP_COLORS = [
  '#ff006e', '#fb5607', '#ffbe0b', '#06d6a0', '#118ab2',
  '#8338ec', '#ff595e', '#1982c4', '#6a4c93', '#43aa8b',
  '#f72585', '#4cc9f0', '#7209b7', '#f77f00', '#80ed99',
  '#e63946', '#457b9d', '#2a9d8f', '#e9c46a', '#264653',
  '#d62828', '#023e8a',
]

// ── Deduplicate variants into unique products ────────────────────────────────
// Each "unique product" has all size variants grouped together
const uniqueProducts = computed(() => {
  const map = new Map()
  for (const p of props.products) {
    const key = `${p.Name}|||${p.Brand}`
    if (!map.has(key)) {
      map.set(key, { ...p, variants: [] })
    }
    map.get(key).variants.push(p)
  }
  return [...map.values()]
})

// ── Build terpene groups (using deduplicated products) ───────────────────────
const terpeneGroups = computed(() => {
  const map = new Map()
  for (const p of uniqueProducts.value) {
    if (!p.Terpenes?.length) continue
    const dominant = p.Terpenes.reduce((a, b) => a.value > b.value ? a : b)
    if (!map.has(dominant.name)) {
      map.set(dominant.name, {
        name: dominant.name,
        aromas: dominant.aromas,
        healthBenefits: dominant.healthBenefits,
        description: dominant.description,
        products: [],
      })
    }
    map.get(dominant.name).products.push(p)
  }
  return [...map.values()]
    .sort((a, b) => b.products.length - a.products.length)
    .map((g, i) => ({ ...g, color: TERP_COLORS[i % TERP_COLORS.length] }))
})

// Terpene name → color lookup (for bar charts)
const terpColorMap = computed(() => {
  const map = {}
  for (const g of terpeneGroups.value) {
    map[g.name] = g.color
  }
  return map
})

// ── Layout constants ─────────────────────────────────────────────────────────
const W = 1400
const H = 900
const BALL_Y = 80
const BALL_R = 30
const STRING_LEN_MIN = 150
const STRING_LEN_MAX = 550
const PRODUCT_R = 12

const FOCUS_CENTER_X = W / 2
const FOCUS_CENTER_Y = 450
const FOCUS_BALL_R = 60
const FOCUS_RING_START = 160
const FOCUS_RING_GAP = 100
const FOCUS_PRODUCT_R = 16
const BASE_PRODUCTS_PER_RING = 8 // ring 0; outer rings scale with circumference

const TRANSITION_MS = 700
const FLY_MS = 500

function hash(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0
  return Math.abs(h)
}

function easeInOut(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

// ── State machine: 'overview' | 'zooming-in' | 'focus' | 'zooming-out' ──────
const mode = ref('overview')
const focusedTerpene = ref(null)

// Transition snapshots
let transitionStart = 0
let transitionItems = []
let transitionBall = null
let transitionOtherBalls = []

// ── Product shelf (persists across mode changes) ─────────────────────────────
const shelfProducts = ref([])

// Flying product animation
const flyingProduct = ref(null) // { product, fromX, fromY, startTime }

function addToShelf(product, svgX, svgY) {
  // Don't add duplicates (check by Name+Brand since products are deduplicated)
  if (shelfProducts.value.some(p => p.Name === product.Name && p.Brand === product.Brand)) return
  // Start fly animation
  flyingProduct.value = {
    product,
    fromX: svgX,
    fromY: svgY,
    startTime: time.value * 1000,
  }
}

const flyProgress = computed(() => {
  if (!flyingProduct.value) return -1
  const elapsed = time.value * 1000 - flyingProduct.value.startTime
  return Math.min(1, Math.max(0, elapsed / FLY_MS))
})

watch(flyProgress, (p) => {
  if (p >= 1 && flyingProduct.value) {
    shelfProducts.value.push(flyingProduct.value.product)
    flyingProduct.value = null
  }
})

function removeFromShelf(product) {
  shelfProducts.value = shelfProducts.value.filter(p => !(p.Name === product.Name && p.Brand === product.Brand))
}

// ── Overview pendulum data ───────────────────────────────────────────────────
const overviewLayout = computed(() => {
  const groups = terpeneGroups.value
  if (!groups.length) return []
  const spacing = W / (groups.length + 1)
  const result = []
  for (let gi = 0; gi < groups.length; gi++) {
    const g = groups[gi]
    const ballX = spacing * (gi + 1)
    for (let pi = 0; pi < g.products.length; pi++) {
      const p = g.products[pi]
      const h = hash(String(p.id))
      result.push({
        product: p,
        group: g,
        ballX,
        ballY: BALL_Y,
        stringLen: STRING_LEN_MIN + (h % 1000) / 1000 * (STRING_LEN_MAX - STRING_LEN_MIN),
        speed: 0.3 + (h % 500) / 500 * 0.7,
        phase: (h % 6283) / 1000,
        maxAngle: 0.2 + (h % 300) / 1000,
        color: g.color,
      })
    }
  }
  return result
})

const overviewBalls = computed(() => {
  const groups = terpeneGroups.value
  if (!groups.length) return []
  const spacing = W / (groups.length + 1)
  return groups.map((g, i) => ({
    ...g,
    x: spacing * (i + 1),
    y: BALL_Y,
    r: BALL_R + Math.min(g.products.length, 20) * 1.5,
  }))
})

function pendulumPos(item, t) {
  const angle = Math.sin(t * item.speed + item.phase) * item.maxAngle
  return {
    x: item.ballX + Math.sin(angle) * item.stringLen,
    y: item.ballY + Math.cos(angle) * item.stringLen,
  }
}

// Sort products by their terpene value descending (highest % closest to center)
function sortedByTerpValue(products, terpName) {
  return [...products].sort((a, b) => {
    const av = a.Terpenes?.find(t => t.name === terpName)?.value ?? 0
    const bv = b.Terpenes?.find(t => t.name === terpName)?.value ?? 0
    return bv - av
  })
}

const FOCUS_R_SHRINK = 2 // each ring shrinks product dot by this much

// How many products fit on a given ring (scales with circumference)
function ringCapacity(ring) {
  const radius = FOCUS_RING_START + ring * FOCUS_RING_GAP
  return Math.max(BASE_PRODUCTS_PER_RING, Math.floor(2 * Math.PI * radius / 120))
}

// Map flat index to { ring, posInRing, ringCount }
function ringAssignment(i, n) {
  let remaining = n
  let ring = 0
  let offset = 0
  while (remaining > 0) {
    const cap = ringCapacity(ring)
    const count = Math.min(cap, remaining)
    if (i < offset + count) {
      return { ring, posInRing: i - offset, ringCount: count }
    }
    offset += count
    remaining -= count
    ring++
  }
  return { ring: 0, posInRing: 0, ringCount: 1 }
}

function focusPos(i, n) {
  const { ring, posInRing, ringCount } = ringAssignment(i, n)
  const radius = FOCUS_RING_START + ring * FOCUS_RING_GAP
  const angleStep = (2 * Math.PI) / ringCount
  const angle = angleStep * posInRing - Math.PI / 2
  const dotR = Math.max(6, FOCUS_PRODUCT_R - ring * FOCUS_R_SHRINK)
  const labelBelow = posInRing % 2 === 0 // alternate above/below
  return {
    x: FOCUS_CENTER_X + Math.cos(angle) * radius,
    y: FOCUS_CENTER_Y + Math.sin(angle) * radius,
    r: dotR,
    labelBelow,
    ring,
  }
}

// ── Animation loop ───────────────────────────────────────────────────────────
const time = ref(0)
let raf = null

function animate(ts) {
  time.value = ts / 1000
  raf = requestAnimationFrame(animate)
}

onMounted(() => { raf = requestAnimationFrame(animate) })
onUnmounted(() => { if (raf) cancelAnimationFrame(raf) })

// ── Transition progress (0–1, driven by time) ───────────────────────────────
const transitionProgress = computed(() => {
  if (mode.value !== 'zooming-in' && mode.value !== 'zooming-out') return -1
  const elapsed = (time.value * 1000 - transitionStart)
  return Math.min(1, Math.max(0, elapsed / TRANSITION_MS))
})

watch(transitionProgress, (p) => {
  if (p >= 1) {
    if (mode.value === 'zooming-in') mode.value = 'focus'
    else if (mode.value === 'zooming-out') {
      mode.value = 'overview'
      focusedTerpene.value = null
    }
  }
})

// ── Trigger zoom in ──────────────────────────────────────────────────────────
function onBallClick(group) {
  if (mode.value !== 'overview') return
  focusedTerpene.value = group

  const t = time.value
  const products = sortedByTerpValue(group.products, group.name)

  const groupItems = overviewLayout.value.filter(item => item.group.name === group.name)
  transitionItems = products.map((p, i) => {
    const layoutItem = groupItems.find(li => li.product.id === p.id)
    const from = layoutItem ? pendulumPos(layoutItem, t) : { x: W / 2, y: H / 2 }
    const to = focusPos(i, products.length)
    return {
      id: p.id,
      product: p,
      fromX: from.x, fromY: from.y,
      toX: to.x, toY: to.y,
      fromR: PRODUCT_R, toR: to.r,
      fromOpacity: 0.85, toOpacity: 0.85,
      color: group.color,
      terpValue: p.Terpenes?.find(tp => tp.name === group.name)?.value ?? 0,
    }
  })

  const otherItems = overviewLayout.value.filter(item => item.group.name !== group.name)
  for (const item of otherItems) {
    const from = pendulumPos(item, t)
    transitionItems.push({
      id: item.product.id,
      product: item.product,
      fromX: from.x, fromY: from.y,
      toX: from.x, toY: from.y,
      fromR: PRODUCT_R, toR: 0,
      fromOpacity: 0.85, toOpacity: 0,
      color: item.color,
      terpValue: 0,
      fadeOnly: true,
    })
  }

  const ball = overviewBalls.value.find(b => b.name === group.name)
  transitionBall = {
    fromX: ball.x, fromY: ball.y, fromR: ball.r,
    toX: FOCUS_CENTER_X, toY: FOCUS_CENTER_Y, toR: FOCUS_BALL_R,
    color: group.color,
    name: group.name,
    productCount: products.length,
  }

  transitionOtherBalls = overviewBalls.value
    .filter(b => b.name !== group.name)
    .map(b => ({ ...b, fromOpacity: 0.9, toOpacity: 0 }))

  transitionStart = time.value * 1000
  mode.value = 'zooming-in'
}

// ── Trigger zoom out ─────────────────────────────────────────────────────────
function goBack() {
  if (mode.value !== 'focus') return
  const group = focusedTerpene.value
  const products = sortedByTerpValue(group.products, group.name)
  const t = time.value

  const groupItems = overviewLayout.value.filter(item => item.group.name === group.name)
  transitionItems = products.map((p, i) => {
    const from = focusPos(i, products.length)
    const layoutItem = groupItems.find(li => li.product.id === p.id)
    const to = layoutItem ? pendulumPos(layoutItem, t) : { x: W / 2, y: H / 2 }
    return {
      id: p.id,
      product: p,
      fromX: from.x, fromY: from.y,
      toX: to.x, toY: to.y,
      fromR: from.r, toR: PRODUCT_R,
      fromOpacity: 0.85, toOpacity: 0.85,
      color: group.color,
      terpValue: 0,
    }
  })

  const otherItems = overviewLayout.value.filter(item => item.group.name !== group.name)
  for (const item of otherItems) {
    const pos = pendulumPos(item, t)
    transitionItems.push({
      id: item.product.id,
      product: item.product,
      fromX: pos.x, fromY: pos.y,
      toX: pos.x, toY: pos.y,
      fromR: 0, toR: PRODUCT_R,
      fromOpacity: 0, toOpacity: 0.85,
      color: item.color,
      terpValue: 0,
      fadeOnly: true,
    })
  }

  const ball = overviewBalls.value.find(b => b.name === group.name)
  transitionBall = {
    fromX: FOCUS_CENTER_X, fromY: FOCUS_CENTER_Y, fromR: FOCUS_BALL_R,
    toX: ball.x, toY: ball.y, toR: ball.r,
    color: group.color,
    name: group.name,
    productCount: products.length,
  }

  transitionOtherBalls = overviewBalls.value
    .filter(b => b.name !== group.name)
    .map(b => ({ ...b, fromOpacity: 0, toOpacity: 0.9 }))

  transitionStart = time.value * 1000
  mode.value = 'zooming-out'
}

// ── Computed render data for transitions ─────────────────────────────────────
const transitionDots = computed(() => {
  const p = transitionProgress.value
  if (p < 0) return []
  const e = easeInOut(p)
  return transitionItems.map(item => ({
    product: item.product,
    x: lerp(item.fromX, item.toX, e),
    y: lerp(item.fromY, item.toY, e),
    r: lerp(item.fromR, item.toR, e),
    opacity: lerp(item.fromOpacity, item.toOpacity, e),
    color: item.color,
    terpValue: item.terpValue,
    fadeOnly: item.fadeOnly,
  }))
})

const transitionBallPos = computed(() => {
  const p = transitionProgress.value
  if (p < 0 || !transitionBall) return null
  const e = easeInOut(p)
  return {
    x: lerp(transitionBall.fromX, transitionBall.toX, e),
    y: lerp(transitionBall.fromY, transitionBall.toY, e),
    r: lerp(transitionBall.fromR, transitionBall.toR, e),
    color: transitionBall.color,
    name: transitionBall.name,
    productCount: transitionBall.productCount,
  }
})

const transitionOtherBallsPos = computed(() => {
  const p = transitionProgress.value
  if (p < 0) return []
  const e = easeInOut(p)
  return transitionOtherBalls.map(b => ({
    ...b,
    opacity: lerp(b.fromOpacity, b.toOpacity, e),
  }))
})

// ── Overview animated positions ──────────────────────────────────────────────
const animatedDots = computed(() => {
  if (mode.value !== 'overview') return []
  const t = time.value
  return overviewLayout.value.map(item => {
    const angle = Math.sin(t * item.speed + item.phase) * item.maxAngle
    const endX = item.ballX + Math.sin(angle) * item.stringLen
    const endY = item.ballY + Math.cos(angle) * item.stringLen
    const waveMag = Math.sin(t * item.speed * 1.7 + item.phase * 2) * 15
    const midX = (item.ballX + endX) / 2 + waveMag
    const midY = (item.ballY + endY) / 2
    return {
      ...item,
      endX, endY,
      path: `M ${item.ballX} ${item.ballY} Q ${midX} ${midY} ${endX} ${endY}`,
    }
  })
})

// ── Focus static positions ───────────────────────────────────────────────────
const focusProducts = computed(() => {
  const g = focusedTerpene.value
  if (!g || mode.value !== 'focus') return []
  const sorted = sortedByTerpValue(g.products, g.name)
  return sorted.map((p, i) => {
    const pos = focusPos(i, sorted.length)
    return {
      product: p,
      x: pos.x, y: pos.y, r: pos.r,
      labelBelow: pos.labelBelow,
      ring: pos.ring,
      color: g.color,
      terpValue: p.Terpenes?.find(t => t.name === g.name)?.value ?? 0,
    }
  })
})

// Dynamic viewBox height: expand when focus mode needs more room
const effectiveH = computed(() => {
  const g = focusedTerpene.value
  if (!g || (mode.value !== 'focus' && mode.value !== 'zooming-in' && mode.value !== 'zooming-out')) return H
  // Count rings needed with dynamic capacity
  let remaining = g.products.length
  let ring = 0
  while (remaining > 0) {
    remaining -= ringCapacity(ring)
    ring++
  }
  const maxRadius = FOCUS_RING_START + (ring - 1) * FOCUS_RING_GAP
  const needed = FOCUS_CENTER_Y + maxRadius + FOCUS_PRODUCT_R + 80
  return Math.max(H, needed)
})

const focusInfo = computed(() => {
  const g = focusedTerpene.value
  if (!g) return null
  return {
    name: g.name,
    color: g.color,
    description: g.description || '',
    aromas: g.aromas || [],
    benefits: g.healthBenefits || [],
  }
})

const infoOpacity = computed(() => {
  if (mode.value === 'focus') return 1
  if (mode.value === 'zooming-in') return easeInOut(Math.max(0, (transitionProgress.value - 0.7) / 0.3))
  if (mode.value === 'zooming-out') return easeInOut(1 - Math.min(1, transitionProgress.value / 0.3))
  return 0
})

// ── Flying dot computed position ─────────────────────────────────────────────
const flyDot = computed(() => {
  if (!flyingProduct.value || flyProgress.value < 0) return null
  const e = easeInOut(flyProgress.value)
  const fp = flyingProduct.value
  // Fly from SVG position toward bottom-center of SVG viewport
  const toX = W / 2
  const toY = H + 20
  return {
    x: lerp(fp.fromX, toX, e),
    y: lerp(fp.fromY, toY, e),
    r: lerp(FOCUS_PRODUCT_R, 8, e),
    opacity: lerp(1, 0.3, e),
    product: fp.product,
  }
})

// ── Shelf bar chart helpers ──────────────────────────────────────────────────
function maxTerpValue() {
  let max = 0
  for (const p of shelfProducts.value) {
    for (const t of (p.Terpenes || [])) {
      if (t.value > max) max = t.value
    }
  }
  return max || 1
}

function terpColor(name) {
  return terpColorMap.value[name] || '#888'
}

// Product modal state
const modalProduct = ref(null)

// ── Draggable info panel ─────────────────────────────────────────────────────
const panelPos = ref({ x: null, y: null }) // null = default position (top-right)
let dragState = null // { startX, startY, origX, origY }

function onPanelPointerDown(e) {
  const el = e.currentTarget
  const rect = el.getBoundingClientRect()
  // Initialize position from current rendered location if first drag
  if (panelPos.value.x === null) {
    panelPos.value = { x: rect.left, y: rect.top }
  }
  dragState = {
    startX: e.clientX,
    startY: e.clientY,
    origX: panelPos.value.x,
    origY: panelPos.value.y,
  }
  el.setPointerCapture(e.pointerId)
}

function onPanelPointerMove(e) {
  if (!dragState) return
  panelPos.value = {
    x: dragState.origX + (e.clientX - dragState.startX),
    y: dragState.origY + (e.clientY - dragState.startY),
  }
}

function onPanelPointerUp() {
  dragState = null
}

// Reset panel position when switching terpenes
watch(focusedTerpene, () => {
  panelPos.value = { x: null, y: null }
})
</script>

<template>
  <div class="relative">
    <svg
      :viewBox="`0 0 ${W} ${effectiveH}`"
      class="w-full"
      :style="{
        maxHeight: mode === 'overview' ? '80vh' : 'none',
        background: 'radial-gradient(ellipse at 50% 0%, #1a1a2e 0%, #0a0a0f 100%)',
      }"
    >
      <defs>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="ball-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="big-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="14" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      <!-- ════════ OVERVIEW MODE ════════ -->
      <g v-if="mode === 'overview'">
        <path
          v-for="(d, i) in animatedDots" :key="'s' + i"
          :d="d.path" fill="none" :stroke="d.color" stroke-opacity="0.3" stroke-width="1.5"
        />
        <g v-for="(d, i) in animatedDots" :key="'d' + i">
          <circle :cx="d.endX" :cy="d.endY" :r="PRODUCT_R + 8"
            fill="transparent" style="cursor: pointer" @click="addToShelf(d.product, d.endX, d.endY)" />
          <circle :cx="d.endX" :cy="d.endY" :r="PRODUCT_R"
            :fill="d.color" fill-opacity="0.85" filter="url(#glow)" style="pointer-events: none" />
          <text :x="d.endX" :y="d.endY + PRODUCT_R + 12"
            text-anchor="middle" fill="white" fill-opacity="0.7" font-size="8"
            style="pointer-events: none">{{ d.product.Name }}</text>
        </g>
        <g v-for="ball in overviewBalls" :key="'b' + ball.name">
          <circle :cx="ball.x" :cy="ball.y" :r="ball.r"
            :fill="ball.color" fill-opacity="0.9" filter="url(#ball-glow)"
            style="cursor: pointer" @click="onBallClick(ball)" />
          <text :x="ball.x" :y="ball.y" text-anchor="middle" dominant-baseline="central"
            fill="white" font-size="10" font-weight="bold" style="pointer-events: none">{{ ball.name }}</text>
          <text :x="ball.x" :y="ball.y + 14" text-anchor="middle"
            fill="white" fill-opacity="0.6" font-size="8" style="pointer-events: none"
          >{{ ball.products.length }} product{{ ball.products.length === 1 ? '' : 's' }}</text>
        </g>
      </g>

      <!-- ════════ TRANSITION (zoom in or out) ════════ -->
      <g v-if="mode === 'zooming-in' || mode === 'zooming-out'">
        <line v-for="d in transitionDots.filter(d => !d.fadeOnly)" :key="'ts' + d.product.id"
          :x1="transitionBallPos?.x" :y1="transitionBallPos?.y"
          :x2="d.x" :y2="d.y"
          :stroke="d.color" :stroke-opacity="0.25 * d.opacity" stroke-width="1.5" />

        <g v-for="d in transitionDots" :key="'td' + d.product.id">
          <circle :cx="d.x" :cy="d.y" :r="d.r"
            :fill="d.color" :fill-opacity="d.opacity"
            filter="url(#glow)" style="pointer-events: none" />
          <text v-if="d.opacity > 0.3" :x="d.x" :y="d.y + d.r + 12"
            text-anchor="middle" fill="white" :fill-opacity="d.opacity * 0.8" font-size="8"
            style="pointer-events: none">{{ d.product.Name }}</text>
        </g>

        <g v-for="b in transitionOtherBallsPos" :key="'tob' + b.name">
          <circle :cx="b.x" :cy="b.y" :r="b.r"
            :fill="b.color" :fill-opacity="b.opacity" filter="url(#ball-glow)" />
          <text :x="b.x" :y="b.y" text-anchor="middle" dominant-baseline="central"
            fill="white" :fill-opacity="b.opacity" font-size="10" font-weight="bold"
            style="pointer-events: none">{{ b.name }}</text>
        </g>

        <g v-if="transitionBallPos">
          <circle :cx="transitionBallPos.x" :cy="transitionBallPos.y" :r="transitionBallPos.r"
            :fill="transitionBallPos.color" fill-opacity="0.9" filter="url(#big-glow)" />
          <text :x="transitionBallPos.x" :y="transitionBallPos.y - 6"
            text-anchor="middle" dominant-baseline="central"
            fill="white" font-size="14" font-weight="bold" style="pointer-events: none"
          >{{ transitionBallPos.name }}</text>
          <text :x="transitionBallPos.x" :y="transitionBallPos.y + 12"
            text-anchor="middle" fill="white" fill-opacity="0.6" font-size="10" style="pointer-events: none"
          >{{ transitionBallPos.productCount }} product{{ transitionBallPos.productCount === 1 ? '' : 's' }}</text>
        </g>

      </g>

      <!-- ════════ FOCUS MODE ════════ -->
      <g v-if="mode === 'focus'">
        <line v-for="(fp, i) in focusProducts" :key="'fs' + i"
          :x1="FOCUS_CENTER_X" :y1="FOCUS_CENTER_Y" :x2="fp.x" :y2="fp.y"
          :stroke="fp.color" stroke-opacity="0.25" stroke-width="1.5" />
        <g v-for="(fp, i) in focusProducts" :key="'fp' + i">
          <circle :cx="fp.x" :cy="fp.y" :r="fp.r + 8"
            fill="transparent" style="cursor: pointer" @click="addToShelf(fp.product, fp.x, fp.y)" />
          <circle :cx="fp.x" :cy="fp.y" :r="fp.r"
            :fill="fp.color" fill-opacity="0.85" filter="url(#glow)" style="pointer-events: none" />
          <text :x="fp.x" :y="fp.labelBelow ? fp.y + fp.r + 13 : fp.y - fp.r - 14"
            text-anchor="middle" fill="white" fill-opacity="0.85" font-size="9"
            :textLength="fp.product.Name.length > 28 ? '180' : undefined"
            :lengthAdjust="fp.product.Name.length > 28 ? 'spacingAndGlyphs' : undefined"
            style="pointer-events: none">{{ fp.product.Name.length > 32 ? fp.product.Name.slice(0, 30) + '…' : fp.product.Name }}</text>
          <text :x="fp.x" :y="fp.labelBelow ? fp.y + fp.r + 24 : fp.y - fp.r - 4"
            text-anchor="middle" fill="white" fill-opacity="0.5" font-size="8"
            style="pointer-events: none">{{ fp.terpValue }}%</text>
        </g>
        <circle :cx="FOCUS_CENTER_X" :cy="FOCUS_CENTER_Y" :r="FOCUS_BALL_R"
          :fill="focusedTerpene.color" fill-opacity="0.9" filter="url(#big-glow)" />
        <text :x="FOCUS_CENTER_X" :y="FOCUS_CENTER_Y - 6"
          text-anchor="middle" dominant-baseline="central"
          fill="white" font-size="16" font-weight="bold" style="pointer-events: none"
        >{{ focusedTerpene.name }}</text>
        <text :x="FOCUS_CENTER_X" :y="FOCUS_CENTER_Y + 14"
          text-anchor="middle" fill="white" fill-opacity="0.6" font-size="11" style="pointer-events: none"
        >{{ focusedTerpene.products.length }} product{{ focusedTerpene.products.length === 1 ? '' : 's' }}</text>
        <g style="cursor: pointer" @click="goBack">
          <rect x="20" y="20" width="90" height="34" rx="8" fill="white" fill-opacity="0.1" />
          <text x="65" y="42" text-anchor="middle" fill="white" fill-opacity="0.8"
            font-size="13" font-weight="bold" style="pointer-events: none">← Back</text>
        </g>
      </g>

      <!-- ════════ FLYING PRODUCT DOT ════════ -->
      <circle v-if="flyDot"
        :cx="flyDot.x" :cy="flyDot.y" :r="flyDot.r"
        fill="#fff" :fill-opacity="flyDot.opacity" filter="url(#glow)" />
    </svg>

    <!-- ════════ TERPENE INFO PANEL (draggable, defaults to upper right) ════════ -->
    <div v-if="focusInfo && (mode === 'focus' || mode === 'zooming-in' || mode === 'zooming-out')"
      class="w-72 rounded-xl border border-gray-600 bg-gray-900/90 backdrop-blur-sm p-4 transition-opacity duration-300 touch-none select-none"
      :class="panelPos.x === null ? 'absolute top-3 right-3' : 'fixed'"
      :style="{
        opacity: infoOpacity,
        ...(panelPos.x !== null ? { left: panelPos.x + 'px', top: panelPos.y + 'px' } : {}),
        cursor: 'grab',
      }"
      @pointerdown="onPanelPointerDown"
      @pointermove="onPanelPointerMove"
      @pointerup="onPanelPointerUp"
      @pointercancel="onPanelPointerUp">
      <div class="flex items-center gap-2 mb-3">
        <div class="w-3 h-3 rounded-full flex-shrink-0" :style="{ backgroundColor: focusInfo.color }" />
        <h3 class="text-white font-bold text-sm">{{ focusInfo.name }}</h3>
      </div>
      <p v-if="focusInfo.description" class="text-gray-300 text-xs leading-relaxed mb-3">
        {{ focusInfo.description }}
      </p>
      <div v-if="focusInfo.aromas.length" class="mb-2">
        <span class="text-[10px] font-semibold text-indigo-300 uppercase tracking-wider">Aromas</span>
        <div class="flex flex-wrap gap-1 mt-1">
          <span v-for="a in focusInfo.aromas" :key="a"
            class="text-[10px] bg-indigo-900/50 text-indigo-200 px-1.5 py-0.5 rounded">{{ a }}</span>
        </div>
      </div>
      <div v-if="focusInfo.benefits.length">
        <span class="text-[10px] font-semibold text-green-300 uppercase tracking-wider">Potential Benefits</span>
        <div class="flex flex-wrap gap-1 mt-1">
          <span v-for="b in focusInfo.benefits" :key="b"
            class="text-[10px] bg-green-900/50 text-green-200 px-1.5 py-0.5 rounded">{{ b }}</span>
        </div>
      </div>
    </div>

    <!-- ════════ PRODUCT SHELF ════════ -->
    <div v-if="shelfProducts.length > 0"
      class="mt-4 bg-gray-900 rounded-xl border border-gray-700 p-4">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-white font-bold text-sm tracking-wide">Terpene Comparison</h3>
        <button @click="shelfProducts = []"
          class="text-xs text-gray-400 hover:text-white transition-colors">
          Clear all
        </button>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <div v-for="sp in shelfProducts" :key="sp.Name + sp.Brand"
          class="bg-gray-800 rounded-lg p-3 relative">
          <button @click="removeFromShelf(sp)"
            class="absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded-full bg-gray-700 text-gray-400 hover:text-white hover:bg-gray-600 text-xs leading-none transition-colors">
            ×
          </button>
          <div class="text-white text-xs font-semibold truncate pr-4 mb-1">{{ sp.Name }}</div>
          <div class="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-gray-400 mb-2">
            <span v-if="sp.Strain">{{ sp.Strain }}</span>
            <span v-if="sp.Potency">THC {{ sp.Potency }}{{ sp['Potency Unit'] || '%' }}</span>
            <span v-if="sp.Brand">{{ sp.Brand }}</span>
          </div>
          <div class="space-y-1 mb-2">
            <div v-for="terp in sp.Terpenes" :key="terp.name"
              class="flex items-center gap-1.5">
              <span class="text-[9px] text-gray-400 w-16 truncate flex-shrink-0 text-right">{{ terp.name }}</span>
              <div class="flex-1 h-2.5 bg-gray-700 rounded-full overflow-hidden">
                <div class="h-full rounded-full transition-all"
                  :style="{
                    width: (terp.value / maxTerpValue() * 100) + '%',
                    backgroundColor: terpColor(terp.name),
                  }" />
              </div>
              <span class="text-[9px] text-gray-500 w-8 flex-shrink-0">{{ terp.value }}%</span>
            </div>
          </div>
          <button @click="modalProduct = sp"
            class="w-full text-[11px] font-semibold py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white transition-colors">
            Learn More
          </button>
        </div>
      </div>
    </div>

    <!-- ════════ PRODUCT MODAL ════════ -->
    <ProductModal v-if="modalProduct" :product="modalProduct" @close="modalProduct = null" />
  </div>
</template>
