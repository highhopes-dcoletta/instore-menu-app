import { describe, it, expect, vi, afterEach } from 'vitest'
import { ref } from 'vue'
import { useBundles } from './useBundles'

// ── Helpers ───────────────────────────────────────────────────────────────────

function sel(...items) {
  const map = {}
  for (const item of items) map[item.id] = item
  return ref(map)
}

const juicyStix = (qty, price = 12) => ({
  id: `js-${price}-${qty}`,
  name: 'Juicy Stickz OG',
  category: 'PRE_ROLLS',
  unitWeight: '1g',
  subcategory: 'SINGLES',
  price,
  qty,
})

const edible = (qty, price = 12) => ({
  id: `ed-${price}-${qty}`,
  name: 'Blueberry Gummies',
  category: 'EDIBLES',
  unitWeight: '100mg',
  subcategory: '',
  price,
  qty,
})

const hellavatedCart = (qty, price = 55) => ({
  id: `hv-${price}-${qty}`,
  name: 'Hellavated Blue Dream Cartridge',
  category: 'VAPORIZERS',
  unitWeight: '1G',
  subcategory: '',
  price,
  qty,
})

const hellavatedDisposable = (qty, price = 30) => ({
  id: `hvd-${price}-${qty}`,
  name: 'Hellavated Disposable Sativa',
  category: 'VAPORIZERS',
  unitWeight: '1G',
  subcategory: '',
  price,
  qty,
})

const dime1g = (qty, price = 45) => ({
  id: `d1-${price}-${qty}`,
  name: 'Dime Industries OG 1G Disposable',
  category: 'VAPORIZERS',
  unitWeight: '1G',
  subcategory: '',
  price,
  qty,
})

const dime2g = (qty, price = 50) => ({
  id: `d2-${price}-${qty}`,
  name: 'Dime Industries GSC 2G Disposable',
  category: 'VAPORIZERS',
  unitWeight: '2G',
  subcategory: '',
  price,
  qty,
})

const hhFlower = (qty, price = 18) => ({
  id: `hf-${price}-${qty}`,
  name: 'High Hopes Blue Dream',
  category: 'FLOWER',
  unitWeight: '3.5G',
  subcategory: '',
  price,
  qty,
})

const hhPreroll1g = (qty, price = 8) => ({
  id: `hpr-${price}-${qty}`,
  name: 'High Hopes Sour Diesel Pre-Roll',
  category: 'PRE_ROLLS',
  unitWeight: '1g',
  subcategory: 'SINGLES',
  price,
  qty,
})

// ── Mock bundles ──────────────────────────────────────────────────────────────
// Isolated from production values so tests don't break when prices change.

