<script setup>
import { useProductFilters } from '@/composables/useProductFilters'
import FilterPanel from '@/components/FilterPanel.vue'
import ProductControls from '@/components/ProductControls.vue'
import ProductTable from '@/components/ProductTable.vue'

const { filtered, categoryProducts } = useProductFilters((p) => p.Category === 'VAPORIZERS')
</script>

<template>
  <main class="flex gap-8 p-6">
    <div class="flex-1 min-w-0">
      <h1 class="mb-4 text-2xl font-black tracking-wide">Vapes</h1>
      <ProductControls />
      <ProductTable :products="filtered" />
    </div>
    <aside class="w-56 shrink-0 pt-14">
      <FilterPanel :filters="['strain', 'size', 'tag']" :products="categoryProducts" />
    </aside>
  </main>
</template>
