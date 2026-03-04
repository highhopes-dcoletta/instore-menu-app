/**
 * Shared filtering + sorting composable for all product views.
 *
 * @param {(product: object) => boolean} categoryFn
 *   Predicate that selects the category for this view.
 *   e.g. p => p.Category === 'FLOWER'
 *   e.g. p => Array.isArray(p.Tags) && p.Tags.includes('Sleep')
 *
 * Returns:
 *   filtered          — reactive: category-filtered + URL-param-filtered + sorted
 *   categoryProducts  — reactive: category-filtered only (use to derive filter chip options)
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useProductsStore } from '@/stores/products'

function toArray(val) {
  if (!val) return []
  return Array.isArray(val) ? val : [val]
}

export function useProductFilters(categoryFn) {
  const store = useProductsStore()
  const route = useRoute()

  // Category slice — stable source for deriving dynamic filter options.
  const categoryProducts = computed(() => store.products.filter(categoryFn))

  const filtered = computed(() => {
    let list = categoryProducts.value

    // ── Text search ─────────────────────────────────────────────────────────
    const search = route.query['search-for']
    if (search) {
      const q = search.toLowerCase()
      list = list.filter((p) => (p.Name ?? '').toLowerCase().includes(q))
    }

    // ── Single-select filters ────────────────────────────────────────────────
    const brand = route.query.brand
    if (brand) list = list.filter((p) => p.Brand === brand)

    const preground = route.query.preground
    if (preground === 'yes') list = list.filter((p) => p['Pre-Ground?'])
    else if (preground === 'no') list = list.filter((p) => !p['Pre-Ground?'])

    const packaging = route.query.packaging
    if (packaging) list = list.filter((p) => p.Subcategory === packaging)

    const infused = route.query.infused
    if (infused === 'yes') list = list.filter((p) => p['Infused Preroll?'])
    else if (infused === 'no') list = list.filter((p) => !p['Infused Preroll?'])

    const subcategory = route.query.subcategory
    if (subcategory) list = list.filter((p) => p.Subcategory === subcategory)

    // ── Multi-select filters ─────────────────────────────────────────────────
    const strains = toArray(route.query.strain)
    if (strains.length) list = list.filter((p) => strains.includes(p.Strain))

    const sizes = toArray(route.query.size)
    if (sizes.length) list = list.filter((p) => sizes.includes(p['Unit Weight']))

    const tags = toArray(route.query.tag)
    if (tags.length) {
      list = list.filter((p) => {
        const ptags = Array.isArray(p.Tags) ? p.Tags : []
        return tags.some((t) => ptags.includes(t))
      })
    }

    const categories = toArray(route.query.category)
    if (categories.length) list = list.filter((p) => categories.includes(p.Category))

    // ── Sort ─────────────────────────────────────────────────────────────────
    // sort + dir are set by clicking column headers in ProductTable.
    // No sort param → use server order (popularity from Airtable).
    const sort = route.query.sort
    const dir  = route.query.dir   // 'asc' | 'desc' | undefined

    if (sort === 'name') {
      const asc = dir !== 'desc'   // default first click: A-Z (asc)
      list = [...list].sort((a, b) => {
        const cmp = (a.Name ?? '').localeCompare(b.Name ?? '')
        return asc ? cmp : -cmp
      })
    } else if (sort === 'potency') {
      const asc = dir === 'asc'    // default first click: high-low (desc)
      list = [...list].sort((a, b) => {
        const av = parseFloat(a.Potency) || 0
        const bv = parseFloat(b.Potency) || 0
        return asc ? av - bv : bv - av
      })
    } else if (sort === 'price') {
      const asc = dir !== 'desc'   // default first click: low-high (asc)
      list = [...list].sort((a, b) => {
        const av = parseFloat(a.Price) || 0
        const bv = parseFloat(b.Price) || 0
        return asc ? av - bv : bv - av
      })
    }
    // else: no sort param → leave in server/store order

    return list
  })

  return { filtered, categoryProducts }
}
