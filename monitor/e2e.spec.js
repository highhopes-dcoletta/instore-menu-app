const { test, expect } = require('@playwright/test')

const BASE = process.env.E2E_BASE_URL ?? 'https://menu2.highhopesma.com'

// Inject a fresh staff_login_at timestamp so the auth guard treats
// the browser as authenticated (bypasses Microsoft SSO for e2e tests).
// Uses addInitScript so it runs before any app code on every page load.
async function fakeStaffSession(page) {
  await page.addInitScript(() => {
    localStorage.setItem('staff_login_at', Date.now().toString())
  })
}

// Override crypto.randomUUID so any session created by add-to-cart
// gets an e2e- prefix, which the budtender view filters out.
async function useE2eSessionId(page) {
  await page.addInitScript(() => {
    const origRandomUUID = crypto.randomUUID.bind(crypto)
    crypto.randomUUID = () => `e2e-${origRandomUUID()}`
  })
}

// Wait for the product table to have at least one row (Dutchie fetch ~5-15s)
async function waitForProducts(page) {
  await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 25000 })
}

// Wait for the home view content (only renders after products finish loading)
async function waitForHomeView(page) {
  await expect(page.getByText('Not sure where to start?')).toBeVisible({ timeout: 25000 })
}

// Wait for table row count to change from a known value
async function waitForRowCountChange(page, fromCount) {
  await expect(page.locator('table tbody tr')).not.toHaveCount(fromCount, { timeout: 5000 })
}

// ─── Group 1: Navigation & entry points ──────────────────────────────────────

test.describe('home page', () => {
  test('renders category buttons and guided CTA', async ({ page }) => {
    await page.goto(BASE)
    await waitForHomeView(page)

    await expect(page.getByText('Not sure where to start?')).toBeVisible()
    for (const label of ['FLOWER', 'PRE-ROLLS', 'EDIBLES', 'VAPES', 'DABS', 'TINCS & TOPS', 'SLEEP', 'PAIN']) {
      await expect(page.getByRole('link', { name: label }).first()).toBeVisible()
    }
  })

  test('guided CTA navigates to /guide', async ({ page }) => {
    await page.goto(BASE)
    await waitForHomeView(page)
    await page.getByText('Not sure where to start?').click()
    await expect(page).toHaveURL(`${BASE}/guide`)
  })

  test('category buttons navigate to correct routes', async ({ page }) => {
    const routes = [
      ['FLOWER',      '/flower'],
      ['PRE-ROLLS',   '/pre-rolls'],
      ['EDIBLES',     '/edibles'],
      ['VAPES',       '/vapes'],
      ['DABS',        '/concentrates'],
      ['SLEEP',       '/sleep'],
      ['PAIN',        '/pain'],
    ]
    for (const [label, path] of routes) {
      await page.goto(BASE)
      await waitForHomeView(page)
      // Click the home-grid link (not the navbar link) using the main element
      await page.locator('main').getByRole('link', { name: label }).click()
      await expect(page).toHaveURL(`${BASE}${path}`)
    }
  })
})

test.describe('navbar', () => {
  test('all nav links navigate correctly', async ({ page }) => {
    await page.goto(`${BASE}/flower`)
    await waitForProducts(page)
    const links = [
      ['HOME',          '/'],
      ['FLOWER',        '/flower'],
      ['PRE-ROLLS',     '/pre-rolls'],
      ['EDIBLES',       '/edibles'],
      ['VAPES',         '/vapes'],
      ['DABS',          '/concentrates'],
      ['SLEEP',         '/sleep'],
      ['PAIN',          '/pain'],
    ]
    for (const [name, path] of links) {
      await page.locator('nav').getByRole('link', { name, exact: true }).click()
      await expect(page).toHaveURL(`${BASE}${path}`)
    }
  })
})

// ─── Group 2: Guided flow ─────────────────────────────────────────────────────

