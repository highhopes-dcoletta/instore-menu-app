<script setup>
import { computed } from 'vue'
import { useProductsStore } from '@/stores/products'
import TerpeneExplorer from '@/components/TerpeneExplorer.vue'

const store = useProductsStore()

const terpeneProducts = computed(() =>
  store.products.filter(p => p.Terpenes?.length > 0)
)
</script>

<template>
  <main class="p-6">
    <h1 class="mb-1 text-2xl font-black tracking-wide">Terpene Explorer</h1>
    <p class="text-sm text-gray-500 mb-4">Tap a terpene to zoom in. Tap products to compare their terpene profiles.</p>
    <div v-if="terpeneProducts.length === 0" class="text-center text-gray-500 py-16 text-lg">
      No products with terpene data available.
    </div>
    <TerpeneExplorer v-else :products="terpeneProducts" />
    <p class="text-sm text-gray-400 mt-2 text-center">
      {{ terpeneProducts.length }} product{{ terpeneProducts.length === 1 ? '' : 's' }} with terpene data
    </p>
  </main>
</template>
