import { useMemo } from 'react'
import type { Federation, Snapshot } from '../api/types'
import { fmt, fmtPct } from '../lib/format'
import { federationLinkMembers, nodesOfFederations, planNodeFault, type NodeFaultKind } from '../lib/faults'
import {
  fedLinkKey,
  filterFedLinks,
  filterFederations,
  useFedFilters,
  useFedLinkFilters,
  type FedFilters,
  type FedLinkFilters,
} from '../lib/filters'
import { useSelection } from '../lib/useSelection'
import { LinkBulkBar } from './bulk/LinkBulkBar'
import { NodeBulkBar } from './bulk/NodeBulkBar'
import { useBulkRunner } from './bulk/useBulkRunner'
import { Badge, Button, Card, EmptyRow, Mono, TableShell, Td, Th } from './ui/primitives'
import { FilterRow, FilterSelect, SearchBox, SelectCell, SelectHeader } from './ui/selection'

const SORT_CLS =
  'rounded-lg border border-edge-2 bg-[var(--color-input-bg)] px-2.5 py-1.5 text-sm text-ink outline-none focus:border-[var(--color-input-focus-border)]'

export function FederationsTable({ snapshot }: { snapshot?: Snapshot }) {
  const { filters, set, reset, activeCount } = useFedFilters()
  const runner = useBulkRunner()

  const feds = useMemo(() => snapshot?.federations ?? [], [snapshot])
  const allKeys = useMemo(() => feds.map((f) => f.name), [feds])
  const selection = useSelection(allKeys)

  const rows = useMemo(() => filterFederations(feds, filters), [feds, filters])
  const visibleKeys = useMemo(() => rows.map((f) => f.name), [rows])
  const selectedNames = useMemo(() => [...selection.selected], [selection.selected])
  const targetNodes = useMemo(() => nodesOfFederations(snapshot, selectedNames), [snapshot, selectedNames])

  /** One-click action on every node of a single federation. */
  function zoneAction(f: Federation, kind: NodeFaultKind, verb: string) {
    const nodes = nodesOfFederations(snapshot, [f.name])
    void runner.run(planNodeFault(kind, nodes), {
      confirm: `${verb} all ${nodes.length} nodes in federation "${f.name}"?`,
    })
  }

  return (
    <Card
      title="Federations"
      subtitle={`${rows.length} of ${feds.length} shown · load blends CPU, memory and accelerator use per zone`}
    >
      <FilterRow activeCount={activeCount} onReset={reset}>
        <SearchBox
          value={filters.q}
          onChange={(v) => set('q', v)}
          placeholder="Search federation or node…"
          label="Search federations"
        />
        <FilterSelect
          label="Status"
          value={filters.status}
          onChange={(v) => set('status', v as FedFilters['status'])}
          options={[
            { value: 'down', label: 'Has down nodes' },
            { value: 'hot', label: 'Hot (load 80%+)' },
            { value: 'reserved', label: 'Has reservations' },
          ]}
        />
        <label className="flex flex-col gap-1 text-[11px] text-muted-2">
          Sort by
          <select value={filters.sort} onChange={(e) => set('sort', e.target.value as FedFilters['sort'])} className={SORT_CLS}>
            <option value="name">Name</option>
            <option value="load">Highest load</option>
            <option value="down">Most down nodes</option>
          </select>
        </label>
      </FilterRow>

      <NodeBulkBar
        noun="federations"
        nodes={targetNodes}
        detail={`acts on ${targetNodes.length} nodes`}
        selection={selection}
        visibleKeys={visibleKeys}
        runner={runner}
      />

      <TableShell
        maxHeight="360px"
        head={
          <>
            <SelectHeader visibleKeys={visibleKeys} selection={selection} />
            <Th>Name</Th>
            <Th>Load</Th>
            <Th>Down / Total</Th>
            <Th>Reservations</Th>
            <Th>Avg loss (%)</Th>
            <Th>Avg trust</Th>
            <Th className="text-right">Zone actions</Th>
          </>
        }
        empty={
          rows.length === 0 ? (
            <EmptyRow colSpan={8}>{feds.length === 0 ? 'No federation data.' : 'No federations match the filters.'}</EmptyRow>
          ) : undefined
        }
      >
        {rows.map((f) => {
          const allDown = f.nodes.length > 0 && f.down_nodes >= f.nodes.length
          return (
            <tr
              key={f.name}
              className={
                selection.selected.has(f.name) ? 'bg-[var(--color-chip-info-bg)]/40' : 'hover:bg-[var(--color-row-hover)]'
              }
            >
              <SelectCell id={f.name} selection={selection} label={f.name} />
              <Td>
                <Mono className="text-[13px]">{f.name}</Mono>
                <div className="mt-0.5 max-w-[22rem] truncate text-[11px] text-muted-2">{f.nodes.join(', ')}</div>
              </Td>
              <Td>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--color-input-bg)]">
                    <div
                      className="h-full rounded-full bg-accent-strong"
                      style={{ width: `${Math.min(100, Number(f.load_factor ?? 0) * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs">{fmtPct(f.load_factor)}</span>
                </div>
              </Td>
              <Td>
                {f.down_nodes > 0 ? (
                  <Badge tone="bad">
                    {f.down_nodes} / {f.nodes.length}
                  </Badge>
                ) : (
                  <span>0 / {f.nodes.length}</span>
                )}
              </Td>
              <Td>{f.reservations}</Td>
              <Td>{f.avg_loss_pct != null ? fmt(f.avg_loss_pct) : '—'}</Td>
              <Td>{f.avg_trust != null ? fmt(f.avg_trust) : '—'}</Td>
              <Td className="text-right">
                <div className="flex justify-end gap-1.5 whitespace-nowrap">
                  <Button
                    variant="bad"
                    className="px-2 py-1 text-xs"
                    disabled={runner.pending || allDown}
                    onClick={() => zoneAction(f, 'down', 'Take down')}
                  >
                    Take down
                  </Button>
                  <Button
                    variant="good"
                    className="px-2 py-1 text-xs"
                    disabled={runner.pending || f.down_nodes === 0}
                    onClick={() => zoneAction(f, 'up', 'Bring up')}
                  >
                    Bring up
                  </Button>
                  <Button
                    className="px-2 py-1 text-xs"
                    disabled={runner.pending}
                    onClick={() => zoneAction(f, 'saturate-all', 'Max out resources on')}
                  >
                    Max out
                  </Button>
                </div>
              </Td>
            </tr>
          )
        })}
      </TableShell>
    </Card>
  )
}

export function FederationLinksTable({ snapshot }: { snapshot?: Snapshot }) {
  const { filters, set, reset, activeCount } = useFedLinkFilters()
  const runner = useBulkRunner()

  const edges = useMemo(() => snapshot?.federation_links ?? [], [snapshot])
  const allKeys = useMemo(() => edges.map(fedLinkKey), [edges])
  const selection = useSelection(allKeys)

  const rows = useMemo(() => filterFedLinks(edges, filters), [edges, filters])
  const visibleKeys = useMemo(() => rows.map(fedLinkKey), [rows])

  /** The real links behind the selected rows, de-duplicated. */
  const targetLinks = useMemo(() => {
    const seen = new Map<string, ReturnType<typeof federationLinkMembers>[number]>()
    for (const e of edges) {
      if (!selection.selected.has(fedLinkKey(e))) continue
      for (const l of federationLinkMembers(snapshot, e.a, e.b)) seen.set(l.key, l)
    }
    return [...seen.values()]
  }, [edges, snapshot, selection.selected])

  return (
    <Card
      title="Federation Links"
      subtitle={`${rows.length} of ${edges.length} shown · cross-zone health aggregated from topology links and chaos overrides`}
    >
      <FilterRow activeCount={activeCount} onReset={reset}>
        <SearchBox
          value={filters.q}
          onChange={(v) => set('q', v)}
          placeholder="Search federation…"
          label="Search federation links"
        />
        <FilterSelect
          label="Status"
          value={filters.status}
          onChange={(v) => set('status', v as FedLinkFilters['status'])}
          options={[
            { value: 'down', label: 'Has down links' },
            { value: 'degraded', label: 'Degraded (loss 2%+)' },
          ]}
        />
        <label className="flex flex-col gap-1 text-[11px] text-muted-2">
          Sort by
          <select value={filters.sort} onChange={(e) => set('sort', e.target.value as FedLinkFilters['sort'])} className={SORT_CLS}>
            <option value="name">Name</option>
            <option value="loss">Highest loss</option>
            <option value="rtt">Highest RTT</option>
          </select>
        </label>
      </FilterRow>

      <LinkBulkBar
        noun="federation links"
        links={targetLinks}
        detail={`acts on ${targetLinks.length} underlying links`}
        selection={selection}
        visibleKeys={visibleKeys}
        runner={runner}
      />

      <TableShell
        maxHeight="360px"
        head={
          <>
            <SelectHeader visibleKeys={visibleKeys} selection={selection} />
            <Th>A</Th>
            <Th>B</Th>
            <Th>Links</Th>
            <Th>Down</Th>
            <Th>Min speed</Th>
            <Th>Avg RTT</Th>
            <Th>Max loss</Th>
          </>
        }
        empty={
          rows.length === 0 ? (
            <EmptyRow colSpan={8}>
              {edges.length === 0
                ? 'No cross-federation links. They appear while a partition scenario is active.'
                : 'No federation links match the filters.'}
            </EmptyRow>
          ) : undefined
        }
      >
        {rows.map((e) => {
          const key = fedLinkKey(e)
          return (
            <tr
              key={key}
              className={
                selection.selected.has(key) ? 'bg-[var(--color-chip-info-bg)]/40' : 'hover:bg-[var(--color-row-hover)]'
              }
            >
              <SelectCell id={key} selection={selection} label={`${e.a} to ${e.b}`} />
              <Td>{e.a}</Td>
              <Td>{e.b}</Td>
              <Td>{e.links}</Td>
              <Td>{e.down_links > 0 ? <Badge tone="bad">{e.down_links}</Badge> : 0}</Td>
              <Td>{e.min_speed_gbps != null ? fmt(e.min_speed_gbps) : '—'}</Td>
              <Td>{fmt(e.avg_rtt_ms)}</Td>
              <Td>{fmt(e.max_loss_pct)}</Td>
            </tr>
          )
        })}
      </TableShell>
    </Card>
  )
}