vi.mock('@/config/bundles', () => ({
  BUNDLES: [
    // Grouped: only the best deal in 'juicy-fire' applies
    {
      id: 'juicy-stix-4pack',
      label: 'Any 4 Juicy Stickz — $42',
      type: 'quantity',
      group: 'juicy-fire',
      match: (item) => /juicy stickz/i.test(item.name),
      quantity: 4,
      bundlePrice: 42,
    },
    {
      id: 'juicy-stix-6pack',
      label: 'Any 6 Juicy Stickz — $60',
      type: 'quantity',
      group: 'juicy-fire',
      match: (item) => /juicy stickz/i.test(item.name),
      quantity: 6,
      bundlePrice: 60,
    },
    // Monday edibles — timed
    {
      id: 'monday-edibles',
      label: 'Monday Edible Value Menu',
      type: 'timed',
      match: (item) => item.category === 'EDIBLES',
      schedule: { days: [1] },
      unitPrice: 8,
    },
    // Hellavated — timed, always-on (empty schedule)
    {
      id: 'hellavated-1g-cart',
      label: 'Hellavated 1G Cartridge — $45',
      type: 'timed',
      match: (item) =>
        /hellavated/i.test(item.name) &&
        /1g/i.test(item.unitWeight) &&
        !/disposable/i.test(item.name),
      schedule: {},
      unitPrice: 45,
    },
    // Friday flower
    {
      id: 'friday-flower-2pack',
      label: 'High Hopes Flower 3.5G 2-Pack — $28',
      type: 'quantity',
      match: (item) => /high hopes/i.test(item.name) && /3\.5g/i.test(item.unitWeight),
      schedule: { days: [5] },
      quantity: 2,
      bundlePrice: 28,
    },
    // Dime Day — grouped, three overlapping tiers
    {
      id: 'dime-1g-2',
      label: 'Dime 1G Disposables — 2 for $70',
      type: 'quantity',
      group: 'dime-day',
      match: (item) => /\bdime\b/i.test(item.name) && /1g/i.test(item.unitWeight),
      schedule: { dates: [10] },
      quantity: 2,
      bundlePrice: 70,
    },
    {
      id: 'dime-2g-2',
      label: 'Dime 2G Disposables — 2 for $80',
      type: 'quantity',
      group: 'dime-day',
      match: (item) => /\bdime\b/i.test(item.name) && /2g/i.test(item.unitWeight),
      schedule: { dates: [10] },
      quantity: 2,
      bundlePrice: 80,
    },
    {
      id: 'dime-mix-2',
      label: 'Mix & Match Dime — 2 for $80',
      type: 'quantity',
      group: 'dime-day',
      match: (item) => /\bdime\b/i.test(item.name) && /1g|2g/i.test(item.unitWeight),
      schedule: { dates: [10] },
      quantity: 2,
      bundlePrice: 80,
    },
    // HH 1G pre-roll tiers — grouped
    {
      id: 'hh-1g-preroll-2',
      label: 'Any 2 High Hopes 1G Pre-Rolls — $15',
      type: 'quantity',
      group: 'hh-1g-preroll',
      match: (item) => /high hopes/i.test(item.name) && /1g/i.test(item.unitWeight) && item.subcategory !== 'PACKS',
      quantity: 2,
      bundlePrice: 15,
    },
    {
      id: 'hh-1g-preroll-5',
      label: 'Any 5 High Hopes 1G Pre-Rolls — $35',
      type: 'quantity',
      group: 'hh-1g-preroll',
      match: (item) => /high hopes/i.test(item.name) && /1g/i.test(item.unitWeight) && item.subcategory !== 'PACKS',
      quantity: 5,
      bundlePrice: 35,
    },
    {
      id: 'hh-1g-preroll-10',
      label: 'Any 10 High Hopes 1G Pre-Rolls — $65',
      type: 'quantity',
      group: 'hh-1g-preroll',
      match: (item) => /high hopes/i.test(item.name) && /1g/i.test(item.unitWeight) && item.subcategory !== 'PACKS',
      quantity: 10,
      bundlePrice: 65,
    },
  ],
}))

// ── Date helpers ──────────────────────────────────────────────────────────────

function mockDate(dayOfWeek, dayOfMonth) {
  vi.spyOn(Date.prototype, 'getDay').mockReturnValue(dayOfWeek)
  vi.spyOn(Date.prototype, 'getDate').mockReturnValue(dayOfMonth)
}

afterEach(() => vi.restoreAllMocks())

// ── quantity bundle (no schedule) ────────────────────────────────────────────

describe('juicy-stix-4pack (quantity, no schedule)', () => {
  it('no deal when fewer than 4 in cart', () => {
    const { appliedDeals } = useBundles(sel(juicyStix(3)))
    expect(appliedDeals.value).toHaveLength(0)
  })

  it('deal fires at exactly 4', () => {
    const { appliedDeals } = useBundles(sel(juicyStix(4, 12)))
    expect(appliedDeals.value).toHaveLength(1)
    expect(appliedDeals.value[0].id).toBe('juicy-stix-4pack')
    // 4 × $12 = $48 normal; bundle = $42; savings = $6
    expect(appliedDeals.value[0].savings).toBeCloseTo(6)
  })

  it('two full bundles of 4', () => {
    const { appliedDeals } = useBundles(sel(juicyStix(8, 12)))
    const deal = appliedDeals.value.find((d) => d.id === 'juicy-stix-4pack')
    // 8 × $12 = $96; 2 bundles × $42 = $84; savings = $12
    expect(deal.savings).toBeCloseTo(12)
  })

  it('one bundle + 1 remainder (remainder priced at avg)', () => {
    const { appliedDeals } = useBundles(sel(juicyStix(5, 12)))
    const deal = appliedDeals.value.find((d) => d.id === 'juicy-stix-4pack')
    // 5 × $12 = $60 normal; 1 bundle $42 + 1 × $12 avg = $54; savings = $6
    expect(deal.savings).toBeCloseTo(6)
  })

  it('no deal when bundle price >= normal price', () => {
    const { appliedDeals } = useBundles(sel(juicyStix(4, 10)))
    expect(appliedDeals.value.find((d) => d.id === 'juicy-stix-4pack')).toBeUndefined()
  })

  it('totalDiscount reflects savings', () => {
    const { totalDiscount } = useBundles(sel(juicyStix(4, 12)))
    expect(totalDiscount.value).toBeCloseTo(6)
  })
})

