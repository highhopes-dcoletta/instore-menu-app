<script setup>
import { ref, watch, nextTick } from 'vue'
import { useCartAnimation } from '@/composables/useCartAnimation'

const { fired, origin } = useCartAnimation()

const flyEl = ref(null)
const flyVisible = ref(false)
const toastVisible = ref(false)

watch(fired, async (val) => {
  if (!val) return

  // Wait for Vue to render the cart counter (added reactively when count hits 1)
  await nextTick()
  await nextTick()

  const target = document.querySelector('[data-cart-counter]')
  if (!target) return

  const rect = target.getBoundingClientRect()
  const ex = rect.left + rect.width / 2
  const ey = rect.top + rect.height / 2

  flyVisible.value = true

  await nextTick()
  if (!flyEl.value) return

  // Set CSS custom properties used by the @keyframes arc
  flyEl.value.style.setProperty('--sx', `${origin.value.x}px`)
  flyEl.value.style.setProperty('--sy', `${origin.value.y}px`)
  flyEl.value.style.setProperty('--ex', `${ex}px`)
  flyEl.value.style.setProperty('--ey', `${ey}px`)

  // Show toast when the bubble arrives
  setTimeout(() => {
    flyVisible.value = false
    toastVisible.value = true
    setTimeout(() => (toastVisible.value = false), 3500)
  }, 680)
})
</script>

<template>
  <Teleport to="body">
    <!-- Flying bubble -->
    <div
      v-if="flyVisible"
      ref="flyEl"
      class="fly-bubble"
    >+</div>

    <!-- Toast -->
    <Transition name="toast">
      <div v-if="toastVisible" class="toast-wrap">
        <div class="toast-inner">You just started a shopping cart!</div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fly-bubble {
  position: fixed;
  left: 0;
  top: 0;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #14b8a6;
  color: white;
  font-size: 16px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 9999;
  animation: cart-fly 0.68s cubic-bezier(0.4, 0, 1, 1) forwards;
}

@keyframes cart-fly {
  0% {
    transform: translate(var(--sx), var(--sy)) translate(-50%, -50%) scale(1);
    opacity: 1;
  }
  45% {
    transform:
      translate(
        calc((var(--sx) + var(--ex)) / 2),
        calc((var(--sy) + var(--ey)) / 2 - 80px)
      )
      translate(-50%, -50%) scale(0.7);
    opacity: 0.85;
  }
  100% {
    transform: translate(var(--ex), var(--ey)) translate(-50%, -50%) scale(0.1);
    opacity: 0;
  }
}

/* Toast */
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
  box-shadow: 0 8px 24px rgba(0,0,0,0.25);
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
