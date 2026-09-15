import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { Job, ObservationPayload, Strategy } from './types'

export const queryKeys = {
  health: ['health'] as const,
  snapshot: ['snapshot'] as const,
  plans: ['plans'] as const,
  jobs: ['jobs'] as const,
  events: ['events'] as const,
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
