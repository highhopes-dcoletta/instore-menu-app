<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'

const router = useRouter()
const { isAuthenticated } = useAuth()

onMounted(() => {
  // MSAL redirect was already processed in main.js before the app mounted.
  if (isAuthenticated.value) {
    const target = sessionStorage.getItem('auth_redirect') || '/budtender'
    sessionStorage.removeItem('auth_redirect')
    router.replace(target)
  } else {
    router.replace('/login')
  }
})
</script>

<template>
  <main class="flex flex-col items-center justify-center h-screen gap-4">
    <div class="h-10 w-10 animate-spin rounded-full border-4 border-teal-500 border-t-transparent"></div>
    <p class="text-gray-500 text-lg">Signing in...</p>
  </main>
</template>
