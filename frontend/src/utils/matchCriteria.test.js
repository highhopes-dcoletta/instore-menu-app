import { describe, it, expect } from 'vitest'
import { buildMatchFn } from './matchCriteria'

function makeItem(overrides = {}) {
  return { name: '', subcategory: '', unitWeight: '', price: 0, qty: 1, ...overrides }
}

describe('buildMatchFn', () => {
  it('returns a function that always matches when criteria is empty', () => {
    const fn = buildMatchFn({})
    expect(fn(makeItem({ name: 'anything' }))).toBe(true)
  })

  it('returns a function that always matches when criteria is null', () => {
    expect(buildMatchFn(null)(makeItem())).toBe(true)
  })

  // ── nameContains ──────────────────────────────────────────────────────────
  it('matches when name contains any of the terms (case-insensitive)', () => {
    const fn = buildMatchFn({ nameContains: ['juicy stickz', 'fire styxx'] })
    expect(fn(makeItem({ name: 'Juicy Stickz | Grape 1g' }))).toBe(true)
    expect(fn(makeItem({ name: 'Fire Styxx | Mango 1g' }))).toBe(true)
    expect(fn(makeItem({ name: 'Fernway | Lemon 1g' }))).toBe(false)
  })

  // ── nameExcludes ──────────────────────────────────────────────────────────
  it('rejects when name contains any excluded term', () => {
    const fn = buildMatchFn({ nameContains: ['hellavated'], nameExcludes: ['cloud bar'] })
    expect(fn(makeItem({ name: 'Hellavated | Mango Cart 1g' }))).toBe(true)
    expect(fn(makeItem({ name: 'Hellavated | Cloud Bar 1g' }))).toBe(false)
  })

  // ── subcategoryEquals ─────────────────────────────────────────────────────
  it('matches only the specified subcategory', () => {
    const fn = buildMatchFn({ subcategoryEquals: 'DRINKS' })
    expect(fn(makeItem({ subcategory: 'DRINKS' }))).toBe(true)
    expect(fn(makeItem({ subcategory: 'SINGLES' }))).toBe(false)
  })

  // ── subcategoryNotEquals ──────────────────────────────────────────────────
  it('rejects the excluded subcategory', () => {
    const fn = buildMatchFn({ nameContains: ['high hopes'], subcategoryNotEquals: 'PACKS' })
    expect(fn(makeItem({ name: 'High Hopes | OG 1g', subcategory: 'SINGLES' }))).toBe(true)
    expect(fn(makeItem({ name: 'High Hopes | 5-Pack', subcategory: 'PACKS' }))).toBe(false)
  })

  // ── unitWeightContains ────────────────────────────────────────────────────
  it('matches when unit weight contains any of the terms', () => {
    const fn = buildMatchFn({ unitWeightContains: ['1g'] })
    expect(fn(makeItem({ unitWeight: '1g' }))).toBe(true)
    expect(fn(makeItem({ unitWeight: '2g' }))).toBe(false)
  })

  // ── nameContainsAll ────────────────────────────────────────────────────────
  it('matches when name contains ALL terms (nameContainsAll)', () => {
    const fn = buildMatchFn({ nameContainsAll: ['mac', 'sugar'] })
    expect(fn(makeItem({ name: 'MAC | Sugar Wax 1g' }))).toBe(true)
    expect(fn(makeItem({ name: 'MAC | Live Resin 1g' }))).toBe(false)
    expect(fn(makeItem({ name: 'Sugar Cookie Edible' }))).toBe(false)
  })

  // ── Combined criteria (AND logic) ─────────────────────────────────────────
  it('ANDs all criteria together', () => {
    const fn = buildMatchFn({
      nameContains: ['crude boys', 'strane'],
      subcategoryEquals: 'CARTRIDGES',
    })
    expect(fn(makeItem({ name: 'Crude Boys | Cart 1g', subcategory: 'CARTRIDGES' }))).toBe(true)
    expect(fn(makeItem({ name: 'Strane | Flower 3.5g', subcategory: 'FLOWER' }))).toBe(false)
    expect(fn(makeItem({ name: 'Fernway | Cart 1g', subcategory: 'CARTRIDGES' }))).toBe(false)
  })

  // ── Real-world bundle: drinks excluding keef ──────────────────────────────
  it('handles drinks-case pattern (subcategory + name exclude)', () => {
    const fn = buildMatchFn({
      subcategoryEquals: 'DRINKS',
      nameExcludes: ['keef'],
    })
    expect(fn(makeItem({ name: 'Cann | Grapefruit Rosemary', subcategory: 'DRINKS' }))).toBe(true)
    expect(fn(makeItem({ name: 'Keef | Cola', subcategory: 'DRINKS' }))).toBe(false)
  })

  // ── Real-world bundle: HH 1g pre-rolls not packs ─────────────────────────
  it('handles hh-1g-preroll pattern (name + weight + subcategory exclude)', () => {
    const fn = buildMatchFn({
      nameContains: ['high hopes'],
      unitWeightContains: ['1g'],
      subcategoryNotEquals: 'PACKS',
    })
    expect(fn(makeItem({ name: 'High Hopes | OG 1g', unitWeight: '1g', subcategory: 'SINGLES' }))).toBe(true)
    expect(fn(makeItem({ name: 'High Hopes | 5-Pack', unitWeight: '1g', subcategory: 'PACKS' }))).toBe(false)
    expect(fn(makeItem({ name: 'Valorem | Lemon 1g', unitWeight: '1g', subcategory: 'SINGLES' }))).toBe(false)
  })
})
