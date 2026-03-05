import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createApp } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { useProductFilters } from './useProductFilters'

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Mutable objects — tests mutate these before running the composable
const mockRoute = { query: {} }
const mockStore = { products: [] }

vi.mock('vue-router', () => ({ useRoute: () => mockRoute }))
vi.mock('@/stores/products', () => ({ useProductsStore: () => mockStore }))

// ── Helper ────────────────────────────────────────────────────────────────────

function run(products, query, categoryFn = () => true) {
  mockStore.products = products
  mockRoute.query = query

  let result
  const app = createApp({ setup() { result = useProductFilters(categoryFn); return () => {} } })
  const pinia = createPinia()
  app.use(pinia)
  setActivePinia(pinia)
  app.mount(document.createElement('div'))
  return result
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PRODUCTS = [
  { id: '1', Name: 'Blue Dream',   Strain: 'HYBRID',  Potency: '25', Price: 40, Quantity: 5,  Category: 'FLOWER', Brand: 'High Hopes', 'Pre-Ground?': 'No',  'Infused Preroll?': 'No',  'Unit Weight': '1g',   Tags: ['Sleep'], Subcategory: 'Jar' },
  { id: '2', Name: 'OG Kush',      Strain: 'INDICA',  Potency: '18', Price: 35, Quantity: 20, Category: 'FLOWER', Brand: 'Acme',       'Pre-Ground?': 'Yes', 'Infused Preroll?': 'No',  'Unit Weight': '3.5g', Tags: [],        Subcategory: 'Bag' },
  { id: '3', Name: 'Sour Diesel',  Strain: 'SATIVA',  Potency: '22', Price: 45, Quantity: 12, Category: 'FLOWER', Brand: 'High Hopes', 'Pre-Ground?': 'No',  'Infused Preroll?': 'Yes', 'Unit Weight': '7g',   Tags: ['Pain'],  Subcategory: 'Jar' },
  { id: '4', Name: 'Girl Scout',   Strain: 'HYBRID',  Potency: '30', Price: 50, Quantity: 8,  Category: 'VAPE',   Brand: 'Acme',       'Pre-Ground?': 'No',  'Infused Preroll?': 'No',  'Unit Weight': '1g',   Tags: [],        Subcategory: 'Cart' },
]

// ── categoryFn ────────────────────────────────────────────────────────────────

describe('categoryFn', () => {
  it('filters to the given category', () => {
    const { filtered } = run(PRODUCTS, {}, p => p.Category === 'FLOWER')
    expect(filtered.value.map(p => p.id)).toEqual(['1', '2', '3'])
  })

  it('categoryProducts reflects category filter only', () => {
    const { categoryProducts } = run(PRODUCTS, {}, p => p.Category === 'VAPE')
    expect(categoryProducts.value.map(p => p.id)).toEqual(['4'])
  })
})

// ── Text search ───────────────────────────────────────────────────────────────

describe('search-for filter', () => {
  it('filters by name (case-insensitive)', () => {
    const { filtered } = run(PRODUCTS, { 'search-for': 'og' })
    expect(filtered.value.map(p => p.id)).toEqual(['2'])
  })

  it('returns all when search is empty', () => {
    const { filtered } = run(PRODUCTS, {})
    expect(filtered.value).toHaveLength(4)
  })
})

// ── Single-select filters ─────────────────────────────────────────────────────

describe('brand filter', () => {
  it('filters to matching brand', () => {
    const { filtered } = run(PRODUCTS, { brand: 'High Hopes' })
    expect(filtered.value.map(p => p.id)).toEqual(['1', '3'])
  })
})

describe('preground filter', () => {
  it('yes shows only pre-ground', () => {
    const { filtered } = run(PRODUCTS, { preground: 'yes' })
    expect(filtered.value.map(p => p.id)).toEqual(['2'])
  })

  it('no excludes pre-ground', () => {
    const { filtered } = run(PRODUCTS, { preground: 'no' })
    expect(filtered.value.every(p => p['Pre-Ground?'] !== 'Yes')).toBe(true)
  })
})

describe('infused filter', () => {
  it('yes shows only infused', () => {
    const { filtered } = run(PRODUCTS, { infused: 'yes' })
    expect(filtered.value.map(p => p.id)).toEqual(['3'])
  })

  it('no excludes infused', () => {
    const { filtered } = run(PRODUCTS, { infused: 'no' })
    expect(filtered.value.every(p => p['Infused Preroll?'] !== 'Yes')).toBe(true)
  })
})

describe('subcategory filter', () => {
  it('filters to matching subcategory', () => {
    const { filtered } = run(PRODUCTS, { subcategory: 'Jar' })
    expect(filtered.value.map(p => p.id)).toEqual(['1', '3'])
  })
})

// ── Multi-select filters ──────────────────────────────────────────────────────

describe('strain filter', () => {
  it('single strain', () => {
    const { filtered } = run(PRODUCTS, { strain: 'INDICA' })
    expect(filtered.value.map(p => p.id)).toEqual(['2'])
  })

  it('multiple strains', () => {
    const { filtered } = run(PRODUCTS, { strain: ['INDICA', 'SATIVA'] })
    expect(filtered.value.map(p => p.id)).toEqual(['2', '3'])
  })
})

describe('size filter', () => {
  it('single size', () => {
    const { filtered } = run(PRODUCTS, { size: '3.5g' })
    expect(filtered.value.map(p => p.id)).toEqual(['2'])
  })

  it('multiple sizes', () => {
    const { filtered } = run(PRODUCTS, { size: ['1g', '7g'] })
    expect(filtered.value.map(p => p.id)).toEqual(['1', '3', '4'])
  })
})

describe('tag filter', () => {
  it('matches products with any of the selected tags', () => {
    const { filtered } = run(PRODUCTS, { tag: ['Sleep', 'Pain'] })
    expect(filtered.value.map(p => p.id)).toEqual(['1', '3'])
  })
})

// ── Sorting ───────────────────────────────────────────────────────────────────

describe('sort by name', () => {
  it('asc (default)', () => {
    const { filtered } = run(PRODUCTS, { sort: 'name', dir: 'asc' })
    expect(filtered.value.map(p => p.Name)).toEqual(['Blue Dream', 'Girl Scout', 'OG Kush', 'Sour Diesel'])
  })

  it('desc', () => {
    const { filtered } = run(PRODUCTS, { sort: 'name', dir: 'desc' })
    expect(filtered.value.map(p => p.Name)).toEqual(['Sour Diesel', 'OG Kush', 'Girl Scout', 'Blue Dream'])
  })
})

describe('sort by potency', () => {
  it('desc (default — highest first)', () => {
    const { filtered } = run(PRODUCTS, { sort: 'potency' })
    const potencies = filtered.value.map(p => parseFloat(p.Potency))
    expect(potencies).toEqual([...potencies].sort((a, b) => b - a))
  })

  it('asc', () => {
    const { filtered } = run(PRODUCTS, { sort: 'potency', dir: 'asc' })
    const potencies = filtered.value.map(p => parseFloat(p.Potency))
    expect(potencies).toEqual([...potencies].sort((a, b) => a - b))
  })
})

describe('sort by price', () => {
  it('asc (default — lowest first)', () => {
    const { filtered } = run(PRODUCTS, { sort: 'price', dir: 'asc' })
    const prices = filtered.value.map(p => p.Price)
    expect(prices).toEqual([...prices].sort((a, b) => a - b))
  })

  it('desc', () => {
    const { filtered } = run(PRODUCTS, { sort: 'price', dir: 'desc' })
    const prices = filtered.value.map(p => p.Price)
    expect(prices).toEqual([...prices].sort((a, b) => b - a))
  })
})

describe('sort by stock', () => {
  it('asc (default — lowest first)', () => {
    const { filtered } = run(PRODUCTS, { sort: 'stock', dir: 'asc' })
    const qtys = filtered.value.map(p => p.Quantity)
    expect(qtys).toEqual([...qtys].sort((a, b) => a - b))
  })

  it('desc', () => {
    const { filtered } = run(PRODUCTS, { sort: 'stock', dir: 'desc' })
    const qtys = filtered.value.map(p => p.Quantity)
    expect(qtys).toEqual([...qtys].sort((a, b) => b - a))
  })

  it('sorts null Quantity to the bottom when asc', () => {
    const withNull = [...PRODUCTS, { id: '5', Name: 'X', Quantity: null, Category: 'FLOWER' }]
    const { filtered } = run(withNull, { sort: 'stock', dir: 'asc' })
    expect(filtered.value[0].id).not.toBe('5')
    expect(filtered.value.at(-1).id).toBe('5')
  })
})

describe('no sort param', () => {
  it('preserves original order', () => {
    const { filtered } = run(PRODUCTS, {})
    expect(filtered.value.map(p => p.id)).toEqual(['1', '2', '3', '4'])
  })
})
