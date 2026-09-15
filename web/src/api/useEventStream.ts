import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { queryKeys } from './hooks'
import type { FabricEvent } from './types'

export type StreamStatus = 'connecting' | 'live' | 'offline'

/**
 * Coalesce bursts (a chaos scenario emits hundreds of events per second)
 * without adding noticeable lag to a single isolated change.
 */
const FLUSH_MS = 120

function keysFor(type: string): (readonly string[])[] {
  const keys: (readonly string[])[] = [queryKeys.events]
  if (type.startsWith('fabric.plan')) {
    keys.push(queryKeys.plans, queryKeys.snapshot)
  } else if (
    type.startsWith('fabric.node') ||
    type.startsWith('fabric.link') ||
    type.startsWith('fabric.reservation')
  ) {
    keys.push(queryKeys.snapshot)
  } else if (type.startsWith('fabric.selfheal') || type.startsWith('fabric.guardian')) {
    keys.push(queryKeys.snapshot, queryKeys.plans)
  } else {
    keys.push(queryKeys.snapshot)
  }
  return keys
}

/**
 * Subscribes to the twin's Server-Sent Events feed and refreshes only the
 * queries an event actually affects. Replaces blind interval polling: updates
 * land as soon as dt.state emits them.
 */
export function useEventStream({ enabled }: { enabled: boolean }) {
  const qc = useQueryClient()
  const [status, setStatus] = useState<StreamStatus>('connecting')
  const [eventCount, setEventCount] = useState(0)
  const [lastEventAt, setLastEventAt] = useState<number | null>(null)

  const pendingRef = useRef(new Set<string>())
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!enabled) {
      setStatus('offline')
      return
    }

    const source = new EventSource('/api/stream')

    const flush = () => {
      timerRef.current = null
      const serialised = [...pendingRef.current]
      pendingRef.current.clear()
      const seen = new Set<string>()
      for (const entry of serialised) {
        if (seen.has(entry)) continue
        seen.add(entry)
        void qc.invalidateQueries({ queryKey: JSON.parse(entry) as string[] })
      }
    }

    source.onopen = () => setStatus('live')

    source.onmessage = (msg) => {
      let evt: FabricEvent | null = null
      try {
        evt = JSON.parse(msg.data) as FabricEvent
      } catch {
        return
      }
      if (!evt?.type) return

      setEventCount((n) => n + 1)
      setLastEventAt(Date.now())
      for (const key of keysFor(evt.type)) pendingRef.current.add(JSON.stringify(key))
      if (timerRef.current === null) timerRef.current = setTimeout(flush, FLUSH_MS)
    }

    source.onerror = () => {
      // EventSource reconnects on its own (server sends `retry:`); surface the gap.
      setStatus(source.readyState === EventSource.CLOSED ? 'offline' : 'connecting')
    }

    return () => {
      source.close()
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      pendingRef.current.clear()
    }
  }, [enabled, qc])

  return { status, eventCount, lastEventAt }
}
