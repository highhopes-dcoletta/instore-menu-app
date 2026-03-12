import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock MSAL before importing useAuth
vi.mock('@azure/msal-browser', () => ({
  PublicClientApplication: vi.fn(),
}))

// Set env vars so msalConfigured = true doesn't matter for these tests —
// we're testing the exported helpers, not initializeMsal().
// The module-level refs are what we care about.

let useAuth, checkSessionExpiry, clearStaffSession

beforeEach(async () => {
  vi.useFakeTimers()
  localStorage.clear()
  sessionStorage.clear()
  vi.resetModules()

  const mod = await import('./useAuth.js')
  useAuth = mod.useAuth
  checkSessionExpiry = mod.checkSessionExpiry
  clearStaffSession = mod.clearStaffSession
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useAuth — exports', () => {
  it('returns isAuthenticated and account refs', () => {
    const { isAuthenticated, account } = useAuth()
    expect(isAuthenticated.value).toBe(false)
    expect(account.value).toBe(null)
  })
})

describe('checkSessionExpiry', () => {
  it('does nothing when not authenticated', () => {
    // No staff_login_at, not authenticated — should not throw
    checkSessionExpiry()
    const { isAuthenticated } = useAuth()
    expect(isAuthenticated.value).toBe(false)
  })

  it('clears session when staff_login_at is older than 30 minutes', () => {
    const { isAuthenticated, account } = useAuth()

    // Simulate an authenticated state
    isAuthenticated.value = true
    account.value = { name: 'Test User' }
    const thirtyOneMinutesAgo = Date.now() - 31 * 60 * 1000
    localStorage.setItem('staff_login_at', thirtyOneMinutesAgo.toString())

    checkSessionExpiry()

    expect(isAuthenticated.value).toBe(false)
    expect(account.value).toBe(null)
    expect(localStorage.getItem('staff_login_at')).toBe(null)
  })

  it('does not clear session when staff_login_at is within 30 minutes', () => {
    const { isAuthenticated, account } = useAuth()

    isAuthenticated.value = true
    account.value = { name: 'Test User' }
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000
    localStorage.setItem('staff_login_at', tenMinutesAgo.toString())

    checkSessionExpiry()

    expect(isAuthenticated.value).toBe(true)
    expect(account.value).toEqual({ name: 'Test User' })
    expect(localStorage.getItem('staff_login_at')).not.toBe(null)
  })

  it('clears session when staff_login_at is missing', () => {
    const { isAuthenticated, account } = useAuth()

    isAuthenticated.value = true
    account.value = { name: 'Test User' }
    // No staff_login_at in localStorage

    checkSessionExpiry()

    expect(isAuthenticated.value).toBe(false)
    expect(account.value).toBe(null)
  })

  it('clears session at exactly 30 minutes', () => {
    const { isAuthenticated } = useAuth()

    isAuthenticated.value = true
    const exactlyThirtyMinutesAgo = Date.now() - 30 * 60 * 1000 - 1
    localStorage.setItem('staff_login_at', exactlyThirtyMinutesAgo.toString())

    checkSessionExpiry()

    expect(isAuthenticated.value).toBe(false)
  })
})

describe('clearStaffSession', () => {
  it('clears isAuthenticated, account, and staff_login_at', () => {
    const { isAuthenticated, account } = useAuth()

    isAuthenticated.value = true
    account.value = { name: 'Test User' }
    localStorage.setItem('staff_login_at', Date.now().toString())

    clearStaffSession()

    expect(isAuthenticated.value).toBe(false)
    expect(account.value).toBe(null)
    expect(localStorage.getItem('staff_login_at')).toBe(null)
  })

  it('does not touch unrelated localStorage keys', () => {
    localStorage.setItem('unrelated_key', 'keep')
    localStorage.setItem('sessionId', 'kiosk-123')

    clearStaffSession()

    expect(localStorage.getItem('unrelated_key')).toBe('keep')
    expect(localStorage.getItem('sessionId')).toBe('kiosk-123')
  })

  it('works even when called multiple times', () => {
    const { isAuthenticated } = useAuth()
    isAuthenticated.value = true
    localStorage.setItem('staff_login_at', Date.now().toString())

    clearStaffSession()
    clearStaffSession() // second call should not throw

    expect(isAuthenticated.value).toBe(false)
  })
})
