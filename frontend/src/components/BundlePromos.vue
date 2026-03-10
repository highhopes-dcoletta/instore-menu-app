<script setup>
import { computed } from 'vue'
import { BUNDLES } from '@/config/bundles'

const props = defineProps({ products: { type: Array, default: () => [] } })

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function isScheduleActive(bundle) {
  if (!bundle.schedule) return true
  const now = new Date()
  const { days, dates } = bundle.schedule
  if (days?.length && !days.includes(now.getDay())) return false
  if (dates?.length && !dates.includes(now.getDate())) return false
  return true
}

const relevantBundles = computed(() => {
  if (!props.products.length) return []

  return BUNDLES.filter(bundle => {
    if (!isScheduleActive(bundle)) return false
    return props.products.some(p =>
      bundle.match({ name: p.Name, category: p.Category, unitWeight: p['Unit Weight'] ?? '', price: p.Price ?? 0, qty: 1 })
    )
  })
})
</script>

<template>
  <div v-if="relevantBundles.length" class="flex flex-wrap gap-2 mb-4">
    <div
      v-for="bundle in relevantBundles"
      :key="bundle.id"
      class="flex items-center gap-1.5 rounded-xl bg-amber-50 border border-amber-200 px-3 py-1.5"
    >
      <span class="text-base leading-none">🎉</span>
      <span class="text-xs font-semibold text-amber-800">{{ bundle.label }}</span>
    </div>
  </div>
</template>
