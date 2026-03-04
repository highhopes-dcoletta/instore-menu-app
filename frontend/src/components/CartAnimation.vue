<script setup>
import { ref, watch } from 'vue'
import { useCartAnimation } from '@/composables/useCartAnimation'

const { toastTrigger } = useCartAnimation()
const toastVisible = ref(false)
let toastTimer = null

watch(toastTrigger, () => {
  clearTimeout(toastTimer)
  toastVisible.value = true
  toastTimer = setTimeout(() => (toastVisible.value = false), 3500)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="toast">
      <div v-if="toastVisible" class="toast-wrap">
        <div class="toast-inner">You just started a shopping cart!</div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.toast-wrap {
  position: fixed;
  top: 3.5rem;
  right: 1rem;
  pointer-events: none;
  z-index: 9999;
}

.toast-inner {
  background: #111827;
  color: white;
  padding: 0.6rem 1.5rem;
  border-radius: 9999px;
  font-size: 0.875rem;
  font-weight: 600;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
  white-space: nowrap;
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.35s, transform 0.35s;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(12px);
}
</style>
