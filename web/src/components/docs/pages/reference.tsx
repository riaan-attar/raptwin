import { Badge } from '../../ui/primitives'
import { Mono } from '../../ui/primitives'
import { RequestFlowDiagram } from '../diagrams'
import { Callout, Code, DocPage, DocTable, H2, H3, P, PageLink, UL } from '../ui'

const KEY = <Badge tone="warn">API key</Badge>

export function ApiReference() {
  return (
    <DocPage
      title="API reference"
      lead="All 38 routes of the Digital Twin API, with request bodies, results and ready-to-run examples."
    >
      <H2 id="conventions">Conventions</H2>
      <UL
        items={[
          <><b>Base URL.</b> <Mono>http://127.0.0.1:8080</Mono> locally. In the browser, both the dev server and the hosted site serve it under <Mono>/api</Mono>, with the prefix stripped before it reaches the API.</>,
          <><b>Bodies.</b> JSON in, with <Mono>Content-Type: application/json</Mono>. Routes that need a body reply 400 with <Mono>expected JSON body</Mono> otherwise.</>,
          <><b>Envelope.</b> Every JSON reply is <Mono>{'{ "ok": true, "data": ... }'}</Mono> or <Mono>{'{ "ok": false, "error": "..." }'}</Mono>. The exceptions are the SSE stream and the bundle download.</>,
        ]}
      />
      <DocTable
        head={['Status', 'Meaning']}
        mono={[0]}
        rows={[
          ['200', 'Success.'],
          ['400', 'Bad input: missing field, empty stages, unknown scenario, invalid descriptor.'],
          ['401', 'The route needs an API key and the X-API-Key header was missing or wrong.'],
          ['404', 'A named node or job does not exist.'],
          ['409', 'Conflict: a chaos scenario is already running.'],
          ['500', 'Unexpected server error. Details are in the server log; the reply is deliberately generic.'],
        ]}
      />
      <Callout tone="warn" title="Authentication">
        When the server sets <Mono>FABRIC_API_KEY</Mono>, routes marked {KEY} below require{' '}
        <Mono>X-API-Key: &lt;key&gt;</Mono>. The key is compared in constant time. With no key configured (the default)
        nothing is gated. Read-only and evaluation routes are never gated.
      </Callout>

      <H2 id="state">State and telemetry</H2>
      <DocTable
        head={['Method', 'Path', 'Request', 'Result']}
        mono={[0, 1]}
        rows={[
          ['GET', '/health', '-', '{ ts }'],
          ['GET', '/snapshot', '-', 'The merged twin: nodes, links, federations, predictive, economics.'],
          ['POST', '/observe', '{ action?, payload }', '{ applied: true }'],
          ['GET', '/economics', '-', 'Currency, price per kWh and grid carbon intensity in force.'],
          ['GET', '/topology', '-', 'Declared links, link profiles and sites.'],
          ['GET', '/events', '?limit (1 to 500, default 100) &since=<id>', '{ events, limit, since }'],
          ['GET', '/stream', '-', 'Server-Sent Events of the CloudEvent bus.'],
        ]}
      />

      <H2 id="planning">Planning</H2>
      <DocTable
        head={['Method', 'Path', 'Request', 'Result']}
        mono={[0, 1]}
        rows={[
          ['POST', '/plan', '{ job, strategy?, dry_run?, duration_s?, auto_release? }', 'A plan; see Planning for every field. A committed plan also returns run when a timed run started.'],
          ['POST', '/plan_batch', '{ jobs: [...], strategy?, dry_run?, duration_s?, auto_release? }', '{ results: [plan, ...] }'],
          ['GET', '/runs', '?state=running|finished&limit=', '{ runs, settings, now_ms, reserved_by_running }'],
          ['GET', '/runs/<id>', '-', 'One run with live stage status.'],
          ['POST', '/runs/<id>/finish', '-', <>Ends the run now and frees its reservations {KEY}</>],
          ['POST', '/runs/<id>/cancel', '-', <>Cancels the run and frees its reservations {KEY}</>],
          ['POST', '/runs/<id>/timer', '{ remaining_s } or { extend_s }', <>The updated run {KEY}</>],
          ['POST', '/runs/finish_all', '-', <>Ends every running run {KEY}</>],
          ['GET', '/runs/settings', '-', '{ auto_release, default_duration_s }'],
          ['POST', '/runs/settings', '{ auto_release?, default_duration_s? }', <>The new settings {KEY}</>],
          ['POST', '/release', '{ releases: [{ node, reservation_id }] }', '{ released: [{ node, reservation_id, released }] }'],
          ['GET', '/plans', '-', 'Recent plans, dry runs included (last 200, slimmed).'],
          ['DELETE', '/plans', '-', <>{'{ cleared: n }'} {KEY}</>],
        ]}
      />

      <H2 id="management">Management</H2>
      <DocTable
        head={['Method', 'Path', 'Request', 'Result']}
        mono={[0, 1]}
        rows={[
          ['GET', '/jobs', '-', 'The job catalogue (id, file and the job descriptor).'],
          ['POST', '/jobs', '{ job, original_id? }', <>{'{ id, file, created }'} {KEY}</>],
          ['DELETE', '/jobs', '?id=<job id>', <>{'{ id, file }'} {KEY}</>],
          ['GET', '/nodes/<name>', '-', 'The descriptor as stored in nodes/<name>.yaml.'],
          ['POST', '/add_node', '{ node, persist? }', <>{'{ node, persisted }'} {KEY}</>],
          ['DELETE', '/nodes/<name>', '-', <>{'{ node, dropped_reservations }'} {KEY}</>],
          ['POST', '/links', '{ link: { a, b, profile?, ... }, original_key? }', <>The link and its key {KEY}</>],
          ['DELETE', '/links', '?key=A|B', <>{'{ key }'} {KEY}</>],
        ]}
      />

      <H2 id="chaos">Chaos and analysis</H2>
      <DocTable
        head={['Method', 'Path', 'Request', 'Result']}
        mono={[0, 1]}
        rows={[
          ['GET', '/chaos', '-', 'Scenario catalogue and the current run status.'],
          ['POST', '/chaos/start', '{ scenario?, speed? (default 10) }', <>Run status {KEY}</>],
          ['POST', '/chaos/stop', '-', <>{'{ stopped }'} {KEY}</>],
          ['POST', '/overrides/reset', '-', <>{'{ nodes_reset, links_reset, chaos_stopped }'} {KEY}</>],
          ['POST', '/twin/restart', '{ confirm: "confirm" }', <>{'{ nodes, links, reservations_dropped, runs_dropped, plans_cleared, chaos_stopped }'} {KEY}</>],
          ['POST', '/blast_radius', '{ job | job_id, strategy?, depth?, branch?, max_sets?, deadline_ms? }', 'Minimal fault sets that break the job.'],
          ['POST', '/whatif', '{ changes, jobs?, job_limit?, strategy?, faults? }', 'Baseline versus variant report.'],
          ['GET', '/bundle', '?note=<text>', 'A zip download of an incident bundle.'],
          ['GET', '/standards/dtdl', '-', 'The twin as Azure DTDL models.'],
          ['GET', '/standards/crds', '-', 'The twin as Kubernetes custom resources.'],
        ]}
      />

      <H2 id="examples">Examples</H2>
      <H3>Plan several jobs at once</H3>
      <Code>{`curl -s -X POST localhost:8080/plan_batch -H 'Content-Type: application/json' \\
  -d '{"strategy": "resilient", "dry_run": true, "jobs": [ {...}, {...} ]}'`}</Code>
      <H3>Release a reservation</H3>
      <Code>{`curl -s -X POST localhost:8080/release -H 'Content-Type: application/json' \\
  -d '{"releases": [{"node": "ws-001", "reservation_id": "res-0000001"}]}'`}</Code>
      <H3>Start and stop chaos</H3>
      <Code>{`curl -s -X POST localhost:8080/chaos/start -H 'Content-Type: application/json' \\
  -H "X-API-Key: $KEY" -d '{"scenario": "core_link_cut", "speed": 10}'
curl -s -X POST localhost:8080/chaos/stop -H "X-API-Key: $KEY"`}</Code>
      <H3>Find what breaks a job</H3>
      <Code>{`curl -s -X POST localhost:8080/blast_radius -H 'Content-Type: application/json' \\
  -d '{"job_id": "job-vision-large", "depth": 2}'`}</Code>
      <H3>Watch events live</H3>
      <Code>{`curl -N localhost:8080/stream
# retry: 3000
# : connected
# id: ...
# data: {"type":"fabric.plan.committed", ...}`}</Code>
      <P>
        Each message is a CloudEvent as JSON in <Mono>data:</Mono>, with its type inside the payload (there are no named SSE
        events, so a plain <Mono>EventSource.onmessage</Mono> sees everything). A comment line is sent every 15 seconds
        (<Mono>FABRIC_SSE_KEEPALIVE</Mono>) to keep proxies from closing the connection.
      </P>
    </DocPage>
  )
}

