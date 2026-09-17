import { useState } from 'react'
import { useSaveNode } from '../../api/hooks'
import {
  NETWORK_FABRICS,
  NODE_ARCHES,
  NODE_CLASSES,
  NODE_ROLES,
  WORKLOAD_FORMATS,
  type NodeDescriptor,
} from '../../api/types'
import { NAME_RE, getIn, labelsToText, setIn, textToLabels } from '../../lib/descriptor'
import { cn } from '../../lib/format'
import { Button, Field, Modal, Notice, NumberInput, inputCls } from '../ui/primitives'

type Mode = 'form' | 'json'

export function NodeEditor({
  initial,
  originalName,
  zones,
  existingNames,
  onClose,
  onSaved,
}: {
  initial: NodeDescriptor
  /** Set when editing an existing node (enables rename handling). */
  originalName?: string
  zones: string[]
  existingNames: Set<string>
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const save = useSaveNode()
  const [draft, setDraft] = useState<NodeDescriptor>(initial)
  const [mode, setMode] = useState<Mode>('form')
  const [jsonText, setJsonText] = useState('')
  const [labelsText, setLabelsText] = useState(() => labelsToText(initial.labels))
  const [error, setError] = useState<string | null>(null)

  const editing = Boolean(originalName)
  const set = (path: string[], value: unknown) => setDraft((d) => setIn(d, path, value))
  const num = (path: string[]) => getIn(draft, path) as number | undefined
  const str = (path: string[]) => (getIn(draft, path) as string | undefined) ?? ''

  function switchMode(next: Mode) {
    if (next === mode) return
    if (next === 'json') {
      setJsonText(JSON.stringify(draft, null, 2))
      setMode('json')
      return
    }
    const parsed = parseJson()
    if (!parsed) return
    setDraft(parsed)
    setLabelsText(labelsToText(parsed.labels))
    setMode('form')
  }

  function parseJson(): NodeDescriptor | null {
    try {
      const parsed = JSON.parse(jsonText) as NodeDescriptor
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        setError('The descriptor must be a JSON object.')
        return null
      }
      setError(null)
      return parsed
    } catch (e) {
      setError(`Invalid JSON: ${(e as Error).message}`)
      return null
    }
  }

  function localProblem(node: NodeDescriptor): string | null {
    if (!NAME_RE.test(node.name ?? '')) {
      return "Name may only use letters, digits, '.', '_' and '-' (max 64 chars)."
    }
    if (node.name !== originalName && existingNames.has(node.name)) {
      return `A node named ${node.name} already exists.`
    }
    if (!((node.cpu?.cores ?? 0) > 0)) return 'CPU cores must be greater than 0.'
    if (!((node.memory?.ram_gb ?? 0) > 0)) return 'RAM must be greater than 0.'
    return null
  }

  async function submit() {
    const node = mode === 'json' ? parseJson() : draft
    if (!node) return
    const problem = localProblem(node)
    if (problem) {
      setError(problem)
      return
    }
    if (
      originalName &&
      node.name !== originalName &&
      !window.confirm(
        `Rename ${originalName} → ${node.name}? The old YAML file and its reservations are removed.`,
      )
    ) {
      return
    }
    setError(null)
    try {
      await save.mutateAsync({ node, originalName })
      onSaved(
        editing
          ? `Saved ${node.name}${originalName !== node.name ? ` (renamed from ${originalName})` : ''}.`
          : `Added ${node.name}.`,
      )
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const formats = new Set(draft.formats_supported ?? [])

  return (
    <Modal
      wide
      title={editing ? `Edit node ${originalName}` : 'Add node'}
      subtitle="Saved to nodes/<name>.yaml and applied to the live twin immediately"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={save.isPending} onClick={() => void submit()}>
            {save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Add node'}
          </Button>
        </>
      }
    >
      <div className="mb-4 inline-flex rounded-lg border border-edge-2 p-0.5" role="tablist">
        {(['form', 'json'] as const).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            onClick={() => switchMode(m)}
            className={cn(
              'cursor-pointer rounded-md px-3 py-1 text-xs font-semibold',
              mode === m ? 'bg-[#13314d] text-[#cfe7ff]' : 'text-muted hover:text-ink',
            )}
          >
            {m === 'form' ? 'Form' : 'Full descriptor (JSON)'}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-3">
          <Notice tone="err" onDismiss={() => setError(null)}>
            {error}
          </Notice>
        </div>
      )}

      {mode === 'json' ? (
        <>
          <textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            spellCheck={false}
            aria-label="Node descriptor JSON"
            className={`${inputCls} h-[28rem] resize-y font-mono text-xs leading-relaxed`}
          />
          <p className="mt-2 text-[11px] text-muted-2">
            Every field of the YAML descriptor — storage, accelerators, DPU, CXL, power… Fields
            the form doesn't show are kept as-is when you switch back.
          </p>
        </>
      ) : (
        <div className="flex flex-col gap-5">
          <Section title="Identity">
            <Field label="Name" hint="Also the file name: nodes/<name>.yaml">
              <input
                className={inputCls}
                value={draft.name ?? ''}
                onChange={(e) => set(['name'], e.target.value.trim())}
                autoFocus={!editing}
              />
            </Field>
            <Field label="Class">
              <Select value={str(['class'])} options={NODE_CLASSES} onChange={(v) => set(['class'], v)} />
            </Field>
            <Field label="Architecture">
              <Select value={str(['arch'])} options={NODE_ARCHES} onChange={(v) => set(['arch'], v)} />
            </Field>
            <Field label="Role">
              <Select value={str(['role'])} options={NODE_ROLES} onChange={(v) => set(['role'], v)} />
            </Field>
          </Section>

          <Section title="Compute">
            <Field label="CPU cores">
              <NumberInput min={1} step={1} value={num(['cpu', 'cores'])} onChange={(v) => set(['cpu', 'cores'], v)} />
            </Field>
            <Field label="Base frequency (GHz)">
              <NumberInput min={0} value={num(['cpu', 'base_ghz'])} onChange={(v) => set(['cpu', 'base_ghz'], v)} />
            </Field>
            <Field label="CPU microarch" hint="e.g. Zen4, NeoverseV1">
              <input
                className={inputCls}
                value={str(['cpu', 'uarch'])}
                onChange={(e) => set(['cpu', 'uarch'], e.target.value)}
              />
            </Field>
            <Field label="RAM (GB)">
              <NumberInput min={0} value={num(['memory', 'ram_gb'])} onChange={(v) => set(['memory', 'ram_gb'], v)} />
            </Field>
            <Field label="GPU model" hint="Leave empty for none">
              <input
                className={inputCls}
                value={str(['gpu', 'model'])}
                onChange={(e) => set(['gpu', 'model'], e.target.value)}
              />
            </Field>
            <Field label="GPU VRAM (GB)">
              <NumberInput min={0} value={num(['gpu', 'vram_gb'])} onChange={(v) => set(['gpu', 'vram_gb'], v)} />
            </Field>
          </Section>

          <Section title="Network & health">
            <Field label="Fabric">
              <Select
                value={str(['network', 'fabric'])}
                options={NETWORK_FABRICS}
                onChange={(v) => set(['network', 'fabric'], v)}
              />
            </Field>
            <Field label="Speed (Gbps)">
              <NumberInput
                min={0}
                value={num(['network', 'speed_gbps'])}
                onChange={(v) => set(['network', 'speed_gbps'], v)}
              />
            </Field>
            <Field label="Base latency (ms)">
              <NumberInput
                min={0}
                value={num(['network', 'base_latency_ms'])}
                onChange={(v) => set(['network', 'base_latency_ms'], v)}
              />
            </Field>
            <Field label="Reliability (0–1)">
              <NumberInput
                min={0}
                max={1}
                step={0.01}
                value={num(['health', 'reliability'])}
                onChange={(v) => set(['health', 'reliability'], v)}
              />
            </Field>
          </Section>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <fieldset className="min-w-0">
              <legend className="mb-2 text-[11px] font-semibold tracking-wide text-muted-2">
                Supported workload formats
              </legend>
              <div className="flex flex-wrap gap-2">
                {WORKLOAD_FORMATS.map((f) => (
                  <label
                    key={f}
                    className={cn(
                      'flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs',
                      formats.has(f)
                        ? 'border-[#2c5b86] bg-[#13314d] text-[#cfe7ff]'
                        : 'border-edge-2 text-muted',
                    )}
                  >
                    <input
                      type="checkbox"
                      className="accent-accent"
                      checked={formats.has(f)}
                      onChange={(e) => {
                        const next = new Set(formats)
                        if (e.target.checked) next.add(f)
                        else next.delete(f)
                        set(
                          ['formats_supported'],
                          WORKLOAD_FORMATS.filter((x) => next.has(x)),
                        )
                      }}
                    />
                    {f}
                  </label>
                ))}
              </div>
            </fieldset>

            <Field
              label="Labels"
              hint={
                zones.length
                  ? `One key=value per line. Zones in use: ${zones.join(', ')}`
                  : 'One key=value per line'
              }
            >
              <textarea
                value={labelsText}
                spellCheck={false}
                onChange={(e) => {
                  setLabelsText(e.target.value)
                  set(['labels'], textToLabels(e.target.value))
                }}
                className={`${inputCls} h-24 resize-y font-mono text-xs`}
              />
            </Field>
          </div>
        </div>
      )}
    </Modal>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#a9c3e1]">
        {title}
      </legend>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </fieldset>
  )
}

function Select({
  value,
  options,
  onChange,
}: {
  value: string
  options: readonly string[]
  onChange: (value: string) => void
}) {
  // Keep unknown values (e.g. hand-edited YAML) selectable instead of silently changing them.
  const all = value && !options.includes(value) ? [value, ...options] : options
  return (
    <select className={inputCls} value={value} onChange={(e) => onChange(e.target.value)}>
      {!value && <option value="">—</option>}
      {all.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  )
}
