<script setup>
defineProps({
  groups: { type: Array, required: true },  // [{ key, label, sub, bg, accent, products }]
})
const emit = defineEmits(['expand'])
</script>

<template>
  <div class="flex gap-10 justify-center items-start py-12 flex-wrap">
    <div
      v-for="(group, i) in groups"
      :key="group.key"
      :data-pile="group.key"
      class="pile-card"
      :style="`--i: ${i}`"
    >
      <!-- Back card 2: third product's image -->
      <div class="pile-back pile-back-2" :style="{ background: group.bg }">
        <img v-if="group.products[2]?.Image" :src="group.products[2].Image" class="pile-back-img" />
      </div>
      <!-- Back card 1: second product's image -->
      <div class="pile-back pile-back-1" :style="{ background: group.bg }">
        <img v-if="group.products[1]?.Image" :src="group.products[1].Image" class="pile-back-img" />
      </div>

      <!-- Front card -->
      <button class="pile-front" :style="{ background: group.bg }" @click="emit('expand', group.key)">
        <div class="pile-image">
          <img v-if="group.products[0]?.Image" :src="group.products[0].Image" :alt="group.label" />
          <span v-else class="text-5xl">🌿</span>
        </div>
        <div class="pile-info">
          <p class="pile-label">{{ group.label }}</p>
          <p class="pile-sub" :style="{ color: group.accent }">{{ group.sub }}</p>
          <p class="pile-hint">Tap to browse →</p>
        </div>
      </button>

      <!-- Count badge -->
      <div class="pile-badge" :style="{ background: group.accent }">{{ group.products.length }}</div>
    </div>
  </div>
</template>

<style scoped>
.pile-card {
  position: relative;
  width: 180px;
  height: 228px;
  animation: pile-appear 0.35s ease both;
  animation-delay: calc(var(--i) * 70ms);
}

@keyframes pile-appear {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}

.pile-back {
  position: absolute;
  inset: 0;
  border-radius: 16px;
  overflow: hidden;
}
.pile-back-2 { transform: rotate(-5deg) translate(-6px, 10px); filter: brightness(0.5); }
.pile-back-1 { transform: rotate(-2.5deg) translate(-3px, 5px); filter: brightness(0.7); }
.pile-back-img { width: 100%; height: 100%; object-fit: cover; }

.pile-front {
  position: absolute;
  inset: 0;
  border-radius: 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: transform 0.12s ease;
  cursor: pointer;
}
.pile-front:active { transform: scale(0.95); }

.pile-image {
  flex: 1;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}
.pile-image img { width: 100%; height: 100%; object-fit: cover; }

.pile-info { padding: 12px 12px 10px; }
.pile-label { font-weight: 900; font-size: 17px; line-height: 1; color: white; }
.pile-sub   { font-size: 11px; margin-top: 3px; }
.pile-hint  { font-size: 10px; color: rgba(255,255,255,0.35); margin-top: 5px; }

.pile-badge {
  position: absolute;
  top: -10px; right: -10px;
  width: 32px; height: 32px;
  border-radius: 50%;
  color: white;
  font-weight: 900;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.4);
}
</style>
