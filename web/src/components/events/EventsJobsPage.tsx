import { useMemo } from 'react'
import { useRuns } from '../../api/hooks'
import { useNow } from '../../lib/time'
import { Notice } from '../ui/primitives'
import { EventsExplorer } from './EventsExplorer'
import { RecentRuns } from './RecentRuns'
import { RunningJobs } from './RunningJobs'
import { RunsSummary } from './RunsSummary'

/** "Events & Jobs": what is running right now, its timers and controls, and the event feed. */
export function EventsJobsPage({ intervalMs }: { intervalMs: number }) {
  const runs = useRuns({ intervalMs })
  const now = useNow(250)

  // Client time -> server time, so countdowns are right even if the clocks differ.
  const offset = runs.data ? runs.data.now_ms - runs.dataUpdatedAt : 0
  const serverNow = now + offset

  const running = useMemo(() => (runs.data?.runs ?? []).filter((r) => r.state === 'running'), [runs.data])
  const finished = useMemo(() => (runs.data?.runs ?? []).filter((r) => r.state !== 'running'), [runs.data])

  return (
    <div className="flex flex-col gap-4">
      {runs.isError && <Notice tone="err">{(runs.error as Error).message}</Notice>}
      <RunsSummary
        running={running}
        reserved={runs.data?.reserved_by_running ?? 0}
        settings={runs.data?.settings}
        serverNow={serverNow}
      />
      <RunningJobs runs={running} serverNow={serverNow} />
      <div className="grid grid-cols-1 gap-4">
        <RecentRuns runs={finished} />
        <EventsExplorer intervalMs={intervalMs} />
      </div>
    </div>
  )
}
