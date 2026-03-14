<script setup>
import { ref, computed, onMounted } from 'vue'
import { useSettingsStore, SETTINGS_DEFAULTS } from '@/stores/settings'
import { useAuth } from '@/composables/useAuth'

const { account, logout } = useAuth()
const settingsStore = useSettingsStore()

const FIELDS = [
  { section: 'Timeouts & Intervals', fields: [
    { key: 'timeouts.inactivityMs', label: 'Inactivity Timeout', unit: 'seconds', multiplier: 1000, description: 'Time before kiosk resets to home' },
    { key: 'timeouts.heartbeatIntervalMs', label: 'Heartbeat Interval', unit: 'seconds', multiplier: 1000, description: 'How often kiosk pings the server with current route' },
    { key: 'timeouts.productRefreshIntervalMs', label: 'Product Refresh Interval', unit: 'seconds', multiplier: 1000, description: 'How often products re-fetch from Dutchie' },
    { key: 'timeouts.budtenderPollIntervalMs', label: 'Budtender Poll Interval', unit: 'seconds', multiplier: 1000, description: 'How often the budtender page checks for new orders' },
    { key: 'timeouts.activeSessionThresholdMs', label: 'Active Session Threshold', unit: 'seconds', multiplier: 1000, description: 'Session is "active" if updated within this window' },
    { key: 'timeouts.idleSessionThresholdMs', label: 'Idle Session Threshold', unit: 'seconds', multiplier: 1000, description: 'Session is "idle" if not updated beyond this window' },
    { key: 'timeouts.sessionTimeoutMinutes', label: 'Backend Session Timeout', unit: 'minutes', multiplier: 1, description: 'Server purges sessions older than this' },
    { key: 'timeouts.cartToastDurationMs', label: 'Cart Toast Duration', unit: 'seconds', multiplier: 1000, description: 'How long "added to cart" toast stays visible' },
    { key: 'timeouts.dutchieFetchRetries', label: 'Dutchie Fetch Retries', unit: 'count', multiplier: 1, description: 'Number of retry attempts for Dutchie API' },
    { key: 'timeouts.sessionPostRetries', label: 'Session POST Retries', unit: 'count', multiplier: 1, description: 'Number of retry attempts for session sync' },
    { key: 'timeouts.sessionRetryBackoffMs', label: 'Session Retry Backoff', unit: 'seconds', multiplier: 1000, description: 'Base delay between session POST retries (multiplied by attempt)' },
  ]},
  { section: 'Display Limits', fields: [
    { key: 'display.maxDealsPerCategory', label: 'Max Deals Per Category', unit: 'count', multiplier: 1, description: 'Deals shown per category on home page before "show all"' },
    { key: 'display.maxScatterDots', label: 'Max Scatter Plot Dots', unit: 'count', multiplier: 1, description: 'Max products displayed on the Explore chart' },
  ]},
  { section: 'Regulatory', fields: [
    { key: 'regulatory.dailyLimitG', label: 'Daily Purchase Limit', unit: 'grams', multiplier: 1, description: 'MA daily flower-equivalent purchase limit' },
  ]},
]

// Initialize form with defaults so inputs are never empty during async load
function buildFormFromStore() {
  const f = {}
  for (const section of FIELDS) {
    for (const field of section.fields) {
      const raw = settingsStore.get(field.key)
      f[field.key] = raw / field.multiplier
    }
  }
  f['regulatory.categoryFactors'] = { ...settingsStore.get('regulatory.categoryFactors') }
  f['dutchie.retailerId'] = settingsStore.get('dutchie.retailerId')
  f['dutchie.bearerToken'] = settingsStore.get('dutchie.bearerToken')
  return f
}

const form = ref(buildFormFromStore())
const saving = ref(false)
const saveResult = ref(null) // { success, message }
const canPush = ref(false)
const pushing = ref(false)
const pushResult = ref(null)

// ── Releases / Rollback ──────────────────────────────────────────────────────
const releases = ref([])
const currentRelease = ref(null)
const rollbackTarget = ref(null) // set to a release object to show confirmation modal
const rollingBack = ref(false)
const rollbackResult = ref(null)

