import { useEffect, type ReactNode } from 'react'
import { cn } from '../../lib/format'

export function Card({
  title,
  subtitle,
  actions,
  children,
  className,
  ref,
}: {
  title?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  /** For callers that need the element itself, e.g. requestFullscreen(). */
  ref?: React.Ref<HTMLElement>
}) {
  return (
    <section
      ref={ref}
      className={cn(
        'rounded-xl border border-edge bg-panel p-4 shadow-[0_6px_20px_rgba(0,0,0,0.25)]',
        className,
      )}
    >
      {(title || actions) && (
        <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            {title && (
              <h2 className="text-[15px] font-semibold tracking-wide text-[var(--color-chip-info-text)]">{title}</h2>
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
  default: 'border-[var(--color-btn-border)] bg-[var(--color-btn-bg)] text-ink hover:border-[var(--color-btn-border-hover)]',
  primary: 'border-[var(--color-chip-info-border)] bg-[var(--color-chip-info-bg)] text-[var(--color-chip-info-text)] hover:border-accent',
  good: 'border-[var(--color-chip-success-border)] bg-[var(--color-chip-success-bg)] text-[var(--color-chip-success-text)] hover:border-good',
  bad: 'border-[var(--color-chip-danger-border)] bg-[var(--color-chip-danger-bg)] text-[var(--color-chip-danger-text)] hover:border-bad',
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
  good: 'border-[var(--color-chip-success-border)] bg-[var(--color-chip-success-bg)] text-[var(--color-chip-success-text)]',
  warn: 'border-[var(--color-chip-warn-border)] bg-[var(--color-chip-warn-bg)] text-[var(--color-chip-warn-text)]',
  bad: 'border-[var(--color-chip-danger-border)] bg-[var(--color-chip-danger-bg)] text-[var(--color-chip-danger-text)]',
  info: 'border-[var(--color-chip-info-border)] bg-[var(--color-chip-info-bg)] text-[var(--color-chip-info-text)]',
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
    <span className="m-0.5 inline-block rounded-[10px] border border-[var(--color-kbd-border)] bg-[var(--color-kbd-bg)] px-2 py-0.5 text-[11px] text-[var(--color-code-text)]">
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
  return <span className={cn('font-mono text-xs text-[var(--color-code-text)]', className)}>{children}</span>
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
        <thead className="sticky top-0 z-[1] bg-[var(--color-thead-bg)]">
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
        'border-b border-row px-2.5 py-2 text-left text-xs font-bold text-[var(--color-label-text)]',
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

// ---------------------------------------------------------------------------
// Form building blocks (management views)
// ---------------------------------------------------------------------------

export const inputCls =
  'w-full rounded-lg border border-edge-2 bg-[var(--color-input-bg)] px-2.5 py-1.5 text-sm text-ink outline-none focus:border-[var(--color-input-focus-border)] disabled:opacity-60'

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: ReactNode
  hint?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <label className={cn('flex min-w-0 flex-col gap-1 text-[11px] text-muted-2', className)}>
      <span className="font-semibold tracking-wide">{label}</span>
      {children}
      {hint && <span className="text-[10px] text-muted-2/80">{hint}</span>}
    </label>
  )
}

export function Notice({
  tone,
  children,
  onDismiss,
}: {
  tone: 'ok' | 'err' | 'info'
  children: ReactNode
  onDismiss?: () => void
}) {
  const tones = {
    ok: 'border-[var(--color-chip-success-border)] bg-[var(--color-chip-success-bg)] text-[var(--color-chip-success-text)]',
    err: 'border-[var(--color-chip-danger-border)] bg-[var(--color-chip-danger-bg)] text-[var(--color-chip-danger-text)]',
    info: 'border-[var(--color-chip-info-border)] bg-[var(--color-chip-info-bg)] text-[var(--color-chip-info-text)]',
  }
  return (
    <div
      role={tone === 'err' ? 'alert' : 'status'}
      className={cn('flex items-start justify-between gap-3 rounded-lg border px-3 py-2 text-xs', tones[tone])}
    >
      <div className="min-w-0 break-words">{children}</div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="cursor-pointer text-sm leading-none opacity-70 hover:opacity-100"
        >
          ×
        </button>
      )}
    </div>
  )
}

export function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
  wide,
}: {
  title: ReactNode
  subtitle?: ReactNode
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 px-4 py-8 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'flex w-full flex-col rounded-xl border border-edge-2 bg-panel shadow-[0_20px_60px_rgba(0,0,0,0.5)]',
          wide ? 'max-w-4xl' : 'max-w-2xl',
        )}
      >
        <header className="flex items-start justify-between gap-3 border-b border-edge px-5 py-3">
          <div>
            <h2 className="text-[15px] font-semibold tracking-wide text-[var(--color-chip-info-text)]">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-muted-2">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="cursor-pointer rounded-md px-2 text-lg leading-none text-muted hover:text-ink"
          >
            ×
          </button>
        </header>
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-edge px-5 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>
  )
}

/** Number input that keeps an empty field as `undefined` instead of 0. */
export function NumberInput({
  value,
  onChange,
  step = 'any',
  min,
  max,
  placeholder,
  className,
}: {
  value: number | undefined | null
  onChange: (value: number | undefined) => void
  step?: number | 'any'
  min?: number
  max?: number
  placeholder?: string
  className?: string
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      step={step}
      min={min}
      max={max}
      placeholder={placeholder}
      value={value ?? ''}
      onChange={(e) => {
        const raw = e.target.value
        if (raw === '') return onChange(undefined)
        const n = Number(raw)
        onChange(Number.isFinite(n) ? n : undefined)
      }}
      className={cn(inputCls, className)}
    />
  )
}
