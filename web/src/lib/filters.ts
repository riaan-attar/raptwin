import { useCallback, useState } from 'react'
import type { Federation, FederationLink, LinkMetrics, SnapshotNode } from '../api/types'
import { linkStatus } from './faults'

const num = (v: unknown, d = 0) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : d
}

/** Small state holder shared by the four filter sets: values, a setter, reset, active count. */
function useFilterState<T extends object>(initial: T, ignore: (keyof T)[] = []) {
  const [filters, setFilters] = useState<T>(initial)
  const set = useCallback(<K extends keyof T>(key: K, value: T[K]) => setFilters((f) => ({ ...f, [key]: value })), [])
  const reset = useCallback(() => setFilters(initial), [initial])
  const activeCount = (Object.keys(filters) as (keyof T)[]).filter(
    (k) => !ignore.includes(k) && filters[k] !== initial[k],
  ).length
  return { filters, set, reset, activeCount }
}

// ---------------------------------------------------------------------------
// Nodes
// ---------------------------------------------------------------------------

export interface NodeFilters {
  q: string
  zone: string
  cls: string
  arch: string
  format: string
  gpu: '' | 'with' | 'none'
  status: '' | 'up' | 'down' | 'derated' | 'saturated' | 'reserved'
  maxRel: string
  sort: 'name' | 'free-cpu' | 'util' | 'reliability' | 'derate'
}

const NODE_INITIAL: NodeFilters = {
  q: '',
  zone: '',
  cls: '',
  arch: '',
  format: '',
  gpu: '',
  status: '',
  maxRel: '',
  sort: 'name',
}

export const useNodeFilters = () => useFilterState(NODE_INITIAL, ['sort'])

export function nodeUtilisation(n: SnapshotNode): number {
  const max = num(n.effective?.max_cpu_cores)
  if (max <= 0) return 0
  return Math.min(1, Math.max(0, 1 - num(n.effective?.free_cpu_cores) / max))
}

export function nodeZone(n: SnapshotNode, fedMap: Record<string, string>): string {
  return fedMap[n.name] ?? n.labels?.federation ?? n.labels?.zone ?? ''
}

export function filterNodes(nodes: SnapshotNode[], f: NodeFilters, fedMap: Record<string, string>): SnapshotNode[] {
  const q = f.q.trim().toLowerCase()
  const maxRel = f.maxRel === '' ? null : num(f.maxRel, 1)
  const out = nodes.filter((n) => {
    const dyn = n.dyn ?? {}
    if (f.zone && nodeZone(n, fedMap) !== f.zone) return false
    if (f.cls && n.class !== f.cls) return false
    if (f.arch && n.arch !== f.arch) return false
    if (f.format && !(n.formats_supported ?? []).includes(f.format)) return false
    const hasGpu = num(n.caps?.gpu_vram_gb) > 0
    if (f.gpu === 'with' && !hasGpu) return false
    if (f.gpu === 'none' && hasGpu) return false
    switch (f.status) {
      case 'up':
        if (dyn.down) return false
        break
      case 'down':
        if (!dyn.down) return false
        break
      case 'derated':
        if (num(dyn.thermal_derate) <= 0) return false
        break
      case 'saturated':
        if (nodeUtilisation(n) < 0.9) return false
        break
      case 'reserved':
        if (Object.keys(dyn.reservations ?? {}).length === 0) return false
        break
    }
    if (maxRel !== null && num(dyn.reliability, 1) > maxRel) return false
    if (!q) return true
    const hay = `${n.name} ${n.class ?? ''} ${n.arch ?? ''} ${nodeZone(n, fedMap)} ${JSON.stringify(n.labels ?? {})}`
    return hay.toLowerCase().includes(q)
  })
  const by: Record<NodeFilters['sort'], (a: SnapshotNode, b: SnapshotNode) => number> = {
    name: (a, b) => a.name.localeCompare(b.name),
    'free-cpu': (a, b) => num(b.effective?.free_cpu_cores) - num(a.effective?.free_cpu_cores),
    util: (a, b) => nodeUtilisation(b) - nodeUtilisation(a),
    reliability: (a, b) => num(a.dyn?.reliability, 1) - num(b.dyn?.reliability, 1),
    derate: (a, b) => num(b.dyn?.thermal_derate) - num(a.dyn?.thermal_derate),
  }
  return [...out].sort(by[f.sort])
}

