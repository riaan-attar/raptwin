import { useMemo, useState } from 'react'
import type { JobRun } from '../../api/types'
import { fmtClock } from '../../lib/time'
import { Badge, Button, Card, EmptyRow, Mono, TableShell, Td, Th, inputCls } from '../ui/primitives'

const REASON: Record<string, string> = {
  timer: 'timer ended',
  manual: 'finished manually',
  cancelled: 'cancelled',
}

export function RecentRuns({ runs: all }: { runs: JobRun[] }) {
  const [q, setQ] = useState('')
  const [result, setResult] = useState('')
  const [strategy, setStrategy] = useState('')

  const strategies = useMemo(() => [...new Set(all.map((r) => r.strategy).filter(Boolean))].sort(), [all])
  const runs = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return all.filter(
      (r) =>
        (!result || r.state === result) &&
        (!strategy || r.strategy === strategy) &&
        (!needle || `${r.run_id} ${r.job_id}`.toLowerCase().includes(needle)),
    )
  }, [all, q, result, strategy])
  const active = q !== '' || result !== '' || strategy !== ''

  return (
    <Card
      title="Recent runs"
      subtitle={`Finished and cancelled jobs (the last 200 are kept in memory)${active ? ` · ${runs.length} of ${all.length} shown` : ''}`}
      actions={
        <>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search run or job…"
            aria-label="Search runs"
            className={`${inputCls} w-44`}
          />
          <select value={result} onChange={(e) => setResult(e.target.value)} aria-label="Filter by result" className={`${inputCls} w-auto`}>
            <option value="">All results</option>
            <option value="completed">completed</option>
            <option value="cancelled">cancelled</option>
          </select>
          <select value={strategy} onChange={(e) => setStrategy(e.target.value)} aria-label="Filter by strategy" className={`${inputCls} w-auto`}>
            <option value="">All strategies</option>
            {strategies.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <Button
            variant="ghost"
            disabled={!active}
            onClick={() => {
              setQ('')
              setResult('')
              setStrategy('')
            }}
          >
            Reset filters
          </Button>
        </>
      }
    >
      <TableShell
        maxHeight="320px"
        head={
          <>
            <Th>Run</Th>
            <Th>Job</Th>
            <Th>Strategy</Th>
            <Th>Result</Th>
            <Th>Ran for</Th>
            <Th>Freed</Th>
            <Th>Finished</Th>
          </>
        }
        empty={runs.length === 0 ? <EmptyRow colSpan={7}>{all.length ? 'No runs match the filters.' : 'Nothing has finished yet.'}</EmptyRow> : undefined}
      >
        {runs.map((r) => (
          <tr key={r.run_id} className="hover:bg-[var(--color-row-hover)]">
            <Td>
              <Mono>{r.run_id}</Mono>
            </Td>
            <Td>
              <Mono>{r.job_id}</Mono>
            </Td>
            <Td>{r.strategy || '—'}</Td>
            <Td>
              <div className="flex flex-wrap items-center gap-1">
                <Badge tone={r.state === 'completed' ? 'good' : 'warn'}>{r.state}</Badge>
                <span className="text-[11px] text-muted-2">{REASON[r.end_reason ?? ''] ?? r.end_reason}</span>
              </div>
            </Td>
            <Td>
              {fmtClock(r.elapsed_s)} / {fmtClock(r.duration_s)}
            </Td>
            <Td>{r.released ?? 0} reservation(s)</Td>
            <Td>{r.finished_ms ? new Date(r.finished_ms).toLocaleTimeString() : '—'}</Td>
          </tr>
        ))}
      </TableShell>
    </Card>
  )
}
