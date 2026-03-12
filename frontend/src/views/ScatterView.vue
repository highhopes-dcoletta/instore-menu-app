<script setup>
import { ref, computed } from 'vue'
import { useProductFilters } from '@/composables/useProductFilters'
import ProductControls from '@/components/ProductControls.vue'
import FilterPanel from '@/components/FilterPanel.vue'
import ProductModal from '@/components/ProductModal.vue'
import ScatterChart from '@/components/ScatterChart.vue'

const { filtered, categoryProducts, facets } = useProductFilters(() => true)

const MAX_DOTS = 60

const allPlottable = computed(() =>
  filtered.value.filter(p => p.Price != null && p.Potency != null && p['Potency Unit'] === '%')
)

// Deterministic shuffle seeded by product IDs so the sample is stable across re-renders
const plottable = computed(() => {
  const all = allPlottable.value
  if (all.length <= MAX_DOTS) return all

  const shuffled = all.map(p => {
    let h = 0
    const s = String(p.id)
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
    return { product: p, h: Math.abs(h) }
  })
  shuffled.sort((a, b) => a.h - b.h)
  return shuffled.slice(0, MAX_DOTS).map(s => s.product)
})

const skippedCount = computed(() => filtered.value.length - plottable.value.length)
const sampledCount = computed(() => allPlottable.value.length - plottable.value.length)

const selectedProduct = ref(null)

function onSelect(product) {
  selectedProduct.value = product
}
</script>

<template>
  <main class="p-6">
    <h1 class="mb-4 text-2xl font-black tracking-wide">Explore: Price vs Potency</h1>
    <ProductControls />
    <div class="flex gap-8">
      <aside class="w-40 shrink-0 order-last">
        <FilterPanel :filters="['category', 'brand', 'strain']" :products="categoryProducts" :facets="facets" />
      </aside>
      <div class="flex-1 min-w-0">
        <div v-if="plottable.length === 0" class="text-center text-gray-500 py-16 text-lg">
          No products match your filters.
        </div>
        <ScatterChart v-else :products="plottable" @select="onSelect" />
        <p v-if="sampledCount > 0 || skippedCount > 0" class="text-sm text-gray-400 mt-2 text-center">
          Showing {{ plottable.length }} most distinctive products<span v-if="sampledCount > 0"> ({{ sampledCount }} similar products in the middle not shown)</span><span v-if="skippedCount > 0"> · {{ skippedCount }} excluded (missing price or THC %)</span>
        </p>
      </div>
    </div>

    <ProductModal v-if="selectedProduct" :product="selectedProduct" @close="selectedProduct = null" />
  </main>
</template>
