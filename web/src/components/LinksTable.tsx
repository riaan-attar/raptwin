import type { Snapshot } from '../api/types'
import { fmt } from '../lib/format'
import { Badge, Card, EmptyRow, Mono, TableShell, Td, Th } from './ui/primitives'

export function LinksTable({ snapshot }: { snapshot?: Snapshot }) {
  const links = snapshot?.links ?? []

  return (
    <Card
      title="Links"
      subtitle="Topology links plus any ad-hoc links injected by chaos overrides"
    >
      <TableShell
        head={
          <>
            <Th>Key</Th>
            <Th>Peers</Th>
            <Th>Speed (Gbps)</Th>
            <Th>RTT / Jitter (ms)</Th>
            <Th>Loss (%)</Th>
            <Th>Status</Th>
          </>
        }
        empty={
          links.length === 0 ? (
            <EmptyRow colSpan={6}>
              {snapshot ? 'No links registered in the twin.' : 'Waiting for snapshot…'}
            </EmptyRow>
          ) : undefined
        }
      >
        {links.map((l) => {
          const e = l.effective ?? {}
          const loss = Number(e.loss_pct ?? 0)
          return (
            <tr key={l.key} className="hover:bg-[#0f1520]">
              <Td>
                <Mono>{l.key}</Mono>
              </Td>
              <Td>
                {l.a} ↔ {l.b}
              </Td>
              <Td>{fmt(e.speed_gbps)}</Td>
              <Td>
                {fmt(e.rtt_ms, 1)} / {fmt(e.jitter_ms, 1)}
              </Td>
              <Td>{fmt(e.loss_pct)}</Td>
              <Td>
                {e.down ? (
                  <Badge tone="bad">DOWN</Badge>
                ) : loss >= 2 ? (
                  <Badge tone="warn">DEGRADED</Badge>
                ) : (
                  <Badge tone="good">OK</Badge>
                )}
              </Td>
            </tr>
          )
        })}
      </TableShell>
    </Card>
  )
}
