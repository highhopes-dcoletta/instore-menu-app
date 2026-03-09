/**
 * Scores a product against a set of answers from the guided wizard.
 * @param {Object} product
 * @param {{ effect: string, experience: string }} answers
 * @returns {number}
 */
export function scoreProduct(product, answers) {
  let score = 0
  const strain  = (product.Strain ?? '').toUpperCase()
  const cat     = product.Category ?? ''
  const potency = product.Potency ?? 0
  const tags    = product.Tags ?? []
  const { effect, experience } = answers

  if (effect === 'relax') {
    if (strain === 'INDICA') score += 4
    else if (strain === 'HYBRID') score += 2
    else if (strain === 'SATIVA') score -= 1
  } else if (effect === 'sleep') {
    if (strain === 'INDICA') score += 4
    else if (strain === 'HYBRID') score += 1
    else if (strain === 'SATIVA') score -= 2
    if (tags.includes('Sleep')) score += 5
  } else if (effect === 'energize') {
    if (strain === 'SATIVA') score += 4
    else if (strain === 'HYBRID') score += 2
    else if (strain === 'INDICA') score -= 1
  } else if (effect === 'social') {
    if (strain === 'HYBRID') score += 4
    else if (strain === 'SATIVA') score += 3
    else if (strain === 'INDICA') score += 1
    if (cat === 'EDIBLES') score += 2
  } else if (effect === 'pain') {
    if (strain === 'INDICA') score += 3
    else if (strain === 'HYBRID') score += 1
    if (['TINCTURE', 'TOPICAL'].includes(cat)) score += 4
    if (potency >= 20) score += 2
  }

  if (experience === 'new') {
    if (potency > 0 && potency <= 12) score += 3
    else if (potency >= 20) score -= 3
    if (cat === 'EDIBLES') score += 1
  } else if (experience === 'regular') {
    if (potency >= 25) score += 2
  }

  return score
}

/**
 * Returns up to 8 recommended products from the pool, scored against answers.
 * Deduplicates by name (best-scoring variant wins), breaks ties by popularity
 * rank (earlier position in pool = more popular).
 *
 * @param {Object[]} pool  - all products in Dutchie popularity order
 * @param {{ effect: string, experience: string, method: string }} answers
 * @returns {Object[]}
 */
export function getRecommendations(pool, answers) {
  const { method } = answers
  if (method === 'flower')       pool = pool.filter(p => p.Category === 'FLOWER' || p.Category === 'PRE_ROLLS')
  else if (method === 'edibles') pool = pool.filter(p => p.Category === 'EDIBLES')
  else if (method === 'vape')    pool = pool.filter(p => p.Category === 'VAPORIZERS')

  // Score and deduplicate by name (best variant per product).
  // Popularity rank = first index the name appears in pool; preserved even when
  // a later higher-scoring variant replaces the stored entry.
  const byName = new Map()
  for (let i = 0; i < pool.length; i++) {
    const p     = pool[i]
    const score = scoreProduct(p, answers)
    const existing = byName.get(p.Name)
    if (!existing || score > existing._score) {
      byName.set(p.Name, { ...p, _score: score, _rank: existing?._rank ?? i })
    }
  }

  return [...byName.values()]
    .sort((a, b) => b._score - a._score || a._rank - b._rank)
    .slice(0, 8)
}
