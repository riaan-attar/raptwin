import { useMemo, useState } from 'react'
import { useDeleteJob, useJobs, usePlanBatch, usePlanJob, useSaveJob } from '../../api/hooks'
import { STRATEGIES, WORKLOAD_FORMATS, type Job, type JobCatalogEntry, type JobStage } from '../../api/types'
import { NAME_RE } from '../../lib/descriptor'
import { useCatalogPick } from '../../lib/useCatalogPick'
import { cn, fmtMs } from '../../lib/format'
import { Button, Card, Field, Mono, Notice, NumberInput, inputCls } from '../ui/primitives'

type Selection = { kind: 'existing'; id: string } | { kind: 'new' } | null
type JobNotice = { tone: 'ok' | 'err'; text: string } | null

function blankJob(existing: Set<string>): Job {
  let id = 'job-new'
  for (let i = 2; existing.has(id); i++) id = `job-new-${i}`
  return {
    id,
    deadline_ms: 5000,
    stages: [
      {
        id: 's1',
        type: 'io',
        size_mb: 50,
        resources: { cpu_cores: 1, mem_gb: 1 },
        allowed_formats: ['native', 'wasm'],
      },
    ],
  }
}

export function JobManager() {
  const jobs = useJobs()
  const [selection, setSelection] = useState<Selection>(null)
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState<JobNotice>(null)
  const planBatch = usePlanBatch()
  const [batchStrategy, setBatchStrategy] = useState<(typeof STRATEGIES)[number]['value']>('greedy')
  const [batchDry, setBatchDry] = useState(true)

  const catalog = useMemo(() => jobs.data ?? [], [jobs.data])
  const ids = useMemo(() => new Set(catalog.map((e) => e.id)), [catalog])
  const { files, fileFilter, visible, included, excluded, setFile, setIncluded } = useCatalogPick(catalog)
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? visible.filter(({ item }) => `${item.id} ${item.file}`.toLowerCase().includes(q)) : visible
  }, [visible, query])

  async function planCatalog() {
    setNotice(null)
    try {
      const res = await planBatch.mutateAsync({
        jobs: included.map(({ item }) => item.job),
        strategy: batchStrategy,
        dryRun: batchDry,
      })
      const bad = res.results.filter((r) => r.infeasible).length
      setNotice({
        tone: bad ? 'err' : 'ok',
        text: `Planned ${res.results.length} jobs (${batchDry ? 'dry run' : 'committed'}) · ${res.results.length - bad} feasible, ${bad} infeasible`,
      })
    } catch (e) {
      setNotice({ tone: 'err', text: (e as Error).message })
    }
  }

  const current: JobCatalogEntry | undefined =
    selection?.kind === 'existing' ? catalog.find((e) => e.id === selection.id) : undefined
  const missing = selection?.kind === 'existing' && !current
  // Just-saved job not in the refetched catalog yet vs. deleted elsewhere.
  const waitingForCatalog = missing && jobs.isFetching
  const effectiveSelection = missing ? null : selection

  return (
    <Card
      title="Jobs"
      subtitle="Job library under jobs/*.yaml — used by the planner and the Dashboard composer"
      actions={
        <>
          <select
            value={batchStrategy}
            onChange={(e) => setBatchStrategy(e.target.value as typeof batchStrategy)}
            className={inputCls}
            aria-label="Strategy for catalog planning"
          >
            {STRATEGIES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-sm text-muted">
            <input type="checkbox" checked={batchDry} onChange={(e) => setBatchDry(e.target.checked)} className="accent-accent" />
            Dry run
          </label>
          <Button disabled={planBatch.isPending || included.length === 0} onClick={() => void planCatalog()}>
            {planBatch.isPending
              ? 'Planning…'
              : included.length === visible.length && !fileFilter
                ? 'Plan entire catalog'
                : `Plan ${included.length} ticked job${included.length === 1 ? '' : 's'}`}
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              setNotice(null)
              setSelection({ kind: 'new' })
            }}
          >
            + New job
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(200px,260px)_1fr]">
        <div className="flex min-w-0 flex-col gap-2">
          <select
            value={fileFilter}
            onChange={(e) => setFile(e.target.value)}
            aria-label="Catalog file"
            className={inputCls}
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
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search jobs…"
            aria-label="Search jobs"
            className={inputCls}
          />
          <Button
            variant="ghost"
            className="self-start px-2 py-1 text-xs"
            disabled={!query && !fileFilter}
            onClick={() => {
              setQuery('')
              setFile('')
            }}
          >
            Reset filter
          </Button>
          <div className="max-h-[560px] overflow-auto rounded-[10px] border border-[var(--color-panel2-border)] bg-panel-2 p-2">
            {jobs.isLoading && <p className="p-2 text-xs text-muted-2">Loading job library…</p>}
            {!jobs.isLoading && filtered.length === 0 && (
              <p className="p-2 text-xs text-muted-2">No jobs found.</p>
            )}
            {filtered.map(({ item: entry }) => {
              const active = effectiveSelection?.kind === 'existing' && effectiveSelection.id === entry.id
              return (
                <div key={`${entry.file}#${entry.index}`} className="mb-1.5 flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={!excluded.has(entry.id)}
                    onChange={(e) => setIncluded([entry.id], e.target.checked)}
                    aria-label={`Include ${entry.id} in batch`}
                    className="h-4 w-4 shrink-0 cursor-pointer accent-[var(--color-accent-strong)]"
                  />
                  <button
                    onClick={() => {
                      setNotice(null)
                      setSelection({ kind: 'existing', id: entry.id })
                    }}
                    className={cn(
                      'min-w-0 flex-1 cursor-pointer rounded-lg border px-2.5 py-1.5 text-left text-sm transition-colors',
                      active
                        ? 'border-[var(--color-chip-info-border)] bg-[var(--color-chip-info-bg)] text-[var(--color-chip-info-text)]'
                        : 'border-[var(--color-chip2-border)] bg-[var(--color-chip2-bg)] text-[var(--color-chip2-text)] hover:border-[var(--color-btn-border-hover)]',
                    )}
                  >
                    <div className="truncate font-semibold">{entry.id}</div>
                    <div className="truncate text-[11px] text-muted-2">
                      {entry.file} · {entry.job.stages?.length ?? 0} stages
                    </div>
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          {notice && (
            <Notice tone={notice.tone} onDismiss={() => setNotice(null)}>
              {notice.text}
            </Notice>
          )}
          {waitingForCatalog ? (
            <p className="p-4 text-sm text-muted-2">Refreshing job library…</p>
          ) : effectiveSelection === null ? (
            <div className="flex h-full min-h-48 items-center justify-center rounded-[10px] border border-dashed border-edge-2 p-6 text-center text-sm text-muted-2">
              Pick a job to edit it, or create a new one.
            </div>
          ) : (
            <JobEditor
              // Remount per job so the draft resets cleanly.
              key={effectiveSelection.kind === 'new' ? '__new__' : `${current?.file}:${current?.id}`}
              entry={current}
              initial={current ? current.job : blankJob(ids)}
              existingIds={ids}
              files={files.map(([f]) => f)}
              defaultFile={fileFilter}
              setNotice={setNotice}
              onSaved={(id) => setSelection({ kind: 'existing', id })}
              onDeleted={() => setSelection(null)}
            />
          )}
        </div>
      </div>
    </Card>
  )
}

function JobEditor({
  entry,
  initial,
  existingIds,
  files,
  defaultFile,
  setNotice,
  onSaved,
  onDeleted,
}: {
  entry?: JobCatalogEntry
  initial: Job
  existingIds: Set<string>
  files: string[]
  defaultFile: string
  setNotice: (notice: JobNotice) => void
  onSaved: (id: string) => void
  onDeleted: () => void
}) {
  const save = useSaveJob()
  const del = useDeleteJob()
  const plan = usePlanJob()
  const [draft, setDraft] = useState<Job>(() => structuredClone(initial))
  const [mode, setMode] = useState<'form' | 'json'>('form')
  const [jsonText, setJsonText] = useState('')
  // '' saves a new job as its own jobs/<id>.yaml; '__new__' asks for a file name.
  const [target, setTarget] = useState(defaultFile)
  const [newFile, setNewFile] = useState('')

  const originalId = entry?.id

  function parseJson(): Job | null {
    try {
      const parsed = JSON.parse(jsonText) as Job
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.stages)) {
        setNotice({ tone: 'err', text: 'A job must be an object with a "stages" array.' })
        return null
      }
      return parsed
    } catch (e) {
      setNotice({ tone: 'err', text: `Invalid JSON: ${(e as Error).message}` })
      return null
    }
  }

  function current(): Job | null {
    return mode === 'json' ? parseJson() : draft
  }

  function problem(job: Job): string | null {
    if (!NAME_RE.test(String(job.id ?? ''))) {
      return "Job id may only use letters, digits, '.', '_' and '-'."
    }
    if (job.id !== originalId && existingIds.has(String(job.id))) {
      return `A job with id ${job.id} already exists.`
    }
    if (!job.stages.length) return 'Add at least one stage.'
    const seen = new Set<string>()
    for (const [i, s] of job.stages.entries()) {
      if (!s.id?.trim()) return `Stage #${i + 1} needs an id.`
      if (seen.has(s.id)) return `Duplicate stage id ${s.id}.`
      seen.add(s.id)
    }
    return null
  }

  async function submit() {
    const job = current()
    if (!job) return
    const p = problem(job)
    if (p) return setNotice({ tone: 'err', text: p })
    try {
      const file = entry ? undefined : target === '__new__' ? newFile.trim() : target || undefined
      if (!entry && target === '__new__' && !file) return setNotice({ tone: 'err', text: 'Enter a file name for the new catalogue.' })
      const res = await save.mutateAsync({ job, originalId, file })
      setNotice({ tone: 'ok', text: `${res.created ? 'Created' : 'Saved'} ${res.id} in jobs/${res.file}.` })
      onSaved(res.id)
    } catch (e) {
      setNotice({ tone: 'err', text: (e as Error).message })
    }
  }

  async function remove() {
    if (!entry) return
    if (!window.confirm(`Delete job ${entry.id} from jobs/${entry.file}?`)) return
    try {
      await del.mutateAsync(entry.id)
      setNotice({ tone: 'ok', text: `Deleted ${entry.id}.` })
      onDeleted()
    } catch (e) {
      setNotice({ tone: 'err', text: (e as Error).message })
    }
  }

  async function dryRun() {
    const job = current()
    if (!job) return
    try {
      const res = await plan.mutateAsync({ job, strategy: 'greedy', dryRun: true })
      setNotice(
        res.infeasible
          ? { tone: 'err', text: `Dry run: infeasible${res.reason ? ` — ${res.reason}` : ''}` }
          : { tone: 'ok', text: `Dry run: fits, end-to-end ${fmtMs(res.latency_ms)} (greedy).` },
      )
    } catch (e) {
      setNotice({ tone: 'err', text: (e as Error).message })
    }
  }

  const setStage = (index: number, stage: JobStage) =>
    setDraft((d) => ({ ...d, stages: d.stages.map((s, i) => (i === index ? stage : s)) }))

  const moveStage = (index: number, dir: -1 | 1) =>
    setDraft((d) => {
      const stages = [...d.stages]
      const j = index + dir
      if (j < 0 || j >= stages.length) return d
      ;[stages[index], stages[j]] = [stages[j], stages[index]]
      return { ...d, stages }
    })

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-muted">
          {entry ? (
            <>
              Editing <Mono>{entry.id}</Mono> in <Mono>jobs/{entry.file}</Mono>
            </>
          ) : (
            <span className="flex flex-wrap items-center gap-2">
              New job — save to
              <select
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                aria-label="Save to catalogue"
                className={`${inputCls} w-auto`}
              >
                <option value="">its own file (jobs/&lt;id&gt;.yaml)</option>
                {files.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
                <option value="__new__">a new catalogue file…</option>
              </select>
              {target === '__new__' && (
                <input
                  value={newFile}
                  onChange={(e) => setNewFile(e.target.value)}
                  placeholder="my_jobs.yaml"
                  aria-label="New catalogue file name"
                  className={`${inputCls} w-40`}
                />
              )}
            </span>
          )}
        </div>
        <div className="inline-flex rounded-lg border border-edge-2 p-0.5" role="tablist">
          {(['form', 'json'] as const).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => {
                if (m === mode) return
                if (m === 'json') {
                  setJsonText(JSON.stringify(draft, null, 2))
                  setMode('json')
                } else {
                  const parsed = parseJson()
                  if (parsed) {
                    setDraft(parsed)
                    setMode('form')
                    setNotice(null)
                  }
                }
              }}
              className={cn(
                'cursor-pointer rounded-md px-3 py-1 text-xs font-semibold',
                mode === m ? 'bg-[var(--color-chip-info-bg)] text-[var(--color-chip-info-text)]' : 'text-muted hover:text-ink',
              )}
            >
              {m === 'form' ? 'Form' : 'JSON'}
            </button>
          ))}
        </div>
      </div>

      {mode === 'json' ? (
        <textarea
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          spellCheck={false}
          aria-label="Job JSON"
          className={`${inputCls} h-[26rem] resize-y font-mono text-xs leading-relaxed`}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Job id">
              <input
                className={inputCls}
                value={String(draft.id ?? '')}
                onChange={(e) => setDraft((d) => ({ ...d, id: e.target.value.trim() }))}
              />
            </Field>
            <Field label="Deadline (ms)">
              <NumberInput
                min={0}
                step={100}
                value={draft.deadline_ms}
                onChange={(v) => setDraft((d) => ({ ...d, deadline_ms: v }))}
              />
            </Field>
            <Field label="Redundancy" hint="Optional replica count">
              <NumberInput
                min={0}
                step={1}
                value={draft.redundancy}
                onChange={(v) => setDraft((d) => ({ ...d, redundancy: v }))}
              />
            </Field>
          </div>

          <div className="flex flex-col gap-2">
            {draft.stages.map((stage, i) => (
              <StageRow
                key={i}
                index={i}
                stage={stage}
                total={draft.stages.length}
                onChange={(s) => setStage(i, s)}
                onMove={(dir) => moveStage(i, dir)}
                onRemove={() =>
                  setDraft((d) => ({ ...d, stages: d.stages.filter((_, j) => j !== i) }))
                }
              />
            ))}
            <Button
              className="self-start"
              onClick={() =>
                setDraft((d) => ({
                  ...d,
                  stages: [
                    ...d.stages,
                    {
                      id: `s${d.stages.length + 1}`,
                      type: 'compute',
                      size_mb: 50,
                      resources: { cpu_cores: 1, mem_gb: 1 },
                      allowed_formats: ['native'],
                    },
                  ],
                }))
              }
            >
              + Add stage
            </Button>
          </div>
        </>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-edge pt-3">
        {entry && (
          <Button variant="bad" disabled={del.isPending} onClick={() => void remove()} className="mr-auto">
            Delete job
          </Button>
        )}
        <Button disabled={plan.isPending} onClick={() => void dryRun()}>
          {plan.isPending ? 'Checking…' : 'Test fit (dry run)'}
        </Button>
        <Button variant="primary" disabled={save.isPending} onClick={() => void submit()}>
          {save.isPending ? 'Saving…' : entry ? 'Save job' : 'Create job'}
        </Button>
      </div>
    </div>
  )
}

