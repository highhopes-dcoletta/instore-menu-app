<!--
  Two independent sections on one page. Spec says "implement whichever is simpler"
  for dual search bars — we use one shared search-for param that filters both sections.
  No sort buttons, no filter panel per spec.
-->
<script setup>
import { useRoute, useRouter } from 'vue-router'
import { useProductFilters } from '@/composables/useProductFilters'
import { useSessionStore } from '@/stores/session'
import ProductTable from '@/components/ProductTable.vue'

const route = useRoute()
const router = useRouter()
const session = useSessionStore()

const { filtered: tinctures } = useProductFilters((p) => p.Category === 'TINCTURES')
const { filtered: topicals }  = useProductFilters((p) => p.Category === 'TOPICALS')

let searchDebounce = null
function onSearch(e) {
  const q = { ...route.query }
  if (e.target.value) q['search-for'] = e.target.value
  else delete q['search-for']
  router.replace({ query: q })
  clearTimeout(searchDebounce)
  if (e.target.value) {
    searchDebounce = setTimeout(() => session.reportJourney('search', `Searched "${e.target.value}"`), 600)
  }
}
</script>

<template>
  <main class="p-6">
    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-2xl font-black tracking-wide">Tinctures &amp; Topicals</h1>
      <input
        type="text"
        placeholder="Search..."
        :value="route.query['search-for'] || ''"
        @input="onSearch"
        class="rounded border border-gray-300 px-3 py-1.5 text-sm w-52 focus:outline-none focus:border-teal-400"
      />
    </div>

    <section class="mb-10">
      <h2 class="mb-3 text-lg font-bold uppercase tracking-widest text-gray-500">Tinctures</h2>
      <ProductTable :products="tinctures" :sortable="false" />
    </section>

    <section>
      <h2 class="mb-3 text-lg font-bold uppercase tracking-widest text-gray-500">Topicals</h2>
      <ProductTable :products="topicals" :sortable="false" />
    </section>
  </main>
</template>
