/**
 * Drives the bulk select / filter / fault-injection UI in a real browser and asserts
 * the twin's state changes, then undoes everything it did.
 *
 *   UI_BASE=http://localhost:5180 node scripts/bulk.mjs [out-dir]
 *
 * DESTRUCTIVE: it takes nodes and links down and deletes two throwaway nodes it
 * creates. Point it at a scratch twin (a copy of the repo with its own `dt.api`
 * and a Vite started with FABRIC_DT_REMOTE pointing at it), never at a twin you
 * are using.
 */
import puppeteer from 'puppeteer'

const BASE = process.env.UI_BASE ?? 'http://localhost:5180'
const OUT = process.argv[2] ?? '/tmp/bulk-shots'

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] })
const page = await browser.newPage()
await page.setViewport({ width: 1600, height: 1400 })

const problems = []
const failures = []
let checks = 0
let expect404 = false
page.on('console', (m) => {
  if (m.type() !== 'error') return
  if (expect404 && m.text().includes('404')) return // probing that a deleted node is gone
  problems.push(`console: ${m.text()}`)
})
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
page.on('dialog', (d) => d.accept())

function check(name, ok, detail = '') {
  checks++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
  if (!ok) failures.push(name)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function until(fn, label, timeout = 10000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeout) {
    if (await fn()) return true
    await sleep(150)
  }
  console.log(`  (timed out waiting for: ${label})`)
  return false
}

// A card is a <section> whose <h2> is exactly `title`.
const inCard = (title, fn, ...args) =>
  page.evaluate(
    (t, src, a) => {
      const sec = [...document.querySelectorAll('section')].find(
        (s) => s.querySelector('h2')?.textContent.trim() === t,
      )
      if (!sec) return null
      // eslint-disable-next-line no-new-func
      return new Function('sec', 'args', `return (${src})(sec, ...args)`)(sec, a)
    },
    title,
    fn.toString(),
    args,
  )

const rows = (title) =>
  inCard(title, (sec) =>
    [...sec.querySelectorAll('tbody tr')]
      .filter((tr) => tr.querySelector('input[type=checkbox]'))
      .map((tr) => {
        const cells = [...tr.querySelectorAll('td')].map((td) => td.textContent.trim())
        return { id: cells[1] ?? '', cells, text: tr.textContent }
      }),
  )

const tick = (title, n) =>
  inCard(title, (sec, count) => {
    const boxes = [...sec.querySelectorAll('tbody input[type=checkbox]')].slice(0, count)
    boxes.forEach((b) => b.click())
    return boxes.length
  }, n)

const click = (title, text) =>
  inCard(title, (sec, label) => {
    const btn = [...sec.querySelectorAll('button')].find((b) => b.textContent.trim() === label && !b.disabled)
    if (!btn) return false
    btn.click()
    return true
  }, text)

const barText = (title) => inCard(title, (sec) => sec.querySelector('[class*="sticky"]')?.textContent ?? '')
const noticeText = (title) => inCard(title, (sec) => sec.querySelector('[role=status],[role=alert]')?.textContent ?? '')

async function setSelect(title, labelStart, value) {
  const handle = await page.evaluateHandle(
    (t, ls) => {
      const sec = [...document.querySelectorAll('section')].find((s) => s.querySelector('h2')?.textContent.trim() === t)
      const label = [...sec.querySelectorAll('label')].find((l) => l.textContent.trim().startsWith(ls))
      return label?.querySelector('select')
    },
    title,
    labelStart,
  )
  await handle.asElement().select(value)
}

async function api(path, init) {
  return page.evaluate(
    async (p, i) => {
      const r = await fetch(`/api${p}`, i)
      return { status: r.status, body: await r.json().catch(() => null) }
    },
    path,
    init,
  )
}

await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' })
await page.waitForSelector('section tbody tr input[type=checkbox]')

// ---------------------------------------------------------------- nodes: down / undo
const nodesBefore = await rows('Nodes')
const firstThree = nodesBefore.slice(0, 3).map((r) => r.id)
check('nodes table has a checkbox column and rows', nodesBefore.length >= 3, `${nodesBefore.length} rows`)

