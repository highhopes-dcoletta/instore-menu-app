<script setup>
import { onMounted, onUnmounted } from 'vue'

const props = defineProps({
  product: { type: Object, required: true },
})
const emit = defineEmits(['close'])

function onKey(e) {
  if (e.key === 'Escape') emit('close')
}
onMounted(() => window.addEventListener('keydown', onKey))
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
          v-if="product['Image URL']"
          :src="product['Image URL']"
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
        <p v-if="product.Description" class="text-gray-500 leading-relaxed">
          {{ product.Description }}
        </p>

      </div>
    </div>
  </Teleport>
</template>
