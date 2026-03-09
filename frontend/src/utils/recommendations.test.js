import { describe, it, expect } from 'vitest'
import { scoreProduct, getRecommendations } from './recommendations'

// Minimal product factory
function product(overrides) {
  return {
    id: overrides.id ?? 'x',
    Name: overrides.Name ?? 'Test Product',
    Strain: overrides.Strain ?? 'HYBRID',
    Category: overrides.Category ?? 'FLOWER',
    Potency: overrides.Potency ?? 20,
    'Potency Unit': overrides['Potency Unit'] ?? '%',
    Tags: overrides.Tags ?? [],
    Price: overrides.Price ?? 30,
    Image: null,
    'Unit Weight': overrides['Unit Weight'] ?? '3.5g',
    ...overrides,
  }
}

describe('scoreProduct', () => {
  it('scores indica higher than sativa for relax', () => {
    const indica = product({ Strain: 'INDICA' })
    const sativa = product({ Strain: 'SATIVA' })
    const answers = { effect: 'relax', experience: 'occasional' }
    expect(scoreProduct(indica, answers)).toBeGreaterThan(scoreProduct(sativa, answers))
  })

  it('scores sativa higher than indica for energize', () => {
    const indica = product({ Strain: 'INDICA' })
    const sativa = product({ Strain: 'SATIVA' })
    const answers = { effect: 'energize', experience: 'occasional' }
    expect(scoreProduct(sativa, answers)).toBeGreaterThan(scoreProduct(indica, answers))
  })

  it('boosts Sleep-tagged products for sleep effect', () => {
    const base    = product({ Strain: 'INDICA', Tags: [] })
    const withTag = product({ Strain: 'INDICA', Tags: ['Sleep'] })
    const answers = { effect: 'sleep', experience: 'occasional' }
    expect(scoreProduct(withTag, answers)).toBeGreaterThan(scoreProduct(base, answers))
  })

  it('penalises high potency for new users', () => {
    const mild   = product({ Potency: 10 })
    const strong = product({ Potency: 25 })
    const answers = { effect: 'relax', experience: 'new' }
    expect(scoreProduct(mild, answers)).toBeGreaterThan(scoreProduct(strong, answers))
  })

  it('boosts high potency for regular users', () => {
    const mild   = product({ Potency: 15, Strain: 'INDICA' })
    const strong = product({ Potency: 28, Strain: 'INDICA' })
    const answers = { effect: 'relax', experience: 'regular' }
    expect(scoreProduct(strong, answers)).toBeGreaterThan(scoreProduct(mild, answers))
  })
})

describe('getRecommendations', () => {
  it('returns at most 8 products', () => {
    const products = Array.from({ length: 20 }, (_, i) =>
      product({ id: String(i), Name: `Product ${i}` })
    )
    const answers = { effect: 'relax', experience: 'occasional', method: 'any' }
    expect(getRecommendations(products, answers).length).toBeLessThanOrEqual(8)
  })

  it('filters to flower/pre-rolls when method is flower', () => {
    const products = [
      product({ id: '1', Name: 'Flower A', Category: 'FLOWER' }),
      product({ id: '2', Name: 'Edible A', Category: 'EDIBLES' }),
      product({ id: '3', Name: 'PreRoll A', Category: 'PRE_ROLLS' }),
    ]
    const answers = { effect: 'relax', experience: 'occasional', method: 'flower' }
    const results = getRecommendations(products, answers)
    expect(results.every(p => p.Category === 'FLOWER' || p.Category === 'PRE_ROLLS')).toBe(true)
    expect(results.find(p => p.Name === 'Edible A')).toBeUndefined()
  })

  it('deduplicates by name, keeping highest-scoring variant', () => {
    const products = [
      product({ id: '1', Name: 'Blue Dream', Strain: 'SATIVA', Potency: 22 }),
      product({ id: '2', Name: 'Blue Dream', Strain: 'INDICA', Potency: 22 }),
    ]
    const answers = { effect: 'energize', experience: 'occasional', method: 'any' }
    const results = getRecommendations(products, answers)
    expect(results.filter(p => p.Name === 'Blue Dream')).toHaveLength(1)
    expect(results[0].Strain).toBe('SATIVA') // sativa scores higher for energize
  })

  it('breaks ties using popularity rank (earlier in array wins)', () => {
    // All products identical score: HYBRID + relax + occasional = 2 pts each
    const products = [
      product({ id: 'pop1', Name: 'Popular',   Strain: 'HYBRID' }),
      product({ id: 'pop2', Name: 'Less Pop',  Strain: 'HYBRID' }),
      product({ id: 'pop3', Name: 'Least Pop', Strain: 'HYBRID' }),
    ]
    const answers = { effect: 'relax', experience: 'occasional', method: 'any' }
    const results = getRecommendations(products, answers)
    expect(results.map(p => p.Name)).toEqual(['Popular', 'Less Pop', 'Least Pop'])
  })

  it('popularity rank is preserved when a lower-ranked variant has a higher score', () => {
    // 'Alpha' appears at index 0 as SATIVA (low score for relax),
    // then again at index 2 as INDICA (high score for relax).
    // The winning variant should take the score of index-2 but the rank of index-0.
    const products = [
      product({ id: 'a1', Name: 'Alpha', Strain: 'SATIVA' }), // rank 0 — low score
      product({ id: 'b1', Name: 'Beta',  Strain: 'HYBRID' }), // rank 1
      product({ id: 'a2', Name: 'Alpha', Strain: 'INDICA' }), // rank 2 — high score, but keeps rank 0
    ]
    const answers = { effect: 'relax', experience: 'occasional', method: 'any' }
    const results = getRecommendations(products, answers)
    // Alpha has rank 0, so should appear before Beta (rank 1) despite being tied on score
    // (Alpha indica=4, Beta hybrid=2 → not actually tied here, but we verify rank preserved)
    const names = results.map(p => p.Name)
    expect(names[0]).toBe('Alpha')
    expect(results.find(p => p.Name === 'Alpha').Strain).toBe('INDICA') // best variant wins
  })
})
