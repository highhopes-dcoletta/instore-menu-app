import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createApp } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { useProductsStore } from './products'
import { useSessionStore } from './session'

const mockFetch = vi.fn()
global.fetch = mockFetch

// Minimal Dutchie GraphQL response for a list of { id, name, category } items.
// Each item becomes one product+variant pair in the store.
function dutchieResponse(items) {
  return {
    ok: true,
    json: () =>
      Promise.resolve({
        data: {
          menu: {
            products: items.map((item) => ({
              id: `product-${item.id}`,
              name: item.name,
              category: item.category ?? 'FLOWER',
              subcategory: null,
              strainType: null,
              brand: null,
              potencyThc: null,
              image: null,
              description: null,
              effects: [],
              variants: [
                {
                  id: item.id, // variant.id is the key used throughout the app
                  option: '1g',
                  priceRec: item.price ?? 10,
                  specialPriceRec: null,
                  quantity: 10,
                },
              ],
            })),
          },
        },
      }),
  }
}

beforeEach(() => {
  vi.useFakeTimers()

  const app = createApp({})
  const pinia = createPinia()
  app.use(pinia)
  setActivePinia(pinia)

  localStorage.clear()
  mockFetch.mockReset()

  // Session API calls always succeed; Dutchie calls are configured per-test
  mockFetch.mockImplementation((url) => {
    if (typeof url === 'string' && url.startsWith('/api')) {
      return Promise.resolve({ ok: true })
    }
    return Promise.reject(new Error(`Unexpected fetch: ${url}`))
  })
})

afterEach(() => {
  vi.useRealTimers()
})

// Helper: set up the Dutchie mock then load products
async function loadWith(items) {
  mockFetch.mockImplementationOnce(() => dutchieResponse(items))
  const store = useProductsStore()
  await store.loadProducts()
  return store
}

// Helper: queue the next Dutchie call (the background refresh)
function nextRefreshReturns(items) {
  mockFetch.mockImplementationOnce((url) => {
    if (typeof url === 'string' && url.startsWith('/api')) {
      return Promise.resolve({ ok: true })
    }
    return dutchieResponse(items)
  })
}

describe('localStorage product cache', () => {
  it('saves products to localStorage after a successful load', async () => {
    await loadWith([{ id: 'p1', name: 'Blue Dream' }])
    const cached = JSON.parse(localStorage.getItem('dutchie_products_v1'))
    expect(cached).not.toBeNull()
    expect(cached.data).toHaveLength(1)
    expect(cached.data[0].Name).toBe('Blue Dream')
    expect(cached.ts).toBeGreaterThan(0)
  })

  it('falls back to cache when all retries fail on initial load', async () => {
    // Seed the cache manually
    localStorage.setItem('dutchie_products_v1', JSON.stringify({
      ts: Date.now(),
      data: [{ id: 'p1', Name: 'Cached Product', Category: 'FLOWER' }],
    }))

    // All three fetch attempts fail
    mockFetch.mockImplementation(() => Promise.reject(new Error('Network error')))

    const store = useProductsStore()
    const loadPromise = store.loadProducts()
    await vi.advanceTimersByTimeAsync(10_000) // advance through retry delays
    await loadPromise

    expect(store.products).toHaveLength(1)
    expect(store.products[0].Name).toBe('Cached Product')
    expect(store.usingCache).toBe(true)
    expect(store.error).toBe(false)
    expect(store.loading).toBe(false)
  })

  it('sets error=true when all retries fail and there is no cache', async () => {
    mockFetch.mockImplementation(() => Promise.reject(new Error('Network error')))

    const store = useProductsStore()
    const loadPromise = store.loadProducts()
    await vi.advanceTimersByTimeAsync(10_000)
    await loadPromise

    expect(store.error).toBe(true)
    expect(store.usingCache).toBe(false)
    expect(store.products).toHaveLength(0)
  })

  it('clears usingCache flag when background refresh succeeds', async () => {
    // Seed cache and fail initial load
    localStorage.setItem('dutchie_products_v1', JSON.stringify({
      ts: Date.now(),
      data: [{ id: 'p1', Name: 'Cached Product', Category: 'FLOWER' }],
    }))
    mockFetch.mockImplementation(() => Promise.reject(new Error('Network error')))

    const store = useProductsStore()
    const loadPromise = store.loadProducts()
    await vi.advanceTimersByTimeAsync(10_000)
    await loadPromise
    expect(store.usingCache).toBe(true)

    // Background refresh succeeds
    nextRefreshReturns([{ id: 'p2', name: 'Fresh Product' }])
    await vi.advanceTimersByTimeAsync(60_000)

    expect(store.usingCache).toBe(false)
    expect(store.products[0].Name).toBe('Fresh Product')
  })

  it('updates the cache after a successful background refresh', async () => {
    await loadWith([{ id: 'p1', name: 'Blue Dream' }])

    nextRefreshReturns([{ id: 'p2', name: 'OG Kush' }])
    await vi.advanceTimersByTimeAsync(60_000)

    const cached = JSON.parse(localStorage.getItem('dutchie_products_v1'))
    expect(cached.data[0].Name).toBe('OG Kush')
  })
})

