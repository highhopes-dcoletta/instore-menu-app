import { ref } from 'vue'
import { defineStore } from 'pinia'
import { useSessionStore } from './session'

import { useSettingsStore } from './settings'

const DUTCHIE_URL = 'https://plus.dutchie.com/plus/2021-07/graphql'

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
        potencyCbd { formatted }
        cannabinoids {
          value
          unit
          cannabinoid { name }
        }
        image
        description
        effects
        staffPick
        terpenes {
          value
          unitSymbol
          terpene { name aromas effects potentialHealthBenefits description }
        }
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

// Parse a Dutchie formatted potency string like "31.74%" or "103mg"
// into a numeric value and unit string for use with the existing display logic.
function parsePotency(formatted) {
  if (!formatted) return { value: null, unit: null }
  const num = parseFloat(formatted)
  if (isNaN(num)) return { value: null, unit: null }
  const unit = formatted.replace(/[0-9.\s]/g, '').trim() || '%'
  return { value: num, unit }
}

// For pre-rolls, convert oz options (e.g. "1/4oz") to grams ("7g").
// Dutchie sometimes uses oz for large-format pre-rolls; grams are more meaningful here.
function normalizeOption(category, option) {
  if (category !== 'PRE_ROLLS' || !option) return option
  const fracOz = option.match(/^(\d+)\/(\d+)\s*oz$/i)
  if (fracOz) return `${(parseInt(fracOz[1]) / parseInt(fracOz[2])) * 28}g`
  const decOz = option.match(/^(\d+(?:\.\d+)?)\s*oz$/i)
  if (decOz) return `${parseFloat(decOz[1]) * 28}g`
  return option
}

// Flatten one (product, variant) pair into the field shape the app expects.
// Map Dutchie cannabinoid unit enum to display symbol
const UNIT_MAP = { PERCENTAGE: '%', MILLIGRAMS: 'mg', MILLIGRAMS_PER_GRAM: 'mg/g', MILLIGRAMS_PER_ML: 'mg/mL' }

function normalizeVariant(product, variant) {
  const { value: potencyVal, unit: potencyUnit } = parsePotency(product.potencyThc?.formatted)
  const { value: cbdVal, unit: cbdUnit } = parsePotency(product.potencyCbd?.formatted)
  const effects = product.effects ?? []

  // Pre-Ground?: Dutchie subcategory PRE_GROUND, or name contains "pre-ground"/"preground"
  const isPreGround =
    product.subcategory === 'PRE_GROUND' || /pre.?ground/i.test(product.name)

  // Infused Preroll?: Dutchie INFUSED subcategories, or pre-roll with "infused" in name
  const isInfused =
    ['INFUSED', 'INFUSED_PRE_ROLL_PACKS'].includes(product.subcategory) ||
    (product.category === 'PRE_ROLLS' && /infused/i.test(product.name))

  // Tags: map Dutchie effects and subcategory to app tag names
  const tags = []
  if (effects.includes('SLEEPY')) tags.push('Sleep')
  if (product.category === 'VAPORIZERS') {
    if (product.subcategory === 'DISPOSABLE' || /disposable/i.test(product.name)) {
      tags.push('Disposable')
    } else {
      tags.push('510')
    }
  }

  return {
    id: variant.id,
    Name: product.name,
    Brand: product.brand?.name ?? null,
    Category: product.category,
    Subcategory: product.subcategory ?? null,
    Strain: product.strainType ?? null,
    'Unit Weight': normalizeOption(product.category, variant.option ?? null),
    Price: variant.priceRec ?? null,
    SalePrice: variant.specialPriceRec ?? null,
    Potency: potencyVal,
    'Potency Unit': potencyUnit,
    CBD: cbdVal,
    'CBD Unit': cbdUnit,
    Cannabinoids: (product.cannabinoids ?? [])
      .filter(c => c.value > 0 && c.cannabinoid?.name
        && !/^THC/i.test(c.cannabinoid.name) && !/^CBD/i.test(c.cannabinoid.name))
      .map(c => ({
        name: c.cannabinoid.name.replace(/\s*\(.*\)/, ''),  // "CBG (Cannabigerol)" → "CBG"
        value: c.value,
        unit: UNIT_MAP[c.unit] || c.unit || '%',
      })),
    Image: product.image ?? null,
    Description: product.description ?? null,
    Tags: tags,
    StaffPick: product.staffPick ?? false,
    'Pre-Ground?': isPreGround ? 'Yes' : null,
    'Infused Preroll?': isInfused ? 'Yes' : null,
    Quantity: variant.quantity ?? null,
    Terpenes: (product.terpenes ?? [])
      .filter(t => t.value > 0 && t.terpene?.name)
      .map(t => ({
        name: t.terpene.name,
        value: t.value,
        unit: t.unitSymbol || '%',
        aromas: t.terpene.aromas ?? [],
        effects: t.terpene.effects ?? [],
        healthBenefits: t.terpene.potentialHealthBenefits ?? [],
        description: t.terpene.description ?? '',
      })),
  }
}

