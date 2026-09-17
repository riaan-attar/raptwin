/**
 * Payload shapes returned by the Flask Digital Twin API (dt/api.py).
 * Every endpoint wraps its result in { ok, data } / { ok, error }.
 */

export interface ApiOk<T> {
  ok: true
  data: T
}

export interface ApiErr {
  ok: false
  error: string
}

export type ApiEnvelope<T> = ApiOk<T> | ApiErr

/** dt.state.NodeDyn — mutable runtime fields merged from overrides + telemetry. */
export interface NodeDyn {
  down?: boolean
  thermal_derate?: number
  power_cap_w?: number | null
  clock_skew_ms?: number | null
  packet_dup?: number | null
  packet_reorder?: number | null
  used_cpu_cores?: number
  used_mem_gb?: number
  used_gpu_vram_gb?: number
  reliability?: number
  availability_window_sec?: number | null
  mtbf_hours?: number | null
  uptime_hours?: number | null
  battery_pct?: number | null
  battery_drain_pct_per_hr?: number | null
  util_forecast?: number
  projected_derate?: number
  predicted_failure_window_sec?: number | null
  reservations?: Record<string, ReservationInfo>
}

export interface ReservationInfo {
  cpu_cores: number
  mem_gb: number
  gpu_vram_gb: number
  ts: number
}

/** Static capacity cache computed by dt.state._compute_and_cache_capacities. */
export interface NodeCaps {
  cpu_units?: number
  max_cpu_cores?: number
  ram_gb?: number
  gpu_vram_gb?: number
}

/** Post-derate, post-reservation headroom. */
export interface NodeEffective {
  max_cpu_cores?: number
  max_mem_gb?: number
  max_gpu_vram_gb?: number
  free_cpu_cores?: number
  free_mem_gb?: number
  free_gpu_vram_gb?: number
}

export interface SnapshotNode {
  name: string
  class?: string
  arch?: string
  formats_supported?: string[]
  labels?: Record<string, string>
  network?: Record<string, unknown>
  gpu?: Record<string, unknown>
  caps?: NodeCaps
  dyn?: NodeDyn
  effective?: NodeEffective
}

export interface LinkMetrics {
  down?: boolean
  speed_gbps?: number
  rtt_ms?: number
  jitter_ms?: number
  loss_pct?: number
  ecn?: boolean
  latency_p95_ms?: number | null
}

export interface SnapshotLink {
  key: string
  a: string
  b: string
  base?: LinkMetrics
  dyn?: LinkMetrics
  effective?: LinkMetrics
}

export interface Federation {
  name: string
  nodes: string[]
  total_cpu_cores: number
  free_cpu_cores: number
  total_mem_gb: number
  free_mem_gb: number
  total_gpu_vram_gb: number
  free_gpu_vram_gb: number
  down_nodes: number
  hot_nodes: number
  reservations: number
  avg_trust: number | null
  avg_loss_pct: number | null
  load_factor: number
  down_fraction: number
  hot_fraction: number
}

export interface FederationLink {
  a: string
  b: string
  links: number
  down_links: number
  min_speed_gbps: number | null
  max_loss_pct: number
  avg_rtt_ms: number
}

export interface PredictiveNode {
  util_now: number
  util_forecast: number
  reliability: number
  availability_window_sec: number | null
  projected_derate: number
}

export interface PredictiveLink {
  latency_ms: number
  jitter_ms: number
  loss_pct: number
  latency_p95_ms: number | null
}

export interface PredictiveOverview {
  nodes: Record<string, PredictiveNode>
  links: Record<string, PredictiveLink>
}

export interface Snapshot {
  ts: number
  nodes: SnapshotNode[]
  links: SnapshotLink[]
  federations: Federation[]
  federation_links: FederationLink[]
  node_federations: Record<string, string>
  predictive: PredictiveOverview
}

/** One entry of a plan's per_stage array (planner annotations + cost model metrics). */
export interface PlanStage {
  id?: string
  node?: string | null
  reservation_id?: string | null
  format?: string | null
  compute_ms?: number
  xfer_ms?: number
  energy_kj?: number
  risk?: number
  reliability?: number | null
  availability_window_sec?: number | null
  score?: number
  infeasible?: boolean
  reason?: string
  federation?: string
  fallbacks?: PlanFallback[]
  fallback_federations?: string[]
  shadow_reservations?: { node: string; reservation_id: string }[]
  load_factor?: number
  network_penalty?: number
  expected_cost?: number
}

export interface PlanFallback {
  node?: string
  score?: number
  reliability?: number | null
  availability_window_sec?: number | null
  federation?: string
}

export interface PlanResult {
  job_id?: string | null
  assignments: Record<string, string>
  per_stage: PlanStage[]
  reservations: { node: string; reservation_id: string; stage_id?: string; role?: string }[]
  shadow_assignments?: Record<string, string[]>
  latency_ms: number
  energy_kj: number
  risk: number
  avg_reliability?: number | null
  deadline_ms?: number | null
  slo_penalty?: number
  infeasible: boolean
  strategy?: string
  dry_run?: boolean
  reason?: string
  ts?: number
  federation_spread?: number
  federations_in_use?: string[]
  resilience_score?: number
  cross_federation_fallback_ratio?: number
  mdp_value?: number
  self_healing_registered?: boolean
  predictive?: PredictiveOverview
}

