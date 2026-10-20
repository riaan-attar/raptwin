import { useMemo, useState } from 'react'
import type { JobCatalogEntry } from '../api/types'

const PICK_KEY = 'raptwin.catalog-pick'

interface Pick {
  file: string
  excluded: string[]
}

/** Which catalog file to show and which jobs are ticked for batch planning; a per-browser convenience. */
function loadPick(): Pick {
  try {
    const v = JSON.parse(localStorage.getItem(PICK_KEY) ?? '{}') as { file?: unknown; excluded?: unknown }
    return {
      file: typeof v.file === 'string' ? v.file : '',
      excluded: Array.isArray(v.excluded) ? v.excluded.filter((x): x is string => typeof x === 'string') : [],
    }
  } catch {
    return { file: '', excluded: [] }
  }
}

/**
 * Catalog file filter plus per-job ticks, shared by the Dashboard composer and the Job Library.
 * `visible` is the entries in the chosen file (with their index in `catalog`); `included` is the
 * visible ones that are ticked.
 */
export function useCatalogPick(catalog: JobCatalogEntry[]) {
  const [pick, setPick] = useState(loadPick)

  const files = useMemo(() => {
    const counts = new Map<string, number>()
    for (const c of catalog) counts.set(c.file, (counts.get(c.file) ?? 0) + 1)
    return [...counts.entries()]
  }, [catalog])

  // A remembered file that no longer exists falls back to "all" instead of an empty list.
  const fileFilter = files.some(([f]) => f === pick.file) ? pick.file : ''
  const visible = useMemo(
    () => catalog.map((item, idx) => ({ item, idx })).filter(({ item }) => !fileFilter || item.file === fileFilter),
    [catalog, fileFilter],
  )
  const excluded = useMemo(() => new Set(pick.excluded), [pick.excluded])
  const included = useMemo(() => visible.filter(({ item }) => !excluded.has(item.id)), [visible, excluded])

  function update(next: Pick) {
    setPick(next)
    try {
      localStorage.setItem(PICK_KEY, JSON.stringify(next))
    } catch {
      /* private window or blocked storage: the choice just won't be remembered */
    }
  }

  return {
    files,
    fileFilter,
    visible,
    included,
    excluded,
    setFile: (file: string) => update({ file, excluded: pick.excluded }),
    setIncluded: (ids: string[], on: boolean) =>
      update({
        file: fileFilter,
        excluded: on ? pick.excluded.filter((x) => !ids.includes(x)) : [...new Set([...pick.excluded, ...ids])],
      }),
  }
}
