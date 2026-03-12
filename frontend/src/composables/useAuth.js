import { ref } from 'vue'

const isAuthenticated = ref(false)
const account = ref(null)

let msalInstance = null
let initPromise = null

const STAFF_SESSION_KEY = 'staff_login_at'
const STAFF_SESSION_MS = 30 * 60 * 1000 // 30 minutes

const msalConfigured = !!(
  import.meta.env.VITE_MSAL_CLIENT_ID &&
  import.meta.env.VITE_MSAL_TENANT_ID &&
  import.meta.env.VITE_MSAL_REDIRECT_URI
)

/**
 * Initialize MSAL and process any pending redirect.
 * Safe to call multiple times — returns the same promise.
 * Must be called (and awaited) before the Vue Router is installed
 * so that handleRedirectPromise() can read the URL before the
 * router normalizes it.
 */
export async function initializeMsal() {
  if (!msalConfigured) return
  if (initPromise) return initPromise

  initPromise = (async () => {
    const { PublicClientApplication } = await import('@azure/msal-browser')
    msalInstance = new PublicClientApplication({
      auth: {
        clientId: import.meta.env.VITE_MSAL_CLIENT_ID,
        authority: `https://login.microsoftonline.com/${import.meta.env.VITE_MSAL_TENANT_ID}`,
        redirectUri: import.meta.env.VITE_MSAL_REDIRECT_URI,
        navigateToLoginRequestUrl: false,
      },
      cache: {
        cacheLocation: 'localStorage',
      },
    })
    await msalInstance.initialize()
    const response = await msalInstance.handleRedirectPromise()
    if (response) {
      msalInstance.setActiveAccount(response.account)
      localStorage.setItem(STAFF_SESSION_KEY, Date.now().toString())
    }
    // getActiveAccount() is in-memory only — not persisted across reloads.
    // Fall back to the first cached account if no active account is set.
    let active = msalInstance.getActiveAccount()
    if (!active) {
      const accounts = msalInstance.getAllAccounts()
      if (accounts.length > 0) {
        msalInstance.setActiveAccount(accounts[0])
        active = accounts[0]
      }
    }
    if (active && !isSessionExpired()) {
      isAuthenticated.value = true
      account.value = active
    } else if (active) {
      // Session expired — clear it
      clearSession()
    } else if (!isSessionExpired()) {
      // MSAL cache unavailable (e.g. Secure cookie lost on http://localhost)
      // but our own session timestamp is still fresh — stay authenticated.
      // Account details (display name) won't be available until next full login.
      isAuthenticated.value = true
    }
  })()

  return initPromise
}

function isSessionExpired() {
  const loginAt = localStorage.getItem(STAFF_SESSION_KEY)
  if (!loginAt) return true
  return Date.now() - Number(loginAt) > STAFF_SESSION_MS
}

function clearSession() {
  isAuthenticated.value = false
  account.value = null
  localStorage.removeItem(STAFF_SESSION_KEY)
  if (msalInstance) {
    const active = msalInstance.getActiveAccount()
    if (active) {
      msalInstance.setActiveAccount(null)
      // Clear MSAL cache for this account
      msalInstance.getTokenCache?.()
      try { msalInstance.logoutRedirect === undefined } catch {}
    }
    // Clear all MSAL keys from localStorage
    Object.keys(localStorage)
      .filter(k => k.startsWith('msal.') || k.startsWith('login.'))
      .forEach(k => localStorage.removeItem(k))
  }
}

/** Check session expiry — called by the router guard on each navigation. */
export function checkSessionExpiry() {
  if (isAuthenticated.value && isSessionExpired()) {
    clearSession()
  }
}

/** Silently clear the MSAL session (used by kiosk inactivity timer). */
export function clearStaffSession() {
  clearSession()
}

async function login(targetPath = '/budtender') {
  sessionStorage.setItem('auth_redirect', targetPath)
  await msalInstance.loginRedirect({ scopes: ['User.Read'] })
}

async function logout() {
  localStorage.removeItem(STAFF_SESSION_KEY)
  await msalInstance.logoutRedirect({ postLogoutRedirectUri: '/' })
}

export function useAuth() {
  return { isAuthenticated, account, login, logout }
}
