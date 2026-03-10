<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session'
import ProductModal from './ProductModal.vue'
import { strainLabel } from '@/utils/strainLabels'
import { useCartAnimation } from '@/composables/useCartAnimation'
import { useDragToCart } from '@/composables/useDragToCart'
import { useAnalytics } from '@/composables/useAnalytics'
import { useProductBundles } from '@/composables/useBundles'
import { useFeatureFlags } from '@/composables/useFeatureFlags'

const props = defineProps({
  products:  { type: Array,   required: true },
  columns:   { type: Array,   default: () => ['name', 'strain', 'potency', 'price', 'stock'] },
  sortable:  { type: Boolean, default: true },
})

const route  = useRoute()
const router = useRouter()
const session = useSessionStore()
const { fire: fireCartAnimation, fireToast, BUBBLE_DURATION } = useCartAnimation()
const { startDrag } = useDragToCart()
const { track } = useAnalytics()
const { activeBundlesForProduct } = useProductBundles()
const { bundlesEnabled } = useFeatureFlags()

// ── Modal ─────────────────────────────────────────────────────────────────────

const modalProduct = ref(null)

// ── Sorting ───────────────────────────────────────────────────────────────────

const SORT_DEFAULTS = { name: 'asc', strain: 'asc', potency: 'desc', price: 'asc', stock: 'asc' }

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

// ── Cart quantity controls ────────────────────────────────────────────────────

function qty(id) {
  return session.selections[id]?.qty ?? 0
}

function cartDest(productId) {
  // Existing item in cart — target its row
  const row = document.querySelector(`[data-cart-item="${productId}"]`)
  if (row) {
    const r = row.getBoundingClientRect()
    return [r.left + r.width / 2, r.top + r.height / 2]
  }
  // New item — target after the last cart row, or the cart list container
  const list = document.querySelector('[data-cart-list]')
  if (list) {
    const last = list.lastElementChild
    const r = last ? last.getBoundingClientRect() : list.getBoundingClientRect()
    return [r.left + r.width / 2, last ? r.bottom + 28 : r.top + 28]
  }
  // Empty cart — fall back to cart header (fire() will handle null)
  return [null, null]
}

function updateQty(product, delta, event) {
  if (delta > 0) {
    const wasEmpty = session.selectionCount === 0
    const [dx, dy] = cartDest(product.id)
    fireCartAnimation(event.clientX, event.clientY, product.Image, dx, dy)
    if (wasEmpty) fireToast()
    track('add_to_cart', { source: 'browse', product_id: product.id, product_name: product.Name, category: product.Category })
    setTimeout(() => session.updateQuantity(product.id, {
      name: product.Name ?? '',
      unitWeight: product['Unit Weight'] ?? '',
      price: product.Price ?? 0,
      image: product.Image ?? null,
      category: product.Category ?? '',
      subcategory: product.Subcategory ?? '',
    }, delta), BUBBLE_DURATION)
  } else {
    session.updateQuantity(product.id, {
      name: product.Name ?? '',
      unitWeight: product['Unit Weight'] ?? '',
      price: product.Price ?? 0,
      image: product.Image ?? null,
      category: product.Category ?? '',
      subcategory: product.Subcategory ?? '',
    }, delta)
  }
}

// ── Drag to cart ──────────────────────────────────────────────────────────────

function onRowPointerDown(product, e) {
  startDrag(e, product, () => {
    track('add_to_cart', { source: 'drag', product_id: product.id, product_name: product.Name, category: product.Category })
    session.updateQuantity(product.id, {
      name: product.Name ?? '',
      unitWeight: product['Unit Weight'] ?? '',
      price: product.Price ?? 0,
      image: product.Image ?? null,
      category: product.Category ?? '',
      subcategory: product.Subcategory ?? '',
    }, 1)
  })
}

// ── Stock signal bars ─────────────────────────────────────────────────────────