function StageRow({
  index,
  stage,
  total,
  onChange,
  onMove,
  onRemove,
}: {
  index: number
  stage: JobStage
  total: number
  onChange: (stage: JobStage) => void
  onMove: (dir: -1 | 1) => void
  onRemove: () => void
}) {
  const res = stage.resources ?? {}
  const setRes = (key: string, v: number | undefined) => {
    const next = { ...res }
    if (v === undefined) delete next[key]
    else next[key] = v
    onChange({ ...stage, resources: next })
  }
  const formats = new Set(stage.allowed_formats ?? [])

  return (
    <div className="rounded-[10px] border border-[var(--color-panel2-border)] bg-panel-2 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-label-text)]">
          Stage {index + 1}
        </span>
        <div className="flex gap-1">
          <Button variant="ghost" className="px-2 py-0.5 text-xs" disabled={index === 0} onClick={() => onMove(-1)} aria-label="Move stage up">
            ↑
          </Button>
          <Button
            variant="ghost"
            className="px-2 py-0.5 text-xs"
            disabled={index === total - 1}
            onClick={() => onMove(1)}
            aria-label="Move stage down"
          >
            ↓
          </Button>
          <Button variant="ghost" className="px-2 py-0.5 text-xs text-[var(--color-chip-danger-text)]" onClick={onRemove} aria-label="Remove stage">
            Remove
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Field label="Id">
          <input className={inputCls} value={stage.id} onChange={(e) => onChange({ ...stage, id: e.target.value })} />
        </Field>
        <Field label="Type">
          <input
            className={inputCls}
            value={stage.type ?? ''}
            onChange={(e) => onChange({ ...stage, type: e.target.value || undefined })}
          />
        </Field>
        <Field label="Size (MB)">
          <NumberInput min={0} value={stage.size_mb} onChange={(v) => onChange({ ...stage, size_mb: v })} />
        </Field>
        <Field label="CPU cores">
          <NumberInput min={0} value={res.cpu_cores} onChange={(v) => setRes('cpu_cores', v)} />
        </Field>
        <Field label="Memory (GB)">
          <NumberInput min={0} value={res.mem_gb} onChange={(v) => setRes('mem_gb', v)} />
        </Field>
        <Field label="VRAM (GB)">
          <NumberInput min={0} value={res.gpu_vram_gb} onChange={(v) => setRes('gpu_vram_gb', v)} />
        </Field>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[11px] text-muted-2">Allowed formats:</span>
        {WORKLOAD_FORMATS.map((f) => (
          <label
            key={f}
            className={cn(
              'flex cursor-pointer items-center gap-1 rounded-md border px-2 py-0.5 text-[11px]',
              formats.has(f) ? 'border-[var(--color-chip-info-border)] bg-[var(--color-chip-info-bg)] text-[var(--color-chip-info-text)]' : 'border-edge-2 text-muted',
            )}
          >
            <input
              type="checkbox"
              className="accent-accent"
              checked={formats.has(f)}
              onChange={(e) => {
                const next = new Set(formats)
                if (e.target.checked) next.add(f)
                else next.delete(f)
                onChange({ ...stage, allowed_formats: WORKLOAD_FORMATS.filter((x) => next.has(x)) })
              }}
            />
            {f}
          </label>
        ))}
      </div>
    </div>
  )
}
