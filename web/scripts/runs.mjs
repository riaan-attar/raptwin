/**
 * Drives the Events & Jobs tab: a committed plan starts a timed run, the timer frees the
 * reservations, and the controls (extend, finish, cancel, bulk, settings) and event filters work.
 *
 *   UI_BASE=http://localhost:5185 node scripts/runs.mjs [screenshot-prefix]
 *
 * DESTRUCTIVE: commits plans and changes run settings on whatever twin the UI points at.
 * Use a scratch twin.
 */
import puppeteer from 'puppeteer'

const BASE = process.env.UI_BASE ?? 'http://localhost:5185'
const SHOT = process.argv[2]
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] })
const page = await browser.newPage()
await page.setViewport({ width: 1500, height: 1200 })

const problems = []
const failures = []
let expectErrors = false
page.on('console', (m) => {
  if (m.type() !== 'error') return
  if (expectErrors) return // deliberate bad requests
  problems.push(`console: ${m.text()}`)
})
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
page.on('dialog', (d) => void d.accept())

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
  if (!ok) failures.push(name)
}
async function until(fn, label, timeout = 12000) {
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
  api(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) })
const press = (label, scope = 'document') =>
  page.evaluate(
    (text) => {
      const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === text && !x.disabled)
      if (!b) return false
      b.click()
      return true
    },
    label,
  )
const text = () => page.evaluate(() => document.body.innerText)
const job = (id, cpu = 1) => ({
  id,
  deadline_ms: 9000,
  stages: [{ id: 's1', type: 'io', size_mb: 10, resources: { cpu_cores: cpu, mem_gb: 1 }, allowed_formats: ['native'] }],
})
const commit = (id, duration_s) => post('/plan', { job: job(id), strategy: 'greedy', dry_run: false, duration_s })
const runs = async (state = 'all') => (await api(`/runs?state=${state}`)).body.data
const used = async () => {
  const nodes = (await api('/snapshot')).body.data.nodes
  return nodes.reduce((a, n) => a + (n.dyn?.used_cpu_cores ?? 0), 0)
}

await page.goto(`${BASE}/#events`, { waitUntil: 'load' })
await page.waitForFunction(() => document.body.innerText.includes('Job timer'), { timeout: 15000 })
await post('/runs/finish_all')
await post('/runs/settings', { auto_release: true, default_duration_s: 30 })
await page.reload({ waitUntil: 'load' })
await page.waitForFunction(() => document.body.innerText.includes('Job timer'), { timeout: 15000 })

check('Events & Jobs tab renders', (await text()).includes('Job timer') && (await text()).includes('Twin events'))
check('Jobs tab renamed Job Library', (await text()).includes('Job Library'))

// 1. a committed plan appears and completes on its own
const r1 = await commit('e2e-timer', 4)
check('commit returns a run', r1.body?.data?.run?.duration_s === 4, JSON.stringify(r1.body?.data?.run))
const id1 = r1.body.data.run.run_id
check('run card appears', await until(async () => (await text()).includes('e2e-timer'), 'card'))
check('stage timeline shown', await until(async () => /\b(active|pending|done)\b/.test(await text()) && (await text()).includes('s1'), 'timeline', 4000))
check('reservations held while running', (await runs('running')).reserved_by_running > 0)
check('run completes on its own', await until(async () => (await api(`/runs/${id1}`)).body.data.state === 'completed', 'timer', 15000))
const done = (await api(`/runs/${id1}`)).body.data
check('end reason is timer and reservations released', done.end_reason === 'timer' && done.released > 0, `${done.end_reason}/${done.released}`)
check('nothing held after completion', (await runs('running')).reserved_by_running === 0)
check('card moved to Recent runs', await until(async () => (await text()).includes('Recent runs') && !(await text()).includes('Finish now'), 'history'))

// 2. extend and finish now from the UI
const r2 = await commit('e2e-extend', 20)
const id2 = r2.body.data.run.run_id
await until(async () => (await text()).includes('e2e-extend'), 'card2')
check('+1 min extends', (await until(async () => press('+1 min'), '+1 min')) && (await until(async () => (await api(`/runs/${id2}`)).body.data.duration_s >= 80, 'extended')))
check('Finish now ends it', (await until(async () => press('Finish now'), 'finish btn')) && (await until(async () => (await api(`/runs/${id2}`)).body.data.state === 'completed', 'finished')))
check('manual reason recorded', (await api(`/runs/${id2}`)).body.data.end_reason === 'manual')

// 3. set timer shortens
const r3 = await commit('e2e-set', 60)
const id3 = r3.body.data.run.run_id
await until(async () => (await text()).includes('e2e-set'), 'card3')
await until(async () => press('Set timer…'), 'set timer')
await page.waitForSelector('input[placeholder="seconds left"]')
await page.focus('input[placeholder="seconds left"]')
await page.keyboard.down('Control')
await page.keyboard.press('KeyA')
await page.keyboard.up('Control')
await page.type('input[placeholder="seconds left"]', '3')
await press('Apply')
check('set timer shortens the run', await until(async () => (await api(`/runs/${id3}`)).body.data.state === 'completed', 'shortened', 12000))

