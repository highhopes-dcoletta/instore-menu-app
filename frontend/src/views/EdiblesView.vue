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
  { value: 'GUMMIES',          label: 'Gummies' },
  { value: 'CHOCOLATES',       label: 'Chocolates' },
  { value: 'CAPSULES_TABLETS', label: 'Capsules/Tablets' },
  { value: 'DRINKS',           label: 'Drinks' },
  { value: 'CHEWS',            label: 'Chews' },
  { value: 'HARD_CANDY',       label: 'Hard Candy' },
]

const { filtered, categoryProducts, facets } = useProductFilters((p) => p.Category === 'EDIBLES')
provideBundleNumbers(categoryProducts)
const groupList = ref(null)
</script>

<template>
  <main class="p-6">
    <h1 class="mb-4 text-2xl font-black tracking-wide">Edibles</h1>
    <SubcategoryTabs :tabs="TABS" />
    <BundlePromos :products="categoryProducts" />
    <ProductControls />
    <div class="flex gap-8">
      <aside class="w-40 shrink-0 order-last">
        <GroupDrillButton :gl="groupList" />
        <FilterPanel :filters="['strain']" :products="categoryProducts" :facets="facets" />
      </aside>
      <div class="flex-1 min-w-0">
        <GroupableList ref="groupList" :products="filtered" :groupers="['strain', 'edible-price']" />
      </div>
    </div>
  </main>
</template>
