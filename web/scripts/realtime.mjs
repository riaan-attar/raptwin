/**
 * Measures end-to-end realtime latency: mutates twin state via the API and
 * times how long the browser UI takes to reflect it.
 */
import puppeteer from 'puppeteer'

const UI = process.env.UI_BASE ?? 'http://localhost:5173'
const API = process.env.DT_API ?? 'http://127.0.0.1:8080'

const observe = (body) =>
  fetch(`${API}/observe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1600, height: 1200 })

const problems = []
page.on('console', (m) => {
  if (m.type() === 'error') problems.push(`[console.error] ${m.text()}`)
})
page.on('pageerror', (e) => problems.push(`[pageerror] ${e.message}`))

await page.goto(UI, { waitUntil: 'networkidle2' })
await page.waitForSelector('svg g.nodes g', { timeout: 20000 })

// Confirm the header reports a live stream rather than polling.
await page.waitForFunction(() => /live stream/.test(document.body.innerText), { timeout: 15000 })
console.log('• SSE stream reported live in the UI')

const downCount = () =>
  page.evaluate(
    () =>
      [...document.querySelectorAll('svg g.nodes g circle.node-core')].filter(
        (c) => c.getAttribute('fill') === '#e74c3c',
      ).length,
  )

const before = await downCount()
console.log(`• nodes rendered down before: ${before}`)

// Mark a node down and time until the graph paints it red.
const t0 = Date.now()
await observe({
  action: 'apply',
  payload: { type: 'node', node: 'grig-001', changes: { down: true } },
})
await page.waitForFunction(
  (baseline) =>
    [...document.querySelectorAll('svg g.nodes g circle.node-core')].filter(
      (c) => c.getAttribute('fill') === '#e74c3c',
    ).length > baseline,
  { timeout: 15000 },
  before,
)
const applyMs = Date.now() - t0
console.log(`• DOWN reflected in UI after ${applyMs} ms`)

// Revert and time the recovery.
const t1 = Date.now()
await observe({
  action: 'revert',
  payload: { type: 'node', node: 'grig-001', fields: ['down'] },
})
await page.waitForFunction(
  (baseline) =>
    [...document.querySelectorAll('svg g.nodes g circle.node-core')].filter(
      (c) => c.getAttribute('fill') === '#e74c3c',
    ).length <= baseline,
  { timeout: 15000 },
  before,
)
const revertMs = Date.now() - t1
console.log(`• recovery reflected in UI after ${revertMs} ms`)

// Count how many network requests the page makes while idle.
let requests = 0
page.on('request', (r) => {
  if (r.url().includes('/api/')) requests++
})
await new Promise((r) => setTimeout(r, 10000))
console.log(`• idle /api requests over 10s: ${requests} (polling would be ~15)`)

await page.screenshot({ path: '/tmp/shots/realtime.png', fullPage: false })

console.log(
  `\nRESULT apply=${applyMs}ms revert=${revertMs}ms idleRequests=${requests}`,
)
if (problems.length) {
  console.log('--- PAGE PROBLEMS ---')
  for (const p of [...new Set(problems)]) console.log(p)
} else {
  console.log('No console/page errors.')
}

await browser.close()
