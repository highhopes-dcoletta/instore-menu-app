<script setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useBundlesStore } from '@/stores/bundles'
import { useSessionStore } from '@/stores/session'
import { useSettingsStore } from '@/stores/settings'
import BundleDealModal from '@/components/BundleDealModal.vue'
import { useFeatureFlags } from '@/composables/useFeatureFlags'

const { t } = useI18n()
const session = useSessionStore()

const CATEGORIES = [
  { path: '/flower',                  labelKey: 'nav.flower' },
  { path: '/pre-rolls',               labelKey: 'nav.preRolls' },
  { path: '/edibles',                 labelKey: 'nav.edibles' },
  { path: '/vapes',                   labelKey: 'nav.vapes' },
  { path: '/concentrates',            labelKey: 'nav.dabs' },
  { path: '/tinctures-and-topicals',  labelKey: 'nav.tincsAndTops' },
  { path: '/sleep',                   labelKey: 'nav.sleep' },
  { path: '/pain',                    labelKey: 'nav.pain' },
]

const bundlesStore = useBundlesStore()

const dealsByCategory = computed(() => {
  const grouped = {}
  for (const deal of bundlesStore.activeBundles) {
    const cat = deal.displayCategory || 'Other'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(deal)
  }
  const order = ['Flower', 'Pre-Rolls', 'Edibles', 'Vapes', 'Dabs']
  return order
    .filter(c => grouped[c])
    .map(c => ({ category: c, deals: grouped[c] }))
})

const { bundlesEnabled } = useFeatureFlags()
const selectedBundle = ref(null)
const settingsStore = useSettingsStore()

const showAll = ref(false)

const hasMoreDeals = computed(() => dealsByCategory.value.some(g => g.deals.length > settingsStore.maxDealsPerCategory))

function visibleDeals(group) {
  return showAll.value ? group.deals : group.deals.slice(0, settingsStore.maxDealsPerCategory)
}
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
        <p class="text-white font-black text-xl leading-none mb-1">{{ t('msg.guidedCta') }}</p>
        <p class="text-teal-200 text-sm">{{ t('msg.guidedCtaSub') }}</p>
      </div>
      <span class="ml-auto text-teal-300 text-2xl">→</span>
    </router-link>

    <!-- Today's Deals by Category -->
    <div v-if="bundlesEnabled && dealsByCategory.length" class="w-full max-w-5xl">
      <p class="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">{{ t('msg.todaysBundles') }}</p>
      <div class="grid gap-4" :style="`grid-template-columns: repeat(${dealsByCategory.length}, minmax(0, 1fr))`">
        <div v-for="group in dealsByCategory" :key="group.category">
          <p class="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">{{ group.category }}</p>
          <div class="flex flex-col gap-2">
            <button
              v-for="deal in visibleDeals(group)"
              :key="deal.id"
              class="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/25 hover:border-amber-500/50 transition-colors text-left"
              @click="session.reportJourney('bundle', `Opened deal: ${deal.label}`); selectedBundle = deal"
            >
              <span class="text-sm leading-none">🎉</span>
              <span class="font-bold text-xs leading-snug flex-1">{{ deal.label }}</span>
            </button>
          </div>
        </div>
      </div>
      <div v-if="hasMoreDeals" class="mt-2">
        <button
          v-if="!showAll"
          @click="showAll = true"
          class="text-xs font-semibold text-amber-500 hover:text-amber-300 transition-colors"
        >Show all deals ↓</button>
        <button
          v-else
          @click="showAll = false"
          class="text-xs font-semibold text-amber-500 hover:text-amber-300 transition-colors"
        >Show fewer ↑</button>
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
        {{ t(cat.labelKey) }}
      </router-link>
    </div>

  </main>

  <BundleDealModal
    v-if="selectedBundle"
    :bundle="selectedBundle"
    @close="selectedBundle = null"
  />
</template>
