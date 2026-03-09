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
  {
    key: 'price',
    icon: '💰',
    label: 'Price',
    groupDefs: [
      { key: 'value',   label: 'Value',   sub: 'Under $20',  bg: '#0d2618', accent: '#22c55e' },
      { key: 'mid',     label: 'Mid',     sub: '$20–$50',    bg: '#0a1a28', accent: '#38bdf8' },
      { key: 'premium', label: 'Premium', sub: 'Over $50',   bg: '#1a0828', accent: '#c084fc' },
    ],
    groupFn(product) {
      const price = product.SalePrice ?? product.Price ?? 0
      if (price < 20) return 'value'
      if (price <= 50) return 'mid'
      return 'premium'
    },
  },
]

export function computeGroups(grouper, products) {
  const map = Object.fromEntries(grouper.groupDefs.map(g => [g.key, { ...g, products: [] }]))
  for (const p of products) {
    const key = grouper.groupFn(p)
    if (map[key]) map[key].products.push(p)
  }
  return grouper.groupDefs.map(g => map[g.key]).filter(g => g.products.length > 0)
}
