import { useState } from 'react'
import type { JobRun, RunStage } from '../../api/types'
import { fmt } from '../../lib/format'
import { clamp01, fmtClock } from '../../lib/time'
import { Badge, Button, Mono, NumberInput, Tag } from '../ui/primitives'

export interface RunActions {
  busy: boolean
  onFinish: (id: string) => void
  onCancel: (id: string) => void
  onExtend: (id: string, seconds: number) => void
  onSetRemaining: (id: string, seconds: number) => void
}

type LiveStatus = 'done' | 'active' | 'pending'

/** Stage status from the live progress, so the timeline moves between server updates. */
function liveStages(stages: RunStage[], progress: number): (RunStage & { live: LiveStatus })[] {
  let cum = 0
  return stages.map((s) => {
    const lo = cum
    cum += s.share
    const live: LiveStatus = progress >= cum - 1e-9 ? 'done' : progress >= lo ? 'active' : 'pending'
    return { ...s, live }
  })
}

const STATUS_TONE = { done: 'good', active: 'info', pending: 'neutral' } as const

export function RunCard({
  run,
  serverNow,
  actions,
  checkbox,
}: {
  run: JobRun
  serverNow: number
  actions: RunActions
  checkbox: React.ReactNode
}) {
  const [setting, setSetting] = useState(false)
  const [seconds, setSeconds] = useState<number | undefined>(30)

  const elapsed = Math.max(0, (serverNow - run.started_ms) / 1000)
  const remaining = Math.max(0, (run.ends_ms - serverNow) / 1000)
  const progress = clamp01(elapsed / Math.max(run.duration_s, 0.001))
  const stages = liveStages(run.stages, progress)
  const p = run.predicted
  const down = stages.some((s) => s.node_down)

  return (
    <div className="rounded-xl border border-edge-2 bg-panel-2 p-3">
      <div className="flex flex-wrap items-start gap-3">
        <div className="pt-1">{checkbox}</div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Mono className="text-sm font-bold text-ink">{run.job_id}</Mono>
            <span className="text-[11px] text-muted-2">{run.run_id}</span>
            <Badge tone="info">{run.strategy || 'greedy'}</Badge>
            {down && <Badge tone="bad">NODE DOWN</Badge>}
            {run.timer_changes > 0 && <Badge tone="warn">timer changed ×{run.timer_changes}</Badge>}
          </div>
          <div className="mt-1 text-[11px] text-muted-2">
            started {new Date(run.started_ms).toLocaleTimeString()} · {run.reservation_count} reservation
            {run.reservation_count === 1 ? '' : 's'} held
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-2xl font-bold leading-none text-[var(--color-chip-info-text)]" aria-label="time left">
            {fmtClock(remaining)}
          </div>
          <div className="mt-1 text-[11px] text-muted-2">of {fmtClock(run.duration_s)} · {Math.round(progress * 100)}%</div>
        </div>
      </div>

      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--color-input-bg)]"
        role="progressbar"
        aria-valuenow={Math.round(progress * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full rounded-full bg-accent-strong transition-[width] duration-200" style={{ width: `${progress * 100}%` }} />
      </div>

      <ul className="mt-3 flex flex-col gap-1.5">
        {stages.map((s) => (
          <li
            key={s.id}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-[var(--color-panel2-border)] bg-panel px-2.5 py-1.5 text-xs"
          >
            <Badge tone={STATUS_TONE[s.live]}>{s.live}</Badge>
            <Mono className="text-[12px]">{s.id}</Mono>
            <span className="text-muted-2">→</span>
            <Mono className="text-[12px]">{s.current_node}</Mono>
            {s.failed_over && <Badge tone="warn">failed over from {s.node}</Badge>}
            {s.node_down && <Badge tone="bad">DOWN</Badge>}
            {s.node_derate > 0 && <Badge tone="warn">derate {Math.round(s.node_derate * 100)}%</Badge>}
            {s.format && <Tag>{s.format}</Tag>}
            <span className="ml-auto text-muted-2">
              {fmt(s.compute_ms, 0)} ms compute{s.xfer_ms > 0 ? ` + ${fmt(s.xfer_ms, 0)} ms transfer` : ''}
              {s.resources.cpu_cores > 0 && ` · ${s.resources.cpu_cores} CPU`}
              {s.resources.mem_gb > 0 && ` · ${s.resources.mem_gb} GB`}
              {s.resources.gpu_vram_gb > 0 && ` · ${s.resources.gpu_vram_gb} GB VRAM`}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-2">
        <span>
          predicted <b className="text-ink">{fmt(p.latency_ms, 1)} ms</b>
          {p.deadline_ms ? ` / deadline ${fmt(p.deadline_ms, 0)} ms` : ''}
        </span>
        {run.meets_deadline !== null && (
          <Badge tone={run.meets_deadline ? 'good' : 'bad'}>{run.meets_deadline ? 'meets deadline' : 'misses deadline'}</Badge>
        )}
        {p.energy_kj != null && <span>energy {fmt(p.energy_kj, 2)} kJ</span>}
        {p.risk != null && <span>risk {fmt(p.risk, 2)}</span>}
        {p.cost_total != null && (
          <span>
            cost {p.currency ?? ''} {fmt(p.cost_total, 4)}
          </span>
        )}
        {p.co2_g != null && <span>CO₂ {fmt(p.co2_g, 4)} g</span>}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Button variant="good" className="px-2 py-1 text-xs" disabled={actions.busy} onClick={() => actions.onFinish(run.run_id)}>
          Finish now
        </Button>
        <Button variant="bad" className="px-2 py-1 text-xs" disabled={actions.busy} onClick={() => actions.onCancel(run.run_id)}>
          Cancel
        </Button>
        <span className="mx-1 h-5 w-px bg-edge-2" />
        <Button className="px-2 py-1 text-xs" disabled={actions.busy} onClick={() => actions.onExtend(run.run_id, 30)}>
          +30 s
        </Button>
        <Button className="px-2 py-1 text-xs" disabled={actions.busy} onClick={() => actions.onExtend(run.run_id, 60)}>
          +1 min
        </Button>
        <Button className="px-2 py-1 text-xs" disabled={actions.busy} onClick={() => setSetting((v) => !v)}>
          Set timer…
        </Button>
        {setting && (
          <span className="flex items-center gap-1.5">
            <NumberInput value={seconds} onChange={setSeconds} min={1} step={1} className="w-20" placeholder="seconds left" />
            <Button
              variant="primary"
              className="px-2 py-1 text-xs"
              disabled={actions.busy || seconds === undefined || seconds < 1}
              onClick={() => {
                if (seconds !== undefined) actions.onSetRemaining(run.run_id, seconds)
                setSetting(false)
              }}
            >
              Apply
            </Button>
            <span className="text-[11px] text-muted-2">seconds left from now</span>
          </span>
        )}
      </div>
    </div>
  )
}
