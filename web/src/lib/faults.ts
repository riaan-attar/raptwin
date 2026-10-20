import type {
  LinkMetrics,
  ObservationPayload,
  Snapshot,
  SnapshotLink,
  SnapshotNode,
} from '../api/types'

/**
 * Builders for manual fault injection. Everything goes through POST /observe, the
 * same path the chaos engine uses, so no backend change is needed.
 *
 * Every plan also carries an `undo`: the previous value of each field it touches,
 * read from the snapshot at the moment of the action. Undo re-applies those values,
 * which is exact for every kind of fault (including resource saturation).
 */

export interface BulkPlan {
  label: string
  /** Targets that will actually change. */
  targets: number
  /** Targets skipped because the action does not apply (for example no GPU). */
  skipped: number
  payloads: ObservationPayload[]
  undo: ObservationPayload[]
}

export type NodeFaultKind =
  | 'down'
  | 'up'
  | 'saturate-cpu'
  | 'saturate-mem'
  | 'saturate-vram'
  | 'saturate-all'
  | 'relieve'
  | 'derate'
  | 'power-cap'
  | 'reliability'
  | 'clear'

export interface NodeFaultDef {
  kind: NodeFaultKind
  label: string
  group: 'Availability' | 'Resources' | 'Degrade' | 'Reset'
  /** Name of the numeric value the action needs, if any. */
  value?: { label: string; min: number; max?: number; step: number; initial: number }
}

export const NODE_FAULTS: NodeFaultDef[] = [
  { kind: 'down', label: 'Take down', group: 'Availability' },
  { kind: 'up', label: 'Bring up', group: 'Availability' },
  { kind: 'saturate-all', label: 'Max out CPU, memory and VRAM', group: 'Resources' },
  { kind: 'saturate-cpu', label: 'Max out CPU', group: 'Resources' },
  { kind: 'saturate-mem', label: 'Max out memory', group: 'Resources' },
  { kind: 'saturate-vram', label: 'Max out VRAM', group: 'Resources' },
  { kind: 'relieve', label: 'Relieve (restore real usage)', group: 'Resources' },
  { kind: 'derate', label: 'Thermal derate', group: 'Degrade', value: { label: 'Derate 0 to 1', min: 0, max: 1, step: 0.05, initial: 0.4 } },
  { kind: 'power-cap', label: 'Power cap', group: 'Degrade', value: { label: 'Watts', min: 1, step: 10, initial: 120 } },
  { kind: 'reliability', label: 'Lower reliability', group: 'Degrade', value: { label: 'Reliability 0 to 1', min: 0, max: 1, step: 0.05, initial: 0.5 } },
  { kind: 'clear', label: 'Clear all injected faults', group: 'Reset' },
]

const NODE_RESET_FIELDS = [
  'down',
  'thermal_derate',
  'power_cap_w',
  'clock_skew_ms',
  'packet_dup',
  'packet_reorder',
  'reliability',
]

const USED_FIELDS = ['used_cpu_cores', 'used_mem_gb', 'used_gpu_vram_gb'] as const

const num = (v: unknown, d = 0) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : d
}
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** CPU, memory and VRAM currently held by the node's real reservations. */
export function reservedUsage(node: SnapshotNode) {
  let cpu = 0
  let mem = 0
  let vram = 0
  for (const r of Object.values(node.dyn?.reservations ?? {})) {
    cpu += num(r.cpu_cores)
    mem += num(r.mem_gb)
    vram += num(r.gpu_vram_gb)
  }
  return { used_cpu_cores: cpu, used_mem_gb: mem, used_gpu_vram_gb: vram }
}

/**
 * The fields to set for one node, or null when the action does not apply to it.
 * Saturation sets used_* to the node's full capacity. Relieve sets it back to what
 * the node's real reservations hold, not to zero, so live plans keep their accounting.
 */
function nodeChanges(kind: NodeFaultKind, node: SnapshotNode, value: number): Record<string, unknown> | null {
  const caps = node.caps ?? {}
  const cpu = num(caps.max_cpu_cores)
  const mem = num(caps.ram_gb)
  const vram = num(caps.gpu_vram_gb)
  switch (kind) {
    case 'down':
      return { down: true }
    case 'up':
      return { down: false }
    case 'saturate-cpu':
      return cpu > 0 ? { used_cpu_cores: cpu } : null
    case 'saturate-mem':
      return mem > 0 ? { used_mem_gb: mem } : null
    case 'saturate-vram':
      return vram > 0 ? { used_gpu_vram_gb: vram } : null
    case 'saturate-all': {
      const c: Record<string, unknown> = {}
      if (cpu > 0) c.used_cpu_cores = cpu
      if (mem > 0) c.used_mem_gb = mem
      if (vram > 0) c.used_gpu_vram_gb = vram
      return Object.keys(c).length ? c : null
    }
    case 'relieve':
      return reservedUsage(node)
    case 'derate':
      return { thermal_derate: clamp(value, 0, 1) }
    case 'power-cap':
      return value > 0 ? { power_cap_w: value } : null
    case 'reliability':
      return { reliability: clamp(value, 0, 1) }
    case 'clear':
      return null
  }
}

