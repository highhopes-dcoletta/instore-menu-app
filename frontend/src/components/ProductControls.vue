<!-- Search box — reads/writes the search-for URL param. -->
<script setup>
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

function onSearch(e) {
  const q = { ...route.query }
  if (e.target.value) q['search-for'] = e.target.value
  else delete q['search-for']
  router.replace({ query: q })
}
</script>

<template>
  <div class="mb-4 flex justify-end">
    <input
      type="text"
      placeholder="Search..."
      :value="route.query['search-for'] || ''"
      @input="onSearch"
      class="rounded border border-gray-300 px-3 py-1.5 text-sm w-52 focus:outline-none focus:border-teal-400"
    />
  </div>
</template>
