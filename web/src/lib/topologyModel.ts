import type { SimulationLinkDatum, SimulationNodeDatum } from 'd3'
import type { PlanResult, Snapshot } from '../api/types'

export interface GraphNode extends SimulationNodeDatum {
  id: string
  arch?: string
  klass?: string
  federation: string
  down: boolean
  derate: number
  cpuCap: number
  cpuUsed: number
  memCap: number
  memUsed: number
  reservations: number
  assignStages: string[]
  shadowStages: string[]
}

export type LinkKind = 'real' | 'zone' | 'backbone'

export interface GraphLink extends SimulationLinkDatum<GraphNode> {
  source: string | GraphNode
  target: string | GraphNode
  key: string
  kind: LinkKind
  down: boolean
  speed: number
  loss: number
  rtt: number
  jitter: number
  fedA?: string
  fedB?: string
}

export interface GraphModel {
  nodes: GraphNode[]
  links: GraphLink[]
}

/**
 * Builds the renderable graph.
 *
 * The topology YAML only declares site/region-level links (names like
 * "site-lab") which rarely match a generated device, so the real link set is
 * usually empty and nodes would render as disconnected dots. Every node does
 * carry a zone/federation label though, so we derive:
 *   - a "same zone" ring per federation (N edges per zone, never a full mesh)
 *   - a backbone ring joining one representative node per zone
 * Real (and chaos-injected) device-to-device links are layered on top.
 */
export function buildGraphModel(snapshot: Snapshot, lastPlan?: PlanResult): GraphModel {
  const assigned = new Map<string, string[]>()
  const shadowed = new Map<string, string[]>()

  for (const stage of lastPlan?.per_stage ?? []) {
    if (stage.node && !stage.infeasible) {
      const list = assigned.get(stage.node) ?? []
      if (stage.id) list.push(stage.id)
      assigned.set(stage.node, list)
    }
    for (const fb of stage.fallbacks ?? []) {
      const name = typeof fb === 'string' ? fb : fb?.node
      if (!name) continue
      const list = shadowed.get(name) ?? []
      if (stage.id) list.push(stage.id)
      shadowed.set(name, list)
    }
  }

  const fedMap = snapshot.node_federations ?? {}

  const nodes: GraphNode[] = snapshot.nodes.map((n) => {
    const eff = n.effective ?? {}
    const dyn = n.dyn ?? {}
    const maxCpu = Number(eff.max_cpu_cores ?? 0)
    const freeCpu = Number(eff.free_cpu_cores ?? 0)
    const maxMem = Number(eff.max_mem_gb ?? 0)
    const freeMem = Number(eff.free_mem_gb ?? 0)
    return {
      id: n.name,
      arch: n.arch,
      klass: n.class,
      federation: fedMap[n.name] ?? n.labels?.federation ?? n.labels?.zone ?? '—',
      down: Boolean(dyn.down),
      derate: Number(dyn.thermal_derate ?? 0),
      cpuCap: maxCpu,
      cpuUsed: Math.max(0, maxCpu - freeCpu),
      memCap: maxMem,
      memUsed: Math.max(0, maxMem - freeMem),
      reservations: Object.keys(dyn.reservations ?? {}).length,
      assignStages: assigned.get(n.name) ?? [],
      shadowStages: shadowed.get(n.name) ?? [],
    }
  })

  const known = new Set(nodes.map((n) => n.id))

  const links: GraphLink[] = snapshot.links
    .filter((l) => known.has(l.a) && known.has(l.b))
    .map((l) => {
      const eff = l.effective ?? {}
      return {
        source: l.a,
        target: l.b,
        key: l.key,
        kind: 'real' as const,
        down: Boolean(eff.down),
        speed: Number(eff.speed_gbps ?? 0),
        loss: Number(eff.loss_pct ?? 0),
        rtt: Number(eff.rtt_ms ?? 0),
        jitter: Number(eff.jitter_ms ?? 0),
      }
    })

  const byFed = new Map<string, GraphNode[]>()
  for (const n of nodes) {
    const list = byFed.get(n.federation) ?? []
    list.push(n)
    byFed.set(n.federation, list)
  }

  for (const members of byFed.values()) {
    if (members.length < 2) continue
    const ordered = [...members].sort((a, b) => a.id.localeCompare(b.id))
    for (let i = 0; i < ordered.length; i++) {
      const a = ordered[i]
      const b = ordered[(i + 1) % ordered.length]
      links.push({
        source: a.id,
        target: b.id,
        key: `zone:${a.id}~${b.id}`,
        kind: 'zone',
        down: false,
        speed: 8,
        loss: 0,
        rtt: 1,
        jitter: 0,
      })
    }
  }

  const fedLinkLookup = new Map(
    (snapshot.federation_links ?? []).map((fl) => [[fl.a, fl.b].sort().join('~'), fl]),
  )

  const fedNames = [...byFed.keys()].filter((f) => f && f !== '—').sort()
  for (let i = 0; i < fedNames.length && fedNames.length > 1; i++) {
    const fedA = fedNames[i]
    const fedB = fedNames[(i + 1) % fedNames.length]
    if (fedA === fedB) continue
    const repA = [...(byFed.get(fedA) ?? [])].sort((a, b) => a.id.localeCompare(b.id))[0]
    const repB = [...(byFed.get(fedB) ?? [])].sort((a, b) => a.id.localeCompare(b.id))[0]
    if (!repA || !repB) continue
    const summary = fedLinkLookup.get([fedA, fedB].sort().join('~'))
    links.push({
      source: repA.id,
      target: repB.id,
      key: `backbone:${fedA}~${fedB}`,
      kind: 'backbone',
      down: summary ? Number(summary.down_links ?? 0) > 0 : false,
      speed: summary?.min_speed_gbps != null ? Number(summary.min_speed_gbps) : 2,
      loss: summary?.max_loss_pct != null ? Number(summary.max_loss_pct) : 0,
      rtt: summary?.avg_rtt_ms != null ? Number(summary.avg_rtt_ms) : 5,
      jitter: 0,
      fedA,
      fedB,
    })
  }

  return { nodes, links }
}

export function nodeRadius(d: GraphNode): number {
  const cpuTerm = Math.log10(Math.max(0, d.cpuCap) + 1) * 5
  const memTerm = Math.log10(Math.max(0, d.memCap) + 1) * 2.5
  return 6 + Math.min(13, cpuTerm + memTerm)
}

export function linkStrokeWidth(l: GraphLink): number {
  if (l.kind === 'zone') return 1
  return 1.5 + Math.log1p(Math.max(0.2, l.speed))
}

export function linkClass(l: GraphLink): string {
  if (l.down) return l.kind === 'zone' ? 'link zone-link down' : 'link down'
  if (l.loss >= 2 || l.jitter >= 2) return 'link degraded'
  if (l.kind === 'zone') return 'link zone-link'
  if (l.kind === 'backbone') return 'link backbone-link'
  return 'link'
}

export function linkStroke(l: GraphLink): string {
  if (l.kind === 'zone') return '#2c3f57'
  if (l.down) return '#e74c3c'
  if (l.loss >= 2 || l.jitter >= 2) return '#f39c12'
  if (l.kind === 'backbone') return '#4c8fc9'
  return '#2c3f57'
}
