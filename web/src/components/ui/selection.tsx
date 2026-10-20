import { useEffect, useRef, type ReactNode } from 'react'
import type { Selection } from '../../lib/useSelection'
import { Button, Notice, Th, inputCls } from './primitives'

/** Header checkbox: ticks every visible row, tri-state when only some are selected. */
export function SelectHeader({ visibleKeys, selection }: { visibleKeys: string[]; selection: Selection }) {
  const ref = useRef<HTMLInputElement>(null)
  const selectedVisible = visibleKeys.filter((k) => selection.selected.has(k)).length
  const all = visibleKeys.length > 0 && selectedVisible === visibleKeys.length
  const some = selectedVisible > 0 && !all

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = some
  }, [some])

  return (
    <Th className="w-8">
      <input
        ref={ref}
        type="checkbox"
        checked={all}
        disabled={visibleKeys.length === 0}
        aria-label="Select all visible rows"
        onChange={() => selection.setMany(visibleKeys, !all)}
        className="h-4 w-4 cursor-pointer accent-[var(--color-accent-strong)]"
      />
    </Th>
  )
}

export function SelectCell({ id, selection, label }: { id: string; selection: Selection; label: string }) {
  return (
    <td className="w-8 border-b border-row px-2.5 py-2 align-top">
      <input
        type="checkbox"
        checked={selection.selected.has(id)}
        aria-label={`Select ${label}`}
        onChange={() => selection.toggle(id)}
        className="h-4 w-4 cursor-pointer accent-[var(--color-accent-strong)]"
      />
    </td>
  )
}

export interface BulkNotice {
  tone: 'ok' | 'err' | 'info'
  text: string
}

/** Shows the selection summary, selection helpers, the action controls, and the last result. */
export function BulkBar({
  noun,
  selection,
  visibleKeys,
  notice,
  onDismissNotice,
  onUndo,
  pending,
  children,
}: {
  /** "nodes", "links", "federations"... */
  noun: string
  selection: Selection
  visibleKeys: string[]
  notice: BulkNotice | null
  onDismissNotice: () => void
  onUndo?: () => void
  pending: boolean
  children: ReactNode
}) {
  const visible = new Set(visibleKeys)
  const hidden = [...selection.selected].filter((k) => !visible.has(k)).length

  if (selection.count === 0 && !notice) return null

  return (
    <div className="mb-3 flex flex-col gap-2">
      {selection.count > 0 && (
        <div className="sticky top-2 z-[3] flex flex-col gap-2 rounded-lg border border-[var(--color-chip-info-border)] bg-[var(--color-chip-info-bg)] p-2.5 shadow-[0_6px_20px_rgba(0,0,0,0.25)]">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-chip-info-text)]">
            <b className="text-sm">
              {selection.count} {noun} selected
            </b>
            {hidden > 0 && <span>({hidden} hidden by the current filter)</span>}
            <span className="mx-1 opacity-40">|</span>
            <button
              className="cursor-pointer underline decoration-dotted underline-offset-2 hover:decoration-solid"
              onClick={() => selection.setMany(visibleKeys, true)}
            >
              Select all matching ({visibleKeys.length})
            </button>
            <button
              className="cursor-pointer underline decoration-dotted underline-offset-2 hover:decoration-solid"
              onClick={() => selection.invert(visibleKeys)}
            >
              Invert
            </button>
            <button
              className="cursor-pointer underline decoration-dotted underline-offset-2 hover:decoration-solid"
              onClick={selection.clear}
            >
              Clear
            </button>
          </div>
          <div className="flex flex-wrap items-end gap-2">{children}</div>
        </div>
      )}
      {notice && (
        <Notice tone={notice.tone} onDismiss={onDismissNotice}>
          <span>{notice.text}</span>
          {onUndo && (
            <button
              disabled={pending}
              onClick={onUndo}
              className="ml-3 cursor-pointer font-semibold underline underline-offset-2 disabled:opacity-50"
            >
              Undo
            </button>
          )}
        </Notice>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Filter controls
// ---------------------------------------------------------------------------

export function FilterRow({
  activeCount,
  onReset,
  children,
}: {
  activeCount: number
  onReset: () => void
  children: ReactNode
}) {
  return (
    <div className="mb-3 flex flex-wrap items-end gap-2">
      {children}
      {activeCount > 0 && (
        <Button variant="ghost" className="px-2 py-1 text-xs" onClick={onReset}>
          Reset filters ({activeCount})
        </Button>
      )}
    </div>
  )
}

export function SearchBox({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  label: string
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={label}
      className={`${inputCls.replace('w-full', '')} w-full sm:w-64`}
    />
  )
}

export function FilterSelect({
  label,
  value,
  onChange,
  options,
  allLabel = 'All',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[] | string[]
  allLabel?: string
}) {
  const opts = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o))
  return (
    <label className="flex flex-col gap-1 text-[11px] text-muted-2">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className={`${inputCls} w-auto`}>
        <option value="">{allLabel}</option>
        {opts.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function FilterNumber({
  label,
  value,
  onChange,
  placeholder,
  step = 'any',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  step?: number | 'any'
}) {
  return (
    <label className="flex flex-col gap-1 text-[11px] text-muted-2">
      {label}
      <input
        type="number"
        inputMode="decimal"
        step={step}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputCls} w-24`}
      />
    </label>
  )
}
