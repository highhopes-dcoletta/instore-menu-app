// ── Unit parsing helpers ───────────────────────────────────────────────────────

const OZ_TO_G = 28.3495

/**
 * Parse a piece count from a product name, e.g. "Wana Gummies 20pk" → 20,
 * "1906 Love Tablet 30-pack" → 30, "Mindy's 20pack" → 20.
 */
export function parseCountFromName(name) {
  if (!name) return null
  const m = String(name).match(/\b(\d+)[-\s]?(?:pk|pack|pc|pcs|piece|pieces)\b/i)
  return m ? parseInt(m[1], 10) : null
}

/**
 * Parse a quantity from a Unit Weight string, always in grams for weight units.
 * Returns grams for weight units, count for piece units, or null if unparseable.
 * Examples: "1g" → 1, "3.5g" → 3.5, "1oz" → 28.35, "1/8oz" → 3.54,
 *           "10 ct" → 10, "5-pk" → 5
 */
export function parseQuantity(unitWeight) {
  if (!unitWeight) return null
  const s = String(unitWeight).trim()
  // Grams: "1g", "3.5g", "0.5g"
  const grams = s.match(/^(\d*\.?\d+)\s*g$/i)
  if (grams) return parseFloat(grams[1])
  // Decimal oz: "1oz", "0.5oz", "0.25oz"
  const decOz = s.match(/^(\d+(?:\.\d+)?)\s*oz$/i)
  if (decOz) return parseFloat(decOz[1]) * OZ_TO_G
  // Fractional oz: "1/8oz", "1/4 oz", "1/2oz"
  const fracOz = s.match(/^(\d+)\/(\d+)\s*oz$/i)
  if (fracOz) return (parseInt(fracOz[1]) / parseInt(fracOz[2])) * OZ_TO_G
  // Piece counts: "10 ct", "5-pk", "10 pack"
  const count = s.match(/^(\d+)[-\s]?(?:ct|pk|pack|pcs|piece|pieces)$/i)
  if (count) return parseInt(count[1], 10)
  return null
}

/** Price divided by unit quantity (grams, piece count, or name-based count); falls back to total price. */
function pricePerUnit(product) {
  const price = product.SalePrice ?? product.Price ?? 0
  const qty = parseQuantity(product['Unit Weight'])
  if (qty && qty > 0) return price / qty
  const count = parseCountFromName(product.Name)
  return count && count > 0 ? price / count : price
}

/**
 * Returns a human-readable per-unit price label like "$12/g" or "$2.50/pc",
 * or null when the unit weight isn't parseable or the label would be redundant.
 */
export function perUnitLabel(product) {
  const price = product.SalePrice ?? product.Price
  if (!price) return null
  const uw = product['Unit Weight']
  const qty = parseQuantity(uw)
  if (qty) {
    const isWeight = /(?:g|oz)$/i.test(String(uw).trim())
    if (!isWeight && qty <= 1) return null
    const unit = isWeight ? 'g' : 'pc'
    const per = price / qty
    const formatted = Number.isInteger(per) ? per : per.toFixed(2)
    return `$${formatted}/${unit}`
  }
  // Fallback: piece count from product name (e.g. Dutchie edibles with "100mg" unit weight)
  const count = parseCountFromName(product.Name)
  if (count && count > 1) {
    const per = price / count
    const formatted = Number.isInteger(per) ? per : per.toFixed(2)
    return `$${formatted}/pc`
  }
  return null
}

