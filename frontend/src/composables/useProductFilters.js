/**
 * Shared filtering + sorting composable for all product views.
 *
 * @param {(product: object) => boolean} categoryFn
 *   Predicate that selects the category for this view.
 *
 * Returns:
 *   filtered          — reactive: category-filtered + URL-param-filtered + sorted
 *   categoryProducts  — reactive: category-filtered only
 *   facets            — reactive: per-dimension lists for filter option derivation
 *                       { strain, size } each filtered by everything except that dimension
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useProductsStore } from '@/stores/products'
import { BUNDLES } from '@/config/bundles'

function toArray(val) {
  if (!val) return []
  return Array.isArray(val) ? val : [val]
}

// Apply all URL-driven filters to `list`, optionally skipping named dimensions.
function applyFilters(list, query, skip = []) {
  let result = list

  const search = query['search-for']
  if (search) {
    const q = search.toLowerCase()
    result = result.filter((p) => (p.Name ?? '').toLowerCase().includes(q))
  }

  if (!skip.includes('brand')) {
    const brand = query.brand
    if (brand) result = result.filter((p) => p.Brand === brand)
  }

  if (!skip.includes('preground')) {
    const preground = query.preground
    if (preground === 'yes') result = result.filter((p) => p['Pre-Ground?'] === 'Yes')
    else if (preground === 'no') result = result.filter((p) => p['Pre-Ground?'] !== 'Yes')
  }

  if (!skip.includes('packaging')) {
    const packaging = query.packaging
    if (packaging) result = result.filter((p) => p.Subcategory === packaging)
  }

  if (!skip.includes('infused')) {
    const infused = query.infused
    if (infused === 'yes') result = result.filter((p) => p['Infused Preroll?'] === 'Yes')
    else if (infused === 'no') result = result.filter((p) => p['Infused Preroll?'] !== 'Yes')
  }

  if (!skip.includes('subcategory')) {
    const subcategory = query.subcategory
    if (subcategory) result = result.filter((p) => p.Subcategory === subcategory)
  }

  if (!skip.includes('strain')) {
    const strains = toArray(query.strain)
    if (strains.length) result = result.filter((p) => strains.includes(p.Strain))
  }

  if (!skip.includes('size')) {
    const sizes = toArray(query.size)
    if (sizes.length) result = result.filter((p) => sizes.includes(p['Unit Weight']))
  }

  if (!skip.includes('tag')) {
    const tags = toArray(query.tag)
    if (tags.length) {
      result = result.filter((p) => {
        const ptags = Array.isArray(p.Tags) ? p.Tags : []
        return tags.some((t) => ptags.includes(t))
      })
    }
  }

  if (!skip.includes('category')) {
    const categories = toArray(query.category)
    if (categories.length) result = result.filter((p) => categories.includes(p.Category))
  }

  return result
}

export function useProductFilters(categoryFn) {
  const store = useProductsStore()
  const route = useRoute()

  const categoryProducts = computed(() => store.products.filter(categoryFn))

  const filtered = computed(() => {
    let list = applyFilters(categoryProducts.value, route.query)

    // ── Sort ─────────────────────────────────────────────────────────────────
    const sort = route.query.sort
    const dir  = route.query.dir

    if (sort === 'name') {
      const asc = dir !== 'desc'
      list = [...list].sort((a, b) => {
        const cmp = (a.Name ?? '').localeCompare(b.Name ?? '')
        return asc ? cmp : -cmp
      })
    } else if (sort === 'strain') {
      const asc = dir !== 'desc'
      list = [...list].sort((a, b) => {
        const cmp = (a.Strain ?? '').localeCompare(b.Strain ?? '')
        return asc ? cmp : -cmp
      })
    } else if (sort === 'potency') {
      const asc = dir === 'asc'
      list = [...list].sort((a, b) => {
        const av = parseFloat(a.Potency) || 0
        const bv = parseFloat(b.Potency) || 0
        return asc ? av - bv : bv - av
      })
    } else if (sort === 'price') {
      const asc = dir !== 'desc'
      list = [...list].sort((a, b) => {
        const av = parseFloat(a.Price) || 0
        const bv = parseFloat(b.Price) || 0
        return asc ? av - bv : bv - av
      })
    } else if (sort === 'stock') {
      const asc = dir !== 'desc'
      list = [...list].sort((a, b) => {
        const an = a.Quantity == null
        const bn = b.Quantity == null
        if (an && bn) return 0
        if (an) return 1
        if (bn) return -1
        return asc ? a.Quantity - b.Quantity : b.Quantity - a.Quantity
      })
    }

    // ── Deal boost: float active-deal products to top when in default order ──
    if (!sort) {
      const now = new Date()
      const activeBundles = BUNDLES.filter(bundle => {
        if (!bundle.schedule) return true
        const { days, dates } = bundle.schedule
        if (days?.length && !days.includes(now.getDay())) return false
        if (dates?.length && !dates.includes(now.getDate())) return false
        return true
      })
      if (activeBundles.length) {
        const isDeal = (p) => activeBundles.some(b =>
          b.match({ name: p.Name, category: p.Category, unitWeight: p['Unit Weight'] ?? '', price: p.Price ?? 0, qty: 1 })
        )
        list = [...list.filter(isDeal), ...list.filter(p => !isDeal(p))]
      }
    }

    return list
  })

  // Per-dimension facets: each list is filtered by everything EXCEPT that dimension,
  // so filter chips for that dimension always show options compatible with other active filters.
  const facets = computed(() => ({
    strain: applyFilters(categoryProducts.value, route.query, ['strain']),
    size:   applyFilters(categoryProducts.value, route.query, ['size']),
  }))

  return { filtered, categoryProducts, facets }
}
