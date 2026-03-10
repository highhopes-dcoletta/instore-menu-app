import { parseCountFromName } from '@/composables/useProductGrouping'

/**
 * For edible products (Potency Unit === 'mg'), Dutchie stores total package potency.
 * Divides by piece count to return per-dose mg. Count is sourced from:
 *   1. Unit Weight field (e.g. "10 ct", "5-pk")
 *   2. Product name (e.g. "Wana Gummies 20pk", "1906 Love Tablet 30-pack")
 * Returns the raw value unchanged for non-mg units or single-piece products.
 */
export function perItemPotency(product) {
  const val  = product.Potency
  const unit = product['Potency Unit']
  if (!val || unit !== 'mg') return val
  // Try piece count from unit weight
  const uw = String(product['Unit Weight'] ?? '').trim()
  const uwMatch = uw.match(/^(\d+)[-\s]?(?:ct|pk|pack|pcs|pc|piece|pieces)$/i)
  if (uwMatch) {
    const count = parseInt(uwMatch[1], 10)
    return count > 1 ? val / count : val
  }
  // Fallback: piece count from product name (Dutchie edibles have "20pk" etc. in name)
  const count = parseCountFromName(product.Name)
  return count && count > 1 ? val / count : val
}

/**
 * Returns a potency display descriptor for a product.
 * Accounts for edible mg dosing, vape-specific % ranges, and standard flower % ranges.
 */
export function getPotencyLevel(product) {
  const unit = product['Potency Unit']
  const val  = unit === 'mg' ? perItemPotency(product) : product.Potency
  if (!val) return null

  if (unit === 'mg') {
    if (val <= 5)  return { label: 'Low dose',      dots: 1, color: 'bg-green-400' }
    if (val <= 10) return { label: 'Medium dose',   dots: 2, color: 'bg-yellow-400' }
    if (val <= 20) return { label: 'High dose',     dots: 3, color: 'bg-orange-400' }
    return             { label: 'Very high dose',   dots: 4, color: 'bg-red-400' }
  }

  if (product.Category === 'VAPORIZERS') {
    if (val < 80) return { label: 'Mild',        dots: 1, color: 'bg-green-400' }
    if (val < 85) return { label: 'Standard',    dots: 2, color: 'bg-yellow-400' }
    if (val < 90) return { label: 'Strong',      dots: 3, color: 'bg-orange-400' }
    return             { label: 'Very strong',   dots: 4, color: 'bg-red-400' }
  }

  // Flower, pre-rolls, concentrates
  if (val <= 12) return { label: 'Low potency',    dots: 1, color: 'bg-green-400' }
  if (val <= 20) return { label: 'Mid potency',    dots: 2, color: 'bg-yellow-400' }
  if (val <= 28) return { label: 'High potency',   dots: 3, color: 'bg-orange-400' }
  return             { label: 'Very high potency', dots: 4, color: 'bg-red-400' }
}