/** A stage of a job descriptor (jobs/*.yaml). */
export interface JobStage {
  id: string
  type?: string
  size_mb?: number
  resources?: {
    cpu_cores?: number
    mem_gb?: number
    gpu_vram_gb?: number
    [key: string]: unknown
  }
  allowed_formats?: string[]
  disallowed_formats?: string[]
  [key: string]: unknown
}

export interface Job {
  id?: string
  deadline_ms?: number
  redundancy?: number
  stages: JobStage[]
  [key: string]: unknown
}

/** One entry from GET /jobs (the jobs/ YAML catalog). */
export interface JobCatalogEntry {
  id: string
  file: string
  index: number
  path: string
  job: Job
}

/** CloudEvent emitted by the twin (GET /events). */
export interface FabricEvent {
  id: string
  type: string
  source: string
  time: string
  subject?: string
  data: Record<string, unknown>
}

export interface EventsResponse {
  events: FabricEvent[]
  limit: number
  since: string | null
}

/** Observation payload accepted by POST /observe. */
export interface ObservationPayload {
  action?: 'apply' | 'revert'
  payload: {
    type: 'node' | 'link'
    node?: string
    key?: string
    changes?: Record<string, unknown>
    fields?: string[]
  }
}

export type Strategy =
  | 'greedy'
  | 'cheapest-energy'
  | 'bandit'
  | 'resilient'
  | 'network-aware'
  | 'federated'
  | 'balanced'
  | 'fault-tolerant'
  | 'rl-markov'
  | 'mdp'

export const STRATEGIES: { value: Strategy; label: string }[] = [
  { value: 'greedy', label: 'Greedy latency' },
  { value: 'cheapest-energy', label: 'Cheapest energy' },
  { value: 'bandit', label: 'Bandit format-aware' },
  { value: 'resilient', label: 'Resilient federation' },
  { value: 'network-aware', label: 'Network aware' },
  { value: 'federated', label: 'Federated spread' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'rl-markov', label: 'RL Markov planner' },
]

// ---------------------------------------------------------------------------
// Management endpoints
// ---------------------------------------------------------------------------

export const NODE_CLASSES = ['phone', 'sbc', 'laptop', 'workstation', 'gaming_rig', 'server', 'hpc'] as const
export const NODE_ROLES = ['worker', 'manager', 'gateway', 'storage', 'accelerator'] as const
export const NODE_ARCHES = ['amd64', 'arm64', 'riscv64'] as const
export const NETWORK_FABRICS = ['ethernet', 'infiniband', 'wifi', 'lte', 'satellite'] as const
export const WORKLOAD_FORMATS = ['native', 'wasm', 'cuda', 'npu', 'fpga', 'asic'] as const

/** A node as stored in nodes/<name>.yaml (GET /nodes/<name>). Open-ended on purpose. */
export interface NodeDescriptor {
  name: string
  class?: string
  arch?: string
  role?: string
  cpu?: { cores?: number; base_ghz?: number; uarch?: string; [key: string]: unknown }
  memory?: { ram_gb?: number; [key: string]: unknown }
  gpu?: { model?: string; vram_gb?: number; vendor?: string; [key: string]: unknown }
  network?: { fabric?: string; speed_gbps?: number; base_latency_ms?: number; [key: string]: unknown }
  health?: { reliability?: number; [key: string]: unknown }
  labels?: Record<string, string>
  formats_supported?: string[]
  [key: string]: unknown
}

/** One entry of the topology.yaml `links:` list. */
export interface LinkSpec {
  key?: string
  a: string
  b: string
  profile?: string
  qos_class?: string
  scope?: string
  subnet?: string
  speed_gbps?: number
  rtt_ms?: number
  jitter_ms?: number
  loss_pct?: number
  ecn?: boolean
}

export interface LinkProfile {
  name: string
  fabric?: string
  speed_gbps?: number
  rtt_ms?: number
  jitter_ms?: number
  loss_pct?: number
  ecn?: boolean
  mtu_bytes?: number
}

export interface TopologyInfo {
  links: (LinkSpec & { key: string })[]
  link_profiles: LinkProfile[]
  sites: string[]
  subnets: string[]
  qos_classes: string[]
  default_network: Record<string, unknown>
}

export interface ChaosScenario {
  name: string
  description?: string
  events: number
}

export interface ChaosStatus {
  running: boolean
  scenario: string | null
  speed: number | null
  started_ts: number | null
  finished_ts: number | null
  applied: number
  total: number
  stopped: boolean
  log: { ts: number; msg: string }[]
}

export interface ChaosInfo {
  base_events: number
  scenarios: ChaosScenario[]
  status: ChaosStatus
}
