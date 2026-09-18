import { useState } from 'react'
import { useBlastRadius, useJobs } from '../../api/hooks'
import type { BlastRadiusReport } from '../../api/types'
import { fmtMs } from '../../lib/format'
import { Badge, Button, Card, Field, Mono, Notice, NumberInput, inputCls } from '../ui/primitives'

/** Finds the smallest fault sets that push a job past its deadline. */
export function BlastRadiusPanel() {
  const jobs = useJobs()
  const search = useBlastRadius()
  const [jobId, setJobId] = useState('')
  const [strategy, setStrategy] = useState('greedy')
  const [depth, setDepth] = useState<number | undefined>(2)
  const [deadline, setDeadline] = useState<number | undefined>(undefined)
  const [report, setReport] = useState<BlastRadiusReport | null>(null)
  const [error, setError] = useState<string | null>(null)

  const catalog = jobs.data ?? []
  const effectiveJob = jobId || catalog[0]?.id || ''

  async function run() {
    setError(null)
    try {
      setReport(
        await search.mutateAsync({
          jobId: effectiveJob,
          strategy,
          depth: depth ?? 2,
          deadlineMs: deadline,
        }),
      )
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const verdictTone = (verdict: string): 'ok' | 'err' | 'info' => {
    if (verdict.startsWith('fragile') || verdict.startsWith('job already')) return 'err'
    if (verdict.startsWith('survives every')) return 'ok'
    return 'info'
  }

  return (
    <Card
      title="Blast radius"
      subtitle="Searches fault combinations for the smallest set that breaks a job"
      actions={
        <Button
          variant="primary"
          disabled={search.isPending || !effectiveJob}
          onClick={() => void run()}
        >
          {search.isPending ? 'Searching…' : 'Find breaking sets'}
        </Button>
      }
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Job">
          <select
            className={inputCls}
            value={effectiveJob}
            onChange={(e) => setJobId(e.target.value)}
          >
            {catalog.length === 0 && <option value="">(no jobs)</option>}
            {catalog.map((entry) => (
              <option key={`${entry.file}#${entry.index}`} value={entry.id}>
                {entry.id}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Strategy">
          <select className={inputCls} value={strategy} onChange={(e) => setStrategy(e.target.value)}>
            {['greedy', 'resilient', 'rl-markov', 'cheapest-energy', 'greenest'].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Max set size" hint="1–3">
          <NumberInput min={1} max={3} step={1} value={depth} onChange={setDepth} />
        </Field>
        <Field label="Deadline (ms)" hint="Blank = the job's own">
          <NumberInput min={0} step={100} value={deadline} onChange={setDeadline} />
        </Field>
      </div>

      {error && (
        <div className="mt-3">
          <Notice tone="err" onDismiss={() => setError(null)}>
            {error}
          </Notice>
        </div>
      )}

      {search.isPending && (
        <p className="mt-3 text-xs text-muted-2">
          Injecting and reverting faults — a depth-2 search runs a few hundred placements.
        </p>
      )}

      {report && !search.isPending && (
        <div className="mt-4 flex flex-col gap-3">
          <Notice tone={verdictTone(report.verdict)}>{report.verdict}</Notice>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-2">
            <span>
              Baseline <strong className="text-ink">{fmtMs(report.baseline.latency_ms)}</strong>
              {report.deadline_ms ? ` of ${fmtMs(report.deadline_ms)}` : ''}
              {report.baseline.headroom_pct != null
                ? ` · ${report.baseline.headroom_pct}% headroom`
                : ''}
            </span>
            <span>
              Nodes <Mono>{report.baseline.nodes.join(', ') || '—'}</Mono>
            </span>
            <span>
              {report.search.fault_space} faults · {report.search.evaluations} placements ·{' '}
              {report.search.duration_s}s
            </span>
          </div>

          {report.minimal_breaking_sets.length > 0 && (
            <div>
              <h3 className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-[#a9c3e1]">
                Minimal breaking sets
              </h3>
              <ul className="flex flex-col gap-1.5">
                {report.minimal_breaking_sets.map((entry, i) => (
                  <li
                    key={i}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-[#5e1b1b] bg-[#2a1414]/60 px-2.5 py-1.5 text-xs"
                  >
                    <Badge tone="bad">{entry.size}</Badge>
                    <span className="text-[#ffd0d0]">
                      {entry.faults.map((f) => f.label).join('  +  ')}
                    </span>
                    <span className="ml-auto text-muted-2">
                      {entry.infeasible ? 'infeasible' : fmtMs(entry.latency_ms)}
                    </span>
                  </li>
                ))}
              </ul>
              {report.search.truncated && (
                <p className="mt-1.5 text-[11px] text-muted-2">
                  Stopped at the result cap — there may be more.
                </p>
              )}
            </div>
          )}

          {report.most_common_fault && (
            <p className="text-xs text-muted">
              Most implicated:{' '}
              <strong className="text-ink">{report.most_common_fault.label}</strong>{' '}
              <span className="text-muted-2">
                (in {report.most_common_fault.sets} set
                {report.most_common_fault.sets === 1 ? '' : 's'}) — fixing this removes the most
                failure modes
              </span>
            </p>
          )}

          {report.worst_single_faults.length > 0 && (
            <div>
              <h3 className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-[#a9c3e1]">
                Worst survivable single faults
              </h3>
              <ul className="flex flex-col gap-1">
                {report.worst_single_faults.map((f, i) => (
                  <li key={i} className="flex flex-wrap gap-2 text-xs text-muted">
                    <span className="text-ink">{f.label}</span>
                    <span className="ml-auto text-muted-2">
                      {fmtMs(f.latency_ms)}
                      {f.headroom_pct != null ? ` · ${f.headroom_pct}% headroom` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
