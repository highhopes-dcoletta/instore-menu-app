import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createApp } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { useSessionStore } from './session'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

beforeEach(() => {
  // Fresh pinia + store for each test
  const app = createApp({})
  const pinia = createPinia()
  app.use(pinia)
  setActivePinia(pinia)

  // Default fetch: always succeeds
  mockFetch.mockResolvedValue({ ok: true })

  // Clear localStorage
  localStorage.clear()
})

describe('selectionCount', () => {
  it('starts at zero', () => {
    const store = useSessionStore()
    expect(store.selectionCount).toBe(0)
  })

  it('sums qty across all selections', async () => {
    const store = useSessionStore()
    await store.updateQuantity('p1', { name: 'A', unitWeight: '1g', price: 10 }, 1)
    await store.updateQuantity('p1', { name: 'A', unitWeight: '1g', price: 10 }, 1)
    await store.updateQuantity('p2', { name: 'B', unitWeight: '3.5g', price: 35 }, 1)
    expect(store.selectionCount).toBe(3)
  })
})

describe('updateQuantity', () => {
  it('adds a product and creates a session', async () => {
    const store = useSessionStore()
    await store.updateQuantity('p1', { name: 'Blue Dream', unitWeight: '1g', price: 15 }, 1)

    expect(store.selections['p1']).toMatchObject({ name: 'Blue Dream', qty: 1 })
    expect(store.sessionId).toBeTruthy()
    expect(localStorage.getItem('sessionId')).toBe(store.sessionId)
  })

  it('increments quantity on subsequent adds', async () => {
    const store = useSessionStore()
    await store.updateQuantity('p1', { name: 'Blue Dream', unitWeight: '1g', price: 15 }, 1)
    await store.updateQuantity('p1', { name: 'Blue Dream', unitWeight: '1g', price: 15 }, 1)

    expect(store.selections['p1'].qty).toBe(2)
  })

  it('removes product when qty reaches zero', async () => {
    const store = useSessionStore()
    await store.updateQuantity('p1', { name: 'A', unitWeight: '1g', price: 10 }, 1)
    await store.updateQuantity('p1', { name: 'A', unitWeight: '1g', price: 10 }, -1)

    expect(store.selections['p1']).toBeUndefined()
  })

  it('clears session when last product is removed', async () => {
    const store = useSessionStore()
    await store.updateQuantity('p1', { name: 'A', unitWeight: '1g', price: 10 }, 1)
    const id = store.sessionId
    await store.updateQuantity('p1', { name: 'A', unitWeight: '1g', price: 10 }, -1)

    expect(store.sessionId).toBeNull()
    expect(localStorage.getItem('sessionId')).toBeNull()
    // Should have called DELETE
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining(id),
      expect.objectContaining({ method: 'DELETE' }),
    )
  })

  it('keeps session when one of multiple products is removed', async () => {
    const store = useSessionStore()
    await store.updateQuantity('p1', { name: 'A', unitWeight: '1g', price: 10 }, 1)
    await store.updateQuantity('p2', { name: 'B', unitWeight: '3.5g', price: 35 }, 1)
    await store.updateQuantity('p1', { name: 'A', unitWeight: '1g', price: 10 }, -1)

    expect(store.sessionId).toBeTruthy()
    expect(store.selections['p2']).toBeDefined()
  })
})

describe('removeSelections', () => {
  it('removes specified product ids in batch', async () => {
    const store = useSessionStore()
    await store.updateQuantity('p1', { name: 'A', unitWeight: '1g', price: 10 }, 1)
    await store.updateQuantity('p2', { name: 'B', unitWeight: '3.5g', price: 35 }, 1)
    await store.updateQuantity('p3', { name: 'C', unitWeight: '7g', price: 60 }, 1)

    await store.removeSelections(['p1', 'p3'])

    expect(store.selections['p1']).toBeUndefined()
    expect(store.selections['p3']).toBeUndefined()
    expect(store.selections['p2']).toBeDefined()
  })

  it('clears session when all products removed', async () => {
    const store = useSessionStore()
    await store.updateQuantity('p1', { name: 'A', unitWeight: '1g', price: 10 }, 1)
    await store.updateQuantity('p2', { name: 'B', unitWeight: '3.5g', price: 35 }, 1)

    await store.removeSelections(['p1', 'p2'])

    expect(store.sessionId).toBeNull()
    expect(store.selectionCount).toBe(0)
  })

  it('does nothing when given an empty array', async () => {
    const store = useSessionStore()
    await store.updateQuantity('p1', { name: 'A', unitWeight: '1g', price: 10 }, 1)
    const callsBefore = mockFetch.mock.calls.length

    await store.removeSelections([])

    expect(store.selections['p1']).toBeDefined()
    expect(mockFetch.mock.calls.length).toBe(callsBefore)
  })
})

describe('reportJourney', () => {
  it('sends POST to /api/session/journey with correct payload', async () => {
    const store = useSessionStore()
    await store.initialize()
    mockFetch.mockClear()
    mockFetch.mockResolvedValue({ ok: true })

    store.reportJourney('search', 'Searched "gummies"')

    const journeyCall = mockFetch.mock.calls.find(
      ([url, opts]) => url === '/api/session/journey' && opts?.method === 'POST'
    )
    expect(journeyCall).toBeTruthy()
    const body = JSON.parse(journeyCall[1].body)
    expect(body.sessionId).toBe(store.sessionId)
    expect(body.type).toBe('search')
    expect(body.label).toBe('Searched "gummies"')
  })

  it('does nothing when sessionId is null', () => {
    const store = useSessionStore()
    mockFetch.mockClear()

    store.reportJourney('search', 'test')

    expect(mockFetch.mock.calls.length).toBe(0)
  })

  it('does not throw on fetch failure (fire-and-forget)', async () => {
    const store = useSessionStore()
    await store.initialize()
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    // Should not throw
    store.reportJourney('add', 'test +1')
  })
})

