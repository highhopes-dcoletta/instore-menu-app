import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

const API_BASE = '/api'

export const useSessionStore = defineStore('session', () => {
  const sessionId = ref(null)
  const selections = ref({}) // productId -> { name, unitWeight, price }

  const selectionCount = computed(() => Object.keys(selections.value).length)

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
   * Toggle a product in/out of the current session's selections.
   * productData: { name, unitWeight, price }
   */
  async function toggleSelection(productId, productData) {
    if (selections.value[productId]) {
      // ── Uncheck ──────────────────────────────────────────────────────────────
      const updated = { ...selections.value }
      delete updated[productId]
      selections.value = updated

      if (Object.keys(selections.value).length === 0) {
        // Selections are now empty — tear down the session
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
      // ── Check ─────────────────────────────────────────────────────────────────
      if (!sessionId.value) {
        const newId = crypto.randomUUID()
        sessionId.value = newId
        localStorage.setItem('sessionId', newId)
      }
      selections.value = { ...selections.value, [productId]: productData }
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

  return {
    sessionId,
    selections,
    selectionCount,
    initialize,
    toggleSelection,
    removeSelections,
    clearSession,
  }
})
