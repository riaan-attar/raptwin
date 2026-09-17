import { useState } from 'react'
import {
  useChaos,
  useClearPlans,
  useResetOverrides,
  useStartChaos,
  useStopChaos,
} from '../../api/hooks'
import type { Snapshot } from '../../api/types'
import { fmtTime } from '../../lib/format'
import { Badge, Button, Card, Field, Kpi, Notice, NumberInput, inputCls } from '../ui/primitives'

export function ChaosPanel() {
  const chaos = useChaos()
  const start = useStartChaos()
  const stop = useStopChaos()
  const [scenario, setScenario] = useState('')
  const [speed, setSpeed] = useState<number | undefined>(10)
  const [error, setError] = useState<string | null>(null)

  const info = chaos.data
  const status = info?.status
  const running = Boolean(status?.running)
  const selected = info?.scenarios.find((s) => s.name === scenario)
  const pct = status && status.total ? Math.round((status.applied / status.total) * 100) : 0

  async function run() {
    setError(null)
    try {
      await start.mutateAsync({ scenario: scenario || null, speed: speed ?? 10 })
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <Card
      title="Chaos scenarios"
      subtitle="Runs sim/topology.yaml schedules inside the twin — no separate process needed"
      actions={
        running ? (
          <Badge tone="bad">RUNNING</Badge>
        ) : status?.finished_ts ? (
          <Badge tone={status.stopped ? 'warn' : 'good'}>{status.stopped ? 'STOPPED' : 'FINISHED'}</Badge>
        ) : (
          <Badge>IDLE</Badge>
        )
      }
    >
      {chaos.isError && (
        <div className="mb-3">
          <Notice tone="err">{(chaos.error as Error).message}</Notice>
        </div>
      )}
      {error && (
        <div className="mb-3">
          <Notice tone="err" onDismiss={() => setError(null)}>
            {error}
          </Notice>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_8rem]">
        <Field label="Scenario">
          <select
            className={inputCls}
            value={scenario}
            disabled={running}
            onChange={(e) => setScenario(e.target.value)}
          >
            <option value="">Default schedule ({info?.base_events ?? 0} events)</option>
            {info?.scenarios.map((s) => (
              <option key={s.name} value={s.name}>
                {s.name} (+{s.events} events)
              </option>
            ))}
          </select>
        </Field>
        <Field label="Speed ×" hint="Timeline speed-up">
          <NumberInput min={0.1} max={1000} value={speed} onChange={setSpeed} />
        </Field>
      </div>
      <p className="mt-2 min-h-[1.25rem] text-xs text-muted-2">
        {selected?.description ??
          (scenario ? '' : 'The top-level chaos: list. Scenarios add their own events on top of it.')}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {running ? (
          <Button variant="bad" disabled={stop.isPending} onClick={() => void stop.mutateAsync()}>
            Stop run
          </Button>
        ) : (
          <Button variant="primary" disabled={start.isPending || !info} onClick={() => void run()}>
            {start.isPending ? 'Starting…' : 'Start chaos'}
          </Button>
        )}
      </div>

      {status && status.total > 0 && (
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-[11px] text-muted-2">
            <span>
              {status.scenario ?? 'default schedule'} · ×{status.speed} · started {fmtTime(status.started_ts)}
            </span>
            <span>
              {status.applied}/{status.total} events
            </span>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-chip"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className={running ? 'h-full bg-bad transition-all' : 'h-full bg-accent transition-all'}
              style={{ width: `${pct}%` }}
            />
          </div>
          {status.log.length > 0 && (
            <ol className="mt-3 max-h-56 overflow-auto rounded-lg border border-[#1f2b3b] bg-panel-2 p-2 font-mono text-[11px] text-[#bcd0e6]">
              {[...status.log].reverse().map((entry, i) => (
                <li key={`${entry.ts}-${i}`} className="py-0.5">
                  <span className="text-muted-2">{fmtTime(entry.ts)}</span> {entry.msg}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </Card>
  )
}

/** One-click cleanup actions for the whole twin. */
export function MaintenancePanel({ snapshot }: { snapshot?: Snapshot }) {
  const reset = useResetOverrides()
  const clearPlans = useClearPlans()
  const [notice, setNotice] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)

  const nodes = snapshot?.nodes ?? []
  const downNodes = nodes.filter((n) => n.dyn?.down).length
  const derated = nodes.filter((n) => Number(n.dyn?.thermal_derate ?? 0) > 0).length
  const downLinks = (snapshot?.links ?? []).filter((l) => l.effective?.down).length

  async function doReset() {
    if (!window.confirm('Clear every injected fault? This also stops a running chaos scenario.')) return
    try {
      const r = await reset.mutateAsync()
      setNotice({
        tone: 'ok',
        text: `Reset ${r.nodes_reset} node(s) and ${r.links_reset} link(s)${r.chaos_stopped ? '; chaos run stopped' : ''}.`,
      })
    } catch (e) {
      setNotice({ tone: 'err', text: (e as Error).message })
    }
  }

  async function doClear() {
    if (!window.confirm('Clear the recent plan history? Reservations are not released.')) return
    try {
      const r = await clearPlans.mutateAsync()
      setNotice({ tone: 'ok', text: `Cleared ${r.cleared} plan(s).` })
    } catch (e) {
      setNotice({ tone: 'err', text: (e as Error).message })
    }
  }

  return (
    <Card title="Health & cleanup" subtitle="Current fault load and reset controls">
      <div className="grid grid-cols-3 gap-2">
        <Kpi label="Nodes down" value={downNodes} />
        <Kpi label="Nodes derated" value={derated} />
        <Kpi label="Links down" value={downLinks} />
      </div>
      {notice && (
        <div className="mt-3">
          <Notice tone={notice.tone} onDismiss={() => setNotice(null)}>
            {notice.text}
          </Notice>
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="good" disabled={reset.isPending} onClick={() => void doReset()}>
          {reset.isPending ? 'Resetting…' : 'Reset all faults'}
        </Button>
        <Button disabled={clearPlans.isPending} onClick={() => void doClear()}>
          Clear plan history
        </Button>
      </div>
    </Card>
  )
}
