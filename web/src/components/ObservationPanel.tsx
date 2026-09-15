import { useMemo, useState } from 'react'
import { useObserve } from '../api/hooks'
import type { ObservationPayload, Snapshot } from '../api/types'
import { Button, Card } from './ui/primitives'

type Target = 'node' | 'link'

const NODE_FIELDS = [
  { key: 'down', label: 'Down (true/false)', placeholder: 'true' },
  { key: 'thermal_derate', label: 'Thermal derate (0–1)', placeholder: '0.35' },
  { key: 'reliability', label: 'Reliability (0–1)', placeholder: '0.6' },
  { key: 'used_cpu_cores', label: 'Used CPU cores', placeholder: '4' },
  { key: 'power_cap_w', label: 'Power cap (W)', placeholder: '120' },
]

const LINK_FIELDS = [
  { key: 'down', label: 'Down (true/false)', placeholder: 'true' },
  { key: 'loss_pct', label: 'Loss (%)', placeholder: '12' },
  { key: 'rtt_ms', label: 'RTT (ms)', placeholder: '55' },
  { key: 'jitter_ms', label: 'Jitter (ms)', placeholder: '8' },
  { key: 'speed_gbps', label: 'Speed (Gbps)', placeholder: '0.5' },
]

/** Values arrive from text inputs; coerce to the JSON types the API expects. */
function coerce(raw: string): unknown {
  const v = raw.trim()
  if (v === 'true') return true
  if (v === 'false') return false
  const n = Number(v)
  return Number.isFinite(n) && v !== '' ? n : v
}

export function ObservationPanel({ snapshot }: { snapshot?: Snapshot }) {
  const observe = useObserve()
  const [target, setTarget] = useState<Target>('node')
  const [name, setName] = useState('')
  const [field, setField] = useState('down')
  const [value, setValue] = useState('true')
  const [status, setStatus] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)

  const nodeNames = useMemo(
    () => (snapshot?.nodes ?? []).map((n) => n.name).sort(),
    [snapshot],
  )
  const linkKeys = useMemo(() => (snapshot?.links ?? []).map((l) => l.key).sort(), [snapshot])
  const options = target === 'node' ? nodeNames : linkKeys
  const fields = target === 'node' ? NODE_FIELDS : LINK_FIELDS
  const effectiveName = name || options[0] || ''

  async function send(action: 'apply' | 'revert') {
    if (!effectiveName) {
      setStatus({ tone: 'err', text: 'Pick a target first.' })
      return
    }
    const payload: ObservationPayload =
      action === 'apply'
        ? {
            action: 'apply',
            payload:
              target === 'node'
                ? { type: 'node', node: effectiveName, changes: { [field]: coerce(value) } }
                : { type: 'link', key: effectiveName, changes: { [field]: coerce(value) } },
          }
        : {
            action: 'revert',
            payload:
              target === 'node'
                ? { type: 'node', node: effectiveName, fields: [field] }
                : { type: 'link', key: effectiveName, fields: [field] },
          }

    try {
      await observe.mutateAsync(payload)
      setStatus({
        tone: 'ok',
        text:
          action === 'apply'
            ? `Applied ${field}=${value} to ${effectiveName}`
            : `Reverted ${field} on ${effectiveName}`,
      })
    } catch (e) {
      setStatus({ tone: 'err', text: (e as Error).message })
    }
  }

  const selectCls =
    'rounded-lg border border-edge-2 bg-[#0e1420] px-2.5 py-1.5 text-sm outline-none focus:border-[#3a5575]'

  return (
    <Card
      title="Inject Observation"
      subtitle="Same path sim/chaos.py uses — POSTs to /observe and merges into live dyn state"
    >
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-[11px] text-muted-2">
          Target
          <select
            className={selectCls}
            value={target}
            onChange={(e) => {
              const next = e.target.value as Target
              setTarget(next)
              setName('')
              setField(next === 'node' ? 'down' : 'loss_pct')
              setValue(next === 'node' ? 'true' : '12')
            }}
          >
            <option value="node">Node</option>
            <option value="link">Link</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-[11px] text-muted-2">
          {target === 'node' ? 'Node' : 'Link key'}
          <select
            className={`${selectCls} max-w-[16rem]`}
            value={effectiveName}
            onChange={(e) => setName(e.target.value)}
          >
            {options.length === 0 && <option value="">(none available)</option>}
            {options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-[11px] text-muted-2">
          Field
          <select
            className={selectCls}
            value={field}
            onChange={(e) => {
              setField(e.target.value)
              const f = fields.find((x) => x.key === e.target.value)
              if (f) setValue(f.placeholder)
            }}
          >
            {fields.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-[11px] text-muted-2">
          Value
          <input
            className={`${selectCls} w-28`}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </label>

        <Button variant="bad" disabled={observe.isPending} onClick={() => void send('apply')}>
          Apply
        </Button>
        <Button variant="good" disabled={observe.isPending} onClick={() => void send('revert')}>
          Revert
        </Button>
      </div>

      {status && (
        <p
          className={
            status.tone === 'ok'
              ? 'mt-3 rounded-lg border border-[#1e5d42] bg-[#103a28] px-3 py-2 text-xs text-[#8ff0c1]'
              : 'mt-3 rounded-lg border border-[#5e1b1b] bg-[#2a1414] px-3 py-2 text-xs text-[#ffb4b4]'
          }
        >
          {status.text}
        </p>
      )}

      <p className="mt-3 text-[11px] text-muted-2">
        Tip: for a full scenario run{' '}
        <code className="rounded bg-black/30 px-1 py-0.5 font-mono">
          python -m sim.chaos --topology sim/topology.yaml --scenario campus_edge_failover --speed
          30 --run --dt http://127.0.0.1:8080/observe
        </code>
      </p>
    </Card>
  )
}
