<script setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { BUNDLES } from '@/config/bundles'
import BundleDealModal from '@/components/BundleDealModal.vue'
import { useFeatureFlags } from '@/composables/useFeatureFlags'

const { t } = useI18n()

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

function isActiveToday(bundle) {
  if (!bundle.schedule) return true
  const now = new Date()
  const { days, dates } = bundle.schedule
  if (days?.length && !days.includes(now.getDay())) return false
  if (dates?.length && !dates.includes(now.getDate())) return false
  return true
}

// Map bundle IDs to display categories
const BUNDLE_CATEGORIES = {
  'drinks-4': 'Edibles', 'drinks-6': 'Edibles', 'drinks-8': 'Edibles', 'drinks-case': 'Edibles',
  'bettys-fruit-2': 'Edibles', 'wyld-2': 'Edibles', 'mindys-2': 'Edibles',
  'monday-dorks-2': 'Edibles', 'monday-pax-2': 'Edibles', 'monday-choice-3': 'Edibles',
  'monday-camino-2': 'Edibles', 'monday-bettys-3': 'Edibles', 'monday-cannatini-2': 'Edibles',
  'monday-zzzonked-2': 'Edibles', 'monday-jams-2': 'Edibles',
  'juicy-fire-4pack': 'Pre-Rolls', 'juicy-fire-6pack': 'Pre-Rolls',
  'hh-1g-preroll-2': 'Pre-Rolls', 'hh-1g-preroll-5': 'Pre-Rolls', 'hh-1g-preroll-10': 'Pre-Rolls',
  'hh-5pack-2': 'Pre-Rolls', 'valorem-1g-2': 'Pre-Rolls', 'realm-1g-2': 'Pre-Rolls',
  'hh-eighth-3pack': 'Flower', 'friday-flower-2pack': 'Flower',
  'hellavated-1g-2': 'Vapes', 'freshly-baked-1g-2': 'Vapes', 'fernway-1g-2': 'Vapes',
  'friday-fernway-1g-3': 'Vapes', 'select-briq-2g-2': 'Vapes', 'crude-strane-4': 'Vapes',
  'dcc-1g-4': 'Vapes', 'hellavated-strane-cloud-2': 'Vapes',
  'dime-1g-2': 'Vapes', 'dime-2g-2': 'Vapes', 'dime-mix-2': 'Vapes',
  'mac-sugar-2': 'Dabs', 'mac-sugar-3': 'Dabs', 'mac-live-hash-2': 'Dabs',
}

const dealsByCategory = computed(() => {
  const active = BUNDLES.filter(isActiveToday)
  const grouped = {}
  for (const deal of active) {
    const cat = BUNDLE_CATEGORIES[deal.id] || 'Other'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(deal)
  }
  // Return as sorted array of { category, deals }
  const order = ['Flower', 'Pre-Rolls', 'Edibles', 'Vapes', 'Dabs']
  return order
    .filter(c => grouped[c])
    .map(c => ({ category: c, deals: grouped[c] }))
})

const { bundlesEnabled } = useFeatureFlags()
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
              v-for="deal in group.deals"
              :key="deal.id"
              class="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/25 hover:border-amber-500/50 transition-colors text-left"
              @click="selectedBundle = deal"
            >
              <span class="text-sm leading-none">🎉</span>
              <span class="font-bold text-xs leading-snug flex-1">{{ deal.label }}</span>
            </button>
          </div>
        </div>
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
