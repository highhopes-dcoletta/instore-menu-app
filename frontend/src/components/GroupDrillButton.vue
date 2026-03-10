<script setup>
import { useI18n } from 'vue-i18n'
defineProps({ gl: Object })
const { t } = useI18n()
</script>

<template>
  <div v-if="gl && !gl.animating && !gl.exitAnimating" class="relative mb-6">
    <button
      @click="gl.showGrouperPicker = !gl.showGrouperPicker"
      class="w-full px-4 py-2 rounded-xl text-sm font-bold bg-gray-800 text-white active:bg-teal-700 transition-colors flex items-center justify-between gap-2"
    ><svg class="w-7 h-7 shrink-0" viewBox="0 0 122.88 90.64" fill="currentColor" stroke="currentColor" stroke-width="3" style="transform: scaleX(-1)"><path d="M74.25,90.64c-1.09,0-1.98-.89-1.98-1.98s.89-1.98,1.98-1.98h13.83l-7.04-29.25H67.47c-1.09,0-1.98-.89-1.98-1.98v-10.4H52.11c-3.07,0-5.85-1.25-7.87-3.27a11.2,11.2,0,0,1-2.63-4.15H27.69a2.89,2.89,0,0,1-2.05-.85c-.06-.06-.12-.13-.17-.2a2.87,2.87,0,0,1-.67-1.85v-9.69H1.98A1.98,1.98,0,0,1,0,23.06a1.98,1.98,0,0,1,1.98-1.98H24.8V12a2.89,2.89,0,0,1,.85-2.05,2.89,2.89,0,0,1,2.05-.85H41.18a11.2,11.2,0,0,1,3.07-5.79A11.23,11.23,0,0,1,52.11,0h48.24c6.2,0,11.83,2.53,15.91,6.62s6.62,9.71,6.62,15.91,0,0,0,0-2.53,11.83-6.62,15.91-9.71,6.62-15.91,6.62h-3.53l11.98,42.45a1.96,1.96,0,0,1,.37,1.16,1.98,1.98,0,0,1-1.98,1.98H74.25ZM40.97,33.67V13.02H28.75V33.66H40.97Zm4-22.33c0,.2,0,.41.07.62v22.78l0,.13a7.17,7.17,0,0,0,2.05,4.12,7.16,7.16,0,0,0,5.07,2.11H65.5V3.96H52.11a7.16,7.16,0,0,0-5.07,2.11,7.16,7.16,0,0,0-2.11,5.06v2.21ZM69.45,3.96V41.08h30.91a18.47,18.47,0,0,0,13.11-5.45,18.47,18.47,0,0,0,5.45-13.11h0a18.47,18.47,0,0,0-5.45-13.11,18.47,18.47,0,0,0-13.11-5.45H69.45Zm0,41.09v8.41H80.08l-2.03-8.41H69.45Zm12.69.12,9.92,41.19h12.3L92.74,45.17H82.14Z" /></svg> {{ t('msg.drillDownBy') }}<template v-if="gl.grouped"> · {{ gl.activeGrouper.label }}</template> <span class="text-white opacity-60 text-base leading-none">▼</span></button>

    <!-- Popup -->
    <div
      v-if="gl.showGrouperPicker"
      class="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden min-w-max"
    >
      <button
        v-if="gl.grouped"
        @click="gl.showGrouperPicker = false; gl.exitGroupView()"
        class="flex items-center gap-2 w-full px-4 py-2.5 text-sm font-semibold text-left transition-colors hover:bg-gray-50 active:bg-gray-100 text-gray-500 border-b border-gray-100"
      >
        <span>☰</span>
        <span>{{ t('msg.showList') }}</span>
      </button>
      <button
        v-for="g in gl.availableGroupers"
        :key="g.key"
        @click="gl.selectGrouper(g)"
        class="flex items-center gap-2 w-full px-4 py-2.5 text-sm font-semibold text-left transition-colors hover:bg-gray-50 active:bg-gray-100"
        :class="gl.activeGrouperKey && gl.activeGrouper.key === g.key ? 'text-teal-600' : 'text-gray-700'"
      >
        <span>{{ g.icon }}</span>
        <span>{{ g.label }}</span>
        <span v-if="gl.activeGrouperKey && gl.activeGrouper.key === g.key" class="ml-auto text-teal-500 text-xs">✓</span>
      </button>
    </div>

    <!-- Backdrop -->
    <div v-if="gl.showGrouperPicker" class="fixed inset-0 z-40" @click="gl.showGrouperPicker = false" />
  </div>
</template>
