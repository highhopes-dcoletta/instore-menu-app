import { describe, it, expect, vi, beforeEach } from 'vitest'

let envPrefix, router

beforeEach(async () => {
  // Reset module between tests so envPrefix re-reads window.location
  vi.resetModules()
  // Mock all view components to avoid pulling in their dependencies
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
