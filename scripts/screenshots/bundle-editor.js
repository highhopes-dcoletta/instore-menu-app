/**
 * Bundle Editor Screenshot Generator
 *
 * Captures all screenshots used in the Bundle Editor user guide (BUNDLE-EDITOR-GUIDE.md).
 * Run via: npm run screenshots (from the monitor/ directory)
 *
 * Requires Playwright + Chromium installed (same as the e2e monitor).
 * Screenshots are saved to docs/screenshots/ with consistent filenames.
 */

const { chromium } = require('playwright')
const path = require('path')

const BASE = process.env.SCREENSHOT_BASE_URL ?? 'https://menu2-stage.highhopesma.com'
const OUT = path.resolve(__dirname, '../../docs/screenshots')

// iPad Air viewport (Safari)
const VIEWPORT = { width: 1180, height: 820 }

// Unique test bundle — uses timestamp in ID to avoid collision, but a
// recognizable label so the screenshots look realistic.
const SUFFIX = Date.now().toString().slice(-6)
const BUNDLE_ID = `screenshot-bundle-${SUFFIX}`
const BUNDLE_LABEL = `Screenshot Drinks Deal ${SUFFIX}`

// Helpers
const p = (f) => path.join(OUT, f)
const wait = (ms) => new Promise(r => setTimeout(r, ms))

