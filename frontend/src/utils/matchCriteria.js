/**
 * Converts structured match criteria (from the bundles API) into an
 * (item) => boolean predicate function.
 *
 * Criteria fields (all optional, ANDed together):
 *   nameContains:         string[]  — item matches if name contains ANY term
 *   nameContainsAll:      string[]  — item matches if name contains ALL terms
 *   nameExcludes:         string[]  — item rejected if name contains ANY term
 *   subcategoryEquals:    string    — item.subcategory must equal this
 *   subcategoryNotEquals: string    — item.subcategory must NOT equal this
 *   unitWeightContains:   string[]  — item matches if unitWeight contains ANY term
 */
export function buildMatchFn(criteria) {
  if (!criteria || typeof criteria !== 'object') return () => true

  return (item) => {
    if (criteria.nameContains?.length) {
      const name = (item.name ?? '').toLowerCase()
      if (!criteria.nameContains.some(term => name.includes(term.toLowerCase()))) return false
    }
    if (criteria.nameContainsAll?.length) {
      const name = (item.name ?? '').toLowerCase()
      if (!criteria.nameContainsAll.every(term => name.includes(term.toLowerCase()))) return false
    }
    if (criteria.nameExcludes?.length) {
      const name = (item.name ?? '').toLowerCase()
      if (criteria.nameExcludes.some(term => name.includes(term.toLowerCase()))) return false
    }
    if (criteria.subcategoryEquals) {
      if ((item.subcategory ?? '') !== criteria.subcategoryEquals) return false
    }
    if (criteria.subcategoryNotEquals) {
      if ((item.subcategory ?? '') === criteria.subcategoryNotEquals) return false
    }
    if (criteria.unitWeightContains?.length) {
      const uw = (item.unitWeight ?? '').toLowerCase()
      if (!criteria.unitWeightContains.some(term => uw.includes(term.toLowerCase()))) return false
    }
    return true
  }
}