async function loadReleases() {
  try {
    const res = await fetch('/api/admin/releases')
    if (!res.ok) return
    const data = await res.json()
    releases.value = data.releases || []
    currentRelease.value = data.current
  } catch {}
}

function formatReleaseDate(timestamp) {
  if (!timestamp) return ''
  // timestamp format: YYYYMMDD-HHMMSS
  const m = timestamp.match(/^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/)
  if (!m) return timestamp
  const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6])
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

async function confirmRollback() {
  if (!rollbackTarget.value) return
  rollingBack.value = true
  rollbackResult.value = null
  try {
    const res = await fetch('/api/admin/rollback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ release: rollbackTarget.value.name }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || `HTTP ${res.status}`)
    }
    rollbackResult.value = { success: true, message: `Rolling back to ${rollbackTarget.value.name}. Reloading in 5 seconds...` }
    rollbackTarget.value = null
    setTimeout(() => location.reload(), 5000)
  } catch (e) {
    rollbackResult.value = { success: false, message: `Rollback failed: ${e.message}` }
  } finally {
    rollingBack.value = false
    rollbackTarget.value = null
  }
}

const CATEGORY_FACTOR_LABELS = {
  FLOWER: 'Flower',
  PRE_ROLLS: 'Pre-Rolls',
  CONCENTRATES: 'Concentrates',
  VAPORIZERS: 'Vaporizers',
  EDIBLES: 'Edibles',
  TINCTURES: 'Tinctures',
}

function loadForm() {
  form.value = buildFormFromStore()
}

const hasChanges = computed(() => {
  for (const section of FIELDS) {
    for (const field of section.fields) {
      const current = settingsStore.get(field.key)
      const formVal = form.value[field.key] * field.multiplier
      if (current !== formVal) return true
    }
  }
  const currentFactors = settingsStore.get('regulatory.categoryFactors')
  const formFactors = form.value['regulatory.categoryFactors']
  if (!formFactors) return false
  for (const key of Object.keys(currentFactors)) {
    if (currentFactors[key] !== formFactors[key]) return true
  }
  if (settingsStore.get('dutchie.retailerId') !== form.value['dutchie.retailerId']) return true
  if (settingsStore.get('dutchie.bearerToken') !== form.value['dutchie.bearerToken']) return true
  return false
})

async function save() {
  saving.value = true
  saveResult.value = null
  try {
    const data = {}
    for (const section of FIELDS) {
      for (const field of section.fields) {
        data[field.key] = form.value[field.key] * field.multiplier
      }
    }
    data['regulatory.categoryFactors'] = { ...form.value['regulatory.categoryFactors'] }
    data['dutchie.retailerId'] = form.value['dutchie.retailerId']
    data['dutchie.bearerToken'] = form.value['dutchie.bearerToken']
    await settingsStore.saveSettings(data)
    saveResult.value = { success: true, message: 'Settings saved. Changes take effect on next kiosk reload.' }
  } catch (e) {
    saveResult.value = { success: false, message: `Save failed: ${e.message}` }
  } finally {
    saving.value = false
    setTimeout(() => (saveResult.value = null), 4000)
  }
}

