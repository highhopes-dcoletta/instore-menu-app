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
      { key: 'a', label: 'Budget',  sub: 'Under $8',  bg: '#0d2618', accent: '#22c55e' },
      { key: 'b', label: 'Mid',     sub: '$8–$12',    bg: '#2a1f08', accent: '#eab308' },
      { key: 'c', label: 'Upper',   sub: '$12–$22',   bg: '#2a0e08', accent: '#f97316' },
      { key: 'd', label: 'Premium', sub: 'Over $22',  bg: '#1e0808', accent: '#ef4444' },
    ],
    groupFn(product) {
      const p = product.SalePrice ?? product.Price ?? 0
      if (p < 8) return 'a'
      if (p <= 12) return 'b'
      if (p <= 22) return 'c'
      return 'd'
    },
  },
  {
    key: 'edible-price',
    icon: '💰',
    label: 'Price',
    groupDefs: [
      { key: 'a', label: 'Budget',   sub: 'Under $10', bg: '#0d2618', accent: '#22c55e' },
      { key: 'b', label: 'Mid',      sub: '$10–$20',   bg: '#2a1f08', accent: '#eab308' },
      { key: 'c', label: 'Standard', sub: '$20–$25',   bg: '#2a0e08', accent: '#f97316' },
      { key: 'd', label: 'Premium',  sub: 'Over $25',  bg: '#1e0808', accent: '#ef4444' },
    ],
    groupFn(product) {
      const p = product.SalePrice ?? product.Price ?? 0
      if (p <= 10) return 'a'
      if (p <= 20) return 'b'
      if (p <= 25) return 'c'
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
]

export function computeGroups(grouper, products) {
  const map = Object.fromEntries(grouper.groupDefs.map(g => [g.key, { ...g, products: [] }]))
  for (const p of products) {
    const key = grouper.groupFn(p)
    if (map[key]) map[key].products.push(p)
  }
  return grouper.groupDefs.map(g => map[g.key]).filter(g => g.products.length > 0)
}
