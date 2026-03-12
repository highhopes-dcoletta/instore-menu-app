<script setup>
import { useI18n } from 'vue-i18n'
import { setLocale } from '@/i18n'

const { t, locale } = useI18n()

const LOCALES = [
  { code: 'en', label: 'EN' },
  { code: 'es', label: 'ES' },
  { code: 'pt', label: 'PT' },
]

function switchLocale(code) {
  setLocale(code)
}
</script>

<template>
  <nav class="sticky top-0 z-50 bg-gray-900 text-white flex items-center gap-1 px-4 py-2 text-sm font-bold tracking-wide">
    <router-link to="/" class="px-3 py-1 hover:bg-gray-700 rounded">{{ t('nav.home') }}</router-link>
    <router-link to="/flower" class="px-3 py-1 hover:bg-gray-700 rounded">{{ t('nav.flower') }}</router-link>
    <router-link to="/pre-rolls" class="px-3 py-1 hover:bg-gray-700 rounded">{{ t('nav.preRolls') }}</router-link>
    <router-link to="/edibles" class="px-3 py-1 hover:bg-gray-700 rounded">{{ t('nav.edibles') }}</router-link>
    <router-link to="/vapes" class="px-3 py-1 hover:bg-gray-700 rounded">{{ t('nav.vapes') }}</router-link>
    <router-link to="/concentrates" class="px-3 py-1 hover:bg-gray-700 rounded">{{ t('nav.dabs') }}</router-link>
    <router-link to="/tinctures-and-topicals" class="px-3 py-1 hover:bg-gray-700 rounded">{{ t('nav.tincsAndTops') }}</router-link>
    <router-link to="/sleep" class="px-3 py-1 hover:bg-gray-700 rounded">{{ t('nav.sleep') }}</router-link>
    <router-link to="/pain" class="px-3 py-1 hover:bg-gray-700 rounded">{{ t('nav.pain') }}</router-link>
    <router-link to="/explore" class="px-3 py-1 hover:bg-gray-700 rounded">{{ t('nav.explore') }}</router-link>
    <router-link to="/terpenes" class="px-3 py-1 hover:bg-gray-700 rounded">{{ t('nav.terpenes') }}</router-link>
    <div class="ml-auto flex items-center gap-0.5">
      <button
        v-for="loc in LOCALES"
        :key="loc.code"
        @click="switchLocale(loc.code)"
        :class="[
          'px-2 py-1 rounded text-xs font-bold transition-colors',
          locale === loc.code ? 'bg-teal-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700',
        ]"
      >{{ loc.label }}</button>
    </div>
  </nav>
</template>