async function pushToProd() {
  pushing.value = true
  pushResult.value = null
  try {
    const res = await fetch('/api/settings/push-to-prod', { method: 'POST' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    pushResult.value = { success: true, message: `Pushed ${data.pushed} setting(s) to prod.` }
  } catch (e) {
    pushResult.value = { success: false, message: `Push failed: ${e.message}` }
  } finally {
    pushing.value = false
    setTimeout(() => (pushResult.value = null), 4000)
  }
}

function resetToDefaults() {
  const f = {}
  for (const section of FIELDS) {
    for (const field of section.fields) {
      f[field.key] = SETTINGS_DEFAULTS[field.key] / field.multiplier
    }
  }
  f['regulatory.categoryFactors'] = { ...SETTINGS_DEFAULTS['regulatory.categoryFactors'] }
  f['dutchie.retailerId'] = SETTINGS_DEFAULTS['dutchie.retailerId']
  f['dutchie.bearerToken'] = SETTINGS_DEFAULTS['dutchie.bearerToken']
  form.value = f
}

onMounted(async () => {
  await settingsStore.loadSettings()
  loadForm()
  loadReleases()
  try {
    const res = await fetch('/api/bundles/push-available')
    if (res.ok) {
      const data = await res.json()
      canPush.value = data.available
    }
  } catch {}
})
</script>

<template>
  <main class="p-8 max-w-2xl mx-auto">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-black tracking-wide">Settings</h1>
      <div class="flex items-center gap-4">
        <span v-if="account" class="text-sm text-gray-400">{{ account.name }}</span>
        <a href="/budtender" class="text-sm font-semibold text-teal-600 hover:text-teal-800 transition-colors">← Orders</a>
        <a href="/bundles" class="text-sm font-semibold text-teal-600 hover:text-teal-800 transition-colors">Bundles →</a>
        <button @click="logout" class="text-sm font-semibold text-gray-400 hover:text-gray-600 transition-colors">Sign Out</button>
      </div>
    </div>

    <!-- Releases -->
    <div v-if="releases.length" class="mb-10">
      <h2 class="text-sm font-bold uppercase tracking-widest text-gray-400 mb-4">Releases</h2>
      <div class="space-y-2">
        <div
          v-for="rel in releases"
          :key="rel.name"
          :class="[
            'flex items-center gap-4 px-4 py-3 rounded-lg border text-sm',
            rel.current ? 'border-teal-300 bg-teal-50' : 'border-gray-200 bg-white',
          ]"
        >
          <div class="flex-1 min-w-0">
            <span class="font-mono font-bold" :class="rel.current ? 'text-teal-700' : 'text-gray-700'">{{ rel.sha }}</span>
            <span v-if="rel.current" class="ml-2 text-xs font-bold uppercase text-teal-600">current</span>
            <div class="text-xs text-gray-400 truncate">{{ formatReleaseDate(rel.timestamp) }}<span v-if="rel.deployer"> &middot; {{ rel.deployer }}</span></div>
          </div>
          <button
            v-if="!rel.current"
            type="button"
            @click="rollbackTarget = rel"
            class="px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 transition-colors shrink-0"
          >Roll Back</button>
        </div>
      </div>

      <!-- Rollback toast -->
      <Transition name="toast">
        <div
          v-if="rollbackResult"
          :class="[
            'mt-4 rounded-lg px-4 py-3 text-sm font-semibold',
            rollbackResult.success ? 'bg-teal-50 text-teal-700 border border-teal-200' : 'bg-red-50 text-red-700 border border-red-200',
          ]"
        >{{ rollbackResult.message }}</div>
      </Transition>
    </div>

    <!-- Rollback Confirmation Modal -->
    <Teleport to="body">
      <Transition name="toast">
        <div v-if="rollbackTarget" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" @click.self="rollbackTarget = null">
          <div class="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full mx-4">
            <h3 class="text-lg font-bold text-gray-900 mb-2">Roll back?</h3>
            <p class="text-sm text-gray-600 mb-1">
              This will revert the kiosk to release <span class="font-mono font-bold">{{ rollbackTarget.sha }}</span>
              <span class="text-gray-400">({{ formatReleaseDate(rollbackTarget.timestamp) }})</span>.
            </p>
            <p class="text-sm text-gray-600 mb-6">The page will reload automatically in a few seconds.</p>
            <div class="flex gap-3 justify-end">
              <button
                type="button"
                @click="rollbackTarget = null"
                class="px-4 py-2 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
              >Cancel</button>
              <button
                type="button"
                @click="confirmRollback"
                :disabled="rollingBack"
                class="px-4 py-2 rounded-lg text-sm font-bold bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 transition-colors"
              >{{ rollingBack ? 'Rolling back...' : 'Confirm Roll Back' }}</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <form @submit.prevent="save" class="space-y-8">
      <div v-for="section in FIELDS" :key="section.section">
        <h2 class="text-sm font-bold uppercase tracking-widest text-gray-400 mb-4">{{ section.section }}</h2>
        <div class="space-y-4">
          <div v-for="field in section.fields" :key="field.key" class="flex items-start gap-4">
            <div class="flex-1">
              <label :for="field.key" class="block text-sm font-semibold text-gray-700">{{ field.label }}</label>
              <p class="text-xs text-gray-400">{{ field.description }}</p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <input
                :id="field.key"
                v-model.number="form[field.key]"
                type="number"
                step="any"
                min="0"
                class="w-24 text-right border border-gray-300 rounded-lg px-3 py-1.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
              <span class="text-xs text-gray-400 w-16">{{ field.unit }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Category Factors -->
      <div>
        <h2 class="text-sm font-bold uppercase tracking-widest text-gray-400 mb-2">Category Conversion Factors</h2>
        <p class="text-xs text-gray-400 mb-4">Flower-equivalent grams per 1g of product, used for daily quota calculation.</p>
        <div class="space-y-3">
          <div v-for="(label, cat) in CATEGORY_FACTOR_LABELS" :key="cat" class="flex items-center gap-4">
            <span class="flex-1 text-sm font-semibold text-gray-700">{{ label }}</span>
            <input
              v-if="form['regulatory.categoryFactors']"
              v-model.number="form['regulatory.categoryFactors'][cat]"
              type="number"
              step="any"
              min="0"
              class="w-24 text-right border border-gray-300 rounded-lg px-3 py-1.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
            <span class="text-xs text-gray-400 w-16">factor</span>
          </div>
        </div>
      </div>

      <!-- Dutchie API -->
      <div>
        <h2 class="text-sm font-bold uppercase tracking-widest text-gray-400 mb-4">Dutchie API</h2>
        <div class="space-y-4">
          <div class="flex items-start gap-4">
            <div class="flex-1">
              <label for="dutchie.retailerId" class="block text-sm font-semibold text-gray-700">Retailer ID</label>
              <p class="text-xs text-gray-400">Dutchie retailer UUID for menu queries</p>
            </div>
            <input
              id="dutchie.retailerId"
              v-model="form['dutchie.retailerId']"
              type="text"
              class="w-96 border border-gray-300 rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>
          <div class="flex items-start gap-4">
            <div class="flex-1">
              <label for="dutchie.bearerToken" class="block text-sm font-semibold text-gray-700">Bearer Token</label>
              <p class="text-xs text-gray-400">Authorization token for Dutchie GraphQL API</p>
            </div>
            <input
              id="dutchie.bearerToken"
              v-model="form['dutchie.bearerToken']"
              type="password"
              class="w-96 border border-gray-300 rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex items-center gap-3 pt-4 border-t border-gray-200">
        <button
          type="submit"
          :disabled="!hasChanges || saving"
          :class="[
            'px-6 py-2.5 rounded-lg text-sm font-bold transition-colors',
            hasChanges && !saving
              ? 'bg-teal-600 text-white hover:bg-teal-700'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed',
          ]"
        >{{ saving ? 'Saving...' : 'Save' }}</button>

        <button
          v-if="canPush"
          type="button"
          @click="pushToProd"
          :disabled="pushing"
          class="px-4 py-2.5 rounded-lg bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 disabled:opacity-50 transition-colors"
        >{{ pushing ? 'Pushing...' : 'Push to Prod' }}</button>

        <button
          type="button"
          @click="resetToDefaults"
          class="text-sm font-semibold text-gray-400 hover:text-gray-600 transition-colors ml-auto"
        >Reset to Defaults</button>
      </div>

      <!-- Toast -->
      <Transition name="toast">
        <div
          v-if="saveResult"
          :class="[
            'rounded-lg px-4 py-3 text-sm font-semibold',
            saveResult.success ? 'bg-teal-50 text-teal-700 border border-teal-200' : 'bg-red-50 text-red-700 border border-red-200',
          ]"
        >{{ saveResult.message }}</div>
      </Transition>
      <Transition name="toast">
        <div
          v-if="pushResult"
          :class="[
            'rounded-lg px-4 py-3 text-sm font-semibold',
            pushResult.success ? 'bg-teal-50 text-teal-700 border border-teal-200' : 'bg-red-50 text-red-700 border border-red-200',
          ]"
        >{{ pushResult.message }}</div>
      </Transition>
    </form>
  </main>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
