/**
 * Headless UI check: loads the dashboard, waits for live data, optionally runs
 * an interaction, then writes a screenshot and reports console/page errors.
 *
 *   node scripts/shoot.mjs <out.png> [urlPath] [waitSelector]
 */
import puppeteer from 'puppeteer'

const out = process.argv[2] ?? '/tmp/shots/dash.png'
const path = process.argv[3] ?? '/'
const waitFor = process.argv[4] ?? null
const BASE = process.env.UI_BASE ?? 'http://localhost:5173'

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})

const page = await browser.newPage()
await page.setViewport({ width: 1600, height: 1200, deviceScaleFactor: 1 })

const problems = []
page.on('console', (msg) => {
  if (msg.type() === 'error' || msg.type() === 'warning') {
    problems.push(`[console.${msg.type()}] ${msg.text()}`)
  }
})
page.on('pageerror', (err) => problems.push(`[pageerror] ${err.message}`))
page.on('requestfailed', (req) =>
  problems.push(`[requestfailed] ${req.url()} ${req.failure()?.errorText ?? ''}`),
)

await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle2', timeout: 30000 })

if (waitFor) {
  try {
    await page.waitForSelector(waitFor, { timeout: 15000 })
  } catch {
    problems.push(`[wait] selector never appeared: ${waitFor}`)
  }
}

// Let the force layout settle so the topology isn't caught mid-flight.
await new Promise((r) => setTimeout(r, 3500))

await page.screenshot({ path: out, fullPage: true })

const summary = await page.evaluate(() => {
  const text = (sel) => document.querySelector(sel)?.textContent?.trim() ?? null
  return {
    header: text('header p'),
    kpis: [...document.querySelectorAll('section div.rounded-\\[10px\\]')]
      .slice(0, 12)
      .map((el) => el.textContent?.trim()),
    svgNodes: document.querySelectorAll('svg g.nodes > g').length,
    svgLinks: document.querySelectorAll('svg g.links > line').length,
    tableRows: document.querySelectorAll('tbody tr').length,
  }
})

console.log(JSON.stringify(summary, null, 2))
if (problems.length) {
  console.log('\n--- PAGE PROBLEMS ---')
  for (const p of [...new Set(problems)].slice(0, 25)) console.log(p)
} else {
  console.log('\nNo console errors, page errors, or failed requests.')
}

await browser.close()
