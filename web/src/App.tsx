import { useState } from 'react'
import { usePlans, useSnapshot } from './api/hooks'
import { useEventStream } from './api/useEventStream'
import { EventsFeed } from './components/EventsFeed'
import { FederationLinksTable, FederationsTable } from './components/FederationsPanel'
import { JobComposer } from './components/JobComposer'
import { LinksTable } from './components/LinksTable'
import { NodesTable } from './components/NodesTable'
import { ObservationPanel } from './components/ObservationPanel'
import { Overview } from './components/Overview'
import { PlanStages } from './components/PlanStages'
import { RecentPlans } from './components/RecentPlans'
import { TopologyGraph } from './components/TopologyGraph'
import { Button } from './components/ui/primitives'
import { cn } from './lib/format'

/** Fallback poll used only while the SSE stream is down. */
const FALLBACK_MS = 2000
/** Safety-net poll while streaming, to heal any missed event. */
const SAFETY_NET_MS = 30000

export default function App() {
  const [live, setLive] = useState(true)
  const [selectedPlan, setSelectedPlan] = useState(0)

  const stream = useEventStream({ enabled: live })
  const streaming = stream.status === 'live'
  // SSE drives refreshes; polling only covers the gap when it isn't connected.
  const intervalMs = !live ? 0 : streaming ? SAFETY_NET_MS : FALLBACK_MS

  const snapshot = useSnapshot({ intervalMs })
  const plans = usePlans({ intervalMs })

  const activePlan = plans.data?.[selectedPlan] ?? plans.data?.[0]
  const connected = !snapshot.isError && snapshot.data !== undefined

  return (
    <div className="min-h-full bg-bg">
      <header className="sticky top-0 z-10 border-b border-edge bg-gradient-to-b from-[#0f1722] to-bg px-5 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-wide">
              RAP Twin <span className="text-sm font-normal text-muted-2">— Fabric Dashboard</span>
            </h1>
            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-2">
              <span
                className={cn('inline-block size-2 rounded-full', connected ? 'bg-good' : 'bg-bad')}
              />
              {connected ? 'Connected to DT API' : 'Disconnected'}
              <span className="text-[#33475f]">·</span>
              <span
                className={cn(
                  'inline-block size-2 rounded-full',
                  !live
                    ? 'bg-muted-2'
                    : streaming
                      ? 'bg-accent'
                      : stream.status === 'connecting'
                        ? 'bg-warn'
                        : 'bg-bad',
                )}
              />
              {!live
                ? 'stream paused'
                : streaming
                  ? `live stream · ${stream.eventCount} events`
                  : stream.status === 'connecting'
                    ? 'stream connecting…'
                    : `stream offline · polling ${FALLBACK_MS / 1000}s`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant={live ? 'good' : 'default'} onClick={() => setLive((v) => !v)}>
              {live ? 'Live' : 'Paused'}
            </Button>
            <Button
              onClick={() => {
                void snapshot.refetch()
                void plans.refetch()
              }}
            >
              Refresh
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-[1600px] flex-col gap-4 p-5">
        {snapshot.isError && (
          <div className="rounded-xl border border-[#5e1b1b] bg-[#2a1414] p-4 text-sm text-[#ffb4b4]">
            <strong className="font-semibold">Cannot reach the Digital Twin API.</strong>
            <p className="mt-1 text-[#e5a3a3]">{(snapshot.error as Error)?.message}</p>
            <p className="mt-2 text-xs text-[#d09595]">
              Start it with{' '}
              <code className="rounded bg-black/30 px-1 py-0.5 font-mono">
                python -m dt.api --host 127.0.0.1 --port 8080
              </code>
            </p>
          </div>
        )}

        <Overview snapshot={snapshot.data} lastPlan={activePlan} />

        <TopologyGraph snapshot={snapshot.data} lastPlan={activePlan} />

        <JobComposer />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <RecentPlans
            plans={plans.data}
            selectedIndex={selectedPlan}
            onSelect={setSelectedPlan}
          />
          <PlanStages plan={activePlan} />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <NodesTable snapshot={snapshot.data} />
          <LinksTable snapshot={snapshot.data} />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <FederationsTable snapshot={snapshot.data} />
          <FederationLinksTable snapshot={snapshot.data} />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <ObservationPanel snapshot={snapshot.data} />
          <EventsFeed intervalMs={intervalMs} />
        </div>
      </main>
    </div>
  )
}