export function Configuration() {
  return (
    <DocPage
      title="Configuration"
      lead="Every environment variable and the files the twin reads and writes. Set variables before starting the API."
    >
      <H2 id="server">Server environment</H2>
      <DocTable
        head={['Variable', 'Default', 'Effect']}
        mono={[0, 1]}
        rows={[
          ['FABRIC_API_HOST', '127.0.0.1', 'Bind address for python -m dt.api.'],
          ['FABRIC_API_PORT', '8080', 'Port for python -m dt.api.'],
          ['FABRIC_API_KEY', 'unset', 'When set, mutating routes require the X-API-Key header.'],
          ['FABRIC_JOB_DEFAULT_SECONDS', '30', 'Default length of a job run timer (1 to 86400 s). Editable at runtime on the Events & Jobs tab.'],
          ['FABRIC_JOB_AUTO_RELEASE', '1', 'When 1, every committed plan starts a timed run that frees its reservations. 0 holds them until released.'],
          ['FABRIC_JOBS_ROOT', 'jobs', 'Directory the job catalogue is read from and saved to.'],
          ['FABRIC_RL_STATE', 'sim/rl_state.json', 'Where the RL-Markov Q-table is persisted.'],
          ['FABRIC_BANDIT_STATE', 'sim/bandit_state.json', 'Where the bandit policy persists its statistics.'],
          ['FABRIC_COST_WEIGHT', '25', 'Latency (ms) traded per unit of currency per hour, for cost-aware scoring.'],
          ['FABRIC_CARBON_WEIGHT', '25', 'Latency (ms) traded per gram of CO2 per hour, for carbon-aware scoring.'],
          ['FABRIC_SSE_KEEPALIVE', '15', 'Seconds of silence before a keepalive comment on /stream.'],
          ['FABRIC_DT_EVENT_BUFFER', '512', 'Recent events kept for /events (minimum 32).'],
        ]}
      />

      <H2 id="controllers">Self-healing and guardian</H2>
      <DocTable
        head={['Variable', 'Default', 'Effect']}
        mono={[0, 1]}
        rows={[
          ['FABRIC_SELF_HEAL_INTERVAL', '2.5', 'Seconds between self-healing checks.'],
          ['FABRIC_SELF_HEAL_RELIABILITY', '0.75', 'A node below this reliability counts as degraded.'],
          ['FABRIC_SELF_HEAL_AVAIL', '90', 'Seconds of predicted availability below which a node counts as degraded.'],
          ['FABRIC_SELF_HEAL_STABILITY', '2', 'Consecutive degraded checks before acting.'],
          ['FABRIC_GUARDIAN_INTERVAL', '5', 'Seconds between guardian checks.'],
          ['FABRIC_GUARDIAN_UTIL', '0.92', 'Utilisation treated as pressure.'],
          ['FABRIC_GUARDIAN_TTL', '300', 'Seconds after which a reservation counts as stale.'],
        ]}
      />

      <H2 id="noise">Noise injection</H2>
      <DocTable
        head={['Variable', 'Default', 'Effect']}
        mono={[0, 1]}
        rows={[
          ['FABRIC_ENABLE_NOISE', '0', 'Set to 1, true or yes to enable background jitter.'],
          ['FABRIC_NOISE_INTERVAL', '7.5', 'Seconds between jitter passes.'],
          ['FABRIC_NOISE_NODE_JITTER', '0.12', 'Scale of node jitter.'],
          ['FABRIC_NOISE_LINK_JITTER', '0.2', 'Scale of link jitter.'],
        ]}
      />

      <H2 id="clients">Frontend and other clients</H2>
      <DocTable
        head={['Variable', 'Default', 'Effect']}
        mono={[0, 1]}
        rows={[
          ['FABRIC_DT_REMOTE', 'http://127.0.0.1:8080', 'Where the Vite dev and preview servers proxy /api.'],
          ['VITE_API_KEY', 'unset', 'Build-time. When set, the dashboard sends it as X-API-Key.'],
          ['FABRIC_UI_HOST / FABRIC_UI_PORT', '127.0.0.1 / 8090', 'Bind address for the legacy Flask dashboard.'],
          ['FABRIC_DT_REMOTE_TIMEOUT', '10', 'Seconds the legacy dashboard waits for the API.'],
        ]}
      />
      <Callout tone="warn" title="VITE_API_KEY is not a secret">
        It is baked into the public JavaScript bundle and visible in any browser’s developer tools. It deters casual or
        scripted misuse of the hosted demo; it does not protect against a determined viewer.
      </Callout>

      <H2 id="files">Files the twin reads and writes</H2>
      <DocTable
        head={['Path', 'Role']}
        mono={[0]}
        rows={[
          ['nodes/*.yaml', 'Node descriptors. Read on start and on change; written by the Nodes tab and /add_node.'],
          ['sim/topology.yaml', 'Topology, pricing, scenarios. Written by the Links tab and /links.'],
          ['jobs/*.yaml', 'Job catalogue. Written by the Jobs tab and /jobs.'],
          ['sim/overrides.json', 'Runtime overrides from the chaos engine.'],
          ['sim/rl_state.json, sim/bandit_state.json', 'Learner state, updated by committed plans.'],
          ['ci/gate.yaml, ci/baseline.json', 'Resilience-gate thresholds and the recorded baseline.'],
          ['schemas/*.schema.yaml', 'JSON Schemas for nodes, jobs and topology.'],
        ]}
      />
      <P>
        Container nodes also receive <Mono>FABRIC_NODE_NAME</Mono>, <Mono>FABRIC_NODE_ARCH</Mono> and{' '}
        <Mono>FABRIC_NODE_CLASS</Mono> from the launcher.
      </P>
    </DocPage>
  )
}

