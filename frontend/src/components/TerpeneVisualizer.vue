<script setup>
import { ref, computed, nextTick } from 'vue'

const props = defineProps({
  terpenes: { type: Array, required: true },
  compact: { type: Boolean, default: false },
  dark: { type: Boolean, default: false },
})

const maxTerpValue = computed(() => {
  if (!props.terpenes?.length) return 1
  return Math.max(...props.terpenes.map(t => t.value)) || 1
})

// ── Terpene view toggle ────────────────────────────────────────────────────────

const terpView = ref('terpenes') // 'terpenes' | 'aromas'
const terpSection = ref(null)

const aromaGroups = computed(() => {
  const terps = props.terpenes
  if (!terps?.length) return []
  const map = new Map()
  for (const terp of terps) {
    for (const a of terp.aromas ?? []) {
      if (!map.has(a)) map.set(a, { label: a, type: 'aroma', terpenes: [] })
      map.get(a).terpenes.push({ name: terp.name, value: terp.value })
    }
    for (const e of terp.effects ?? []) {
      if (!map.has(e)) map.set(e, { label: e, type: 'effect', terpenes: [] })
      map.get(e).terpenes.push({ name: terp.name, value: terp.value })
    }
  }
  const groups = [...map.values()]
  groups.sort((a, b) => b.terpenes.length - a.terpenes.length || a.label.localeCompare(b.label))
  for (const g of groups) g.terpenes.sort((a, b) => b.value - a.value)
  return groups
})

function captureChipPositions() {
  const positions = new Map()
  if (!terpSection.value) return positions
  for (const el of terpSection.value.querySelectorAll('[data-chip]')) {
    const key = el.dataset.chip
    if (positions.has(key)) continue
    const r = el.getBoundingClientRect()
    positions.set(key, { x: r.left, y: r.top, w: r.width, h: r.height })
  }
  return positions
}

const switching = ref(false)

