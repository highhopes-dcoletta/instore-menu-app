/**
 * Massachusetts daily purchase quota calculator.
 *
 * Limit: 1 oz (28.35g) of flower or flower-equivalent per day.
 * Conversion factors are approximate — verify against current MA CCC 935 CMR 500.140.
 */

export const DAILY_LIMIT_G = 28

// Flower-equivalent grams per 1g of product, by Dutchie category.
// Edibles: unit weight is THC content in mg. parseWeightToGrams converts mg→g,
// so factor must be 56 to get: 0.1g (100mg) × 56 = 5.6g flower equiv.
export const CATEGORY_FACTORS = {
  FLOWER:       1,
  PRE_ROLLS:    1,
  CONCENTRATES: 5.6,  // 1g concentrate = 5.6g flower equiv
  VAPORIZERS:   5.6,  // 1g oil = 5.6g flower equiv
  EDIBLES:      56,   // unit weight is mg THC; 100mg THC = 5.6g flower equiv
  TINCTURES:    1,
}

/**
 * Parse a unit weight string to grams.
 * Returns null if the string can't be meaningfully converted (e.g. "20pk").
 *
 * Handles: "3.5g", "1g", "100mg", "1/8oz", "1/4oz", "1oz", "0.5oz"
 */
export function parseWeightToGrams(str) {
  if (!str) return null
  const s = str.trim().toLowerCase()

  // milligrams — "100mg", "500mg"
  const mg = s.match(/^([\d.]+)\s*mg$/)
  if (mg) return parseFloat(mg[1]) / 1000

  // grams — "3.5g", "1g"
  const g = s.match(/^([\d.]+)\s*g$/)
  if (g) return parseFloat(g[1])

  // fractional oz — "1/8oz", "1/4oz", "1/2oz"
  const fracOz = s.match(/^(\d+)\/(\d+)\s*oz$/)
  if (fracOz) return (parseFloat(fracOz[1]) / parseFloat(fracOz[2])) * 28

  // decimal oz — "1oz", "0.5oz"
  const oz = s.match(/^([\d.]+)\s*oz$/)
  if (oz) return parseFloat(oz[1]) * 28

  return null
}

/**
 * Compute quota usage from the current cart selections.
 *
 * @param {Object} selections - session.selections (productId → { category, unitWeight, qty, ... })
 * @param {Object} [options] - optional overrides for regulatory constants
 * @param {number} [options.dailyLimitG] - daily limit in grams (default: DAILY_LIMIT_G)
 * @param {Object} [options.categoryFactors] - category conversion factors (default: CATEGORY_FACTORS)
 * @returns {{ usedGrams: number, limitGrams: number, pct: number, overLimit: boolean }}
 */
export function calcQuota(selections, { dailyLimitG, categoryFactors } = {}) {
  const limit = dailyLimitG ?? DAILY_LIMIT_G
  const factors = categoryFactors ?? CATEGORY_FACTORS
  let usedGrams = 0
  for (const item of Object.values(selections)) {
    const grams = parseWeightToGrams(item.unitWeight)
    if (grams == null) continue
    const factor = factors[item.category] ?? 1
    usedGrams += grams * factor * (item.qty ?? 1)
  }
  return {
    usedGrams,
    limitGrams: limit,
    pct: Math.min(usedGrams / limit, 1),
    overLimit: usedGrams > limit,
  }
}
