<!-- NavBar — stub. Full layout TBD when views are built. -->
<script setup>
import { useSessionStore } from '@/stores/session'
const sessionStore = useSessionStore()
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
    <span v-if="sessionStore.selectionCount" class="ml-auto text-teal-400">
      {{ sessionStore.selectionCount }} in cart
    </span>
  </nav>
</template>