test.describe('guided flow', () => {
  test('all 3 steps advance and results appear', async ({ page }) => {
    await page.goto(`${BASE}/guide`)

    // Step 1: experience
    await expect(page.getByText('How familiar are you with cannabis?')).toBeVisible()
    await page.getByRole('button', { name: /occasional user/i }).click()

    // Step 2: effect
    await expect(page.getByText('What are you looking for today?')).toBeVisible()
    await page.getByRole('button', { name: /relax.*unwind/i }).click()

    // Step 3: method — use role=button to avoid matching the navbar "FLOWER" link
    await expect(page.getByText('How do you prefer to consume?')).toBeVisible()
    await page.getByRole('button', { name: /Flower/i }).click()

    await expect(page.getByText('Our top picks for you')).toBeVisible()
  })

  test('back button is hidden on step 1, visible on step 2+', async ({ page }) => {
    await page.goto(`${BASE}/guide`)
    await expect(page.getByRole('button', { name: /back/i })).not.toBeVisible()
    await page.getByRole('button', { name: /occasional user/i }).click()
    await expect(page.getByRole('button', { name: /back/i })).toBeVisible()
  })

  test('back button returns to previous step', async ({ page }) => {
    await page.goto(`${BASE}/guide`)
    await page.getByRole('button', { name: /occasional user/i }).click()
    await expect(page.getByText('What are you looking for today?')).toBeVisible()
    await page.getByRole('button', { name: /back/i }).click()
    await expect(page.getByText('How familiar are you with cannabis?')).toBeVisible()
  })

  test('"Browse full menu" exits to home', async ({ page }) => {
    await page.goto(`${BASE}/guide`)
    await page.getByRole('button', { name: /browse full menu/i }).click()
    await expect(page).toHaveURL(BASE + '/')
  })

  test('"Change my answers" returns to step 3 from results', async ({ page }) => {
    await page.goto(`${BASE}/guide`)
    await page.getByRole('button', { name: /new to this/i }).click()
    await page.getByRole('button', { name: /help me sleep/i }).click()
    // Step 3: Edibles option — getByRole('button') won't match the navbar <a> links
    await page.getByRole('button', { name: /Edibles/i }).click()
    await expect(page.getByText('Our top picks for you')).toBeVisible()
    await page.getByRole('button', { name: /change my answers/i }).click()
    await expect(page.getByText('How do you prefer to consume?')).toBeVisible()
  })

  test('results show product cards with add buttons', async ({ page }) => {
    await page.goto(`${BASE}/guide`)
    await page.getByRole('button', { name: /regular user/i }).click()
    await page.getByRole('button', { name: /energy.*focus/i }).click()
    await page.getByRole('button', { name: /no preference/i }).click()
    await expect(page.getByText('Our top picks for you')).toBeVisible()
    await expect(page.locator('main').getByRole('button', { name: '+' }).first()).toBeVisible({ timeout: 10000 })
  })

  test('adding a product from results enables Send to Budtender', async ({ page }) => {
    await useE2eSessionId(page)
    await page.goto(`${BASE}/guide`)
    await page.getByRole('button', { name: /regular user/i }).click()
    await page.getByRole('button', { name: /relax.*unwind/i }).click()
    await page.getByRole('button', { name: /no preference/i }).click()
    await expect(page.getByText('Our top picks for you')).toBeVisible()

    await expect(page.getByRole('button', { name: 'Send to Budtender' })).toBeDisabled()
    await page.locator('main').getByRole('button', { name: '+' }).first().click()
    await expect(page.getByRole('button', { name: 'Send to Budtender' })).toBeEnabled({ timeout: 5000 })
  })
})

// ─── Group 3: Filtering ───────────────────────────────────────────────────────

