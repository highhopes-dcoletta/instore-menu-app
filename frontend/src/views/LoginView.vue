<script setup>
import { useAuth } from '@/composables/useAuth'
import { useRoute } from 'vue-router'

const { login } = useAuth()
const route = useRoute()

function handleLogin() {
  login(route.query.redirect || '/budtender')
}
</script>

<template>
  <main class="flex flex-col items-center justify-center h-screen gap-6 bg-gray-50">
    <h1 class="text-3xl font-black tracking-wide text-gray-800">High Hopes Staff</h1>
    <p class="text-gray-500">Sign in to access staff tools.</p>
    <button
      @click="handleLogin"
      class="px-6 py-3 rounded-lg bg-gray-800 text-white font-bold text-sm hover:bg-gray-900 transition-colors"
    >Sign in with Microsoft</button>
  </main>
</template>