describe('updateQuantity journey reporting', () => {
  it('reports add with source label', async () => {
    const store = useSessionStore()
    await store.initialize()
    mockFetch.mockClear()
    mockFetch.mockResolvedValue({ ok: true })

    await store.updateQuantity('p1', { name: 'OG Kush', unitWeight: '1g', price: 15 }, 1, 'browse')

    const journeyCall = mockFetch.mock.calls.find(
      ([url, opts]) => url === '/api/session/journey' && opts?.method === 'POST'
    )
    expect(journeyCall).toBeTruthy()
    const body = JSON.parse(journeyCall[1].body)
    expect(body.type).toBe('add')
    expect(body.label).toBe('OG Kush +1 from list')
  })

  it('reports remove with source label', async () => {
    const store = useSessionStore()
    await store.updateQuantity('p1', { name: 'OG Kush', unitWeight: '1g', price: 15 }, 1)
    mockFetch.mockClear()
    mockFetch.mockResolvedValue({ ok: true })

    await store.updateQuantity('p1', { name: 'OG Kush', unitWeight: '1g', price: 15 }, -1, 'cart')

    const journeyCall = mockFetch.mock.calls.find(
      ([url, opts]) => url === '/api/session/journey' && opts?.method === 'POST'
    )
    expect(journeyCall).toBeTruthy()
    const body = JSON.parse(journeyCall[1].body)
    expect(body.type).toBe('remove')
    expect(body.label).toBe('OG Kush -1 in cart')
  })

  it('reports add without source when none provided', async () => {
    const store = useSessionStore()
    await store.initialize()
    mockFetch.mockClear()
    mockFetch.mockResolvedValue({ ok: true })

    await store.updateQuantity('p1', { name: 'Blue Dream', unitWeight: '1g', price: 15 }, 1)

    const journeyCall = mockFetch.mock.calls.find(
      ([url, opts]) => url === '/api/session/journey' && opts?.method === 'POST'
    )
    expect(journeyCall).toBeTruthy()
    const body = JSON.parse(journeyCall[1].body)
    expect(body.label).toBe('Blue Dream +1')
  })

  it('maps all source keys to labels', async () => {
    const store = useSessionStore()
    await store.initialize()
    const sources = {
      browse: 'from list',
      drag: 'via drag',
      modal: 'from details',
      guided: 'from guide',
      group_card: 'from group',
      cross_sell: 'from suggested',
      bundle: 'from deal',
      cart: 'in cart',
    }

    for (const [source, expected] of Object.entries(sources)) {
      mockFetch.mockClear()
      mockFetch.mockResolvedValue({ ok: true })

      await store.updateQuantity(`p-${source}`, { name: 'Test', unitWeight: '1g', price: 10 }, 1, source)

      const journeyCall = mockFetch.mock.calls.find(
        ([url, opts]) => url === '/api/session/journey' && opts?.method === 'POST'
      )
      expect(journeyCall).toBeTruthy()
      const body = JSON.parse(journeyCall[1].body)
      expect(body.label).toBe(`Test +1 ${expected}`)
    }
  })
})

describe('removeSelections journey reporting', () => {
  it('reports remove for each out-of-stock product', async () => {
    const store = useSessionStore()
    await store.updateQuantity('p1', { name: 'OG Kush', unitWeight: '1g', price: 10 }, 1)
    await store.updateQuantity('p2', { name: 'Blue Dream', unitWeight: '1g', price: 15 }, 1)
    mockFetch.mockClear()
    mockFetch.mockResolvedValue({ ok: true })

    await store.removeSelections(['p1', 'p2'])

    const journeyCalls = mockFetch.mock.calls.filter(
      ([url, opts]) => url === '/api/session/journey' && opts?.method === 'POST'
    )
    expect(journeyCalls).toHaveLength(2)
    const labels = journeyCalls.map(([, opts]) => JSON.parse(opts.body).label)
    expect(labels).toContain('OG Kush (out of stock)')
    expect(labels).toContain('Blue Dream (out of stock)')
  })

  it('does not report for products not in selections', async () => {
    const store = useSessionStore()
    await store.updateQuantity('p1', { name: 'A', unitWeight: '1g', price: 10 }, 1)
    mockFetch.mockClear()
    mockFetch.mockResolvedValue({ ok: true })

    await store.removeSelections(['p999'])

    const journeyCalls = mockFetch.mock.calls.filter(
      ([url, opts]) => url === '/api/session/journey' && opts?.method === 'POST'
    )
    expect(journeyCalls).toHaveLength(0)
  })
})

describe('clearSession', () => {
  it('resets all state and removes localStorage entry', async () => {
    const store = useSessionStore()
    await store.updateQuantity('p1', { name: 'A', unitWeight: '1g', price: 10 }, 1)
    const id = store.sessionId

    await store.clearSession()

    expect(store.sessionId).toBeNull()
    expect(store.selectionCount).toBe(0)
    expect(Object.keys(store.selections)).toHaveLength(0)
    expect(localStorage.getItem('sessionId')).toBeNull()
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining(id),
      expect.objectContaining({ method: 'DELETE' }),
    )
  })

  it('is a no-op when no session exists', async () => {
    const store = useSessionStore()
    const callsBefore = mockFetch.mock.calls.length

    await store.clearSession()

    expect(mockFetch.mock.calls.length).toBe(callsBefore)
  })
})
