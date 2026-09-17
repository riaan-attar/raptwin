import { useMemo, useState } from 'react'
import { useDeleteLink, useObserve, useSaveLink, useTopology } from '../../api/hooks'
import type { LinkProfile, LinkSpec, Snapshot, SnapshotLink } from '../../api/types'
import { fmt } from '../../lib/format'
import {
  Badge,
  Button,
  Card,
  EmptyRow,
  Field,
  Modal,
  Mono,
  Notice,
  NumberInput,
  TableShell,
  Td,
  Th,
  inputCls,
} from '../ui/primitives'

type Row = {
  key: string
  spec?: LinkSpec
  live?: SnapshotLink
}

export function LinkManager({ snapshot }: { snapshot?: Snapshot }) {
  const topology = useTopology()
  const deleteLink = useDeleteLink()
  const observe = useObserve()
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<LinkSpec | 'new' | null>(null)
  const [notice, setNotice] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)

  const rows = useMemo<Row[]>(() => {
    const live = new Map((snapshot?.links ?? []).map((l) => [l.key, l]))
    const out: Row[] = (topology.data?.links ?? []).map((spec) => ({
      key: spec.key,
      spec,
      live: live.get(spec.key),
    }))
    const declared = new Set(out.map((r) => r.key))
    // Links that only exist at runtime (created by chaos / observations).
    for (const l of snapshot?.links ?? []) {
      if (!declared.has(l.key)) out.push({ key: l.key, live: l })
    }
    const q = query.trim().toLowerCase()
    return q ? out.filter((r) => r.key.toLowerCase().includes(q)) : out
  }, [topology.data, snapshot, query])

  const endpoints = useMemo(() => {
    const set = new Set<string>(topology.data?.sites ?? [])
    for (const n of snapshot?.nodes ?? []) set.add(n.name)
    return [...set].sort()
  }, [topology.data, snapshot])

  async function remove(row: Row) {
    const what = row.spec ? 'Remove this link from sim/topology.yaml' : 'Drop this runtime-only link'
    if (!window.confirm(`${what}?\n\n${row.key}`)) return
    try {
      await deleteLink.mutateAsync(row.key)
      setNotice({ tone: 'ok', text: `Removed ${row.key}.` })
    } catch (e) {
      setNotice({ tone: 'err', text: (e as Error).message })
    }
  }

  async function toggleDown(row: Row) {
    const down = Boolean(row.live?.effective?.down)
    try {
      await observe.mutateAsync(
        down
          ? { action: 'revert', payload: { type: 'link', key: row.key, fields: ['down'] } }
          : { action: 'apply', payload: { type: 'link', key: row.key, changes: { down: true } } },
      )
      setNotice({ tone: 'ok', text: `${row.key} is ${down ? 'back up' : 'down'}.` })
    } catch (e) {
      setNotice({ tone: 'err', text: (e as Error).message })
    }
  }

  return (
    <Card
      title="Links"
      subtitle="Declared links are saved to the links: section of sim/topology.yaml"
      actions={
        <>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search endpoints…"
            aria-label="Search links"
            className={`${inputCls} w-48`}
          />
          <Button variant="primary" onClick={() => setEditing('new')}>
            + Add link
          </Button>
        </>
      }
    >
      {notice && (
        <div className="mb-3">
          <Notice tone={notice.tone} onDismiss={() => setNotice(null)}>
            {notice.text}
          </Notice>
        </div>
      )}
      {topology.isError && (
        <div className="mb-3">
          <Notice tone="err">{(topology.error as Error).message}</Notice>
        </div>
      )}

      <TableShell
        maxHeight="560px"
        head={
          <>
            <Th>Endpoints</Th>
            <Th>Profile / QoS</Th>
            <Th>Speed</Th>
            <Th>RTT</Th>
            <Th>Jitter</Th>
            <Th>Loss</Th>
            <Th>Status</Th>
            <Th className="text-right">Actions</Th>
          </>
        }
        empty={
          rows.length === 0 ? (
            <EmptyRow colSpan={8}>
              {topology.isLoading ? 'Loading topology…' : 'No links yet. Add one to connect nodes or sites.'}
            </EmptyRow>
          ) : undefined
        }
      >
        {rows.map((row) => {
          const eff = row.live?.effective ?? {}
          const down = Boolean(eff.down)
          const [a, b] = row.key.split('|')
          return (
            <tr key={row.key} className="hover:bg-[#0f1520]">
              <Td className="whitespace-nowrap">
                <Mono className="text-[13px]">{a}</Mono>
                <span className="mx-1.5 text-muted-2">↔</span>
                <Mono className="text-[13px]">{b}</Mono>
                {row.spec?.scope && <div className="text-[11px] text-muted-2">scope: {row.spec.scope}</div>}
              </Td>
              <Td>
                <div>{row.spec?.profile ?? '—'}</div>
                {row.spec?.qos_class && <div className="text-[11px] text-muted-2">{row.spec.qos_class}</div>}
              </Td>
              <Td>{row.live ? `${fmt(eff.speed_gbps, 1)} Gbps` : '—'}</Td>
              <Td>{row.live ? `${fmt(eff.rtt_ms, 2)} ms` : '—'}</Td>
              <Td>{row.live ? `${fmt(eff.jitter_ms, 2)} ms` : '—'}</Td>
              <Td>{row.live ? `${fmt(eff.loss_pct, 2)}%` : '—'}</Td>
              <Td>
                <div className="flex flex-wrap gap-1">
                  {down ? <Badge tone="bad">DOWN</Badge> : <Badge tone="good">UP</Badge>}
                  {!row.spec && <Badge tone="warn">runtime only</Badge>}
                </div>
              </Td>
              <Td className="text-right">
                <div className="flex justify-end gap-1.5 whitespace-nowrap">
                  {row.spec && (
                    <Button className="px-2 py-1 text-xs" onClick={() => setEditing(row.spec as LinkSpec)}>
                      Edit
                    </Button>
                  )}
                  {row.live && (
                    <Button
                      variant={down ? 'good' : 'default'}
                      className="px-2 py-1 text-xs"
                      disabled={observe.isPending}
                      onClick={() => void toggleDown(row)}
                    >
                      {down ? 'Bring up' : 'Take down'}
                    </Button>
                  )}
                  <Button
                    variant="bad"
                    className="px-2 py-1 text-xs"
                    disabled={deleteLink.isPending}
                    onClick={() => void remove(row)}
                  >
                    Delete
                  </Button>
                </div>
              </Td>
            </tr>
          )
        })}
      </TableShell>

      {editing && (
        <LinkEditor
          initial={editing === 'new' ? null : editing}
          profiles={topology.data?.link_profiles ?? []}
          qosClasses={topology.data?.qos_classes ?? []}
          subnets={topology.data?.subnets ?? []}
          endpoints={endpoints}
          onClose={() => setEditing(null)}
          onSaved={(text) => {
            setEditing(null)
            setNotice({ tone: 'ok', text })
          }}
        />
      )}
    </Card>
  )
}

