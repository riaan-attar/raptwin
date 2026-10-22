import { useEffect, useMemo, useState, type ComponentType } from 'react'
import { cn } from '../lib/format'
import { goToDoc } from './docs/nav'
import { Analysis, Chaos, Dashboard, Planning, Telemetry } from './docs/pages/guides'
import { Architecture, Jobs, Nodes, State, Topology } from './docs/pages/concepts'
import { ApiReference, Configuration, Deployment, Results, Troubleshooting } from './docs/pages/reference'
import { Introduction, Quickstart } from './docs/pages/start'

/**
 * In-app documentation: a small multi-page site inside the Docs tab.
 *
 * Static content only (no API calls), so it renders even when the Digital Twin
 * API is down. The page lives in the URL hash as "#docs/<page>"; App.tsx picks
 * the tab from the first segment, this component reads the second.
 * In-page jumps use scrollIntoView rather than href="#id" because an anchor
 * hash would be read by the app router as a tab change.
 */

type DocPageDef = {
  id: string
  group: string
  title: string
  keywords: string
  Component: ComponentType
}

const PAGES: DocPageDef[] = [
  { id: 'introduction', group: 'Getting started', title: 'Introduction', keywords: 'overview problem closed loop concepts glossary', Component: Introduction },
  { id: 'quickstart', group: 'Getting started', title: 'Quickstart', keywords: 'install run setup first plan make targets tests', Component: Quickstart },
  { id: 'architecture', group: 'Concepts', title: 'Architecture', keywords: 'modules diagram design decisions files', Component: Architecture },
  { id: 'state', group: 'Concepts', title: 'Digital twin state', keywords: 'snapshot events cloudevents overrides dyn effective controllers', Component: State },
  { id: 'nodes', group: 'Concepts', title: 'Node descriptors', keywords: 'yaml gpu cpu labels zone generate validate import', Component: Nodes },
  { id: 'topology', group: 'Concepts', title: 'Topology and links', keywords: 'sites link profiles pricing energy scenarios', Component: Topology },
  { id: 'jobs', group: 'Concepts', title: 'Jobs', keywords: 'stages deadline formats schema catalogue submit', Component: Jobs },
  { id: 'dashboard', group: 'Guides', title: 'Dashboard guide', keywords: 'tabs panels workflows header theme', Component: Dashboard },
  { id: 'planning', group: 'Guides', title: 'Planning', keywords: 'strategies dry run cost carbon mdp tchebycheff rl-markov greedy resilient', Component: Planning },
  { id: 'chaos', group: 'Guides', title: 'Chaos and resilience', keywords: 'faults scenarios self-healing gate blast radius ci', Component: Chaos },
  { id: 'analysis', group: 'Guides', title: 'Analysis tools', keywords: 'what-if monte carlo benchmark bundle import docker exporters', Component: Analysis },
  { id: 'telemetry', group: 'Guides', title: 'Telemetry ingestion', keywords: 'observe mqtt noise payload topic', Component: Telemetry },
  { id: 'api', group: 'Reference', title: 'API reference', keywords: 'routes endpoints rest sse curl status auth', Component: ApiReference },
  { id: 'configuration', group: 'Reference', title: 'Configuration', keywords: 'environment variables env files defaults', Component: Configuration },
  { id: 'results', group: 'Reference', title: 'Measured results', keywords: 'benchmark table sla jct energy', Component: Results },
  { id: 'deployment', group: 'Reference', title: 'Deployment and security', keywords: 'caddy gunicorn systemd api key tls ci', Component: Deployment },
  { id: 'troubleshooting', group: 'Reference', title: 'Troubleshooting and FAQ', keywords: 'errors fixes questions problems', Component: Troubleshooting },
]

const GROUPS = ['Getting started', 'Concepts', 'Guides', 'Reference']