// ── no-stacking: grouped bundles ──────────────────────────────────────────────

describe('group: no stacking — only best deal in group applies', () => {
  it('6 items: 6-pack wins over 4-pack (higher savings)', () => {
    // 6-pack: savings = 6×$12 - $60 = $12
    // 4-pack: floor(6/4)=1 bundle + 2 remainder: savings = $72 - ($42 + $24) = $6
    const { appliedDeals } = useBundles(sel(juicyStix(6, 12)))
    expect(appliedDeals.value).toHaveLength(1)
    expect(appliedDeals.value[0].id).toBe('juicy-stix-6pack')
    expect(appliedDeals.value[0].savings).toBeCloseTo(12)
  })

  it('5 items: 4-pack wins (6-pack not yet reachable)', () => {
    const { appliedDeals } = useBundles(sel(juicyStix(5, 12)))
    expect(appliedDeals.value).toHaveLength(1)
    expect(appliedDeals.value[0].id).toBe('juicy-stix-4pack')
  })

  it('independent groups both apply', () => {
    mockDate(1, 15) // Monday
    const { appliedDeals } = useBundles(sel(juicyStix(6, 12), edible(2, 12)))
    const ids = appliedDeals.value.map((d) => d.id)
    // juicy-fire group: 6-pack wins
    expect(ids).toContain('juicy-stix-6pack')
    expect(ids).not.toContain('juicy-stix-4pack')
    // monday-edibles: its own group
    expect(ids).toContain('monday-edibles')
    expect(appliedDeals.value).toHaveLength(2)
  })
})

// ── HH 1G pre-roll tiers ──────────────────────────────────────────────────────

describe('hh-1g-preroll tiers (grouped)', () => {
  it('2 items: 2-pack applies', () => {
    const { appliedDeals } = useBundles(sel(hhPreroll1g(2, 8)))
    expect(appliedDeals.value).toHaveLength(1)
    expect(appliedDeals.value[0].id).toBe('hh-1g-preroll-2')
  })

  it('5 items: 5-pack wins over 2-pack', () => {
    // 5-pack: $40 - $35 = $5 savings
    // 2-pack: floor(5/2)=2 bundles + 1 rem = 2×$15 + $8 = $38; savings = $40 - $38 = $2
    const { appliedDeals } = useBundles(sel(hhPreroll1g(5, 8)))
    expect(appliedDeals.value).toHaveLength(1)
    expect(appliedDeals.value[0].id).toBe('hh-1g-preroll-5')
  })

  it('10 items: 10-pack wins over all others', () => {
    // 10-pack: $80 - $65 = $15 savings
    // 5-pack: 2×$35 = $70; savings = $80 - $70 = $10
    // 2-pack: 5×$15 = $75; savings = $80 - $75 = $5
    const { appliedDeals } = useBundles(sel(hhPreroll1g(10, 8)))
    expect(appliedDeals.value).toHaveLength(1)
    expect(appliedDeals.value[0].id).toBe('hh-1g-preroll-10')
    expect(appliedDeals.value[0].savings).toBeCloseTo(15)
  })

  it('packs (subcategory=PACKS) do not match singles deals', () => {
    const pack = { ...hhPreroll1g(2, 25), subcategory: 'PACKS', name: 'High Hopes 5-Pack' }
    pack.id = 'pack-1'
    const { appliedDeals } = useBundles(sel(pack))
    expect(appliedDeals.value.find((d) => d.id.startsWith('hh-1g-preroll'))).toBeUndefined()
  })
})

// ── Dime Day group — mixed weight case ───────────────────────────────────────

