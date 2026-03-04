import { ref } from 'vue'
import { defineStore } from 'pinia'
import { useSessionStore } from './session'

const DUTCHIE_URL = 'https://plus.dutchie.com/plus/2021-07/graphql'
const RETAILER_ID = import.meta.env.VITE_DUTCHIE_RETAILER_ID
const BEARER_TOKEN = import.meta.env.VITE_DUTCHIE_BEARER_TOKEN

const MENU_QUERY = `
  query GetMenu($retailerId: ID!) {
    menu(
      retailerId: $retailerId
      showOutOfStock: false
      pagination: { limit: 1000, offset: 0 }
    ) {
      products {
        id
        name
        category
        subcategory
        strainType
        brand { name }
        potencyThc { formatted }
        image
        description
        effects
        variants {
          id
          option
          priceRec
          specialPriceRec
          quantity
        }
      }
    }
  }
`

const REFRESH_INTERVAL_MS = 60 * 1000
const MAX_RETRIES = 3

// Parse a Dutchie formatted potency string like "31.74%" or "103mg"
// into a numeric value and unit string for use with the existing display logic.
function parsePotency(formatted) {
  if (!formatted) return { value: null, unit: null }
  const num = parseFloat(formatted)
  if (isNaN(num)) return { value: null, unit: null }
  const unit = formatted.replace(/[0-9.\s]/g, '').trim() || '%'
  return { value: num, unit }
}

// Flatten one (product, variant) pair into the field shape the app expects.
function normalizeVariant(product, variant) {
  const { value: potencyVal, unit: potencyUnit } = parsePotency(product.potencyThc?.formatted)
  const effects = product.effects ?? []

  // Pre-Ground?: Dutchie subcategory PRE_GROUND, or name contains "pre-ground"/"preground"
  const isPreGround =
    product.subcategory === 'PRE_GROUND' || /pre.?ground/i.test(product.name)

  // Infused Preroll?: Dutchie INFUSED subcategories, or pre-roll with "infused" in name
  const isInfused =
    ['INFUSED', 'INFUSED_PRE_ROLL_PACKS'].includes(product.subcategory) ||
    (product.category === 'PRE_ROLLS' && /infused/i.test(product.name))

  // Tags: map Dutchie effects to app tag names used by Sleep/Pain views
  const tags = []
  if (effects.includes('SLEEPY')) tags.push('Sleep')

  return {
    id: variant.id,
    Name: product.name,
    Brand: product.brand?.name ?? null,
    Category: product.category,
    Subcategory: product.subcategory ?? null,
    Strain: product.strainType ?? null,
    'Unit Weight': variant.option ?? null,
    Price: variant.priceRec ?? null,
    SalePrice: variant.specialPriceRec ?? null,
    Potency: potencyVal,
    'Potency Unit': potencyUnit,
    Image: product.image ?? null,
    Description: product.description ?? null,
    Tags: tags,
    'Pre-Ground?': isPreGround ? 'Yes' : null,
    'Infused Preroll?': isInfused ? 'Yes' : null,
  }
}

export const useProductsStore = defineStore('products', () => {
  const products = ref([])
  const loading = ref(false)
  const error = ref(false)

  let refreshTimer = null

  // ─── Core fetch ──────────────────────────────────────────────────────────────

  async function _fetchAll() {
    const res = await fetch(DUTCHIE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${BEARER_TOKEN}`,
      },
      body: JSON.stringify({
        query: MENU_QUERY,
        variables: { retailerId: RETAILER_ID },
      }),
    })

    if (!res.ok) throw new Error(`Dutchie responded ${res.status}`)

    const json = await res.json()
    if (json.errors) throw new Error(json.errors[0]?.message ?? 'GraphQL error')

    const raw = json.data.menu.products
    if (!raw?.length) throw new Error('Dutchie returned an empty product list')

    // Flatten: one row per variant
    const all = []
    for (const product of raw) {
      for (const variant of product.variants ?? []) {
        all.push(normalizeVariant(product, variant))
      }
    }
    return all
  }

  // ─── Initial load ────────────────────────────────────────────────────────────

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
        console.error(`Dutchie fetch attempt ${attempt}/${MAX_RETRIES} failed:`, e)
        if (attempt < MAX_RETRIES) {
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

      const sessionStore = useSessionStore()
      const newIds = new Set(newData.map((p) => p.id))
      const staleIds = Object.keys(sessionStore.selections).filter((id) => !newIds.has(id))
      if (staleIds.length) await sessionStore.removeSelections(staleIds)

      products.value = newData
      window.scrollTo({ top: scrollY, behavior: 'instant' })
    } catch (e) {
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
