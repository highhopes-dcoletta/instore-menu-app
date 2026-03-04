<script setup>
import { useProductFilters } from '@/composables/useProductFilters'
import FilterPanel from '@/components/FilterPanel.vue'
import ProductControls from '@/components/ProductControls.vue'
import ProductTable from '@/components/ProductTable.vue'
import SubcategoryTabs from '@/components/SubcategoryTabs.vue'

const TABS = [
  { value: 'BADDER',       label: 'Badder' },
  { value: 'BUDDER',       label: 'Budder' },
  { value: 'CRUMBLE',      label: 'Crumble' },
  { value: 'DIAMONDS',     label: 'Diamonds' },
  { value: 'HASH',         label: 'Hash' },
  { value: 'ISOLATE',      label: 'Isolate' },
  { value: 'KIEF',         label: 'Kief' },
  { value: 'ROSIN_RESIN',  label: 'Rosin/Resin' },
  { value: 'SAND',         label: 'Sand' },
  { value: 'SHATTER',      label: 'Shatter' },
  { value: 'SUGAR',        label: 'Sugar' },
  { value: 'WAX',          label: 'Wax' },
]

const COLUMNS = ['name', 'strain', 'potency']

const { filtered, categoryProducts } = useProductFilters((p) => p.Category === 'CONCENTRATES')
</script>

<template>
  <main class="flex gap-8 p-6">
    <div class="flex-1 min-w-0">
      <h1 class="mb-4 text-2xl font-black tracking-wide">Dabs</h1>
      <SubcategoryTabs :tabs="TABS" />
      <ProductControls />
      <ProductTable :products="filtered" :columns="COLUMNS" />
    </div>
    <aside class="w-56 shrink-0 pt-14">
      <FilterPanel :filters="['strain', 'size']" :products="categoryProducts" />
    </aside>
  </main>
</template>