function previousNodeValues(node: SnapshotNode, fields: string[]): Record<string, unknown> {
  const dyn = (node.dyn ?? {}) as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const f of fields) out[f] = dyn[f] ?? (f === 'down' ? false : null)
  return out
}

const applyNode = (node: string, changes: Record<string, unknown>): ObservationPayload => ({
  action: 'apply',
  payload: { type: 'node', node, changes },
})

export function planNodeFault(kind: NodeFaultKind, nodes: SnapshotNode[], value = 0): BulkPlan {
  const def = NODE_FAULTS.find((f) => f.kind === kind)
  const payloads: ObservationPayload[] = []
  const undo: ObservationPayload[] = []
  let targets = 0
  let skipped = 0

  for (const node of nodes) {
    if (kind === 'clear') {
      // Reset injected fields to defaults, and used_* back to real reservations.
      payloads.push({ action: 'revert', payload: { type: 'node', node: node.name, fields: NODE_RESET_FIELDS } })
      payloads.push(applyNode(node.name, reservedUsage(node)))
      undo.push(applyNode(node.name, previousNodeValues(node, [...NODE_RESET_FIELDS, ...USED_FIELDS])))
      targets++
      continue
    }
    const changes = nodeChanges(kind, node, value)
    if (!changes) {
      skipped++
      continue
    }
    payloads.push(applyNode(node.name, changes))
    undo.push(applyNode(node.name, previousNodeValues(node, Object.keys(changes))))
    targets++
  }
  return { label: def?.label ?? kind, targets, skipped, payloads, undo }
}

// ---------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------

export type LinkFaultKind = 'down' | 'up' | 'degrade' | 'restore'

export interface LinkDegrade {
  loss_pct?: number
  rtt_ms?: number
  jitter_ms?: number
  speed_gbps?: number
}

const LINK_RESET_FIELDS = ['down', 'loss_pct', 'rtt_ms', 'jitter_ms', 'speed_gbps']

const LINK_LABELS: Record<LinkFaultKind, string> = {
  down: 'Take down',
  up: 'Bring up',
  degrade: 'Degrade',
  restore: 'Restore',
}

function previousLinkValues(link: SnapshotLink, fields: string[]): Record<string, unknown> {
  const dyn = (link.dyn ?? {}) as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const f of fields) out[f] = dyn[f] ?? (f === 'down' ? false : null)
  return out
}

const applyLink = (key: string, changes: Record<string, unknown>): ObservationPayload => ({
  action: 'apply',
  payload: { type: 'link', key, changes },
})

export function planLinkFault(kind: LinkFaultKind, links: SnapshotLink[], degrade: LinkDegrade = {}): BulkPlan {
  const payloads: ObservationPayload[] = []
  const undo: ObservationPayload[] = []
  let targets = 0
  let skipped = 0

  const degradeChanges: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(degrade)) if (v !== undefined && Number.isFinite(v)) degradeChanges[k] = v

  for (const link of links) {
    if (kind === 'restore') {
      payloads.push({ action: 'revert', payload: { type: 'link', key: link.key, fields: LINK_RESET_FIELDS } })
      undo.push(applyLink(link.key, previousLinkValues(link, LINK_RESET_FIELDS)))
      targets++
    } else if (kind === 'degrade') {
      if (!Object.keys(degradeChanges).length) {
        skipped++
        continue
      }
      payloads.push(applyLink(link.key, degradeChanges))
      undo.push(applyLink(link.key, previousLinkValues(link, Object.keys(degradeChanges))))
      targets++
    } else {
      payloads.push(applyLink(link.key, { down: kind === 'down' }))
      undo.push(applyLink(link.key, previousLinkValues(link, ['down'])))
      targets++
    }
  }
  return { label: LINK_LABELS[kind], targets, skipped, payloads, undo }
}

/**
 * The real links behind a federation-link row. Mirrors the server's bucketing in
 * dt/state.py: each endpoint maps to its federation (or stays as is, for a site name),
 * and a link belongs to the row whose sorted pair matches.
 */
export function federationLinkMembers(snapshot: Snapshot | undefined, a: string, b: string): SnapshotLink[] {
  if (!snapshot) return []
  const fed = snapshot.node_federations ?? {}
  const pair = [a, b].sort().join('~')
  return snapshot.links.filter((l) => {
    const fa = fed[l.a] ?? l.a
    const fb = fed[l.b] ?? l.b
    return fa !== fb && [fa, fb].sort().join('~') === pair
  })
}

export function nodesOfFederations(snapshot: Snapshot | undefined, names: string[]): SnapshotNode[] {
  if (!snapshot) return []
  const wanted = new Set(
    snapshot.federations.filter((f) => names.includes(f.name)).flatMap((f) => f.nodes),
  )
  return snapshot.nodes.filter((n) => wanted.has(n.name))
}

export function linkStatus(m: LinkMetrics | undefined): 'down' | 'degraded' | 'ok' {
  if (m?.down) return 'down'
  return num(m?.loss_pct) >= 2 ? 'degraded' : 'ok'
}
