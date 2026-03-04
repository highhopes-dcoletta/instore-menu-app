<!-- Tab strip backed by the `subcategory` URL param. -->
<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const props = defineProps({
  // [{ value: 'GUMMIES', label: 'Gummies' }, ...]
  tabs: { type: Array, required: true },
})

const route = useRoute()
const router = useRouter()

const activeTab = computed(() => route.query.subcategory || props.tabs[0]?.value)

function select(value) {
  // Spec: changing tabs clears search-for
  const q = { ...route.query, subcategory: value }
  delete q['search-for']
  router.replace({ query: q })
}
</script>

<template>
  <div class="mb-4 flex border-b-2 border-gray-200 gap-1">
    <button
      v-for="tab in tabs"
      :key="tab.value"
      @click="select(tab.value)"
      :class="[
        'px-4 py-2 text-sm font-semibold transition-colors whitespace-nowrap',
        activeTab === tab.value
          ? 'border-b-2 -mb-0.5 border-teal-500 text-teal-600'
          : 'text-gray-500 hover:text-gray-800',
      ]"
    >
      {{ tab.label }}
    </button>
  </div>
</template>
