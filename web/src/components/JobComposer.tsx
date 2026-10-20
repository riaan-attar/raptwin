import { useEffect, useMemo, useState } from 'react'
import { useJobs, usePlanBatch, usePlanJob, useRunSettings } from '../api/hooks'
import { STRATEGIES, type Job, type Strategy } from '../api/types'
import { makeDemoJob } from '../lib/demoJob'
import { cn, fmtLatency } from '../lib/format'
import { Button, Card, Mono } from './ui/primitives'

const PICK_KEY = 'raptwin.catalog-pick'

/** Which catalog file to show and which jobs are ticked for batch planning; a per-browser convenience. */
function loadPick(): { file: string; excluded: string[] } {
  try {
    const v = JSON.parse(localStorage.getItem(PICK_KEY) ?? '{}') as { file?: unknown; excluded?: unknown }
    return {
      file: typeof v.file === 'string' ? v.file : '',
      excluded: Array.isArray(v.excluded) ? v.excluded.filter((x): x is string => typeof x === 'string') : [],
    }
  } catch {
    return { file: '', excluded: [] }
  }
}

export function JobComposer() {
  const jobs = useJobs()
  const planJob = usePlanJob()
  const planBatch = usePlanBatch()

  const [selected, setSelected] = useState(0)
  const [pick, setPick] = useState(loadPick)
  const [strategy, setStrategy] = useState<Strategy>('greedy')
  const [dryRun, setDryRun] = useState(true)
  const [runFor, setRunFor] = useState('')
  const settings = useRunSettings()
  const [editor, setEditor] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const catalog = useMemo(() => jobs.data ?? [], [jobs.data])
  const entry = catalog[selected]

  const files = useMemo(() => {
    const counts = new Map<string, number>()
    for (const c of catalog) counts.set(c.file, (counts.get(c.file) ?? 0) + 1)
    return [...counts.entries()]
  }, [catalog])
  // A remembered file that no longer exists falls back to "all" instead of an empty list.
  const fileFilter = files.some(([f]) => f === pick.file) ? pick.file : ''
  const visible = useMemo(
    () => catalog.map((item, idx) => ({ item, idx })).filter(({ item }) => !fileFilter || item.file === fileFilter),
    [catalog, fileFilter],
  )
  const excluded = useMemo(() => new Set(pick.excluded), [pick.excluded])
  const included = visible.filter(({ item }) => !excluded.has(item.id))

  function updatePick(next: { file: string; excluded: string[] }) {
    setPick(next)
    try {
      localStorage.setItem(PICK_KEY, JSON.stringify(next))
    } catch {
      /* private window or blocked storage: the choice just won't be remembered */
    }
  }
  const setIncluded = (ids: string[], on: boolean) =>
    updatePick({
      file: fileFilter,
      excluded: on ? pick.excluded.filter((x) => !ids.includes(x)) : [...new Set([...pick.excluded, ...ids])],
    })

  // Seed the editor with the first catalog entry once it loads.
  useEffect(() => {
    if (!editor && catalog.length > 0) {
      setEditor(JSON.stringify(catalog[0].job, null, 2))
    }
  }, [catalog, editor])

  const busy = planJob.isPending || planBatch.isPending

  function parseEditor(): Job | null {
    try {
      const parsed = JSON.parse(editor) as Job
      if (!parsed || !Array.isArray(parsed.stages) || parsed.stages.length === 0) {
        setError('Job must include a non-empty "stages" array.')
        return null
      }
      setError(null)
      return parsed
    } catch (e) {
      setError(`Invalid JSON: ${(e as Error).message}`)
      return null
    }
  }

  /** Blank means "use the job's own duration_s, else the default". */
  const durationS = runFor.trim() === '' ? undefined : Number(runFor)

  async function submit(job: Job, label: string) {
    setNotice(null)
    setError(null)
    try {
      const res = await planJob.mutateAsync({ job, strategy, dryRun, durationS })
      setNotice(
        res.infeasible
          ? `${label}: planner reported INFEASIBLE${res.reason ? ` (${res.reason})` : ''}`
          : `${label}: ${res.job_id} placed in ${fmtLatency(res.latency_ms)} ms${
              res.run ? ` · run started, frees its reservations in ${Math.round(res.run.duration_s)} s (see Events & Jobs)` : ''
            }`,
      )
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <Card
      title="Plan a Job"
      subtitle="Submits to the DT API /plan endpoint with the selected policy"
      actions={
        <>
          <label className="flex cursor-pointer items-center gap-1.5 text-sm text-muted">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              className="accent-accent"
            />
            Dry run
          </label>
          {!dryRun && (
            <label className="flex items-center gap-1.5 text-sm text-muted">
              Run for
              <input
                type="number"
                min={1}
                max={86400}
                step="any"
                value={runFor}
                onChange={(e) => setRunFor(e.target.value)}
                placeholder={String(settings.data?.default_duration_s ?? 30)}
                aria-label="Run duration in seconds"
                className="w-16 rounded-lg border border-edge-2 bg-[var(--color-input-bg)] px-2 py-1 text-sm outline-none focus:border-[var(--color-input-focus-border)]"
              />
              s
            </label>
          )}
          <select
            value={strategy}
            onChange={(e) => setStrategy(e.target.value as Strategy)}
            className="rounded-lg border border-edge-2 bg-[var(--color-input-bg)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--color-input-focus-border)]"
          >
            {STRATEGIES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <Button
            variant="primary"
            disabled={busy}
            onClick={() => {
              const job = parseEditor()
              if (job) void submit(job, 'Planned')
            }}
          >
            {busy ? 'Planning…' : 'Plan'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(180px,240px)_1fr]">
        <div className="flex min-w-0 flex-col gap-2">
          <select
            value={fileFilter}
            onChange={(e) => updatePick({ file: e.target.value, excluded: pick.excluded })}
            aria-label="Catalog file"
            className="rounded-lg border border-edge-2 bg-[var(--color-input-bg)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--color-input-focus-border)]"
          >
            <option value="">All catalogs ({catalog.length})</option>
            {files.map(([f, n]) => (
              <option key={f} value={f}>
                {f} ({n})
              </option>
            ))}
          </select>
          <div className="text-[11px] text-muted-2">
            {included.length} of {visible.length} ticked for batch
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              className="px-2 py-1 text-xs"
              disabled={included.length === visible.length}
              onClick={() => setIncluded(visible.map(({ item }) => item.id), true)}
            >
              Select all
            </Button>
            <Button
              className="px-2 py-1 text-xs"
              disabled={included.length === 0}
              onClick={() => setIncluded(visible.map(({ item }) => item.id), false)}
            >
              Select none
            </Button>
          </div>
        <div className="max-h-64 overflow-auto rounded-[10px] border border-[var(--color-panel2-border)] bg-panel-2 p-2">
          {jobs.isLoading && <p className="p-2 text-xs text-muted-2">Loading job library…</p>}
          {!jobs.isLoading && catalog.length === 0 && (
            <p className="p-2 text-xs text-muted-2">
              No job YAMLs found. Drop files into <Mono>jobs/</Mono>.
            </p>
          )}
          {visible.map(({ item, idx }) => (
            <div key={`${item.file}#${item.index}`} className="mb-1.5 flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={!excluded.has(item.id)}
                onChange={(e) => setIncluded([item.id], e.target.checked)}
                aria-label={`Include ${item.id} in batch`}
                className="h-4 w-4 shrink-0 cursor-pointer accent-[var(--color-accent-strong)]"
              />
              <button
                onClick={() => {
                  setSelected(idx)
                  setEditor(JSON.stringify(item.job, null, 2))
                }}
                className={cn(
                  'min-w-0 flex-1 cursor-pointer rounded-lg border px-2.5 py-1.5 text-left text-sm transition-colors',
                  idx === selected
                    ? 'border-[var(--color-chip-info-border)] bg-[var(--color-chip-info-bg)] text-[var(--color-chip-info-text)]'
                    : 'border-[var(--color-chip2-border)] bg-[var(--color-chip2-bg)] text-[var(--color-chip2-text)] hover:border-[var(--color-btn-border-hover)]',
                )}
              >
                <div className="truncate font-medium">{item.id}</div>
                <div className="truncate text-[11px] text-muted-2">
                  {item.file} · {item.job.stages?.length ?? 0} stages
                </div>
              </button>
            </div>
          ))}
        </div>
        </div>

        <div className="flex flex-col gap-2">
          {entry && (
            <div className="flex flex-wrap gap-1.5 text-[11px] text-muted-2">
              <span className="rounded-lg border border-[var(--color-pill-border)] bg-[var(--color-pill-bg)] px-2 py-1">
                {entry.job.stages?.length ?? 0} stages
              </span>
              {entry.job.deadline_ms != null && (
                <span className="rounded-lg border border-[var(--color-pill-border)] bg-[var(--color-pill-bg)] px-2 py-1">
                  deadline {entry.job.deadline_ms} ms
                </span>
              )}
              {entry.job.redundancy != null && (
                <span className="rounded-lg border border-[var(--color-pill-border)] bg-[var(--color-pill-bg)] px-2 py-1">
                  redundancy {entry.job.redundancy}
                </span>
              )}
            </div>
          )}

          <textarea
            value={editor}
            onChange={(e) => setEditor(e.target.value)}
            rows={12}
            spellCheck={false}
            placeholder="Paste or edit the job JSON here…"
            className="w-full rounded-lg border border-edge-2 bg-[var(--color-input-bg)] p-3 font-mono text-xs leading-relaxed text-[var(--color-code-text)] outline-none focus:border-[var(--color-input-focus-border)]"
          />

          <div className="flex flex-wrap gap-2">
            <Button
              variant="good"
              disabled={busy}
              onClick={() => {
                const job = makeDemoJob()
                setEditor(JSON.stringify(job, null, 2))
                void submit(job, 'Demo')
              }}
            >
              Run demo job
            </Button>
            <Button
              disabled={busy || included.length === 0}
              onClick={async () => {
                setNotice(null)
                setError(null)
                try {
                  const res = await planBatch.mutateAsync({
                    jobs: included.map(({ item }) => item.job),
                    strategy,
                    dryRun,
                    durationS,
                  })
                  const bad = res.results.filter((r) => r.infeasible).length
                  setNotice(
                    `Planned ${res.results.length} jobs · ${res.results.length - bad} feasible, ${bad} infeasible`,
                  )
                } catch (e) {
                  setError((e as Error).message)
                }
              }}
            >
              Plan {included.length === visible.length && !fileFilter ? 'entire catalog' : `${included.length} ticked job${included.length === 1 ? '' : 's'}`}
            </Button>
            <Button variant="ghost" onClick={() => setEditor('')}>
              Clear
            </Button>
          </div>

          {dryRun && (
            <p className="text-[11px] text-muted-2">
              Dry run previews a plan without reserving capacity — CPU usage on Overview and
              Topology won't change until you uncheck "Dry run" above and submit.
            </p>
          )}

          {error && (
            <p className="rounded-lg border border-[var(--color-chip-danger-border)] bg-[var(--color-chip-danger-bg)] px-3 py-2 text-xs text-[var(--color-chip-danger-text)]">
              {error}
            </p>
          )}
          {notice && !error && (
            <p className="rounded-lg border border-[var(--color-chip-success-border)] bg-[var(--color-chip-success-bg)] px-3 py-2 text-xs text-[var(--color-chip-success-text)]">
              {notice}
            </p>
          )}
        </div>
      </div>
    </Card>
  )
}
