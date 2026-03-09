import { describe, it, expect } from 'vitest'
import { GROUPERS, computeGroups } from './useProductGrouping'

const grouperByKey = (key) => GROUPERS.find(g => g.key === key)

// ─── Helpers ─────────────────────────────────────────────────────────────────

const p = (overrides) => ({ Potency: 15, Strain: 'HYBRID', Price: 30, SalePrice: null, Category: 'FLOWER', ...overrides })

// ─── Potency grouper (flower %) ───────────────────────────────────────────────

describe('potency grouper', () => {
  const g = grouperByKey('potency')

  it('≤12% → mild', () => expect(g.groupFn(p({ Potency: 12 }))).toBe('mild'))
  it('13% → moderate', () => expect(g.groupFn(p({ Potency: 13 }))).toBe('moderate'))
  it('20% → moderate', () => expect(g.groupFn(p({ Potency: 20 }))).toBe('moderate'))
  it('21% → strong', () => expect(g.groupFn(p({ Potency: 21 }))).toBe('strong'))
  it('28% → strong', () => expect(g.groupFn(p({ Potency: 28 }))).toBe('strong'))
  it('29% → very-strong', () => expect(g.groupFn(p({ Potency: 29 }))).toBe('very-strong'))
  it('null Potency defaults to mild', () => expect(g.groupFn(p({ Potency: null }))).toBe('mild'))
})

// ─── Vape potency grouper ─────────────────────────────────────────────────────

describe('vape-potency grouper', () => {
  const g = grouperByKey('vape-potency')

  it('<80 → mild', () => expect(g.groupFn(p({ Potency: 79 }))).toBe('mild'))
  it('80 → standard', () => expect(g.groupFn(p({ Potency: 80 }))).toBe('standard'))
  it('85 → strong', () => expect(g.groupFn(p({ Potency: 85 }))).toBe('strong'))
  it('90 → very-strong', () => expect(g.groupFn(p({ Potency: 90 }))).toBe('very-strong'))
})

// ─── Strain grouper ───────────────────────────────────────────────────────────

describe('strain grouper', () => {
  const g = grouperByKey('strain')

  it('SATIVA → sativa', () => expect(g.groupFn(p({ Strain: 'SATIVA' }))).toBe('sativa'))
  it('SATIVA DOMINANT HYBRID → sativa (includes SATIVA)', () => expect(g.groupFn(p({ Strain: 'SATIVA DOMINANT HYBRID' }))).toBe('sativa'))
  it('INDICA → indica', () => expect(g.groupFn(p({ Strain: 'INDICA' }))).toBe('indica'))
  it('INDICA DOMINANT HYBRID → indica (includes INDICA)', () => expect(g.groupFn(p({ Strain: 'INDICA DOMINANT HYBRID' }))).toBe('indica'))
  it('CBD → cbd', () => expect(g.groupFn(p({ Strain: 'CBD' }))).toBe('cbd'))
  it('HYBRID → hybrid (default)', () => expect(g.groupFn(p({ Strain: 'HYBRID' }))).toBe('hybrid'))
  it('null Strain → hybrid (default)', () => expect(g.groupFn(p({ Strain: null }))).toBe('hybrid'))
})

// ─── Flower price grouper ─────────────────────────────────────────────────────

describe('flower-price grouper', () => {
  const g = grouperByKey('flower-price')

  it('<$28 → budget', () => expect(g.groupFn(p({ Price: 20 }))).toBe('a'))
  it('$28 → mid', () => expect(g.groupFn(p({ Price: 28 }))).toBe('b'))
  it('$35 → mid', () => expect(g.groupFn(p({ Price: 35 }))).toBe('b'))
  it('$36 → upper', () => expect(g.groupFn(p({ Price: 36 }))).toBe('c'))
  it('$65 → upper', () => expect(g.groupFn(p({ Price: 65 }))).toBe('c'))
  it('>$65 → premium', () => expect(g.groupFn(p({ Price: 80 }))).toBe('d'))
  it('uses SalePrice over Price', () => expect(g.groupFn(p({ Price: 80, SalePrice: 20 }))).toBe('a'))
})

// ─── computeGroups ────────────────────────────────────────────────────────────

describe('computeGroups', () => {
  const potencyGrouper = grouperByKey('potency')

  it('buckets products into correct groups', () => {
    const products = [
      p({ Potency: 10, id: 'mild1' }),
      p({ Potency: 15, id: 'mod1' }),
      p({ Potency: 25, id: 'str1' }),
    ]
    const groups = computeGroups(potencyGrouper, products)
    const keys = groups.map(g => g.key)
    expect(keys).toContain('mild')
    expect(keys).toContain('moderate')
    expect(keys).toContain('strong')
    expect(keys).not.toContain('very-strong') // no product in that bucket
  })

  it('filters out empty groups', () => {
    const products = [p({ Potency: 10 })]
    const groups = computeGroups(potencyGrouper, products)
    expect(groups).toHaveLength(1)
    expect(groups[0].key).toBe('mild')
  })

  it('each group includes the correct products', () => {
    const mild = p({ Potency: 5, id: 'a' })
    const strong = p({ Potency: 25, id: 'b' })
    const groups = computeGroups(potencyGrouper, [mild, strong])
    const mildGroup = groups.find(g => g.key === 'mild')
    const strongGroup = groups.find(g => g.key === 'strong')
    expect(mildGroup.products).toContainEqual(mild)
    expect(strongGroup.products).toContainEqual(strong)
  })

  it('preserves groupDefs metadata on returned groups', () => {
    const groups = computeGroups(potencyGrouper, [p({ Potency: 10 })])
    expect(groups[0].label).toBeDefined()
    expect(groups[0].accent).toBeDefined()
    expect(groups[0].bg).toBeDefined()
  })

  it('empty product list returns no groups', () => {
    expect(computeGroups(potencyGrouper, [])).toHaveLength(0)
  })
})