function pageFromHash(): string {
  const id = window.location.hash.replace(/^#\/?/, '').split('/')[1] ?? ''
  return PAGES.some((p) => p.id === id) ? id : PAGES[0].id
}

function usePage(): string {
  const [page, setPage] = useState(pageFromHash)
  useEffect(() => {
    const onHash = () => setPage(pageFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  return page
}

type Heading = { id: string; text: string }

function useOutline(pageId: string): [Heading[], string] {
  const [headings, setHeadings] = useState<Heading[]>([])
  const [active, setActive] = useState('')

  useEffect(() => {
    let io: IntersectionObserver | undefined
    // Read the headings after the page has committed; setting state in a frame callback
    // (not synchronously in the effect) avoids a cascading render.
    const frame = requestAnimationFrame(() => {
      const els = Array.from(document.querySelectorAll<HTMLElement>('article h2[id]'))
      setHeadings(els.map((el) => ({ id: el.id, text: el.textContent ?? '' })))
      setActive(els[0]?.id ?? '')
      if (!els.length) return
      io = new IntersectionObserver(
        (entries) => {
          const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
          if (visible[0]) setActive(visible[0].target.id)
        },
        { rootMargin: '-110px 0px -65% 0px' },
      )
      els.forEach((el) => io?.observe(el))
    })
    return () => {
      cancelAnimationFrame(frame)
      io?.disconnect()
    }
  }, [pageId])

  return [headings, active]
}

export function Docs() {
  const pageId = usePage()
  const [query, setQuery] = useState('')
  const index = PAGES.findIndex((p) => p.id === pageId)
  const current = PAGES[index]

  useEffect(() => {
    document.title = `${current.title} — RAP Twin Docs | Riaan Attar`
  }, [current.title])
  const Current = current.Component
  const [outline, activeHeading] = useOutline(pageId)

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [pageId])

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return PAGES
    return PAGES.filter((p) => `${p.title} ${p.group} ${p.keywords}`.toLowerCase().includes(q))
  }, [query])

  const prev = PAGES[index - 1]
  const next = PAGES[index + 1]
  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[230px_minmax(0,1fr)] xl:grid-cols-[230px_minmax(0,1fr)_200px]">
      <nav aria-label="Documentation pages" className="lg:sticky lg:top-28 lg:max-h-[calc(100vh-8rem)] lg:self-start lg:overflow-y-auto">
        <select
          value={pageId}
          onChange={(e) => goToDoc(e.target.value)}
          aria-label="Documentation page"
          className="w-full rounded-lg border border-edge-2 bg-[var(--color-input-bg)] px-2.5 py-2 text-sm font-semibold text-ink lg:hidden"
        >
          {GROUPS.map((group) => (
            <optgroup key={group} label={group}>
              {PAGES.filter((p) => p.group === group).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <div className="hidden lg:block">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search docs…"
          aria-label="Search documentation"
          className="mb-3 w-full rounded-lg border border-edge-2 bg-[var(--color-input-bg)] px-2.5 py-1.5 text-sm text-ink outline-none focus:border-[var(--color-input-focus-border)]"
        />
        {matches.length === 0 && <p className="px-1 text-xs text-muted-2">No page matches &quot;{query}&quot;.</p>}
        {GROUPS.map((group) => {
          const items = matches.filter((p) => p.group === group)
          if (!items.length) return null
          return (
            <div key={group} className="mb-3">
              <div className="mb-1 px-3 text-[11px] font-bold uppercase tracking-wider text-muted-2">{group}</div>
              <ul className="flex flex-col gap-0.5">
                {items.map((p) => (
                  <li key={p.id}>
                    <button
                      onClick={() => goToDoc(p.id)}
                      aria-current={p.id === pageId ? 'page' : undefined}
                      className={cn(
                        'w-full cursor-pointer rounded-lg border px-3 py-1.5 text-left text-sm font-semibold transition-colors',
                        p.id === pageId
                          ? 'border-[var(--color-chip-info-border)] bg-[var(--color-chip-info-bg)] text-[var(--color-chip-info-text)]'
                          : 'border-transparent text-muted hover:text-ink',
                      )}
                    >
                      {p.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
        </div>
      </nav>

      <main className="min-w-0">
        <div className="mb-3 text-xs text-muted-2">
          Docs / {current.group} / <span className="text-muted">{current.title}</span>
        </div>
        <Current />
        <div className="mt-10 grid grid-cols-1 gap-3 border-t border-edge pt-4 sm:grid-cols-2">
          {prev ? (
            <button
              onClick={() => goToDoc(prev.id)}
              className="cursor-pointer rounded-xl border border-edge bg-panel p-3 text-left hover:border-[var(--color-btn-border-hover)]"
            >
              <div className="text-[11px] text-muted-2">Previous</div>
              <div className="font-semibold text-ink">&larr; {prev.title}</div>
            </button>
          ) : (
            <span />
          )}
          {next && (
            <button
              onClick={() => goToDoc(next.id)}
              className="cursor-pointer rounded-xl border border-edge bg-panel p-3 text-right hover:border-[var(--color-btn-border-hover)]"
            >
              <div className="text-[11px] text-muted-2">Next</div>
              <div className="font-semibold text-ink">{next.title} &rarr;</div>
            </button>
          )}
        </div>
      </main>

      <aside aria-label="On this page" className="hidden xl:sticky xl:top-28 xl:block xl:self-start">
        {outline.length > 0 && (
          <>
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-2">On this page</div>
            <ul className="flex flex-col gap-0.5 border-l border-edge">
              {outline.map((h) => (
                <li key={h.id}>
                  <button
                    onClick={() => jump(h.id)}
                    className={cn(
                      '-ml-px w-full cursor-pointer border-l-2 px-3 py-1 text-left text-xs transition-colors',
                      activeHeading === h.id
                        ? 'border-accent font-semibold text-[var(--color-chip-info-text)]'
                        : 'border-transparent text-muted hover:text-ink',
                    )}
                  >
                    {h.text}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </aside>
    </div>
  )
}
