import { computed } from 'vue'
import { useBundlesStore } from '@/stores/bundles'

// ── Shared schedule check ─────────────────────────────────────────────────────

function scheduleActive(bundle) {
  if (!bundle.schedule) return true
  const now = new Date()
  const { days, dates } = bundle.schedule
  if (days?.length && !days.includes(now.getDay())) return false
  if (dates?.length && !dates.includes(now.getDate())) return false
  return true
}

// ── Core non-reactive computation ─────────────────────────────────────────────

/**
 * Given a plain selections object { [productId]: { name, category, unitWeight, price, qty } },
 * returns an array of { id, label, savings } for every deal currently active and met.
 * Safe to call from anywhere — no Vue reactivity required.
 *
 * Optionally accepts a bundleList for use outside reactive contexts (e.g. BudtenderView).
 */
export function computeAppliedDeals(selections, bundleList) {
  const allBundles = bundleList ?? useBundlesStore().bundles
  const items = Object.values(selections)

  // Compute raw savings for every eligible bundle
  const candidates = []

  for (const bundle of allBundles) {
    if (!scheduleActive(bundle)) continue

    const matching = items.filter(i => bundle.match(i))
    if (!matching.length) continue

    if (bundle.type === 'quantity') {
      const totalQty  = matching.reduce((s, i) => s + i.qty, 0)
      if (totalQty < bundle.quantity) continue

      const bundleCount  = Math.floor(totalQty / bundle.quantity)
      const remainderQty = totalQty % bundle.quantity
      const normalTotal  = matching.reduce((s, i) => s + i.price * i.qty, 0)
      const avgPrice     = normalTotal / totalQty
      const bundleTotal  = bundleCount * bundle.bundlePrice + remainderQty * avgPrice
      const savings      = normalTotal - bundleTotal
      if (savings <= 0) continue

      candidates.push({ id: bundle.id, label: bundle.label, savings, group: bundle.group })

    } else if (bundle.type === 'timed') {
      const normalTotal = matching.reduce((s, i) => s + i.price * i.qty, 0)
      const totalQty    = matching.reduce((s, i) => s + i.qty, 0)
      const bundleTotal = totalQty * bundle.unitPrice
      const savings     = normalTotal - bundleTotal
      if (savings <= 0) continue

      candidates.push({ id: bundle.id, label: bundle.label, savings, group: bundle.group })
    }
  }

  // Within each group, keep only the deal with the highest savings (no stacking)
  const best = new Map() // group key → best candidate
  for (const c of candidates) {
    const key = c.group ?? c.id  // ungrouped bundles are their own group
    if (!best.has(key) || c.savings > best.get(key).savings) {
      best.set(key, c)
    }
  }

  return Array.from(best.values()).map(({ id, label, savings }) => ({ id, label, savings }))
}

// ── Reactive composable for the cart ─────────────────────────────────────────

/**
 * Given a ref/computed of session.selections, returns:
 *   appliedDeals  — array of { id, label, savings } for each active deal
 *   totalDiscount — total dollar amount saved
 *   nearDeals     — quantity bundles the customer is partway toward
 */
export function useBundles(selectionsRef) {
  const bundlesStore = useBundlesStore()

  const appliedDeals = computed(() => computeAppliedDeals(selectionsRef.value))

  const totalDiscount = computed(() =>
    appliedDeals.value.reduce((s, d) => s + d.savings, 0)
  )

  const nearDeals = computed(() => {
    const items = Object.values(selectionsRef.value)
    const near = []

    for (const bundle of bundlesStore.bundles) {
      if (bundle.type !== 'quantity') continue
      if (!scheduleActive(bundle)) continue

      const matching = items.filter(i => bundle.match(i))
      const currentQty = matching.reduce((s, i) => s + i.qty, 0)

      if (currentQty > 0 && currentQty < bundle.quantity) {
        near.push({ id: bundle.id, label: bundle.label, needed: bundle.quantity - currentQty })
      }
    }

    return near
  })

  return { appliedDeals, totalDiscount, nearDeals }
}

// ── Product-level bundle matching ─────────────────────────────────────────────

/**
 * Returns activeBundlesForProduct(product) — given a catalog product object
 * (with Name/Category/'Unit Weight' fields), returns bundles active today that match it.
 */
export function useProductBundles() {
  const bundlesStore = useBundlesStore()

  function activeBundlesForProduct(product) {
    return bundlesStore.bundles.filter(bundle => {
      if (!scheduleActive(bundle)) return false
      return bundle.match({
        name: product.Name,
        category: product.Category,
        subcategory: product.Subcategory ?? '',
        unitWeight: product['Unit Weight'] ?? '',
        price: product.Price ?? 0,
        qty: 1,
      })
    })
  }

  return { activeBundlesForProduct }
}
