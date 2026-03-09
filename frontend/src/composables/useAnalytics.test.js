import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useAnalytics } from './useAnalytics'

describe('useAnalytics', () => {
  let fetchSpy

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true })
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('POSTs to /api/event with correct event name', async () => {
    const { track } = useAnalytics()
    track('add_to_cart')
    await Promise.resolve() // flush microtasks

    expect(fetchSpy).toHaveBeenCalledOnce()
    const [url, opts] = fetchSpy.mock.calls[0]
    expect(url).toBe('/api/event')
    expect(opts.method).toBe('POST')
    const body = JSON.parse(opts.body)
    expect(body.event).toBe('add_to_cart')
  })

  it('includes properties in the payload', async () => {
    const { track } = useAnalytics()
    track('filter_applied', { filter: 'strain', value: 'INDICA' })
    await Promise.resolve()

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body)
    expect(body.properties).toEqual({ filter: 'strain', value: 'INDICA' })
  })

  it('includes sessionId from localStorage when present', async () => {
    localStorage.setItem('sessionId', 'test-session-123')
    const { track } = useAnalytics()
    track('page_view')
    await Promise.resolve()

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body)
    expect(body.sessionId).toBe('test-session-123')
  })

  it('omits sessionId (undefined) when localStorage is empty', async () => {
    const { track } = useAnalytics()
    track('page_view')
    await Promise.resolve()

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body)
    expect(body.sessionId).toBeUndefined()
  })

  it('does not throw when fetch rejects', async () => {
    fetchSpy.mockRejectedValue(new Error('network down'))
    const { track } = useAnalytics()
    await expect(async () => { track('some_event') }).not.toThrow()
  })

  it('does not throw when fetch resolves with error status', async () => {
    fetchSpy.mockResolvedValue({ ok: false, status: 500 })
    const { track } = useAnalytics()
    await expect(async () => { track('some_event') }).not.toThrow()
  })

  it('uses empty object as default properties', async () => {
    const { track } = useAnalytics()
    track('test_event')
    await Promise.resolve()

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body)
    expect(body.properties).toEqual({})
  })
})
