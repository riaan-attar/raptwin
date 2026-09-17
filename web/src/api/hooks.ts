import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { Job, LinkSpec, NodeDescriptor, ObservationPayload, Strategy } from './types'

export const queryKeys = {
  health: ['health'] as const,
  snapshot: ['snapshot'] as const,
  plans: ['plans'] as const,
  jobs: ['jobs'] as const,
  events: ['events'] as const,
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

export function useEvents({ intervalMs = 4000 }: LiveOptions = {}) {
  return useQuery({
    queryKey: queryKeys.events,
    queryFn: () => api.events(80),
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
    }: {
      job: Job
      strategy: Strategy
      dryRun: boolean
    }) => api.plan(job, strategy, dryRun),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.plans })
      void qc.invalidateQueries({ queryKey: queryKeys.snapshot })
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
    }: {
      jobs: Job[]
      strategy: Strategy
      dryRun: boolean
    }) => api.planBatch(jobs, strategy, dryRun),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.plans })
      void qc.invalidateQueries({ queryKey: queryKeys.snapshot })
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
