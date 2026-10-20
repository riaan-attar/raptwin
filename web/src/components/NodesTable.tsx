import { useMemo } from 'react'
import type { Snapshot } from '../api/types'
import { fmt } from '../lib/format'
import { filterNodes, useNodeFilters } from '../lib/filters'
import { useSelection } from '../lib/useSelection'
import { NodeBulkBar } from './bulk/NodeBulkBar'
import { NodeFilterControls } from './bulk/NodeFilterControls'
import { useBulkRunner } from './bulk/useBulkRunner'
import { Badge, Card, EmptyRow, Mono, Tag, TableShell, Td, Th } from './ui/primitives'
import { SelectCell, SelectHeader } from './ui/selection'

export function NodesTable({ snapshot }: { snapshot?: Snapshot }) {
  const { filters, set, reset, activeCount } = useNodeFilters()
  const runner = useBulkRunner()

  const nodes = useMemo(() => snapshot?.nodes ?? [], [snapshot])
  const fedMap = useMemo(() => snapshot?.node_federations ?? {}, [snapshot])
  const allKeys = useMemo(() => nodes.map((n) => n.name), [nodes])
  const selection = useSelection(allKeys)

  const rows = useMemo(() => filterNodes(nodes, filters, fedMap), [nodes, filters, fedMap])
  const visibleKeys = useMemo(() => rows.map((n) => n.name), [rows])
  const selectedNodes = useMemo(() => nodes.filter((n) => selection.selected.has(n.name)), [nodes, selection.selected])

  return (
    <Card title="Nodes" subtitle={`${rows.length} of ${nodes.length} shown`}>
      <NodeFilterControls
        nodes={nodes}
        fedMap={fedMap}
        filters={filters}
        set={set}
        reset={reset}
        activeCount={activeCount}
      />
      <NodeBulkBar
        noun="nodes"
        nodes={selectedNodes}
        selection={selection}
        visibleKeys={visibleKeys}
        runner={runner}
      />
      <TableShell
        head={
          <>
            <SelectHeader visibleKeys={visibleKeys} selection={selection} />
            <Th>Name / Class</Th>
            <Th>Arch &amp; Formats</Th>
            <Th>CPU (free/max)</Th>
            <Th>Mem (free/max GB)</Th>
            <Th>VRAM (free/max GB)</Th>
            <Th>Health</Th>
          </>
        }
        empty={
          rows.length === 0 ? (
            <EmptyRow colSpan={7}>
              {snapshot ? 'No nodes match the filters.' : 'Waiting for snapshot…'}
            </EmptyRow>
          ) : undefined
        }
      >
        {rows.map((n) => {
          const eff = n.effective ?? {}
          const dyn = n.dyn ?? {}
          const resv = Object.keys(dyn.reservations ?? {}).length
          const fed = fedMap[n.name] ?? n.labels?.federation ?? n.labels?.zone
          const derate = Number(dyn.thermal_derate ?? 0)
          const picked = selection.selected.has(n.name)
          return (
            <tr
              key={n.name}
              className={picked ? 'bg-[var(--color-chip-info-bg)]/40' : 'hover:bg-[var(--color-row-hover)]'}
            >
              <SelectCell id={n.name} selection={selection} label={n.name} />
              <Td>
                <Mono className="text-[13px]">{n.name}</Mono>
                <div className="text-xs text-muted-2">{n.class}</div>
              </Td>
              <Td>
                <div>{n.arch ?? '—'}</div>
                <div className="mt-0.5">
                  {(n.formats_supported ?? []).map((f) => (
                    <Tag key={f}>{f}</Tag>
                  ))}
                </div>
              </Td>
              <Td>
                {fmt(eff.free_cpu_cores)} / {fmt(eff.max_cpu_cores)}
              </Td>
              <Td>
                {fmt(eff.free_mem_gb)} / {fmt(eff.max_mem_gb)}
              </Td>
              <Td>
                {fmt(eff.free_gpu_vram_gb)} / {fmt(eff.max_gpu_vram_gb)}
              </Td>
              <Td>
                <div className="flex flex-wrap gap-1">
                  {dyn.down && <Badge tone="bad">DOWN</Badge>}
                  {derate > 0 && <Badge tone="warn">DERATE {Math.round(derate * 100)}%</Badge>}
                  {resv > 0 && <Badge tone="good">{resv} resv</Badge>}
                </div>
                {fed && <div className="mt-1 text-[11px] text-muted-2">zone: {fed}</div>}
              </Td>
            </tr>
          )
        })}
      </TableShell>
    </Card>
  )
}