const METRICS = [
  { key: 'speed_gbps', label: 'Speed (Gbps)' },
  { key: 'rtt_ms', label: 'RTT (ms)' },
  { key: 'jitter_ms', label: 'Jitter (ms)' },
  { key: 'loss_pct', label: 'Loss (%)' },
] as const

function LinkEditor({
  initial,
  profiles,
  qosClasses,
  subnets,
  endpoints,
  onClose,
  onSaved,
}: {
  initial: LinkSpec | null
  profiles: LinkProfile[]
  qosClasses: string[]
  subnets: string[]
  endpoints: string[]
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const save = useSaveLink()
  const [draft, setDraft] = useState<LinkSpec>(
    () => initial ?? { a: '', b: '', scope: 'node', profile: '' },
  )
  const [error, setError] = useState<string | null>(null)

  const patch = (p: Partial<LinkSpec>) => setDraft((d) => ({ ...d, ...p }))

  function pickProfile(name: string) {
    const profile = profiles.find((p) => p.name === name)
    // The planner reads a link's explicit metrics, so copy the profile's values in.
    patch(
      profile
        ? {
            profile: name,
            speed_gbps: profile.speed_gbps,
            rtt_ms: profile.rtt_ms,
            jitter_ms: profile.jitter_ms,
            loss_pct: profile.loss_pct,
            ecn: profile.ecn,
          }
        : { profile: '' },
    )
  }

  async function submit() {
    const a = draft.a.trim()
    const b = draft.b.trim()
    if (!a || !b) return setError('Both endpoints are required.')
    if (a === b) return setError('A link needs two different endpoints.')
    const link: LinkSpec = { ...draft, a, b }
    for (const k of Object.keys(link) as (keyof LinkSpec)[]) {
      if (link[k] === '' || link[k] === undefined) delete link[k]
    }
    delete link.key
    // Don't start writing `ecn: false` onto links that never declared it.
    if (link.ecn === false && initial?.ecn === undefined) delete link.ecn
    setError(null)
    try {
      const saved = await save.mutateAsync({ link, originalKey: initial?.key })
      onSaved(`${initial ? 'Saved' : 'Added'} link ${saved.key}.`)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <Modal
      title={initial ? `Edit link ${initial.key}` : 'Add link'}
      subtitle="Endpoints can be node names or topology sites"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={save.isPending} onClick={() => void submit()}>
            {save.isPending ? 'Saving…' : initial ? 'Save changes' : 'Add link'}
          </Button>
        </>
      }
    >
      {error && (
        <div className="mb-3">
          <Notice tone="err" onDismiss={() => setError(null)}>
            {error}
          </Notice>
        </div>
      )}
      <datalist id="link-endpoints">
        {endpoints.map((e) => (
          <option key={e} value={e} />
        ))}
      </datalist>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Endpoint A">
          <input
            className={inputCls}
            list="link-endpoints"
            value={draft.a}
            autoFocus
            onChange={(e) => patch({ a: e.target.value })}
          />
        </Field>
        <Field label="Endpoint B">
          <input
            className={inputCls}
            list="link-endpoints"
            value={draft.b}
            onChange={(e) => patch({ b: e.target.value })}
          />
        </Field>
        <Field label="Profile" hint="Fills in the metrics below; you can still override them">
          <select className={inputCls} value={draft.profile ?? ''} onChange={(e) => pickProfile(e.target.value)}>
            <option value="">— none —</option>
            {profiles.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name}
                {p.fabric ? ` · ${p.fabric}` : ''}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Scope">
          <select className={inputCls} value={draft.scope ?? ''} onChange={(e) => patch({ scope: e.target.value })}>
            <option value="node">node</option>
            <option value="site">site</option>
            <option value="region">region</option>
          </select>
        </Field>
        <Field label="QoS class">
          <select
            className={inputCls}
            value={draft.qos_class ?? ''}
            onChange={(e) => patch({ qos_class: e.target.value })}
          >
            <option value="">— none —</option>
            {qosClasses.map((q) => (
              <option key={q} value={q}>
                {q}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Subnet">
          <select className={inputCls} value={draft.subnet ?? ''} onChange={(e) => patch({ subnet: e.target.value })}>
            <option value="">— none —</option>
            {subnets.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <fieldset className="mt-4">
        <legend className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#a9c3e1]">
          Declared metrics
        </legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {METRICS.map((m) => (
            <Field key={m.key} label={m.label}>
              <NumberInput
                min={0}
                max={m.key === 'loss_pct' ? 100 : undefined}
                value={draft[m.key]}
                onChange={(v) => patch({ [m.key]: v })}
              />
            </Field>
          ))}
        </div>
        <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            className="accent-accent"
            checked={Boolean(draft.ecn)}
            onChange={(e) => patch({ ecn: e.target.checked })}
          />
          ECN enabled
        </label>
        <p className="mt-2 text-[11px] text-muted-2">
          Empty metrics fall back to the topology defaults. Live faults (down, degraded) are managed
          from the table or the Chaos &amp; Faults tab and are kept when you edit a link.
        </p>
      </fieldset>
    </Modal>
  )
}
