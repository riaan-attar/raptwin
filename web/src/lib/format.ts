/** Formatting helpers ported from the original dashboard's inline JS. */

const DASH = '—'

export function fmt(value: unknown, digits = 2): string {
  if (value === null || value === undefined) return DASH
  const n = Number(value)
  if (!Number.isFinite(n)) return DASH
  return n.toFixed(digits)
}

export function fmtPct(value: unknown, digits = 0): string {
  if (value === null || value === undefined) return DASH
  const n = Number(value)
  if (!Number.isFinite(n)) return DASH
  return `${(n * 100).toFixed(digits)}%`
}

/** Latency values can legitimately come back as Infinity for infeasible plans. */
export function fmtMs(value: unknown, digits = 1): string {
  if (value === null || value === undefined) return DASH
  const n = Number(value)
  if (n === Infinity) return '∞'
  if (!Number.isFinite(n)) return DASH
  return `${n.toFixed(digits)} ms`
}

export function fmtTime(ms: unknown): string {
  const n = Number(ms)
  if (!Number.isFinite(n) || n <= 0) return DASH
  return new Date(n).toLocaleTimeString()
}

export function fmtDateTime(ms: unknown): string {
  const n = Number(ms)
  if (!Number.isFinite(n) || n <= 0) return DASH
  return new Date(n).toLocaleString()
}

/** Tiny classnames joiner (avoids pulling in clsx for a handful of call sites). */
export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}

/** Money in the fabric's currency. Small amounts keep more decimals. */
export function fmtMoney(value: unknown, currency = ''): string {
  if (value === null || value === undefined) return '—'
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  const digits = Math.abs(n) >= 1 ? 2 : Math.abs(n) >= 0.01 ? 3 : 4
  return `${currency ? `${currency} ` : ''}${n.toFixed(digits)}`
}

/** Grams of CO2, switching to kg once it gets large. */
export function fmtCo2(value: unknown): string {
  if (value === null || value === undefined) return '—'
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  if (n >= 1000) return `${(n / 1000).toFixed(2)} kg`
  if (n >= 1) return `${n.toFixed(1)} g`
  return `${n.toFixed(3)} g`
}