async function main() {
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 })
  const page = await context.newPage()

  try {
    await cleanupScreenshotBundles(context)

    // ── 1. Bundles list page (full page) ──────────────────────────────────────
    console.log('1/11 Bundles list page')
    await page.goto(`${BASE}/bundles`)
    await page.waitForResponse(r => r.url().includes('/api/bundles'))
    await wait(500)
    await page.screenshot({ path: p('01-bundles-list.png'), fullPage: true })

    // ── 2. New bundle form (empty) ────────────────────────────────────────────
    console.log('2/11 New bundle form (empty)')
    await page.getByRole('button', { name: '+ New Bundle' }).click()
    await page.waitForSelector('h2:has-text("New Bundle")')
    await wait(300)
    const formModal = page.locator('.fixed.inset-0.z-50')
    await formModal.screenshot({ path: p('02-form-empty.png') })

    // ── 3. New bundle form (filled in with live preview) ──────────────────────
    console.log('3/11 New bundle form (filled in)')
    const form = page.locator('form')
    await form.locator('input').first().fill('Any 4 Drinks — $20')
    await form.locator('select').first().selectOption('Edibles')
    await form.locator('input[type="number"]').first().fill('4')
    await form.locator('input[type="number"]').nth(1).fill('20')
    await form.locator('select').nth(1).selectOption('DRINKS')
    await wait(500)
    await formModal.screenshot({ path: p('03-form-filled.png') })

    // ── 4. Match criteria close-up ────────────────────────────────────────────
    console.log('4/11 Match criteria section')
    const nameInput = form.locator('input[placeholder="e.g. juicy stickz"]')
    await nameInput.fill('high hopes')
    await nameInput.locator('..').getByRole('button', { name: 'Add' }).click()
    await wait(300)
    const criteriaSection = form.locator('.border-t.pt-5').first()
    await criteriaSection.screenshot({ path: p('04-match-criteria.png') })

    // ── 5. Schedule section ───────────────────────────────────────────────────
    console.log('5/11 Schedule section')
    await form.getByRole('button', { name: 'Mon' }).click()
    await form.getByRole('button', { name: 'Wed' }).click()
    await form.getByRole('button', { name: 'Fri' }).click()
    const dateInput = form.locator('input[placeholder="Day of month"]')
    await dateInput.fill('10')
    await dateInput.locator('..').getByRole('button', { name: 'Add' }).click()
    await dateInput.fill('15')
    await dateInput.locator('..').getByRole('button', { name: 'Add' }).click()
    await wait(300)
    const scheduleSection = form.locator('text=Schedule (leave empty for always-on)').locator('..')
    await scheduleSection.screenshot({ path: p('05-schedule.png') })

    // Cancel form — we'll create via API for cleaner card shots
    await form.getByRole('button', { name: 'Cancel' }).click()
    await wait(300)

    // ── Create test bundle via API ────────────────────────────────────────────
    await context.request.post(`${BASE}/api/bundles`, {
      data: {
        id: BUNDLE_ID,
        label: BUNDLE_LABEL,
        type: 'quantity',
        displayCategory: 'Edibles',
        quantity: 4,
        bundlePrice: 20,
        scheduleDays: [1, 3, 5],
        scheduleDates: [10, 15],
        matchCriteria: { subcategoryEquals: 'DRINKS' },
        enabled: true,
      },
    })

    // ── 6. Bundle card close-up ───────────────────────────────────────────────
    console.log('6/11 Bundle card close-up')
    await page.goto(`${BASE}/bundles`)
    await page.waitForResponse(r => r.url().includes('/api/bundles'))
    await wait(500)
    const card = page.locator('.rounded-xl.border', { hasText: BUNDLE_LABEL })
    await card.waitFor({ state: 'visible', timeout: 10000 })
    await card.screenshot({ path: p('06-bundle-card.png') })

    // ── 7. Disabled bundle ────────────────────────────────────────────────────
    console.log('7/11 Disabled bundle')
    await card.locator('button[title="Disable"]').click({ force: true })
    await wait(800)
    // Re-query after DOM update
    const disabledCard = page.locator('.rounded-xl.border.opacity-60', { hasText: BUNDLE_LABEL })
    await disabledCard.waitFor({ state: 'visible', timeout: 10000 })
    await disabledCard.screenshot({ path: p('07-disabled-bundle.png') })

    // Re-enable via API
    const getRes = await context.request.fetch(`${BASE}/api/bundles?includeDisabled=1`)
    const allBundles = await getRes.json()
    const testBundle = allBundles.find(b => b.id === BUNDLE_ID)
    await context.request.put(`${BASE}/api/bundles/${BUNDLE_ID}`, {
      data: { ...testBundle, enabled: true },
    })

    // ── 8. Delete confirmation ────────────────────────────────────────────────
    console.log('8/11 Delete confirmation')
    await page.goto(`${BASE}/bundles`)
    await page.waitForResponse(r => r.url().includes('/api/bundles'))
    await wait(500)
    const deleteCard = page.locator('.rounded-xl.border', { hasText: BUNDLE_LABEL })
    await deleteCard.waitFor({ state: 'visible', timeout: 10000 })
    await deleteCard.getByRole('button', { name: 'Delete' }).click()
    await wait(300)
    await deleteCard.screenshot({ path: p('08-delete-confirm.png') })
    await deleteCard.getByRole('button', { name: 'Cancel' }).click()

    // ── 9. Customer deal buttons ──────────────────────────────────────────────
    console.log('9/11 Customer deal buttons')
    // Our test bundle may not be active today (schedule), so look for any deal buttons
    let dealPage = null
    for (const route of ['/edibles', '/flower', '/pre-rolls', '/vapes']) {
      await page.goto(`${BASE}${route}`)
      await page.locator('table tbody tr').first().waitFor({ state: 'visible', timeout: 25000 })
      await wait(500)
      if (await page.locator('.bg-amber-50').count() > 0) {
        dealPage = route
        break
      }
    }
    if (dealPage) {
      const promos = page.locator('.mb-4:has(.bg-amber-50)')
      await promos.first().screenshot({ path: p('09-deal-buttons.png') })

      // ── 10. Deal modal (in progress) ────────────────────────────────────────
      console.log('10/11 Deal modal')
      const dealButton = page.locator('.bg-amber-50', { hasText: '›' }).first()
      await dealButton.click()
      await wait(500)
      const modal = page.locator('.fixed.inset-0.z-50 .bg-white')
      await modal.waitFor({ state: 'visible', timeout: 5000 })
      // Add one item to show partial progress
      const plusBtn = modal.locator('button:has-text("+")').first()
      if (await plusBtn.isVisible()) {
        await plusBtn.click()
        await wait(300)
      }
      await modal.screenshot({ path: p('10-deal-modal.png') })

      // ── 11. Deal unlocked ───────────────────────────────────────────────────
      console.log('11/11 Deal unlocked')
      const pickBtn = modal.locator('button:has-text("Pick for me")')
      if (await pickBtn.isVisible().catch(() => false)) {
        await pickBtn.click()
        await wait(1500) // let fireworks render
        await modal.screenshot({ path: p('11-deal-unlocked.png') })
      } else {
        console.log('  WARNING: No "Pick for me" button — skipping shot 11')
      }
      await modal.locator('button:has-text("Done")').click()
    } else {
      console.log('  WARNING: No deal buttons visible on any page — skipping shots 9-11')
    }

    console.log(`\nDone! Screenshots saved to ${OUT}`)
  } finally {
    await cleanupScreenshotBundles(context)
    await browser.close()
  }
}

async function cleanupScreenshotBundles(context) {
  try {
    const res = await context.request.fetch(`${BASE}/api/bundles?includeDisabled=1`)
    if (res.ok()) {
      const bundles = await res.json()
      for (const b of bundles) {
        if (b.id.startsWith('screenshot-bundle-')) {
          await context.request.delete(`${BASE}/api/bundles/${b.id}`)
        }
      }
    }
  } catch {}
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
