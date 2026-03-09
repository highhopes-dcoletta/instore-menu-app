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
  <main class="flex flex-col items-center justify-center min-h-[calc(100vh-3rem)] p-8 bg-gray-950 gap-8">

    <!-- Guided flow CTA -->
    <router-link
      to="/guide"
      class="flex items-center gap-4 w-full max-w-5xl rounded-2xl bg-teal-700 active:bg-teal-600 transition-colors px-8 py-5"
    >
      <span class="text-3xl">✨</span>
      <div>
        <p class="text-white font-black text-xl leading-none mb-1">Not sure where to start?</p>
        <p class="text-teal-200 text-sm">Answer 3 quick questions and we'll recommend the best products for you.</p>
      </div>
      <span class="ml-auto text-teal-300 text-2xl">→</span>
    </router-link>

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

