import type { PlanResult, PlanStage } from '../api/types'
import { fmt, fmtPct } from '../lib/format'
import { Badge, Card, Mono, Tag } from './ui/primitives'

function StageCard({ stage }: { stage: PlanStage }) {
  const blocked = Boolean(stage.infeasible) || !stage.node
  return (
    <div
      className={
        blocked
          ? 'min-w-[170px] rounded-[10px] border border-[#5e1b1b] bg-[#2a1414] p-3'
          : 'min-w-[170px] rounded-[10px] border border-[#2a3648] bg-chip p-3'
      }
    >
      <Mono className="text-[11px]">{stage.id ?? '?'}</Mono>
      <div className="mt-0.5 text-sm font-bold">{stage.node ?? '—'}</div>
      {stage.format && <div className="mt-0.5 text-[11px] text-[#8fbef6]">{stage.format}</div>}
      <div className="mt-1 text-[11px] text-muted-2">
        c:{fmt(stage.compute_ms, 1)} ms · x:{fmt(stage.xfer_ms, 1)} ms
      </div>
      {(stage.reliability != null || stage.availability_window_sec != null) && (
        <div className="mt-0.5 text-[11px] text-muted-2">
          {stage.reliability != null && <>rel {fmt(stage.reliability)} </>}
          {stage.availability_window_sec != null && <>· avail {fmt(stage.availability_window_sec)}s</>}
        </div>
      )}
      {stage.federation && (
        <div className="mt-1">
          <Tag>{stage.federation}</Tag>
        </div>
      )}
      {stage.fallbacks && stage.fallbacks.length > 0 && (
        <div className="mt-1 text-[11px] text-muted-2">
          fallback:{' '}
          {stage.fallbacks
            .slice(0, 3)
            .map((f) => (typeof f === 'string' ? f : f.node))
            .filter(Boolean)
            .join(', ')}
        </div>
      )}
      {blocked && (
        <div className="mt-1.5">
          <Badge tone="bad">{stage.reason ?? 'blocked'}</Badge>
        </div>
      )}
      {stage.reservation_id && (
        <div className="mt-1 text-[10px] text-muted-2">
          <Mono className="text-[10px]">{stage.reservation_id}</Mono>
        </div>
      )}
    </div>
  )
}

export function PlanStages({ plan }: { plan?: PlanResult }) {
  if (!plan) {
    return (
      <Card title="Plan Detail">
        <p className="text-xs text-muted-2">Select a plan to inspect its stage placements.</p>
      </Card>
    )
  }

  const stages = plan.per_stage ?? []

  return (
    <Card
      title="Plan Detail"
      subtitle={`${plan.job_id ?? 'job'} · ${plan.strategy ?? 'greedy'}${plan.dry_run ? ' (dry run)' : ''}`}
      actions={
        plan.infeasible ? <Badge tone="bad">Infeasible</Badge> : <Badge tone="good">Feasible</Badge>
      }
    >
      <div className="flex flex-wrap items-stretch gap-2">
        {stages.length === 0 && <p className="text-xs text-muted-2">Plan contains no stages.</p>}
        {stages.map((stage, i) => (
          <div key={`${stage.id}-${i}`} className="flex items-center gap-2">
            <StageCard stage={stage} />
            {i < stages.length - 1 && <span className="text-lg text-muted-2">→</span>}
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-[#1f2a39] pt-2 text-[11px] text-muted-2">
        <span>
          Latency <strong className="text-ink">{fmt(plan.latency_ms, 1)} ms</strong>
        </span>
        <span>
          Energy <strong className="text-ink">{fmt(plan.energy_kj, 3)} kJ</strong>
        </span>
        <span>
          Risk <strong className="text-ink">{fmt(plan.risk, 3)}</strong>
        </span>
        {plan.avg_reliability != null && (
          <span>
            Reliability <strong className="text-ink">{fmt(plan.avg_reliability)}</strong>
          </span>
        )}
        {plan.federation_spread != null && (
          <span>
            Spread <strong className="text-ink">{fmt(plan.federation_spread)}</strong>
          </span>
        )}
        {plan.resilience_score != null && (
          <span>
            Fallback coverage{' '}
            <strong className="text-ink">{fmtPct(plan.resilience_score)}</strong>
          </span>
        )}
        {plan.slo_penalty != null && plan.slo_penalty > 0 && (
          <span>
            SLO penalty <strong className="text-warn">{fmt(plan.slo_penalty, 1)}</strong>
          </span>
        )}
        {plan.mdp_value != null && (
          <span>
            MDP value <strong className="text-ink">{fmt(plan.mdp_value, 4)}</strong>
          </span>
        )}
      </div>
    </Card>
  )
}
