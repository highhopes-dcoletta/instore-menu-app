import { describe, it, expect } from 'vitest'
import { strainLabel } from './strainLabels'

describe('strainLabel', () => {
  it('returns dash for null/undefined/empty', () => {
    expect(strainLabel(null)).toBe('—')
    expect(strainLabel(undefined)).toBe('—')
    expect(strainLabel('')).toBe('—')
  })

  it('maps known keys to display labels', () => {
    expect(strainLabel('INDICA')).toBe('Indica')
    expect(strainLabel('SATIVA')).toBe('Sativa')
    expect(strainLabel('HYBRID')).toBe('Hybrid')
    expect(strainLabel('SATIVA_HYBRID')).toBe('Sativa Leaning')
    expect(strainLabel('INDICA_HYBRID')).toBe('Indica Leaning')
    expect(strainLabel('HIGH_CBD')).toBe('High CBD')
    expect(strainLabel('TWO_TO_ONE')).toBe('2:1')
    expect(strainLabel('ONE_TO_ONE')).toBe('1:1')
    expect(strainLabel('N/A')).toBe('N/A')
    expect(strainLabel('NOT_APPLICABLE')).toBe('N/A')
  })

  it('passes through unknown values as-is', () => {
    expect(strainLabel('SOME_UNKNOWN')).toBe('SOME_UNKNOWN')
    expect(strainLabel('Custom Strain')).toBe('Custom Strain')
  })
})
