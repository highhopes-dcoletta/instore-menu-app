import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createI18n } from 'vue-i18n'
import { defineComponent, nextTick } from 'vue'

// ─── Minimal stubs ────────────────────────────────────────────────────────────

vi.mock('@/components/NavBar.vue', () => ({ default: { template: '<div />' } }))
vi.mock('@/components/CartPanel.vue', () => ({ default: { template: '<div />' } }))
vi.mock('@/components/CartAnimation.vue', () => ({ default: { template: '<div />' } }))
vi.mock('@/composables/useAnalytics', () => ({
  useAnalytics: () => ({ track: vi.fn() }),
}))

// Mock products store — loadProducts is fire-and-forget
vi.mock('@/stores/products', () => ({
  useProductsStore: () => ({
    loadProducts: vi.fn(),
    loading: false,
    error: null,
  }),
}))

// Mock session store — we'll track calls ourselves
const mockInitialize = vi.fn().mockResolvedValue(undefined)
const mockClearSession = vi.fn().mockResolvedValue(undefined)
const mockSelectionCount = { value: 0 }

vi.mock('@/stores/session', () => ({
  useSessionStore: () => ({
    initialize: mockInitialize,
    clearSession: mockClearSession,
    get selectionCount() { return mockSelectionCount.value },
  }),
}))

// ─── Router with a kiosk route and a budtender route ─────────────────────────

function makeRouter(initialPath = '/') {
  const KioskPage    = defineComponent({ template: '<div>kiosk</div>' })
  const BudtenderPage = defineComponent({ template: '<div>budtender</div>' })
  const AnalyticsPage = defineComponent({ template: '<div>analytics</div>' })

  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: KioskPage },
      { path: '/budtender', component: BudtenderPage },
      { path: '/analytics', component: AnalyticsPage },
    ],
  })
}

let currentWrapper = null

async function mountApp(initialPath = '/') {
  if (currentWrapper) { currentWrapper.unmount(); currentWrapper = null }
  const router = makeRouter(initialPath)
  await router.push(initialPath)

  const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: {} } })
  const { default: App } = await import('./App.vue')
  currentWrapper = mount(App, {
    global: {
      plugins: [createPinia(), router, i18n],
    },
  })
  return currentWrapper
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  mockInitialize.mockClear()
  mockClearSession.mockClear()
  mockSelectionCount.value = 0
  global.fetch = vi.fn().mockResolvedValue({ ok: true })
})

afterEach(() => {
  if (currentWrapper) { currentWrapper.unmount(); currentWrapper = null }
  vi.useRealTimers()
  vi.resetModules()
})

describe('App.vue — kiosk route (/)', () => {
  it('calls sessionStore.initialize() on mount', async () => {
    await mountApp('/')
    await flushPromises()
    expect(mockInitialize).toHaveBeenCalledOnce()
  })

  it('fires clearSession and redirects after 2 minutes of inactivity', async () => {
    const wrapper = await mountApp('/')
    await flushPromises()

    // Advance past the 2-minute inactivity threshold
    await vi.advanceTimersByTimeAsync(2 * 60 * 1000)
    await flushPromises()

    expect(mockClearSession).toHaveBeenCalledOnce()
  })

  it('resets the inactivity timer on user activity (click)', async () => {
    await mountApp('/')
    await flushPromises()

    // Advance 1 minute (not yet timed out)
    await vi.advanceTimersByTimeAsync(60 * 1000)

    // Simulate user click — should reset the 2-min clock
    window.dispatchEvent(new Event('click'))
    await nextTick()

    // Advance another 1m59s — should NOT have fired (only 1:59 since last activity)
    await vi.advanceTimersByTimeAsync(119 * 1000)
    expect(mockClearSession).not.toHaveBeenCalled()

    // Advance 1 more second — now 2 full minutes since last activity
    await vi.advanceTimersByTimeAsync(1000)
    await flushPromises()
    expect(mockClearSession).toHaveBeenCalledOnce()
  })

  it('tracks session_abandoned when cart is non-empty at timeout', async () => {
    const trackSpy = vi.fn()
    vi.doMock('@/composables/useAnalytics', () => ({
      useAnalytics: () => ({ track: trackSpy }),
    }))
    mockSelectionCount.value = 3

    await mountApp('/')
    await flushPromises()
    await vi.advanceTimersByTimeAsync(2 * 60 * 1000)
    await flushPromises()

    expect(trackSpy).toHaveBeenCalledWith('session_abandoned', { item_count: 3 })
  })
})

describe('App.vue — budtender route (/budtender)', () => {
  it('does NOT call sessionStore.initialize()', async () => {
    await mountApp('/budtender')
    await flushPromises()
    expect(mockInitialize).not.toHaveBeenCalled()
  })

  it('does NOT fire inactivity timeout after 2 minutes', async () => {
    await mountApp('/budtender')
    await flushPromises()
    await vi.advanceTimersByTimeAsync(2 * 60 * 1000)
    await flushPromises()
    expect(mockClearSession).not.toHaveBeenCalled()
  })
})

describe('App.vue — analytics route (/analytics)', () => {
  it('does NOT call sessionStore.initialize()', async () => {
    await mountApp('/analytics')
    await flushPromises()
    expect(mockInitialize).not.toHaveBeenCalled()
  })

  it('does NOT fire inactivity timeout after 2 minutes', async () => {
    await mountApp('/analytics')
    await flushPromises()
    await vi.advanceTimersByTimeAsync(2 * 60 * 1000)
    await flushPromises()
    expect(mockClearSession).not.toHaveBeenCalled()
  })
})
