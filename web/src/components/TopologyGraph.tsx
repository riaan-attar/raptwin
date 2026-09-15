import {
  drag as d3drag,
  zoom as d3zoom,
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceX,
  forceY,
  forceSimulation,
  interpolateBlues,
  select,
  zoomIdentity,
  type Selection,
  type Simulation,
  type ZoomBehavior,
} from 'd3'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { PlanResult, Snapshot } from '../api/types'
import { fmt, fmtPct } from '../lib/format'
import {
  buildGraphModel,
  linkClass,
  linkStroke,
  linkStrokeWidth,
  nodeRadius,
  type GraphLink,
  type GraphNode,
} from '../lib/topologyModel'
import { Button, Card } from './ui/primitives'

interface SavedPosition {
  x?: number
  y?: number
  vx?: number
  vy?: number
  fx?: number | null
  fy?: number | null
}

function nodeFill(d: GraphNode): string {
  if (d.down) return '#e74c3c'
  if (d.derate > 0.01) return '#f1c40f'
  const pct = d.cpuCap > 0 ? Math.min(1, d.cpuUsed / d.cpuCap) : 0
  return interpolateBlues(0.3 + pct * 0.6)
}

function nodeTooltip(d: GraphNode): string {
  const status = d.down
    ? 'status: DOWN'
    : d.derate > 0.01
      ? `thermal derate: ${fmtPct(Math.min(1, d.derate))}`
      : 'status: healthy'
  return [
    d.id,
    `${d.arch ?? '—'} ${d.klass ?? ''}`.trim(),
    status,
    `cpu ${fmt(d.cpuUsed, 1)} / ${fmt(d.cpuCap, 1)} cores`,
    `mem ${fmt(d.memUsed, 1)} / ${fmt(d.memCap, 1)} GB`,
    `federation: ${d.federation}`,
    `reservations: ${d.reservations}`,
    `plan stages: ${d.assignStages.length ? d.assignStages.join(', ') : 'none'}`,
    `fallback stages: ${d.shadowStages.length ? d.shadowStages.join(', ') : 'none'}`,
  ].join('\n')
}

function linkTooltip(l: GraphLink): string {
  const a = typeof l.source === 'string' ? l.source : l.source.id
  const b = typeof l.target === 'string' ? l.target : l.target.id
  if (l.kind === 'zone') {
    return `${a} ↔ ${b}\nsame zone/federation (grouping only, not a physical link)`
  }
  const parts = [
    `${a} ↔ ${b}`,
    l.kind === 'backbone' ? `zone backbone: ${l.fedA} ↔ ${l.fedB}` : null,
    `speed: ${fmt(l.speed)} Gbps`,
    `rtt: ${fmt(l.rtt, 1)} ms`,
    `loss: ${fmt(l.loss)} %`,
  ].filter(Boolean)
  if (l.down) parts.push('status: DOWN')
  return parts.join('\n')
}

