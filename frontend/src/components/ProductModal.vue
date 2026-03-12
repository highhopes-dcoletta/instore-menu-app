<script setup>
import { computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSessionStore } from '@/stores/session'
import { useCartAnimation } from '@/composables/useCartAnimation'
import { useAnalytics } from '@/composables/useAnalytics'
import { perUnitLabel } from '@/composables/useProductGrouping'

const { t } = useI18n()

const props = defineProps({
  product: { type: Object, required: true },
})
const emit = defineEmits(['close'])

const session = useSessionStore()
const { fire: fireCartAnimation, fireToast, BUBBLE_DURATION } = useCartAnimation()
const { track } = useAnalytics()

const qty = computed(() => session.selections[props.product.id]?.qty ?? 0)

const maxTerpValue = computed(() => {
  if (!props.product.Terpenes?.length) return 1
  return Math.max(...props.product.Terpenes.map(t => t.value)) || 1
})

const pricePerGram = computed(() => {
  const price = props.product.Price
  const weight = props.product['Unit Weight']
  if (!price || !weight) return null
  const match = weight.match(/([\d.\/]+)\s*(oz|g)/i)
  if (!match) return null
  let grams
  if (match[2].toLowerCase() === 'g') {
    grams = parseFloat(match[1])
  } else {
    const parts = match[1].split('/')
    const oz = parts.length === 2 ? parseFloat(parts[0]) / parseFloat(parts[1]) : parseFloat(parts[0])
    grams = oz * 28.3495
  }
  if (!grams || grams <= 0) return null
  return (price / grams).toFixed(2)
})

function updateQty(delta, event) {
  if (delta > 0) {
    const wasEmpty = session.selectionCount === 0
    fireCartAnimation(event.clientX, event.clientY, props.product.Image, null, null)
    if (wasEmpty) fireToast()
    track('add_to_cart', { source: 'modal', product_id: props.product.id, product_name: props.product.Name, category: props.product.Category })
    setTimeout(() => session.updateQuantity(props.product.id, {
      name: props.product.Name ?? '',
      unitWeight: props.product['Unit Weight'] ?? '',
      price: props.product.Price ?? 0,
      image: props.product.Image ?? null,
      category: props.product.Category ?? '',
      subcategory: props.product.Subcategory ?? '',
    }, delta), BUBBLE_DURATION)
  } else {
    session.updateQuantity(props.product.id, {
      name: props.product.Name ?? '',
      unitWeight: props.product['Unit Weight'] ?? '',
      price: props.product.Price ?? 0,
      image: props.product.Image ?? null,
      category: props.product.Category ?? '',
      subcategory: props.product.Subcategory ?? '',
    }, delta)
  }
}

function onKey(e) {
  if (e.key === 'Escape') emit('close')
}
onMounted(() => {
  window.addEventListener('keydown', onKey)
  track('product_modal_opened', { product_id: props.product.id, product_name: props.product.Name, category: props.product.Category })
})
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      @click.self="emit('close')"
    >
      <!-- Modal card -->
      <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-6 p-8 max-h-[90vh] overflow-y-auto">

        <!-- Close button -->
        <button
          @click="emit('close')"
          class="absolute top-4 right-4 text-gray-400 hover:text-gray-700 text-2xl leading-none"
          :aria-label="t('msg.close')"
        >&times;</button>

        <!-- Image -->
        <img
          v-if="product.Image"
          :src="product.Image"
          :alt="product.Name"
          class="w-48 h-48 object-cover rounded-xl mb-6"
        />

        <!-- Name -->
        <h2 class="text-3xl font-black text-gray-800 mb-2">{{ product.Name }}</h2>

        <!-- Price -->
        <div v-if="product.Price != null" class="mb-4">
          <span class="text-lg text-gray-700">${{ product.Price }}</span>
          <span v-if="perUnitLabel(product)" class="ml-2 text-sm text-gray-400">{{ perUnitLabel(product) }}</span>
        </div>

        <!-- Details -->
        <div class="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600 mb-4"
          v-if="product.Potency || product.Strain || pricePerGram">
          <span v-if="product.Potency">
            THC {{ product.Potency }}{{ product['Potency Unit'] || '%' }}
          </span>
          <span v-if="product.Strain">{{ product.Strain }}</span>
          <span v-if="pricePerGram">${{ pricePerGram }}/g</span>
        </div>

        <!-- Terpenes -->
        <div v-if="product.Terpenes?.length" class="mb-4">
          <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Terpenes</h3>
          <div class="space-y-1.5">
            <div v-for="terp in product.Terpenes" :key="terp.name"
              class="flex items-center gap-2">
              <span class="text-xs text-gray-500 w-24 truncate text-right flex-shrink-0">{{ terp.name }}</span>
              <div class="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div class="h-full bg-teal-400 rounded-full"
                  :style="{ width: (terp.value / maxTerpValue * 100) + '%' }" />
              </div>
              <span class="text-xs text-gray-400 w-10 flex-shrink-0">{{ terp.value }}%</span>
            </div>
          </div>
        </div>

        <!-- Description -->
        <p v-if="product.Description" class="text-gray-500 leading-relaxed mb-6">
          {{ product.Description }}
        </p>

        <!-- Cart control -->
        <div class="flex items-center gap-3 mt-2">
          <template v-if="qty === 0">
            <button
              @click="updateQty(1, $event)"
              class="flex-1 py-3 rounded-xl bg-teal-500 text-white font-bold text-base hover:bg-teal-600 active:bg-teal-700 transition-colors"
            >{{ t('cart.addToCart') }}</button>
          </template>
          <template v-else>
            <button
              @click="updateQty(-1, $event)"
              class="w-11 h-11 rounded-full border border-gray-300 text-gray-600 hover:border-teal-500 hover:text-teal-600 transition-colors text-xl leading-none flex items-center justify-center"
            >−</button>
            <span class="w-8 text-center text-lg font-bold tabular-nums">{{ qty }}</span>
            <button
              @click="updateQty(1, $event)"
              class="w-11 h-11 rounded-full bg-teal-500 text-white hover:bg-teal-600 transition-colors text-xl leading-none flex items-center justify-center"
            >+</button>
          </template>
        </div>

      </div>
    </div>
  </Teleport>
</template>
