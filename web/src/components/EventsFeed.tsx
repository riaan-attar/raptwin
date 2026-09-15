import { useEvents } from '../api/hooks'
import type { FabricEvent } from '../api/types'
import { Badge, Card, Mono } from './ui/primitives'

/** Colour-code the twin's CloudEvent families. */
function toneFor(type: string): 'good' | 'warn' | 'bad' | 'info' | 'neutral' {
  if (type.includes('selfheal')) return 'warn'
  if (type.includes('guardian')) return 'warn'
  if (type.includes('reservation.created')) return 'good'
  if (type.includes('reservation.released')) return 'info'
  if (type.includes('observe')) return 'bad'
  return 'neutral'
}

function shortType(type: string): string {
  return type.replace(/^fabric\./, '')
}

function summarise(evt: FabricEvent): string {
  const d = evt.data ?? {}
  const parts: string[] = []
  for (const key of ['reservation_id', 'reliability', 'util_forecast', 'loss_pct', 'changes']) {
    const v = (d as Record<string, unknown>)[key]
    if (v === undefined || v === null) continue
    parts.push(`${key}=${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
  }
  return parts.slice(0, 2).join(' · ')
}

export function EventsFeed({ intervalMs }: { intervalMs: number }) {
  // The SSE stream invalidates this query as events land; the interval is only
  // a fallback for when streaming is unavailable.
  const events = useEvents({ intervalMs })
  // Newest first.
  const rows = [...(events.data?.events ?? [])].reverse()

  return (
    <Card
      title="Twin Events"
      subtitle="CloudEvents from dt.state — plan commits, overrides, self-heal, guardian"
    >
      <div className="max-h-[320px] overflow-auto">
        {rows.length === 0 && (
          <p className="py-6 text-center text-xs text-muted-2">
            {events.isLoading ? 'Loading events…' : 'No events recorded yet.'}
          </p>
        )}
        <ul className="flex flex-col gap-1.5">
          {rows.map((evt) => (
            <li
              key={evt.id}
              className="flex items-start gap-2 rounded-lg border border-[#1f2b3b] bg-panel-2 px-2.5 py-1.5"
            >
              <Badge tone={toneFor(evt.type)}>{shortType(evt.type)}</Badge>
              <div className="min-w-0 flex-1">
                {evt.subject && <Mono className="text-[11px]">{evt.subject}</Mono>}
                <div className="truncate text-[11px] text-muted-2">{summarise(evt)}</div>
              </div>
              <span className="shrink-0 text-[10px] text-muted-2">
                {evt.time?.slice(11, 19) ?? ''}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  )
}
