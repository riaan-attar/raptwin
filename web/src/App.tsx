import { useEffect, useRef, useState } from 'react'
import { usePlans, useSnapshot } from './api/hooks'
import { useEventStream } from './api/useEventStream'
import { Docs } from './components/Docs'
import { EventsFeed } from './components/EventsFeed'
import { EventsJobsPage } from './components/events/EventsJobsPage'
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
import { RestartTwinDialog } from './components/RestartTwinDialog'
import { RecentPlans } from './components/RecentPlans'
import { TopologyGraph } from './components/TopologyGraph'
import { Button, Notice } from './components/ui/primitives'
import { cn } from './lib/format'
import { useTheme } from './lib/theme'

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'nodes', label: 'Nodes' },
  { id: 'links', label: 'Links' },
  { id: 'jobs', label: 'Job Library' },
  { id: 'events', label: 'Events & Jobs' },
  { id: 'chaos', label: 'Chaos & Faults' },
  { id: 'whatif', label: 'What-if' },
  { id: 'reservations', label: 'Reservations' },
  { id: 'docs', label: 'Docs' },
] as const
type TabId = (typeof TABS)[number]['id']

function tabFromHash(): TabId {
  // "#docs/api" is tab "docs", page "api": only the first segment picks the tab.
  const id = window.location.hash.replace(/^#\/?/, '').split('/')[0]
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

/** Tracks horizontal scroll position of the tab nav so edge-fade hints and
 *  arrow buttons only show when there's actually more to scroll to, and
 *  keeps the active tab scrolled into view (e.g. after a reload lands
 *  on a hash further right than the viewport shows). */
function useNavScroll(activeTab: TabId) {
  const scrollerRef = useRef<HTMLElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const update = () => {
    const el = scrollerRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 2)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2)
  }

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    update()
    el.addEventListener('scroll', update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', update)
      ro.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const el = scrollerRef.current
    const active = el?.querySelector<HTMLElement>('[aria-current="page"]')
    active?.scrollIntoView({ inline: 'nearest', block: 'nearest' })
  }, [activeTab])

  const scrollBy = (dx: number) => scrollerRef.current?.scrollBy({ left: dx, behavior: 'smooth' })

  return { scrollerRef, canScrollLeft, canScrollRight, scrollBy }
}

/** Fallback poll used only while the SSE stream is down. */
const FALLBACK_MS = 2000
/** Safety-net poll while streaming, to heal any missed event. */
const SAFETY_NET_MS = 30000

const TAB_TITLES: Record<TabId, string> = {
  dashboard: 'RAP Twin — Distributed Fabric Dashboard | Riaan Attar',
  nodes: 'Nodes Management — RAP Twin Fabric Simulator | Riaan Attar',
  links: 'Fabric Links & Interconnects — RAP Twin | Riaan Attar',
  jobs: 'Job Composer & AI Workload Fitting — RAP Twin | Riaan Attar',
  events: 'Running Jobs, Job Timer & Twin Events — RAP Twin | Riaan Attar',
  chaos: 'Chaos Testing & Autonomous Self-Healing — RAP Twin | Riaan Attar',
  whatif: 'What-If Topology & Capacity Analysis — RAP Twin | Riaan Attar',
  reservations: 'Fabric Resource Reservations — RAP Twin | Riaan Attar',
  docs: 'Documentation: Architecture, Dashboard Guide and API Reference — RAP Twin | Riaan Attar',
}

