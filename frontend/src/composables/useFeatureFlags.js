import { ref } from 'vue'

// Singleton — checked on module load (i.e. each full page load).
// Defaults to enabled; pass ?bundles=0 in the URL to disable.
function readBundlesFlag() {
  if (typeof window === 'undefined') return true
  const param = new URLSearchParams(window.location.search).get('bundles')
  return param === null ? true : param !== '0'
}

export const bundlesEnabled = ref(readBundlesFlag())

export function useFeatureFlags() {
  return { bundlesEnabled }
}
