import { useState } from 'react'
import { useBulkObserve } from '../../api/hooks'
import type { ObservationPayload } from '../../api/types'
import type { BulkPlan } from '../../lib/faults'
import type { BulkNotice } from '../ui/selection'

/**
 * Runs a BulkPlan: confirms large or destructive actions, sends the observations,
 * reports a result, and remembers how to undo the last successful action.
 */
export function useBulkRunner() {
  const bulk = useBulkObserve()
  const [notice, setNotice] = useState<BulkNotice | null>(null)
  const [undoable, setUndoable] = useState<{ label: string; payloads: ObservationPayload[] } | null>(null)

  async function run(plan: BulkPlan, opts?: { confirm?: string }) {
    if (plan.targets === 0) {
      setNotice({ tone: 'info', text: `${plan.label}: nothing to change (${plan.skipped} skipped, the action does not apply to them).` })
      return
    }
    const ask = opts?.confirm ?? (plan.targets >= 5 ? `${plan.label} on ${plan.targets} targets?` : undefined)
    if (ask && !window.confirm(ask)) return

    const res = await bulk.mutateAsync(plan.payloads)
    const skipped = plan.skipped ? `, ${plan.skipped} skipped` : ''
    if (res.failed.length === 0) {
      setNotice({ tone: 'ok', text: `${plan.label}: applied to ${plan.targets}${skipped}.` })
    } else {
      const sample = res.failed.slice(0, 3).map((f) => f.message).join('; ')
      setNotice({
        tone: 'err',
        text: `${plan.label}: ${res.failed.length} of ${plan.payloads.length} requests failed (${sample}).`,
      })
    }
    setUndoable(res.ok > 0 ? { label: plan.label, payloads: plan.undo } : null)
  }

  async function undo() {
    if (!undoable) return
    const { label, payloads } = undoable
    setUndoable(null)
    const res = await bulk.mutateAsync(payloads)
    setNotice(
      res.failed.length
        ? { tone: 'err', text: `Undo of "${label}": ${res.failed.length} requests failed.` }
        : { tone: 'info', text: `Undid "${label}".` },
    )
  }

  return {
    run,
    undo,
    notice,
    setNotice,
    dismiss: () => setNotice(null),
    canUndo: undoable !== null,
    pending: bulk.isPending,
  }
}

export type BulkRunner = ReturnType<typeof useBulkRunner>
