import { ref } from 'vue'

// Singleton — checked on module load (i.e. each full page load).
// No sessionStorage/localStorage persistence: the flag is only active
// when ?bundles=1 is present in the URL.
function readBundlesFlag() {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('bundles') === '1'
}

export const bundlesEnabled = ref(readBundlesFlag())

export function useFeatureFlags() {
  return { bundlesEnabled }
}
