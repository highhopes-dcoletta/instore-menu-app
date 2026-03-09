const { test, expect } = require('@playwright/test')

const BASE = 'https://menu2.highhopesma.com'
const MENU_PAGE = `${BASE}/flower`

test('products load from Dutchie', async ({ page }) => {
  await page.goto(MENU_PAGE, { waitUntil: 'domcontentloaded' })

  // At least one product row must appear within 20s (Dutchie fetch)
  await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 20000 })
})

test('add to cart and send-to-budtender button activates', async ({ page }) => {
  await page.goto(MENU_PAGE, { waitUntil: 'domcontentloaded' })

  // Wait for product table
  const firstRow = page.locator('table tbody tr').first()
  await expect(firstRow).toBeVisible({ timeout: 20000 })

  // Cart should be empty — button disabled
  await expect(page.getByRole('button', { name: 'Send to Budtender' })).toBeDisabled()

  // Click the first product's + button
  await firstRow.getByRole('button', { name: '+' }).click()

  // Cart panel should show the item
  await expect(page.locator('[data-cart-list] li').first()).toBeVisible({ timeout: 5000 })

  // Send to Budtender button should now be enabled
  await expect(page.getByRole('button', { name: 'Send to Budtender' })).toBeEnabled()
})

test('cart share page loads for a valid session', async ({ page, request }) => {
  // Create a real session via the API
  const sessionId = `e2e-monitor-${Date.now()}`
  const post = await request.post(`${BASE}/api/session`, {
    data: {
      sessionId,
      selections: {
        'e2e-sku': { name: 'E2E Test Product', qty: 1, price: 10, unitWeight: '1g', category: 'FLOWER' },
      },
    },
  })
  expect(post.ok()).toBeTruthy()

  // Cart share page should render the item
  await page.goto(`${BASE}/cart/${sessionId}`)
  await expect(page.getByText('E2E Test Product')).toBeVisible({ timeout: 10000 })

  // Clean up
  await request.delete(`${BASE}/api/session/${sessionId}`)
})
