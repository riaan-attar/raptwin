import { useMemo, useState } from 'react'
import { useCancelRun, useFinishAllRuns, useFinishRun, useRunTimer } from '../../api/hooks'
import type { JobRun } from '../../api/types'
import { useSelection } from '../../lib/useSelection'
import { Button, Card } from '../ui/primitives'
import { BulkBar, type BulkNotice } from '../ui/selection'
import { RunCard } from './RunCard'

/** The running jobs, their timers and controls. All run control goes through here. */
export function RunningJobs({ runs, serverNow }: { runs: JobRun[]; serverNow: number }) {
  const finish = useFinishRun()
  const cancel = useCancelRun()
  const timer = useRunTimer()
  const finishAll = useFinishAllRuns()
  const [notice, setNotice] = useState<BulkNotice | null>(null)

  const ids = useMemo(() => runs.map((r) => r.run_id), [runs])
  const selection = useSelection(ids)
  const busy = finish.isPending || cancel.isPending || timer.isPending || finishAll.isPending

  async function act(label: string, targets: string[], fn: (id: string) => Promise<unknown>) {
    const results = await Promise.allSettled(targets.map(fn))
    const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    setNotice(
      failed.length
        ? { tone: 'err', text: `${label}: ${failed.length} of ${targets.length} failed (${(failed[0].reason as Error).message}).` }
        : { tone: 'ok', text: `${label}: ${targets.length} job${targets.length === 1 ? '' : 's'}.` },
    )
  }

  const actions = {
    busy,
    onFinish: (id: string) => void act('Finished', [id], (i) => finish.mutateAsync(i)),
    onCancel: (id: string) => {
      if (window.confirm(`Cancel ${id}? Its reservations are freed immediately.`)) void act('Cancelled', [id], (i) => cancel.mutateAsync(i))
    },
    onExtend: (id: string, s: number) => void act(`Extended by ${s} s`, [id], (i) => timer.mutateAsync({ id: i, extendS: s })),
    onSetRemaining: (id: string, s: number) =>
      void act(`Timer set to ${s} s`, [id], (i) => timer.mutateAsync({ id: i, remainingS: s })),
  }

  const picked = [...selection.selected]
  const confirmMany = (verb: string) => picked.length < 3 || window.confirm(`${verb} ${picked.length} running jobs?`)

  return (
    <Card
      title="Running jobs"
      subtitle={`${runs.length} running · each holds its reservations until the timer ends, then frees them`}
      actions={
        <Button
          variant="bad"
          disabled={busy || runs.length === 0}
          onClick={() => {
            if (window.confirm(`End all ${runs.length} running jobs now and free their reservations?`)) {
              void finishAll.mutateAsync().then(
                (r) => setNotice({ tone: 'ok', text: `Finished ${r.finished} job(s).` }),
                (e: Error) => setNotice({ tone: 'err', text: e.message }),
              )
            }
          }}
        >
          Finish all
        </Button>
      }
    >
      <BulkBar
        noun="jobs"
        selection={selection}
        visibleKeys={ids}
        notice={notice}
        onDismissNotice={() => setNotice(null)}
        pending={busy}
      >
        <Button variant="good" disabled={busy} onClick={() => confirmMany('Finish') && void act('Finished', picked, (i) => finish.mutateAsync(i))}>
          Finish selected
        </Button>
        <Button variant="bad" disabled={busy} onClick={() => confirmMany('Cancel') && void act('Cancelled', picked, (i) => cancel.mutateAsync(i))}>
          Cancel selected
        </Button>
        <Button disabled={busy} onClick={() => void act('Extended by 30 s', picked, (i) => timer.mutateAsync({ id: i, extendS: 30 }))}>
          +30 s
        </Button>
        <Button disabled={busy} onClick={() => void act('Extended by 1 min', picked, (i) => timer.mutateAsync({ id: i, extendS: 60 }))}>
          +1 min
        </Button>
      </BulkBar>

      {runs.length === 0 ? (
        <p className="rounded-lg border border-dashed border-edge-2 px-4 py-8 text-center text-sm text-muted-2">
          No job is running. Commit a plan (untick Dry run in Plan a Job) and it appears here with its timer.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {runs.map((run) => (
            <RunCard
              key={run.run_id}
              run={run}
              serverNow={serverNow}
              actions={actions}
              checkbox={
                <input
                  type="checkbox"
                  checked={selection.selected.has(run.run_id)}
                  aria-label={`Select ${run.run_id}`}
                  onChange={() => selection.toggle(run.run_id)}
                  className="h-4 w-4 cursor-pointer accent-[var(--color-accent-strong)]"
                />
              }
            />
          ))}
        </div>
      )}
    </Card>
  )
}
