<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session'
import ProductModal from './ProductModal.vue'

const props = defineProps({
  products:  { type: Array,   required: true },
  columns:   { type: Array,   default: () => ['name', 'strain', 'potency', 'price'] },
  sortable:  { type: Boolean, default: true },
})

const route  = useRoute()
const router = useRouter()
const session = useSessionStore()

// ── Modal ─────────────────────────────────────────────────────────────────────

const modalProduct = ref(null)

// ── Sorting ───────────────────────────────────────────────────────────────────

const SORT_DEFAULTS = { name: 'asc', strain: 'asc', potency: 'desc', price: 'asc' }

function sortBy(col) {
  if (!props.sortable || !(col in SORT_DEFAULTS)) return
  const isActive = route.query.sort === col
  const dir = isActive
    ? (route.query.dir === 'asc' ? 'desc' : 'asc')
    : SORT_DEFAULTS[col]
  router.replace({ query: { ...route.query, sort: col, dir } })
}

function sortIcon(col) {
  if (!props.sortable || route.query.sort !== col) return ''
  return route.query.dir === 'desc' ? ' ↓' : ' ↑'
}

function isActiveSort(col) {
  return props.sortable && route.query.sort === col
}

// ── Checkboxes ────────────────────────────────────────────────────────────────

function isChecked(id) {
  return !!session.selections[id]
}

function toggle(product) {
  session.toggleSelection(product.id, {
    name: product.Name ?? '',
    unitWeight: product['Unit Weight'] ?? '',
    price: product.Price ?? 0,
  })
}

function potency(product) {
  if (product.Potency == null) return '—'
  const unit = product['Potency Unit'] ?? '%'
  const val = String(product.Potency).replace(/[^0-9.]/g, '')
  return `${val}${unit}`
}
</script>

<template>
  <div class="overflow-x-auto">
    <table class="w-full text-base">
      <thead>
        <tr class="border-b-2 border-gray-200 text-left text-xs font-bold uppercase tracking-widest text-gray-400">
          <th class="w-10 pb-2 pr-2"></th>

          <th v-if="columns.includes('name')" class="pb-2 pr-6">
            <button
              v-if="sortable"
              @click="sortBy('name')"
              :class="['hover:text-gray-700 transition-colors', isActiveSort('name') && 'text-teal-600']"
            >Product{{ sortIcon('name') }}</button>
            <span v-else>Product</span>
          </th>

          <th v-if="columns.includes('strain')" class="pb-2 pr-6">
            <button
              v-if="sortable"
              @click="sortBy('strain')"
              :class="['hover:text-gray-700 transition-colors', isActiveSort('strain') && 'text-teal-600']"
            >Strain{{ sortIcon('strain') }}</button>
            <span v-else>Strain</span>
          </th>

          <th v-if="columns.includes('potency')" class="pb-2 pr-6">
            <button
              v-if="sortable"
              @click="sortBy('potency')"
              :class="['hover:text-gray-700 transition-colors', isActiveSort('potency') && 'text-teal-600']"
            >TAC{{ sortIcon('potency') }}</button>
            <span v-else>TAC</span>
          </th>

          <th v-if="columns.includes('price')" class="pb-2">
            <button
              v-if="sortable"
              @click="sortBy('price')"
              :class="['hover:text-gray-700 transition-colors', isActiveSort('price') && 'text-teal-600']"
            >Price{{ sortIcon('price') }}</button>
            <span v-else>Price</span>
          </th>
        </tr>
      </thead>

      <tbody>
        <tr
          v-for="product in products"
          :key="product.id"
          :class="[
            'border-b border-gray-100 transition-colors',
            isChecked(product.id) ? 'bg-teal-50' : '',
          ]"
        >
          <!-- Checkbox -->
          <td class="py-3 pr-2">
            <input
              type="checkbox"
              :checked="isChecked(product.id)"
              @change="toggle(product)"
              class="h-5 w-5 rounded accent-teal-500 cursor-pointer"
            />
          </td>

          <!-- Name — click opens modal -->
          <td
            v-if="columns.includes('name')"
            class="py-3 pr-6 cursor-pointer hover:text-teal-600 transition-colors"
            @click="modalProduct = product"
          >
            {{ product.Name }}
            <span v-if="product['Unit Weight']" class="ml-1.5 font-bold text-gray-700">
              {{ product['Unit Weight'] }}
            </span>
          </td>

          <td v-if="columns.includes('strain')" class="py-3 pr-6 text-gray-500">
            {{ product.Strain || '—' }}
          </td>
          <td v-if="columns.includes('potency')" class="py-3 pr-6 tabular-nums">
            {{ potency(product) }}
          </td>
          <td v-if="columns.includes('price')" class="py-3 tabular-nums">
            {{ product.Price != null ? `$${product.Price}` : '—' }}
          </td>
        </tr>

        <tr v-if="products.length === 0">
          <td :colspan="columns.length + 1" class="py-12 text-center text-gray-400">
            No products match your filters.
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <ProductModal
    v-if="modalProduct"
    :product="modalProduct"
    @close="modalProduct = null"
  />
</template>
