import type { ReactNode } from 'react'
import { cn } from '../../lib/format'

export function Card({
  title,
  subtitle,
  actions,
  children,
  className,
}: {
  title?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        'rounded-xl border border-edge bg-panel p-4 shadow-[0_6px_20px_rgba(0,0,0,0.25)]',
        className,
      )}
    >
      {(title || actions) && (
        <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            {title && (
              <h2 className="text-[15px] font-semibold tracking-wide text-[#cfe7ff]">{title}</h2>
            )}
            {subtitle && <p className="mt-0.5 text-xs text-muted-2">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  )
}

type ButtonVariant = 'default' | 'primary' | 'good' | 'bad' | 'ghost'

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  default: 'border-[#2a3a4f] bg-[#192434] text-ink hover:border-[#3f5876]',
  primary: 'border-[#2c5b86] bg-[#13314d] text-[#cfe7ff] hover:border-accent',
  good: 'border-[#1b5e40] bg-[#103a28] text-[#bbffde] hover:border-good',
  bad: 'border-[#5b1a1a] bg-[#3a1010] text-[#ffbbbb] hover:border-bad',
  ghost: 'border-transparent bg-transparent text-muted hover:text-ink',
}

export function Button({
  variant = 'default',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      {...props}
      className={cn(
        'cursor-pointer rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-50',
        BUTTON_VARIANTS[variant],
        className,
      )}
    />
  )
}

type BadgeTone = 'good' | 'warn' | 'bad' | 'neutral' | 'info'

const BADGE_TONES: Record<BadgeTone, string> = {
  good: 'border-[#1e5d42] bg-[#103a28] text-[#8ff0c1]',
  warn: 'border-[#6e5a1a] bg-[#3a2f10] text-[#f8e38a]',
  bad: 'border-[#5e1b1b] bg-[#3a1010] text-[#ffb4b4]',
  info: 'border-[#2c5b86] bg-[#13314d] text-[#cfe7ff]',
  neutral: 'border-edge-2 bg-chip text-muted',
}

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-block rounded-lg border px-1.5 py-0.5 text-[11px] font-bold',
        BADGE_TONES[tone],
      )}
    >
      {children}
    </span>
  )
}

export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="m-0.5 inline-block rounded-[10px] border border-[#2b3a4f] bg-[#1c2736] px-2 py-0.5 text-[11px] text-[#c7d8ec]">
      {children}
    </span>
  )
}

export function Kpi({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-[10px] border border-edge-2 bg-chip px-3 py-2">
      <div className="text-[11px] text-muted-2">{label}</div>
      <div className="font-bold text-ink">{value}</div>
    </div>
  )
}

export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('font-mono text-xs text-[#bcd0e6]', className)}>{children}</span>
}

/** Scrollable table shell with sticky headers. */
export function TableShell({
  head,
  children,
  maxHeight = '420px',
  empty,
}: {
  head: ReactNode
  children: ReactNode
  maxHeight?: string
  empty?: ReactNode
}) {
  return (
    <div className="overflow-auto" style={{ maxHeight }}>
      <table className="w-full border-collapse">
        <thead className="sticky top-0 z-[1] bg-[#111825]">
          <tr>{head}</tr>
        </thead>
        <tbody>{empty ?? children}</tbody>
      </table>
    </div>
  )
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        'border-b border-row px-2.5 py-2 text-left text-xs font-bold text-[#a9c3e1]',
        className,
      )}
    >
      {children}
    </th>
  )
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <td className={cn('border-b border-row px-2.5 py-2 align-top text-sm', className)}>
      {children}
    </td>
  )
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-2.5 py-6 text-center text-xs text-muted-2">
        {children}
      </td>
    </tr>
  )
}
