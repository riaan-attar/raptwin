import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { Job, LinkSpec, NodeDescriptor, ObservationPayload, Strategy } from './types'

export const queryKeys = {
  health: ['health'] as const,
  snapshot: ['snapshot'] as const,
  plans: ['plans'] as const,
  jobs: ['jobs'] as const,
  events: ['events'] as const,
  runs: ['runs'] as const,
  topology: ['topology'] as const,
  chaos: ['chaos'] as const,
  node: (name: string) => ['node', name] as const,
}

interface LiveOptions {
  /** Poll interval in ms; pass 0/false-y to freeze updates. */
  intervalMs?: number
}

export function useSnapshot({ intervalMs = 2000 }: LiveOptions = {}) {
  return useQuery({
    queryKey: queryKeys.snapshot,
    queryFn: api.snapshot,
    refetchInterval: intervalMs > 0 ? intervalMs : false,
    // Keep the previous topology on screen while a refetch is in flight so the
    // graph never flashes empty between polls.
    placeholderData: (prev) => prev,
  })
}

export function usePlans({ intervalMs = 2000 }: LiveOptions = {}) {
  return useQuery({
    queryKey: queryKeys.plans,
    queryFn: api.plans,
    refetchInterval: intervalMs > 0 ? intervalMs : false,
    placeholderData: (prev) => prev,
  })
}

export function useJobs() {
  return useQuery({
    queryKey: queryKeys.jobs,
    queryFn: api.jobs,
    staleTime: 30_000,
  })
}

export function useEvents({ intervalMs = 4000, limit = 80 }: LiveOptions & { limit?: number } = {}) {
  return useQuery({
    // Prefix-keyed so the stream's invalidation of queryKeys.events refreshes every window size.
    queryKey: [...queryKeys.events, limit],
    queryFn: () => api.events(limit),
    refetchInterval: intervalMs > 0 ? intervalMs : false,
    placeholderData: (prev) => prev,
  })
}

/** Submit a single job; refreshes plans + snapshot so reservations show up. */
export function usePlanJob() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      job,
      strategy,
      dryRun,
      durationS,
    }: {
      job: Job
      strategy: Strategy
      dryRun: boolean
      durationS?: number
    }) => api.plan(job, strategy, dryRun, durationS),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.plans })
      void qc.invalidateQueries({ queryKey: queryKeys.snapshot })
      void qc.invalidateQueries({ queryKey: queryKeys.runs })
    },
  })
}

export function usePlanBatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      jobs,
      strategy,
      dryRun,
      durationS,
    }: {
      jobs: Job[]
      strategy: Strategy
      dryRun: boolean
      durationS?: number
    }) => api.planBatch(jobs, strategy, dryRun, durationS),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.plans })
      void qc.invalidateQueries({ queryKey: queryKeys.snapshot })
      void qc.invalidateQueries({ queryKey: queryKeys.runs })
    },
  })
}

export function useObserve() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: ObservationPayload) => api.observe(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.snapshot })
      void qc.invalidateQueries({ queryKey: queryKeys.events })
    },
  })
}

export interface BulkResult {
  ok: number
  failed: { index: number; message: string }[]
}

const BULK_CONCURRENCY = 6

/**
 * Sends many observations with a small worker pool and refreshes the snapshot once
 * at the end instead of after every call. One failure does not stop the rest.
 */
export function useBulkObserve() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payloads: ObservationPayload[]): Promise<BulkResult> => {
      const failed: BulkResult['failed'] = []
      let ok = 0
      let next = 0
      const worker = async () => {
        while (next < payloads.length) {
          const index = next++
          try {
            await api.observe(payloads[index])
            ok++
          } catch (e) {
            failed.push({ index, message: (e as Error).message })
          }
        }
      }
      await Promise.all(Array.from({ length: Math.min(BULK_CONCURRENCY, payloads.length) }, worker))
      return { ok, failed }
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.snapshot })
      void qc.invalidateQueries({ queryKey: queryKeys.events })
    },
  })
}

// ---------------------------------------------------------------------------
// Management
// ---------------------------------------------------------------------------

/** Full descriptor for one node; only fetched when an editor opens. */
export function useNodeDescriptor(name: string | null) {
  return useQuery({
    queryKey: queryKeys.node(name ?? ''),
    queryFn: () => api.node(name as string),
    enabled: Boolean(name),
    staleTime: 0,
  })
}

