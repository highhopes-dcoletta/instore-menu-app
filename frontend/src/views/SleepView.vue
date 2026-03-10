<script setup>
import { ref } from 'vue'
import { useProductFilters } from '@/composables/useProductFilters'
import FilterPanel from '@/components/FilterPanel.vue'
import ProductControls from '@/components/ProductControls.vue'
import GroupableList from '@/components/GroupableList.vue'
import GroupDrillButton from '@/components/GroupDrillButton.vue'

const COLUMNS = ['name', 'potency', 'strain', 'price', 'stock']

const { filtered, categoryProducts, facets } = useProductFilters(
  (p) => Array.isArray(p.Tags) && p.Tags.includes('Sleep')
)
const groupList = ref(null)
</script>

<template>
  <main class="p-6">
    <h1 class="mb-4 text-2xl font-black tracking-wide">Sleep</h1>
    <ProductControls />
    <div class="flex gap-8">
      <aside class="w-40 shrink-0 order-last">
        <GroupDrillButton :gl="groupList" />
        <FilterPanel :filters="['brand', 'category']" :products="categoryProducts" :facets="facets" />
      </aside>
      <div class="flex-1 min-w-0">
        <GroupableList ref="groupList" :products="filtered" :columns="COLUMNS" />
      </div>
    </div>
  </main>
</template>