describe('background refresh — cart preservation', () => {
  it('keeps all cart items when every product is still available', async () => {
    const productsStore = await loadWith([
      { id: 'p1', name: 'Blue Dream' },
      { id: 'p2', name: 'Sour Diesel' },
    ])
    const sessionStore = useSessionStore()

    await sessionStore.updateQuantity('p1', { name: 'Blue Dream', unitWeight: '1g', price: 10 }, 1)
    await sessionStore.updateQuantity('p2', { name: 'Sour Diesel', unitWeight: '1g', price: 15 }, 2)

    nextRefreshReturns([
      { id: 'p1', name: 'Blue Dream' },
      { id: 'p2', name: 'Sour Diesel' },
    ])
    await vi.advanceTimersByTimeAsync(60_000)

    expect(sessionStore.selections['p1']).toBeDefined()
    expect(sessionStore.selections['p1'].qty).toBe(1)
    expect(sessionStore.selections['p2']).toBeDefined()
    expect(sessionStore.selections['p2'].qty).toBe(2)
    expect(productsStore.outOfStockNotice).toHaveLength(0)
  })

  it('removes a cart item that is no longer in the product list', async () => {
    await loadWith([
      { id: 'p1', name: 'Blue Dream' },
      { id: 'p2', name: 'Sour Diesel' },
    ])
    const sessionStore = useSessionStore()

    await sessionStore.updateQuantity('p1', { name: 'Blue Dream', unitWeight: '1g', price: 10 }, 1)
    await sessionStore.updateQuantity('p2', { name: 'Sour Diesel', unitWeight: '1g', price: 15 }, 2)

    // p1 goes out of stock
    nextRefreshReturns([{ id: 'p2', name: 'Sour Diesel' }])
    await vi.advanceTimersByTimeAsync(60_000)

    expect(sessionStore.selections['p1']).toBeUndefined()
    expect(sessionStore.selections['p2']).toBeDefined()
    expect(sessionStore.selections['p2'].qty).toBe(2)
  })

  it('removes multiple stale items in a single refresh', async () => {
    await loadWith([
      { id: 'p1', name: 'Blue Dream' },
      { id: 'p2', name: 'Sour Diesel' },
      { id: 'p3', name: 'OG Kush' },
    ])
    const sessionStore = useSessionStore()

    await sessionStore.updateQuantity('p1', { name: 'Blue Dream', unitWeight: '1g', price: 10 }, 1)
    await sessionStore.updateQuantity('p2', { name: 'Sour Diesel', unitWeight: '1g', price: 15 }, 1)
    await sessionStore.updateQuantity('p3', { name: 'OG Kush', unitWeight: '1g', price: 20 }, 1)

    // Only p2 survives
    nextRefreshReturns([{ id: 'p2', name: 'Sour Diesel' }])
    await vi.advanceTimersByTimeAsync(60_000)

    expect(sessionStore.selections['p1']).toBeUndefined()
    expect(sessionStore.selections['p3']).toBeUndefined()
    expect(sessionStore.selections['p2']).toBeDefined()
  })

  it('sets outOfStockNotice with the names of removed items', async () => {
    const productsStore = await loadWith([
      { id: 'p1', name: 'Blue Dream' },
      { id: 'p2', name: 'Sour Diesel' },
    ])
    const sessionStore = useSessionStore()

    await sessionStore.updateQuantity('p1', { name: 'Blue Dream', unitWeight: '1g', price: 10 }, 1)
    await sessionStore.updateQuantity('p2', { name: 'Sour Diesel', unitWeight: '1g', price: 15 }, 1)

    nextRefreshReturns([{ id: 'p2', name: 'Sour Diesel' }])
    await vi.advanceTimersByTimeAsync(60_000)

    expect(productsStore.outOfStockNotice).toContain('Blue Dream')
    expect(productsStore.outOfStockNotice).not.toContain('Sour Diesel')
  })

  it('does not set outOfStockNotice when no items are removed', async () => {
    const productsStore = await loadWith([{ id: 'p1', name: 'Blue Dream' }])
    const sessionStore = useSessionStore()

    await sessionStore.updateQuantity('p1', { name: 'Blue Dream', unitWeight: '1g', price: 10 }, 1)

    nextRefreshReturns([{ id: 'p1', name: 'Blue Dream' }])
    await vi.advanceTimersByTimeAsync(60_000)

    expect(productsStore.outOfStockNotice).toHaveLength(0)
  })

  it('leaves the cart untouched when the refresh fetch fails', async () => {
    const productsStore = await loadWith([{ id: 'p1', name: 'Blue Dream' }])
    const sessionStore = useSessionStore()

    await sessionStore.updateQuantity('p1', { name: 'Blue Dream', unitWeight: '1g', price: 10 }, 1)

    // Refresh network failure
    mockFetch.mockImplementationOnce(() => Promise.reject(new Error('Network error')))
    await vi.advanceTimersByTimeAsync(60_000)

    expect(sessionStore.selections['p1']).toBeDefined()
    expect(productsStore.outOfStockNotice).toHaveLength(0)
  })

  it('leaves the cart untouched when the refresh returns an empty list', async () => {
    const productsStore = await loadWith([{ id: 'p1', name: 'Blue Dream' }])
    const sessionStore = useSessionStore()

    await sessionStore.updateQuantity('p1', { name: 'Blue Dream', unitWeight: '1g', price: 10 }, 1)

    // Empty product list is treated as a bad fetch and rejected by _fetchAll
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: { menu: { products: [] } } }),
      }),
    )
    await vi.advanceTimersByTimeAsync(60_000)

    expect(sessionStore.selections['p1']).toBeDefined()
    expect(productsStore.outOfStockNotice).toHaveLength(0)
  })
})
