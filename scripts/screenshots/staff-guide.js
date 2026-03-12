/**
 * Staff Guide Screenshot Generator
 *
 * Captures all screenshots used in the Staff Quick Reference (STAFF-GUIDE.md).
 * Run via: node scripts/screenshots/staff-guide.js
 *
 * Requires Playwright + Chromium installed (same as the e2e monitor).
 * Screenshots are saved to docs/screenshots/guide-*.png.
 */

const { chromium } = require('playwright')
const path = require('path')

const BASE = process.env.SCREENSHOT_BASE_URL ?? 'https://menu2-stage.highhopesma.com'
const OUT = path.resolve(__dirname, '../../docs/screenshots')

// iPad Air viewport (Safari) — matches in-store kiosk
const VIEWPORT = { width: 1180, height: 820 }

const p = (f) => path.join(OUT, f)
const wait = (ms) => new Promise(r => setTimeout(r, ms))

async function main() {
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 })
  const page = await context.newPage()

  // Inject staff session for auth-protected pages
  await page.addInitScript(() => {
    localStorage.setItem('staff_login_at', Date.now().toString())
  })
  // Prefix any sessions created during screenshots so they don't show on budtender
  await page.addInitScript(() => {
    const orig = crypto.randomUUID.bind(crypto)
    crypto.randomUUID = () => `e2e-screenshot-${orig()}`
  })

  try {
    // ── 1. Home page ──────────────────────────────────────────────────────────
    console.log('1/16 Home page')
    await page.goto(`${BASE}/`)
    await page.getByText('Not sure where to start?').waitFor({ state: 'visible', timeout: 25000 })
    await wait(500)
    await page.screenshot({ path: p('guide-01-home.png') })

    // ── 2. Guided flow — step 1 ─────────────────────────────────────────────
    console.log('2/16 Guided flow — experience question')
    await page.goto(`${BASE}/guide`)
    await page.getByRole('button', { name: /regular user/i }).waitFor({ state: 'visible', timeout: 10000 })
    await wait(300)
    // Crop to just the question area (top 520px avoids excess empty space)
    await page.screenshot({ path: p('guide-02-guided-step1.png'), clip: { x: 0, y: 0, width: VIEWPORT.width, height: 520 } })

    // ── 3. Guided flow — results ────────────────────────────────────────────
    console.log('3/16 Guided flow — results')
    await page.getByRole('button', { name: /regular user/i }).click()
    await page.getByRole('button', { name: /relax.*unwind/i }).click()
    await page.getByRole('button', { name: /no preference/i }).click()
    await page.getByText('Our top picks for you').waitFor({ state: 'visible', timeout: 10000 })
    await wait(500)
    await page.screenshot({ path: p('guide-03-guided-results.png') })

    // ── 4. Product table (flower page) ──────────────────────────────────────
    console.log('4/16 Product table — flower')
    await page.goto(`${BASE}/flower`)
    await page.locator('table tbody tr').first().waitFor({ state: 'visible', timeout: 25000 })
    await wait(500)
    // Crop to top portion showing table header + first few rows + filters
    await page.screenshot({ path: p('guide-04-product-table.png'), clip: { x: 0, y: 0, width: VIEWPORT.width, height: 520 } })

    // ── 5. Product modal ────────────────────────────────────────────────────
    console.log('5/16 Product modal')
    await page.locator('table tbody tr').first().locator('td').nth(1).click()
    await page.getByRole('button', { name: 'Close' }).waitFor({ state: 'visible', timeout: 5000 })
    await wait(500)
    await page.screenshot({ path: p('guide-05-product-modal.png') })
    await page.getByRole('button', { name: 'Close' }).click()
    await wait(300)

    // ── 6. Search box filtering ─────────────────────────────────────────────
    console.log('6/16 Search filtering')
    await page.locator('input[placeholder]').first().fill('high hopes')
    await wait(800)
    // Crop to top portion showing search box + filtered results
    await page.screenshot({ path: p('guide-06-search.png'), clip: { x: 0, y: 0, width: VIEWPORT.width, height: 520 } })
    await page.locator('input[placeholder]').first().clear()
    await wait(300)

    // ── 7. Sort indicators ──────────────────────────────────────────────────
    console.log('7/16 Sorting')
    await page.locator('th', { hasText: 'Price' }).click()
    await wait(500)
    // Crop to top portion showing sorted column + Popularity button
    await page.screenshot({ path: p('guide-07-sorting.png'), clip: { x: 0, y: 0, width: VIEWPORT.width, height: 520 } })

    // ── 8. Filter panel ─────────────────────────────────────────────────────
    console.log('8/16 Filter panel')
    // Click a strain chip to show active filters
    const strainChip = page.locator('button', { hasText: /Indica|Sativa|Hybrid/i }).first()
    if (await strainChip.isVisible().catch(() => false)) {
      await strainChip.click()
      await wait(500)
    }
    // Crop to top portion showing filter panel with active filter
    await page.screenshot({ path: p('guide-08-filters.png'), clip: { x: 0, y: 0, width: VIEWPORT.width, height: 520 } })

    // ── 9. Cart with items ──────────────────────────────────────────────────
    console.log('9/16 Cart with items')
    // Reset filters first
    await page.goto(`${BASE}/flower`)
    await page.locator('table tbody tr').first().waitFor({ state: 'visible', timeout: 25000 })
    await wait(300)
    // Add two different items
    await page.locator('table tbody tr').nth(0).getByRole('button', { name: '+' }).click()
    await wait(1500) // cart animation
    await page.locator('table tbody tr').nth(1).getByRole('button', { name: '+' }).click()
    await wait(1500)
    await page.screenshot({ path: p('guide-09-cart.png') })

    // ── 10. Send to Budtender button ────────────────────────────────────────
    console.log('10/16 Send to Budtender button')
    const sendBtn = page.getByRole('button', { name: 'Send to Budtender' })
    await sendBtn.waitFor({ state: 'visible', timeout: 5000 })
    // Scroll to make the button prominent
    await sendBtn.scrollIntoViewIfNeeded()
    await wait(300)
    // Clip screenshot to the cart area at the bottom
    const cartPanel = page.locator('[data-cart-list]').locator('..')
    if (await cartPanel.isVisible().catch(() => false)) {
      await cartPanel.screenshot({ path: p('guide-10-send-button.png') })
    } else {
      await page.screenshot({ path: p('guide-10-send-button.png') })
    }

    // ── 11. Deal buttons (if any active) ────────────────────────────────────
    console.log('11/16 Deal buttons')
    let hasDealScreenshots = false
    for (const route of ['/edibles', '/flower', '/pre-rolls', '/vapes']) {
      await page.goto(`${BASE}${route}`)
      await page.locator('table tbody tr').first().waitFor({ state: 'visible', timeout: 25000 })
      await wait(500)
      if (await page.locator('.bg-amber-50').count() > 0) {
        const promos = page.locator('.mb-4:has(.bg-amber-50)')
        await promos.first().screenshot({ path: p('guide-11-deal-buttons.png') })

        // ── 12. Deal modal ──────────────────────────────────────────────────
        console.log('12/16 Deal modal')
        const dealButton = page.locator('.bg-amber-50', { hasText: '›' }).first()
        await dealButton.click()
        await wait(500)
        const modal = page.locator('.fixed.inset-0.z-50 .bg-white')
        await modal.waitFor({ state: 'visible', timeout: 5000 })
        await modal.screenshot({ path: p('guide-12-deal-modal.png') })
        await page.keyboard.press('Escape')
        await wait(300)
        hasDealScreenshots = true
        break
      }
    }
    if (!hasDealScreenshots) {
      console.log('  WARNING: No deal buttons visible — skipping shots 11-12')
    }

    // ── 13. Budtender page with orders ──────────────────────────────────────
    console.log('13/16 Budtender page')
    // Create fake orders so the page isn't empty (use budtender-screenshot prefix — not filtered)
    const fakeSessionId = `budtender-screenshot-${Date.now()}`
    await context.request.post(`${BASE}/api/session`, {
      data: {
        sessionId: fakeSessionId,
        selections: {
          'demo-sku-1': { name: 'Happy Valley | Super Lemon Haze', qty: 1, price: 40, unitWeight: '1/8oz', category: 'FLOWER' },
          'demo-sku-2': { name: 'Mindy\'s | Lush Black Cherry 1:1 | 20pack', qty: 2, price: 20, unitWeight: '100mg', category: 'EDIBLES' },
        },
      },
    })
    // Create a second order and submit it to mark as ready
    const readySessionId = `budtender-screenshot-ready-${Date.now()}`
    await context.request.post(`${BASE}/api/session`, {
      data: {
        sessionId: readySessionId,
        selections: {
          'demo-sku-3': { name: 'Coast | Cranberry Pomegranate 1:1:1', qty: 1, price: 24, unitWeight: '100mg', category: 'EDIBLES' },
        },
      },
    })
    await context.request.post(`${BASE}/api/session/${readySessionId}/submit`)

    await page.goto(`${BASE}/budtender`)
    // Wait for orders to appear
    await page.locator('[data-session-id]').first().waitFor({ state: 'visible', timeout: 10000 })
    await wait(1000)
    await page.screenshot({ path: p('guide-13-budtender.png') })

    // ── 14. QR code close-up ────────────────────────────────────────────────
    console.log('14/16 QR code')
    const orderCard = page.locator('[data-session-id]').first()
    await orderCard.screenshot({ path: p('guide-14-order-card.png') })

    // Clean up fake sessions
    await context.request.delete(`${BASE}/api/session/${fakeSessionId}`)
    await context.request.delete(`${BASE}/api/session/${readySessionId}`)

    // ── 15. Navbar ──────────────────────────────────────────────────────────
    console.log('15/16 Navbar with cart badge')
    await page.goto(`${BASE}/flower`)
    await page.locator('table tbody tr').first().waitFor({ state: 'visible', timeout: 25000 })
    await page.locator('table tbody tr').nth(0).getByRole('button', { name: '+' }).click()
    await wait(1500)
    const navbar = page.locator('nav').first()
    await navbar.screenshot({ path: p('guide-15-navbar.png') })

    // ── 16. Subcategory tabs ────────────────────────────────────────────────
    console.log('16/16 Subcategory tabs')
    await page.goto(`${BASE}/edibles`)
    await page.locator('table tbody tr').first().waitFor({ state: 'visible', timeout: 25000 })
    await wait(500)
    // Capture the top portion showing the tabs
    const tabsRow = page.locator('[role="tablist"]').first()
    if (await tabsRow.isVisible().catch(() => false)) {
      await tabsRow.screenshot({ path: p('guide-16-subcategory-tabs.png') })
    } else {
      // Fallback: just grab top of page
      await page.screenshot({ path: p('guide-16-subcategory-tabs.png'), clip: { x: 0, y: 0, width: 1180, height: 200 } })
    }

    console.log(`\nDone! Screenshots saved to ${OUT}`)
  } finally {
    await browser.close()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