test.describe('filtering on /flower', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/flower`)
    await waitForProducts(page)
  })

  test('search box filters rows by name', async ({ page }) => {
    const allRows = page.locator('table tbody tr')
    const initialCount = await allRows.count()

    await page.getByPlaceholder(/search/i).fill('og')
    await waitForRowCountChange(page, initialCount)
    const filteredCount = await allRows.count()
    expect(filteredCount).toBeLessThan(initialCount)

    await page.getByPlaceholder(/search/i).clear()
    await waitForRowCountChange(page, filteredCount)
    expect(await allRows.count()).toBeGreaterThanOrEqual(initialCount)
  })

  test('strain filter reduces product list', async ({ page }) => {
    const allRows = page.locator('table tbody tr')
    const initialCount = await allRows.count()

    const firstChip = page.locator('button.chip-off').first()
    const strainLabel = (await firstChip.textContent()).trim()
    await firstChip.click()
    await waitForRowCountChange(page, initialCount)
    const filteredCount = await allRows.count()
    expect(filteredCount).toBeLessThan(initialCount)

    // Deactivate
    await page.locator('button.chip-on').filter({ hasText: strainLabel }).click()
    await waitForRowCountChange(page, filteredCount)
    expect(await allRows.count()).toBeGreaterThanOrEqual(initialCount)
  })

  test('multiple strain filters stack (more filters = same or fewer results)', async ({ page }) => {
    // Scope to strain section to avoid clicking brand/other filter chips
    const strainSection = page.locator('div', { has: page.locator('.label', { hasText: /strain/i }) })
    const strainChips = strainSection.locator('button.chip-off')
    if (await strainChips.count() < 2) return

    const allRows = page.locator('table tbody tr')
    const initialCount = await allRows.count()

    await strainChips.nth(0).click()
    await waitForRowCountChange(page, initialCount)
    const firstCount = await allRows.count()

    // After first click, re-query unselected strain chips
    await strainSection.locator('button.chip-off').nth(0).click()
    await waitForRowCountChange(page, firstCount)
    expect(await allRows.count()).toBeLessThanOrEqual(firstCount)
  })

  test('"No products match your filters" appears when no results', async ({ page }) => {
    await page.getByPlaceholder(/search/i).fill('xxxxxxxxxxx_no_match')
    await expect(page.getByText(/no products match/i)).toBeVisible({ timeout: 5000 })
  })

  test('High Hopes Only brand filter reduces results', async ({ page }) => {
    const allRows = page.locator('table tbody tr')
    const initialCount = await allRows.count()

    await page.getByRole('button', { name: 'High Hopes Only' }).click()
    await waitForRowCountChange(page, initialCount)
    expect(await allRows.count()).toBeLessThan(initialCount)

    const filteredCount = await allRows.count()
    await page.getByRole('button', { name: 'High Hopes Only' }).click()
    await waitForRowCountChange(page, filteredCount)
    expect(await allRows.count()).toBeGreaterThanOrEqual(1)
  })
})

// ─── Group 4: Sorting ─────────────────────────────────────────────────────────

test.describe('sorting on /flower', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/flower`)
    await waitForProducts(page)
  })

  test('clicking Name header sets sort=name in URL', async ({ page }) => {
    // The column header is a <button> inside a <th>
    await page.getByRole('button', { name: 'Name' }).click()
    await expect(page).toHaveURL(/sort=name/)
  })

  test('clicking Name header twice sets dir=desc', async ({ page }) => {
    const btn = page.getByRole('button', { name: 'Name' })
    await btn.click()
    await expect(page).toHaveURL(/sort=name/)
    await btn.click()
    await expect(page).toHaveURL(/dir=desc/)
  })

  test('Popularity button appears after sorting and clears sort on click', async ({ page }) => {
    await page.getByRole('button', { name: 'Name' }).click()
    const popBtn = page.getByRole('button', { name: /popularity/i })
    await expect(popBtn).toBeVisible()
    await popBtn.click()
    await expect(page).not.toHaveURL(/sort=/)
    await expect(popBtn).not.toBeVisible()
  })

  test('sort params persist after page refresh', async ({ page }) => {
    await page.getByRole('button', { name: 'Name' }).click()
    await expect(page).toHaveURL(/sort=name/)
    const url = page.url()
    await page.reload()
    await waitForProducts(page)
    expect(page.url()).toBe(url)
  })

  test('Price header sets sort=price', async ({ page }) => {
    // Scope to thead to avoid matching GroupableList grouper buttons (💰 Price)
    await page.locator('thead').getByRole('button', { name: 'Price', exact: true }).click()
    await expect(page).toHaveURL(/sort=price/)
  })

  test('Potency header sets sort=potency', async ({ page }) => {
    // Scope to thead to avoid matching GroupableList grouper buttons (⚡ Potency)
    await page.locator('thead').getByRole('button', { name: 'Potency (TAC)', exact: true }).click()
    await expect(page).toHaveURL(/sort=potency/)
  })
})

// ─── Group 5: Product modal ───────────────────────────────────────────────────