await tick('Nodes', 3)
check('bulk bar shows the selection', (await barText('Nodes')).includes('3 nodes selected'))

await click('Nodes', 'Take down')
check(
  'Take down marks the 3 selected nodes DOWN',
  await until(async () => (await rows('Nodes')).slice(0, 3).every((r) => r.text.includes('DOWN')), 'DOWN badges'),
)
const downNames = (await rows('Nodes')).filter((r) => r.text.includes('DOWN')).map((r) => r.id)
check(
  'only the selected nodes went down',
  downNames.length === 3 && firstThree.every((n) => downNames.some((d) => d.startsWith(n))),
  downNames.join(', '),
)

// filter + hidden-by-filter count
await setSelect('Nodes', 'Status', 'up')
await sleep(300)
check(
  'selection survives a filter and reports hidden rows',
  (await barText('Nodes')).includes('3 hidden by the current filter'),
  (await barText('Nodes')).slice(0, 80),
)
check('status filter hides the down nodes', (await rows('Nodes')).every((r) => !r.text.includes('DOWN')))
await setSelect('Nodes', 'Status', 'down')
await sleep(300)
check('status=Down filter lists exactly the 3 down nodes', (await rows('Nodes')).length === 3)
await setSelect('Nodes', 'Status', '')

await click('Nodes', 'Undo')
check(
  'Undo brings them back up',
  await until(async () => (await rows('Nodes')).every((r) => !r.text.includes('DOWN')), 'no DOWN'),
)

// ---------------------------------------------------------------- nodes: max out / relieve
await click('Nodes', 'Max out resources')
// Nodes: cells = [box, name, arch, CPU free/max, mem, vram, health]
const zeroFree = (r) => /^0\.00\s*\//.test(r.cells[3] ?? '')
check(
  'Max out leaves the selected nodes with 0 free CPU',
  await until(async () => (await rows('Nodes')).slice(0, 3).every(zeroFree), 'free CPU 0'),
)
await click('Nodes', 'Undo')
check(
  'Undo restores free CPU',
  await until(async () => (await rows('Nodes')).slice(0, 3).every((r) => !zeroFree(r)), 'free CPU back'),
)

// ---------------------------------------------------------------- bulk bar clear
await click('Nodes', 'Clear')
check('Clear empties the selection', !(await barText('Nodes')).includes('selected'))

// ---------------------------------------------------------------- federations
const fedsBefore = await rows('Federations')
check('federations table has rows', fedsBefore.length >= 2, `${fedsBefore.length}`)
// Federations: cells = [box, name, load, down / total, ...]
const allDown = (r) => {
  const m = (r.cells[3] ?? '').match(/^(\d+)\s*\/\s*(\d+)$/)
  return Boolean(m) && m[1] === m[2] && Number(m[2]) > 0
}
await tick('Federations', 2)
check('federation bulk bar counts member nodes', /acts on \d+ nodes/.test(await barText('Federations')))
await click('Federations', 'Take down')
check(
  'bulk Take down downs every node in both selected federations',
  await until(async () => (await rows('Federations')).slice(0, 2).every(allDown), 'federations all down'),
)
await click('Federations', 'Undo')
check(
  'Undo restores the federations',
  await until(async () => (await rows('Federations')).every((r) => !allDown(r)), 'federations restored'),
)
await click('Federations', 'Clear')

// per-row zone action (retry: the button is disabled while a previous bulk request is still running)
const rowButton = (label) =>
  inCard('Federations', (sec, text) => {
    const btn = [...sec.querySelectorAll('tbody tr')[0].querySelectorAll('button')].find(
      (b) => b.textContent.trim() === text && !b.disabled,
    )
    if (!btn) return false
    btn.click()
    return true
  }, label)

