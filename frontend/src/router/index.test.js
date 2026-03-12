import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'

let envPrefix, router

// Shared mock state — mutated per-test to simulate auth/unauth
const mockIsAuthenticated = ref(true)
const mockCheckSessionExpiry = vi.fn()
const mockClearStaffSession = vi.fn()

beforeEach(async () => {
  vi.resetModules()
  mockIsAuthenticated.value = true
  mockCheckSessionExpiry.mockReset()
  mockClearStaffSession.mockReset()
  sessionStorage.clear()

  const stub = { template: '<div />' }
  vi.doMock('@/views/HomeView.vue', () => ({ default: stub }))
  vi.doMock('@/views/FlowerView.vue', () => ({ default: stub }))
  vi.doMock('@/views/PreRollsView.vue', () => ({ default: stub }))
  vi.doMock('@/views/EdiblesView.vue', () => ({ default: stub }))
  vi.doMock('@/views/VapesView.vue', () => ({ default: stub }))
  vi.doMock('@/views/DabsView.vue', () => ({ default: stub }))
  vi.doMock('@/views/TincturesTopicalsView.vue', () => ({ default: stub }))
  vi.doMock('@/views/SleepView.vue', () => ({ default: stub }))
  vi.doMock('@/views/PainView.vue', () => ({ default: stub }))
  vi.doMock('@/views/BudtenderView.vue', () => ({ default: stub }))
  vi.doMock('@/views/BundlesView.vue', () => ({ default: stub }))
  vi.doMock('@/views/AnalyticsView.vue', () => ({ default: stub }))
  vi.doMock('@/views/CartShareView.vue', () => ({ default: stub }))
  vi.doMock('@/views/GuidedView.vue', () => ({ default: stub }))
  vi.doMock('@/composables/useAuth', () => ({
    useAuth: () => ({
      isAuthenticated: mockIsAuthenticated,
      account: { value: null },
      login: async () => {},
      logout: async () => {},
    }),
    initializeMsal: async () => {},
    checkSessionExpiry: mockCheckSessionExpiry,
    clearStaffSession: mockClearStaffSession,
  }))

  const mod = await import('@/router/index.js')
  envPrefix = mod.envPrefix
  router = mod.default
})

describe('envPrefix', () => {
  it('returns "[stage] " for stage hostname', () => {
    vi.spyOn(window, 'location', 'get').mockReturnValue({ hostname: 'menu2-stage.highhopesma.com' })
    expect(envPrefix()).toBe('[stage] ')
  })

  it('returns "[local] " for localhost', () => {
    vi.spyOn(window, 'location', 'get').mockReturnValue({ hostname: 'localhost' })
    expect(envPrefix()).toBe('[local] ')
  })

  it('returns "[local] " for 127.0.0.1', () => {
    vi.spyOn(window, 'location', 'get').mockReturnValue({ hostname: '127.0.0.1' })
    expect(envPrefix()).toBe('[local] ')
  })

  it('returns "" for prod hostname', () => {
    vi.spyOn(window, 'location', 'get').mockReturnValue({ hostname: 'menu2.highhopesma.com' })
    expect(envPrefix()).toBe('')
  })
})

describe('route titles', () => {
  const v = __APP_VERSION__

  it('sets default title with version for kiosk routes', async () => {
    vi.spyOn(window, 'location', 'get').mockReturnValue({ hostname: 'menu2.highhopesma.com' })
    await router.push('/')
    expect(document.title).toBe(`High Hopes Menu (${v})`)

    await router.push('/flower')
    expect(document.title).toBe(`High Hopes Menu (${v})`)
  })

  it('sets custom title for budtender', async () => {
    vi.spyOn(window, 'location', 'get').mockReturnValue({ hostname: 'menu2.highhopesma.com' })
    await router.push('/budtender')
    expect(document.title).toBe(`Budtender at High Hopes (${v})`)
  })

  it('sets custom title for bundles', async () => {
    vi.spyOn(window, 'location', 'get').mockReturnValue({ hostname: 'menu2.highhopesma.com' })
    await router.push('/bundles')
    expect(document.title).toBe(`Bundles at High Hopes (${v})`)
  })

  it('sets custom title for analytics', async () => {
    vi.spyOn(window, 'location', 'get').mockReturnValue({ hostname: 'menu2.highhopesma.com' })
    await router.push('/analytics')
    expect(document.title).toBe(`Analytics at High Hopes (${v})`)
  })

  it('prefixes with [stage] on stage hostname', async () => {
    vi.spyOn(window, 'location', 'get').mockReturnValue({ hostname: 'menu2-stage.highhopesma.com' })
    await router.push('/budtender')
    expect(document.title).toBe(`[stage] Budtender at High Hopes (${v})`)
  })

  it('prefixes with [local] on localhost', async () => {
    vi.spyOn(window, 'location', 'get').mockReturnValue({ hostname: 'localhost' })
    await router.push('/bundles')
    expect(document.title).toBe(`[local] Bundles at High Hopes (${v})`)
  })
})

