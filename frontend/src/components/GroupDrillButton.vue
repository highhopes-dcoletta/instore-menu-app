<script setup>
defineProps({ gl: Object })
</script>

<template>
  <div v-if="gl && !gl.animating && !gl.exitAnimating" class="relative mb-6">
    <div class="flex items-center gap-2">
      <svg class="w-6 h-6 text-gray-700 shrink-0" viewBox="0 0 24 24" fill="currentColor">
        <!-- hand drill: bit + chuck + crank handle -->
        <rect x="1" y="10.5" width="10" height="3" rx="1" />
        <rect x="10" y="9" width="4" height="6" rx="1.5" />
        <rect x="14" y="10" width="5" height="4" rx="1" />
        <rect x="17" y="4" width="3" height="10" rx="1.5" />
        <rect x="16" y="3" width="5" height="3" rx="1.5" />
      </svg>
      <button
        @click="gl.showGrouperPicker = !gl.showGrouperPicker"
        class="flex-1 px-4 py-2 rounded-xl text-sm font-bold bg-gray-800 text-white active:bg-teal-700 transition-colors flex items-center justify-between gap-2"
      >Drill Down By<template v-if="gl.grouped"> · {{ gl.activeGrouper.label }}</template> <span class="text-white opacity-60 text-base leading-none">▼</span></button>
    </div>

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
        <span>Show list</span>
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
