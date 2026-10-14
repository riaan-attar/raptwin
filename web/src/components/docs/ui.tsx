import { useState, type ReactNode } from 'react'
import { cn } from '../../lib/format'
import { Mono } from '../ui/primitives'
import { goToDoc } from './nav'

/** Building blocks shared by every docs page. */

export function DocPage({ title, lead, children }: { title: string; lead: ReactNode; children: ReactNode }) {
  return (
    <article className="flex min-w-0 flex-col gap-3 text-sm leading-relaxed text-ink">
      <header className="mb-1">
        <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
        <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-muted">{lead}</p>
      </header>
      {children}
    </article>
  )
}

export function H2({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2
      id={id}
      className="mt-6 scroll-mt-28 border-b border-edge pb-1.5 text-lg font-semibold text-[var(--color-chip-info-text)]"
    >
      {children}
    </h2>
  )
}

export function H3({ children }: { children: ReactNode }) {
  return <h3 className="mt-3 text-sm font-bold tracking-wide text-ink">{children}</h3>
}

export function P({ children }: { children: ReactNode }) {
  return <p className="max-w-3xl">{children}</p>
}

export function UL({ items }: { items: ReactNode[] }) {
  return (
    <ul className="ml-5 max-w-3xl list-disc space-y-1 marker:text-muted-2">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  )
}

export function OL({ items }: { items: ReactNode[] }) {
  return (
    <ol className="ml-5 max-w-3xl list-decimal space-y-1 marker:text-muted-2">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ol>
  )
}

export function Code({ children, label }: { children: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(children)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable (insecure context): the text is still selectable */
    }
  }
  return (
    <div className="overflow-hidden rounded-lg border border-edge-2 bg-[var(--color-input-bg)]">
      <div className="flex items-center justify-between border-b border-edge-2 px-3 py-1 text-[11px] text-muted-2">
        <span>{label ?? 'shell'}</span>
        <button onClick={copy} className="cursor-pointer font-semibold text-muted hover:text-ink">
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed text-[var(--color-code-text)]">{children}</pre>
    </div>
  )
}

const CALLOUT: Record<'note' | 'warn' | 'tip', string> = {
  note: 'border-[var(--color-chip-info-border)] bg-[var(--color-chip-info-bg)] text-[var(--color-chip-info-text)]',
  warn: 'border-[var(--color-chip-warn-border)] bg-[var(--color-chip-warn-bg)] text-[var(--color-chip-warn-text)]',
  tip: 'border-[var(--color-chip-success-border)] bg-[var(--color-chip-success-bg)] text-[var(--color-chip-success-text)]',
}

export function Callout({
  tone = 'note',
  title,
  children,
}: {
  tone?: 'note' | 'warn' | 'tip'
  title?: string
  children: ReactNode
}) {
  return (
    <div className={cn('max-w-3xl rounded-lg border px-3 py-2 text-[13px]', CALLOUT[tone])}>
      {title && <div className="mb-0.5 font-bold">{title}</div>}
      <div>{children}</div>
    </div>
  )
}

/** Responsive table. Columns listed in `mono` render their cells as code. */
export function DocTable({ head, rows, mono = [] }: { head: string[]; rows: ReactNode[][]; mono?: number[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-edge-2">
      <table className="w-full border-collapse">
        <thead className="bg-[var(--color-thead-bg)]">
          <tr>
            {head.map((h) => (
              <th
                key={h}
                className="border-b border-row px-2.5 py-2 text-left text-xs font-bold text-[var(--color-label-text)]"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((cell, j) => (
                <td key={j} className="border-b border-row px-2.5 py-2 align-top text-[13px]">
                  {mono.includes(j) && typeof cell === 'string' ? <Mono>{cell}</Mono> : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Cross-link to another docs page. */
export function PageLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <button
      onClick={() => goToDoc(to)}
      className="cursor-pointer font-semibold text-[var(--color-chip-info-text)] underline decoration-dotted underline-offset-2 hover:decoration-solid"
    >
      {children}
    </button>
  )
}
