import { useState } from 'react'
import { useRestartTwin } from '../api/hooks'
import type { RestartResult } from '../api/types'
import { Button, Modal, Notice, inputCls } from './ui/primitives'

const PHRASE = 'confirm'

/**
 * Restarting rebuilds the whole twin, so the button is disabled until the user types
 * the word "confirm". The server checks the same phrase, so it is not just a UI guard.
 */
export function RestartTwinDialog({
  onClose,
  onRestarted,
}: {
  onClose: () => void
  onRestarted: (result: RestartResult) => void
}) {
  const restart = useRestartTwin()
  const [typed, setTyped] = useState('')
  const ready = typed.trim().toLowerCase() === PHRASE

  async function submit() {
    if (!ready || restart.isPending) return
    try {
      onRestarted(await restart.mutateAsync(typed.trim()))
    } catch {
      /* the error is shown below from restart.error */
    }
  }

  return (
    <Modal
      title="Restart the whole twin?"
      subtitle="This rebuilds the fabric from the files on disk"
      onClose={restart.isPending ? () => undefined : onClose}
      footer={
        <>
          <Button onClick={onClose} disabled={restart.isPending}>
            Cancel
          </Button>
          <Button variant="bad" disabled={!ready || restart.isPending} onClick={() => void submit()}>
            {restart.isPending ? 'Restarting…' : 'Restart twin'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-sm">
        <p>The following is lost immediately and cannot be undone:</p>
        <ul className="ml-5 list-disc space-y-1 text-muted">
          <li>every reservation, every running job and its timer, and the plan history</li>
          <li>every injected fault, ad-hoc link and manual change (down, derate, maxed-out resources)</li>
          <li>a running chaos scenario, and the self-healing plans</li>
          <li>forecast history (it is rebuilt from scratch)</li>
        </ul>
        <p className="text-muted">
          Kept: node and topology files, the job library, learned planner state, and the event history (which records the
          restart).
        </p>
        <label className="flex flex-col gap-1 text-[11px] text-muted-2">
          <span>
            Type <b className="font-mono text-ink">{PHRASE}</b> to enable the button
          </span>
          <input
            autoFocus
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submit()
            }}
            placeholder={PHRASE}
            aria-label={`Type ${PHRASE} to confirm`}
            spellCheck={false}
            autoComplete="off"
            className={inputCls}
          />
        </label>
        {restart.isError && <Notice tone="err">{(restart.error as Error).message}</Notice>}
      </div>
    </Modal>
  )
}
