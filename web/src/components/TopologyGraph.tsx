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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNodeDescriptor } from '../api/hooks'
import type { PlanResult, Snapshot } from '../api/types'
import { cn, fmt, fmtPct } from '../lib/format'
import {
  buildGraphModel,
  linkClass,
  linkStroke,
  linkStrokeWidth,
  nodeRadius,
  type GraphLink,
  type GraphNode,
} from '../lib/topologyModel'
import { Badge, Button, Card, Mono, Tag } from './ui/primitives'

interface SavedPosition {
  x?: number
  y?: number
  vx?: number
  vy?: number
  fx?: number | null
  fy?: number | null
}

type Hover =
  | { kind: 'node'; data: GraphNode; x: number; y: number }
  | { kind: 'link'; data: GraphLink; x: number; y: number }

function nodeFill(d: GraphNode): string {
  if (d.down) return '#e74c3c'
  if (d.derate > 0.01) return '#f1c40f'
  const pct = d.cpuCap > 0 ? Math.min(1, d.cpuUsed / d.cpuCap) : 0
  return interpolateBlues(0.3 + pct * 0.6)
}

function endpointId(end: string | GraphNode): string {
  return typeof end === 'string' ? end : end.id
}

export function TopologyGraph({
  snapshot,
  lastPlan,
}: {
  snapshot?: Snapshot
  lastPlan?: PlanResult
}) {
  const cardRef = useRef<HTMLElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const simRef = useRef<Simulation<GraphNode, GraphLink> | null>(null)
  const linkSelRef = useRef<Selection<SVGLineElement, GraphLink, SVGGElement, unknown> | null>(null)
  const nodeSelRef = useRef<Selection<SVGGElement, GraphNode, SVGGElement, unknown> | null>(null)
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const hasFittedRef = useRef(false)
  const zoomScaleRef = useRef(1)
  const zoneLabelSelRef = useRef<Selection<SVGTextElement, string, SVGGElement, unknown> | null>(
    null,
  )
  /** Survives re-renders so the layout never restarts from scratch. */
  const positionsRef = useRef(new Map<string, SavedPosition>())

  const [expanded, setExpanded] = useState(false)
  const [hover, setHover] = useState<Hover | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [size, setSize] = useState({ width: 900, height: 640 })

  const model = useMemo(
    () => (snapshot ? buildGraphModel(snapshot, lastPlan) : { nodes: [], links: [] }),
    [snapshot, lastPlan],
  )

  // Taller than it is wide-ish: a 100-node fabric needs the room to spread out.
  const naturalHeight = Math.max(620, Math.min(1180, 320 + model.nodes.length * 6))
  const { width, height } = size

  // Measure the real box, so full-screen and the normal card share one code path.
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      setSize({
        width: Math.max(320, entry.contentRect.width),
        height: Math.max(320, entry.contentRect.height),
      })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // ---- full screen ------------------------------------------------------

  const toggleFullscreen = useCallback(() => {
    const el = cardRef.current
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined)
      setExpanded(false)
      return
    }
    // Fall back to an in-page overlay where the Fullscreen API is unavailable
    // or blocked (iframes, some mobile browsers).
    el?.requestFullscreen?.().catch(() => undefined)
    setExpanded(true)
  }, [])

  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) setExpanded(false)
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  useEffect(() => {
    if (!expanded) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // Handle it either way: the browser exits native full screen on Escape,
      // but the overlay fallback has nobody else to do it, and a native exit
      // that never fires its event would otherwise trap the view.
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined)
      setExpanded(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [expanded])

  // ---- hover highlighting ----------------------------------------------

  /** Dim everything unrelated to `id`, so one node's neighbourhood stands out. */
  const highlight = useCallback((id: string | null) => {
    const nodeSel = nodeSelRef.current
    const linkSel = linkSelRef.current
    if (!nodeSel || !linkSel) return

    if (!id) {
      nodeSel.style('opacity', 1)
      linkSel.style('opacity', null).attr('stroke-width', linkStrokeWidth)
      nodeSel
        .select<SVGTextElement>('text.node-label')
        .style('display', zoomScaleRef.current >= 1.35 ? 'inline' : 'none')
      return
    }

    const neighbours = new Set<string>([id])
    for (const l of linkSel.data()) {
      const a = endpointId(l.source)
      const b = endpointId(l.target)
      if (a === id) neighbours.add(b)
      else if (b === id) neighbours.add(a)
    }

    nodeSel.style('opacity', (d) => (neighbours.has(d.id) ? 1 : 0.12))
    linkSel
      .style('opacity', (l) => {
        const touches = endpointId(l.source) === id || endpointId(l.target) === id
        return touches ? 1 : 0.05
      })
      .attr('stroke-width', (l) => {
        const touches = endpointId(l.source) === id || endpointId(l.target) === id
        return touches ? linkStrokeWidth(l) * 2.2 : linkStrokeWidth(l)
      })
    // Name the neighbourhood whatever the zoom level.
    nodeSel
      .select<SVGTextElement>('text.node-label')
      .style('display', (d) => (neighbours.has(d.id) ? 'inline' : 'none'))
  }, [])

  const pointerPos = useCallback((event: MouseEvent) => {
    const rect = wrapRef.current?.getBoundingClientRect()
    return {
      x: event.clientX - (rect?.left ?? 0),
      y: event.clientY - (rect?.top ?? 0),
    }
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
        zoomScaleRef.current = event.transform.k
        root.attr('transform', event.transform.toString())
        // Per-node labels are noise at low zoom; hover still names them.
        root
          .selectAll('text.node-label')
          .style('display', event.transform.k >= 1.35 ? 'inline' : 'none')
      })
    svg.call(zoomBehaviour)
    // Double-click belongs to "show me this node", not to zooming.
    svg.on('dblclick.zoom', null)
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

        // Sit each zone label just above its cluster. A fixed offset from the
        // anchor overlapped the nodes once the clusters grew (full screen).
        const labels = zoneLabelSelRef.current
        if (labels && !labels.empty()) {
          const tops = new Map<string, number>()
          const sums = new Map<string, { x: number; n: number }>()
          for (const n of sim.nodes()) {
            const top = (n.y ?? 0) - nodeRadius(n)
            tops.set(n.federation, Math.min(tops.get(n.federation) ?? top, top))
            const acc = sums.get(n.federation) ?? { x: 0, n: 0 }
            acc.x += n.x ?? 0
            acc.n += 1
            sums.set(n.federation, acc)
          }
          labels
            .attr('x', (z) => {
              const acc = sums.get(z)
              return acc && acc.n ? acc.x / acc.n : 0
            })
            .attr('y', (z) => (tops.get(z) ?? 0) - 16)
        }
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

    zoneLabelSelRef.current = select(svgEl)
      .select<SVGGElement>('g.zones')
      .selectAll<SVGTextElement, string>('text')
      .data(zones, (z) => z)
      .join('text')
      // Placed properly on the next tick, from the cluster's real bounds.
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
  const fitToView = useCallback(() => {
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
  }, [width, height])

  // Re-frame when the canvas changes size (entering or leaving full screen).
  useEffect(() => {
    if (!hasFittedRef.current) return
    const timer = setTimeout(fitToView, 250)
    return () => clearTimeout(timer)
  }, [expanded, fitToView])

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
        (enter) => enter.append('line'),
        (update) => update,
        (exit) => exit.remove(),
      )
      .attr('class', linkClass)
      .attr('stroke', linkStroke)
      .attr('stroke-width', linkStrokeWidth)
      .style('opacity', null)
      // Thin lines are hard to hit; widen the pointer target, not the stroke.
      .style('stroke-linecap', 'round')
      .on('mouseenter', function (event: MouseEvent, l) {
        setHover({ kind: 'link', data: l, ...pointerPos(event) })
        select(this).attr('stroke-width', linkStrokeWidth(l) * 2.4)
      })
      .on('mousemove', (event: MouseEvent, l) =>
        setHover({ kind: 'link', data: l, ...pointerPos(event) }),
      )
      .on('mouseleave', function (_event: MouseEvent, l) {
        setHover(null)
        select(this).attr('stroke-width', linkStrokeWidth(l))
      })

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
          g.append('circle').attr('class', 'node-select')
          g.append('circle').attr('class', 'node-shadow')
          g.append('circle').attr('class', 'node-ring')
          g.append('circle').attr('class', 'node-core')
          g.append('text').attr('class', 'node-label').attr('dy', 4)
          return g
        },
        (update) => update,
        (exit) => exit.remove(),
      )
      .style('cursor', 'pointer')
      .on('mouseenter', (event: MouseEvent, d) => {
        setHover({ kind: 'node', data: d, ...pointerPos(event) })
        highlight(d.id)
      })
      .on('mousemove', (event: MouseEvent, d) =>
        setHover({ kind: 'node', data: d, ...pointerPos(event) }),
      )
      .on('mouseleave', () => {
        setHover(null)
        highlight(null)
      })
      .on('dblclick', (event: MouseEvent, d) => {
        // Keep the zoom behaviour out of it, and open the details panel.
        event.stopPropagation()
        event.preventDefault()
        // Pin it: reading a panel about a node that keeps drifting away is
        // annoying, and the pin is released when the panel closes.
        d.fx = d.x
        d.fy = d.y
        setSelectedId(d.id)
      })

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
      .style('display', zoomScaleRef.current >= 1.35 ? 'inline' : 'none')

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
  }, [model, highlight, pointerPos])

  // Mark the selected node, and keep the mark when data refreshes.
  useEffect(() => {
    nodeSelRef.current
      ?.select<SVGCircleElement>('circle.node-select')
      .attr('r', (d) => nodeRadius(d) + 13)
      .attr('fill', 'none')
      .attr('stroke', '#ffd166')
      .attr('stroke-width', 2)
      .style('display', (d) => (d.id === selectedId ? 'block' : 'none'))
  }, [selectedId, model])

  /** Release the pin a double-click applied, then drop the selection. */
  const clearSelection = useCallback(() => {
    const sim = simRef.current
    const current = sim?.nodes().find((n) => n.id === selectedId)
    if (current) {
      current.fx = null
      current.fy = null
      sim?.alphaTarget(0).alpha(Math.max(sim.alpha(), 0.05)).restart()
    }
    setSelectedId(null)
  }, [selectedId])

  const selectedNode = selectedId ? model.nodes.find((n) => n.id === selectedId) : undefined
  // Clear a selection whose node left the fabric.
  useEffect(() => {
    if (selectedId && model.nodes.length && !model.nodes.some((n) => n.id === selectedId)) {
      setSelectedId(null)
    }
  }, [model, selectedId])

  const neighbours = useMemo(() => {
    if (!selectedId) return []
    return model.links
      .filter(
        (l) =>
          l.kind !== 'zone' &&
          (endpointId(l.source) === selectedId || endpointId(l.target) === selectedId),
      )
      .map((l) => ({
        peer: endpointId(l.source) === selectedId ? endpointId(l.target) : endpointId(l.source),
        speed: l.speed,
        rtt: l.rtt,
        loss: l.loss,
        down: l.down,
      }))
      .sort((a, b) => a.peer.localeCompare(b.peer))
  }, [model.links, selectedId])

  const zoneCount = new Set(model.nodes.map((n) => n.federation)).size

  return (
    <Card
      ref={cardRef}
      className={cn(expanded && 'fixed inset-0 z-40 flex flex-col overflow-hidden rounded-none')}
      title="Fabric Topology"
      subtitle={
        model.nodes.length
          ? `${model.nodes.length} nodes · ${model.links.length} edges · ${zoneCount} zones · scroll to zoom, drag to pan, double-click a node for details`
          : 'Waiting for snapshot…'
      }
      actions={
        <>
          <Button onClick={fitToView} disabled={!model.nodes.length}>
            Fit to view
          </Button>
          <Button variant={expanded ? 'primary' : 'default'} onClick={toggleFullscreen}>
            {expanded ? 'Exit full screen (Esc)' : 'Full screen'}
          </Button>
        </>
      }
    >
      <div
        ref={wrapRef}
        className={cn(
          'relative w-full animate-fade-slide',
          expanded ? 'min-h-0 flex-1' : undefined,
        )}
        style={expanded ? undefined : { height: naturalHeight }}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
          className="h-full w-full"
        />

        {hover && <HoverCard hover={hover} box={{ width, height }} />}

        {selectedNode && (
          <NodeDetails
            node={selectedNode}
            neighbours={neighbours}
            onClose={clearSelection}
          />
        )}
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
        <Legend swatch={<Dot className="border-2 border-[#ffd166] bg-transparent" />}>
          selected
        </Legend>
        <Legend swatch={<span className="text-[#2c3f57]">┄┄</span>}>same-zone grouping</Legend>
        <Legend swatch={<span className="text-[#4c8fc9]">╍╍</span>}>zone backbone</Legend>
      </div>
    </Card>
  )
}

