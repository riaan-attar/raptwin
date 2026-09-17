import type { PlanResult, Snapshot } from '../api/types'
import { fmtCo2, fmtMoney, fmtPct, fmtTime } from '../lib/format'
import { Card, Kpi } from './ui/primitives'

export function Overview({
  snapshot,
  lastPlan,
  actions,
}: {
  snapshot?: Snapshot
  lastPlan?: PlanResult
  actions?: React.ReactNode
}) {
  const nodes = snapshot?.nodes ?? []
  const links = snapshot?.links ?? []
  const federations = snapshot?.federations ?? []

  const down = nodes.filter((n) => n.dyn?.down).length
  const reservations = nodes.reduce(
    (acc, n) => acc + Object.keys(n.dyn?.reservations ?? {}).length,
    0,
  )

  let usedCpu = 0
  let maxCpu = 0
  for (const n of nodes) {
    const max = Number(n.effective?.max_cpu_cores ?? 0)
    const free = Number(n.effective?.free_cpu_cores ?? 0)
    if (max > 0) {
      usedCpu += Math.max(0, max - free)
      maxCpu += max
    }
  }

  const maxFedLoad = federations.length
    ? Math.max(...federations.map((f) => Number(f.load_factor ?? 0)))
    : null

  return (
    <Card title="Overview" actions={actions}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <Kpi label="Nodes" value={nodes.length || '—'} />
        <Kpi label="Links" value={links.length || '—'} />
        <Kpi label="Federations" value={federations.length || '—'} />
        <Kpi label="Down" value={down} />
        <Kpi label="Reservations" value={reservations} />
        <Kpi label="CPU used" value={maxCpu > 0 ? fmtPct(usedCpu / maxCpu) : '—'} />
        <Kpi label="Max fed load" value={maxFedLoad !== null ? fmtPct(maxFedLoad) : '—'} />
        <Kpi
          label="Plan spread"
          value={lastPlan?.federation_spread != null ? lastPlan.federation_spread.toFixed(2) : '—'}
        />
        <Kpi
          label="Fallback coverage"
          value={lastPlan?.resilience_score != null ? fmtPct(lastPlan.resilience_score) : '—'}
        />
        <Kpi
          label="Plan cost"
          value={fmtMoney(lastPlan?.cost_total, lastPlan?.currency ?? snapshot?.economics?.currency)}
        />
        <Kpi label="Plan CO₂" value={fmtCo2(lastPlan?.co2_g)} />
        <Kpi label="Last snapshot" value={fmtTime(snapshot?.ts)} />
      </div>
    </Card>
  )
}
