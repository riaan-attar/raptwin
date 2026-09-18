import type {
  ApiEnvelope,
  BlastRadiusReport,
  ChaosInfo,
  ChaosStatus,
  EventsResponse,
  Job,
  JobCatalogEntry,
  LinkSpec,
  NodeDescriptor,
  ObservationPayload,
  PlanResult,
  Snapshot,
  Strategy,
  TopologyInfo,
} from './types'

/** Vite proxies /api -> the Flask DT API, stripping the prefix (see vite.config.ts). */
const BASE = '/api'

export class ApiError extends Error {
  status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
      ...init,
    })
  } catch (cause) {
    throw new ApiError(
      `Cannot reach the Digital Twin API. Is dt.api running on :8080? (${String(cause)})`,
    )
  }

  let body: ApiEnvelope<T> | null = null
  try {
    body = (await res.json()) as ApiEnvelope<T>
  } catch {
    throw new ApiError(`API returned a non-JSON response (HTTP ${res.status})`, res.status)
  }

  if (!res.ok || !body || body.ok !== true) {
    const detail = body && body.ok === false ? body.error : `HTTP ${res.status}`
    throw new ApiError(detail, res.status)
  }
  return body.data
}

export const api = {
  health: () => request<{ ts: number }>('/health'),

  snapshot: () => request<Snapshot>('/snapshot'),

  /** Recent plans committed through the API (dt.api RECENT_PLANS). */
  plans: () => request<PlanResult[]>('/plans'),

  /** Job descriptors discovered under jobs/*.yaml. */
  jobs: () => request<JobCatalogEntry[]>('/jobs'),

  events: (limit = 100, since?: string) => {
    const params = new URLSearchParams({ limit: String(limit) })
    if (since) params.set('since', since)
    return request<EventsResponse>(`/events?${params}`)
  },

  plan: (job: Job, strategy: Strategy, dryRun: boolean) =>
    request<PlanResult>('/plan', {
      method: 'POST',
      body: JSON.stringify({ job, strategy, dry_run: dryRun }),
    }),

  planBatch: (jobs: Job[], strategy: Strategy, dryRun: boolean) =>
    request<{ results: PlanResult[] }>('/plan_batch', {
      method: 'POST',
      body: JSON.stringify({ jobs, strategy, dry_run: dryRun }),
    }),

  observe: (payload: ObservationPayload) =>
    request<{ applied: boolean }>('/observe', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  release: (releases: { node: string; reservation_id: string }[]) =>
    request<{ released: { node: string; reservation_id: string; released: boolean }[] }>(
      '/release',
      { method: 'POST', body: JSON.stringify({ releases }) },
    ),

  // ---- management --------------------------------------------------------

  node: (name: string) => request<NodeDescriptor>(`/nodes/${encodeURIComponent(name)}`),

  saveNode: (node: NodeDescriptor) =>
    request<{ node: string; persisted: boolean }>('/add_node', {
      method: 'POST',
      body: JSON.stringify({ node, persist: true }),
    }),

  deleteNode: (name: string) =>
    request<{ node: string; dropped_reservations: string[] }>(
      `/nodes/${encodeURIComponent(name)}`,
      { method: 'DELETE' },
    ),

  topology: () => request<TopologyInfo>('/topology'),

  saveLink: (link: LinkSpec, originalKey?: string) =>
    request<LinkSpec & { key: string }>('/links', {
      method: 'POST',
      body: JSON.stringify({ link, original_key: originalKey }),
    }),

  deleteLink: (key: string) =>
    request<{ key: string }>(`/links?${new URLSearchParams({ key })}`, { method: 'DELETE' }),

  saveJob: (job: Job, originalId?: string) =>
    request<{ id: string; file: string; created: boolean }>('/jobs', {
      method: 'POST',
      body: JSON.stringify({ job, original_id: originalId }),
    }),

  deleteJob: (id: string) =>
    request<{ id: string; file: string }>(`/jobs?${new URLSearchParams({ id })}`, {
      method: 'DELETE',
    }),

  clearPlans: () => request<{ cleared: number }>('/plans', { method: 'DELETE' }),

  chaos: () => request<ChaosInfo>('/chaos'),

  startChaos: (scenario: string | null, speed: number) =>
    request<ChaosStatus>('/chaos/start', {
      method: 'POST',
      body: JSON.stringify({ scenario, speed }),
    }),

  stopChaos: () => request<{ stopped: boolean }>('/chaos/stop', { method: 'POST' }),

  blastRadius: (params: {
    jobId: string
    strategy: string
    depth: number
    deadlineMs?: number
  }) =>
    request<BlastRadiusReport>('/blast_radius', {
      method: 'POST',
      body: JSON.stringify({
        job_id: params.jobId,
        strategy: params.strategy,
        depth: params.depth,
        deadline_ms: params.deadlineMs,
      }),
    }),

  resetOverrides: () =>
    request<{ nodes_reset: number; links_reset: number; chaos_stopped: boolean }>(
      '/overrides/reset',
      { method: 'POST' },
    ),
}
