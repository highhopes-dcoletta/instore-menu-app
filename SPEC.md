---

# High Hopes Menu App — Technical Spec v2

## Overview
A Vue 3 single-page application replacing the existing Softr menu at `menu.highhopesma.com`. The app reads product data from Airtable, supports kiosk-mode item selection, and communicates selections to a budtender dashboard in near-real-time. A small Flask backend handles session management.

---

## Tech Stack

- **Frontend:** Vue 3 + Vite + Vue Router + Tailwind CSS
- **Backend:** Python / Flask (same VPS as sync script)
- **Web server:** Nginx (serves Vue static build, proxies Flask API)
- **Data source:** Airtable API (fetched directly from browser)

---

## Repository Structure

```
highhopes-menu/
├── frontend/
│   ├── src/
│   │   ├── main.js
│   │   ├── App.vue
│   │   ├── router/
│   │   │   └── index.js
│   │   ├── stores/
│   │   │   ├── products.js      # Airtable data, cache, background refresh
│   │   │   └── session.js       # Kiosk checkbox state, session lifecycle
│   │   ├── components/
│   │   │   ├── NavBar.vue
│   │   │   ├── ProductTable.vue
│   │   │   ├── FilterPanel.vue
│   │   │   └── SubcategoryTabs.vue
│   │   └── views/
│   │       ├── HomeView.vue
│   │       ├── FlowerView.vue
│   │       ├── PreRollsView.vue
│   │       ├── EdiblesView.vue
│   │       ├── VapesView.vue
│   │       ├── DabsView.vue
│   │       ├── TincturesTopicalsView.vue
│   │       ├── SleepView.vue
│   │       ├── PainView.vue
│   │       └── BudtenderView.vue
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
└── backend/
    ├── app.py
    ├── requirements.txt
    └── .env
```

---

## Routing

| Route | View | Notes |
|---|---|---|
| `/` | HomeView | Category image grid |
| `/flower` | FlowerView | |
| `/pre-rolls` | PreRollsView | |
| `/edibles` | EdiblesView | |
| `/vapes` | VapesView | |
| `/concentrates` | DabsView | Nav label is "DABS" |
| `/tinctures-and-topicals` | TincturesTopicalsView | Nav label is "TINCS & TOPS" |
| `/sleep` | SleepView | |
| `/pain` | PainView | |
| `/budtender` | BudtenderView | |

All routes use Vue Router in History mode. Nginx must be configured to serve `index.html` for all routes (standard SPA fallback).

---

## Data Layer

### Airtable Fetch

On app load, fetch all records from the Airtable `High Hopes Products` table where `Active = true`. Paginate until all records are retrieved. Store in a Pinia store (`products.js`).

```
GET https://api.airtable.com/v0/{BASE_ID}/{TABLE_ID}
  ?filterByFormula={Active}=TRUE()
  &fields[]=ID&fields[]=Name&fields[]=Brand&fields[]=Category
  &fields[]=Subcategory&fields[]=Strain&fields[]=Potency
  &fields[]=Potency+Unit&fields[]=Price&fields[]=Unit+Weight
  &fields[]=Image+URL&fields[]=Description&fields[]=Effects
  &fields[]=Tags&fields[]=Quantity&fields[]=Popularity
  &fields[]=Pre-Ground%3F&fields[]=Infused+Preroll%3F
Authorization: Bearer {AIRTABLE_PAT}
```

Fetch the `Pre-Ground?` and `Infused Preroll?` formula fields explicitly — they are needed for client-side filtering.

**Security note:** The Airtable PAT will be visible in browser network requests. This is the same exposure as with Softr today and is not a regression. The PAT must be scoped to read-only access on this base only. Never grant write access to the frontend PAT.

### All Filtering is Client-Side
All filtering, sorting, and searching happens in the browser against the locally cached product list. No additional Airtable API calls are made when the user changes filters.

### Loading and Error States
- **Loading:** On initial fetch, show a centered spinner and the text "Loading menu..." — do not render any product table until data is available.
- **Error:** If the initial fetch fails after 3 retries, show a full-page message: "Menu temporarily unavailable — please ask a budtender for assistance." Do not show a broken or empty table.
- **Background refresh errors:** Log to console, do not show any UI error. Continue retrying on the next scheduled interval.

### Background Refresh

Every 5 minutes, re-fetch all products silently in the background. Rules:
- Only replace the store's product list after the **complete new dataset** has been received and validated — never do a partial update
- If any checked item in the current session is absent from the new dataset (went out of stock), remove it from selections silently and fire an updated POST to the backend
- Vue's reactivity updates the displayed list automatically
- Preserve scroll position: after store update, restore the previous scroll position
- No notification to the user

### Filter Option Generation
Filter chip values (sizes, strains, brands, tags) are **derived dynamically from the current product data** for each category — never hardcoded. This ensures new values appear automatically as inventory changes.

