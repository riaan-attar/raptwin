/**
 * Checks the header "Restart" button: it must demand the typed word "confirm", do
 * nothing on Cancel, and wipe reservations, faults and plan history when confirmed.
 *
 *   UI_BASE=http://localhost:5181 node scripts/restart.mjs
 *
 * DESTRUCTIVE: restarts whatever twin the UI points at. Use a scratch twin.
 */
import puppeteer from 'puppeteer'

const BASE = process.env.UI_BASE ?? 'http://localhost:5181'
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] })
const page = await browser.newPage()
await page.setViewport({ width: 1500, height: 1100 })

const problems = []
const failures = []
let checks = 0
let expect400 = false
page.on('console', (m) => {
  if (m.type() !== 'error') return
  if (expect400 && m.text().includes('400')) return // the deliberate probe of the server-side check
  problems.push(`console: ${m.text()}`)
})
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function check(name, ok, detail = '') {
  checks++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
  if (!ok) failures.push(name)
}
async function until(fn, label, timeout = 10000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeout) {
    if (await fn()) return true
    await sleep(150)
  }
  console.log(`  (timed out waiting for: ${label})`)
  return false
}
const api = (path, init) =>
  page.evaluate(
    async (p, i) => {
      const r = await fetch(`/api${p}`, i)
      return { status: r.status, body: await r.json().catch(() => null) }
    },
    path,
    init,
  )
const post = (path, body) =>
  api(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

const btn = (label) =>
  page.evaluate((text) => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === text)
    return b ? { disabled: b.disabled } : null
  }, label)
const press = (label) =>
  page.evaluate((text) => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === text && !x.disabled)
    if (!b) return false
    b.click()
    return true
  }, label)

await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' })
await page.waitForSelector('section tbody tr')

// ---- make the twin dirty: a committed plan, a down node, a derate
const snap = (await api('/snapshot')).body.data
const nodeName = snap.nodes[0].name
const job = {
  id: 'restart-e2e',
  deadline_ms: 60000,
  stages: [{ id: 's1', type: 'io', size_mb: 10, resources: { cpu_cores: 1, mem_gb: 1 }, allowed_formats: ['native'] }],
}
const planned = (await post('/plan', { job, dry_run: false })).body.data
const reservedOn = planned.reservations?.[0]?.node
check('setup: a plan is committed with a reservation', Boolean(reservedOn))
await post('/observe', { action: 'apply', payload: { type: 'node', node: nodeName, changes: { down: true, thermal_derate: 0.5 } } })

const state = async () => {
  const s = (await api('/snapshot')).body.data
  const plans = (await api('/plans')).body.data
  return {
    reservations: s.nodes.reduce((n, x) => n + Object.keys(x.dyn?.reservations ?? {}).length, 0),
    down: s.nodes.filter((x) => x.dyn?.down).length,
    derated: s.nodes.filter((x) => (x.dyn?.thermal_derate ?? 0) > 0).length,
    plans: plans.length,
  }
}
const dirty = await state()
check('setup: twin has reservations, a down node, a derate and plan history', dirty.reservations > 0 && dirty.down > 0 && dirty.derated > 0 && dirty.plans > 0, JSON.stringify(dirty))
await page.reload({ waitUntil: 'networkidle2' })
await page.waitForSelector('section tbody tr')

// ---- the dialog gates on the typed word
check('header has a Restart button', (await btn('Restart')) !== null)
await press('Restart')
await page.waitForSelector('[role=dialog]')
check('dialog opens with Restart twin disabled', (await btn('Restart twin'))?.disabled === true)

const input = 'input[aria-label="Type confirm to confirm"]'
await page.type(input, 'confirmx')
check('wrong text keeps it disabled', (await btn('Restart twin'))?.disabled === true)
await page.click(input, { clickCount: 3 })
await page.type(input, 'conf')
check('partial text keeps it disabled', (await btn('Restart twin'))?.disabled === true)

// ---- Cancel does nothing
await press('Cancel')
await sleep(300)
check('Cancel closes the dialog', (await page.$('[role=dialog]')) === null)
const afterCancel = await state()
check('Cancel leaves the twin untouched', JSON.stringify(afterCancel) === JSON.stringify(dirty), JSON.stringify(afterCancel))

// ---- Escape also closes it
await press('Restart')
await page.waitForSelector('[role=dialog]')
await page.keyboard.press('Escape')
await sleep(300)
check('Escape closes the dialog', (await page.$('[role=dialog]')) === null)

// ---- the real thing (typed in different case, to check it is tolerant)
await press('Restart')
await page.waitForSelector('[role=dialog]')
await page.type(input, 'CONFIRM')
check('typing confirm (any case) enables the button', (await btn('Restart twin'))?.disabled === false)
await press('Restart twin')
check(
  'dialog closes and a result note appears',
  await until(
    async () =>
      (await page.$('[role=dialog]')) === null &&
      (await page.evaluate(() => document.body.textContent.includes('Twin restarted'))),
    'restart note',
  ),
)
const clean = await state()
check('restart wiped reservations, faults and plan history', clean.reservations === 0 && clean.down === 0 && clean.derated === 0 && clean.plans === 0, JSON.stringify(clean))
const events = (await api('/events?limit=50')).body.data.events.map((e) => e.type)
check('the restart is recorded as an event', events.includes('fabric.twin.restarted'))
check(
  'dashboard shows the clean state (no DOWN badges)',
  await until(async () => !(await page.evaluate(() => document.body.textContent.includes('DOWN'))), 'no DOWN badge'),
)
const after = await post('/plan', { job, dry_run: true })
check('planning still works after a restart', after.status === 200 && !after.body.data.infeasible)

// ---- the server enforces the phrase too
expect400 = true
const bare = await post('/twin/restart', {})
check('server rejects a restart without the phrase', bare.status === 400, `status ${bare.status}`)

await browser.close()
console.log(`\n${checks - failures.length}/${checks} checks passed`)
if (problems.length) console.log('PROBLEMS:\n' + problems.join('\n'))
else console.log('No console errors, page errors, or failed requests.')
process.exit(failures.length || problems.length ? 1 : 0)
