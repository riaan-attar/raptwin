import type { Snapshot } from '../api/types'
import { fmt, fmtPct } from '../lib/format'
import { Badge, Card, EmptyRow, Mono, TableShell, Td, Th } from './ui/primitives'

export function FederationsTable({ snapshot }: { snapshot?: Snapshot }) {
  const feds = snapshot?.federations ?? []

  return (
    <Card
      title="Federations"
      subtitle="Load blends CPU, memory and accelerator utilisation per zone"
    >
      <TableShell
        maxHeight="320px"
        head={
          <>
            <Th>Name</Th>
            <Th>Load</Th>
            <Th>Down / Total</Th>
            <Th>Reservations</Th>
            <Th>Avg loss (%)</Th>
            <Th>Avg trust</Th>
          </>
        }
        empty={
          feds.length === 0 ? (
            <EmptyRow colSpan={6}>No federation data.</EmptyRow>
          ) : undefined
        }
      >
        {feds.map((f) => (
          <tr key={f.name} className="hover:bg-[#0f1520]">
            <Td>
              <Mono className="text-[13px]">{f.name}</Mono>
              <div className="mt-0.5 max-w-[22rem] truncate text-[11px] text-muted-2">
                {f.nodes.join(', ')}
              </div>
            </Td>
            <Td>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[#0e1420]">
                  <div
                    className="h-full rounded-full bg-accent-strong"
                    style={{ width: `${Math.min(100, Number(f.load_factor ?? 0) * 100)}%` }}
                  />
                </div>
                <span className="text-xs">{fmtPct(f.load_factor)}</span>
              </div>
            </Td>
            <Td>
              {f.down_nodes > 0 ? (
                <Badge tone="bad">
                  {f.down_nodes} / {f.nodes.length}
                </Badge>
              ) : (
                <span>
                  0 / {f.nodes.length}
                </span>
              )}
            </Td>
            <Td>{f.reservations}</Td>
            <Td>{f.avg_loss_pct != null ? fmt(f.avg_loss_pct) : '—'}</Td>
            <Td>{f.avg_trust != null ? fmt(f.avg_trust) : '—'}</Td>
          </tr>
        ))}
      </TableShell>
    </Card>
  )
}

export function FederationLinksTable({ snapshot }: { snapshot?: Snapshot }) {
  const edges = snapshot?.federation_links ?? []

  return (
    <Card
      title="Federation Links"
      subtitle="Cross-zone health aggregated from topology links and chaos overrides"
    >
      <TableShell
        maxHeight="320px"
        head={
          <>
            <Th>A</Th>
            <Th>B</Th>
            <Th>Links</Th>
            <Th>Down</Th>
            <Th>Min speed</Th>
            <Th>Avg RTT</Th>
            <Th>Max loss</Th>
          </>
        }
        empty={
          edges.length === 0 ? (
            <EmptyRow colSpan={7}>
              No cross-federation links. They appear while a partition scenario is active.
            </EmptyRow>
          ) : undefined
        }
      >
        {edges.map((e) => (
          <tr key={`${e.a}~${e.b}`} className="hover:bg-[#0f1520]">
            <Td>{e.a}</Td>
            <Td>{e.b}</Td>
            <Td>{e.links}</Td>
            <Td>{e.down_links > 0 ? <Badge tone="bad">{e.down_links}</Badge> : 0}</Td>
            <Td>{e.min_speed_gbps != null ? fmt(e.min_speed_gbps) : '—'}</Td>
            <Td>{fmt(e.avg_rtt_ms)}</Td>
            <Td>{fmt(e.max_loss_pct)}</Td>
          </tr>
        ))}
      </TableShell>
    </Card>
  )
}
