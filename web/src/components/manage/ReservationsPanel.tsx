import { useMemo, useState } from 'react'
import { useRelease } from '../../api/hooks'
import type { Snapshot } from '../../api/types'
import { fmt, fmtDateTime } from '../../lib/format'
import { Button, Card, EmptyRow, Mono, Notice, TableShell, Td, Th, inputCls } from '../ui/primitives'

export function ReservationsPanel({ snapshot }: { snapshot?: Snapshot }) {
  const release = useRelease()
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)

  const all = useMemo(
    () =>
      (snapshot?.nodes ?? [])
        .flatMap((n) =>
          Object.entries(n.dyn?.reservations ?? {}).map(([id, info]) => ({ node: n.name, id, ...info })),
        )
        .sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0)),
    [snapshot],
  )
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? all.filter((r) => `${r.node} ${r.id}`.toLowerCase().includes(q)) : all
  }, [all, query])

  async function doRelease(items: { node: string; id: string }[], label: string) {
    if (items.length > 1 && !window.confirm(`Release ${items.length} reservations?`)) return
    try {
      const res = await release.mutateAsync(items.map((r) => ({ node: r.node, reservation_id: r.id })))
      const ok = res.released.filter((r) => r.released).length
      setNotice({ tone: 'ok', text: `${label}: released ${ok} of ${items.length}.` })
    } catch (e) {
      setNotice({ tone: 'err', text: (e as Error).message })
    }
  }

  return (
    <Card
      title="Reservations"
      subtitle={`${all.length} active · capacity held by committed (non dry-run) plans`}
      actions={
        <>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by node / id…"
            aria-label="Filter reservations"
            className={`${inputCls} w-48`}
          />
          <Button
            variant="bad"
            disabled={!rows.length || release.isPending}
            onClick={() => void doRelease(rows, query ? 'Filtered' : 'All')}
          >
            Release {query ? 'filtered' : 'all'}
          </Button>
        </>
      }
    >
      {notice && (
        <div className="mb-3">
          <Notice tone={notice.tone} onDismiss={() => setNotice(null)}>
            {notice.text}
          </Notice>
        </div>
      )}
      <TableShell
        maxHeight="520px"
        head={
          <>
            <Th>Reservation</Th>
            <Th>Node</Th>
            <Th>CPU</Th>
            <Th>Mem (GB)</Th>
            <Th>VRAM (GB)</Th>
            <Th>Created</Th>
            <Th className="text-right">Action</Th>
          </>
        }
        empty={
          rows.length === 0 ? (
            <EmptyRow colSpan={7}>
              {all.length ? 'No reservations match the filter.' : 'No active reservations. Plan a job with dry run off to create some.'}
            </EmptyRow>
          ) : undefined
        }
      >
        {rows.map((r) => (
          <tr key={`${r.node}:${r.id}`} className="hover:bg-[#0f1520]">
            <Td className="whitespace-nowrap">
              <Mono>{r.id}</Mono>
            </Td>
            <Td className="whitespace-nowrap">
              <Mono>{r.node}</Mono>
            </Td>
            <Td>{fmt(r.cpu_cores, 1)}</Td>
            <Td>{fmt(r.mem_gb, 1)}</Td>
            <Td>{fmt(r.gpu_vram_gb, 1)}</Td>
            <Td className="text-xs text-muted">{fmtDateTime(r.ts)}</Td>
            <Td className="text-right">
              <Button
                className="px-2 py-1 text-xs"
                disabled={release.isPending}
                onClick={() => void doRelease([r], r.id)}
              >
                Release
              </Button>
            </Td>
          </tr>
        ))}
      </TableShell>
    </Card>
  )
}
