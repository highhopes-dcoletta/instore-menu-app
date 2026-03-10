<!-- Search box — reads/writes the search-for URL param. -->
<script setup>
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()

function onSearch(e) {
  const q = { ...route.query }
  if (e.target.value) q['search-for'] = e.target.value
  else delete q['search-for']
  router.replace({ query: q })
}
</script>

<template>
  <div class="mb-5 relative">
    <svg
      class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
      xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"
    >
      <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
    </svg>
    <input
      type="text"
      :placeholder="t('msg.search')"
      :value="route.query['search-for'] || ''"
      @input="onSearch"
      class="w-full rounded-xl border border-gray-200 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-700 placeholder-gray-400 focus:outline-none focus:border-teal-400 shadow-sm"
    />
  </div>
</template>