const CACHE_KEY = 'dutchie_products_v1'

function saveCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }))
  } catch (e) {
    console.warn('Failed to save product cache to localStorage:', e)
  }
}

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    return JSON.parse(raw).data ?? null
  } catch (e) {
    return null
  }
}

export const useProductsStore = defineStore('products', () => {
  const products = ref([])
  const loading = ref(true)
  const error = ref(false)
  const usingCache = ref(false)
  const outOfStockNotice = ref([]) // names of items silently removed by background refresh

  let refreshTimer = null

  // ─── Core fetch ──────────────────────────────────────────────────────────────

  async function _fetchAll() {
    const settingsStore = useSettingsStore()
    const res = await fetch(DUTCHIE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settingsStore.dutchieBearerToken}`,
      },
      body: JSON.stringify({
        query: MENU_QUERY,
        variables: { retailerId: settingsStore.dutchieRetailerId },
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

    // Pre-cache product images
    const seen = new Set()
    for (const p of all) {
      if (p.Image && !seen.has(p.Image)) {
        seen.add(p.Image)
        new Image().src = p.Image
      }
    }

    // Flag top-10% CBG products (only compare within same unit to avoid apples-to-oranges)
    _stampHighCBG(all)

    return all
  }

  function _stampHighCBG(list) {
    // Group CBG values by unit, compute 90th percentile per unit
    const byUnit = {}
    for (const p of list) {
      const cbg = p.Cannabinoids?.find(c => c.name === 'CBG')
      if (cbg) {
        ;(byUnit[cbg.unit] ??= []).push(cbg.value)
      }
    }
    const thresholds = {}
    for (const [unit, vals] of Object.entries(byUnit)) {
      vals.sort((a, b) => b - a)
      thresholds[unit] = vals[Math.floor(vals.length * 0.1)] ?? vals[vals.length - 1]
    }
    for (const p of list) {
      const cbg = p.Cannabinoids?.find(c => c.name === 'CBG')
      p.HighCBG = cbg ? cbg.value >= (thresholds[cbg.unit] ?? Infinity) : false
    }
  }

  // ─── Initial load ────────────────────────────────────────────────────────────

  async function loadProducts() {
    loading.value = true
    error.value = false

    const maxRetries = useSettingsStore().dutchieFetchRetries
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const data = await _fetchAll()
        saveCache(data)
        products.value = data
        usingCache.value = false
        loading.value = false
        _startRefreshTimer()
        return
      } catch (e) {
        console.error(`Dutchie fetch attempt ${attempt}/${maxRetries} failed:`, e)
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 1000 * attempt))
        }
      }
    }

    // All retries failed — fall back to last cached product list if available
    const cached = loadCache()
    if (cached?.length) {
      console.warn('Dutchie API unavailable — using cached product list')
      _stampHighCBG(cached)
      products.value = cached
      usingCache.value = true
      loading.value = false
      _startRefreshTimer() // keep retrying in the background
      return
    }

    loading.value = false
    error.value = true
  }

  // ─── Background refresh ──────────────────────────────────────────────────────

  async function _backgroundRefresh() {
    const scrollY = window.scrollY
    try {
      const newData = await _fetchAll()
      saveCache(newData)

      const sessionStore = useSessionStore()
      const newIds = new Set(newData.map((p) => p.id))
      const staleIds = Object.keys(sessionStore.selections).filter((id) => !newIds.has(id))
      if (staleIds.length) {
        const removedNames = staleIds.map((id) => sessionStore.selections[id]?.name).filter(Boolean)
        await sessionStore.removeSelections(staleIds)
        outOfStockNotice.value = removedNames
      }

      products.value = newData
      usingCache.value = false
      window.scrollTo({ top: scrollY, behavior: 'instant' })
    } catch (e) {
      console.error('Background refresh failed:', e)
    }
  }

  function _startRefreshTimer() {
    if (refreshTimer) clearInterval(refreshTimer)
    refreshTimer = setInterval(_backgroundRefresh, useSettingsStore().productRefreshIntervalMs)
  }

  // ─── Exports ─────────────────────────────────────────────────────────────────

  return {
    products,
    loading,
    error,
    usingCache,
    outOfStockNotice,
    loadProducts,
  }
})
