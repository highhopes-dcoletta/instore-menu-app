import { ref } from 'vue'
import { defineStore } from 'pinia'
import { useSessionStore } from './session'

// These are embedded in the browser bundle. Use a read-only PAT scoped to this
// base only — exposure in network requests is equivalent to the existing Softr setup.
const BASE_ID = import.meta.env.VITE_AIRTABLE_BASE_ID
const TABLE_ID = import.meta.env.VITE_AIRTABLE_TABLE_ID
const PAT = import.meta.env.VITE_AIRTABLE_PAT

const FIELDS = [
  'ID',
  'Name',
  'Brand',
  'Category',
  'Subcategory',
  'Strain',
  'Potency',
  'Potency Unit',
  'Price',
  'Unit Weight',
  'Image URL',
  'Description',
  'Effects',
  'Tags',
  'Quantity',
  'Popularity',
  'Pre-Ground?',
  'Infused Preroll?',
]

const AIRTABLE_BASE_URL = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`
const REFRESH_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes
const MAX_RETRIES = 3

export const useProductsStore = defineStore('products', () => {
  const products = ref([])
  const loading = ref(false)
  const error = ref(false)

  let refreshTimer = null

  // ─── Core fetch ──────────────────────────────────────────────────────────────

  /**
   * Fetch every active product from Airtable, following pagination offsets.
   * Throws on any network or HTTP error.
   */
  async function _fetchAll() {
    const headers = { Authorization: `Bearer ${PAT}` }

    // Build base params once; clone per page to add offset
    const baseParams = new URLSearchParams()
    baseParams.set('filterByFormula', '{Active}=TRUE()')
    for (const field of FIELDS) {
      baseParams.append('fields[]', field)
    }

    const all = []
    let offset = null

    do {
      const params = new URLSearchParams(baseParams)
      if (offset) params.set('offset', offset)

      const res = await fetch(`${AIRTABLE_BASE_URL}?${params}`, { headers })
      if (!res.ok) throw new Error(`Airtable responded ${res.status}`)

      const json = await res.json()
      for (const record of json.records) {
        all.push({ id: record.id, ...record.fields })
      }
      offset = json.offset ?? null
    } while (offset)

    if (all.length === 0) throw new Error('Airtable returned an empty product list')
    return all
  }

  // ─── Initial load ────────────────────────────────────────────────────────────

  /**
   * Load products on app startup with up to MAX_RETRIES attempts.
   * Sets loading / error flags for the UI spinner / error page.
   */
  async function loadProducts() {
    loading.value = true
    error.value = false

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const data = await _fetchAll()
        products.value = data
        loading.value = false
        _startRefreshTimer()
        return
      } catch (e) {
        console.error(`Airtable fetch attempt ${attempt}/${MAX_RETRIES} failed:`, e)
        if (attempt < MAX_RETRIES) {
          // Exponential-ish back-off: 1s, 2s, …
          await new Promise((r) => setTimeout(r, 1000 * attempt))
        }
      }
    }

    loading.value = false
    error.value = true
  }

  // ─── Background refresh ──────────────────────────────────────────────────────

  async function _backgroundRefresh() {
    const scrollY = window.scrollY
    try {
      const newData = await _fetchAll()

      // Check for products that were checked but are no longer in the dataset
      const sessionStore = useSessionStore()
      const newIds = new Set(newData.map((p) => p.id))
      const staleIds = Object.keys(sessionStore.selections).filter((id) => !newIds.has(id))
      if (staleIds.length) {
        await sessionStore.removeSelections(staleIds)
      }

      // Atomic swap — only update after we have the complete validated dataset
      products.value = newData

      // Restore scroll position after Vue's reactive update flushes
      window.scrollTo({ top: scrollY, behavior: 'instant' })
    } catch (e) {
      // Silent — do not surface background errors to the user
      console.error('Background refresh failed:', e)
    }
  }

  function _startRefreshTimer() {
    if (refreshTimer) clearInterval(refreshTimer)
    refreshTimer = setInterval(_backgroundRefresh, REFRESH_INTERVAL_MS)
  }

  // ─── Exports ─────────────────────────────────────────────────────────────────

  return {
    products,
    loading,
    error,
    loadProducts,
  }
})
