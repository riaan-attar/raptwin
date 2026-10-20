import type { LinkFilters } from '../../lib/filters'
import { FilterNumber, FilterRow, FilterSelect, SearchBox } from '../ui/selection'

const SORT_CLS =
  'rounded-lg border border-edge-2 bg-[var(--color-input-bg)] px-2.5 py-1.5 text-sm text-ink outline-none focus:border-[var(--color-input-focus-border)]'

export function LinkFilterControls({
  filters,
  set,
  reset,
  activeCount,
}: {
  filters: LinkFilters
  set: <K extends keyof LinkFilters>(key: K, value: LinkFilters[K]) => void
  reset: () => void
  activeCount: number
}) {
  return (
    <FilterRow activeCount={activeCount} onReset={reset}>
      <SearchBox
        value={filters.q}
        onChange={(v) => set('q', v)}
        placeholder="Search endpoints or key…"
        label="Search links"
      />
      <FilterSelect
        label="Status"
        value={filters.status}
        onChange={(v) => set('status', v as LinkFilters['status'])}
        options={[
          { value: 'ok', label: 'OK' },
          { value: 'degraded', label: 'Degraded (loss 2%+)' },
          { value: 'down', label: 'Down' },
        ]}
      />
      <FilterNumber label="Loss at least (%)" value={filters.minLoss} onChange={(v) => set('minLoss', v)} placeholder="0" />
      <label className="flex flex-col gap-1 text-[11px] text-muted-2">
        Sort by
        <select value={filters.sort} onChange={(e) => set('sort', e.target.value as LinkFilters['sort'])} className={SORT_CLS}>
          <option value="default">Default</option>
          <option value="loss">Highest loss</option>
          <option value="rtt">Highest RTT</option>
          <option value="speed">Slowest</option>
        </select>
      </label>
    </FilterRow>
  )
}
