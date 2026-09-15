import type { PlanResult } from '../api/types'
import { fmt, fmtPct } from '../lib/format'
import { Badge, Card, EmptyRow, Mono, TableShell, Tag, Td, Th } from './ui/primitives'

function latency(value: number | undefined): string {
  if (value === undefined || value === null) return '—'
  if (!Number.isFinite(value)) return '∞'
  return value.toFixed(1)
}

export function RecentPlans({
  plans,
  selectedIndex,
  onSelect,
}: {
  plans?: PlanResult[]
  selectedIndex: number
  onSelect: (index: number) => void
}) {
  const rows = plans ?? []

  return (
    <Card
      title="Recent Plans"
      subtitle={rows.length ? `${rows.length} plans · click a row to inspect` : undefined}
    >
      <TableShell
        maxHeight="380px"
        head={
          <>
            <Th>Job</Th>
            <Th>Latency (ms)</Th>
            <Th>Energy (kJ)</Th>
            <Th>Risk</Th>
            <Th>Reliability</Th>
            <Th>Spread</Th>
            <Th>Fallback</Th>
            <Th>Status</Th>
          </>
        }
        empty={
          rows.length === 0 ? (
            <EmptyRow colSpan={8}>
              No plans yet. Submit one from the Plan a Job panel.
            </EmptyRow>
          ) : undefined
        }
      >
        {rows.map((p, idx) => (
          <tr
            key={`${p.job_id}-${p.ts ?? idx}`}
            onClick={() => onSelect(idx)}
            className={
              idx === selectedIndex
                ? 'cursor-pointer bg-[#13314d]/40'
                : 'cursor-pointer hover:bg-[#0f1520]'
            }
          >
            <Td>
              <Mono className="text-[13px]">{p.job_id ?? '—'}</Mono>
              <div className="text-[11px] text-muted-2">
                {p.strategy ?? 'greedy'} {p.dry_run ? '(dry)' : ''}
              </div>
            </Td>
            <Td>{latency(p.latency_ms)}</Td>
            <Td>{fmt(p.energy_kj, 3)}</Td>
            <Td>{fmt(p.risk, 3)}</Td>
            <Td>{p.avg_reliability != null ? fmt(p.avg_reliability) : '—'}</Td>
            <Td>
              {p.federation_spread != null ? fmt(p.federation_spread) : '—'}
              {p.federations_in_use && p.federations_in_use.length > 0 && (
                <div className="mt-0.5">
                  {p.federations_in_use.slice(0, 4).map((f) => (
                    <Tag key={f}>{f}</Tag>
                  ))}
                </div>
              )}
            </Td>
            <Td>{p.resilience_score != null ? fmtPct(p.resilience_score) : '—'}</Td>
            <Td>
              {p.infeasible ? <Badge tone="bad">Infeasible</Badge> : <Badge tone="good">OK</Badge>}
            </Td>
          </tr>
        ))}
      </TableShell>
    </Card>
  )
}
