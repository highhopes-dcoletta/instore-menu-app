<!--
  FilterPanel — renders chips/dropdowns based on the `filters` prop.

  Supported filter types (pass as strings in the `filters` array):
    'brand'     — single-select chips, dynamic options from products.Brand
    'strain'    — multi-select chips, dynamic options from products.Strain
    'size'      — multi-select chips, dynamic options from products['Unit Weight']
    'preground' — single-select chips (Yes / No)
    'packaging' — single-select chips (SINGLES / PACKS)
    'infused'   — dropdown (All / Yes / No)
    'tag'       — multi-select chips (hardcoded Vapes types)
    'category'  — multi-select chips (hardcoded cross-category values)

  The `products` prop should be the category-only list (pre-filter) so options
  don't disappear as the user narrows down.
-->
<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { strainLabel } from '@/utils/strainLabels'

const props = defineProps({
  filters: { type: Array, default: () => [] },
  products: { type: Array, default: () => [] },
  facets:   { type: Object, default: () => ({}) },
})

const route = useRoute()
const router = useRouter()

// ── URL helpers ────────────────────────────────────────────────────────────────

function toArray(val) {
  if (!val) return []
  return Array.isArray(val) ? val : [val]
}

function set(key, value) {
  router.replace({ query: { ...route.query, [key]: value } })
}

function clear(key) {
  const q = { ...route.query }
  delete q[key]
  router.replace({ query: q })
}

function toggleMulti(key, value) {
  const current = toArray(route.query[key])
  const next = current.includes(value)
    ? current.filter((v) => v !== value)
    : [...current, value]
  const q = { ...route.query }
  if (next.length) q[key] = next
  else delete q[key]
  router.replace({ query: q })
}

function isActive(key, value) {
  return route.query[key] === value
}

function isMultiActive(key, value) {
  return toArray(route.query[key]).includes(value)
}

// ── Dynamic option derivation ──────────────────────────────────────────────────

const brandOptions = computed(() =>
  [...new Set(props.products.map((p) => p.Brand).filter(Boolean))].sort()
)
const strainOptions = computed(() => {
  const list = props.facets.strain ?? props.products
  return [...new Set(list.map((p) => p.Strain).filter(Boolean))].sort()
})
// Parse "1/8oz", "1/4oz", "1oz", "3.5g", etc. to a numeric grams value for sorting
function parseWeight(str) {
  const s = str.replace(/oz$/i, '').replace(/g$/i, '').trim()
  if (s.includes('/')) {
    const [num, den] = s.split('/')
    return parseFloat(num) / parseFloat(den)
  }
  return parseFloat(s) || 0
}

const sizeOptions = computed(() => {
  const list = props.facets.size ?? props.products
  const unique = [...new Set(list.map((p) => p['Unit Weight']).filter(Boolean))]
  return unique.sort((a, b) => parseWeight(a) - parseWeight(b))
})

// ── Hardcoded option sets ──────────────────────────────────────────────────────

const VAPE_TAGS = ['510', 'Airo', 'Disposable', 'Live Rosin/Resin', 'Pax']
const CATEGORY_OPTS = [
  { value: 'EDIBLES', label: 'Edibles' },
  { value: 'VAPORIZERS', label: 'Vaporizers' },
  { value: 'FLOWER', label: 'Flower' },
  { value: 'PRE_ROLLS', label: 'Pre-Rolls' },
  { value: 'TINCTURES', label: 'Tinctures' },
  { value: 'CONCENTRATES', label: 'Concentrates' },
]
</script>

