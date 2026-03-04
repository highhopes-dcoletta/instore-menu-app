<script setup>
const CATEGORIES = [
  { path: '/flower',                  label: 'FLOWER' },
  { path: '/pre-rolls',               label: 'PRE-ROLLS' },
  { path: '/edibles',                 label: 'EDIBLES' },
  { path: '/vapes',                   label: 'VAPES' },
  { path: '/concentrates',            label: 'DABS' },
  { path: '/tinctures-and-topicals',  label: 'TINCS & TOPS' },
  { path: '/sleep',                   label: 'SLEEP' },
  { path: '/pain',                    label: 'PAIN' },
]
</script>

<template>
  <main class="flex items-center justify-center min-h-[calc(100vh-3rem)] p-8 bg-gray-950">
    <div class="grid grid-cols-4 gap-6 w-full max-w-5xl">
      <router-link
        v-for="cat in CATEGORIES"
        :key="cat.path"
        :to="cat.path"
        class="aspect-square flex items-center justify-center rounded-2xl bg-gray-800 text-white font-black text-2xl tracking-widest hover:bg-teal-700 transition-colors"
      >
        {{ cat.label }}
      </router-link>
    </div>
  </main>
</template>
