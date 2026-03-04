<script setup>
import { ref } from 'vue'
import { useSessionStore } from '@/stores/session'

const sessionStore = useSessionStore()
const cartOpen = ref(false)
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
        {{ sessionStore.selectionCount }} in cart
      </button>

      <!-- Dropdown -->
      <div
        v-if="cartOpen"
        class="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-2xl z-50 overflow-hidden"
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
      </div>
    </div>
  </nav>

  <!-- Backdrop to close cart -->
  <Teleport to="body">
    <div v-if="cartOpen" class="fixed inset-0 z-40" @click="cartOpen = false" />
  </Teleport>
</template>
