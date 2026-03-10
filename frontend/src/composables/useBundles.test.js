import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'
import { useBundles } from './useBundles'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a selections ref from an array of partial items. */
function sel(...items) {
  const map = {}
  for (const item of items) map[item.id] = item
  return ref(map)
}

/** Shorthand item factories */
const juicyStix = (qty, price = 12) => ({
  id: `js-${price}-${qty}`,
  name: 'Juicy Stickz OG',
  category: 'PRE_ROLLS',
  unitWeight: '1g',
  price,
  qty,
})

const edible = (qty, price = 12) => ({
  id: `ed-${price}-${qty}`,
  name: 'Blueberry Gummies',
  category: 'EDIBLES',
  unitWeight: '100mg',
  price,
  qty,
})

const hellavatedCart = (qty, price = 55) => ({
  id: `hv-${price}-${qty}`,
  name: 'Hellavated Blue Dream Cartridge',
  category: 'VAPORIZERS',
  unitWeight: '1G',
  price,
  qty,
})

const hellavatedDisposable = (qty, price = 30) => ({
  id: `hvd-${price}-${qty}`,
  name: 'Hellavated Disposable Sativa',
  category: 'VAPORIZERS',
  unitWeight: '1G',
  price,
  qty,
})

const dime2g = (qty, price = 50) => ({
  id: `dm-${price}-${qty}`,
  name: 'Dime Industries GSC',
  category: 'VAPORIZERS',
  unitWeight: '2G',
  price,
  qty,
})

const hhFlower = (qty, price = 18) => ({
  id: `hf-${price}-${qty}`,
  name: 'High Hopes Blue Dream',
  category: 'FLOWER',
  unitWeight: '3.5G',
  price,
  qty,
})

// ── Mock bundles ──────────────────────────────────────────────────────────────
// We mock the config so tests don't break when bundle values change in production.

vi.mock('@/config/bundles', () => ({
  BUNDLES: [
    {
      id: 'juicy-stix-4pack',
      label: 'Any 4 Juicy Stix — $42',
      type: 'quantity',
      match: (item) => /juicy stickz/i.test(item.name),
      quantity: 4,
      bundlePrice: 42,
    },
    {
      id: 'juicy-stix-6pack',
      label: 'Any 6 Juicy Stix — $60',
      type: 'quantity',
      match: (item) => /juicy stickz/i.test(item.name),
      quantity: 6,
      bundlePrice: 60,
    },
    {
      id: 'monday-edibles',
      label: 'Monday Edible Value Menu',
      type: 'timed',
      match: (item) => item.category === 'EDIBLES',
      schedule: { days: [1] },
      unitPrice: 8,
    },
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
    {
      id: 'friday-flower-2pack',
      label: 'High Hopes Flower 3.5G 2-Pack — $28',
      type: 'quantity',
      match: (item) => /high hopes/i.test(item.name) && /3\.5g/i.test(item.unitWeight),
      schedule: { days: [5] },
      quantity: 2,
      bundlePrice: 28,
    },
    {
      id: 'dime-2g-10th',
      label: 'Dime 2G Disposable 2-Pack — $80',
      type: 'quantity',
      match: (item) => /dime/i.test(item.name) && /2g/i.test(item.unitWeight),
      schedule: { dates: [10] },
      quantity: 2,
      bundlePrice: 80,
    },
  ],
}))

// ── Date helpers ──────────────────────────────────────────────────────────────

function mockDate(dayOfWeek, dayOfMonth) {
  // dayOfWeek: 0=Sun … 6=Sat, dayOfMonth: 1-31
  const d = new Date(2026, 0, 1) // Jan 1 2026 = Thursday (dayOfWeek=4)
  // Offset to the desired dayOfWeek in the same week
  const base = new Date(2026, 0, 4 + dayOfWeek) // Jan 4 = Sun
  // Set day-of-month by picking a date: find a date that has both constraints
  // For simplicity, just set the date directly
  const year = 2026
  // Find a month where dayOfMonth lands on dayOfWeek
  // For tests we can pick specific known dates:
  // Just override getDay and getDate on the prototype for simplicity
  vi.spyOn(Date.prototype, 'getDay').mockReturnValue(dayOfWeek)
  vi.spyOn(Date.prototype, 'getDate').mockReturnValue(dayOfMonth)
}