function switchTerpView(newView) {
  if (newView === terpView.value || switching.value) return
  switching.value = true

  const oldPos = captureChipPositions()
  const fadeOutDuration = 200

  if (terpSection.value) {
    for (const el of terpSection.value.querySelectorAll('[data-scaffold]')) {
      el.animate(
        [{ opacity: 1 }, { opacity: 0 }],
        { duration: fadeOutDuration, easing: 'ease-in', fill: 'forwards' }
      )
    }
    for (const el of terpSection.value.querySelectorAll('[data-card]')) {
      el.animate(
        [{ backgroundColor: getComputedStyle(el).backgroundColor }, { backgroundColor: 'transparent' }],
        { duration: fadeOutDuration, easing: 'ease-in', fill: 'forwards' }
      )
    }
  }

  setTimeout(() => {
    terpView.value = newView
    nextTick(() => {
      if (!terpSection.value) { switching.value = false; return }

      const fadeInDuration = 300
      const fadeInDelay = 200
      for (const el of terpSection.value.querySelectorAll('[data-scaffold]')) {
        el.animate(
          [{ opacity: 0 }, { opacity: 1 }],
          { duration: fadeInDuration, delay: fadeInDelay, easing: 'ease-out', fill: 'backwards' }
        )
      }
      for (const el of terpSection.value.querySelectorAll('[data-card]')) {
        const target = getComputedStyle(el).backgroundColor
        el.animate(
          [{ backgroundColor: 'transparent' }, { backgroundColor: target }],
          { duration: fadeInDuration, delay: fadeInDelay, easing: 'ease-out', fill: 'backwards' }
        )
      }

      const flipDuration = 400
      const seen = new Set()
      for (const el of terpSection.value.querySelectorAll('[data-chip]')) {
        const key = el.dataset.chip
        if (seen.has(key)) continue
        seen.add(key)
        const old = oldPos.get(key)
        const r = el.getBoundingClientRect()
        if (!old) {
          el.animate(
            [{ opacity: 0, transform: 'scale(0.6)' }, { opacity: 1, transform: 'scale(1)' }],
            { duration: 300, delay: 150, easing: 'cubic-bezier(0.2, 0, 0.2, 1)', fill: 'backwards' }
          )
          continue
        }
        const dx = old.x - r.left
        const dy = old.y - r.top
        const sx = old.w / (r.width || 1)
        const sy = old.h / (r.height || 1)
        if (Math.abs(dx) < 2 && Math.abs(dy) < 2 && Math.abs(sx - 1) < 0.05) continue
        el.animate(
          [
            { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` },
            { transform: 'translate(0, 0) scale(1, 1)' },
          ],
          { duration: flipDuration, easing: 'cubic-bezier(0.2, 0, 0.2, 1)' }
        )
      }

      setTimeout(() => { switching.value = false }, flipDuration)
    })
  }, fadeOutDuration)
}
</script>

<template>
  <div v-if="terpenes?.length" ref="terpSection">
    <!-- Tab bar -->
    <div class="flex border-b mb-3" :class="[
      dark ? 'border-gray-600' : 'border-gray-200',
      compact ? 'mb-2' : 'mb-3',
    ]">
      <button
        @click="switchTerpView('terpenes')"
        class="pb-2 text-xs font-semibold transition-colors border-b-2 -mb-px"
        :class="[
          terpView === 'terpenes'
            ? 'border-teal-500 text-teal-400'
            : dark ? 'border-transparent text-gray-500 hover:text-gray-300' : 'border-transparent text-gray-400 hover:text-gray-600',
          compact ? 'px-2 text-[10px]' : 'px-3',
        ]"
      >Terpenes</button>
      <button
        @click="switchTerpView('aromas')"
        class="pb-2 text-xs font-semibold transition-colors border-b-2 -mb-px"
        :class="[
          terpView === 'aromas'
            ? 'border-amber-500 text-amber-400'
            : dark ? 'border-transparent text-gray-500 hover:text-gray-300' : 'border-transparent text-gray-400 hover:text-gray-600',
          compact ? 'px-2 text-[10px]' : 'px-3',
        ]"
      >Aromas &amp; Effects</button>
    </div>

    <!-- Terpene-focused view -->
    <div v-if="terpView === 'terpenes'" :class="compact ? 'space-y-1.5' : 'space-y-2.5'">
      <div v-for="terp in terpenes" :key="terp.name"
        data-card class="rounded-xl" :class="[
          dark ? 'bg-gray-700/50' : 'bg-gray-50',
          compact ? 'px-2 py-1.5' : 'px-3 py-2.5',
        ]">
        <div class="flex items-center justify-between" :class="compact ? 'mb-1' : 'mb-1.5'">
          <span :data-chip="'terp-'+terp.name"
            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold leading-tight"
            :class="[
              dark ? 'bg-gray-600/80 border border-gray-500 text-gray-200' : 'bg-white/80 border border-gray-200 text-gray-700',
              compact ? 'text-[10px]' : 'text-xs',
            ]"
          >{{ terp.name }} <span :class="dark ? 'text-gray-400' : 'text-gray-400'" class="tabular-nums">{{ terp.value }}%</span></span>
        </div>
        <div data-scaffold class="h-1.5 rounded-full overflow-hidden" :class="dark ? 'bg-gray-600' : 'bg-gray-200'">
          <div class="h-full rounded-full transition-all"
            :style="{ width: Math.max(terp.value / maxTerpValue * 100, 4) + '%' }"
            :class="terp.value / maxTerpValue > 0.6 ? 'bg-teal-500' : terp.value / maxTerpValue > 0.25 ? 'bg-teal-400' : 'bg-teal-300'" />
        </div>
        <div v-if="!compact && (terp.aromas?.length || terp.effects?.length)" class="flex flex-wrap gap-1 mt-2">
          <span v-for="a in terp.aromas" :key="'a-'+a"
            :data-chip="'aroma-'+a"
            class="px-2 py-0.5 rounded-full text-xs font-semibold leading-tight"
            :class="dark ? 'bg-amber-900/50 text-amber-300' : 'bg-amber-100/70 text-amber-700'"
          >{{ a }}</span>
          <span v-for="e in terp.effects" :key="'e-'+e"
            :data-chip="'effect-'+e"
            class="px-2 py-0.5 rounded-full text-xs font-semibold leading-tight"
            :class="dark ? 'bg-teal-900/50 text-teal-300' : 'bg-teal-100/70 text-teal-700'"
          >{{ e }}</span>
        </div>
      </div>
    </div>

    <!-- Aroma/effect-focused view -->
    <div v-else :class="compact ? 'space-y-1.5' : 'space-y-2.5'">
      <div v-for="group in aromaGroups" :key="group.label"
        data-card class="rounded-xl" :class="[
          dark
            ? (group.type === 'aroma' ? 'bg-amber-900/30' : 'bg-teal-900/30')
            : (group.type === 'aroma' ? 'bg-amber-50/60' : 'bg-teal-50/60'),
          compact ? 'px-2 py-1.5' : 'px-3 py-2.5',
        ]">
        <div class="flex items-center gap-1.5 flex-wrap" :class="compact ? 'mb-1' : 'mb-1.5'">
          <span :data-chip="(group.type === 'aroma' ? 'aroma-' : 'effect-')+group.label"
            class="px-2 py-0.5 rounded-full font-semibold leading-tight"
            :class="[
              dark
                ? (group.type === 'aroma' ? 'bg-amber-900/50 text-amber-300' : 'bg-teal-900/50 text-teal-300')
                : (group.type === 'aroma' ? 'bg-amber-100/70 text-amber-700' : 'bg-teal-100/70 text-teal-700'),
              compact ? 'text-[10px]' : 'text-xs',
            ]"
          >{{ group.label }}</span>
          <span data-scaffold class="font-medium" :class="[
            dark ? 'text-gray-500' : 'text-gray-400',
            compact ? 'text-[9px]' : 'text-[10px]',
          ]">{{ group.type }}</span>
        </div>
        <div class="flex flex-wrap gap-1.5">
          <span v-for="t in group.terpenes" :key="t.name"
            :data-chip="'terp-'+t.name"
            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold leading-tight"
            :class="[
              dark ? 'bg-gray-600/80 border border-gray-500 text-gray-200' : 'bg-white/80 border border-gray-200 text-gray-700',
              compact ? 'text-[10px]' : 'text-xs',
            ]"
          >{{ t.name }} <span :class="dark ? 'text-gray-400' : 'text-gray-400'" class="tabular-nums">{{ t.value }}%</span></span>
        </div>
      </div>
    </div>
  </div>
</template>
