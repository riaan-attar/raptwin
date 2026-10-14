import type { ReactNode } from 'react'

/** Theme-aware SVG diagrams. Colours come from the app's CSS variables. */

const INK = 'var(--color-ink)'
const MUTED = 'var(--color-muted)'
const PANEL = 'var(--color-panel-2)'

function Frame({ viewBox, label, minWidth = 640, children }: { viewBox: string; label: string; minWidth?: number; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-edge-2 bg-panel p-2">
      <svg viewBox={viewBox} role="img" aria-label={label} className="h-auto w-full" style={{ minWidth }}>
        <defs>
          <marker id="doc-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" style={{ fill: MUTED }} />
          </marker>
        </defs>
        {children}
      </svg>
    </div>
  )
}

function Box({
  x, y, w, h, color, title, lines = [], size = 12,
}: {
  x: number; y: number; w: number; h: number; color: string; title: string; lines?: string[]; size?: number
}) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={10} style={{ fill: PANEL, stroke: color }} strokeWidth={1.5} />
      <text x={x + 12} y={y + 22} style={{ fill: color }} fontSize={size + 1} fontWeight={700}>
        {title}
      </text>
      {lines.map((l, i) => (
        <text key={l} x={x + 12} y={y + 44 + i * 20} style={{ fill: INK }} fontSize={size}>
          {l}
        </text>
      ))}
    </g>
  )
}

function Arrow({ d, color = MUTED, dashed = false }: { d: string; color?: string; dashed?: boolean }) {
  return (
    <path d={d} fill="none" style={{ stroke: color }} strokeWidth={1.5} strokeDasharray={dashed ? '5 4' : undefined} markerEnd="url(#doc-arrow)" />
  )
}

export function ArchitectureDiagram() {
  return (
    <Frame
      viewBox="0 0 960 430"
      label="RAP Twin architecture: a state engine feeds a planner and predictive analytics; a chaos engine injects faults into the state; an interoperability layer exposes the dashboard, REST API and exporters."
    >
      <Box x={10} y={10} w={290} h={250} color="var(--color-accent)" title="Digital twin state engine" lines={[
        'DTState (single source of truth)',
        'YAML descriptors + hot reload',
        'REST  POST /observe',
        'MQTT ingestion (sim/mqtt_bridge.py)',
        'Predictive risk and reliability',
      ]} />
      <Box x={335} y={10} w={290} h={250} color="var(--color-good)" title="Multi-strategy planner" lines={[
        'Workload DAG parser',
        'Greedy / Cheapest-Energy',
        'Resilient / Federated',
        'RL-Markov (MDP + Q-learning)',
        'Dry-run evaluation',
        'GPU-aware container launcher',
      ]} />
      <Box x={660} y={10} w={290} h={110} color="var(--color-warn)" title="Predictive analytics" lines={[
        'Utilisation, thermal, link-loss risk',
        'Node reliability scores',
      ]} />
      <Box x={660} y={150} w={290} h={110} color="var(--color-bad)" title="Chaos engine and controllers" lines={[
        'Deterministic fault scenarios',
        'Self-healing, resource guardian',
      ]} />
      <Box x={10} y={340} w={940} h={80} color={MUTED} title="Interoperability layer" lines={[
        'React dashboard   |   REST API (optional X-API-Key on mutating routes)   |   DTDL and Kubernetes CRD exporters',
      ]} />
      <Arrow d="M300 110 L333 110" />
      <Arrow d="M625 70 L658 70" />
      <Arrow d="M805 262 L805 300 L240 300 L240 262" color="var(--color-bad)" dashed />
      <text x={560} y={293} style={{ fill: 'var(--color-bad)' }} fontSize={11}>
        inject fault / heal
      </text>
      <Arrow d="M90 262 L90 338" />
      <Arrow d="M420 262 L420 338" />
    </Frame>
  )
}

const LOOP = [
  ['1 Fabric &', 'telemetry', 'var(--color-accent)'],
  ['2 State', 'merge', 'var(--color-accent)'],
  ['3 Chaos &', 'controllers', 'var(--color-bad)'],
  ['4 Predictive', 'analytics', 'var(--color-warn)'],
  ['5 Planning', '(4 strategies)', 'var(--color-good)'],
  ['6 What-if &', 'blast radius', 'var(--color-muted)'],
  ['7 Visualise', '& export', 'var(--color-accent-strong)'],
] as const

export function ClosedLoopDiagram() {
  return (
    <Frame viewBox="0 0 960 190" label="The seven-stage closed loop, with results and new telemetry feeding back into the twin." minWidth={720}>
      {LOOP.map(([a, b, color], i) => {
        const x = i * 140
        return (
          <g key={a}>
            <rect x={x} y={20} width={120} height={80} rx={10} style={{ fill: PANEL, stroke: color }} strokeWidth={1.5} />
            <text x={x + 60} y={56} textAnchor="middle" style={{ fill: INK }} fontSize={13} fontWeight={700}>{a}</text>
            <text x={x + 60} y={76} textAnchor="middle" style={{ fill: INK }} fontSize={13} fontWeight={700}>{b}</text>
            {i < LOOP.length - 1 && <Arrow d={`M${x + 120} 60 L${x + 140} 60`} />}
          </g>
        )
      })}
      <Arrow d="M900 102 L900 150 L60 150 L60 104" color="var(--color-accent)" dashed />
      <text x={330} y={172} style={{ fill: 'var(--color-accent)' }} fontSize={12}>
        results and new telemetry feed back into the twin
      </text>
    </Frame>
  )
}

export function RequestFlowDiagram() {
  return (
    <Frame viewBox="0 0 960 200" label="Request flow in production: browser to Caddy to a single gunicorn worker holding the twin state." minWidth={720}>
      <Box x={10} y={30} w={190} h={110} color="var(--color-accent)" title="Browser" lines={['React SPA', 'EventSource /api/stream']} />
      <Box x={270} y={30} w={210} h={110} color="var(--color-good)" title="Caddy" lines={['TLS (Let’s Encrypt)', '/ serves the SPA', '/api/* proxied, prefix cut']} />
      <Box x={550} y={30} w={190} h={110} color="var(--color-warn)" title="gunicorn" lines={['loopback only', '1 worker, 24 threads', 'dt.api:app']} />
      <Box x={810} y={30} w={140} h={110} color="var(--color-bad)" title="DTState" lines={['in-process', 'event bus']} />
      <Arrow d="M200 85 L268 85" />
      <Arrow d="M480 85 L548 85" />
      <Arrow d="M740 85 L808 85" />
    </Frame>
  )
}
