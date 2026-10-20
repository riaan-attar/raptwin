import { useEffect, useState } from 'react'
import { useUpdateRunSettings } from '../../api/hooks'
import type { JobRun, RunSettings } from '../../api/types'
import { fmtClock } from '../../lib/time'
import { Button, Card, Kpi, Notice, NumberInput } from '../ui/primitives'

/** Headline numbers for the runs, and the auto-release switch with its default timer. */
export function RunsSummary({
  running,
  reserved,
  settings,
  serverNow,
}: {
  running: JobRun[]
  reserved: number
  settings?: RunSettings
  serverNow: number
}) {
  const update = useUpdateRunSettings()
  const [seconds, setSeconds] = useState<number | undefined>(settings?.default_duration_s)
  const [error, setError] = useState<string | null>(null)

  // Follow the server value when it changes elsewhere.
  useEffect(() => {
    if (settings) setSeconds(settings.default_duration_s)
  }, [settings])

  const next = running[0]
  const left = next ? Math.max(0, (next.ends_ms - serverNow) / 1000) : null
  const dirty = settings !== undefined && seconds !== undefined && seconds !== settings.default_duration_s

  async function save(s: Partial<RunSettings>) {
    setError(null)
    try {
      await update.mutateAsync(s)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <Card title="Job timer" subtitle="A committed plan runs for its timer, then its reservations are freed automatically">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Kpi label="Running jobs" value={running.length} />
        <Kpi
          label="Next to finish"
          value={next ? `${next.job_id} in ${fmtClock(left ?? 0)}` : '—'}
        />
        <Kpi label="Reservations held by jobs" value={reserved} />
        <Kpi label="Auto-release" value={settings ? (settings.auto_release ? 'On' : 'Off') : '—'} />
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings?.auto_release ?? true}
            disabled={!settings || update.isPending}
            onChange={(e) => void save({ auto_release: e.target.checked })}
            className="h-4 w-4 cursor-pointer accent-[var(--color-accent-strong)]"
          />
          Auto-release committed plans when their timer ends
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-muted-2">
          Default timer (seconds)
          <span className="flex items-center gap-1.5">
            <NumberInput value={seconds} onChange={setSeconds} min={1} step={1} className="w-24" />
            <Button
              variant="primary"
              className="px-2 py-1 text-xs"
              disabled={!dirty || update.isPending}
              onClick={() => seconds !== undefined && void save({ default_duration_s: seconds })}
            >
              Save
            </Button>
          </span>
        </label>
        <p className="max-w-md text-[11px] text-muted-2">
          Turn auto-release off and committed plans hold their reservations until released by hand. A plan or a job can set its
          own timer; this is the fallback. Settings reset when the API restarts.
        </p>
      </div>
      {error && (
        <div className="mt-3">
          <Notice tone="err" onDismiss={() => setError(null)}>
            {error}
          </Notice>
        </div>
      )}
    </Card>
  )
}
