// Bundle pricing config — edit this file to add or modify deals.
//
// Two bundle types:
//
//   quantity — N matching items for a fixed total price
//     match:       (item) => boolean  — which cart items qualify
//     quantity:    number             — how many items per bundle
//     bundlePrice: number             — total price for one full bundle
//
//   timed — matching items get a special per-unit price on certain days
//     match:     (item) => boolean    — which cart items qualify
//     schedule:  { days?: number[] }  — days of week (0=Sun, 1=Mon … 6=Sat)
//               { dates?: number[] } — days of month (1–31)
//     unitPrice: number              — price per item when active
//
// Optional fields:
//   schedule: { days?, dates? }  — omit for always-on; {} means always-on
//   group:    string             — bundles in the same group never stack;
//                                  only the one with the highest savings applies
//
// In both cases `match` receives an item from session.selections:
//   { name, category, subcategory, qty, price, unitWeight, image }

export const BUNDLES = [

  // ── DRINKS ──────────────────────────────────────────────────────────────────

  {
    id: 'drinks-4',
    label: 'Any 4 Drinks — $20',
    type: 'quantity',
    group: 'drinks',
    match: (item) => item.category === 'BEVERAGES',
    quantity: 4,
    bundlePrice: 20,
  },
  {
    id: 'drinks-6',
    label: 'Any 6 Drinks — $27',
    type: 'quantity',
    group: 'drinks',
    match: (item) => item.category === 'BEVERAGES',
    quantity: 6,
    bundlePrice: 27,
  },
  {
    id: 'drinks-8',
    label: 'Any 8 Drinks — $35',
    type: 'quantity',
    group: 'drinks',
    match: (item) => item.category === 'BEVERAGES',
    quantity: 8,
    bundlePrice: 35,
  },
  {
    id: 'drinks-case',
    label: 'Build a Drink Case: 24 for $100',
    type: 'quantity',
    group: 'drinks',
    match: (item) => item.category === 'BEVERAGES' && !/keef/i.test(item.name),
    quantity: 24,
    bundlePrice: 100,
  },

  // ── PRE-ROLLS ────────────────────────────────────────────────────────────────

  {
    id: 'juicy-fire-4pack',
    label: 'Juicy Stickz or Fire Styxx 4-Pack — $42',
    type: 'quantity',
    group: 'juicy-fire',
    match: (item) => /juicy stickz|fire styxx/i.test(item.name),
    quantity: 4,
    bundlePrice: 42,
  },
  {
    id: 'juicy-fire-6pack',
    label: 'Juicy Stickz or Fire Styxx 6-Pack — $60',
    type: 'quantity',
    group: 'juicy-fire',
    match: (item) => /juicy stickz|fire styxx/i.test(item.name),
    quantity: 6,
    bundlePrice: 60,
  },
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
  {
    id: 'hh-5pack-2',
    label: 'Any 2 High Hopes 5-Packs — $45',
    type: 'quantity',
    match: (item) => /high hopes/i.test(item.name) && item.subcategory === 'PACKS',
    quantity: 2,
    bundlePrice: 45,
  },
  {
    id: 'valorem-1g-2',
    label: 'Any 2 Valorem 1G Pre-Rolls — $15',
    type: 'quantity',
    match: (item) => /valorem/i.test(item.name) && /1g/i.test(item.unitWeight),
    quantity: 2,
    bundlePrice: 15,
  },
  {
    id: 'realm-1g-2',
    label: 'Any 2 Realm 1G Pre-Rolls — $15',
    type: 'quantity',
    match: (item) => /realm/i.test(item.name) && /1g/i.test(item.unitWeight) && !/infused|blunt/i.test(item.name),
    quantity: 2,
    bundlePrice: 15,
  },

  // ── FLOWER ───────────────────────────────────────────────────────────────────

  {
    id: 'hh-eighth-3pack',
    label: 'High Hopes Oranguava, Love Truffles & OGKB — 3 for $55',
    type: 'quantity',
    match: (item) => /oranguava|love truffles|ogkb/i.test(item.name) && /3\.5g/i.test(item.unitWeight),
    quantity: 3,
    bundlePrice: 55,
  },
  {
    id: 'friday-flower-2pack',
    label: 'High Hopes Flower 3.5G 2-Pack — $28 (Fridays)',
    type: 'quantity',
    match: (item) => /high hopes/i.test(item.name) && /3\.5g/i.test(item.unitWeight),
    schedule: { days: [5] },
    quantity: 2,
    bundlePrice: 28,
  },

  // ── VAPE / CONCENTRATE ───────────────────────────────────────────────────────

  {
    id: 'hellavated-1g-2',
    label: 'Hellavated 1G Carts — 2 for $45',
    type: 'quantity',
    match: (item) => /hellavated/i.test(item.name) && /1g/i.test(item.unitWeight) && !/disposable|cloud bar/i.test(item.name),
    quantity: 2,
    bundlePrice: 45,
  },
  {
    id: 'freshly-baked-1g-2',
    label: 'Freshly Baked 1G Carts — 2 for $40',
    type: 'quantity',
    match: (item) => /freshly baked/i.test(item.name) && /1g/i.test(item.unitWeight),
    quantity: 2,
    bundlePrice: 40,
  },
  {
    id: 'fernway-1g-2',
    label: 'Fernway 1G Carts — 2 for $60',
    type: 'quantity',
    group: 'fernway-1g',
    match: (item) => /fernway/i.test(item.name) && /1g/i.test(item.unitWeight) && !/disposable/i.test(item.name),
    quantity: 2,
    bundlePrice: 60,
  },
  {
    id: 'friday-fernway-1g-3',
    label: 'Fernway 1G Carts — 3 for $85 (Fridays)',
    type: 'quantity',
    group: 'fernway-1g',
    match: (item) => /fernway/i.test(item.name) && /1g/i.test(item.unitWeight) && !/disposable/i.test(item.name),
    schedule: { days: [5] },
    quantity: 3,
    bundlePrice: 85,
  },
  {
    id: 'select-briq-2g-2',
    label: 'Select Briq 2G Disposables — 2 for $100',
    type: 'quantity',
    match: (item) => /select briq/i.test(item.name) && /2g/i.test(item.unitWeight),
    quantity: 2,
    bundlePrice: 100,
  },
  {
    id: 'crude-strane-4',
    label: 'Crude Boys or Strane Carts — 4 for $100',
    type: 'quantity',
    match: (item) => /crude boys|strane/i.test(item.name) && !/cloud bar/i.test(item.name),
    quantity: 4,
    bundlePrice: 100,
  },
  {
    id: 'dcc-1g-4',
    label: 'DCC 1G Live Resin Carts — 4 for $100',
    type: 'quantity',
    match: (item) => /\bdcc\b/i.test(item.name) && /1g/i.test(item.unitWeight),
    quantity: 4,
    bundlePrice: 100,
  },
  {
    id: 'hellavated-strane-cloud-2',
    label: 'Hellavated or Strane 1G Cloud Bars — 2 for $55',
    type: 'quantity',
    match: (item) => /hellavated|strane/i.test(item.name) && /cloud bar/i.test(item.name) && /1g/i.test(item.unitWeight),
    quantity: 2,
    bundlePrice: 55,
  },

  // ── DIME DAY (10th of every month) ──────────────────────────────────────────

  {
    id: 'dime-1g-2',
    label: 'Dime 1G Disposables — 2 for $70 (Dime Day)',
    type: 'quantity',
    group: 'dime-day',
    match: (item) => /\bdime\b/i.test(item.name) && /1g/i.test(item.unitWeight),
    schedule: { dates: [10] },
    quantity: 2,
    bundlePrice: 70,
  },
  {
    id: 'dime-2g-2',
    label: 'Dime 2G Disposables — 2 for $80 (Dime Day)',
    type: 'quantity',
    group: 'dime-day',
    match: (item) => /\bdime\b/i.test(item.name) && /2g/i.test(item.unitWeight),
    schedule: { dates: [10] },
    quantity: 2,
    bundlePrice: 80,
  },
  {
    id: 'dime-mix-2',
    label: 'Mix & Match Dime Disposables — 2 for $80 (Dime Day)',
    type: 'quantity',
    group: 'dime-day',
    match: (item) => /\bdime\b/i.test(item.name) && /1g|2g/i.test(item.unitWeight),
    schedule: { dates: [10] },
    quantity: 2,
    bundlePrice: 80,
  },

  // ── WAX WEDNESDAYS ───────────────────────────────────────────────────────────

  {
    id: 'mac-sugar-2',
    label: 'MAC Sugar — 2 for $55 (Wax Wednesdays)',
    type: 'quantity',
    group: 'mac-sugar',
    match: (item) => /\bmac\b/i.test(item.name) && /sugar/i.test(item.name),
    schedule: { days: [3] },
    quantity: 2,
    bundlePrice: 55,
  },
  {
    id: 'mac-sugar-3',
    label: 'MAC Sugar — 3 for $80 (Wax Wednesdays)',
    type: 'quantity',
    group: 'mac-sugar',
    match: (item) => /\bmac\b/i.test(item.name) && /sugar/i.test(item.name),
    schedule: { days: [3] },
    quantity: 3,
    bundlePrice: 80,
  },
  {
    id: 'mac-live-hash-2',
    label: 'MAC 1G Live Hash Rosin — 2 for $90 (Wax Wednesdays)',
    type: 'quantity',
    match: (item) => /\bmac\b/i.test(item.name) && /live hash rosin/i.test(item.name),
    schedule: { days: [3] },
    quantity: 2,
    bundlePrice: 90,
  },

  // ── EDIBLES ──────────────────────────────────────────────────────────────────

  {
    id: 'bettys-fruit-2',
    label: "Betty's Eddies Fruit Chew 10pk — 2 for $35",
    type: 'quantity',
    match: (item) => /betty'?s eddies/i.test(item.name) && !/caramelt/i.test(item.name),
    quantity: 2,
    bundlePrice: 35,
  },
  {
    id: 'wyld-2',
    label: 'Any 2 Wyld Gummies — $35 (Wednesdays)',
    type: 'quantity',
    match: (item) => /\bwyld\b/i.test(item.name),
    schedule: { days: [3] },
    quantity: 2,
    bundlePrice: 35,
  },
  {
    id: 'mindys-2',
    label: "Mindy's — 2 for $35",
    type: 'quantity',
    match: (item) => /mindy'?s/i.test(item.name),
    quantity: 2,
    bundlePrice: 35,
  },

  // ── MONDAY MUNCHDAYS ─────────────────────────────────────────────────────────

  {
    id: 'monday-dorks-2',
    label: 'Dorks — 2 for $16 (Monday Munchdays)',
    type: 'quantity',
    match: (item) => /\bdorks\b/i.test(item.name),
    schedule: { days: [1] },
    quantity: 2,
    bundlePrice: 16,
  },
  {
    id: 'monday-pax-2',
    label: 'Pax Live Rosin — 2 for $40 (Monday Munchdays)',
    type: 'quantity',
    match: (item) => /\bpax\b/i.test(item.name),
    schedule: { days: [1] },
    quantity: 2,
    bundlePrice: 40,
  },
  {
    id: 'monday-choice-3',
    label: 'Choice Chews — 3 for $24 (Monday Munchdays)',
    type: 'quantity',
    match: (item) => /choice chews/i.test(item.name),
    schedule: { days: [1] },
    quantity: 3,
    bundlePrice: 24,
  },
  {
    id: 'monday-camino-2',
    label: 'Camino — 2 for $40 (Monday Munchdays)',
    type: 'quantity',
    match: (item) => /\bcamino\b/i.test(item.name),
    schedule: { days: [1] },
    quantity: 2,
    bundlePrice: 40,
  },
  {
    id: 'monday-bettys-3',
    label: "Betty's Eddies Fruit Chews — 3 for $52 (Monday Munchdays)",
    type: 'quantity',
    match: (item) => /betty'?s eddies/i.test(item.name) && !/caramelt/i.test(item.name),
    schedule: { days: [1] },
    quantity: 3,
    bundlePrice: 52,
  },
  {
    id: 'monday-cannatini-2',
    label: 'Cannatini — 2 for $35 (Monday Munchdays)',
    type: 'quantity',
    match: (item) => /cannatini/i.test(item.name),
    schedule: { days: [1] },
    quantity: 2,
    bundlePrice: 35,
  },
  {
    id: 'monday-zzzonked-2',
    label: 'Zzzonked — 2 for $40 (Monday Munchdays)',
    type: 'quantity',
    match: (item) => /zzzonked/i.test(item.name),
    schedule: { days: [1] },
    quantity: 2,
    bundlePrice: 40,
  },
  {
    id: 'monday-jams-2',
    label: 'Jams — 2 for $35 (Monday Munchdays)',
    type: 'quantity',
    match: (item) => /\bjams\b/i.test(item.name),
    schedule: { days: [1] },
    quantity: 2,
    bundlePrice: 35,
  },
]
