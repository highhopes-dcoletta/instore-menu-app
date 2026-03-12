/**
 * Markdown-to-PDF converter using Pandoc (HTML) + Playwright (PDF).
 *
 * Usage: node scripts/screenshots/md-to-pdf.js <input.md> [output.pdf]
 *
 * Converts markdown to styled HTML via pandoc, then prints to PDF via
 * Playwright's Chromium. Images are resolved relative to the project root.
 */

const { chromium } = require('playwright')
const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

const ROOT = path.resolve(__dirname, '../..')
const input = process.argv[2]
if (!input) {
  console.error('Usage: node md-to-pdf.js <input.md> [output.pdf]')
  process.exit(1)
}

const inputPath = path.resolve(ROOT, input)
const outputPath = process.argv[3]
  ? path.resolve(ROOT, process.argv[3])
  : inputPath.replace(/\.md$/, '.pdf')

const CSS = `
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    font-size: 13px;
    line-height: 1.5;
    color: #1a1a1a;
    max-width: 720px;
    margin: 0 auto;
    padding: 20px 30px;
  }
  h1 { font-size: 22px; margin-top: 0; }
  h2 { font-size: 17px; margin-top: 20px; border-bottom: 1px solid #ddd; padding-bottom: 4px; break-after: avoid; }
  h3 { font-size: 14px; margin-top: 14px; break-after: avoid; }
  img { max-width: 85%; border-radius: 8px; border: 1px solid #e0e0e0; margin: 4px 0; }
  figure { margin: 4px 0; }
  figcaption { display: none; }
  hr { border: none; border-top: 1px solid #eee; margin: 16px 0; }
  table { border-collapse: collapse; width: 100%; margin: 10px 0; font-size: 12px; break-inside: avoid; }
  th, td { border: 1px solid #ddd; padding: 6px 10px; text-align: left; }
  th { background: #f5f5f5; font-weight: 600; }
  blockquote { color: #666; border-left: 3px solid #ddd; margin: 10px 0; padding: 4px 12px; font-size: 11px; }
  code { background: #f5f5f5; padding: 1px 4px; border-radius: 3px; font-size: 12px; }
  strong { font-weight: 600; }
  li { margin-bottom: 2px; }
  p { margin: 6px 0; }
  /* Avoid orphaned headings at bottom of page */
  h2, h3 { orphans: 3; widows: 3; }
`

async function main() {
  // Convert markdown to HTML fragment via pandoc
  const html = execSync(
    `pandoc "${inputPath}" -t html5 --wrap=none`,
    { encoding: 'utf8' }
  )

  // Wrap in a full document with styling
  const fullHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>${CSS}</style></head>
<body>${html}</body></html>`

  // Write to a temp file so Playwright can load it with file:// (for image paths)
  const tmpHtml = path.join(ROOT, '.tmp-guide.html')
  fs.writeFileSync(tmpHtml, fullHtml)

  const browser = await chromium.launch()
  const page = await browser.newPage()
  await page.goto(`file://${tmpHtml}`, { waitUntil: 'networkidle' })

  // Prevent page breaks between a screenshot and the text that follows it:
  // add break-after:avoid to each <figure> so it stays with the next element
  await page.evaluate(() => {
    document.querySelectorAll('figure').forEach(fig => {
      const next = fig.nextElementSibling
      if (next && next.tagName !== 'FIGURE') {
        fig.style.breakAfter = 'avoid'
      }
    })
  })

  await page.pdf({
    path: outputPath,
    format: 'Letter',
    margin: { top: '0.5in', bottom: '0.5in', left: '0.5in', right: '0.5in' },
    printBackground: true,
  })
  await browser.close()
  fs.unlinkSync(tmpHtml)

  console.log(`PDF saved to ${outputPath}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
