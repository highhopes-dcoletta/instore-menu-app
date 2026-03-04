import { ref } from 'vue'

// Module-level state: fires once per page load
const fired = ref(false)
const origin = ref({ x: 0, y: 0 })

export function useCartAnimation() {
  function fire(x, y) {
    if (fired.value) return
    fired.value = true
    origin.value = { x, y }
  }

  return { fired, origin, fire }
}
