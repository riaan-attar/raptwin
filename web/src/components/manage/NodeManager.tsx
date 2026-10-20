import { useMemo, useState } from 'react'
import { useDeleteNode, useNodeDescriptor, useObserve } from '../../api/hooks'
import type { NodeDescriptor, Snapshot } from '../../api/types'
import { fmt } from '../../lib/format'
import { filterNodes, useNodeFilters } from '../../lib/filters'
import { useSelection } from '../../lib/useSelection'
import { NodeBulkBar } from '../bulk/NodeBulkBar'
import { NodeFilterControls } from '../bulk/NodeFilterControls'
import { useBulkRunner } from '../bulk/useBulkRunner'
import { Badge, Button, Card, EmptyRow, Modal, Mono, Notice, TableShell, Td, Th } from '../ui/primitives'
import { SelectCell, SelectHeader } from '../ui/selection'
import { newNodeTemplate } from '../../lib/descriptor'
import { NodeEditor } from './NodeEditor'

type EditorTarget =
  | { mode: 'create' }
  | { mode: 'edit'; name: string }
  | { mode: 'duplicate'; name: string }

export function NodeManager({ snapshot }: { snapshot?: Snapshot }) {
  const { filters, set, reset, activeCount } = useNodeFilters()
  const [target, setTarget] = useState<EditorTarget | null>(null)
  const runner = useBulkRunner()
  const setNotice = runner.setNotice

  const deleteNode = useDeleteNode()
  const observe = useObserve()

  const nodes = useMemo(() => snapshot?.nodes ?? [], [snapshot])
  const zones = useMemo(
    () => [...new Set(nodes.map((n) => n.labels?.zone).filter(Boolean) as string[])].sort(),
    [nodes],
  )
  const fedMap = useMemo(() => snapshot?.node_federations ?? {}, [snapshot])
  const allKeys = useMemo(() => nodes.map((n) => n.name), [nodes])
  const selection = useSelection(allKeys)
  const rows = useMemo(() => filterNodes(nodes, filters, fedMap), [nodes, filters, fedMap])
  const visibleKeys = useMemo(() => rows.map((n) => n.name), [rows])
  const selectedNodes = useMemo(() => nodes.filter((n) => selection.selected.has(n.name)), [nodes, selection.selected])

  async function remove(name: string, reservations: number) {
    const extra = reservations
      ? `\n\nIts ${reservations} active reservation(s) will be dropped.`
      : ''
    if (!window.confirm(`Delete node ${name}? This also deletes nodes/${name}.yaml.${extra}`)) return
    try {
      await deleteNode.mutateAsync(name)
      setNotice({ tone: 'ok', text: `Deleted ${name}.` })
    } catch (e) {
      setNotice({ tone: 'err', text: (e as Error).message })
    }
  }

  async function toggleDown(name: string, down: boolean) {
    try {
      await observe.mutateAsync(
        down
          ? { action: 'revert', payload: { type: 'node', node: name, fields: ['down'] } }
          : { action: 'apply', payload: { type: 'node', node: name, changes: { down: true } } },
      )
      setNotice({ tone: 'ok', text: down ? `${name} is back up.` : `${name} marked down.` })
    } catch (e) {
      setNotice({ tone: 'err', text: (e as Error).message })
    }
  }

  async function deleteSelected() {
    const names = selectedNodes.map((n) => n.name)
    const resv = selectedNodes.reduce((sum, n) => sum + Object.keys(n.dyn?.reservations ?? {}).length, 0)
    const preview = names.slice(0, 8).join(', ') + (names.length > 8 ? `, +${names.length - 8} more` : '')
    if (
      !window.confirm(
        `Delete ${names.length} node(s)?\n\n${preview}\n\nThis also deletes their YAML files` +
          (resv ? ` and drops ${resv} active reservation(s).` : '.'),
      )
    )
      return
    let ok = 0
    const failed: string[] = []
    for (const name of names) {
      try {
        await deleteNode.mutateAsync(name)
        ok++
      } catch (e) {
        failed.push(`${name}: ${(e as Error).message}`)
      }
    }
    selection.clear()
    setNotice(
      failed.length
        ? { tone: 'err', text: `Deleted ${ok} of ${names.length}. Failed: ${failed.slice(0, 3).join('; ')}` }
        : { tone: 'ok', text: `Deleted ${ok} node(s).` },
    )
  }

  const existingNames = useMemo(() => new Set(nodes.map((n) => n.name)), [nodes])

  return (
    <Card
      title="Nodes"
      subtitle={`${rows.length} of ${nodes.length} nodes · changes are saved to nodes/<name>.yaml`}
      actions={
        <Button variant="primary" onClick={() => setTarget({ mode: 'create' })}>
          + Add node
        </Button>
      }
    >
      <NodeFilterControls
        nodes={nodes}
        fedMap={fedMap}
        filters={filters}
        set={set}
        reset={reset}
        activeCount={activeCount}
      />
      <NodeBulkBar
        noun="nodes"
        nodes={selectedNodes}
        selection={selection}
        visibleKeys={visibleKeys}
        runner={runner}
        extra={
          <Button variant="bad" disabled={deleteNode.isPending || runner.pending} onClick={() => void deleteSelected()}>
            Delete selected
          </Button>
        }
      />

      <TableShell
        maxHeight="620px"
        head={
          <>
            <SelectHeader visibleKeys={visibleKeys} selection={selection} />
            <Th>Name</Th>
            <Th>Class / Arch</Th>
            <Th>Zone</Th>
            <Th>CPU</Th>
            <Th>RAM</Th>
            <Th>VRAM</Th>
            <Th>Status</Th>
            <Th className="text-right">Actions</Th>
          </>
        }
        empty={
          rows.length === 0 ? (
            <EmptyRow colSpan={9}>
              {snapshot ? 'No nodes match. Add one to get started.' : 'Waiting for snapshot…'}
            </EmptyRow>
          ) : undefined
        }
      >
        {rows.map((n) => {
          const dyn = n.dyn ?? {}
          const resv = Object.keys(dyn.reservations ?? {}).length
          const down = Boolean(dyn.down)
          return (
            <tr
              key={n.name}
              className={
                selection.selected.has(n.name) ? 'bg-[var(--color-chip-info-bg)]/40' : 'hover:bg-[var(--color-row-hover)]'
              }
            >
              <SelectCell id={n.name} selection={selection} label={n.name} />
              <Td>
                <Mono className="whitespace-nowrap text-[13px]">{n.name}</Mono>
              </Td>
              <Td>
                <div>{n.class ?? '—'}</div>
                <div className="text-xs text-muted-2">{n.arch ?? '—'}</div>
              </Td>
              <Td>{n.labels?.zone ?? '—'}</Td>
              <Td>{fmt(n.caps?.max_cpu_cores, 0)}</Td>
              <Td>{fmt(n.caps?.ram_gb, 0)} GB</Td>
              <Td>{n.caps?.gpu_vram_gb ? `${fmt(n.caps.gpu_vram_gb, 0)} GB` : '—'}</Td>
              <Td>
                <div className="flex flex-wrap gap-1">
                  {down ? <Badge tone="bad">DOWN</Badge> : <Badge tone="good">UP</Badge>}
                  {resv > 0 && <Badge tone="info">{resv} resv</Badge>}
                </div>
              </Td>
              <Td className="text-right">
                <div className="flex justify-end gap-1.5 whitespace-nowrap">
                  <Button className="px-2 py-1 text-xs" onClick={() => setTarget({ mode: 'edit', name: n.name })}>
                    Edit
                  </Button>
                  <Button
                    className="px-2 py-1 text-xs"
                    onClick={() => setTarget({ mode: 'duplicate', name: n.name })}
                  >
                    Duplicate
                  </Button>
                  <Button
                    variant={down ? 'good' : 'default'}
                    className="px-2 py-1 text-xs"
                    disabled={observe.isPending}
                    onClick={() => void toggleDown(n.name, down)}
                  >
                    {down ? 'Bring up' : 'Take down'}
                  </Button>
                  <Button
                    variant="bad"
                    className="px-2 py-1 text-xs"
                    disabled={deleteNode.isPending}
                    onClick={() => void remove(n.name, resv)}
                  >
                    Delete
                  </Button>
                </div>
              </Td>
            </tr>
          )
        })}
      </TableShell>

      {target && (
        <EditorHost
          target={target}
          zones={zones}
          existingNames={existingNames}
          onClose={() => setTarget(null)}
          onSaved={(text) => {
            setTarget(null)
            setNotice({ tone: 'ok', text })
          }}
        />
      )}
    </Card>
  )
}