describe('auth guard', () => {
  it('allows authenticated users to access protected routes', async () => {
    mockIsAuthenticated.value = true
    await router.push('/budtender')
    expect(router.currentRoute.value.path).toBe('/budtender')
  })

  it('redirects unauthenticated users to /login with redirect param', async () => {
    mockIsAuthenticated.value = false
    await router.push('/budtender')
    expect(router.currentRoute.value.path).toBe('/login')
    expect(router.currentRoute.value.query.redirect).toBe('/budtender')
  })

  it('redirects unauthenticated users from /bundles', async () => {
    mockIsAuthenticated.value = false
    await router.push('/bundles')
    expect(router.currentRoute.value.path).toBe('/login')
    expect(router.currentRoute.value.query.redirect).toBe('/bundles')
  })

  it('redirects unauthenticated users from /analytics', async () => {
    mockIsAuthenticated.value = false
    await router.push('/analytics')
    expect(router.currentRoute.value.path).toBe('/login')
    expect(router.currentRoute.value.query.redirect).toBe('/analytics')
  })

  it('allows unauthenticated users to access public routes', async () => {
    mockIsAuthenticated.value = false
    await router.push('/')
    expect(router.currentRoute.value.path).toBe('/')

    await router.push('/flower')
    expect(router.currentRoute.value.path).toBe('/flower')
  })

  it('allows unauthenticated users to access /login', async () => {
    mockIsAuthenticated.value = false
    await router.push('/login')
    expect(router.currentRoute.value.path).toBe('/login')
  })

  it('redirects authenticated user from /login to /budtender by default', async () => {
    mockIsAuthenticated.value = true
    await router.push('/login')
    expect(router.currentRoute.value.path).toBe('/budtender')
  })

  it('redirects authenticated user from /login to the redirect query param', async () => {
    mockIsAuthenticated.value = true
    await router.push('/login?redirect=/analytics')
    expect(router.currentRoute.value.path).toBe('/analytics')
  })

  it('redirects authenticated user from /auth to sessionStorage target', async () => {
    mockIsAuthenticated.value = true
    sessionStorage.setItem('auth_redirect', '/bundles')
    await router.push('/auth')
    expect(router.currentRoute.value.path).toBe('/bundles')
    expect(sessionStorage.getItem('auth_redirect')).toBe(null)
  })

  it('redirects authenticated user from /auth to /budtender when no target stored', async () => {
    mockIsAuthenticated.value = true
    await router.push('/auth')
    expect(router.currentRoute.value.path).toBe('/budtender')
  })

  it('calls checkSessionExpiry on every navigation', async () => {
    await router.push('/')
    expect(mockCheckSessionExpiry).toHaveBeenCalled()

    mockCheckSessionExpiry.mockClear()
    await router.push('/flower')
    expect(mockCheckSessionExpiry).toHaveBeenCalled()
  })

  it('respects session expiry mid-navigation', async () => {
    // Start authenticated
    mockIsAuthenticated.value = true
    await router.push('/budtender')
    expect(router.currentRoute.value.path).toBe('/budtender')

    // Simulate checkSessionExpiry clearing the auth (as it would on timeout)
    mockCheckSessionExpiry.mockImplementation(() => {
      mockIsAuthenticated.value = false
    })

    await router.push('/analytics')
    expect(router.currentRoute.value.path).toBe('/login')
    expect(router.currentRoute.value.query.redirect).toBe('/analytics')
  })

  it('clears staff session when authenticated user navigates to a public route', async () => {
    mockIsAuthenticated.value = true
    await router.push('/budtender') // start on a protected route
    mockClearStaffSession.mockClear()
    await router.push('/')
    expect(mockClearStaffSession).toHaveBeenCalled()
  })

  it('clears staff session when navigating to any kiosk product route', async () => {
    mockIsAuthenticated.value = true
    await router.push('/budtender') // start on a protected route
    mockClearStaffSession.mockClear()
    await router.push('/flower')
    expect(mockClearStaffSession).toHaveBeenCalled()
  })

  it('does not clear staff session on protected routes', async () => {
    mockIsAuthenticated.value = true
    mockClearStaffSession.mockClear()
    await router.push('/budtender')
    expect(mockClearStaffSession).not.toHaveBeenCalled()
  })

  it('does not clear staff session on /login or /auth', async () => {
    mockIsAuthenticated.value = false
    mockClearStaffSession.mockClear()
    await router.push('/login')
    expect(mockClearStaffSession).not.toHaveBeenCalled()
  })

  it('does not clear staff session when not authenticated', async () => {
    mockIsAuthenticated.value = false
    mockClearStaffSession.mockClear()
    await router.push('/')
    expect(mockClearStaffSession).not.toHaveBeenCalled()
  })
})
