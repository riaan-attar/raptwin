import { useEffect, useState } from 'react'
import { usePlans, useSnapshot } from './api/hooks'
import { useEventStream } from './api/useEventStream'
import { EventsFeed } from './components/EventsFeed'
import { FederationLinksTable, FederationsTable } from './components/FederationsPanel'
import { JobComposer } from './components/JobComposer'
import { LinksTable } from './components/LinksTable'
import { BlastRadiusPanel } from './components/manage/BlastRadiusPanel'
import { ChaosPanel, MaintenancePanel } from './components/manage/ChaosPanel'
import { JobManager } from './components/manage/JobManager'
import { LinkManager } from './components/manage/LinkManager'
import { NodeManager } from './components/manage/NodeManager'
import { ReservationsPanel } from './components/manage/ReservationsPanel'
import { WhatIfPanel } from './components/manage/WhatIfPanel'
import { NodesTable } from './components/NodesTable'
import { ObservationPanel } from './components/ObservationPanel'
import { Overview } from './components/Overview'
import { PlanStages } from './components/PlanStages'
import { RecentPlans } from './components/RecentPlans'
import { TopologyGraph } from './components/TopologyGraph'
import { Button } from './components/ui/primitives'
import { cn } from './lib/format'

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'nodes', label: 'Nodes' },
  { id: 'links', label: 'Links' },
  { id: 'jobs', label: 'Jobs' },
  { id: 'chaos', label: 'Chaos & Faults' },
  { id: 'whatif', label: 'What-if' },
  { id: 'reservations', label: 'Reservations' },
] as const
type TabId = (typeof TABS)[number]['id']

function tabFromHash(): TabId {
  const id = window.location.hash.replace(/^#\/?/, '')
  return TABS.some((t) => t.id === id) ? (id as TabId) : 'dashboard'
}

/** Current tab, mirrored in location.hash so reloads and back/forward keep it. */
function useHashTab(): [TabId, (tab: TabId) => void] {
  const [tab, setTab] = useState<TabId>(tabFromHash)
  useEffect(() => {
    const onHash = () => setTab(tabFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  return [tab, (next) => (window.location.hash = next === 'dashboard' ? '' : next)]
}

/** Fallback poll used only while the SSE stream is down. */
const FALLBACK_MS = 2000
/** Safety-net poll while streaming, to heal any missed event. */
const SAFETY_NET_MS = 30000

export default function App() {
  const [live, setLive] = useState(true)
  const [selectedPlan, setSelectedPlan] = useState(0)
  const [tab, setTab] = useHashTab()

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
        <nav className="-mb-3 mt-3 flex gap-1 overflow-x-auto" aria-label="Sections">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? 'page' : undefined}
              className={cn(
                'cursor-pointer whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold transition-colors',
                tab === t.id
                  ? 'border-accent text-[#cfe7ff]'
                  : 'border-transparent text-muted hover:text-ink',
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>
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

        {tab === 'dashboard' && (
          <>
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

            <EventsFeed intervalMs={intervalMs} />
          </>
        )}

        {tab === 'nodes' && <NodeManager snapshot={snapshot.data} />}

        {tab === 'links' && <LinkManager snapshot={snapshot.data} />}

        {tab === 'jobs' && <JobManager />}

        {tab === 'chaos' && (
          <>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <ChaosPanel />
              <div className="flex flex-col gap-4">
                <MaintenancePanel snapshot={snapshot.data} />
                <ObservationPanel snapshot={snapshot.data} />
              </div>
            </div>
            <BlastRadiusPanel />
            <EventsFeed intervalMs={intervalMs} />
          </>
        )}

        {tab === 'whatif' && <WhatIfPanel snapshot={snapshot.data} />}

        {tab === 'reservations' && <ReservationsPanel snapshot={snapshot.data} />}
      </main>
    </div>
  )
}
