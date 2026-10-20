import { useMemo } from 'react'
import type { Snapshot } from '../api/types'
import { fmt } from '../lib/format'
import { filterLinks, useLinkFilters } from '../lib/filters'
import { useSelection } from '../lib/useSelection'
import { LinkBulkBar } from './bulk/LinkBulkBar'
import { LinkFilterControls } from './bulk/LinkFilterControls'
import { useBulkRunner } from './bulk/useBulkRunner'
import { Badge, Card, EmptyRow, Mono, TableShell, Td, Th } from './ui/primitives'
import { SelectCell, SelectHeader } from './ui/selection'

export function LinksTable({ snapshot }: { snapshot?: Snapshot }) {
  const { filters, set, reset, activeCount } = useLinkFilters()
  const runner = useBulkRunner()

  const links = useMemo(() => snapshot?.links ?? [], [snapshot])
  const allKeys = useMemo(() => links.map((l) => l.key), [links])
  const selection = useSelection(allKeys)

  const rows = useMemo(
    () => filterLinks(links, filters, (l) => ({ key: `${l.key} ${l.a} ${l.b}`, metrics: l.effective })),
    [links, filters],
  )
  const visibleKeys = useMemo(() => rows.map((l) => l.key), [rows])
  const selectedLinks = useMemo(() => links.filter((l) => selection.selected.has(l.key)), [links, selection.selected])

  return (
    <Card
      title="Links"
      subtitle={`${rows.length} of ${links.length} shown · topology links plus ad-hoc links injected by chaos overrides`}
    >
      <LinkFilterControls filters={filters} set={set} reset={reset} activeCount={activeCount} />
      <LinkBulkBar
        noun="links"
        links={selectedLinks}
        selection={selection}
        visibleKeys={visibleKeys}
        runner={runner}
      />
      <TableShell
        head={
          <>
            <SelectHeader visibleKeys={visibleKeys} selection={selection} />
            <Th>Key</Th>
            <Th>Peers</Th>
            <Th>Speed (Gbps)</Th>
            <Th>RTT / Jitter (ms)</Th>
            <Th>Loss (%)</Th>
            <Th>Status</Th>
          </>
        }
        empty={
          rows.length === 0 ? (
            <EmptyRow colSpan={7}>
              {snapshot ? 'No links match the filters.' : 'Waiting for snapshot…'}
            </EmptyRow>
          ) : undefined
        }
      >
        {rows.map((l) => {
          const e = l.effective ?? {}
          const loss = Number(e.loss_pct ?? 0)
          const picked = selection.selected.has(l.key)
          return (
            <tr
              key={l.key}
              className={picked ? 'bg-[var(--color-chip-info-bg)]/40' : 'hover:bg-[var(--color-row-hover)]'}
            >
              <SelectCell id={l.key} selection={selection} label={l.key} />
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
