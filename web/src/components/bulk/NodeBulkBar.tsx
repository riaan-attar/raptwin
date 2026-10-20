import { useState, type ReactNode } from 'react'
import type { SnapshotNode } from '../../api/types'
import { NODE_FAULTS, planNodeFault, type NodeFaultKind } from '../../lib/faults'
import type { Selection } from '../../lib/useSelection'
import { Button, NumberInput, inputCls } from '../ui/primitives'
import { BulkBar } from '../ui/selection'
import type { BulkRunner } from './useBulkRunner'

const GROUPS = ['Availability', 'Resources', 'Degrade', 'Reset'] as const

/**
 * Selection bar for anything that resolves to a set of nodes: the node tables and, via
 * the member nodes, the federation table. `nodes` is the resolved target set.
 */
export function NodeBulkBar({
  noun,
  nodes,
  detail,
  selection,
  visibleKeys,
  runner,
  extra,
}: {
  noun: string
  nodes: SnapshotNode[]
  /** Shown next to the quick buttons, e.g. "across 3 federations". */
  detail?: string
  selection: Selection
  visibleKeys: string[]
  runner: BulkRunner
  extra?: ReactNode
}) {
  const [kind, setKind] = useState<NodeFaultKind>('derate')
  const def = NODE_FAULTS.find((f) => f.kind === kind)
  const [value, setValue] = useState<number | undefined>(def?.value?.initial)

  const apply = (k: NodeFaultKind, v?: number) => runner.run(planNodeFault(k, nodes, v ?? 0))

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
      <Button variant="bad" disabled={runner.pending} onClick={() => void apply('down')}>
        Take down
      </Button>
      <Button variant="good" disabled={runner.pending} onClick={() => void apply('up')}>
        Bring up
      </Button>
      <Button disabled={runner.pending} onClick={() => void apply('saturate-all')}>
        Max out resources
      </Button>
      <Button disabled={runner.pending} onClick={() => void apply('clear')}>
        Clear faults
      </Button>

      <span className="mx-1 hidden h-8 w-px bg-[var(--color-chip-info-border)] sm:block" />

      <label className="flex flex-col gap-1 text-[11px] text-[var(--color-chip-info-text)]">
        More actions
        <select
          value={kind}
          onChange={(e) => {
            const next = e.target.value as NodeFaultKind
            setKind(next)
            setValue(NODE_FAULTS.find((f) => f.kind === next)?.value?.initial)
          }}
          className={`${inputCls} w-auto`}
        >
          {GROUPS.map((g) => (
            <optgroup key={g} label={g}>
              {NODE_FAULTS.filter((f) => f.group === g).map((f) => (
                <option key={f.kind} value={f.kind}>
                  {f.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      {def?.value && (
        <label className="flex flex-col gap-1 text-[11px] text-[var(--color-chip-info-text)]">
          {def.value.label}
          <NumberInput
            value={value}
            onChange={setValue}
            min={def.value.min}
            max={def.value.max}
            step={def.value.step}
            className="w-28"
          />
        </label>
      )}
      <Button
        variant="primary"
        disabled={runner.pending || (def?.value !== undefined && value === undefined)}
        onClick={() => void apply(kind, value)}
      >
        Apply
      </Button>
      {extra}
      {detail && <span className="self-center text-[11px] text-[var(--color-chip-info-text)]">{detail}</span>}
    </BulkBar>
  )
}