/** Cursor-following tooltip; flips side near an edge so it never clips. */
function HoverCard({ hover, box }: { hover: Hover; box: { width: number; height: number } }) {
  const flipX = hover.x > box.width - 280
  const flipY = hover.y > box.height - 200
  return (
    <div
      className="pointer-events-none absolute z-20 w-[16rem] rounded-lg border border-edge-2 bg-[#0d1420]/95 p-2.5 text-xs shadow-[0_10px_30px_rgba(0,0,0,0.55)] backdrop-blur-sm"
      style={{
        left: flipX ? undefined : hover.x + 14,
        right: flipX ? box.width - hover.x + 14 : undefined,
        top: flipY ? undefined : hover.y + 14,
        bottom: flipY ? box.height - hover.y + 14 : undefined,
      }}
    >
      {hover.kind === 'node' ? <NodeHover node={hover.data} /> : <LinkHover link={hover.data} />}
    </div>
  )
}

function NodeHover({ node }: { node: GraphNode }) {
  const cpuPct = node.cpuCap > 0 ? node.cpuUsed / node.cpuCap : 0
  const memPct = node.memCap > 0 ? node.memUsed / node.memCap : 0
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <Mono className="text-[13px] text-ink">{node.id}</Mono>
        {node.down ? (
          <Badge tone="bad">DOWN</Badge>
        ) : node.derate > 0.01 ? (
          <Badge tone="warn">DERATE {fmtPct(Math.min(1, node.derate))}</Badge>
        ) : (
          <Badge tone="good">UP</Badge>
        )}
      </div>
      <div className="mt-0.5 text-[11px] text-muted-2">
        {[node.klass, node.arch, `zone ${node.federation}`].filter(Boolean).join(' · ')}
      </div>

      <Meter label="CPU" pct={cpuPct} detail={`${fmt(node.cpuUsed, 1)} / ${fmt(node.cpuCap, 1)} cores`} />
      <Meter label="Memory" pct={memPct} detail={`${fmt(node.memUsed, 1)} / ${fmt(node.memCap, 1)} GB`} />

      <dl className="mt-2 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px]">
        <dt className="text-muted-2">Reservations</dt>
        <dd className="text-ink">{node.reservations}</dd>
        <dt className="text-muted-2">Plan stages</dt>
        <dd className="text-ink">{node.assignStages.length || '—'}</dd>
        <dt className="text-muted-2">Fallback</dt>
        <dd className="text-ink">{node.shadowStages.length || '—'}</dd>
      </dl>
      <p className="mt-2 text-[10px] text-muted-2">Double-click for full details</p>
    </>
  )
}

