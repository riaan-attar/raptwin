import { useMemo } from 'react'
import type { SnapshotNode } from '../../api/types'
import { nodeZone, type NodeFilters } from '../../lib/filters'
import { FilterNumber, FilterRow, FilterSelect, SearchBox } from '../ui/selection'

const uniq = (xs: (string | undefined)[]) => [...new Set(xs.filter(Boolean) as string[])].sort()

export function NodeFilterControls({
  nodes,
  fedMap,
  filters,
  set,
  reset,
  activeCount,
}: {
  nodes: SnapshotNode[]
  fedMap: Record<string, string>
  filters: NodeFilters
  set: <K extends keyof NodeFilters>(key: K, value: NodeFilters[K]) => void
  reset: () => void
  activeCount: number
}) {
  const zones = useMemo(() => uniq(nodes.map((n) => nodeZone(n, fedMap))), [nodes, fedMap])
  const classes = useMemo(() => uniq(nodes.map((n) => n.class)), [nodes])
  const arches = useMemo(() => uniq(nodes.map((n) => n.arch)), [nodes])
  const formats = useMemo(() => uniq(nodes.flatMap((n) => n.formats_supported ?? [])), [nodes])

  return (
    <FilterRow activeCount={activeCount} onReset={reset}>
      <SearchBox
        value={filters.q}
        onChange={(v) => set('q', v)}
        placeholder="Search name, class, arch, label…"
        label="Search nodes"
      />
      <FilterSelect label="Zone / federation" value={filters.zone} onChange={(v) => set('zone', v)} options={zones} />
      <FilterSelect label="Class" value={filters.cls} onChange={(v) => set('cls', v)} options={classes} />
      <FilterSelect label="Arch" value={filters.arch} onChange={(v) => set('arch', v)} options={arches} />
      <FilterSelect label="Format" value={filters.format} onChange={(v) => set('format', v)} options={formats} />
      <FilterSelect
        label="GPU"
        value={filters.gpu}
        onChange={(v) => set('gpu', v as NodeFilters['gpu'])}
        options={[
          { value: 'with', label: 'Has GPU' },
          { value: 'none', label: 'No GPU' },
        ]}
        allLabel="Any"
      />
      <FilterSelect
        label="Status"
        value={filters.status}
        onChange={(v) => set('status', v as NodeFilters['status'])}
        options={[
          { value: 'up', label: 'Up' },
          { value: 'down', label: 'Down' },
          { value: 'derated', label: 'Derated' },
          { value: 'saturated', label: 'Saturated (CPU 90%+)' },
          { value: 'reserved', label: 'Has reservations' },
        ]}
      />
      <FilterNumber
        label="Reliability up to"
        value={filters.maxRel}
        onChange={(v) => set('maxRel', v)}
        placeholder="0 to 1"
        step={0.05}
      />
      <label className="flex flex-col gap-1 text-[11px] text-muted-2">
        Sort by
        <select
          value={filters.sort}
          onChange={(e) => set('sort', e.target.value as NodeFilters['sort'])}
          className="rounded-lg border border-edge-2 bg-[var(--color-input-bg)] px-2.5 py-1.5 text-sm text-ink outline-none focus:border-[var(--color-input-focus-border)]"
        >
          <option value="name">Name</option>
          <option value="free-cpu">Most free CPU</option>
          <option value="util">Highest utilisation</option>
          <option value="reliability">Lowest reliability</option>
          <option value="derate">Highest derate</option>
        </select>
      </label>
    </FilterRow>
  )
}