export default function App() {
  const [live, setLive] = useState(true)
  const [selectedPlan, setSelectedPlan] = useState(0)
  const [restartOpen, setRestartOpen] = useState(false)
  const [restartNote, setRestartNote] = useState<string | null>(null)
  const [tab, setTab] = useHashTab()
  const { scrollerRef, canScrollLeft, canScrollRight, scrollBy } = useNavScroll(tab)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close the mobile menu on outside click, Escape, or navigating away.
  useEffect(() => {
    if (!menuOpen) return
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  useEffect(() => setMenuOpen(false), [tab])

  useEffect(() => {
    document.title = TAB_TITLES[tab] ?? 'RAP Twin — Distributed Fabric Digital Twin | Riaan Attar'
  }, [tab])

  const stream = useEventStream({ enabled: live })
  const streaming = stream.status === 'live'
  // SSE drives refreshes; polling only covers the gap when it isn't connected.
  const intervalMs = !live ? 0 : streaming ? SAFETY_NET_MS : FALLBACK_MS

  const [theme, toggleTheme] = useTheme()
  const snapshot = useSnapshot({ intervalMs })
  const plans = usePlans({ intervalMs })

  const activePlan = plans.data?.[selectedPlan] ?? plans.data?.[0]
  const connected = !snapshot.isError && snapshot.data !== undefined

  return (
    <div className="min-h-full bg-bg">
      <header className="sticky top-0 z-10 border-b border-edge bg-gradient-to-b from-header-grad to-bg px-5 py-3">
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
              <span className="text-muted-2">·</span>
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
            <Button variant="bad" onClick={() => setRestartOpen(true)} title="Rebuild the whole twin from disk">
              Restart
            </Button>
            <Button
              variant="ghost"
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              onClick={toggleTheme}
              className="!px-2"
            >
              {theme === 'dark' ? (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                </svg>
              ) : (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
                </svg>
              )}
            </Button>
          </div>
        </div>
        {/* Phone: a proper menu button + dropdown instead of a scrolling tab strip. */}
        <div ref={menuRef} className="relative mt-3 sm:hidden">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-haspopup="true"
            aria-label="Open section menu"
            className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-edge-2 bg-chip px-3 py-2 text-sm font-semibold text-ink"
          >
            <span className="flex items-center gap-2">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              {TABS.find((t) => t.id === tab)?.label}
            </span>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={cn('transition-transform', menuOpen && 'rotate-180')}
              aria-hidden="true"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {menuOpen && (
            <nav
              aria-label="Sections"
              className="absolute inset-x-0 top-full z-20 mt-1 flex flex-col overflow-hidden rounded-lg border border-edge-2 bg-panel shadow-[0_12px_30px_rgba(0,0,0,0.35)]"
            >
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  aria-current={tab === t.id ? 'page' : undefined}
                  className={cn(
                    'cursor-pointer border-l-2 px-4 py-2.5 text-left text-sm font-semibold transition-colors',
                    tab === t.id
                      ? 'border-accent bg-[var(--color-chip-info-bg)] text-[var(--color-chip-info-text)]'
                      : 'border-transparent text-muted hover:bg-row hover:text-ink',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </nav>
          )}
        </div>

        {/* Tablet and up: the horizontal tab strip, with edge-fade + arrow
            affordances for when even this width can't fit every tab. */}
        <div className="relative -mb-3 mt-3 hidden sm:block">
          <nav
            ref={scrollerRef}
            className="flex gap-1 overflow-x-auto scroll-smooth"
            aria-label="Sections"
          >
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                aria-current={tab === t.id ? 'page' : undefined}
                className={cn(
                  'shrink-0 cursor-pointer whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold transition-colors',
                  tab === t.id
                    ? 'border-accent text-[var(--color-chip-info-text)]'
                    : 'border-transparent text-muted hover:text-ink',
                )}
              >
                {t.label}
              </button>
            ))}
          </nav>

          {canScrollLeft && (
            <>
              <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-bg to-transparent" />
              <button
                aria-label="Scroll tabs left"
                onClick={() => scrollBy(-120)}
                className="absolute inset-y-0 left-0 flex cursor-pointer items-center px-1 text-muted hover:text-ink"
              >
                ‹
              </button>
            </>
          )}
          {canScrollRight && (
            <>
              <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-bg to-transparent" />
              <button
                aria-label="Scroll tabs right"
                onClick={() => scrollBy(120)}
                className="absolute inset-y-0 right-0 flex cursor-pointer items-center px-1 text-muted hover:text-ink"
              >
                ›
              </button>
            </>
          )}
        </div>
      </header>

      <main className="mx-auto flex max-w-[1600px] flex-col gap-4 p-5">
        {restartNote && (
          <Notice tone="ok" onDismiss={() => setRestartNote(null)}>
            {restartNote}
          </Notice>
        )}
        {restartOpen && (
          <RestartTwinDialog
            onClose={() => setRestartOpen(false)}
            onRestarted={(r) => {
              setRestartOpen(false)
              setSelectedPlan(0)
              setRestartNote(
                `Twin restarted: ${r.nodes} nodes and ${r.links} links reloaded; ${r.reservations_dropped} reservation(s) and ${r.plans_cleared} plan(s) cleared` +
                  (r.chaos_stopped ? '; chaos run stopped.' : '.'),
              )
            }}
          />
        )}
        {snapshot.isError && (
          <div className="rounded-xl border border-[var(--color-chip-danger-border)] bg-[var(--color-chip-danger-bg)] p-4 text-sm text-[var(--color-chip-danger-text)]">
            <strong className="font-semibold">Cannot reach the Digital Twin API.</strong>
            <p className="mt-1 text-[var(--color-chip-danger-text)]">{(snapshot.error as Error)?.message}</p>
            <p className="mt-2 text-xs text-[var(--color-chip-danger-text)]">
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

            <div className="grid grid-cols-1 gap-4">
              <FederationsTable snapshot={snapshot.data} />
              <FederationLinksTable snapshot={snapshot.data} />
            </div>

            <EventsFeed intervalMs={intervalMs} />
          </>
        )}

        {tab === 'nodes' && <NodeManager snapshot={snapshot.data} />}

        {tab === 'links' && <LinkManager snapshot={snapshot.data} />}

        {tab === 'jobs' && <JobManager />}

        {tab === 'events' && <EventsJobsPage intervalMs={intervalMs} />}

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

        {tab === 'docs' && <Docs />}
      </main>

      <footer className="mt-12 border-t border-edge bg-gradient-to-t from-[var(--color-footer-grad)] to-bg px-6 py-8 text-xs text-muted-2">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-ink">RAP Twin</span>
              <span>— Autonomous Distributed Fabric Simulator &amp; Digital Twin Engine</span>
            </div>
            <p className="mt-1 text-muted">
              Architected and Developed by{' '}
              <a
                href="https://github.com/riaan-attar"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-accent hover:underline"
              >
                Riaan Attar
              </a>{' '}
              · Official Domain:{' '}
              <a href="https://raptwin.seloraos.online" className="text-ink hover:underline">
                raptwin.seloraos.online
              </a>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-muted">
            <a href="#dashboard" onClick={() => setTab('dashboard')} className="hover:text-ink">Overview</a>
            <a href="#nodes" onClick={() => setTab('nodes')} className="hover:text-ink">Nodes</a>
            <a href="#links" onClick={() => setTab('links')} className="hover:text-ink">Links</a>
            <a href="#jobs" onClick={() => setTab('jobs')} className="hover:text-ink">Job Library</a>
            <a href="#events" onClick={() => setTab('events')} className="hover:text-ink">Events &amp; Jobs</a>
            <a href="#chaos" onClick={() => setTab('chaos')} className="hover:text-ink">Chaos</a>
            <a href="#whatif" onClick={() => setTab('whatif')} className="hover:text-ink">What-If</a>
            <a href="#reservations" onClick={() => setTab('reservations')} className="hover:text-ink">Reservations</a>
            <a href="#docs" onClick={() => setTab('docs')} className="hover:text-ink">Docs</a>
            <span className="text-edge-2">|</span>
            <a
              href="https://github.com/riaan-attar/raptwin"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              GitHub Source
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
