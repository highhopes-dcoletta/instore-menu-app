import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

const API_BASE = '/api'

export const useSessionStore = defineStore('session', () => {
  const sessionId = ref(null)
  const selections = ref({}) // productId -> { name, unitWeight, price }

  const selectionCount = computed(() =>
    Object.values(selections.value).reduce((sum, s) => sum + (s.qty ?? 1), 0)
  )

  // ─── Internal helpers ────────────────────────────────────────────────────────

  async function _post(attempt = 1) {
    try {
      const res = await fetch(`${API_BASE}/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionId.value,
          selections: selections.value,
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
    } catch (e) {
      console.error(`Session POST failed (attempt ${attempt}):`, e)
      if (attempt < 3 && sessionId.value) {
        setTimeout(() => _post(attempt + 1), 1000 * attempt)
      }
    }
  }

  async function _delete(id) {
    try {
      await fetch(`${API_BASE}/session/${id}`, { method: 'DELETE' })
    } catch (e) {
      console.error('Session DELETE failed:', e)
    }
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  /**
   * Called once on app startup. If a stale sessionId is in localStorage, DELETE
   * it from the backend then start clean.
   */
  async function initialize() {
    const stored = localStorage.getItem('sessionId')
    if (stored) {
      await _delete(stored)
      localStorage.removeItem('sessionId')
    }
    sessionId.value = null
    selections.value = {}
  }

  /**
   * Increment or decrement the quantity of a product.
   * delta: +1 to add, -1 to remove one. Removes product when qty reaches 0.
   * productData: { name, unitWeight, price }
   */
  async function updateQuantity(productId, productData, delta) {
    const currentQty = selections.value[productId]?.qty ?? 0
    const newQty = currentQty + delta

    if (newQty <= 0) {
      const updated = { ...selections.value }
      delete updated[productId]
      selections.value = updated

      if (Object.keys(selections.value).length === 0) {
        const id = sessionId.value
        if (id) {
          await _delete(id)
          localStorage.removeItem('sessionId')
          sessionId.value = null
        }
      } else {
        await _post()
      }
    } else {
      if (!sessionId.value) {
        const newId = crypto.randomUUID?.() ??
          'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
          })
        sessionId.value = newId
        localStorage.setItem('sessionId', newId)
      }
      selections.value = { ...selections.value, [productId]: { ...productData, qty: newQty } }
      await _post()
    }
  }

  /**
   * Remove multiple products at once (called by background refresh when items
   * go out of stock). Fires one sync to the backend after all removals.
   */
  async function removeSelections(productIds) {
    if (!productIds.length) return

    const updated = { ...selections.value }
    for (const id of productIds) delete updated[id]
    selections.value = updated

    if (Object.keys(selections.value).length === 0) {
      const id = sessionId.value
      if (id) {
        await _delete(id)
        localStorage.removeItem('sessionId')
        sessionId.value = null
      }
    } else if (sessionId.value) {
      await _post()
    }
  }

  /**
   * Fully tear down the session (inactivity timeout, manual reset).
   */
  async function clearSession() {
    const id = sessionId.value
    if (id) {
      await _delete(id)
    }
    localStorage.removeItem('sessionId')
    sessionId.value = null
    selections.value = {}
  }

  async function submitOrder() {
    if (!sessionId.value) return null
    try {
      const res = await fetch(`${API_BASE}/session/${sessionId.value}/submit`, {
        method: 'POST',
      })
      if (!res.ok) return null
      const json = await res.json()
      // Clear local session — leave it in the backend for the budtender
      localStorage.removeItem('sessionId')
      sessionId.value = null
      selections.value = {}
      return json.orderNumber
    } catch (e) {
      console.error('Submit order failed:', e)
      return null
    }
  }

  return {
    sessionId,
    selections,
    selectionCount,
    initialize,
    updateQuantity,
    removeSelections,
    clearSession,
    submitOrder,
  }
})
