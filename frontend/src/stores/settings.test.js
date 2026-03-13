import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSettingsStore, SETTINGS_DEFAULTS } from './settings'

describe('settings store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
  })

  it('get() returns defaults when settings is empty', () => {
    const store = useSettingsStore()
    expect(store.get('timeouts.inactivityMs')).toBe(120000)
    expect(store.get('display.maxScatterDots')).toBe(60)
    expect(store.get('regulatory.dailyLimitG')).toBe(28)
  })

  it('get() returns override when set', () => {
    const store = useSettingsStore()
    store.settings = { 'timeouts.inactivityMs': 300000 }
    expect(store.get('timeouts.inactivityMs')).toBe(300000)
    // Other settings still return defaults
    expect(store.get('display.maxScatterDots')).toBe(60)
  })

  it('computed getters reflect overrides', () => {
    const store = useSettingsStore()
    store.settings = { 'timeouts.inactivityMs': 300000 }
    expect(store.inactivityMs).toBe(300000)
    expect(store.maxScatterDots).toBe(60)
  })

  it('loadSettings() fetches from API and sets loaded', async () => {
    const mockData = { 'timeouts.inactivityMs': 60000, 'display.maxScatterDots': 100 }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    }))

    const store = useSettingsStore()
    expect(store.loaded).toBe(false)
    await store.loadSettings()
    expect(store.loaded).toBe(true)
    expect(store.get('timeouts.inactivityMs')).toBe(60000)
    expect(store.get('display.maxScatterDots')).toBe(100)
  })

  it('loadSettings() sets loaded even if fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))

    const store = useSettingsStore()
    await store.loadSettings()
    expect(store.loaded).toBe(true)
    // Falls back to defaults
    expect(store.get('timeouts.inactivityMs')).toBe(120000)
  })

  it('saveSettings() PUTs to API and merges locally', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)

    const store = useSettingsStore()
    store.settings = { 'timeouts.inactivityMs': 120000 }

    await store.saveSettings({ 'timeouts.inactivityMs': 300000 })

    expect(fetchMock).toHaveBeenCalledWith('/api/settings', expect.objectContaining({
      method: 'PUT',
    }))
    expect(store.get('timeouts.inactivityMs')).toBe(300000)
  })

  it('SETTINGS_DEFAULTS has all expected keys', () => {
    const keys = Object.keys(SETTINGS_DEFAULTS)
    expect(keys).toContain('timeouts.inactivityMs')
    expect(keys).toContain('timeouts.sessionTimeoutMinutes')
    expect(keys).toContain('display.maxDealsPerCategory')
    expect(keys).toContain('regulatory.dailyLimitG')
    expect(keys).toContain('regulatory.categoryFactors')
  })

  it('categoryFactors computed returns object with expected categories', () => {
    const store = useSettingsStore()
    const factors = store.categoryFactors
    expect(factors.FLOWER).toBe(1)
    expect(factors.EDIBLES).toBe(56)
    expect(factors.CONCENTRATES).toBe(5.6)
  })
})
