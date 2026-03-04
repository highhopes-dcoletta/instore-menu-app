export const STRAIN_LABELS = {
  INDICA: 'Indica',
  SATIVA: 'Sativa',
  HYBRID: 'Hybrid',
  SATIVA_HYBRID: 'Sativa Leaning',
  INDICA_HYBRID: 'Indica Leaning',
  HIGH_CBD: 'High CBD',
  THC: 'THC',
  TWO_TO_ONE: '2:1',
  ONE_TO_ONE: '1:1',
  'N/A': 'N/A',
  NOT_APPLICABLE: 'N/A',
}

export function strainLabel(raw) {
  if (!raw) return '—'
  return STRAIN_LABELS[raw] ?? raw
}
