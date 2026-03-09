<script setup>
import { useProductFilters } from '@/composables/useProductFilters'
import FilterPanel from '@/components/FilterPanel.vue'
import ProductControls from '@/components/ProductControls.vue'
import GroupableList from '@/components/GroupableList.vue'

const { filtered, categoryProducts, facets } = useProductFilters((p) => p.Category === 'VAPORIZERS')
</script>

<template>
  <main class="flex gap-8 p-6">
    <div class="flex-1 min-w-0">
      <h1 class="mb-4 text-2xl font-black tracking-wide">Vapes</h1>
      <ProductControls />
      <GroupableList :products="filtered" :groupers="['vape-potency', 'strain', 'price']" />
    </div>
    <aside class="w-40 shrink-0 pt-14">
      <FilterPanel :filters="['strain', 'size', 'tag']" :products="categoryProducts" :facets="facets" />
    </aside>
  </main>
</template>