Exception: the following filter structures are fixed by page design and hardcoded:
- Pre-Ground? chips: Yes / No
- Infused? dropdown: All / Yes / No
- Packaging chips: SINGLES / PACKS
- Category chips on Sleep/Pain: EDIBLES / VAPORIZERS / FLOWER / PRE_ROLLS / TINCTURES / CONCENTRATES
- Subcategory tabs on Edibles: GUMMIES / CHOCOLATES / CAPSULES_TABLETS / DRINKS / CHEWS / HARD_CANDY
- Subcategory tabs on Dabs: BADDER / BUDDER / CRUMBLE / DIAMONDS / HASH / ISOLATE / KIEF / ROSIN/RESIN / SAND / SHATTER / SUGAR / WAX
- Vapes additional filter chips: 510 / Airo / Disposable / Live Rosin/Resin / Pax

### Category Filtering

Each view filters the full product list client-side by `Category` field:

| View | Filter |
|---|---|
| Flower | `Category = FLOWER` |
| Pre-Rolls | `Category = PRE_ROLLS` |
| Edibles | `Category = EDIBLES` |
| Vapes | `Category = VAPORIZERS` |
| Dabs | `Category = CONCENTRATES` |
| Tinctures | `Category = TINCTURES` |
| Topicals | `Category = TOPICALS` |
| Sleep | `Tags includes Sleep` |
| Pain | `Tags includes Pain` |

---

## Page Specifications

### Shared behavior across all product pages
- Sort by clicking column header, second click reverses sort
- Default sort is the one that comes back from server (popularity)
- First click on name sorts A-Z, first click on potency sorts high-low, first click on price sorts low-high
- Text search box — filters by product name, persisted in URL as `search-for`
- All filter state persisted in URL query params (see URL State below)
- Checkbox on each row (kiosk selection)
- Checked rows are visually highlighted (e.g. light teal background)
- Default columns: Name (unit weight bolded inline), Strain, Potency (TAC), Price

### HomeView (`/`)
- Navigation grid of category images, matching current app layout
- No product table, no checkboxes

### FlowerView (`/flower`)
- Standard sort + search + table
- Filters (all dynamically derived except Pre-Ground?): Brand, Strain, Size (maps to `Unit Weight`), Pre-Ground? (Yes/No — maps to `Pre-Ground?` formula field)

### PreRollsView (`/pre-rolls`)
- Standard sort + search + table
- Filters: Brand (dynamic), Strain (dynamic), Packaging (SINGLES/PACKS — maps to `Subcategory`), Size (dynamic — maps to `Unit Weight`), Infused? (All/Yes/No dropdown — maps to `Infused Preroll?` formula field)

### EdiblesView (`/edibles`)
- Subcategory tab strip across top (hardcoded, maps to `Subcategory`)
- Navigating between tabs clears the search-for param
- Standard sort + search + table below tabs
- Filters: Strain (dynamic, including HIGH_CBD)
- No Brand filter

### VapesView (`/vapes`)
- Standard sort + search + table
- Filters: Strain (dynamic), Size (dynamic — maps to `Unit Weight`)
- Additional Filters section: 510, Airo, Disposable, Live Rosin/Resin, Pax (hardcoded tag chips, multi-select)

### DabsView (`/concentrates`)
- Subcategory tab strip (hardcoded, maps to `Subcategory`)
- Navigating between tabs clears the search-for param
- Standard sort + search + table
- Filters: Strain (dynamic), Size (dynamic — maps to `Unit Weight`)
- **No Price column** — table shows Name, Strain, Potency (TAC) only

### TincturesTopicalsView (`/tinctures-and-topicals`)
- Two independent sections on the same page: TINCTURES then TOPICALS
- Each section has its own search bar — search-for param applies to whichever section is active (or both simultaneously; implement whichever is simpler)
- **No sort buttons, no filter panel** for either section
- Columns: Name, Strain, Potency (TAC), Price

### SleepView (`/sleep`)
- Cross-category: products where Tags includes `Sleep`
- Standard sort + search + table
- Filters: Brand (dynamic), Category (hardcoded chips)
- Column order: Name, Potency (TAC), Strain, Price

### PainView (`/pain`)
- Identical structure to SleepView
- Products where Tags includes `Pain`

### BudtenderView (`/budtender`)
- No kiosk nav bar — show only a simple "Budtender Dashboard" header
- No checkboxes
- Polls `GET /api/sessions` every 5 seconds
- Shows active sessions oldest-first (customer waiting longest at top)
- Each session card shows: time since last update (e.g. "2 min ago"), list of selected items formatted as "Name — Size — $Price"
- Sessions with zero selections are not shown (handled by backend)
- Sessions are automatically removed from view when they expire (backend handles 15-min cutoff)
- No dismiss or archive action

---

## URL State

All filter and sort state is persisted in the URL query string.

