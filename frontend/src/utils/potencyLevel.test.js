import { describe, it, expect } from 'vitest'
import { getPotencyLevel } from './potencyLevel'

describe('getPotencyLevel', () => {
  describe('returns null when no potency', () => {
    it('null Potency', () => expect(getPotencyLevel({ Potency: null })).toBeNull())
    it('undefined Potency', () => expect(getPotencyLevel({ Potency: undefined })).toBeNull())
    it('zero Potency', () => expect(getPotencyLevel({ Potency: 0 })).toBeNull())
  })

  describe('edibles (mg unit)', () => {
    it('≤5mg → Low dose, 1 dot', () => {
      const r = getPotencyLevel({ Potency: 5, 'Potency Unit': 'mg' })
      expect(r.label).toBe('Low dose')
      expect(r.dots).toBe(1)
      expect(r.color).toBe('bg-green-400')
    })
    it('10mg → Medium dose, 2 dots', () => {
      const r = getPotencyLevel({ Potency: 10, 'Potency Unit': 'mg' })
      expect(r.label).toBe('Medium dose')
      expect(r.dots).toBe(2)
    })
    it('20mg → High dose, 3 dots', () => {
      const r = getPotencyLevel({ Potency: 20, 'Potency Unit': 'mg' })
      expect(r.label).toBe('High dose')
      expect(r.dots).toBe(3)
    })
    it('>20mg → Very high dose, 4 dots', () => {
      const r = getPotencyLevel({ Potency: 100, 'Potency Unit': 'mg' })
      expect(r.label).toBe('Very high dose')
      expect(r.dots).toBe(4)
      expect(r.color).toBe('bg-red-400')
    })
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