test.describe('product modal on /flower', () => {
  // Helper: open the first product's modal
  async function openModal(page) {
    // The name column <td> has @click="modalProduct = product"
    await page.locator('table tbody tr').first().locator('td').nth(1).click()
    // Modal close button has aria-label="Close"
    await expect(page.getByRole('button', { name: 'Close' })).toBeVisible({ timeout: 5000 })
  }

  test.beforeEach(async ({ page }) => {
    await useE2eSessionId(page)
    await page.goto(`${BASE}/flower`)
    await waitForProducts(page)
  })

  test('clicking product name column opens modal', async ({ page }) => {
    await openModal(page)
    // Modal is open — close button visible
    await expect(page.getByRole('button', { name: 'Close' })).toBeVisible()
  })

  test('Escape key closes the modal', async ({ page }) => {
    await openModal(page)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: 'Close' })).not.toBeVisible({ timeout: 3000 })
  })

  test('Close button closes the modal', async ({ page }) => {
    await openModal(page)
    await page.getByRole('button', { name: 'Close' }).click()
    await expect(page.getByRole('button', { name: 'Close' })).not.toBeVisible({ timeout: 3000 })
  })

  test('backdrop click closes the modal', async ({ page }) => {
    await openModal(page)
    // Click the fixed backdrop (top-left corner is outside the card)
    await page.mouse.click(10, 10)
    await expect(page.getByRole('button', { name: 'Close' })).not.toBeVisible({ timeout: 3000 })
  })

  test('Add to Cart button in modal adds item to cart', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Send to Budtender' })).toBeDisabled()
    await openModal(page)
    await page.getByRole('button', { name: 'Add to Cart' }).click()
    // Cart animation delay — wait for session to update
    await expect(page.getByRole('button', { name: 'Send to Budtender' })).toBeEnabled({ timeout: 8000 })
  })

  test('modal qty controls increment and decrement', async ({ page }) => {
    await openModal(page)
    await page.getByRole('button', { name: 'Add to Cart' }).click()

    // After add, the modal now shows − qty + controls
    const modal = page.locator('.fixed.inset-0 .bg-white')
    await expect(modal.getByRole('button', { name: '+' })).toBeVisible({ timeout: 5000 })
    await modal.getByRole('button', { name: '+' }).click()

    // Cart should now show qty 2
    await expect(page.locator('[data-cart-list] li').first().locator('.tabular-nums', { hasText: /^2$/ })).toBeVisible({ timeout: 5000 })
  })
})

// ─── Existing tests (preserved) ──────────────────────────────────────────────

test('products load from Dutchie', async ({ page }) => {
  await page.goto(`${BASE}/flower`, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 25000 })
})

test('add to cart and send-to-budtender button activates', async ({ page }) => {
  await useE2eSessionId(page)
  await page.goto(`${BASE}/flower`, { waitUntil: 'domcontentloaded' })
  const firstRow = page.locator('table tbody tr').first()
  await expect(firstRow).toBeVisible({ timeout: 25000 })
  await expect(page.getByRole('button', { name: 'Send to Budtender' })).toBeDisabled()
  await firstRow.getByRole('button', { name: '+' }).click()
  await expect(page.locator('[data-cart-list] li').first()).toBeVisible({ timeout: 5000 })
  await expect(page.getByRole('button', { name: 'Send to Budtender' })).toBeEnabled()
})

test('budtender view shows and dismisses an order', async ({ page, request }) => {
  await fakeStaffSession(page)
  const sessionId = `budtender-check-${Date.now()}`
  const post = await request.post(`${BASE}/api/session`, {
    data: {
      sessionId,
      selections: {
        'e2e-bud-sku': { name: 'Budtender Test Product', qty: 1, price: 20, unitWeight: '1g', category: 'FLOWER' },
      },
    },
  })
  expect(post.ok()).toBeTruthy()
  await page.goto(`${BASE}/budtender`)
  await expect(page.getByText('Budtender Test Product').first()).toBeVisible({ timeout: 10000 })
  const card = page.locator(`[data-session-id="${sessionId}"]`)
  await expect(card.locator('[title="Dismiss order"]')).toBeVisible()
  await card.locator('[title="Dismiss order"]').click()
  await expect(card).not.toBeVisible({ timeout: 5000 })
  await request.delete(`${BASE}/api/session/${sessionId}`)
})

