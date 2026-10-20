import type { JobRun } from '../../api/types'
import { fmtClock } from '../../lib/time'
import { Badge, Card, EmptyRow, Mono, TableShell, Td, Th } from '../ui/primitives'

const REASON: Record<string, string> = {
  timer: 'timer ended',
  manual: 'finished manually',
  cancelled: 'cancelled',
}

export function RecentRuns({ runs }: { runs: JobRun[] }) {
  return (
    <Card title="Recent runs" subtitle="Finished and cancelled jobs (the last 200 are kept in memory)">
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
        empty={runs.length === 0 ? <EmptyRow colSpan={7}>Nothing has finished yet.</EmptyRow> : undefined}
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