/** Fetches the full descriptor (edit / duplicate) before mounting the editor. */
function EditorHost({
  target,
  zones,
  existingNames,
  onClose,
  onSaved,
}: {
  target: EditorTarget
  zones: string[]
  existingNames: Set<string>
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const sourceName = target.mode === 'create' ? null : target.name
  const descriptor = useNodeDescriptor(sourceName)

  if (target.mode !== 'create' && !descriptor.data) {
    return (
      <Modal title={target.mode === 'edit' ? `Edit ${target.name}` : `Duplicate ${target.name}`} onClose={onClose}>
        {descriptor.isError ? (
          <Notice tone="err">{(descriptor.error as Error).message}</Notice>
        ) : (
          <p className="text-sm text-muted-2">Loading descriptor…</p>
        )}
      </Modal>
    )
  }

  let initial: NodeDescriptor
  if (target.mode === 'create') {
    initial = newNodeTemplate(existingNames)
  } else if (target.mode === 'duplicate') {
    let copyName = `${target.name}-copy`
    for (let i = 2; existingNames.has(copyName); i++) copyName = `${target.name}-copy${i}`
    initial = { ...(descriptor.data as NodeDescriptor), name: copyName }
  } else {
    initial = descriptor.data as NodeDescriptor
  }

  return (
    <NodeEditor
      initial={initial}
      originalName={target.mode === 'edit' ? target.name : undefined}
      zones={zones}
      existingNames={existingNames}
      onClose={onClose}
      onSaved={onSaved}
    />
  )
}
