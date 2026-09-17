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
