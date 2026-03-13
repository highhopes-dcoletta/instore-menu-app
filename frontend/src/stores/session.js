import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { useAnalytics } from '@/composables/useAnalytics'
import { useSettingsStore } from './settings'

const API_BASE = '/api'

export const useSessionStore = defineStore('session', () => {
  const sessionId = ref(null)
  const selections = ref({}) // productId -> { name, unitWeight, price, category, subcategory, image, qty }

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
      const { sessionPostRetries, sessionRetryBackoffMs } = useSettingsStore()
      console.error(`Session POST failed (attempt ${attempt}):`, e)
      if (attempt < sessionPostRetries && sessionId.value) {
        setTimeout(() => _post(attempt + 1), sessionRetryBackoffMs * attempt)
      } else if (attempt >= sessionPostRetries) {
        useAnalytics().track('api_error', { endpoint: 'POST /api/session', message: e.message })
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

  function reportJourney(type, label) {
    if (!sessionId.value) return
    fetch(`${API_BASE}/session/journey`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: sessionId.value, type, label }),
    }).catch(() => {}) // fire-and-forget
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
    // Eagerly create a sessionId so heartbeats can track browsing before cart activity
    const newId = crypto.randomUUID?.() ??
      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
      })
    sessionId.value = newId
    localStorage.setItem('sessionId', newId)
    selections.value = {}
  }

  /**
   * Increment or decrement the quantity of a product.
   * delta: +1 to add, -1 to remove one. Removes product when qty reaches 0.
   * productData: { name, unitWeight, price, category, subcategory, image }
   */
  const SOURCE_LABELS = {
    browse: 'from list',
    drag: 'via drag',
    modal: 'from details',
    guided: 'from guide',
    group_card: 'from group',
    cross_sell: 'from suggested',
    bundle: 'from deal',
    cart: 'in cart',
  }

  async function updateQuantity(productId, productData, delta, source) {
    const srcLabel = source ? ` ${SOURCE_LABELS[source] || source}` : ''
    if (delta > 0) reportJourney('add', `${productData.name} +1${srcLabel}`)
    else if (delta < 0) reportJourney('remove', `${productData.name} -1${srcLabel}`)

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

    for (const id of productIds) {
      const item = selections.value[id]
      if (item) reportJourney('remove', `${item.name} (out of stock)`)
    }

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

  /**
   * Restore a previously saved selections snapshot (e.g. after cancelling a submit).
   * Also deletes a previously submitted session from the backend if an id is provided.
   */
  async function restoreSession(savedSelections, submittedSessionId) {
    if (submittedSessionId) await _delete(submittedSessionId)

    const newId = crypto.randomUUID?.() ??
      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
      })
    sessionId.value = newId
    localStorage.setItem('sessionId', newId)
    selections.value = { ...savedSelections }
    await _post()
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
    restoreSession,
    reportJourney,
  }
})