await until(() => rowButton('Take down'), 'first-row Take down enabled')
check(
  'per-row "Take down" downs a whole federation',
  await until(async () => allDown((await rows('Federations'))[0]), 'first federation down'),
)
await until(() => rowButton('Bring up'), 'first-row Bring up enabled')
check(
  'per-row "Bring up" restores it',
  await until(async () => !allDown((await rows('Federations'))[0]), 'first federation up'),
)

// ---------------------------------------------------------------- links
const linksBefore = await rows('Links')
check('links table has rows', linksBefore.length >= 2, `${linksBefore.length}`)
await tick('Links', 2)
await click('Links', 'Degrade')
check(
  'Degrade (12% loss) marks the selected links DEGRADED',
  await until(async () => (await rows('Links')).slice(0, 2).every((r) => r.text.includes('DEGRADED')), 'DEGRADED'),
)
await setSelect('Links', 'Status', 'degraded')
await sleep(300)
check('status=Degraded filter lists them', (await rows('Links')).length >= 2)
await setSelect('Links', 'Status', '')
await click('Links', 'Restore all fields')
check(
  'Restore clears the degradation',
  await until(async () => (await rows('Links')).slice(0, 2).every((r) => !r.text.includes('DEGRADED')), 'restored'),
)
await click('Links', 'Take down')
check(
  'link Take down marks them DOWN',
  await until(async () => (await rows('Links')).slice(0, 2).every((r) => r.text.includes('DOWN')), 'links DOWN'),
)
await click('Links', 'Undo')
check(
  'link Undo brings them back',
  await until(async () => (await rows('Links')).slice(0, 2).every((r) => !r.text.includes('DOWN')), 'links up'),
)

// ---------------------------------------------------------------- federation links
const fl = await rows('Federation Links')
if (fl.length) {
  await tick('Federation Links', 1)
  await click('Federation Links', 'Take down')
  check(
    'federation-link Take down applies to the underlying links',
    await until(async () => /applied to [1-9]/.test(await noticeText('Federation Links')), 'fed link notice'),
    await noticeText('Federation Links'),
  )
  await click('Federation Links', 'Undo')
  await sleep(500)
} else {
  console.log('SKIP  federation links: none in the snapshot (they appear when links span federations)')
}

// ---------------------------------------------------------------- nodes tab: delete selected
await page.goto(`${BASE}/#nodes`, { waitUntil: 'networkidle2' })
await page.waitForSelector('section tbody input[type=checkbox]')
const donor = (await api('/snapshot')).body.data.nodes[0].name
const desc = (await api(`/nodes/${donor}`)).body.data
for (const name of ['zz-bulk-test-1', 'zz-bulk-test-2']) {
  const r = await api('/add_node', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ node: { ...desc, name }, persist: true }),
  })
  if (r.status !== 200) console.log(`  add_node ${name} -> ${r.status}`)
}
await page.reload({ waitUntil: 'networkidle2' })
await page.waitForSelector('input[aria-label="Search nodes"]')
await page.type('input[aria-label="Search nodes"]', 'zz-bulk-test')
await sleep(500)
check('Nodes tab search narrows to the 2 throwaway nodes', (await rows('Nodes')).length === 2)
await page.click('input[aria-label="Select all visible rows"]')
check('header checkbox selects every visible row', (await barText('Nodes')).includes('2 nodes selected'))
await click('Nodes', 'Delete selected')
expect404 = true
check(
  'Delete selected removes them',
  await until(async () => (await api('/nodes/zz-bulk-test-1')).status === 404, 'node deleted'),
)
check(
  'second node deleted too',
  await until(async () => (await api('/nodes/zz-bulk-test-2')).status === 404, 'second node deleted'),
)

await sleep(300)
await page.screenshot({ path: `${OUT}-nodes-tab.png` }).catch(() => {})
await browser.close()

console.log(`\n${checks - failures.length}/${checks} checks passed`)
if (problems.length) console.log('PROBLEMS:\n' + problems.join('\n'))
else console.log('No console errors, page errors, or failed requests.')
process.exit(failures.length || problems.length ? 1 : 0)
