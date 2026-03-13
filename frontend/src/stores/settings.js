import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

const DEFAULTS = {
  'timeouts.inactivityMs': 120000,
  'timeouts.heartbeatIntervalMs': 30000,
  'timeouts.productRefreshIntervalMs': 60000,
  'timeouts.budtenderPollIntervalMs': 1000,
  'timeouts.activeSessionThresholdMs': 10000,
  'timeouts.idleSessionThresholdMs': 30000,
  'timeouts.sessionTimeoutMinutes': 15,
  'timeouts.cartToastDurationMs': 3500,
  'timeouts.dutchieFetchRetries': 3,
  'timeouts.sessionPostRetries': 3,
  'timeouts.sessionRetryBackoffMs': 1000,
  'display.maxDealsPerCategory': 3,
  'display.maxScatterDots': 60,
  'regulatory.dailyLimitG': 28,
  'regulatory.categoryFactors': {
    FLOWER: 1,
    PRE_ROLLS: 1,
    CONCENTRATES: 5.6,
    VAPORIZERS: 5.6,
    EDIBLES: 56,
    TINCTURES: 1,
  },
  'dutchie.retailerId': import.meta.env.VITE_DUTCHIE_RETAILER_ID ?? '',
  'dutchie.bearerToken': import.meta.env.VITE_DUTCHIE_BEARER_TOKEN ?? '',
}

export { DEFAULTS as SETTINGS_DEFAULTS }

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref({})
  const loaded = ref(false)

  async function loadSettings() {
    try {
      const res = await fetch('/api/settings')
      if (res.ok) settings.value = await res.json()
    } catch (e) {
      console.error('Failed to load settings:', e)
    }
    loaded.value = true
  }

  async function saveSettings(data) {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    settings.value = { ...settings.value, ...data }
  }

  function get(key) {
    return settings.value[key] ?? DEFAULTS[key]
  }

  const inactivityMs = computed(() => get('timeouts.inactivityMs'))
  const heartbeatIntervalMs = computed(() => get('timeouts.heartbeatIntervalMs'))
  const productRefreshIntervalMs = computed(() => get('timeouts.productRefreshIntervalMs'))
  const budtenderPollIntervalMs = computed(() => get('timeouts.budtenderPollIntervalMs'))
  const activeSessionThresholdMs = computed(() => get('timeouts.activeSessionThresholdMs'))
  const idleSessionThresholdMs = computed(() => get('timeouts.idleSessionThresholdMs'))
  const cartToastDurationMs = computed(() => get('timeouts.cartToastDurationMs'))
  const dutchieFetchRetries = computed(() => get('timeouts.dutchieFetchRetries'))
  const sessionPostRetries = computed(() => get('timeouts.sessionPostRetries'))
  const sessionRetryBackoffMs = computed(() => get('timeouts.sessionRetryBackoffMs'))
  const maxDealsPerCategory = computed(() => get('display.maxDealsPerCategory'))
  const maxScatterDots = computed(() => get('display.maxScatterDots'))
  const dailyLimitG = computed(() => get('regulatory.dailyLimitG'))
  const categoryFactors = computed(() => get('regulatory.categoryFactors'))
  const dutchieRetailerId = computed(() => get('dutchie.retailerId'))
  const dutchieBearerToken = computed(() => get('dutchie.bearerToken'))

  return {
    settings,
    loaded,
    loadSettings,
    saveSettings,
    get,
    inactivityMs,
    heartbeatIntervalMs,
    productRefreshIntervalMs,
    budtenderPollIntervalMs,
    activeSessionThresholdMs,
    idleSessionThresholdMs,
    cartToastDurationMs,
    dutchieFetchRetries,
    sessionPostRetries,
    sessionRetryBackoffMs,
    maxDealsPerCategory,
    maxScatterDots,
    dailyLimitG,
    categoryFactors,
    dutchieRetailerId,
    dutchieBearerToken,
  }
})
