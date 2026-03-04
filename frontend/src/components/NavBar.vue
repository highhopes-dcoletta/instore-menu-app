<script setup>
import { ref, computed, watch } from 'vue'
import { useSessionStore } from '@/stores/session'

const sessionStore = useSessionStore()
const cartOpen = ref(false)
const cartBump = ref(false)

watch(() => sessionStore.selectionCount, () => {
  cartBump.value = false
  requestAnimationFrame(() => { cartBump.value = true })
  setTimeout(() => { cartBump.value = false }, 400)
})

const cartSubtotal = computed(() =>
  Object.values(sessionStore.selections).reduce(
    (sum, item) => sum + (item.price ?? 0) * (item.qty ?? 1), 0
  )
)
const cartTotal = computed(() => cartSubtotal.value.toFixed(2))
const cartTotalAfterTax = computed(() => (cartSubtotal.value * 1.20).toFixed(2))
</script>

<template>
  <nav class="bg-gray-900 text-white flex items-center gap-1 px-4 py-2 text-sm font-bold tracking-wide">
    <router-link to="/" class="px-3 py-1 hover:bg-gray-700 rounded">HOME</router-link>
    <router-link to="/flower" class="px-3 py-1 hover:bg-gray-700 rounded">FLOWER</router-link>
    <router-link to="/pre-rolls" class="px-3 py-1 hover:bg-gray-700 rounded">PRE-ROLLS</router-link>
    <router-link to="/edibles" class="px-3 py-1 hover:bg-gray-700 rounded">EDIBLES</router-link>
    <router-link to="/vapes" class="px-3 py-1 hover:bg-gray-700 rounded">VAPES</router-link>
    <router-link to="/concentrates" class="px-3 py-1 hover:bg-gray-700 rounded">DABS</router-link>
    <router-link to="/tinctures-and-topicals" class="px-3 py-1 hover:bg-gray-700 rounded">TINCS &amp; TOPS</router-link>
    <router-link to="/sleep" class="px-3 py-1 hover:bg-gray-700 rounded">SLEEP</router-link>
    <router-link to="/pain" class="px-3 py-1 hover:bg-gray-700 rounded">PAIN</router-link>

    <!-- Cart badge + dropdown -->
    <div v-if="sessionStore.selectionCount" class="ml-auto relative">
      <button
        @click="cartOpen = !cartOpen"
        class="text-teal-400 hover:text-teal-300 transition-colors px-2 py-1"
      >
        <span :class="['inline-block', cartBump && 'cart-bump']">{{ sessionStore.selectionCount }}</span> in cart
      </button>

      <!-- Dropdown -->
      <div
        v-if="cartOpen"
        class="absolute right-0 top-full mt-2 w-[480px] bg-white rounded-xl shadow-2xl z-50 overflow-hidden"
      >
        <div class="px-4 py-3 border-b border-gray-100 text-xs font-bold uppercase tracking-widest text-gray-400">
          Your Cart
        </div>
        <ul class="divide-y divide-gray-100 max-h-96 overflow-y-auto">
          <li
            v-for="(item, id) in sessionStore.selections"
            :key="id"
            class="flex items-center justify-between px-4 py-3 gap-3"
          >
            <span class="text-sm text-gray-800 leading-tight truncate flex-1 min-w-0">
              {{ item.name }}
              <span v-if="item.unitWeight" class="text-gray-500"> {{ item.unitWeight }}</span>
            </span>
            <div class="flex items-center gap-2 shrink-0">
              <span v-if="item.price != null" class="text-sm font-semibold text-gray-700 tabular-nums">
                ${{ item.price }}
              </span>
              <div class="flex items-center gap-1">
                <button
                  @click="sessionStore.updateQuantity(id, item, -1)"
                  class="w-6 h-6 rounded-full border border-gray-300 text-gray-600 hover:border-teal-500 hover:text-teal-600 transition-colors text-sm flex items-center justify-center"
                >−</button>
                <span class="w-5 text-center text-sm font-semibold tabular-nums text-gray-800">{{ item.qty }}</span>
                <button
                  @click="sessionStore.updateQuantity(id, item, 1)"
                  class="w-6 h-6 rounded-full bg-teal-500 text-white hover:bg-teal-600 transition-colors text-sm flex items-center justify-center"
                >+</button>
              </div>
            </div>
          </li>
        </ul>
        <div class="px-4 pt-3 pb-1 border-t border-gray-100 flex items-center justify-between">
          <span class="text-xs text-gray-400">before tax</span>
          <span class="text-sm font-semibold text-gray-600 tabular-nums">${{ cartTotal }}</span>
        </div>
        <div class="px-4 pb-3 flex items-center justify-between">
          <span class="text-xs text-gray-500">after tax (20%)</span>
          <span class="text-base font-black text-gray-800 tabular-nums">${{ cartTotalAfterTax }}</span>
        </div>
      </div>
    </div>
  </nav>

  <!-- Backdrop to close cart -->
  <Teleport to="body">
    <div v-if="cartOpen" class="fixed inset-0 z-40" @click="cartOpen = false" />
  </Teleport>
</template>

<style scoped>
@keyframes bump {
  0%   { transform: scale(1);    animation-timing-function: ease-in; }
  25%  { transform: scale(2.2);  animation-timing-function: ease-out; }
  80%  { transform: scale(0.92); }
  100% { transform: scale(1); }
}
.cart-bump {
  animation: bump 1s linear;
}
</style>
