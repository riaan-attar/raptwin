import { useState, type ReactNode } from 'react'
import type { SnapshotLink } from '../../api/types'
import { planLinkFault } from '../../lib/faults'
import type { Selection } from '../../lib/useSelection'
import { Button, NumberInput } from '../ui/primitives'
import { BulkBar } from '../ui/selection'
import type { BulkRunner } from './useBulkRunner'

/** Selection bar for links, and for federation links via their underlying links. */
export function LinkBulkBar({
  noun,
  links,
  detail,
  selection,
  visibleKeys,
  runner,
  extra,
}: {
  noun: string
  links: SnapshotLink[]
  detail?: string
  selection: Selection
  visibleKeys: string[]
  runner: BulkRunner
  extra?: ReactNode
}) {
  const [loss, setLoss] = useState<number | undefined>(12)
  const [rtt, setRtt] = useState<number | undefined>(55)
  const [jitter, setJitter] = useState<number | undefined>(undefined)
  const [speed, setSpeed] = useState<number | undefined>(undefined)

  const empty = links.length === 0

  return (
    <BulkBar
      noun={noun}
      selection={selection}
      visibleKeys={visibleKeys}
      notice={runner.notice}
      onDismissNotice={runner.dismiss}
      onUndo={runner.canUndo ? () => void runner.undo() : undefined}
      pending={runner.pending}
    >
      <Button variant="bad" disabled={runner.pending || empty} onClick={() => void runner.run(planLinkFault('down', links))}>
        Take down
      </Button>
      <Button variant="good" disabled={runner.pending || empty} onClick={() => void runner.run(planLinkFault('up', links))}>
        Bring up
      </Button>
      <Button disabled={runner.pending || empty} onClick={() => void runner.run(planLinkFault('restore', links))}>
        Restore all fields
      </Button>

      <span className="mx-1 hidden h-8 w-px bg-[var(--color-chip-info-border)] sm:block" />

      {(
        [
          ['Loss %', loss, setLoss],
          ['RTT ms', rtt, setRtt],
          ['Jitter ms', jitter, setJitter],
          ['Speed Gbps', speed, setSpeed],
        ] as const
      ).map(([label, value, set]) => (
        <label key={label} className="flex flex-col gap-1 text-[11px] text-[var(--color-chip-info-text)]">
          {label}
          <NumberInput value={value} onChange={set} min={0} className="w-24" placeholder="unchanged" />
        </label>
      ))}
      <Button
        variant="primary"
        disabled={runner.pending || empty}
        onClick={() =>
          void runner.run(
            planLinkFault('degrade', links, { loss_pct: loss, rtt_ms: rtt, jitter_ms: jitter, speed_gbps: speed }),
          )
        }
      >
        Degrade
      </Button>
      {extra}
      {detail && <span className="self-center text-[11px] text-[var(--color-chip-info-text)]">{detail}</span>}
    </BulkBar>
  )
}
