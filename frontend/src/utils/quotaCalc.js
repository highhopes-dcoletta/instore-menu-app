/**
 * Massachusetts daily purchase quota calculator.
 *
 * Limit: 1 oz (28.35g) of flower or flower-equivalent per day.
 * Conversion factors are approximate — verify against current MA CCC 935 CMR 500.140.
 */

export const DAILY_LIMIT_G = 28

// Flower-equivalent grams per 1g of product, by Dutchie category.
export const CATEGORY_FACTORS = {
  FLOWER:       1,
  PRE_ROLLS:    1,
  CONCENTRATES: 7,  // 1g concentrate = 7g flower equiv (MA CCC estimate)
  VAPORIZERS:   7,  // 1g oil = 7g flower equiv
  EDIBLES:      1,  // weight-based approximation — THC-mg basis would be more accurate
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
  if (fracOz) return (parseFloat(fracOz[1]) / parseFloat(fracOz[2])) * 28.35

  // decimal oz — "1oz", "0.5oz"
  const oz = s.match(/^([\d.]+)\s*oz$/)
  if (oz) return parseFloat(oz[1]) * 28.35

  return null
}

/**
 * Compute quota usage from the current cart selections.
 *
 * @param {Object} selections - session.selections (productId → { category, unitWeight, qty, ... })
 * @returns {{ usedGrams: number, limitGrams: number, pct: number }}
 */
export function calcQuota(selections) {
  let usedGrams = 0
  for (const item of Object.values(selections)) {
    const grams = parseWeightToGrams(item.unitWeight)
    if (grams == null) continue
    const factor = CATEGORY_FACTORS[item.category] ?? 1
    usedGrams += grams * factor * (item.qty ?? 1)
  }
  return {
    usedGrams,
    limitGrams: DAILY_LIMIT_G,
    pct: Math.min(usedGrams / DAILY_LIMIT_G, 1),
  }
}