function stockBars(qty) {
  if (qty == null) return { bars: 0, color: '' }
  if (qty <= 9)  return { bars: 1, color: '#f87171' }  // red-400
  if (qty <= 19) return { bars: 2, color: '#fbbf24' }  // amber-400
  return           { bars: 3, color: '#14b8a6' }        // teal-500
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
        <tr class="border-b border-gray-200 text-left text-sm font-bold text-slate-700">
          <th class="w-20 pb-3 pr-3">
            <button
              v-if="sortable && route.query.sort"
              @click="router.replace({ query: { ...route.query, sort: undefined, dir: undefined } })"
              class="text-xs font-semibold text-gray-400 hover:text-teal-600 transition-colors whitespace-nowrap"
            >↺ Popularity</button>
          </th>

          <th v-if="columns.includes('name')" class="pb-3 pr-6">
            <button
              v-if="sortable"
              @click="sortBy('name')"
              :class="['hover:text-teal-600 transition-colors', isActiveSort('name') && 'text-teal-600']"
            >Name{{ sortIcon('name') }}</button>
            <span v-else>Name</span>
          </th>

          <th v-if="columns.includes('strain')" class="pb-3 pr-6">
            <button
              v-if="sortable"
              @click="sortBy('strain')"
              :class="['hover:text-teal-600 transition-colors', isActiveSort('strain') && 'text-teal-600']"
            >Strain{{ sortIcon('strain') }}</button>
            <span v-else>Strain</span>
          </th>

          <th v-if="columns.includes('potency')" class="pb-3 pr-6">
            <button
              v-if="sortable"
              @click="sortBy('potency')"
              :class="['hover:text-teal-600 transition-colors', isActiveSort('potency') && 'text-teal-600']"
            >Potency (TAC){{ sortIcon('potency') }}</button>
            <span v-else>Potency (TAC)</span>
          </th>

          <th v-if="columns.includes('price')" class="pb-3">
            <button
              v-if="sortable"
              @click="sortBy('price')"
              :class="['hover:text-teal-600 transition-colors', isActiveSort('price') && 'text-teal-600']"
            >Price{{ sortIcon('price') }}</button>
            <span v-else>Price</span>
          </th>

          <th v-if="columns.includes('stock')" class="pb-3 pl-4">
            <button
              v-if="sortable"
              @click="sortBy('stock')"
              :class="['hover:text-teal-600 transition-colors', isActiveSort('stock') && 'text-teal-600']"
            >Stock{{ sortIcon('stock') }}</button>
            <span v-else>Stock</span>
          </th>
        </tr>
      </thead>

      <tbody>
        <tr
          v-for="product in products"
          :key="product.id"
          :data-product-id="product.id"
          :class="[
            'border-b border-gray-100 transition-colors',
            qty(product.id) > 0 ? 'bg-teal-50' : '',
          ]"
          style="user-select: none; -webkit-user-select: none; -webkit-touch-callout: none"
          @touchstart="onRowPointerDown(product, $event)"
        >
          <!-- Cart control -->
          <td class="py-4 pr-3">
            <div class="flex items-center justify-end gap-1">
              <template v-if="qty(product.id) === 0">
                <button
                  @click="updateQty(product, 1, $event)"
                  class="w-6 h-6 rounded-full bg-teal-500 text-white hover:bg-teal-600 transition-colors text-sm leading-none flex items-center justify-center"
                >+</button>
              </template>
              <template v-else>
                <button
                  @click="updateQty(product, -1, $event)"
                  class="w-6 h-6 rounded-full border border-gray-300 text-gray-600 hover:border-teal-500 hover:text-teal-600 transition-colors text-sm leading-none flex items-center justify-center"
                >−</button>
                <span class="w-5 text-center text-sm font-semibold tabular-nums">{{ qty(product.id) }}</span>
                <button
                  @click="updateQty(product, 1, $event)"
                  class="w-6 h-6 rounded-full bg-teal-500 text-white hover:bg-teal-600 transition-colors text-sm leading-none flex items-center justify-center"
                >+</button>
              </template>
            </div>
          </td>

          <!-- Name — click opens modal -->
          <td
            v-if="columns.includes('name')"
            class="py-4 pr-6 cursor-pointer hover:text-teal-600 transition-colors text-slate-800"
            @click="modalProduct = product"
          >
            <div class="flex items-center gap-3">
              <img
                v-if="product.Image"
                :src="product.Image"
                class="w-10 h-10 rounded-lg object-cover shrink-0 bg-white"
              />
              <div>
                <div>{{ product.Name }}<span v-if="product['Unit Weight']" class="ml-1.5 font-bold"> {{ product['Unit Weight'] }}</span></div>
                <div v-if="bundlesEnabled && activeBundlesForProduct(product).length" class="flex flex-wrap gap-1 mt-1">
                  <span
                    v-for="bundle in activeBundlesForProduct(product)"
                    :key="bundle.id"
                    class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-100 border border-amber-200 text-amber-700 text-xs font-bold leading-none"
                  >🎉 {{ bundle.label }}</span>
                </div>
              </div>
            </div>
          </td>

          <td v-if="columns.includes('strain')" class="py-4 pr-6 text-slate-500">
            {{ strainLabel(product.Strain) }}
          </td>
          <td v-if="columns.includes('potency')" class="py-4 pr-6 tabular-nums text-slate-700">
            {{ potency(product) }}
          </td>
          <td v-if="columns.includes('price')" class="py-4 tabular-nums text-slate-700">
            {{ product.Price != null ? `$${product.Price}` : '—' }}
          </td>

          <td v-if="columns.includes('stock')" class="py-4 pl-4">
            <svg v-if="product.Quantity != null" width="18" height="14" viewBox="0 0 18 14" aria-hidden="true">
              <rect x="0"  y="9" width="4" height="5" rx="1" :fill="stockBars(product.Quantity).bars >= 1 ? stockBars(product.Quantity).color : '#e5e7eb'" />
              <rect x="7"  y="5" width="4" height="9" rx="1" :fill="stockBars(product.Quantity).bars >= 2 ? stockBars(product.Quantity).color : '#e5e7eb'" />
              <rect x="14" y="0" width="4" height="14" rx="1" :fill="stockBars(product.Quantity).bars >= 3 ? stockBars(product.Quantity).color : '#e5e7eb'" />
            </svg>
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