function LinkHover({ link }: { link: GraphLink }) {
  const a = endpointId(link.source)
  const b = endpointId(link.target)
  if (link.kind === 'zone') {
    return (
      <>
        <div className="text-[12px] text-ink">
          <Mono>{a}</Mono> ↔ <Mono>{b}</Mono>
        </div>
        <p className="mt-1 text-[11px] text-muted-2">
          Same zone — a grouping hint, not a physical link.
        </p>
      </>
    )
  }
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 text-[12px] text-ink">
          <Mono>{a}</Mono> ↔ <Mono>{b}</Mono>
        </div>
        {link.down && <Badge tone="bad">DOWN</Badge>}
      </div>
      {link.kind === 'backbone' && (
        <div className="mt-0.5 text-[11px] text-muted-2">
          zone backbone: {link.fedA} ↔ {link.fedB}
        </div>
      )}
      <dl className="mt-2 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px]">
        <dt className="text-muted-2">Speed</dt>
        <dd className="text-ink">{fmt(link.speed)} Gbps</dd>
        <dt className="text-muted-2">RTT</dt>
        <dd className="text-ink">{fmt(link.rtt, 1)} ms</dd>
        <dt className="text-muted-2">Jitter</dt>
        <dd className="text-ink">{fmt(link.jitter, 2)} ms</dd>
        <dt className="text-muted-2">Loss</dt>
        <dd className="text-ink">{fmt(link.loss)} %</dd>
      </dl>
    </>
  )
}