describe('dime-day group (dates: [10])', () => {
  it('no deal outside Dime Day', () => {
    mockDate(3, 15)
    const { appliedDeals } = useBundles(sel(dime1g(2, 45)))
    expect(appliedDeals.value.filter((d) => d.id.startsWith('dime'))).toHaveLength(0)
  })

  it('2x 1G: dime-1g-2 applies on 10th', () => {
    mockDate(3, 10)
    const { appliedDeals } = useBundles(sel(dime1g(2, 45)))
    expect(appliedDeals.value).toHaveLength(1)
    expect(appliedDeals.value[0].id).toBe('dime-1g-2')
    // 2×$45 - $70 = $20
    expect(appliedDeals.value[0].savings).toBeCloseTo(20)
  })

  it('2x 2G: dime-2g-2 applies on 10th', () => {
    mockDate(3, 10)
    const { appliedDeals } = useBundles(sel(dime2g(2, 50)))
    expect(appliedDeals.value).toHaveLength(1)
    expect(appliedDeals.value[0].id).toBe('dime-2g-2')
    // 2×$50 - $80 = $20
    expect(appliedDeals.value[0].savings).toBeCloseTo(20)
  })

  it('1x 1G + 1x 2G: dime-mix-2 applies (only match for mixed)', () => {
    mockDate(3, 10)
    // 1G at $45, 2G at $50 → normalTotal = $95; dime-mix bundle = $80; savings = $15
    const { appliedDeals } = useBundles(sel(dime1g(1, 45), dime2g(1, 50)))
    expect(appliedDeals.value).toHaveLength(1)
    expect(appliedDeals.value[0].id).toBe('dime-mix-2')
    expect(appliedDeals.value[0].savings).toBeCloseTo(15)
  })

  it('only one deal from dime-day group applies even when multiple match', () => {
    mockDate(3, 10)
    // 2x 1G: both dime-1g-2 and dime-mix-2 match, but dime-1g-2 saves more ($20 vs $20)
    // They tie — only one appears in applied deals
    const { appliedDeals } = useBundles(sel(dime1g(2, 45)))
    expect(appliedDeals.value.filter((d) => ['dime-1g-2', 'dime-2g-2', 'dime-mix-2'].includes(d.id))).toHaveLength(1)
  })
})

// ── quantity bundle (schedule: days) ─────────────────────────────────────────

describe('friday-flower-2pack (quantity, schedule: days)', () => {
  it('no deal on a non-Friday', () => {
    mockDate(3, 15)
    const { appliedDeals } = useBundles(sel(hhFlower(2, 18)))
    expect(appliedDeals.value.find((d) => d.id === 'friday-flower-2pack')).toBeUndefined()
  })

  it('deal fires on Friday', () => {
    mockDate(5, 15)
    const { appliedDeals } = useBundles(sel(hhFlower(2, 18)))
    const deal = appliedDeals.value.find((d) => d.id === 'friday-flower-2pack')
    // 2 × $18 = $36 normal; bundle = $28; savings = $8
    expect(deal).toBeDefined()
    expect(deal.savings).toBeCloseTo(8)
  })

  it('no deal on Friday with only 1 item', () => {
    mockDate(5, 15)
    const { appliedDeals } = useBundles(sel(hhFlower(1, 18)))
    expect(appliedDeals.value.find((d) => d.id === 'friday-flower-2pack')).toBeUndefined()
  })
})

// ── timed bundle (schedule: days) ────────────────────────────────────────────

describe('monday-edibles (timed, schedule: days)', () => {
  it('no deal on a non-Monday', () => {
    mockDate(3, 15)
    const { appliedDeals } = useBundles(sel(edible(2, 12)))
    expect(appliedDeals.value.find((d) => d.id === 'monday-edibles')).toBeUndefined()
  })

  it('deal fires on Monday', () => {
    mockDate(1, 15)
    const { appliedDeals } = useBundles(sel(edible(2, 12)))
    const deal = appliedDeals.value.find((d) => d.id === 'monday-edibles')
    // 2 × $12 = $24 normal; 2 × $8 = $16 deal; savings = $8
    expect(deal).toBeDefined()
    expect(deal.savings).toBeCloseTo(8)
  })

  it('no deal on Monday when unit price >= item price', () => {
    mockDate(1, 15)
    const { appliedDeals } = useBundles(sel(edible(2, 7)))
    expect(appliedDeals.value.find((d) => d.id === 'monday-edibles')).toBeUndefined()
  })

  it('non-edible category does not qualify', () => {
    mockDate(1, 15)
    const { appliedDeals } = useBundles(sel(juicyStix(4, 12)))
    expect(appliedDeals.value.find((d) => d.id === 'monday-edibles')).toBeUndefined()
  })
})

