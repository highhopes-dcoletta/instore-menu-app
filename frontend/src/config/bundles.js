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
// In both cases `match` receives an item from session.selections:
//   { name, category, qty, price, unitWeight, image }

export const BUNDLES = [
  {
    id: 'juicy-stix-4pack',
    label: 'Any 4 Juicy Stix — $42',
    type: 'quantity',
    match: (item) => /juicy stickz/i.test(item.name),
    quantity: 4,
    bundlePrice: 42,
  },
  {
    id: 'hellavated-1g-cart',
    label: 'Hellavated 1G Cartridge — $45',
    type: 'timed',
    match: (item) => /hellavated/i.test(item.name) && /1g/i.test(item.unitWeight) && !/disposable/i.test(item.name),
    schedule: {},
    unitPrice: 45,
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
    id: 'juicy-stix-6pack',
    label: 'Any 6 Juicy Stix — $60',
    type: 'quantity',
    match: (item) => /juicy stickz/i.test(item.name),
    quantity: 6,
    bundlePrice: 60,
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
]
