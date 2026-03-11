<script setup>
import { ref, computed, onMounted } from 'vue'
import { useBundlesStore } from '@/stores/bundles'
import { useProductsStore } from '@/stores/products'
import BundleForm from '@/components/BundleForm.vue'

const bundlesStore = useBundlesStore()
const productsStore = useProductsStore()

const editing = ref(null)    // bundle object being edited, or 'new' for create
const confirmDelete = ref(null) // bundle id pending delete confirmation

onMounted(() => {
  bundlesStore.loadAllBundles()
  if (!productsStore.products.length) productsStore.loadProducts()
})

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function scheduleLabel(bundle) {
  const parts = []
  if (bundle.scheduleDays?.length) {
    parts.push(bundle.scheduleDays.map(d => DAY_NAMES[d]).join(', '))
  }
  if (bundle.scheduleDates?.length) {
    parts.push(bundle.scheduleDates.map(d => ordinal(d)).join(', ') + ' of month')
  }
  return parts.length ? parts.join(' + ') : 'Always on'
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

function startEdit(bundle) {
  editing.value = { ...bundle }
}

function startCreate() {
  editing.value = 'new'
}

async function handleSave(data) {
  if (editing.value === 'new') {
    await bundlesStore.createBundle(data)
  } else {
    await bundlesStore.updateBundle(data.id, data)
  }
  editing.value = null
  await bundlesStore.loadAllBundles()
}

async function handleDelete(id) {
  await bundlesStore.deleteBundle(id)
  confirmDelete.value = null
  await bundlesStore.loadAllBundles()
}

async function toggleEnabled(bundle) {
  await bundlesStore.updateBundle(bundle.id, {
    ...toApiShape(bundle),
    enabled: !bundle.enabled,
  })
  await bundlesStore.loadAllBundles()
}

function toApiShape(bundle) {
  return {
    id: bundle.id,
    label: bundle.label,
    type: bundle.type,
    group: bundle.group,
    displayCategory: bundle.displayCategory,
    quantity: bundle.quantity,
    bundlePrice: bundle.bundlePrice,
    unitPrice: bundle.unitPrice,
    scheduleDays: bundle.scheduleDays,
    scheduleDates: bundle.scheduleDates,
    matchCriteria: bundle.matchCriteria,
    sortOrder: bundle.sortOrder,
    enabled: bundle.enabled,
  }
}

const groupedBundles = computed(() => {
  const groups = {}
  for (const b of bundlesStore.bundles) {
    const key = b.displayCategory || 'Uncategorized'
    if (!groups[key]) groups[key] = []
    groups[key].push(b)
  }
  const order = ['Flower', 'Pre-Rolls', 'Edibles', 'Vapes', 'Dabs', 'Uncategorized']
  return order.filter(k => groups[k]).map(k => ({ category: k, bundles: groups[k] }))
})
</script>

<template>
  <main class="p-8 max-w-4xl mx-auto">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-black tracking-wide">Bundle Deals</h1>
      <div class="flex items-center gap-4">
        <a href="/budtender" class="text-sm font-semibold text-teal-600 hover:text-teal-800 transition-colors">← Orders</a>
        <button
          @click="startCreate"
          class="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-bold hover:bg-teal-700 transition-colors"
        >+ New Bundle</button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="bundlesStore.loading && !bundlesStore.bundles.length" class="text-gray-400 text-lg py-12 text-center">
      Loading bundles...
    </div>

    <!-- Error -->
    <div v-else-if="bundlesStore.error" class="text-red-500 text-lg py-12 text-center">
      Failed to load bundles: {{ bundlesStore.error }}
    </div>

    <!-- Empty -->
    <div v-else-if="!bundlesStore.bundles.length" class="text-gray-400 text-lg py-12 text-center">
      No bundles yet. Click "+ New Bundle" to create one.
    </div>

    <!-- Bundle list grouped by category -->
    <template v-else>
      <div v-for="group in groupedBundles" :key="group.category" class="mb-8">
        <h2 class="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">{{ group.category }}</h2>
        <div class="flex flex-col gap-3">
          <div
            v-for="bundle in group.bundles"
            :key="bundle.id"
            :class="['rounded-xl border p-4 shadow-sm transition-colors', bundle.enabled ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-200 opacity-60']"
          >
            <div class="flex items-start gap-3">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1">
                  <span class="font-bold text-gray-800">{{ bundle.label }}</span>
                  <span class="text-xs px-1.5 py-0.5 rounded font-semibold"
                    :class="bundle.type === 'quantity' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'"
                  >{{ bundle.type }}</span>
                  <span v-if="!bundle.enabled" class="text-xs px-1.5 py-0.5 rounded bg-gray-200 text-gray-500 font-semibold">Disabled</span>
                </div>
                <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                  <span>{{ scheduleLabel(bundle) }}</span>
                  <span v-if="bundle.group">Group: {{ bundle.group }}</span>
                  <span v-if="bundle.type === 'quantity'">{{ bundle.quantity }} for ${{ bundle.bundlePrice }}</span>
                  <span v-else-if="bundle.type === 'timed'">${{ bundle.unitPrice }}/ea</span>
                </div>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <button
                  @click="toggleEnabled(bundle)"
                  :title="bundle.enabled ? 'Disable' : 'Enable'"
                  :class="['w-10 h-6 rounded-full transition-colors relative', bundle.enabled ? 'bg-teal-500' : 'bg-gray-300']"
                >
                  <span
                    :class="['absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform', bundle.enabled ? 'left-[18px]' : 'left-0.5']"
                  ></span>
                </button>
                <button
                  @click="startEdit(bundle)"
                  class="text-sm font-semibold text-teal-600 hover:text-teal-800 transition-colors"
                >Edit</button>
                <button
                  v-if="confirmDelete !== bundle.id"
                  @click="confirmDelete = bundle.id"
                  class="text-sm font-semibold text-red-400 hover:text-red-600 transition-colors"
                >Delete</button>
                <template v-else>
                  <button
                    @click="handleDelete(bundle.id)"
                    class="text-sm font-bold text-red-600"
                  >Confirm</button>
                  <button
                    @click="confirmDelete = null"
                    class="text-sm text-gray-400"
                  >Cancel</button>
                </template>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Create/Edit modal -->
    <Teleport to="body">
      <div v-if="editing" class="fixed inset-0 z-50 flex items-start justify-center bg-black/50 overflow-y-auto py-8" @click.self="editing = null">
        <BundleForm
          :bundle="editing === 'new' ? null : editing"
          :products="productsStore.products"
          @save="handleSave"
          @cancel="editing = null"
        />
      </div>
    </Teleport>
  </main>
</template>
