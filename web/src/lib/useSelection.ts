import { useCallback, useMemo, useState } from 'react'

/**
 * Checkbox selection keyed by a stable id (node name, link key, federation name).
 *
 * Selection survives filtering, and ids that disappear from `validKeys` (a node was
 * deleted, a fault removed an ad-hoc link) are dropped when read, not by an effect,
 * so there is never a stale id behind a bulk action.
 */
export function useSelection(validKeys: string[]) {
  const [raw, setRaw] = useState<ReadonlySet<string>>(new Set())

  const selected = useMemo(() => {
    const valid = new Set(validKeys)
    return new Set([...raw].filter((k) => valid.has(k)))
  }, [raw, validKeys])

  const toggle = useCallback((key: string) => {
    setRaw((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  /** Select or deselect many ids at once (the header checkbox, "select all matching"). */
  const setMany = useCallback((keys: string[], on: boolean) => {
    setRaw((prev) => {
      const next = new Set(prev)
      for (const k of keys) {
        if (on) next.add(k)
        else next.delete(k)
      }
      return next
    })
  }, [])

  const invert = useCallback((keys: string[]) => {
    setRaw((prev) => {
      const next = new Set(prev)
      for (const k of keys) {
        if (next.has(k)) next.delete(k)
        else next.add(k)
      }
      return next
    })
  }, [])

  const clear = useCallback(() => setRaw(new Set()), [])

  return { selected, count: selected.size, toggle, setMany, invert, clear }
}

export type Selection = ReturnType<typeof useSelection>
