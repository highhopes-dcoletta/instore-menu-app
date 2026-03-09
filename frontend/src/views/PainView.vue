<script setup>
import { useProductFilters } from '@/composables/useProductFilters'
import FilterPanel from '@/components/FilterPanel.vue'
import ProductControls from '@/components/ProductControls.vue'
import GroupableList from '@/components/GroupableList.vue'

const COLUMNS = ['name', 'potency', 'strain', 'price', 'stock']

const { filtered, categoryProducts, facets } = useProductFilters(
  (p) => Array.isArray(p.Tags) && p.Tags.includes('Pain')
)
</script>

<template>
  <main class="flex gap-8 p-6">
    <div class="flex-1 min-w-0">
      <h1 class="mb-4 text-2xl font-black tracking-wide">Pain</h1>
      <ProductControls />
      <GroupableList :products="filtered" :columns="COLUMNS" />
    </div>
    <aside class="w-40 shrink-0 pt-14">
      <FilterPanel :filters="['brand', 'category']" :products="categoryProducts" :facets="facets" />
    </aside>
  </main>
</template>
