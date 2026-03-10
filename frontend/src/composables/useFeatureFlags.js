import { ref } from 'vue'

// Singleton — read once on module load, persist to sessionStorage so the flag
// survives Vue Router navigation within the same tab.
function readBundlesFlag() {
  if (typeof window === 'undefined') return false
  const fromUrl = new URLSearchParams(window.location.search).get('bundles') === '1'
  if (fromUrl) sessionStorage.setItem('ff_bundles', '1')
  return fromUrl || sessionStorage.getItem('ff_bundles') === '1'
}

export const bundlesEnabled = ref(readBundlesFlag())

export function useFeatureFlags() {
  return { bundlesEnabled }
}