<template>
  <div v-if="filters.length" class="flex flex-col gap-6">

    <!-- Brand — single toggle for High Hopes house brand -->
    <div v-if="filters.includes('brand')">
      <div class="label">Brand</div>
      <div class="flex justify-end">
        <button
          @click="isActive('brand', 'High Hopes') ? clear('brand') : set('brand', 'High Hopes')"
          :class="['chip', isActive('brand', 'High Hopes') ? 'chip-on' : 'chip-off']"
        >High Hopes Only</button>
      </div>
    </div>

    <!-- Strain -->
    <div v-if="filters.includes('strain') && strainOptions.length">
      <div class="label">Strain</div>
      <div class="flex flex-col gap-1.5 items-end">
        <button
          v-for="opt in strainOptions"
          :key="opt"
          @click="toggleMulti('strain', opt)"
          :class="['chip', isMultiActive('strain', opt) ? 'chip-on' : 'chip-off']"
        >{{ strainLabel(opt) }}</button>
      </div>
    </div>

    <!-- Size -->
    <div v-if="filters.includes('size') && sizeOptions.length">
      <div class="label">Size</div>
      <div class="flex flex-col gap-1.5 items-end">
        <button
          v-for="opt in sizeOptions"
          :key="opt"
          @click="toggleMulti('size', opt)"
          :class="['chip', isMultiActive('size', opt) ? 'chip-on' : 'chip-off']"
        >{{ opt }}</button>
      </div>
    </div>

    <!-- Pre-Ground — single toggle -->
    <div v-if="filters.includes('preground')">
      <div class="label">Pre-Ground?</div>
      <div class="flex justify-end">
        <button
          @click="isActive('preground', 'yes') ? clear('preground') : set('preground', 'yes')"
          :class="['chip', isActive('preground', 'yes') ? 'chip-on' : 'chip-off']"
        >Pre-Ground Only</button>
      </div>
    </div>

    <!-- Packaging -->
    <div v-if="filters.includes('packaging')">
      <div class="label">Packaging</div>
      <div class="flex flex-col gap-1.5 items-end">
        <button
          v-for="opt in ['SINGLES', 'PACKS']"
          :key="opt"
          @click="isActive('packaging', opt) ? clear('packaging') : set('packaging', opt)"
          :class="['chip', isActive('packaging', opt) ? 'chip-on' : 'chip-off']"
        >{{ opt }}</button>
      </div>
    </div>

    <!-- Infused -->
    <div v-if="filters.includes('infused')">
      <div class="label">Infused?</div>
      <div class="flex flex-col gap-1.5 items-end">
        <button
          @click="isActive('infused', 'yes') ? clear('infused') : set('infused', 'yes')"
          :class="['chip', isActive('infused', 'yes') ? 'chip-on' : 'chip-off']"
        >Infused Only</button>
        <button
          @click="isActive('infused', 'no') ? clear('infused') : set('infused', 'no')"
          :class="['chip', isActive('infused', 'no') ? 'chip-on' : 'chip-off']"
        >Non-Infused Only</button>
      </div>
    </div>

    <!-- Vape type tags -->
    <div v-if="filters.includes('tag')">
      <div class="label">Type</div>
      <div class="flex flex-col gap-1.5 items-end">
        <button
          v-for="opt in VAPE_TAGS"
          :key="opt"
          @click="toggleMulti('tag', opt)"
          :class="['chip', isMultiActive('tag', opt) ? 'chip-on' : 'chip-off']"
        >{{ opt }}</button>
      </div>
    </div>

    <!-- Category chips (Sleep / Pain) -->
    <div v-if="filters.includes('category')">
      <div class="label">Category</div>
      <div class="flex flex-col gap-1.5 items-end">
        <button
          v-for="opt in CATEGORY_OPTS"
          :key="opt.value"
          @click="toggleMulti('category', opt.value)"
          :class="['chip', isMultiActive('category', opt.value) ? 'chip-on' : 'chip-off']"
        >{{ opt.label }}</button>
      </div>
    </div>

  </div>
</template>

<style scoped>
.label {
  @apply mb-2 text-xs font-black uppercase tracking-wider text-teal-500 text-right;
}
.chip {
  @apply rounded-lg border px-3 py-1.5 text-xs font-black uppercase tracking-wide transition-colors cursor-pointer select-none;
}
.chip-on {
  @apply border-teal-500 bg-white text-teal-500;
}
.chip-off {
  @apply border-gray-800 bg-white text-gray-800;
}
</style>