// 4. cancel
const r4 = await commit('e2e-cancel', 60)
const id4 = r4.body.data.run.run_id
await until(async () => (await text()).includes('e2e-cancel'), 'card4')
await until(async () => press('Cancel'), 'cancel btn')
check('cancel frees the run', await until(async () => (await api(`/runs/${id4}`)).body.data.state === 'cancelled', 'cancelled'))

// 5. bulk finish
const ids = []
for (const n of ['bulk-a', 'bulk-b', 'bulk-c']) ids.push((await commit(n, 60)).body.data.run.run_id)
await until(async () => (await text()).includes('bulk-c'), 'bulk cards')
for (const id of ids.slice(0, 2)) await page.click(`input[aria-label="Select ${id}"]`)
check('bulk bar shows count', await until(async () => (await text()).includes('2 jobs selected') || (await text()).includes('2 runs selected'), 'bar'))
await until(async () => press('Finish selected'), 'finish selected')
check('selected runs finished, the other still running', await until(async () => {
  const a = await Promise.all(ids.map(async (i) => (await api(`/runs/${i}`)).body.data.state))
  return a[0] === 'completed' && a[1] === 'completed' && a[2] === 'running'
}, 'bulk'))
await until(async () => press('Finish all'), 'finish all')
check('Finish all leaves none running', await until(async () => (await runs('running')).runs.length === 0, 'none running'))

// 6. auto-release off holds reservations
await page.click('input[type="checkbox"]:not([aria-label])').catch(() => {})
const off = await until(async () => (await api('/runs/settings')).body.data.auto_release === false, 'switch off', 4000)
check('auto-release switch turns it off', off)
const base6 = await used()
const r6 = await commit('e2e-hold', 2)
check('no run when off, reservations held', r6.body.data.run == null && (await used()) > base6)
await sleep(3000)
check('still held after a few seconds', (await used()) > base6)
const before = (await used()) - base6
await post('/twin/restart', { confirm: 'confirm' })
check('restart clears held reservations', before > 0 && (await used()) <= base6)
await post('/runs/settings', { auto_release: true })

// 7. validation
expectErrors = true
check('bad duration rejected', (await commit('e2e-bad', -5)).status === 400)
check('unknown run is 404', (await api('/runs/run-999999')).status === 404)
expectErrors = false
const r7 = await commit('e2e-twice', 30)
await post(`/runs/${r7.body.data.run.run_id}/finish`)
expectErrors = true
check('finishing a finished run is 409', (await post(`/runs/${r7.body.data.run.run_id}/finish`)).status === 409)
expectErrors = false

// 8. events explorer
await page.reload({ waitUntil: 'load' })
await page.waitForFunction(() => document.body.innerText.includes('Twin events'), { timeout: 15000 })
check('run events in the feed', await until(async () => (await text()).includes('run.completed'), 'run events'))
const chips = await page.evaluate(() => [...document.querySelectorAll('button[aria-pressed]')].map((b) => b.textContent.trim()))
check('family chips present', chips.some((c) => c.startsWith('run')) && chips.some((c) => c.startsWith('plan')), chips.join(','))
await page.evaluate(() => [...document.querySelectorAll('button[aria-pressed]')].find((b) => b.textContent.trim().startsWith('run'))?.click())
check('family filter keeps only run events', await until(async () => {
  const rows = await page.evaluate(() => [...document.querySelectorAll('li button[aria-expanded]')].map((b) => b.getAttribute('aria-label')))
  return rows.length > 0 && rows.every((r) => r.includes('.run.'))
}, 'filter'))
await page.type('input[aria-label="Search events"]', id1)
check('search narrows to one run', await until(async () => {
  const n = await page.evaluate(() => document.querySelectorAll('li button[aria-expanded]').length)
  return n > 0 && n <= 4
}, 'search'))
await page.click('li button[aria-expanded]')
check('expanding shows the raw CloudEvent', await until(async () => (await text()).includes('"specversion"') || (await text()).includes('"type": "fabric.run'), 'raw'))
await press('Pause')
check('pause toggles to Resume', await until(async () => (await text()).includes('paused'), 'paused', 3000))
await press('Resume')
if (SHOT) await page.screenshot({ path: `${SHOT}.png`, fullPage: true })

check('no console or page errors', problems.length === 0, problems.join(' | '))
await browser.close()
console.log(failures.length ? `\n${failures.length} FAILED: ${failures.join(', ')}` : '\nall passed')
process.exit(failures.length ? 1 : 0)
