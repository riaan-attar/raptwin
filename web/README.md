# RAP Twin — Node frontend

React + TypeScript + Vite dashboard for the RAP Twin fabric simulator. It replaces
the single-file Flask dashboard (`ui/dashboard.py`) and talks directly to the
Python Digital Twin API in `dt/api.py`.

## Architecture

```
browser ──▶ Vite dev server (:5173)
                │  /api/*     ── proxied, prefix stripped ──▶  Flask DT API (:8080)
                │  /api/stream ── Server-Sent Events ────────▶  dt.events EventBus
                └─ React SPA (src/)
```

The proxy (`vite.config.ts`) keeps the browser same-origin, so `dt/api.py` needs
no CORS configuration. Point it elsewhere with `FABRIC_DT_REMOTE`.

All state, planning, chaos and self-healing logic stays in Python under `dt/`.

## Realtime updates

The UI is **event-driven, not polled**. `GET /stream` is a Server-Sent Events
endpoint that streams the twin's existing CloudEvent bus. `useEventStream`
subscribes once and invalidates only the queries an event actually affects:

| Event prefix | Refreshes |
| --- | --- |
| `fabric.node.*`, `fabric.link.*`, `fabric.reservation.*` | snapshot |
| `fabric.plan.*` | plans + snapshot |
| `fabric.selfheal.*`, `fabric.guardian.*` | snapshot + plans |

Events are coalesced over a 120 ms window, because a chaos scenario can emit
hundreds per second and each one must not trigger its own refetch.

Polling remains only as a safety net: 30 s while the stream is connected, and
2 s if it drops. `EventSource` reconnects on its own (the server sends `retry:`),
and the header shows which mode is active.

Measured on a 100-node fabric: a state change reaches the UI in **~500–650 ms**,
with **zero API requests while idle**.

### Why SSE rather than WebSocket

Traffic is one-directional — commands already go over normal POST requests.
SSE needs no extra dependency or server model (Werkzeug's dev server cannot
serve WebSocket properly), and `EventSource` handles reconnection natively.
`dt/api.py` runs with `threaded=True` because an open stream holds a worker for
its lifetime.

## Managing the fabric

Everything can be changed from the tabs in the header; each view also works as a
deep link (`/#nodes`, `/#links`, `/#jobs`, `/#chaos`, `/#reservations`).

| Tab | What you can do | Persists to |
| --- | --- | --- |
| Nodes | add, edit (form or full JSON descriptor), duplicate, rename, delete, take down / bring up | `nodes/<name>.yaml` |
| Links | add, edit, delete declared links; take links down; drop runtime-only links | `links:` block of `sim/topology.yaml` |
| Jobs | create, edit stages, test-fit (dry run), delete | `jobs/*.yaml` |
| Chaos & Faults | run / stop topology scenarios in-process, reset all faults, inject single observations, clear plan history | runtime only |
| Reservations | release one, filtered, or all | runtime only |

Saving a link rewrites only the `links:` block of `topology.yaml`; the other
sections and their comments are left as they are, but comments *inside* that
block are not preserved.

## Running

The DT API must be running first:

```bash
# from the repo root
python -m dt.api --host 127.0.0.1 --port 8080
```

Then:

```bash
cd web
npm install     # once
npm run dev     # http://localhost:5173
```

Or from the repo root via make:

```bash
make web-install
make web-dev            # dev server, :5173
make web-build          # production bundle into web/dist
make web-preview        # build + serve the bundle on :4173
make web-check          # typecheck only
```

Both `dev` and `preview` proxy `/api` to `$FABRIC_DT_REMOTE`
(default `http://127.0.0.1:8080`).

## Layout

| Path | Purpose |
| --- | --- |
| `src/api/types.ts` | TypeScript shapes for every DT API payload |
| `src/api/client.ts` | `fetch` wrapper that unwraps the `{ok, data}` envelope |
| `src/api/hooks.ts` | TanStack Query hooks (queries, mutations, invalidation) |
| `src/api/useEventStream.ts` | SSE subscription + debounced, targeted cache invalidation |
| `src/lib/topologyModel.ts` | Pure graph builder: nodes, zone rings, backbone edges |
| `src/lib/format.ts` | Number/time formatters |
| `src/components/` | One file per dashboard panel |
| `scripts/shoot.mjs` | Headless render + console-error check |
| `scripts/e2e.mjs` | Drives the real UI (submits a job, asserts the result) |

## Panels

- **Overview** — capacity, reservations, federation load, last plan spread
- **Fabric Topology** — D3 force graph, zone-clustered, zoom/pan, fit-to-view
- **Plan a Job** — job catalog from `jobs/*.yaml`, JSON editor, strategy picker,
  dry-run toggle, demo job, batch planning
- **Recent Plans / Plan Detail** — plan history and per-stage placements
- **Nodes / Links / Federations / Federation Links** — live inventory
- **Inject Observation** — structured `/observe` apply + revert
- **Twin Events** — CloudEvent feed from `dt.state`

## Topology model

`sim/topology.yaml` only declares site/region-level links (`site-lab`,
`site-datacenter`, …) which rarely match a generated device name, so the real
per-device link set is usually empty. Rather than render disconnected dots, the
graph derives connectivity from each node's zone/federation label:

- a **same-zone ring** per federation (N edges per zone, never a full mesh)
- a **backbone ring** joining one representative node per zone, decorated with
  real `federation_links` metrics when they exist

Real and chaos-injected device-to-device links render on top, coloured by
loss/down state, so an active partition stands out against the dim backbone.

## Verifying changes

```bash
node scripts/shoot.mjs /tmp/dash.png / "svg g.nodes g"   # render + error check
node scripts/e2e.mjs   /tmp/e2e.png                      # click-through test
node scripts/realtime.mjs                                # SSE latency measurement
```

All three require the dev server and the DT API to be running.
