<script setup>
import { useCartAnimation } from '@/composables/useCartAnimation'

const { toastVisible, toastMessage } = useCartAnimation()
</script>

<template>
  <Teleport to="body">
    <Transition name="toast">
      <div v-if="toastVisible" class="toast-wrap">
        <div class="toast-inner">{{ toastMessage }}</div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.toast-wrap {
  position: fixed;
  top: 2rem;
  left: 50%;
  transform: translateX(-50%);
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
  transform: translateX(-50%) translateY(-8px);
}
.toast-enter-to,
.toast-leave-from {
  transform: translateX(-50%) translateY(0);
}
</style>
