import type { Job } from '../api/types'

/**
 * The 3-stage demo job the old dashboard exposed via its /api/plan_demo route.
 * Built client-side now so it posts straight to the DT API's /plan endpoint.
 */
export function makeDemoJob(): Job {
  return {
    id: `demo-${Math.floor(Date.now() / 1000)}`,
    deadline_ms: 5000,
    stages: [
      {
        id: 'ingest',
        type: 'io',
        size_mb: 40,
        resources: { cpu_cores: 1, mem_gb: 1 },
        allowed_formats: ['native', 'wasm'],
      },
      {
        id: 'prep',
        type: 'preproc',
        size_mb: 60,
        resources: { cpu_cores: 2, mem_gb: 2 },
        allowed_formats: ['native', 'cuda', 'wasm'],
      },
      {
        id: 'mlp',
        type: 'mlp',
        size_mb: 100,
        resources: { cpu_cores: 4, mem_gb: 4, gpu_vram_gb: 2 },
        allowed_formats: ['cuda', 'native'],
      },
    ],
  }
}