function Meter({ label, pct, detail }: { label: string; pct: number; detail: string }) {
  const clamped = Math.max(0, Math.min(1, pct))
  const tone = clamped > 0.9 ? 'bg-bad' : clamped > 0.7 ? 'bg-warn' : 'bg-accent'
  return (
    <div className="mt-2">
      <div className="flex justify-between text-[10px] text-muted-2">
        <span>{label}</span>
        <span>{detail}</span>
      </div>
      <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-chip">
        <div className={cn('h-full', tone)} style={{ width: `${clamped * 100}%` }} />
      </div>
    </div>
  )
}

/** Full descriptor for a double-clicked node, fetched on demand. */
function NodeDetails({
  node,
  neighbours,
  onClose,
}: {
  node: GraphNode
  neighbours: { peer: string; speed: number; rtt: number; loss: number; down: boolean }[]
  onClose: () => void
}) {
  const descriptor = useNodeDescriptor(node.id)
  const d = descriptor.data
  const gpu = (d?.gpu ?? {}) as Record<string, unknown>
  const cpu = (d?.cpu ?? {}) as Record<string, unknown>
  const net = (d?.network ?? {}) as Record<string, unknown>

  return (
    <aside className="absolute right-3 top-3 z-30 flex max-h-[calc(100%-1.5rem)] w-[20rem] flex-col overflow-hidden rounded-xl border border-edge-2 bg-[#0d1420]/97 shadow-[0_18px_50px_rgba(0,0,0,0.6)] backdrop-blur">
      <header className="flex items-start justify-between gap-2 border-b border-edge px-3 py-2">
        <div className="min-w-0">
          <Mono className="text-[13px] text-ink">{node.id}</Mono>
          <div className="text-[11px] text-muted-2">
            {[node.klass, node.arch, `zone ${node.federation}`].filter(Boolean).join(' · ')}
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close node details"
          className="cursor-pointer rounded px-1 text-lg leading-none text-muted hover:text-ink"
        >
          ×
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-2.5">
        <div className="flex flex-wrap gap-1.5">
          {node.down ? <Badge tone="bad">DOWN</Badge> : <Badge tone="good">UP</Badge>}
          {node.derate > 0.01 && <Badge tone="warn">derate {fmtPct(Math.min(1, node.derate))}</Badge>}
          {node.reservations > 0 && <Badge tone="info">{node.reservations} reservations</Badge>}
        </div>

        <Meter
          label="CPU"
          pct={node.cpuCap > 0 ? node.cpuUsed / node.cpuCap : 0}
          detail={`${fmt(node.cpuUsed, 1)} / ${fmt(node.cpuCap, 1)} cores`}
        />
        <Meter
          label="Memory"
          pct={node.memCap > 0 ? node.memUsed / node.memCap : 0}
          detail={`${fmt(node.memUsed, 1)} / ${fmt(node.memCap, 1)} GB`}
        />

        <Section title="This plan">
          <Row label="Stages here">
            {node.assignStages.length ? node.assignStages.join(', ') : '—'}
          </Row>
          <Row label="Fallback for">
            {node.shadowStages.length ? node.shadowStages.join(', ') : '—'}
          </Row>
        </Section>

        <Section title={`Links (${neighbours.length})`}>
          {neighbours.length === 0 ? (
            <p className="text-[11px] text-muted-2">No declared links touch this node.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {neighbours.map((l) => (
                <li key={l.peer} className="flex items-center justify-between gap-2 text-[11px]">
                  <Mono className="truncate">{l.peer}</Mono>
                  <span className={l.down ? 'text-[#ffb4b4]' : 'text-muted-2'}>
                    {l.down ? 'down' : `${fmt(l.speed)} Gbps · ${fmt(l.rtt, 1)} ms`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Descriptor">
          {descriptor.isLoading && <p className="text-[11px] text-muted-2">Loading…</p>}
          {descriptor.isError && (
            <p className="text-[11px] text-[#ffb4b4]">{(descriptor.error as Error).message}</p>
          )}
          {d && (
            <>
              <Row label="Role">{String(d.role ?? '—')}</Row>
              <Row label="CPU">
                {[cpu.cores && `${cpu.cores} cores`, cpu.base_ghz && `${cpu.base_ghz} GHz`, cpu.uarch]
                  .filter(Boolean)
                  .join(' · ') || '—'}
              </Row>
              <Row label="GPU">
                {gpu.model && gpu.model !== 'none'
                  ? `${gpu.model}${gpu.vram_gb ? ` · ${gpu.vram_gb} GB` : ''}`
                  : '—'}
              </Row>
              <Row label="Network">
                {[net.fabric, net.speed_gbps && `${net.speed_gbps} Gbps`].filter(Boolean).join(' · ') ||
                  '—'}
              </Row>
              <Row label="Formats">
                <span className="-m-0.5 inline-block">
                  {(d.formats_supported ?? []).length
                    ? (d.formats_supported ?? []).map((f) => <Tag key={f}>{f}</Tag>)
                    : '—'}
                </span>
              </Row>
              {Object.keys(d.labels ?? {}).length > 0 && (
                <Row label="Labels">
                  <span className="-m-0.5 inline-block">
                    {Object.entries(d.labels ?? {}).map(([k, v]) => (
                      <Tag key={k}>
                        {k}={String(v)}
                      </Tag>
                    ))}
                  </span>
                </Row>
              )}
            </>
          )}
        </Section>
      </div>
    </aside>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-3 border-t border-edge pt-2">
      <h4 className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[#a9c3e1]">
        {title}
      </h4>
      {children}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2 py-0.5 text-[11px]">
      <span className="shrink-0 text-muted-2">{label}</span>
      <span className="min-w-0 break-words text-right text-ink">{children}</span>
    </div>
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
