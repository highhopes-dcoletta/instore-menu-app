<script setup>
import { computed, ref, watch, nextTick, onMounted } from 'vue'
import { BUNDLES } from '@/config/bundles'
import BundleDealModal from '@/components/BundleDealModal.vue'
import { useAnalytics } from '@/composables/useAnalytics'
import { useFeatureFlags } from '@/composables/useFeatureFlags'

const props = defineProps({ products: { type: Array, default: () => [] } })

const { track } = useAnalytics()
const { bundlesEnabled } = useFeatureFlags()
const selectedBundle = ref(null)

const showAll = ref(false)
const bundleContainer = ref(null)
const hasOverflow = ref(false)

// Each bundle button is ~28px tall; gap-2 = 8px between rows; 3 rows = 100px
const MAX_HEIGHT = 100 // px

function checkOverflow() {
  if (!bundleContainer.value) return
  hasOverflow.value = bundleContainer.value.scrollHeight > MAX_HEIGHT + 2
}

onMounted(() => nextTick(checkOverflow))
watch(() => props.products, () => { showAll.value = false; nextTick(checkOverflow) })

function openModal(bundle) {
  track('bundle_modal_opened', { bundle_id: bundle.id, bundle_label: bundle.label, source: 'page_banner' })
  selectedBundle.value = bundle
}

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
  <div v-if="bundlesEnabled && relevantBundles.length" class="mb-4">
    <div
      ref="bundleContainer"
      class="flex flex-wrap gap-2 overflow-hidden transition-all duration-300"
      :style="showAll ? {} : { maxHeight: MAX_HEIGHT + 'px' }"
    >
      <button
        v-for="bundle in relevantBundles"
        :key="bundle.id"
        class="flex items-center gap-1.5 rounded-xl bg-amber-50 border border-amber-200 px-3 py-1.5 transition-colors"
        :class="bundle.type === 'quantity' ? 'hover:bg-amber-100 hover:border-amber-300 cursor-pointer' : 'cursor-default'"
        @click="bundle.type === 'quantity' && openModal(bundle)"
      >
        <span class="text-base leading-none">🎉</span>
        <span class="text-xs font-semibold text-amber-800">{{ bundle.label }}</span>
        <span v-if="bundle.type === 'quantity'" class="text-amber-400 text-xs leading-none">›</span>
      </button>
    </div>
    <button
      v-if="hasOverflow && !showAll"
      @click="showAll = true"
      class="mt-1.5 text-xs font-semibold text-amber-700 hover:text-amber-900 transition-colors"
    >Show all deals ↓</button>
    <button
      v-if="showAll && hasOverflow"
      @click="showAll = false"
      class="mt-1.5 text-xs font-semibold text-amber-700 hover:text-amber-900 transition-colors"
    >Show fewer ↑</button>
  </div>

  <BundleDealModal
    v-if="selectedBundle"
    :bundle="selectedBundle"
    @close="selectedBundle = null"
  />
</template>