export function TopologyGraph({
  snapshot,
  lastPlan,
}: {
  snapshot?: Snapshot
  lastPlan?: PlanResult
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const simRef = useRef<Simulation<GraphNode, GraphLink> | null>(null)
  const linkSelRef = useRef<Selection<SVGLineElement, GraphLink, SVGGElement, unknown> | null>(null)
  const nodeSelRef = useRef<Selection<SVGGElement, GraphNode, SVGGElement, unknown> | null>(null)
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const hasFittedRef = useRef(false)
  /** Survives re-renders so the layout never restarts from scratch. */
  const positionsRef = useRef(new Map<string, SavedPosition>())
  const [width, setWidth] = useState(900)

  const model = useMemo(
    () => (snapshot ? buildGraphModel(snapshot, lastPlan) : { nodes: [], links: [] }),
    [snapshot, lastPlan],
  )

  const height = Math.max(420, Math.min(760, 200 + model.nodes.length * 4))

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      setWidth(Math.max(320, entry.contentRect.width))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Create the SVG scaffolding + simulation exactly once.
  useEffect(() => {
    const svgEl = svgRef.current
    if (!svgEl) return

    const svg = select(svgEl)
    svg.selectAll('*').remove()
    const root = svg.append('g').attr('class', 'viewport')
    root.append('g').attr('class', 'zones')
    const linkLayer = root.append('g').attr('class', 'links')
    const nodeLayer = root.append('g').attr('class', 'nodes')

    linkSelRef.current = linkLayer.selectAll<SVGLineElement, GraphLink>('line')
    nodeSelRef.current = nodeLayer.selectAll<SVGGElement, GraphNode>('g')

    // Pan/zoom so a 100-node fabric stays explorable instead of overflowing.
    const zoomBehaviour = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on('zoom', (event) => {
        root.attr('transform', event.transform.toString())
        // Per-node labels are noise at low zoom; tooltips still cover hover.
        root
          .selectAll('text.node-label')
          .style('display', event.transform.k >= 1.35 ? 'inline' : 'none')
      })
    svg.call(zoomBehaviour)
    zoomRef.current = zoomBehaviour

    const sim = forceSimulation<GraphNode, GraphLink>()
      .force(
        'link',
        forceLink<GraphNode, GraphLink>()
          .id((d) => d.id)
          .distance((l) => 160 / Math.sqrt(Math.max(0.2, l.speed || 0.2)))
          .strength(0.6),
      )
      .force('charge', forceManyBody().strength(-180))
      .force('collision', forceCollide<GraphNode>().radius((d) => nodeRadius(d) + 10))
      // Gentle pull toward the middle keeps the graph compact enough to read.
      .force('x', forceX<GraphNode>().strength(0.05))
      .force('y', forceY<GraphNode>().strength(0.08))
      .on('tick', () => {
        linkSelRef.current
          ?.attr('x1', (d) => (typeof d.source === 'object' ? (d.source.x ?? 0) : 0))
          .attr('y1', (d) => (typeof d.source === 'object' ? (d.source.y ?? 0) : 0))
          .attr('x2', (d) => (typeof d.target === 'object' ? (d.target.x ?? 0) : 0))
          .attr('y2', (d) => (typeof d.target === 'object' ? (d.target.y ?? 0) : 0))
        nodeSelRef.current?.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`)
      })

    simRef.current = sim
    return () => {
      sim.stop()
      simRef.current = null
    }
  }, [])

  /**
   * Pull each node toward an anchor for its zone, laid out radially, so the
   * federations read as distinct clusters instead of one undifferentiated blob.
   */
  useEffect(() => {
    const sim = simRef.current
    if (!sim) return

    const zones = [...new Set(model.nodes.map((n) => n.federation))].sort()
    const anchors = new Map<string, { x: number; y: number }>()
    const radius = Math.min(width, height) * 0.34
    zones.forEach((zone, i) => {
      if (zones.length === 1) {
        anchors.set(zone, { x: width / 2, y: height / 2 })
        return
      }
      const angle = (i / zones.length) * Math.PI * 2 - Math.PI / 2
      anchors.set(zone, {
        x: width / 2 + Math.cos(angle) * radius,
        y: height / 2 + Math.sin(angle) * radius,
      })
    })

    sim.force('center', forceCenter(width / 2, height / 2).strength(0.05))
    sim.force(
      'x',
      forceX<GraphNode>((d) => anchors.get(d.federation)?.x ?? width / 2).strength(0.35),
    )
    sim.force(
      'y',
      forceY<GraphNode>((d) => anchors.get(d.federation)?.y ?? height / 2).strength(0.35),
    )
    sim.alpha(Math.max(sim.alpha(), 0.2)).restart()

    // Label each cluster so the zones are identifiable at a glance.
    const svgEl = svgRef.current
    if (!svgEl) return
    const counts = new Map<string, number>()
    for (const n of model.nodes) counts.set(n.federation, (counts.get(n.federation) ?? 0) + 1)

    select(svgEl)
      .select<SVGGElement>('g.zones')
      .selectAll<SVGTextElement, string>('text')
      .data(zones, (z) => z)
      .join('text')
      .attr('x', (z) => anchors.get(z)?.x ?? width / 2)
      .attr('y', (z) => (anchors.get(z)?.y ?? height / 2) - 74)
      .attr('text-anchor', 'middle')
      .attr('fill', '#4a6c93')
      .attr('font-size', 13)
      .attr('font-weight', 700)
      .attr('letter-spacing', '0.08em')
      .style('pointer-events', 'none')
      .text((z) => `${z.toUpperCase()} · ${counts.get(z) ?? 0}`)
  }, [model, width, height])

  /** Scale + translate the viewport so the whole graph is visible. */
  const fitToView = () => {
    const sim = simRef.current
    const svgEl = svgRef.current
    const zoomBehaviour = zoomRef.current
    if (!sim || !svgEl || !zoomBehaviour) return
    const nodes = sim.nodes()
    if (!nodes.length) return

    const xs = nodes.map((n) => n.x ?? 0)
    const ys = nodes.map((n) => n.y ?? 0)
    const pad = 40
    const minX = Math.min(...xs) - pad
    const maxX = Math.max(...xs) + pad
    const minY = Math.min(...ys) - pad
    const maxY = Math.max(...ys) + pad
    const boxW = Math.max(1, maxX - minX)
    const boxH = Math.max(1, maxY - minY)
    const scale = Math.min(4, Math.max(0.2, Math.min(width / boxW, height / boxH)))
    const tx = width / 2 - scale * (minX + boxW / 2)
    const ty = height / 2 - scale * (minY + boxH / 2)

    select(svgEl)
      .transition()
      .duration(500)
      .call(zoomBehaviour.transform, zoomIdentity.translate(tx, ty).scale(scale))
  }

  // Data updates: join in place and warm-restart instead of rebuilding.
  useEffect(() => {
    const sim = simRef.current
    const svgEl = svgRef.current
    if (!sim || !svgEl) return

    // Carry positions from the live simulation, then from the longer-lived cache.
    for (const n of sim.nodes()) {
      positionsRef.current.set(n.id, { x: n.x, y: n.y, vx: n.vx, vy: n.vy, fx: n.fx, fy: n.fy })
    }

    let seeded = 0
    for (const n of model.nodes) {
      const prev = positionsRef.current.get(n.id)
      if (!prev) continue
      if (typeof prev.x === 'number') n.x = prev.x
      if (typeof prev.y === 'number') n.y = prev.y
      if (typeof prev.vx === 'number') n.vx = prev.vx
      if (typeof prev.vy === 'number') n.vy = prev.vy
      if (typeof prev.fx === 'number') n.fx = prev.fx
      if (typeof prev.fy === 'number') n.fy = prev.fy
      seeded++
    }
    const warmStart = seeded > 0

    const svg = select(svgEl)
    const linkLayer = svg.select<SVGGElement>('g.links')
    const nodeLayer = svg.select<SVGGElement>('g.nodes')

    linkSelRef.current = linkLayer
      .selectAll<SVGLineElement, GraphLink>('line')
      .data(model.links, (d) => d.key)
      .join(
        (enter) => {
          const line = enter.append('line')
          line.append('title')
          return line
        },
        (update) => update,
        (exit) => exit.remove(),
      )
      .attr('class', linkClass)
      .attr('stroke', linkStroke)
      .attr('stroke-width', linkStrokeWidth)
      .call((sel) => sel.select('title').text(linkTooltip))

    const dragBehaviour = d3drag<SVGGElement, GraphNode>()
      .on('start', (event, d) => {
        if (!event.active) sim.alphaTarget(0.2).restart()
        d.fx = d.x
        d.fy = d.y
      })
      .on('drag', (event, d) => {
        d.fx = event.x
        d.fy = event.y
      })
      .on('end', (event, d) => {
        if (!event.active) sim.alphaTarget(0)
        d.fx = null
        d.fy = null
      })

    nodeSelRef.current = nodeLayer
      .selectAll<SVGGElement, GraphNode>('g')
      .data(model.nodes, (d) => d.id)
      .join(
        (enter) => {
          const g = enter.append('g').call(dragBehaviour)
          g.append('circle').attr('class', 'node-shadow')
          g.append('circle').attr('class', 'node-ring')
          g.append('circle').attr('class', 'node-core')
          g.append('text').attr('class', 'node-label').attr('dy', 4)
          g.append('title')
          return g
        },
        (update) => update,
        (exit) => exit.remove(),
      )

    nodeSelRef.current
      .select<SVGCircleElement>('circle.node-shadow')
      .attr('r', (d) => nodeRadius(d) + 9)
      .style('display', (d) => (d.shadowStages.length > 0 ? 'block' : 'none'))

    nodeSelRef.current
      .select<SVGCircleElement>('circle.node-ring')
      .attr('r', (d) => nodeRadius(d) + 5)
      .attr('stroke', (d) => (d.assignStages.length > 0 ? '#6fc1ff' : '#2ecc71'))
      .attr('stroke-dasharray', (d) => (d.assignStages.length > 0 ? null : '6 4'))
      .style('display', (d) =>
        d.assignStages.length > 0 || d.reservations > 0 ? 'block' : 'none',
      )

    nodeSelRef.current
      .select<SVGCircleElement>('circle.node-core')
      .attr('r', nodeRadius)
      .attr('fill', nodeFill)

    nodeSelRef.current
      .select<SVGTextElement>('text.node-label')
      .text((d) => d.id)
      .style('display', 'none')
    nodeSelRef.current.select<SVGTitleElement>('title').text(nodeTooltip)

    sim.nodes(model.nodes)
    sim.force<ReturnType<typeof forceLink<GraphNode, GraphLink>>>('link')?.links(model.links)
    sim.alpha(warmStart ? 0.3 : 1).alphaDecay(warmStart ? 0.08 : 0.0228)
    sim.restart()

    // Frame the fabric once, after the initial cold layout has settled.
    if (!hasFittedRef.current && model.nodes.length) {
      hasFittedRef.current = true
      const timer = setTimeout(fitToView, 1800)
      return () => clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model])

  const zoneCount = new Set(model.nodes.map((n) => n.federation)).size

  return (
    <Card
      title="Fabric Topology"
      subtitle={
        model.nodes.length
          ? `${model.nodes.length} nodes · ${model.links.length} edges · ${zoneCount} zones · scroll to zoom, drag to pan`
          : 'Waiting for snapshot…'
      }
      actions={
        <Button onClick={fitToView} disabled={!model.nodes.length}>
          Fit to view
        </Button>
      }
    >
      <div ref={wrapRef} className="w-full animate-fade-slide">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
          className="h-full w-full"
          style={{ height }}
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-2">
        <Legend swatch={<Dot className="bg-good" />}>healthy</Legend>
        <Legend swatch={<Dot className="bg-warn" />}>thermal derate</Legend>
        <Legend swatch={<Dot className="bg-bad" />}>down</Legend>
        <Legend swatch={<Dot className="border-2 border-dashed border-[#f39c12] bg-transparent" />}>
          fallback-ready
        </Legend>
        <Legend swatch={<Dot className="border-2 border-accent bg-transparent" />}>
          plan assignment
        </Legend>
        <Legend swatch={<span className="text-[#2c3f57]">┄┄</span>}>same-zone grouping</Legend>
        <Legend swatch={<span className="text-[#4c8fc9]">╍╍</span>}>zone backbone</Legend>
      </div>
    </Card>
  )
}

function Dot({ className }: { className?: string }) {
  return <span className={`inline-block size-3 rounded-full ${className ?? ''}`} />
}

function Legend({ swatch, children }: { swatch: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      {swatch}
      {children}
    </span>
  )
}
