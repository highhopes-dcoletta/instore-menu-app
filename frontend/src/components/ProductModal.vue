<script setup>
import { computed, onMounted, onUnmounted } from 'vue'
import { useSessionStore } from '@/stores/session'
import { useCartAnimation } from '@/composables/useCartAnimation'
import { useAnalytics } from '@/composables/useAnalytics'

const props = defineProps({
  product: { type: Object, required: true },
})
const emit = defineEmits(['close'])

const session = useSessionStore()
const { fire: fireCartAnimation, fireToast, BUBBLE_DURATION } = useCartAnimation()
const { track } = useAnalytics()

const qty = computed(() => session.selections[props.product.id]?.qty ?? 0)

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
          aria-label="Close"
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
        <p v-if="product.Price != null" class="text-lg text-gray-700 mb-4">
          ${{ product.Price }}
        </p>

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
            >Add to Cart</button>
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
