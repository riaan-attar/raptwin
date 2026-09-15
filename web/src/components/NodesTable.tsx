import { useMemo, useState } from 'react'
import type { Snapshot } from '../api/types'
import { fmt } from '../lib/format'
import { Badge, Card, EmptyRow, Mono, Tag, TableShell, Td, Th } from './ui/primitives'

export function NodesTable({ snapshot }: { snapshot?: Snapshot }) {
  const [query, setQuery] = useState('')
  const [arch, setArch] = useState('')

  const fedMap = snapshot?.node_federations ?? {}

  const arches = useMemo(() => {
    const set = new Set<string>()
    for (const n of snapshot?.nodes ?? []) if (n.arch) set.add(n.arch)
    return [...set].sort()
  }, [snapshot])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (snapshot?.nodes ?? []).filter((n) => {
      if (arch && n.arch !== arch) return false
      if (!q) return true
      const fed = fedMap[n.name] ?? ''
      const hay = `${n.name} ${n.class ?? ''} ${n.arch ?? ''} ${fed} ${JSON.stringify(
        n.labels ?? {},
      )}`.toLowerCase()
      return hay.includes(q)
    })
  }, [snapshot, query, arch, fedMap])

  return (
    <Card
      title="Nodes"
      subtitle={`${rows.length} of ${snapshot?.nodes.length ?? 0} shown`}
      actions={
        <>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by name / arch / label…"
            className="w-56 rounded-lg border border-edge-2 bg-[#0e1420] px-2.5 py-1.5 text-sm outline-none focus:border-[#3a5575]"
          />
          <select
            value={arch}
            onChange={(e) => setArch(e.target.value)}
            className="rounded-lg border border-edge-2 bg-[#0e1420] px-2.5 py-1.5 text-sm outline-none focus:border-[#3a5575]"
          >
            <option value="">Arch: All</option>
            {arches.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </>
      }
    >
      <TableShell
        head={
          <>
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
            <EmptyRow colSpan={6}>
              {snapshot ? 'No nodes match the filter.' : 'Waiting for snapshot…'}
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
          return (
            <tr key={n.name} className="hover:bg-[#0f1520]">
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
