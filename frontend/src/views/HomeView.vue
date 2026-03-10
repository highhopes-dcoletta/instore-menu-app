<script setup>
import { computed, ref } from 'vue'
import { BUNDLES } from '@/config/bundles'
import BundleDealModal from '@/components/BundleDealModal.vue'

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

const todaysDeals = computed(() => {
  const now = new Date()
  return BUNDLES.filter(bundle => {
    if (!bundle.schedule) return true
    const { days, dates } = bundle.schedule
    if (days?.length && !days.includes(now.getDay())) return false
    if (dates?.length && !dates.includes(now.getDate())) return false
    return true
  })
})

const selectedBundle = ref(null)
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

    <!-- Today's Deals -->
    <div v-if="todaysDeals.length" class="w-full max-w-5xl">
      <p class="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">Today's Deals</p>
      <div class="flex flex-wrap gap-3">
        <button
          v-for="deal in todaysDeals"
          :key="deal.id"
          class="flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/25 hover:border-amber-500/50 transition-colors"
          @click="selectedBundle = deal"
        >
          <span class="text-lg leading-none">🎉</span>
          <span class="font-bold text-sm">{{ deal.label }}</span>
          <span class="text-amber-500/60 text-base leading-none">›</span>
        </button>
      </div>
    </div>

    <!-- Category grid -->
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

  <BundleDealModal
    v-if="selectedBundle"
    :bundle="selectedBundle"
    @close="selectedBundle = null"
  />
</template>