const JCT = [
  ['2', '1.099', '1.184', '1.351'],
  ['4', '1.030', '1.124', '1.251'],
  ['6', '1.050', '1.135', '1.267'],
  ['8', '1.023', '1.103', '1.230'],
  ['10', '1.045', '1.136', '1.249'],
]

export function Results() {
  return (
    <DocPage
      title="Measured results"
      lead="Benchmarks produced by the project's own tools against the bundled fabric. Treat them as indicative: a single run on a small fabric."
    >
      <H2 id="setup">Setup</H2>
      <UL
        items={[
          <><b>Fabric.</b> 100 node descriptors in four sites across two regions, linked by 10 and 100 GbE, InfiniBand, Wi-Fi 6E and 7, and a 1 GbE WAN class.</>,
          <><b>Workload.</b> The 11-job catalogue in <Mono>jobs/jobs_10.yaml</Mono>.</>,
          <><b>Strategies.</b> Greedy, Cheapest-Energy, Resilient and RL-Markov.</>,
          <><b>Settings.</b> Seed 7, job limit 6, and chaos run at deadline scale 0.28 (the margin test from <Mono>ci/gate.yaml</Mono>).</>,
        ]}
      />

      <H2 id="table">Headline table</H2>
      <DocTable
        head={['Strategy', 'Mean JCT (s)', 'p95 JCT (s)', 'Energy (J)', 'SLA hit rate']}
        rows={[
          [<b key="1">Greedy</b>, '1.05', '1.26', '13.0', <Badge key="a" tone="good">100.0%</Badge>],
          [<b key="2">Cheapest-Energy</b>, '1.05', '1.26', '13.0', <Badge key="b" tone="good">100.0%</Badge>],
          [<b key="3">RL-Markov</b>, '1.14', '1.37', '16.2', <Badge key="c" tone="good">100.0%</Badge>],
          [<b key="4">Resilient</b>, '1.27', '1.72', '13.0', <Badge key="d" tone="warn">83.3%</Badge>],
        ]}
      />
      <P>
        Mean JCT and energy are measured <b>without</b> chaos; p95 JCT and SLA hit rate are measured under the{' '}
        <Mono>core_link_cut</Mono> scenario. They are two operating conditions reported side by side, not one unified run.
      </P>

      <H2 id="load">Completion time versus concurrent jobs</H2>
      <DocTable
        head={['Concurrent jobs', 'Greedy / Cheapest-Energy (s)', 'RL-Markov (s)', 'Resilient (s)']}
        rows={JCT}
      />
      <P>
        Completion time stays nearly flat from 2 to 10 jobs. A 100-node fabric has far more spare capacity than 11 jobs can
        use, so queueing never builds. Greedy and Cheapest-Energy are identical because on this job mix the cheapest node
        is also the first fit.
      </P>

      <H2 id="chaos">SLA under two chaos scenarios</H2>
      <DocTable
        head={['Strategy', 'wifi_brownout', 'core_link_cut']}
        rows={[
          ['Greedy', '100.0%', '100.0%'],
          ['Cheapest-Energy', '100.0%', '100.0%'],
          ['RL-Markov', '100.0%', '100.0%'],
          ['Resilient', '83.3%', '83.3%'],
        ]}
      />

      <H2 id="reading">Reading the results honestly</H2>
      <UL
        items={[
          <><b>Resilient trails.</b> Its redundant fallback paths cost latency, and at the tight deadline scale of 0.28 that uses up enough margin to miss 1 job in 6. It is a weighting problem to tune, not evidence that heuristics are better in general.</>,
          <><b>Single seed.</b> These are point estimates with no confidence intervals, so a gap such as 83.3% versus 100% is a single-run observation.</>,
          <><b>Small scale.</b> Three strategies saturate at 100% because the fabric is rarely under real pressure.</>,
          <><b>No external baseline.</b> Only the four built-in strategies are compared, so nothing here claims superiority over other schedulers.</>,
          <><b>Controllers not isolated.</b> Self-healing and the guardian run throughout; no ablation measures them separately.</>,
        ]}
      />

      <H2 id="reproduce">Reproduce</H2>
      <Code>{`python -m tools.benchmark_srs_table        # the headline table
python -m tools.benchmark_paper_figures    # the figures and sweeps above`}</Code>
      <P>
        Both run against the bundled fabric and write to <Mono>reports/</Mono>. See{' '}
        <PageLink to="analysis">Analysis tools</PageLink> for the underlying benchmarks.
      </P>
    </DocPage>
  )
}

