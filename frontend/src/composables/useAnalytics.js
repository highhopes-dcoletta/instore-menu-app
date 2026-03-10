/**
 * Lightweight analytics composable.
 * Fires events to POST /api/event — always fire-and-forget, never throws.
 * Properties are merged with a sessionId if available.
 */

const API = '/api/event'

export function useAnalytics() {
  function track(event, properties = {}) {
    try {
      if (localStorage.getItem('notrack') === '1') return
      const sessionId = localStorage.getItem('sessionId') ?? undefined
      fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, sessionId, properties }),
      }).catch(() => {}) // swallow network errors
    } catch {
      // swallow any synchronous errors
    }
  }

  return { track }
}