test('cart share page loads for a valid session', async ({ page, request }) => {
  const sessionId = `test-monitor-${Date.now()}`
  const post = await request.post(`${BASE}/api/session`, {
    data: {
      sessionId,
      selections: {
        'e2e-sku': { name: 'E2E Test Product', qty: 1, price: 10, unitWeight: '1g', category: 'FLOWER' },
      },
    },
  })
  expect(post.ok()).toBeTruthy()
  await page.goto(`${BASE}/cart/${sessionId}`)
  await expect(page.getByText('E2E Test Product')).toBeVisible({ timeout: 10000 })
  await request.delete(`${BASE}/api/session/${sessionId}`)
})

test('cart share page shows expired message for unknown session', async ({ page }) => {
  await page.goto(`${BASE}/cart/non-existent-session-id-xyz`)
  await expect(page.getByText(/expired/i)).toBeVisible({ timeout: 10000 })
})

// ─── Group 7: Bundle editor CRUD + customer-facing integration ──────────────

const E2E_PREFIX = 'e2e-test-bundle'
const E2E_BUNDLE_ID = `${E2E_PREFIX}-${Date.now()}`
const E2E_LABEL = `${E2E_BUNDLE_ID} Test Deal`
const E2E_LABEL_UPDATED = `${E2E_BUNDLE_ID} Updated Deal`

