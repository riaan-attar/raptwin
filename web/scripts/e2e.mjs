/**
 * Drives the real UI in a headless browser: loads the dashboard, submits the
 * demo job through the actual button, and verifies the plan lands in the
 * Recent Plans table and Plan Detail panel.
 */
import puppeteer from 'puppeteer'

const BASE = process.env.UI_BASE ?? 'http://localhost:5173'
const out = process.argv[2] ?? '/tmp/shots/e2e.png'

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

const step = (msg) => console.log(`• ${msg}`)

await page.goto(BASE, { waitUntil: 'networkidle2' })
await page.waitForSelector('svg g.nodes g', { timeout: 15000 })
step('dashboard loaded with topology')

// Wait for the job catalog to populate the composer.
await page.waitForFunction(
  () => document.body.innerText.includes('job-vision-small'),
  { timeout: 15000 },
)
step('job catalog loaded')

const planCountBefore = await page.evaluate(() => {
  const txt = [...document.querySelectorAll('section')].find((s) =>
    s.textContent?.includes('Recent Plans'),
  )?.textContent
  return txt?.includes('No plans yet') ? 0 : -1
})

// Click "Run demo job" by its label.
const clicked = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find(
    (b) => b.textContent?.trim() === 'Run demo job',
  )
  if (!btn) return false
  btn.click()
  return true
})
if (!clicked) throw new Error('Could not find the "Run demo job" button')
step('clicked "Run demo job"')

await page.waitForFunction(
  () => /placed in|INFEASIBLE/.test(document.body.innerText),
  { timeout: 20000 },
)
const notice = await page.evaluate(() => {
  const m = document.body.innerText.match(/(Demo: .*|Planned: .*)/)
  return m ? m[1] : null
})
step(`planner responded: ${notice}`)

// Give the polling loop a beat to refresh plans + topology highlighting.
await new Promise((r) => setTimeout(r, 3000))

const result = await page.evaluate(() => {
  const sectionText = (title) =>
    [...document.querySelectorAll('section')]
      .find((s) => s.querySelector('h2')?.textContent === title)
      ?.textContent ?? ''
  return {
    recentPlansHasDemo: /demo-\d+/.test(sectionText('Recent Plans')),
    planDetailHasDemo: /demo-\d+/.test(sectionText('Plan Detail')),
    planDetailStages: [...document.querySelectorAll('section')]
      .find((s) => s.querySelector('h2')?.textContent === 'Plan Detail')
      ?.querySelectorAll('.min-w-\\[170px\\]').length,
    assignmentRings: [...document.querySelectorAll('svg g.nodes g circle.node-ring')].filter(
      (c) => c.style.display !== 'none',
    ).length,
  }
})

await page.screenshot({ path: out, fullPage: true })
console.log(JSON.stringify(result, null, 2))

if (problems.length) {
  console.log('\n--- PAGE PROBLEMS ---')
  for (const p of [...new Set(problems)]) console.log(p)
} else {
  console.log('\nNo console/page errors.')
}

await browser.close()
