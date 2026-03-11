import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { buildMatchFn } from '@/utils/matchCriteria'

export const useBundlesStore = defineStore('bundles', () => {
  const bundles = ref([])
  const loading = ref(false)
  const error = ref(null)

  function hydrate(raw) {
    return raw.map(b => ({
      ...b,
      // Reconstruct schedule object for compatibility with existing code
      schedule: b.scheduleDays || b.scheduleDates
        ? { days: b.scheduleDays ?? undefined, dates: b.scheduleDates ?? undefined }
        : undefined,
      match: buildMatchFn(b.matchCriteria),
    }))
  }

  async function loadBundles() {
    loading.value = true
    error.value = null
    try {
      const res = await fetch('/api/bundles')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      bundles.value = hydrate(data)
    } catch (e) {
      console.error('Failed to load bundles:', e)
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  // For the CRUD admin page
  async function loadAllBundles() {
    loading.value = true
    error.value = null
    try {
      const res = await fetch('/api/bundles?includeDisabled=1')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      bundles.value = hydrate(data)
    } catch (e) {
      console.error('Failed to load bundles:', e)
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function createBundle(data) {
    const res = await fetch('/api/bundles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || `HTTP ${res.status}`)
    }
  }

  async function updateBundle(id, data) {
    const res = await fetch(`/api/bundles/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || `HTTP ${res.status}`)
    }
  }

  async function deleteBundle(id) {
    const res = await fetch(`/api/bundles/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
  }

  const activeBundles = computed(() => {
    const now = new Date()
    return bundles.value.filter(b => {
      if (!b.enabled) return false
      if (!b.schedule) return true
      const { days, dates } = b.schedule
      if (days?.length && !days.includes(now.getDay())) return false
      if (dates?.length && !dates.includes(now.getDate())) return false
      return true
    })
  })

  return {
    bundles,
    loading,
    error,
    activeBundles,
    loadBundles,
    loadAllBundles,
    createBundle,
    updateBundle,
    deleteBundle,
  }
})
