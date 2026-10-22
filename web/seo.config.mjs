// Single source for the static, crawlable copies of the SPA written at build time (see
// vite.seo.mjs). Search engines ignore "#fragment" routes, so every tab and docs page also
// gets its own path (/nodes/, /docs/api/) with its own title, description and canonical.
// The app still routes on the hash; the generated page's inline script sets it on load.

export const SITE = 'https://raptwin.seloraos.online'
export const AUTHOR = 'Riaan Attar'

export const TABS = [
  { id: 'nodes', hash: 'nodes', title: 'Nodes Management — Heterogeneous Compute Fabric', description: 'Add, edit, take down and bulk-fault the nodes of a distributed fabric digital twin: CPU, GPU, memory, formats, zones and reliability. RAP Twin by Riaan Attar.', keywords: 'fabric nodes, compute node management, GPU nodes, bulk node faults, derate, node descriptors' },
  { id: 'links', hash: 'links', title: 'Fabric Links & Interconnects — InfiniBand, Ethernet, Wi-Fi', description: 'Manage and degrade the links of a distributed fabric simulator: latency, loss, bandwidth, partitions and federation links. RAP Twin by Riaan Attar.', keywords: 'network links, InfiniBand, Ethernet, Wi-Fi 7, LTE, link degradation, network partition simulation' },
  { id: 'job-library', hash: 'jobs', title: 'Job Library — Workload Catalogues & Multi-Stage Jobs', description: 'Browse, filter and edit job catalogues for the AI workload planner: multi-stage DAG jobs, edge cases and wide spread jobs, with batch planning. RAP Twin by Riaan Attar.', keywords: 'job catalogue, workload scheduling, DAG jobs, multi-stage workloads, job planner' },
  { id: 'events', hash: 'events', title: 'Events & Jobs — Running Jobs, Job Timer & Twin Events', description: 'Watch running jobs with live countdown timers, extend or finish them to free reservations, and explore the digital twin CloudEvent feed. RAP Twin by Riaan Attar.', keywords: 'running jobs, job timer, resource reservation release, CloudEvents, event stream, job runs' },
  { id: 'chaos', hash: 'chaos', title: 'Chaos Testing & Autonomous Self-Healing', description: 'Run chaos scenarios, inject faults and watch autonomous self-healing recover a distributed fabric digital twin. Blast radius analysis and incident bundles. RAP Twin by Riaan Attar.', keywords: 'chaos engineering, fault injection, self-healing, blast radius, incident bundle, resilience testing' },
  { id: 'whatif', hash: 'whatif', title: 'What-If Topology & Capacity Analysis', description: 'Fork the digital twin, add or remove nodes and links, apply outages and compare SLA, latency, cost and carbon before changing real infrastructure. RAP Twin by Riaan Attar.', keywords: 'what-if analysis, capacity planning, topology simulation, outage simulation, cost and carbon analysis' },
  { id: 'reservations', hash: 'reservations', title: 'Fabric Resource Reservations', description: 'See and release the CPU, memory and GPU reservations held by committed plans and running jobs in the fabric digital twin. RAP Twin by Riaan Attar.', keywords: 'resource reservations, capacity management, release reservations, workload placement' },
]

export const DOCS = [
  { id: 'introduction', title: 'Introduction', description: 'What RAP Twin is: a distributed fabric digital twin that plans AI workloads, injects faults and heals itself. Concepts and glossary.' },
  { id: 'quickstart', title: 'Quickstart', description: 'Install RAP Twin, start the API and dashboard, and place your first job in minutes.' },
  { id: 'architecture', title: 'Architecture', description: 'Modules, data flow and design decisions behind the RAP Twin digital twin, planners and controllers.' },
  { id: 'state', title: 'Digital Twin State', description: 'How the twin holds nodes, links, overrides and reservations, and publishes CloudEvents.' },
  { id: 'nodes', title: 'Node Descriptors', description: 'The YAML schema for fabric nodes: CPU, GPU, memory, formats, labels and network, with generation and validation.' },
  { id: 'topology', title: 'Topology and Links', description: 'Sites, link profiles, pricing, energy and scenarios in the RAP Twin topology model.' },
  { id: 'jobs', title: 'Jobs', description: 'Job descriptors: stages, deadlines, formats, resources, catalogues and the optional run duration.' },
  { id: 'dashboard', title: 'Dashboard Guide', description: 'Every tab of the RAP Twin dashboard: Nodes, Links, Job Library, Events & Jobs, Chaos, What-if and Reservations, with workflows.' },
  { id: 'planning', title: 'Planning', description: 'Greedy, Resilient and RL-Markov planners, dry run versus commit, cost and carbon, and the Markov cost model.' },
  { id: 'chaos', title: 'Chaos and Resilience', description: 'Fault events, scenarios, self-healing and the resource guardian in RAP Twin.' },
  { id: 'analysis', title: 'Analysis Tools', description: 'What-if analysis, Monte Carlo, benchmarks, incident bundles, exporters and Docker.' },
  { id: 'telemetry', title: 'Telemetry Ingestion', description: 'Feed observations into the twin with the observe route and MQTT, including noise injection.' },
  { id: 'api', title: 'API Reference', description: 'All HTTP routes of the RAP Twin API: plan, runs, jobs, nodes, links, chaos and the SSE event stream, with examples.' },
  { id: 'configuration', title: 'Configuration', description: 'Environment variables and defaults for the RAP Twin API, planners, run timer and controllers.' },
  { id: 'results', title: 'Measured Results', description: 'Benchmark results for the Greedy, Resilient and RL-Markov planners: SLA, job completion time and energy.' },
  { id: 'deployment', title: 'Deployment and Security', description: 'Deploy RAP Twin with Caddy, gunicorn and systemd, TLS and API-key protection.' },
  { id: 'troubleshooting', title: 'Troubleshooting and FAQ', description: 'Common RAP Twin errors, fixes and frequently asked questions.' },
]
