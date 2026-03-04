<script setup>
import { useRoute, useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session'

const props = defineProps({
  products:  { type: Array,   required: true },
  columns:   { type: Array,   default: () => ['name', 'strain', 'potency', 'price'] },
  // Set false on pages where spec says no sorting (TincturesTopicals)
  sortable:  { type: Boolean, default: true },
})

const route  = useRoute()
const router = useRouter()
const session = useSessionStore()

// ── Sorting ───────────────────────────────────────────────────────────────────

// Default direction for the first click on each sortable column
const SORT_DEFAULTS = { name: 'asc', potency: 'desc', price: 'asc' }

function sortBy(col) {
  if (!props.sortable || !(col in SORT_DEFAULTS)) return
  const isActive = route.query.sort === col
  const dir = isActive
    ? (route.query.dir === 'asc' ? 'desc' : 'asc')  // second click: flip
    : SORT_DEFAULTS[col]                               // first click: default
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
  const val = String(product.Potency).replace(/%/g, '')
  const unit = product['Potency Unit'] ?? '%'
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

          <th v-if="columns.includes('strain')" class="pb-2 pr-6">Strain</th>

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
            'border-b border-gray-100 cursor-pointer transition-colors',
            isChecked(product.id) ? 'bg-teal-50 hover:bg-teal-100' : 'hover:bg-gray-50',
          ]"
          @click="toggle(product)"
        >
          <td class="py-3 pr-2">
            <input
              type="checkbox"
              :checked="isChecked(product.id)"
              @click.stop
              @change="toggle(product)"
              class="h-5 w-5 rounded accent-teal-500 cursor-pointer"
            />
          </td>
          <td v-if="columns.includes('name')" class="py-3 pr-6">
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
</template>
