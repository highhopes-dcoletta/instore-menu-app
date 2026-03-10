import { describe, it, expect } from 'vitest'
import { getPotencyLevel, perItemPotency } from './potencyLevel'

describe('getPotencyLevel', () => {
  describe('returns null when no potency', () => {
    it('null Potency', () => expect(getPotencyLevel({ Potency: null })).toBeNull())
    it('undefined Potency', () => expect(getPotencyLevel({ Potency: undefined })).toBeNull())
    it('zero Potency', () => expect(getPotencyLevel({ Potency: 0 })).toBeNull())
  })

  describe('edibles (mg unit) — single item', () => {
    const e = (mg, uw = null) => ({ Potency: mg, 'Potency Unit': 'mg', 'Unit Weight': uw })
    it('≤5mg → Low dose, 1 dot', () => {
      const r = getPotencyLevel(e(5))
      expect(r.label).toBe('Low dose')
      expect(r.dots).toBe(1)
      expect(r.color).toBe('bg-green-400')
    })
    it('10mg → Medium dose, 2 dots', () => expect(getPotencyLevel(e(10)).label).toBe('Medium dose'))
    it('20mg → High dose, 3 dots',   () => expect(getPotencyLevel(e(20)).label).toBe('High dose'))
    it('>20mg → Very high dose, 4 dots', () => {
      const r = getPotencyLevel(e(100))
      expect(r.label).toBe('Very high dose')
      expect(r.dots).toBe(4)
      expect(r.color).toBe('bg-red-400')
    })
  })

  describe('edibles (mg unit) — multi-piece packages', () => {
    const e = (totalMg, uw, name = 'Test') => ({ Name: name, Potency: totalMg, 'Potency Unit': 'mg', 'Unit Weight': uw })

    it('100mg total / 10 ct → 10mg per piece → Medium dose', () =>
      expect(getPotencyLevel(e(100, '10 ct')).label).toBe('Medium dose'))
    it('50mg total / 5-pk → 10mg per piece → Medium dose', () =>
      expect(getPotencyLevel(e(50, '5-pk')).label).toBe('Medium dose'))
    it('200mg total / 10 ct → 20mg per piece → High dose', () =>
      expect(getPotencyLevel(e(200, '10 ct')).label).toBe('High dose'))
    it('5mg total / 1 ct → 5mg per piece → Low dose', () =>
      expect(getPotencyLevel(e(5, '1 ct')).label).toBe('Low dose'))
    it('gram-based unit weight falls back to name-based count', () =>
      expect(getPotencyLevel(e(100, '100mg', 'Wana Gummies 20pk')).label).toBe('Low dose'))
    it('100mg total / name "20pk" → 5mg per piece → Low dose', () =>
      expect(getPotencyLevel(e(100, '100mg', 'Wana Limoncello 20pk')).label).toBe('Low dose'))
    it('75mg total / name "30-pack" → 2.5mg per piece → Low dose', () =>
      expect(getPotencyLevel(e(75, '75mg', '1906 Love Tablet 30-pack')).label).toBe('Low dose'))
  })

  describe('perItemPotency', () => {
    it('non-mg returns raw value unchanged', () =>
      expect(perItemPotency({ Potency: 25, 'Potency Unit': '%' })).toBe(25))
    it('mg with no unit weight or name count returns raw value', () =>
      expect(perItemPotency({ Name: 'Single Gummy', Potency: 10, 'Potency Unit': 'mg', 'Unit Weight': null })).toBe(10))
    it('mg with 10 ct divides by 10', () =>
      expect(perItemPotency({ Potency: 100, 'Potency Unit': 'mg', 'Unit Weight': '10 ct' })).toBe(10))
    it('mg with gram unit weight falls back to name count', () =>
      expect(perItemPotency({ Name: 'Wana Gummies 20pk', Potency: 100, 'Potency Unit': 'mg', 'Unit Weight': '100mg' })).toBe(5))
    it('mg with "30-pack" in name divides by 30', () =>
      expect(perItemPotency({ Name: '1906 Love Tablet 30-pack', Potency: 75, 'Potency Unit': 'mg', 'Unit Weight': '75mg' })).toBeCloseTo(2.5))
  })

  describe('vaporizers (% unit, category-specific thresholds)', () => {
    const vape = (val) => ({ Potency: val, Category: 'VAPORIZERS' })
    it('<80% → Mild', () => expect(getPotencyLevel(vape(79)).label).toBe('Mild'))
    it('80% → Standard', () => expect(getPotencyLevel(vape(80)).label).toBe('Standard'))
    it('85% → Strong', () => expect(getPotencyLevel(vape(85)).label).toBe('Strong'))
    it('90%+ → Very strong', () => expect(getPotencyLevel(vape(90)).label).toBe('Very strong'))
  })

  describe('flower / pre-rolls / concentrates (default % thresholds)', () => {
    const flower = (val) => ({ Potency: val, Category: 'FLOWER' })
    it('≤12% → Low potency, 1 dot', () => {
      const r = getPotencyLevel(flower(12))
      expect(r.label).toBe('Low potency')
      expect(r.dots).toBe(1)
    })
    it('13–20% → Mid potency, 2 dots', () => {
      expect(getPotencyLevel(flower(20)).label).toBe('Mid potency')
      expect(getPotencyLevel(flower(20)).dots).toBe(2)
    })
    it('21–28% → High potency, 3 dots', () => {
      expect(getPotencyLevel(flower(28)).label).toBe('High potency')
      expect(getPotencyLevel(flower(28)).dots).toBe(3)
    })
    it('>28% → Very high potency, 4 dots', () => {
      const r = getPotencyLevel(flower(30))
      expect(r.label).toBe('Very high potency')
      expect(r.dots).toBe(4)
      expect(r.color).toBe('bg-red-400')
    })
  })
})