// ---------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------

export interface LinkFilters {
  q: string
  status: '' | 'ok' | 'degraded' | 'down'
  minLoss: string
  sort: 'default' | 'loss' | 'rtt' | 'speed'
}

const LINK_INITIAL: LinkFilters = { q: '', status: '', minLoss: '', sort: 'default' }

export const useLinkFilters = () => useFilterState(LINK_INITIAL, ['sort'])

export function filterLinks<T>(
  items: T[],
  f: LinkFilters,
  get: (t: T) => { key: string; metrics?: LinkMetrics },
): T[] {
  const q = f.q.trim().toLowerCase()
  const minLoss = f.minLoss === '' ? null : num(f.minLoss)
  const out = items.filter((t) => {
    const { key, metrics } = get(t)
    if (f.status && linkStatus(metrics) !== f.status) return false
    if (minLoss !== null && num(metrics?.loss_pct) < minLoss) return false
    return !q || key.toLowerCase().includes(q)
  })
  if (f.sort === 'default') return out
  const val = (t: T) => {
    const m = get(t).metrics
    return f.sort === 'loss' ? num(m?.loss_pct) : f.sort === 'rtt' ? num(m?.rtt_ms) : num(m?.speed_gbps)
  }
  // Loss and RTT: worst first. Speed: slowest first.
  return [...out].sort((a, b) => (f.sort === 'speed' ? val(a) - val(b) : val(b) - val(a)))
}

// ---------------------------------------------------------------------------
// Federations and federation links
// ---------------------------------------------------------------------------

export interface FedFilters {
  q: string
  status: '' | 'down' | 'hot' | 'reserved'
  sort: 'name' | 'load' | 'down'
}

const FED_INITIAL: FedFilters = { q: '', status: '', sort: 'name' }

export const useFedFilters = () => useFilterState(FED_INITIAL, ['sort'])

export function filterFederations(feds: Federation[], f: FedFilters): Federation[] {
  const q = f.q.trim().toLowerCase()
  const out = feds.filter((x) => {
    if (f.status === 'down' && x.down_nodes <= 0) return false
    if (f.status === 'hot' && num(x.load_factor) < 0.8) return false
    if (f.status === 'reserved' && x.reservations <= 0) return false
    return !q || `${x.name} ${x.nodes.join(' ')}`.toLowerCase().includes(q)
  })
  const by: Record<FedFilters['sort'], (a: Federation, b: Federation) => number> = {
    name: (a, b) => a.name.localeCompare(b.name),
    load: (a, b) => num(b.load_factor) - num(a.load_factor),
    down: (a, b) => b.down_nodes - a.down_nodes,
  }
  return [...out].sort(by[f.sort])
}

export interface FedLinkFilters {
  q: string
  status: '' | 'down' | 'degraded'
  sort: 'name' | 'loss' | 'rtt'
}

const FEDLINK_INITIAL: FedLinkFilters = { q: '', status: '', sort: 'name' }

export const useFedLinkFilters = () => useFilterState(FEDLINK_INITIAL, ['sort'])

export const fedLinkKey = (e: FederationLink) => `${e.a}~${e.b}`

export function filterFedLinks(edges: FederationLink[], f: FedLinkFilters): FederationLink[] {
  const q = f.q.trim().toLowerCase()
  const out = edges.filter((e) => {
    if (f.status === 'down' && e.down_links <= 0) return false
    if (f.status === 'degraded' && num(e.max_loss_pct) < 2) return false
    return !q || `${e.a} ${e.b}`.toLowerCase().includes(q)
  })
  const by: Record<FedLinkFilters['sort'], (a: FederationLink, b: FederationLink) => number> = {
    name: (a, b) => fedLinkKey(a).localeCompare(fedLinkKey(b)),
    loss: (a, b) => num(b.max_loss_pct) - num(a.max_loss_pct),
    rtt: (a, b) => num(b.avg_rtt_ms) - num(a.avg_rtt_ms),
  }
  return [...out].sort(by[f.sort])
}
