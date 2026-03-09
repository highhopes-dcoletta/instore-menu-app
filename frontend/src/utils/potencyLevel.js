/**
 * Returns a potency display descriptor for a product.
 * Accounts for edible mg dosing, vape-specific % ranges, and standard flower % ranges.
 */
export function getPotencyLevel(product) {
  const val  = product.Potency
  const unit = product['Potency Unit']
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
