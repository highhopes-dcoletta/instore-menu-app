import { describe, it, expect } from 'vitest'
import { GROUPERS, computeGroups, parseQuantity, perUnitLabel, parseCountFromName } from './useProductGrouping'

const grouperByKey = (key) => GROUPERS.find(g => g.key === key)

// ─── Helpers ─────────────────────────────────────────────────────────────────

const p = (overrides) => ({ Potency: 15, Strain: 'HYBRID', Price: 30, SalePrice: null, Category: 'FLOWER', ...overrides })

// ─── parseCountFromName ───────────────────────────────────────────────────────

describe('parseCountFromName', () => {
  it('parses "20pk"',    () => expect(parseCountFromName('Wana Gummies 20pk')).toBe(20))
  it('parses "20pack"',  () => expect(parseCountFromName('Mindy\'s Honey 20pack')).toBe(20))
  it('parses "30-pack"', () => expect(parseCountFromName('1906 Love Tablet 30-pack')).toBe(30))
  it('parses "30pc"',    () => expect(parseCountFromName('1906 Love Tablet 30pc - 75mg')).toBe(30))
  it('parses "5-pk"',    () => expect(parseCountFromName('Some Product 5-pk')).toBe(5))
  it('ignores brand numbers like "1906"', () => expect(parseCountFromName('1906 Go Tablet - 1:1')).toBeNull())
  it('returns null for no count',        () => expect(parseCountFromName('Single Gummy Bar')).toBeNull())
  it('returns null for null input',      () => expect(parseCountFromName(null)).toBeNull())
})

// ─── parseQuantity ────────────────────────────────────────────────────────────

describe('parseQuantity', () => {
  it('parses grams', () => expect(parseQuantity('1g')).toBe(1))
  it('parses decimal grams', () => expect(parseQuantity('3.5g')).toBe(3.5))
  it('parses grams with no leading zero', () => expect(parseQuantity('.5g')).toBe(0.5))
  it('parses grams with space', () => expect(parseQuantity('0.5 g')).toBeCloseTo(0.5))
  it('parses decimal oz', () => expect(parseQuantity('1oz')).toBeCloseTo(28.35, 1))
  it('parses 0.5oz', () => expect(parseQuantity('0.5oz')).toBeCloseTo(14.17, 1))
  it('parses 1/8oz', () => expect(parseQuantity('1/8oz')).toBeCloseTo(3.54, 1))
  it('parses 1/4oz', () => expect(parseQuantity('1/4oz')).toBeCloseTo(7.09, 1))
  it('parses 1/4 oz with space', () => expect(parseQuantity('1/4 oz')).toBeCloseTo(7.09, 1))
  it('parses 1/2oz', () => expect(parseQuantity('1/2oz')).toBeCloseTo(14.17, 1))
  it('parses ct count', () => expect(parseQuantity('10 ct')).toBe(10))
  it('parses pk count', () => expect(parseQuantity('5-pk')).toBe(5))
  it('returns null for unknown', () => expect(parseQuantity('100mg')).toBeNull())
  it('returns null for null input', () => expect(parseQuantity(null)).toBeNull())
})

// ─── perUnitLabel ─────────────────────────────────────────────────────────────

describe('perUnitLabel', () => {
  const prod = (Price, uw) => ({ Price, SalePrice: null, 'Unit Weight': uw })
  it('1g @ $12 → $12/g', () => expect(perUnitLabel(prod(12, '1g'))).toBe('$12/g'))
  it('5g @ $45 → $9/g', () => expect(perUnitLabel(prod(45, '5g'))).toBe('$9/g'))
  it('1oz @ $200 → ~$7.06/g', () => expect(perUnitLabel(prod(200, '1oz'))).toBeTruthy())
  it('1/8oz @ $30 → shows /g label', () => expect(perUnitLabel(prod(30, '1/8oz'))).toMatch(/\/g$/))
  it('10 ct @ $25 → $2.50/pc', () => expect(perUnitLabel(prod(25, '10 ct'))).toBe('$2.50/pc'))
  it('1 ct → null (redundant)', () => expect(perUnitLabel(prod(10, '1 ct'))).toBeNull())
  it('null unit weight → null', () => expect(perUnitLabel(prod(10, null))).toBeNull())
})

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

