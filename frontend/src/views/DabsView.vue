<script setup>
import { ref } from 'vue'
import { useProductFilters } from '@/composables/useProductFilters'
import FilterPanel from '@/components/FilterPanel.vue'
import ProductControls from '@/components/ProductControls.vue'
import GroupableList from '@/components/GroupableList.vue'
import GroupDrillButton from '@/components/GroupDrillButton.vue'
import BundlePromos from '@/components/BundlePromos.vue'
import SubcategoryTabs from '@/components/SubcategoryTabs.vue'
import { provideBundleNumbers } from '@/composables/useBundles'

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

const COLUMNS = ['name', 'strain', 'potency', 'stock']

const { filtered, categoryProducts, facets } = useProductFilters((p) => p.Category === 'CONCENTRATES')
provideBundleNumbers(categoryProducts)
const groupList = ref(null)
</script>

<template>
  <main class="p-6">
    <h1 class="mb-4 text-2xl font-black tracking-wide">Dabs</h1>
    <SubcategoryTabs :tabs="TABS" />
    <BundlePromos :products="categoryProducts" />
    <ProductControls />
    <div class="flex gap-8">
      <aside class="w-40 shrink-0 order-last">
        <GroupDrillButton :gl="groupList" />
        <FilterPanel :filters="['strain', 'size']" :products="categoryProducts" :facets="facets" />
      </aside>
      <div class="flex-1 min-w-0">
        <GroupableList ref="groupList" :products="filtered" :columns="COLUMNS" :groupers="['potency', 'strain', 'dab-price']" />
      </div>
    </div>
  </main>
</template>
