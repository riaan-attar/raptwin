import type {
  ApiEnvelope,
  EventsResponse,
  Job,
  JobCatalogEntry,
  ObservationPayload,
  PlanResult,
  Snapshot,
  Strategy,
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
}
