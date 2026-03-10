import { computed } from 'vue'
import { BUNDLES } from '@/config/bundles'

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
 */
export function computeAppliedDeals(selections) {
  const items = Object.values(selections)
  const deals = []

  for (const bundle of BUNDLES) {
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

      deals.push({ id: bundle.id, label: bundle.label, savings })

    } else if (bundle.type === 'timed') {
      const normalTotal = matching.reduce((s, i) => s + i.price * i.qty, 0)
      const totalQty    = matching.reduce((s, i) => s + i.qty, 0)
      const bundleTotal = totalQty * bundle.unitPrice
      const savings     = normalTotal - bundleTotal
      if (savings <= 0) continue

      deals.push({ id: bundle.id, label: bundle.label, savings })
    }
  }

  return deals
}

// ── Reactive composable for the cart ─────────────────────────────────────────

/**
 * Given a ref/computed of session.selections, returns:
 *   appliedDeals  — array of { id, label, savings } for each active deal
 *   totalDiscount — total dollar amount saved
 *   nearDeals     — quantity bundles the customer is partway toward
 */
export function useBundles(selectionsRef) {
  const appliedDeals = computed(() => computeAppliedDeals(selectionsRef.value))

  const totalDiscount = computed(() =>
    appliedDeals.value.reduce((s, d) => s + d.savings, 0)
  )

  const nearDeals = computed(() => {
    const items = Object.values(selectionsRef.value)
    const near = []

    for (const bundle of BUNDLES) {
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
  function activeBundlesForProduct(product) {
    return BUNDLES.filter(bundle => {
      if (!scheduleActive(bundle)) return false
      return bundle.match({
        name: product.Name,
        category: product.Category,
        unitWeight: product['Unit Weight'] ?? '',
        price: product.Price ?? 0,
        qty: 1,
      })
    })
  }

  return { activeBundlesForProduct }
}
