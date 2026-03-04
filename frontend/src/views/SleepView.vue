<script setup>
import { useProductFilters } from '@/composables/useProductFilters'
import FilterPanel from '@/components/FilterPanel.vue'
import ProductControls from '@/components/ProductControls.vue'
import ProductTable from '@/components/ProductTable.vue'

const COLUMNS = ['name', 'potency', 'strain', 'price', 'stock']

const { filtered, categoryProducts } = useProductFilters(
  (p) => Array.isArray(p.Tags) && p.Tags.includes('Sleep')
)
</script>

<template>
  <main class="flex gap-8 p-6">
    <div class="flex-1 min-w-0">
      <h1 class="mb-4 text-2xl font-black tracking-wide">Sleep</h1>
      <ProductControls />
      <ProductTable :products="filtered" :columns="COLUMNS" />
    </div>
    <aside class="w-56 shrink-0 pt-14">
      <FilterPanel :filters="['brand', 'category']" :products="categoryProducts" />
    </aside>
  </main>
</template>