export function useSaveNode() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ node, originalName }: { node: NodeDescriptor; originalName?: string }) => {
      const saved = await api.saveNode(node)
      // A rename is "create the new name, then drop the old one".
      if (originalName && originalName !== node.name) {
        await api.deleteNode(originalName)
      }
      return saved
    },
    onSuccess: (_data, { node }) => {
      void qc.invalidateQueries({ queryKey: queryKeys.snapshot })
      void qc.invalidateQueries({ queryKey: queryKeys.node(node.name) })
    },
  })
}

export function useDeleteNode() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => api.deleteNode(name),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.snapshot })
    },
  })
}

export function useTopology() {
  return useQuery({ queryKey: queryKeys.topology, queryFn: api.topology })
}

export function useSaveLink() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ link, originalKey }: { link: LinkSpec; originalKey?: string }) =>
      api.saveLink(link, originalKey),
    // Resolve only once both lists refetched, so the table never shows a
    // freshly-saved link as "runtime only" for a frame.
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.topology }),
        qc.invalidateQueries({ queryKey: queryKeys.snapshot }),
      ]),
  })
}

export function useDeleteLink() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (key: string) => api.deleteLink(key),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.topology }),
        qc.invalidateQueries({ queryKey: queryKeys.snapshot }),
      ]),
  })
}

export function useSaveJob() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ job, originalId }: { job: Job; originalId?: string }) =>
      api.saveJob(job, originalId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.jobs })
    },
  })
}

export function useDeleteJob() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteJob(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.jobs })
    },
  })
}

export function useClearPlans() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.clearPlans,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.plans })
    },
  })
}

export function useRelease() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (releases: { node: string; reservation_id: string }[]) => api.release(releases),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.snapshot })
    },
  })
}

/** Chaos catalog + run status; polls quickly only while a run is in progress. */
export function useChaos() {
  return useQuery({
    queryKey: queryKeys.chaos,
    queryFn: api.chaos,
    refetchInterval: (query) => (query.state.data?.status.running ? 1000 : false),
  })
}

// ---------------------------------------------------------------------------
// Timed job runs
// ---------------------------------------------------------------------------

export function useRuns({ intervalMs = 5000 }: LiveOptions = {}) {
  return useQuery({
    queryKey: queryKeys.runs,
    queryFn: () => api.runs('all', 100),
    // Countdowns tick on the client; the stream refreshes on start/end, this is the fallback.
    refetchInterval: intervalMs > 0 ? intervalMs : false,
    placeholderData: (prev) => prev,
  })
}

export function useRunSettings() {
  return useQuery({ queryKey: [...queryKeys.runs, 'settings'], queryFn: api.runSettings, staleTime: 15_000 })
}

/** One mutation per run control; each refreshes runs, and the snapshot (capacity changes). */
function useRunMutation<V, R>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.runs })
      void qc.invalidateQueries({ queryKey: queryKeys.snapshot })
      void qc.invalidateQueries({ queryKey: queryKeys.events })
    },
  })
}

export const useFinishRun = () => useRunMutation((id: string) => api.finishRun(id))
export const useCancelRun = () => useRunMutation((id: string) => api.cancelRun(id))
export const useRunTimer = () =>
  useRunMutation(({ id, ...t }: { id: string; remainingS?: number; extendS?: number }) => api.runTimer(id, t))
export const useFinishAllRuns = () => useRunMutation(() => api.finishAllRuns())
export const useUpdateRunSettings = () =>
  useRunMutation((s: Partial<{ auto_release: boolean; default_duration_s: number }>) => api.updateRunSettings(s))

/** Restarts the whole twin, then refetches everything the dashboard shows. */
export function useRestartTwin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (confirm: string) => api.restartTwin(confirm),
    onSuccess: () => {
      void qc.invalidateQueries()
    },
  })
}

export function useStartChaos() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ scenario, speed }: { scenario: string | null; speed: number }) =>
      api.startChaos(scenario, speed),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.chaos })
    },
  })
}

export function useStopChaos() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.stopChaos,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.chaos })
    },
  })
}

export function useResetOverrides() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.resetOverrides,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.chaos })
      void qc.invalidateQueries({ queryKey: queryKeys.snapshot })
    },
  })
}

/** Blast-radius search. A mutation, not a query: expensive and user-triggered. */
export function useBlastRadius() {
  return useMutation({
    mutationFn: (params: { jobId: string; strategy: string; depth: number; deadlineMs?: number }) =>
      api.blastRadius(params),
  })
}

/** What-if comparison; expensive, so user-triggered rather than a query. */
export function useWhatIf() {
  return useMutation({
    mutationFn: (body: {
      changes: Record<string, unknown>
      strategy?: string
      faults?: { kind: string; target: string; value?: number }[]
      jobs?: string[]
    }) => api.whatIf(body),
  })
}
