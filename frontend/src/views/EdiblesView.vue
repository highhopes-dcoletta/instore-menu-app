<script setup>
import { useProductFilters } from '@/composables/useProductFilters'
import FilterPanel from '@/components/FilterPanel.vue'
import ProductControls from '@/components/ProductControls.vue'
import GroupableList from '@/components/GroupableList.vue'
import SubcategoryTabs from '@/components/SubcategoryTabs.vue'

const TABS = [
  { value: 'GUMMIES',          label: 'Gummies' },
  { value: 'CHOCOLATES',       label: 'Chocolates' },
  { value: 'CAPSULES_TABLETS', label: 'Capsules/Tablets' },
  { value: 'DRINKS',           label: 'Drinks' },
  { value: 'CHEWS',            label: 'Chews' },
  { value: 'HARD_CANDY',       label: 'Hard Candy' },
]

const { filtered, categoryProducts, facets } = useProductFilters((p) => p.Category === 'EDIBLES')
</script>

<template>
  <main class="flex gap-8 p-6">
    <div class="flex-1 min-w-0">
      <h1 class="mb-4 text-2xl font-black tracking-wide">Edibles</h1>
      <SubcategoryTabs :tabs="TABS" />
      <ProductControls />
      <GroupableList :products="filtered" />
    </div>
    <aside class="w-40 shrink-0 pt-14">
      <FilterPanel :filters="['strain']" :products="categoryProducts" :facets="facets" />
    </aside>
  </main>
</template>