export function Deployment() {
  return (
    <DocPage
      title="Deployment and security"
      lead="How the hosted instance is put together, how to redeploy it, and how access to mutating routes is controlled."
    >
      <H2 id="flow">Request flow</H2>
      <RequestFlowDiagram />
      <UL
        items={[
          <><b>Caddy</b> terminates TLS with an automatically issued certificate, serves the built SPA at <Mono>/</Mono>, and proxies <Mono>/api/*</Mono> to the API with the prefix removed, mirroring the Vite dev proxy so one build works everywhere.</>,
          <><b>The API</b> binds to loopback only. It is reachable solely through the proxy.</>,
          <><b>gunicorn</b> runs one worker with 24 threads. State lives in process memory, so a second worker would serve a divergent twin; concurrency comes from threads, and each open event stream occupies one for its lifetime.</>,
        ]}
      />
      <Callout tone="note" title="Two proxy details that matter">
        Response buffering is disabled on the API route, otherwise <Mono>/api/stream</Mono> would deliver events in batches
        instead of live. Compression is applied only to the static files, never to the event stream.
      </Callout>

      <H2 id="redeploy">Redeploying</H2>
      <Code>{`./deploy/deploy.sh          # code + frontend + restart the API
./deploy/deploy.sh --web    # frontend only
./deploy/deploy.sh --api    # backend only`}</Code>
      <P>
        The script syncs the backend, updates dependencies, restarts the service, builds the frontend and uploads it, then
        checks the page, <Mono>/api/health</Mono> and <Mono>/api/snapshot</Mono>. See <Mono>deploy/README.md</Mono> for host
        layout and overrides.
      </P>

      <H2 id="auth">API-key access control</H2>
      <P>
        Setting <Mono>FABRIC_API_KEY</Mono> gates the routes that change state: adding and deleting nodes, links and jobs,
        clearing plans, starting and stopping chaos, resetting faults, and restarting the twin. Everything else stays open, so planning and
        what-if still work for anyone. The header is compared with a constant-time function.
      </P>
      <DocTable
        head={['Request', 'Result']}
        rows={[
          ['Mutating route, no key or wrong key', '401 unauthorized'],
          ['Mutating route, correct key', 'The normal result'],
          ['Read-only or evaluation route', 'Always allowed'],
        ]}
      />
      <Callout tone="warn" title="Redeploying with the key enabled">
        The dashboard receives its key at <i>build</i> time. A web redeploy without it ships a bundle that sends no key, so
        the buttons that change state would start returning 401 against a server that still requires one. Pass the same key
        to the deploy script each time.
      </Callout>
      <UL
        items={[
          <>Never commit the key or hardcode it in a script.</>,
          <>The key reaches the server through a systemd drop-in readable only by root, not through the synced unit file.</>,
          <>Because the dashboard bundle carries the key, treat it as a deterrent, not a secret.</>,
        ]}
      />

      <H2 id="quality">Tests and CI</H2>
      <DocTable
        head={['Check', 'What it does']}
        rows={[
          [<Mono key="p">pytest</Mono>, '171 automated tests across the API, planners, chaos tooling, auth, gate and tooling.'],
          [<Mono key="r">resilience-gate workflow</Mono>, 'Runs tools/ci_gate.py on pull requests that touch the twin, and uploads the report.'],
          [<Mono key="c">CodeQL workflow</Mono>, 'Static security analysis of the Python code (needs code scanning enabled on the repository).'],
          [<Mono key="t">npm run build</Mono>, 'Typechecks the frontend before bundling.'],
        ]}
      />
    </DocPage>
  )
}

export function Troubleshooting() {
  return (
    <DocPage
      title="Troubleshooting and FAQ"
      lead="Symptoms, likely causes and fixes, followed by the questions people ask most."
    >
      <H2 id="problems">Common problems</H2>
      <DocTable
        head={['Symptom', 'Likely cause', 'Fix']}
        rows={[
          [<b key="1">Dashboard says it cannot reach the API</b>, 'The API is not running, or the dev proxy points elsewhere.', <>Start <Mono>python -m dt.api --port 8080</Mono>; check <Mono>FABRIC_DT_REMOTE</Mono>.</>],
          [<b key="2">Port already in use</b>, 'Another process holds 8080, 5173 or 8090.', <>Pass <Mono>--port</Mono>; Vite picks the next free port and prints it.</>],
          [<b key="3">Buttons that change state return 401</b>, 'The server requires an API key and the dashboard has none, or a different one.', <>Rebuild the frontend with the matching <Mono>VITE_API_KEY</Mono>, or unset <Mono>FABRIC_API_KEY</Mono>.</>],
          [<b key="4">&quot;stream offline, polling&quot; in the header</b>, 'The event stream is blocked or buffered by a proxy.', <>Disable buffering on <Mono>/stream</Mono>; the dashboard keeps working by polling meanwhile.</>],
          [<b key="5">Edited a node YAML and nothing changed</b>, 'The file failed to load, or the watcher has not run yet.', <>Wait about half a second; run <Mono>python -m tools.validate_nodes --dir nodes/</Mono>; check the API log.</>],
          [<b key="6">Chaos overrides not applied</b>, 'sim/overrides.json is missing or the run is offline.', <>Run chaos with <Mono>--dt http://127.0.0.1:8080/observe</Mono>, or start the scenario from the dashboard.</>],
          [<b key="7">POST /chaos/start returns 409</b>, 'A scenario is already running.', <>Stop it with <Mono>POST /chaos/stop</Mono> or reset faults first.</>],
          [<b key="8">A plan is infeasible</b>, 'No node has an allowed format and enough free CPU, memory or VRAM.', <>Read the stage&apos;s <Mono>reason</Mono>; widen <Mono>allowed_formats</Mono>, lower the request, free reservations, or add capacity.</>],
          [<b key="9">Free capacity keeps shrinking</b>, 'Committed (non dry-run) plans hold reservations.', <>Use dry runs while exploring; release from the Reservations tab.</>],
          [<b key="10">MQTT messages never arrive</b>, 'Topic does not match the convention, broker address is wrong, or paho-mqtt is missing.', <>Use <Mono>fabric/&lt;node&gt;/telemetry</Mono>; run with <Mono>-v</Mono>; install <Mono>requirements-mqtt.txt</Mono>.</>],
          [<b key="11">Missing modules (numpy, matplotlib)</b>, 'The virtual environment is not active or install did not finish.', <>Activate <Mono>.venv</Mono> and rerun <Mono>pip install -r requirements.txt</Mono>.</>],
          [<b key="12">GPU not visible in a container node</b>, 'Docker has no GPU runtime, or the descriptor declares no GPU.', <>Install the NVIDIA container toolkit; check <Mono>gpu.type</Mono> in the descriptor.</>],
        ]}
      />

      <H2 id="faq">FAQ</H2>
      <H3>Is RAP Twin connected to real hardware?</H3>
      <P>
        Not by default. It models a fabric from descriptors and observations. You can feed it real telemetry over REST or
        MQTT, and import node inventory from a Kubernetes cluster, but validation so far uses synthetic workloads.
      </P>
      <H3>Why does it run a single worker?</H3>
      <P>
        The twin lives in process memory. Two workers would each hold their own reservations and overrides and disagree.
        Threads give concurrency instead.
      </P>
      <H3>Does a dry run change anything?</H3>
      <P>
        It reserves nothing, does not register with self-healing and does not persist learner state. It does still appear in
        plan history and publish an event marked as a dry run. Commit only when you want capacity held.
      </P>
      <H3>Do what-if and blast radius affect the live twin?</H3>
      <P>
        No. Both run on throwaway copies loaded from disk, so nothing is persisted and the dashboard does not flicker.
      </P>
      <H3>Why are some results worse for the &quot;resilient&quot; strategy?</H3>
      <P>
        Redundancy costs latency, and the benchmark uses a tight deadline margin. See{' '}
        <PageLink to="results">Measured results</PageLink>.
      </P>
      <H3>Can I add my own planner?</H3>
      <P>
        Planners are classes under <Mono>dt/policy/</Mono> selected by name in <Mono>dt/api.py</Mono>. Add one with a{' '}
        <Mono>plan_job(job, dry_run)</Mono> method, register its names in the strategy selection, and it appears to every
        client.
      </P>
      <H3>Where do I report a problem?</H3>
      <P>
        Open an issue on the GitHub repository, and attach an incident bundle (<Mono>make bundle</Mono>) so the run can be
        reproduced.
      </P>
    </DocPage>
  )
}