| Parameter | Values | Notes |
|---|---|---|
| `sort` | `popularity`, `name`, `potency`, `price` | Default: `popularity` |
| `search-for` | string | Text search value |
| `brand` | Brand name string | |
| `strain` | Strain value | Multiple allowed |
| `size` | Unit Weight value | Multiple allowed |
| `preground` | `yes`, `no` | Flower only |
| `packaging` | `SINGLES`, `PACKS` | Pre-Rolls only |
| `infused` | `yes`, `no` | Pre-Rolls only |
| `subcategory` | Subcategory value | Edibles and Dabs tab state |
| `tag` | Tag value | Vapes additional filters, multiple allowed |
| `category` | Category value | Sleep and Pain only, multiple allowed |

Multiple values for the same filter use repeated params: `?strain=SATIVA&strain=HYBRID`

Navigating between subcategory tabs on Edibles and Dabs clears `search-for`.

---

## Kiosk Session Management

### State (Pinia `session.js` store)
```javascript
{
  sessionId: null,          // UUID, stored in localStorage
  selections: {}            // keyed by product ID -> { name, unitWeight, price }
}
```

### Session Lifecycle

**On app startup:**
1. Check localStorage for existing `sessionId`
2. If found, fire `DELETE /api/session/{sessionId}` to clean up stale session
3. Clear localStorage
4. Start with empty selections, null sessionId

**On first checkbox check:**
1. Generate a new UUID as `sessionId`
2. Store in localStorage
3. Fire `POST /api/session` with sessionId and current selections

**On each subsequent check/uncheck:**
- If selections is now empty: fire `DELETE /api/session/{sessionId}`, clear localStorage, set sessionId to null
- Otherwise: fire `POST /api/session` with updated selections

**On inactivity timeout (2 minutes):**
1. If sessionId exists: fire `DELETE /api/session/{sessionId}`
2. Clear localStorage, reset selections, set sessionId to null
3. Navigate to `/`, clear all filter/sort URL state

**If Flask backend is unreachable:**
- Checkbox state still updates locally — do not block the user interaction
- Log the error to console
- Retry the API call on the next interaction
- Do not show any error to the user

**On background refresh — out-of-stock item removed:**
- If a currently-checked product is absent from the new dataset, remove it from selections silently
- If sessionId exists and selections are now non-empty, fire `POST /api/session` with updated selections
- If removing the item empties selections entirely, fire `DELETE /api/session/{sessionId}` and clean up

### Inactivity Timeout
- Duration: 2 minutes
- Lives in `App.vue`
- Reset on: `click`, `touchstart`, `keydown`, `scroll`
- On trigger: session cleanup + navigate to `/` + clear all Pinia state

### Checkbox UI
- Each product row has a checkbox on the left
- Checked state driven by whether the product ID is in `session.selections`
- Selections persist across category navigation (state lives in Pinia store, not in the view)
- Checked rows highlighted with a distinct background color

---

## Flask Backend

### Single Worker Requirement
Flask must be run with a single Gunicorn worker (`-w 1`). Sessions are stored in memory — multiple workers would cause sessions written to one worker to be invisible to another. **Do not increase the worker count.**

### Endpoints

**`POST /api/session`**
Body: `{ sessionId, selections: { productId: { name, unitWeight, price } } }`
Creates or updates a session. Sets/resets a 15-minute expiry timestamp.
Returns: `200 OK`

**`DELETE /api/session/<sessionId>`**
Removes the session. Idempotent — returns `200 OK` even if session didn't exist.

**`GET /api/sessions`**
- Purge sessions older than `SESSION_TIMEOUT_MINUTES` before responding
- Return only sessions with at least one selection
- Return sessions ordered oldest-first (by `updatedAt`)

Returns:
```json
[
  {
    "sessionId": "uuid",
    "updatedAt": "2026-03-01T14:23:00Z",
    "selections": {
      "productId": { "name": "High Hopes | OGKB", "unitWeight": "1/8oz", "price": 18 }
    }
  }
]
```

### Storage
Sessions stored in a Python dict in memory. No database. Sessions are lost on process restart — acceptable given the 15-minute window.

### CORS
Allow requests from `menu.highhopesma.com` only.

### Config (`.env`)
```
SESSION_TIMEOUT_MINUTES=15
FLASK_PORT=5001
```

---

## Responsive Layout

The app is optimized for the kiosk: a 55" landscape touchscreen. It is not designed to be mobile-responsive. If someone accesses the menu on a phone, the experience may be degraded — this is acceptable for now and can be addressed in a future iteration.

The minimum supported viewport width is 1024px. Below this, no layout guarantees are made.

---

## Nginx Configuration

```nginx
server {
    listen 80;
    server_name menu.highhopesma.com;

    root /var/www/highhopes-menu;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:5001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

SSL via existing certificate on the domain (managed separately — do not modify).

---

## Deployment

- Build: `npm run build` in `frontend/` → outputs to `frontend/dist/`
- Deploy: copy `dist/` contents to `/var/www/highhopes-menu/` on VPS
- Flask: run via gunicorn as a systemd service with `-w 1`
- A deploy shell script should automate build + copy in one command

---

## Out of Scope (for now)
- Weekly Specials page
- Events page
- Password protection on `/budtender`
- Product detail pages or image display
- Mobile/responsive layout
- Any back-office or admin UI

---

