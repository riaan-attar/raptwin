import type { NodeDescriptor } from '../api/types'

/** Small immutable helpers for editing nested descriptor objects from forms. */

type Obj = Record<string, unknown>

export function getIn(obj: unknown, path: string[]): unknown {
  let cur: unknown = obj
  for (const key of path) {
    if (cur === null || typeof cur !== 'object') return undefined
    cur = (cur as Obj)[key]
  }
  return cur
}

/**
 * Return a copy of `obj` with `path` set to `value`. `undefined` or '' removes
 * the key, so clearing a form field doesn't write `field: null` into the YAML.
 */
export function setIn<T extends Obj>(obj: T, path: string[], value: unknown): T {
  const [head, ...rest] = path
  const copy: Obj = { ...obj }
  if (rest.length === 0) {
    if (value === undefined || value === '') delete copy[head]
    else copy[head] = value
    return copy as T
  }
  const child = copy[head]
  const next = setIn(child && typeof child === 'object' ? (child as Obj) : {}, rest, value)
  if (Object.keys(next).length === 0) delete copy[head]
  else copy[head] = next
  return copy as T
}

/** "key=value" lines <-> a flat string map (node labels). */
export function labelsToText(labels: Record<string, unknown> | undefined): string {
  return Object.entries(labels ?? {})
    .map(([k, v]) => `${k}=${v ?? ''}`)
    .join('\n')
}

export function textToLabels(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of text.split('\n')) {
    const idx = line.indexOf('=')
    if (idx <= 0) continue
    const key = line.slice(0, idx).trim()
    if (key) out[key] = line.slice(idx + 1).trim()
  }
  return out
}

export const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/

export function newNodeTemplate(existing: Set<string>): NodeDescriptor {
  let name = 'node-001'
  for (let i = 2; existing.has(name); i++) name = `node-${String(i).padStart(3, '0')}`
  return {
    name,
    class: 'server',
    arch: 'amd64',
    role: 'worker',
    cpu: { cores: 8, base_ghz: 3.0, turbo_ghz: 4.0, tdp_w: 65 },
    memory: { ram_gb: 16 },
    storage: { type: 'nvme', size_gb: 512 },
    gpu: { vram_gb: 0 },
    network: { fabric: 'ethernet', speed_gbps: 10, base_latency_ms: 1.0 },
    labels: { zone: 'lab' },
    health: { reliability: 0.95 },
    formats_supported: ['native', 'wasm'],
  }
}
