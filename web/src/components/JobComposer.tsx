import { useEffect, useMemo, useState } from 'react'
import { useJobs, usePlanBatch, usePlanJob } from '../api/hooks'
import { STRATEGIES, type Job, type Strategy } from '../api/types'
import { makeDemoJob } from '../lib/demoJob'
import { cn } from '../lib/format'
import { Button, Card, Mono } from './ui/primitives'

export function JobComposer() {
  const jobs = useJobs()
  const planJob = usePlanJob()
  const planBatch = usePlanBatch()

  const [selected, setSelected] = useState(0)
  const [strategy, setStrategy] = useState<Strategy>('greedy')
  const [dryRun, setDryRun] = useState(true)
  const [editor, setEditor] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const catalog = useMemo(() => jobs.data ?? [], [jobs.data])
  const entry = catalog[selected]

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

  async function submit(job: Job, label: string) {
    setNotice(null)
    setError(null)
    try {
      const res = await planJob.mutateAsync({ job, strategy, dryRun })
      setNotice(
        res.infeasible
          ? `${label}: planner reported INFEASIBLE${res.reason ? ` (${res.reason})` : ''}`
          : `${label}: ${res.job_id} placed in ${Number(res.latency_ms).toFixed(1)} ms`,
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
          <select
            value={strategy}
            onChange={(e) => setStrategy(e.target.value as Strategy)}
            className="rounded-lg border border-edge-2 bg-[#0e1420] px-2.5 py-1.5 text-sm outline-none focus:border-[#3a5575]"
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
        <div className="max-h-64 overflow-auto rounded-[10px] border border-[#1f2b3b] bg-panel-2 p-2">
          {jobs.isLoading && <p className="p-2 text-xs text-muted-2">Loading job library…</p>}
          {!jobs.isLoading && catalog.length === 0 && (
            <p className="p-2 text-xs text-muted-2">
              No job YAMLs found. Drop files into <Mono>jobs/</Mono>.
            </p>
          )}
          {catalog.map((item, idx) => (
            <button
              key={`${item.file}#${item.index}`}
              onClick={() => {
                setSelected(idx)
                setEditor(JSON.stringify(item.job, null, 2))
              }}
              className={cn(
                'mb-1.5 w-full cursor-pointer rounded-lg border px-2.5 py-1.5 text-left text-sm transition-colors',
                idx === selected
                  ? 'border-[#2c5b86] bg-[#13314d] text-[#cfe7ff]'
                  : 'border-[#2d3f57] bg-[#172235] text-[#b6cae4] hover:border-[#3f5876]',
              )}
            >
              <div className="truncate font-medium">{item.id}</div>
              <div className="truncate text-[11px] text-muted-2">{item.file}</div>
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          {entry && (
            <div className="flex flex-wrap gap-1.5 text-[11px] text-muted-2">
              <span className="rounded-lg border border-[#253248] bg-[#162031] px-2 py-1">
                {entry.job.stages?.length ?? 0} stages
              </span>
              {entry.job.deadline_ms != null && (
                <span className="rounded-lg border border-[#253248] bg-[#162031] px-2 py-1">
                  deadline {entry.job.deadline_ms} ms
                </span>
              )}
              {entry.job.redundancy != null && (
                <span className="rounded-lg border border-[#253248] bg-[#162031] px-2 py-1">
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
            className="w-full rounded-lg border border-edge-2 bg-[#0e1420] p-3 font-mono text-xs leading-relaxed text-[#bcd0e6] outline-none focus:border-[#3a5575]"
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
              disabled={busy || catalog.length === 0}
              onClick={async () => {
                setNotice(null)
                setError(null)
                try {
                  const res = await planBatch.mutateAsync({
                    jobs: catalog.map((c) => c.job),
                    strategy,
                    dryRun,
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
              Plan entire catalog
            </Button>
            <Button variant="ghost" onClick={() => setEditor('')}>
              Clear
            </Button>
          </div>

          {error && (
            <p className="rounded-lg border border-[#5e1b1b] bg-[#2a1414] px-3 py-2 text-xs text-[#ffb4b4]">
              {error}
            </p>
          )}
          {notice && !error && (
            <p className="rounded-lg border border-[#1e5d42] bg-[#103a28] px-3 py-2 text-xs text-[#8ff0c1]">
              {notice}
            </p>
          )}
        </div>
      </div>
    </Card>
  )
}
