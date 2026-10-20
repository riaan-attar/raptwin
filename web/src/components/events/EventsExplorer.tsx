import { useMemo, useState } from 'react'
import { useEvents } from '../../api/hooks'
import type { FabricEvent } from '../../api/types'
import { cn } from '../../lib/format'
import { Badge, Button, Card, Mono, inputCls } from '../ui/primitives'

type Tone = 'good' | 'warn' | 'bad' | 'info' | 'neutral'

/** "fabric.run.completed" -> "run": the second segment names the event family. */
function eventFamily(type: string): string {
  return type.split('.')[1] ?? 'other'
}

function toneFor(type: string): Tone {
  if (type === 'fabric.run.completed') return 'good'
  if (type === 'fabric.run.cancelled' || type === 'fabric.run.timer') return 'warn'
  if (type === 'fabric.run.started') return 'info'
  if (type.includes('selfheal') || type.includes('guardian')) return 'warn'
  if (type.includes('reservation.created')) return 'good'
  if (type.includes('reservation.released')) return 'info'
  if (type.includes('observe') || type.includes('restarted') || type.includes('overrides')) return 'bad'
  return 'neutral'
}

const SUMMARY_KEYS = ['job_id', 'reason', 'released', 'duration_s', 'remaining_s', 'strategy', 'node', 'reservation_id', 'changes', 'reliability', 'loss_pct']

function summarise(evt: FabricEvent): string {
  const d = (evt.data ?? {}) as Record<string, unknown>
  return SUMMARY_KEYS.flatMap((k) => {
    const v = d[k]
    return v === undefined || v === null ? [] : [`${k}=${typeof v === 'object' ? JSON.stringify(v) : String(v)}`]
  })
    .slice(0, 4)
    .join(' · ')
}

const WINDOWS = [100, 250, 500]

/** The twin's event feed with family chips, search, pause and a raw view of each CloudEvent. */
export function EventsExplorer({ intervalMs }: { intervalMs: number }) {
  const [limit, setLimit] = useState(250)
  const [families, setFamilies] = useState<Set<string>>(new Set())
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [frozen, setFrozen] = useState<FabricEvent[] | null>(null)

  const live = useEvents({ intervalMs, limit })
  const source = frozen ?? [...(live.data?.events ?? [])].reverse()

  const counts = useMemo(() => {
    const c = new Map<string, number>()
    for (const e of source) c.set(eventFamily(e.type), (c.get(eventFamily(e.type)) ?? 0) + 1)
    return [...c.entries()].sort((a, b) => b[1] - a[1])
  }, [source])

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return source.filter((e) => {
      if (families.size > 0 && !families.has(eventFamily(e.type))) return false
      return !needle || `${e.type} ${e.subject ?? ''} ${JSON.stringify(e.data)}`.toLowerCase().includes(needle)
    })
  }, [source, families, q])

  const toggle = (f: string) =>
    setFamilies((prev) => {
      const next = new Set(prev)
      if (next.has(f)) next.delete(f)
      else next.add(f)
      return next
    })

  return (
    <Card
      title="Twin events"
      subtitle={`${rows.length} of ${source.length} shown · CloudEvents from the twin${frozen ? ' · paused, not updating' : ''}`}
      actions={
        <>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            aria-label="Events to load"
            className={`${inputCls.replace('w-full', '')} w-auto`}
          >
            {WINDOWS.map((w) => (
              <option key={w} value={w}>
                Last {w}
              </option>
            ))}
          </select>
          <Button variant={frozen ? 'good' : 'default'} onClick={() => setFrozen(frozen ? null : source)}>
            {frozen ? 'Resume' : 'Pause'}
          </Button>
        </>
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search type, subject or data (try a run id)…"
          aria-label="Search events"
          className={`${inputCls.replace('w-full', '')} w-full sm:w-80`}
        />
        {counts.map(([f, n]) => (
          <button
            key={f}
            onClick={() => toggle(f)}
            aria-pressed={families.has(f)}
            className={cn(
              'cursor-pointer rounded-lg border px-2 py-1 text-[11px] font-semibold transition-colors',
              families.has(f)
                ? 'border-[var(--color-chip-info-border)] bg-[var(--color-chip-info-bg)] text-[var(--color-chip-info-text)]'
                : 'border-edge-2 text-muted hover:text-ink',
            )}
          >
            {f} <span className="opacity-60">{n}</span>
          </button>
        ))}
        <Button
          variant="ghost"
          className="px-2 py-1 text-xs"
          disabled={families.size === 0 && !q}
          onClick={() => {
            setFamilies(new Set())
            setQ('')
          }}
        >
          Reset filters
        </Button>
      </div>

      <div className="max-h-[560px] overflow-auto">
        {rows.length === 0 && (
          <p className="py-6 text-center text-xs text-muted-2">
            {live.isLoading ? 'Loading events…' : source.length ? 'No events match the filters.' : 'No events recorded yet.'}
          </p>
        )}
        <ul className="flex flex-col gap-1.5">
          {rows.map((evt) => {
            const expanded = open === evt.id
            return (
              <li key={evt.id} className="rounded-lg border border-[var(--color-panel2-border)] bg-panel-2">
                <div className="flex items-start gap-2 px-2.5 py-1.5">
                  <button
                    onClick={() => setOpen(expanded ? null : evt.id)}
                    aria-expanded={expanded}
                    aria-label={`${expanded ? 'Collapse' : 'Expand'} ${evt.type}`}
                    className="cursor-pointer pt-0.5 text-xs text-muted hover:text-ink"
                  >
                    {expanded ? '▾' : '▸'}
                  </button>
                  <Badge tone={toneFor(evt.type)}>{evt.type.replace(/^fabric\./, '')}</Badge>
                  <div className="min-w-0 flex-1">
                    {evt.subject && (
                      <button
                        onClick={() => setQ(evt.subject ?? '')}
                        title="Show only events about this"
                        className="cursor-pointer text-left hover:underline"
                      >
                        <Mono className="text-[11px]">{evt.subject}</Mono>
                      </button>
                    )}
                    <div className="truncate text-[11px] text-muted-2">{summarise(evt)}</div>
                  </div>
                  <span className="shrink-0 text-[10px] text-muted-2">{evt.time ? new Date(evt.time).toLocaleTimeString([], { hour12: false }) : ''}</span>
                </div>
                {expanded && (
                  <pre className="overflow-x-auto border-t border-[var(--color-panel2-border)] px-3 py-2 font-mono text-[11px] leading-relaxed text-[var(--color-code-text)]">
                    {JSON.stringify(evt, null, 2)}
                  </pre>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </Card>
  )
}
