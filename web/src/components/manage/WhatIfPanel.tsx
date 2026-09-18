import { useMemo, useState } from 'react'
import { useWhatIf } from '../../api/hooks'
import type { Snapshot, WhatIfReport } from '../../api/types'
import { fmtCo2, fmtMoney, fmtMs } from '../../lib/format'
import {
  Button,
  Card,
  EmptyRow,
  Field,
  Mono,
  Notice,
  NumberInput,
  TableShell,
  Td,
  Th,
  inputCls,
} from '../ui/primitives'

type Mode = 'clone' | 'remove' | 'upgrade' | 'json'

const MODES: { value: Mode; label: string }[] = [
  { value: 'clone', label: 'Add copies of a node' },
  { value: 'remove', label: 'Remove a node' },
  { value: 'upgrade', label: 'Upgrade a node' },
  { value: 'json', label: 'Custom change (JSON)' },
]

/** Capacity planning: plan the catalogue with and without a proposed change. */
export function WhatIfPanel({ snapshot }: { snapshot?: Snapshot }) {
  const run = useWhatIf()
  const [mode, setMode] = useState<Mode>('clone')
  const [target, setTarget] = useState('')
  const [count, setCount] = useState<number | undefined>(2)
  const [cores, setCores] = useState<number | undefined>(64)
  const [strategy, setStrategy] = useState('greedy')
  const [faultZone, setFaultZone] = useState('')
  const [json, setJson] = useState('{\n  "clone_nodes": [{ "from": "hpc-053", "count": 2 }]\n}')
  const [report, setReport] = useState<WhatIfReport | null>(null)
  const [error, setError] = useState<string | null>(null)

  const nodes = useMemo(
    () => [...(snapshot?.nodes ?? [])].map((n) => n.name).sort(),
    [snapshot],
  )
  const zones = useMemo(
    () => [...new Set((snapshot?.nodes ?? []).map((n) => n.labels?.zone).filter(Boolean) as string[])].sort(),
    [snapshot],
  )
  const effectiveTarget = target || nodes[0] || ''

  function buildChanges(): Record<string, unknown> | null {
    if (mode === 'json') {
      try {
        const parsed = JSON.parse(json) as Record<string, unknown>
        if (!parsed || typeof parsed !== 'object') throw new Error('expected an object')
        return parsed
      } catch (e) {
        setError(`Invalid JSON: ${(e as Error).message}`)
        return null
      }
    }
    if (!effectiveTarget) {
      setError('Pick a node first.')
      return null
    }
    if (mode === 'clone') return { clone_nodes: [{ from: effectiveTarget, count: count ?? 1 }] }
    if (mode === 'remove') return { remove_nodes: [effectiveTarget] }
    return { patch_nodes: { [effectiveTarget]: { cpu: { cores: cores ?? 32 } } } }
  }

  async function submit() {
    setError(null)
    const changes = buildChanges()
    if (!changes) return
    try {
      setReport(
        await run.mutateAsync({
          changes,
          strategy,
          faults: faultZone ? [{ kind: 'zone_blackout', target: faultZone }] : undefined,
        }),
      )
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const rows = report
    ? [
        {
          label: 'Deadlines met',
          before: `${report.baseline.met}/${report.baseline.total}`,
          after: `${report.variant.met}/${report.variant.total}`,
          delta: report.deltas.sla_pct ? `${report.deltas.sla_pct.diff > 0 ? '+' : ''}${report.deltas.sla_pct.diff} pts` : '—',
          good: (report.deltas.sla_pct?.diff ?? 0) > 0,
        },
        {
          label: 'p95 latency',
          before: fmtMs(report.baseline.p95_ms),
          after: fmtMs(report.variant.p95_ms),
          delta: report.deltas.p95_ms?.pct != null ? `${report.deltas.p95_ms.pct}%` : '—',
          good: (report.deltas.p95_ms?.diff ?? 0) < 0,
        },
        {
          label: 'Mean latency',
          before: fmtMs(report.baseline.mean_ms),
          after: fmtMs(report.variant.mean_ms),
          delta: report.deltas.mean_ms?.pct != null ? `${report.deltas.mean_ms.pct}%` : '—',
          good: (report.deltas.mean_ms?.diff ?? 0) < 0,
        },
        {
          label: 'Catalogue cost',
          before: fmtMoney(report.baseline.cost_total),
          after: fmtMoney(report.variant.cost_total),
          delta: report.deltas.cost_total?.pct != null ? `${report.deltas.cost_total.pct}%` : '—',
          good: (report.deltas.cost_total?.diff ?? 0) < 0,
        },
        {
          label: 'Catalogue CO₂',
          before: fmtCo2(report.baseline.co2_g),
          after: fmtCo2(report.variant.co2_g),
          delta: report.deltas.co2_g?.pct != null ? `${report.deltas.co2_g.pct}%` : '—',
          good: (report.deltas.co2_g?.diff ?? 0) < 0,
        },
        {
          label: 'Fabric',
          before: `${report.baseline.fabric.nodes} nodes · ${report.baseline.fabric.cpu_cores} cores`,
          after: `${report.variant.fabric.nodes} nodes · ${report.variant.fabric.cpu_cores} cores`,
          delta: report.deltas.nodes ? `${report.deltas.nodes.diff > 0 ? '+' : ''}${report.deltas.nodes.diff}` : '—',
          good: false,
        },
      ]
    : []

  return (
    <Card
      title="What-if / capacity planning"
      subtitle="Forks the twin, applies a change, replays the job catalogue through both"
      actions={
        <Button variant="primary" disabled={run.isPending} onClick={() => void submit()}>
          {run.isPending ? 'Comparing…' : 'Compare'}
        </Button>
      }
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Change">
          <select className={inputCls} value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
            {MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </Field>
        {mode !== 'json' && (
          <Field label="Node">
            <select className={inputCls} value={effectiveTarget} onChange={(e) => setTarget(e.target.value)}>
              {nodes.length === 0 && <option value="">(none)</option>}
              {nodes.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </Field>
        )}
        {mode === 'clone' && (
          <Field label="How many">
            <NumberInput min={1} max={20} step={1} value={count} onChange={setCount} />
          </Field>
        )}
        {mode === 'upgrade' && (
          <Field label="CPU cores">
            <NumberInput min={1} step={1} value={cores} onChange={setCores} />
          </Field>
        )}
        <Field label="Strategy">
          <select className={inputCls} value={strategy} onChange={(e) => setStrategy(e.target.value)}>
            {['greedy', 'resilient', 'rl-markov', 'cheapest-energy', 'greenest'].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field label="During an outage" hint="Applied to both sides">
          <select className={inputCls} value={faultZone} onChange={(e) => setFaultZone(e.target.value)}>
            <option value="">no faults</option>
            {zones.map((z) => (
              <option key={z} value={z}>
                zone {z} down
              </option>
            ))}
          </select>
        </Field>
      </div>

      {mode === 'json' && (
        <div className="mt-3">
          <Field
            label="Change set"
            hint="clone_nodes, add_nodes, remove_nodes, patch_nodes, links, remove_links"
          >
            <textarea
              value={json}
              onChange={(e) => setJson(e.target.value)}
              spellCheck={false}
              className={`${inputCls} h-32 resize-y font-mono text-xs`}
            />
          </Field>
        </div>
      )}

      {error && (
        <div className="mt-3">
          <Notice tone="err" onDismiss={() => setError(null)}>
            {error}
          </Notice>
        </div>
      )}

      {report && !run.isPending && (
        <div className="mt-4 flex flex-col gap-3">
          <Notice tone={report.verdict.includes('worse') ? 'err' : report.verdict.includes('more job') ? 'ok' : 'info'}>
            {report.verdict}
          </Notice>
          <p className="text-[11px] text-muted-2">
            Applied: {report.changes.join('; ')}
            {report.faults.length ? ` · during: ${report.faults.join(', ')}` : ''}
            {report.contention ? ' · jobs contend for capacity' : ''}
          </p>

          <TableShell
            maxHeight="none"
            head={
              <>
                <Th>Metric</Th>
                <Th>As-is</Th>
                <Th>With change</Th>
                <Th>Delta</Th>
              </>
            }
          >
            {rows.map((row) => (
              <tr key={row.label}>
                <Td>{row.label}</Td>
                <Td>{row.before}</Td>
                <Td>{row.after}</Td>
                <Td className={row.good ? 'text-[#8ff0c1]' : 'text-muted'}>{row.delta}</Td>
              </tr>
            ))}
          </TableShell>

          <details className="text-xs text-muted">
            <summary className="cursor-pointer text-muted-2">Per-job detail</summary>
            <TableShell
              maxHeight="260px"
              head={
                <>
                  <Th>Job</Th>
                  <Th>As-is</Th>
                  <Th>With change</Th>
                  <Th>Placed on</Th>
                </>
              }
              empty={
                report.baseline.jobs.length === 0 ? <EmptyRow colSpan={4}>No jobs</EmptyRow> : undefined
              }
            >
              {report.baseline.jobs.map((before, i) => {
                const after = report.variant.jobs[i]
                return (
                  <tr key={before.job_id ?? i}>
                    <Td>
                      <Mono>{before.job_id}</Mono>
                    </Td>
                    <Td className={before.met ? '' : 'text-[#ffb4b4]'}>{fmtMs(before.latency_ms)}</Td>
                    <Td className={after?.met ? '' : 'text-[#ffb4b4]'}>{fmtMs(after?.latency_ms)}</Td>
                    <Td className="text-[11px] text-muted-2">{(after?.nodes ?? []).join(', ') || '—'}</Td>
                  </tr>
                )
              })}
            </TableShell>
          </details>
        </div>
      )}
    </Card>
  )
}