test.describe.serial('bundle editor', () => {
  test.beforeEach(async ({ page }) => {
    await fakeStaffSession(page)
  })

  // Clean up any leftover test bundles before and after the suite
  async function cleanupTestBundles(request) {
    const res = await request.fetch(`${BASE}/api/bundles?includeDisabled=1`)
    if (res.ok()) {
      const bundles = await res.json()
      for (const b of bundles) {
        if (b.id.startsWith(E2E_PREFIX)) {
          await request.delete(`${BASE}/api/bundles/${b.id}`)
        }
      }
    }
  }

  test('bundles page loads and shows existing bundles', async ({ page, request }) => {
    await cleanupTestBundles(request) // pre-clean stale bundles from prior runs
    await page.goto(`${BASE}/bundles`)
    await expect(
      page.locator('.rounded-xl.border').first().or(page.getByText(/no bundles yet/i))
    ).toBeVisible({ timeout: 15000 })
  })

  test('create a new bundle via the form', async ({ page }) => {
    await page.goto(`${BASE}/bundles`)
    await page.waitForResponse(resp => resp.url().includes('/api/bundles'))

    await page.getByRole('button', { name: '+ New Bundle' }).click()
    await expect(page.getByRole('heading', { name: 'New Bundle' })).toBeVisible()

    const form = page.locator('form')
    await form.locator('input').first().fill(E2E_LABEL)
    await form.getByRole('button', { name: 'Timed' }).click()
    const unitPriceInput = form.locator('input[type="number"]').first()
    await unitPriceInput.fill('5')
    await form.locator('select').first().selectOption('Flower')

    // Add name-contains criterion
    const nameInput = form.locator('input[placeholder="e.g. juicy stickz"]')
    await nameInput.fill('high hopes')
    await nameInput.locator('..').getByRole('button', { name: 'Add' }).click()
    await expect(form.locator('.bg-blue-100', { hasText: 'high hopes' })).toBeVisible()

    // Live preview should show matches
    await expect(form.getByText(/matching products/i).locator('span')).not.toHaveText('(0)', { timeout: 5000 })

    // Set the ID
    const idInput = form.locator('input').nth(1)
    await idInput.fill(E2E_BUNDLE_ID)

    await form.getByRole('button', { name: 'Create' }).click()
    await expect(page.getByRole('heading', { name: 'New Bundle' })).not.toBeVisible({ timeout: 5000 })
    await expect(page.getByText(E2E_LABEL)).toBeVisible({ timeout: 5000 })
  })

  test('created bundle shows as a deal badge on the flower page', async ({ page }) => {
    await page.goto(`${BASE}/flower`)
    await waitForProducts(page)
    await expect(
      page.locator('.bg-amber-50', { hasText: E2E_LABEL })
    ).toBeVisible({ timeout: 10000 })
  })

  test('edit the bundle label and verify it updates on the flower page', async ({ page }) => {
    await page.goto(`${BASE}/bundles`)
    await page.waitForResponse(resp => resp.url().includes('/api/bundles'))

    const bundleCard = page.locator('.rounded-xl.border', { hasText: E2E_LABEL })
    await expect(bundleCard).toBeVisible({ timeout: 10000 })
    await bundleCard.getByRole('button', { name: 'Edit' }).click()
    await expect(page.getByRole('heading', { name: 'Edit Bundle' })).toBeVisible()

    const form = page.locator('form')
    await form.locator('input').first().fill(E2E_LABEL_UPDATED)
    await form.getByRole('button', { name: 'Save Changes' }).click()
    await expect(page.getByRole('heading', { name: 'Edit Bundle' })).not.toBeVisible({ timeout: 5000 })
    await expect(page.getByText(E2E_LABEL_UPDATED)).toBeVisible({ timeout: 5000 })

    // Verify on flower page
    await page.goto(`${BASE}/flower`)
    await waitForProducts(page)
    await expect(
      page.locator('.bg-amber-50', { hasText: E2E_LABEL_UPDATED })
    ).toBeVisible({ timeout: 10000 })
  })

  test('disable the bundle and verify it disappears from the flower page', async ({ page, request }) => {
    await page.goto(`${BASE}/bundles`)
    // Wait for bundles API to respond and render
    await page.waitForResponse(resp => resp.url().includes('/api/bundles'))

    const bundleCard = page.locator('.rounded-xl.border', { hasText: E2E_LABEL_UPDATED })
    await expect(bundleCard).toBeVisible({ timeout: 10000 })
    await bundleCard.locator('button[title="Disable"]').click({ force: true })
    await expect(bundleCard).toHaveClass(/opacity-60/, { timeout: 10000 })

    // Verify via API that bundle is disabled
    const apiRes = await request.fetch(`${BASE}/api/bundles?includeDisabled=1`)
    const allBundles = await apiRes.json()
    const testBundle = allBundles.find(b => b.id === E2E_BUNDLE_ID)
    expect(testBundle).toBeTruthy()
    expect(testBundle.enabled).toBe(false)

    await page.goto(`${BASE}/flower`)
    await waitForProducts(page)
    await expect(
      page.locator('.bg-amber-50', { hasText: E2E_LABEL_UPDATED })
    ).not.toBeVisible({ timeout: 5000 })
  })

  test('re-enable the bundle and verify it reappears', async ({ page, request }) => {
    // Re-enable via API (the UI toggle is fragile due to Vue re-render detaching the DOM element)
    const getRes = await request.fetch(`${BASE}/api/bundles?includeDisabled=1`)
    const allBundles = await getRes.json()
    const bundle = allBundles.find(b => b.id === E2E_BUNDLE_ID)
    expect(bundle).toBeTruthy()
    expect(bundle.enabled).toBe(false)

    await request.put(`${BASE}/api/bundles/${E2E_BUNDLE_ID}`, {
      data: { ...bundle, enabled: true },
    })

    // Verify on bundles admin page — card should not be dimmed
    await page.goto(`${BASE}/bundles`)
    await page.waitForResponse(resp => resp.url().includes('/api/bundles'))
    const bundleCard = page.locator('.rounded-xl.border', { hasText: E2E_LABEL_UPDATED })
    await expect(bundleCard).toBeVisible({ timeout: 10000 })
    await expect(bundleCard).not.toHaveClass(/opacity-60/, { timeout: 5000 })

    // Flower page should show the deal again
    await page.goto(`${BASE}/flower`)
    await waitForProducts(page)
    await expect(
      page.locator('.bg-amber-50', { hasText: E2E_LABEL_UPDATED })
    ).toBeVisible({ timeout: 10000 })
  })

  test('delete the bundle and verify it disappears everywhere', async ({ page, request }) => {
    await page.goto(`${BASE}/bundles`)
    await page.waitForResponse(resp => resp.url().includes('/api/bundles'))

    const bundleCard = page.locator('.rounded-xl.border', { hasText: E2E_LABEL_UPDATED })
    await expect(bundleCard).toBeVisible({ timeout: 10000 })

    await bundleCard.getByRole('button', { name: 'Delete' }).click()
    await bundleCard.getByRole('button', { name: 'Confirm' }).click()
    await expect(bundleCard).not.toBeVisible({ timeout: 5000 })

    await page.goto(`${BASE}/flower`)
    await waitForProducts(page)
    await expect(
      page.locator('.bg-amber-50', { hasText: E2E_LABEL_UPDATED })
    ).not.toBeVisible({ timeout: 5000 })

    // Final cleanup
    await cleanupTestBundles(request)
  })
})