// ── timed bundle (always active, schedule: {}) ───────────────────────────────

describe('hellavated-1g-cart (timed, no schedule restriction)', () => {
  it('deal fires any day', () => {
    mockDate(3, 15)
    const { appliedDeals } = useBundles(sel(hellavatedCart(1, 55)))
    const deal = appliedDeals.value.find((d) => d.id === 'hellavated-1g-cart')
    expect(deal).toBeDefined()
    expect(deal.savings).toBeCloseTo(10)
  })

  it('disposables do not qualify', () => {
    mockDate(3, 15)
    const { appliedDeals } = useBundles(sel(hellavatedDisposable(1, 55)))
    expect(appliedDeals.value.find((d) => d.id === 'hellavated-1g-cart')).toBeUndefined()
  })

  it('no deal when item price is already at or below $45', () => {
    mockDate(3, 15)
    const { appliedDeals } = useBundles(sel(hellavatedCart(1, 44)))
    expect(appliedDeals.value.find((d) => d.id === 'hellavated-1g-cart')).toBeUndefined()
  })
})

// ── nearDeals ─────────────────────────────────────────────────────────────────

describe('nearDeals', () => {
  it('shows nudge when partway to a quantity bundle', () => {
    const { nearDeals } = useBundles(sel(juicyStix(2)))
    const nudge = nearDeals.value.find((d) => d.id === 'juicy-stix-4pack')
    expect(nudge).toBeDefined()
    expect(nudge.needed).toBe(2)
  })

  it('no nudge when threshold already met', () => {
    const { nearDeals } = useBundles(sel(juicyStix(4)))
    expect(nearDeals.value.find((d) => d.id === 'juicy-stix-4pack')).toBeUndefined()
  })

  it('no nudge when no qualifying items in cart', () => {
    const { nearDeals } = useBundles(sel(edible(2)))
    expect(nearDeals.value.find((d) => d.id === 'juicy-stix-4pack')).toBeUndefined()
  })

  it('shows nudge for 6-pack even when 4-pack is already active', () => {
    const { nearDeals } = useBundles(sel(juicyStix(5)))
    const nudge = nearDeals.value.find((d) => d.id === 'juicy-stix-6pack')
    expect(nudge).toBeDefined()
    expect(nudge.needed).toBe(1)
  })

  it('respects schedule — no nudge when schedule is inactive', () => {
    mockDate(3, 15)
    const { nearDeals } = useBundles(sel(hhFlower(1)))
    expect(nearDeals.value.find((d) => d.id === 'friday-flower-2pack')).toBeUndefined()
  })

  it('shows nudge for schedule-gated bundle when schedule is active', () => {
    mockDate(5, 15)
    const { nearDeals } = useBundles(sel(hhFlower(1)))
    const nudge = nearDeals.value.find((d) => d.id === 'friday-flower-2pack')
    expect(nudge).toBeDefined()
    expect(nudge.needed).toBe(1)
  })

  it('no nudge for timed bundles (no quantity threshold)', () => {
    mockDate(1, 15)
    const { nearDeals } = useBundles(sel(edible(1, 12)))
    expect(nearDeals.value.find((d) => d.id === 'monday-edibles')).toBeUndefined()
  })
})

// ── edge cases ────────────────────────────────────────────────────────────────

describe('edge cases', () => {
  it('empty cart has no deals', () => {
    const { appliedDeals, totalDiscount } = useBundles(ref({}))
    expect(appliedDeals.value).toHaveLength(0)
    expect(totalDiscount.value).toBe(0)
  })

  it('independent groups both apply', () => {
    mockDate(1, 15)
    const { appliedDeals, totalDiscount } = useBundles(sel(juicyStix(4, 12), edible(2, 12)))
    const ids = appliedDeals.value.map((d) => d.id)
    expect(ids).toContain('juicy-stix-4pack')
    expect(ids).toContain('monday-edibles')
    expect(totalDiscount.value).toBeCloseTo(14)
  })
})