// ─── Pre-roll price grouper (per gram) ───────────────────────────────────────

describe('preroll-price grouper — price per gram', () => {
  const g = grouperByKey('preroll-price')
  const pr = (Price, unitWeight, SalePrice = null) =>
    p({ Price, SalePrice, 'Unit Weight': unitWeight })

  it('1g @ $8 → budget ($8/g)', () => expect(g.groupFn(pr(8, '1g'))).toBe('a'))
  it('1g @ $9 → mid ($9/g)', () => expect(g.groupFn(pr(9, '1g'))).toBe('b'))
  it('1g @ $13 → mid ($13/g)', () => expect(g.groupFn(pr(13, '1g'))).toBe('b'))
  it('1g @ $14 → upper ($14/g)', () => expect(g.groupFn(pr(14, '1g'))).toBe('c'))
  it('1g @ $19 → upper ($19/g)', () => expect(g.groupFn(pr(19, '1g'))).toBe('c'))
  it('1g @ $20 → premium ($20/g)', () => expect(g.groupFn(pr(20, '1g'))).toBe('d'))

  it('5-pack 5g @ $45 → mid ($9/g, same as a $9 single)', () =>
    expect(g.groupFn(pr(45, '5g'))).toBe('b'))
  it('5-pack 5g @ $65 → mid ($13/g)', () =>
    expect(g.groupFn(pr(65, '5g'))).toBe('b'))
  it('5-pack 5g @ $50 → upper ($10/g)', () =>
    expect(g.groupFn(pr(50, '5g'))).toBe('b'))
  it('5-pack 5g @ $100 → premium ($20/g)', () =>
    expect(g.groupFn(pr(100, '5g'))).toBe('d'))

  it('uses SalePrice over Price', () =>
    expect(g.groupFn(pr(25, '1g', 8))).toBe('a'))

  it('no Unit Weight falls back to total price', () =>
    expect(g.groupFn(pr(10, null))).toBe('b'))
})

// ─── Edible price grouper (per unit) ─────────────────────────────────────────

describe('edible-price grouper — price per unit', () => {
  const g = grouperByKey('edible-price')
  const ed = (Price, unitWeight, SalePrice = null) =>
    p({ Price, SalePrice, 'Unit Weight': unitWeight })

  it('10 ct @ $20 → mid ($2/unit)', () => expect(g.groupFn(ed(20, '10 ct'))).toBe('b'))
  it('10 ct @ $25 → standard ($2.50/unit)', () => expect(g.groupFn(ed(25, '10 ct'))).toBe('b'))
  it('10 ct @ $30 → standard ($3/unit)', () => expect(g.groupFn(ed(30, '10 ct'))).toBe('b'))
  it('10 ct @ $35 → premium ($3.50/unit)', () => expect(g.groupFn(ed(35, '10 ct'))).toBe('c'))
  it('10 ct @ $50 → premium ($5/unit)', () => expect(g.groupFn(ed(50, '10 ct'))).toBe('c'))
  it('10 ct @ $60 → premium ($6/unit)', () => expect(g.groupFn(ed(60, '10 ct'))).toBe('d'))
  it('2-pk @ $10 → standard ($5/unit)', () => expect(g.groupFn(ed(10, '2-pk'))).toBe('c'))
  it('1g @ $2 → mid ($2/g)', () => expect(g.groupFn(ed(2, '1g'))).toBe('b'))

  it('uses SalePrice over Price', () =>
    expect(g.groupFn(ed(60, '10 ct', 15))).toBe('a'))

  it('no Unit Weight falls back to total price', () =>
    expect(g.groupFn(ed(3, null))).toBe('b'))
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