afterEach(() => {
  vi.restoreAllMocks()
})

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
    // Price so low that bundle is no bargain ($42 / 4 = $10.50 > $10)
    const { appliedDeals } = useBundles(sel(juicyStix(4, 10)))
    const deal = appliedDeals.value.find((d) => d.id === 'juicy-stix-4pack')
    expect(deal).toBeUndefined()
  })

  it('totalDiscount reflects savings', () => {
    const { totalDiscount } = useBundles(sel(juicyStix(4, 12)))
    expect(totalDiscount.value).toBeCloseTo(6)
  })
})

// ── quantity bundle (schedule: days) ─────────────────────────────────────────

describe('friday-flower-2pack (quantity, schedule: days)', () => {
  it('no deal on a non-Friday', () => {
    mockDate(3, 15) // Wednesday
    const { appliedDeals } = useBundles(sel(hhFlower(2, 18)))
    expect(appliedDeals.value.find((d) => d.id === 'friday-flower-2pack')).toBeUndefined()
  })

  it('deal fires on Friday', () => {
    mockDate(5, 15) // Friday
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

// ── quantity bundle (schedule: dates) ────────────────────────────────────────

describe('dime-2g-10th (quantity, schedule: dates)', () => {
  it('no deal on a non-10th', () => {
    mockDate(3, 15)
    const { appliedDeals } = useBundles(sel(dime2g(2, 50)))
    expect(appliedDeals.value.find((d) => d.id === 'dime-2g-10th')).toBeUndefined()
  })

  it('deal fires on the 10th', () => {
    mockDate(3, 10)
    const { appliedDeals } = useBundles(sel(dime2g(2, 50)))
    const deal = appliedDeals.value.find((d) => d.id === 'dime-2g-10th')
    // 2 × $50 = $100 normal; bundle = $80; savings = $20
    expect(deal).toBeDefined()
    expect(deal.savings).toBeCloseTo(20)
  })

  it('no deal on the 10th with only 1 item', () => {
    mockDate(3, 10)
    const { appliedDeals } = useBundles(sel(dime2g(1, 50)))
    expect(appliedDeals.value.find((d) => d.id === 'dime-2g-10th')).toBeUndefined()
  })
})

// ── timed bundle (schedule: days) ────────────────────────────────────────────

describe('monday-edibles (timed, schedule: days)', () => {
  it('no deal on a non-Monday', () => {
    mockDate(3, 15) // Wednesday
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
    const { appliedDeals } = useBundles(sel(edible(2, 7))) // $7 < $8 unitPrice
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
    // 1 × $55 normal; 1 × $45 deal; savings = $10
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

  it('no nudge when threshold already met (deal is active)', () => {
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
    mockDate(3, 15) // Wednesday, not Friday
    const { nearDeals } = useBundles(sel(hhFlower(1)))
    expect(nearDeals.value.find((d) => d.id === 'friday-flower-2pack')).toBeUndefined()
  })

  it('shows nudge for schedule-gated bundle when schedule is active', () => {
    mockDate(5, 15) // Friday
    const { nearDeals } = useBundles(sel(hhFlower(1)))
    const nudge = nearDeals.value.find((d) => d.id === 'friday-flower-2pack')
    expect(nudge).toBeDefined()
    expect(nudge.needed).toBe(1)
  })

  it('no nudge for timed bundles (they have no quantity threshold)', () => {
    mockDate(1, 15) // Monday
    const { nearDeals } = useBundles(sel(edible(1, 12)))
    expect(nearDeals.value.find((d) => d.id === 'monday-edibles')).toBeUndefined()
  })
})

// ── multiple deals ────────────────────────────────────────────────────────────

describe('multiple deals in cart', () => {
  it('applies independent deals simultaneously', () => {
    mockDate(1, 15) // Monday
    const { appliedDeals, totalDiscount } = useBundles(
      sel(juicyStix(4, 12), edible(2, 12)),
    )
    const ids = appliedDeals.value.map((d) => d.id)
    expect(ids).toContain('juicy-stix-4pack')
    expect(ids).toContain('monday-edibles')
    // savings: $6 (stix) + $8 (edibles) = $14
    expect(totalDiscount.value).toBeCloseTo(14)
  })

  it('empty cart has no deals', () => {
    const { appliedDeals, totalDiscount } = useBundles(ref({}))
    expect(appliedDeals.value).toHaveLength(0)
    expect(totalDiscount.value).toBe(0)
  })
})
