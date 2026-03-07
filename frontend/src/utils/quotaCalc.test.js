import { describe, it, expect } from 'vitest'
import { parseWeightToGrams, calcQuota, DAILY_LIMIT_G, CATEGORY_FACTORS } from './quotaCalc'

describe('parseWeightToGrams', () => {
  it('parses grams', () => {
    expect(parseWeightToGrams('3.5g')).toBeCloseTo(3.5)
    expect(parseWeightToGrams('1g')).toBeCloseTo(1)
    expect(parseWeightToGrams('7g')).toBeCloseTo(7)
  })

  it('parses milligrams', () => {
    expect(parseWeightToGrams('100mg')).toBeCloseTo(0.1)
    expect(parseWeightToGrams('500mg')).toBeCloseTo(0.5)
  })

  it('parses fractional oz', () => {
    expect(parseWeightToGrams('1/8oz')).toBeCloseTo(3.54, 1)
    expect(parseWeightToGrams('1/4oz')).toBeCloseTo(7.09, 1)
    expect(parseWeightToGrams('1/2oz')).toBeCloseTo(14.18, 1)
  })

  it('parses whole oz', () => {
    expect(parseWeightToGrams('1oz')).toBeCloseTo(28.35)
    expect(parseWeightToGrams('0.5oz')).toBeCloseTo(14.175)
  })

  it('handles whitespace and case', () => {
    expect(parseWeightToGrams('3.5 G')).toBeCloseTo(3.5)
    expect(parseWeightToGrams('100 MG')).toBeCloseTo(0.1)
    expect(parseWeightToGrams('1/8 OZ')).toBeCloseTo(3.54, 1)
  })

  it('returns null for unparseable strings', () => {
    expect(parseWeightToGrams('20pk')).toBeNull()
    expect(parseWeightToGrams('assorted')).toBeNull()
    expect(parseWeightToGrams('')).toBeNull()
    expect(parseWeightToGrams(null)).toBeNull()
    expect(parseWeightToGrams(undefined)).toBeNull()
  })
})

describe('CATEGORY_FACTORS', () => {
  it('flower and pre-rolls are 1:1', () => {
    expect(CATEGORY_FACTORS.FLOWER).toBe(1)
    expect(CATEGORY_FACTORS.PRE_ROLLS).toBe(1)
  })

  it('concentrates and vaporizers have higher factor', () => {
    expect(CATEGORY_FACTORS.CONCENTRATES).toBeGreaterThan(1)
    expect(CATEGORY_FACTORS.VAPORIZERS).toBeGreaterThan(1)
  })
})

describe('calcQuota', () => {
  it('returns zero for empty cart', () => {
    const { usedGrams, pct } = calcQuota({})
    expect(usedGrams).toBe(0)
    expect(pct).toBe(0)
  })

  it('calculates flower correctly', () => {
    const { usedGrams } = calcQuota({
      p1: { category: 'FLOWER', unitWeight: '3.5g', qty: 1 },
    })
    expect(usedGrams).toBeCloseTo(3.5)
  })

  it('applies qty multiplier', () => {
    const { usedGrams } = calcQuota({
      p1: { category: 'FLOWER', unitWeight: '3.5g', qty: 2 },
    })
    expect(usedGrams).toBeCloseTo(7)
  })

  it('applies concentrate conversion factor', () => {
    const { usedGrams } = calcQuota({
      p1: { category: 'CONCENTRATES', unitWeight: '1g', qty: 1 },
    })
    expect(usedGrams).toBeCloseTo(CATEGORY_FACTORS.CONCENTRATES)
  })

  it('sums multiple items across categories', () => {
    const { usedGrams } = calcQuota({
      p1: { category: 'FLOWER',       unitWeight: '3.5g', qty: 1 },  // 3.5g
      p2: { category: 'CONCENTRATES', unitWeight: '1g',   qty: 1 },  // 7g
    })
    expect(usedGrams).toBeCloseTo(10.5)
  })

  it('skips items with unparseable weights', () => {
    const { usedGrams } = calcQuota({
      p1: { category: 'FLOWER', unitWeight: '3.5g', qty: 1 },
      p2: { category: 'EDIBLES', unitWeight: '20pk', qty: 1 },
    })
    expect(usedGrams).toBeCloseTo(3.5)
  })

  it('clamps pct to 1 when over limit', () => {
    const { pct } = calcQuota({
      p1: { category: 'FLOWER', unitWeight: '1oz', qty: 2 },
    })
    expect(pct).toBe(1)
  })

  it('reports limitGrams as the MA daily limit', () => {
    const { limitGrams } = calcQuota({})
    expect(limitGrams).toBe(28)
  })

  it('uses factor 1 for unknown categories', () => {
    const { usedGrams } = calcQuota({
      p1: { category: 'UNKNOWN_FUTURE_CATEGORY', unitWeight: '1g', qty: 1 },
    })
    expect(usedGrams).toBeCloseTo(1)
  })
})