export const GROUPERS = [
  {
    key: 'potency',
    icon: '⚡',
    label: 'Potency',
    groupDefs: [
      { key: 'mild',        label: 'Mild',        sub: '≤12% THC',   bg: '#0d2618', accent: '#22c55e' },
      { key: 'moderate',    label: 'Moderate',    sub: '12–20% THC', bg: '#2a1f08', accent: '#eab308' },
      { key: 'strong',      label: 'Strong',      sub: '20–28% THC', bg: '#2a0e08', accent: '#f97316' },
      { key: 'very-strong', label: 'Very Strong', sub: '28%+ THC',   bg: '#1e0808', accent: '#ef4444' },
    ],
    groupFn(product) {
      const p = product.Potency ?? 0
      if (p <= 12) return 'mild'
      if (p <= 20) return 'moderate'
      if (p <= 28) return 'strong'
      return 'very-strong'
    },
  },
  {
    key: 'vape-potency',
    icon: '⚡',
    label: 'Potency',
    groupDefs: [
      { key: 'mild',        label: 'Mild',        sub: 'Under 80%',  bg: '#0d2618', accent: '#22c55e' },
      { key: 'standard',   label: 'Standard',    sub: '80–85%',     bg: '#2a1f08', accent: '#eab308' },
      { key: 'strong',     label: 'Strong',      sub: '85–90%',     bg: '#2a0e08', accent: '#f97316' },
      { key: 'very-strong', label: 'Very Strong', sub: '90%+',      bg: '#1e0808', accent: '#ef4444' },
    ],
    groupFn(product) {
      const p = product.Potency ?? 0
      if (p < 80) return 'mild'
      if (p < 85) return 'standard'
      if (p < 90) return 'strong'
      return 'very-strong'
    },
  },
  {
    key: 'strain',
    icon: '🌿',
    label: 'Strain',
    groupDefs: [
      { key: 'sativa',  label: 'Sativa',  sub: 'Uplifting & energetic', bg: '#2a1a06', accent: '#f97316' },
      { key: 'hybrid',  label: 'Hybrid',  sub: 'Balanced effects',      bg: '#0d2010', accent: '#22c55e' },
      { key: 'indica',  label: 'Indica',  sub: 'Relaxing & calming',    bg: '#1a0d2a', accent: '#a855f7' },
      { key: 'cbd',     label: 'CBD',     sub: 'Low THC, high CBD',     bg: '#062028', accent: '#06b6d4' },
    ],
    groupFn(product) {
      const s = (product.Strain ?? '').toUpperCase()
      if (s.includes('SATIVA')) return 'sativa'
      if (s.includes('INDICA')) return 'indica'
      if (s === 'CBD') return 'cbd'
      return 'hybrid'
    },
  },
  // ── Category-specific price groupers ────────────────────────────────────
  {
    key: 'flower-price',
    icon: '💰',
    label: 'Price',
    groupDefs: [
      { key: 'a', label: 'Budget',  sub: 'Under $28', bg: '#0d2618', accent: '#22c55e' },
      { key: 'b', label: 'Mid',     sub: '$28–$35',   bg: '#2a1f08', accent: '#eab308' },
      { key: 'c', label: 'Upper',   sub: '$35–$65',   bg: '#2a0e08', accent: '#f97316' },
      { key: 'd', label: 'Premium', sub: 'Over $65',  bg: '#1e0808', accent: '#ef4444' },
    ],
    groupFn(product) {
      const p = product.SalePrice ?? product.Price ?? 0
      if (p < 28) return 'a'
      if (p <= 35) return 'b'
      if (p <= 65) return 'c'
      return 'd'
    },
  },
  {
    key: 'preroll-price',
    icon: '💰',
    label: 'Price',
    groupDefs: [
      { key: 'a', label: 'Budget',  sub: 'Under $9/g',  bg: '#0d2618', accent: '#22c55e' },
      { key: 'b', label: 'Mid',     sub: '$9–$13/g',    bg: '#2a1f08', accent: '#eab308' },
      { key: 'c', label: 'Upper',   sub: '$13–$19/g',   bg: '#2a0e08', accent: '#f97316' },
      { key: 'd', label: 'Premium', sub: 'Over $19/g',  bg: '#1e0808', accent: '#ef4444' },
    ],
    groupFn(product) {
      const p = pricePerUnit(product)
      if (p < 9) return 'a'
      if (p <= 13) return 'b'
      if (p <= 19) return 'c'
      return 'd'
    },
  },
  {
    key: 'edible-price',
    icon: '💰',
    label: 'Price',
    groupDefs: [
      { key: 'a', label: 'Budget',   sub: 'Under $2/unit', bg: '#0d2618', accent: '#22c55e' },
      { key: 'b', label: 'Mid',      sub: '$2–$3/unit',    bg: '#2a1f08', accent: '#eab308' },
      { key: 'c', label: 'Standard', sub: '$3–$5/unit',    bg: '#2a0e08', accent: '#f97316' },
      { key: 'd', label: 'Premium',  sub: 'Over $5/unit',  bg: '#1e0808', accent: '#ef4444' },
    ],
    groupFn(product) {
      const p = pricePerUnit(product)
      if (p < 2) return 'a'
      if (p <= 3) return 'b'
      if (p <= 5) return 'c'
      return 'd'
    },
  },
  {
    key: 'vape-price',
    icon: '💰',
    label: 'Price',
    groupDefs: [
      { key: 'a', label: 'Budget',  sub: 'Under $32', bg: '#0d2618', accent: '#22c55e' },
      { key: 'b', label: 'Mid',     sub: '$32–$38',   bg: '#2a1f08', accent: '#eab308' },
      { key: 'c', label: 'Upper',   sub: '$38–$55',   bg: '#2a0e08', accent: '#f97316' },
      { key: 'd', label: 'Premium', sub: 'Over $55',  bg: '#1e0808', accent: '#ef4444' },
    ],
    groupFn(product) {
      const p = product.SalePrice ?? product.Price ?? 0
      if (p < 32) return 'a'
      if (p <= 38) return 'b'
      if (p <= 55) return 'c'
      return 'd'
    },
  },
  {
    key: 'dab-price',
    icon: '💰',
    label: 'Price',
    groupDefs: [
      { key: 'a', label: 'Budget',  sub: 'Under $32', bg: '#0d2618', accent: '#22c55e' },
      { key: 'b', label: 'Mid',     sub: '$32–$48',   bg: '#2a1f08', accent: '#eab308' },
      { key: 'c', label: 'Upper',   sub: '$48–$60',   bg: '#2a0e08', accent: '#f97316' },
      { key: 'd', label: 'Premium', sub: 'Over $60',  bg: '#1e0808', accent: '#ef4444' },
    ],
    groupFn(product) {
      const p = product.SalePrice ?? product.Price ?? 0
      if (p < 32) return 'a'
      if (p <= 48) return 'b'
      if (p <= 60) return 'c'
      return 'd'
    },
  },
  {
    key: 'category',
    icon: '📂',
    label: 'Category',
    groupDefs: [],  // built dynamically from products
    groupFn(product) {
      return product.Category ?? 'Other'
    },
  },
]

export function computeGroups(grouper, products) {
  // Dynamic groupDefs: build from actual product categories when groupDefs is empty
  if (grouper.groupDefs.length === 0) {
    const seen = new Set()
    const defs = []
    for (const p of products) {
      const key = grouper.groupFn(p)
      if (!seen.has(key)) {
        seen.add(key)
        defs.push({ key, label: key, sub: '', bg: '#1a1a2e', accent: '#6366f1', products: [] })
      }
    }
    defs.sort((a, b) => a.label.localeCompare(b.label))
    const map = Object.fromEntries(defs.map(g => [g.key, { ...g }]))
    for (const p of products) {
      const key = grouper.groupFn(p)
      if (map[key]) map[key].products.push(p)
    }
    return defs.map(g => map[g.key]).filter(g => g.products.length > 0)
  }
  const map = Object.fromEntries(grouper.groupDefs.map(g => [g.key, { ...g, products: [] }]))
  for (const p of products) {
    const key = grouper.groupFn(p)
    if (map[key]) map[key].products.push(p)
  }
  return grouper.groupDefs.map(g => map[g.key]).filter(g => g.products.length > 0)
}
