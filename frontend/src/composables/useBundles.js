import { computed } from 'vue'
import { BUNDLES } from '@/config/bundles'

/**
 * Given a ref/computed of session.selections, returns:
 *   appliedDeals  — array of { id, label, savings } for each active deal
 *   totalDiscount — total dollar amount saved
 */
export function useBundles(selectionsRef) {
  const appliedDeals = computed(() => {
    const items = Object.values(selectionsRef.value)
    const now = new Date()
    const deals = []

    for (const bundle of BUNDLES) {
      const matching = items.filter(i => bundle.match(i))
      if (!matching.length) continue

      if (bundle.type === 'quantity') {
        if (bundle.schedule) {
          if (bundle.schedule.days && !bundle.schedule.days.includes(now.getDay())) continue
          if (bundle.schedule.dates && !bundle.schedule.dates.includes(now.getDate())) continue
        }

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
        const { days, dates } = bundle.schedule ?? {}
        const dayMatch = !days || days.includes(now.getDay())
        const dateMatch = !dates || dates.includes(now.getDate())
        if (!dayMatch || !dateMatch) continue

        const normalTotal = matching.reduce((s, i) => s + i.price * i.qty, 0)
        const totalQty    = matching.reduce((s, i) => s + i.qty, 0)
        const bundleTotal = totalQty * bundle.unitPrice
        const savings     = normalTotal - bundleTotal
        if (savings <= 0) continue

        deals.push({ id: bundle.id, label: bundle.label, savings })
      }
    }

    return deals
  })

  const totalDiscount = computed(() =>
    appliedDeals.value.reduce((s, d) => s + d.savings, 0)
  )

  // Quantity bundles the customer is partway toward (≥1 qualifying item, not yet enough)
  const nearDeals = computed(() => {
    const items = Object.values(selectionsRef.value)
    const now = new Date()
    const near = []

    for (const bundle of BUNDLES) {
      if (bundle.type !== 'quantity') continue

      if (bundle.schedule) {
        if (bundle.schedule.days && !bundle.schedule.days.includes(now.getDay())) continue
        if (bundle.schedule.dates && !bundle.schedule.dates.includes(now.getDate())) continue
      }

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
