import { Mono } from '../../ui/primitives'
import { ArchitectureDiagram } from '../diagrams'
import { Callout, Code, DocPage, DocTable, H2, H3, P, PageLink, UL } from '../ui'

export function Architecture() {
  return (
    <DocPage
      title="Architecture"
      lead="Five modules arranged around one state engine. All state, planning, chaos and self-healing logic is Python under dt/; the React dashboard is a client of the REST API."
    >
      <H2 id="diagram">System map</H2>
      <ArchitectureDiagram />
      <P>
        The dashed line is the chaos path: faults are written into the same state the planners read, which is what makes
        resilience testing realistic rather than a separate simulation.
      </P>

      <H2 id="modules">Modules and where they live</H2>
      <DocTable
        head={['Module', 'Responsibility', 'Files']}
        mono={[2]}
        rows={[
          ['State engine', 'Loads descriptors, merges overrides and observations, tracks reservations, publishes events.', 'dt/state.py, dt/events.py'],
          ['Predictive analytics', 'EWMA and trend forecasts of utilisation, failure windows and link variability.', 'dt/predict.py'],
          ['Planner', 'Greedy, cheapest-energy, resilient/federated, MDP and bandit policies; the shared cost model.', 'dt/planners.py, dt/policy/, dt/cost_model.py'],
          ['Economics', 'Money and carbon per plan from topology pricing and energy defaults.', 'dt/economics.py'],
          ['Chaos and controllers', 'Replays fault schedules in-process; self-healing failover and the resource guardian.', 'dt/chaos_runner.py, sim/chaos.py, dt/self_heal.py'],
          ['Analysis', 'What-if forks, blast-radius search, Monte-Carlo sweeps, benchmarks.', 'dt/whatif.py, sim/blast_radius.py, sim/montecarlo.py, tools/'],
          ['Interoperability', 'REST API, SSE stream, DTDL and Kubernetes exporters, the React dashboard.', 'dt/api.py, dt/exporters.py, web/'],
          ['Ingestion sidecar', 'MQTT subscriber that forwards telemetry to /observe.', 'sim/mqtt_bridge.py'],
          ['Container fabric', 'Launches one Docker container per node, with traffic shaping and GPU requests.', 'fabric_docker/launch_fabric.py'],
        ]}
      />

      <H2 id="plan-flow">What happens on a plan request</H2>
      <OLFlow />

      <H2 id="decisions">Design decisions</H2>
      <DocTable
        head={['Decision', 'Why']}
        rows={[
          [<b key="1">One in-process twin, one worker</b>, 'Reservations, overrides and the event bus live in memory. A second worker would hold a divergent copy of the fabric, so production runs a single worker with many threads instead.'],
          [<b key="2">File-backed descriptors</b>, 'Nodes, topology and jobs are plain YAML. Editing a file, or using the dashboard (which writes the file), changes the live twin within about half a second.'],
          [<b key="3">Events as CloudEvents</b>, 'Every state change is published on an event bus and streamed over SSE, so clients react instead of polling.'],
          [<b key="4">Evaluation routes are not mutations</b>, '/plan, /whatif and /blast_radius stay open when API auth is on. What-if and blast radius run on throwaway forks and never touch the live twin.'],
          [<b key="5">Same-origin frontend</b>, 'The dev server and the production reverse proxy both serve /api next to the app, so the API needs no CORS configuration.'],
        ]}
      />
      <Callout>
        Details of the state model are in <PageLink to="state">Digital twin state</PageLink>; request-level behaviour is in the{' '}
        <PageLink to="api">API reference</PageLink>.
      </Callout>
    </DocPage>
  )
}

function OLFlow() {
  return (
    <ol className="ml-5 max-w-3xl list-decimal space-y-1 marker:text-muted-2">
      <li>The client POSTs a job and a strategy to <Mono>/plan</Mono> (<Mono>dry_run</Mono> optional).</li>
      <li>The API selects the planner for that strategy and reads the current merged state.</li>
      <li>The planner scores candidate nodes per stage using the cost model, the forecasts and the strategy’s weights.</li>
      <li>Cost, carbon and predictive blocks are attached to the plan.</li>
      <li>Unless it is a dry run, reservations are created and the plan is registered with self-healing. Either way the plan is added to the recent-plans history and an event is published.</li>
      <li>The response and the events reach the dashboard, which refreshes the affected panels.</li>
    </ol>
  )
}

export function State() {
  return (
    <DocPage
      title="Digital twin state"
      lead="The twin merges three sources into one live view and exposes it as a snapshot and an event stream."
    >
      <H2 id="sources">Sources of truth</H2>
      <DocTable
        head={['Source', 'Contents', 'Changes through']}
        mono={[0]}
        rows={[
          ['nodes/*.yaml', 'Static node descriptors.', 'Editing files, the Nodes tab, POST /add_node.'],
          ['sim/topology.yaml', 'Sites, link profiles, links, defaults, policies, chaos scenarios.', 'Editing the file, the Links tab, POST /links.'],
          ['sim/overrides.json', 'Runtime overrides written by the chaos engine.', 'sim/chaos.py, the in-process chaos runner, POST /overrides/reset.'],
          ['POST /observe', 'Live measurements and faults for nodes and links.', 'Any HTTP client; the MQTT bridge uses it.'],
        ]}
      />
      <P>
        File watchers poll about every 0.5 seconds. Touch or replace a descriptor and the API reloads it, with no restart.
        Automation can disable the background threads with <Mono>DTState(auto_start_watchers=False)</Mono> and call{' '}
        <Mono>start()</Mono> later.
      </P>

      <H2 id="layers">Base, dynamic and effective values</H2>
      <P>
        Each node and link carries three layers. <b>Base</b> is the static descriptor. <b>Dynamic</b> (<Mono>dyn</Mono>) is
        what overrides and observations have changed at runtime. <b>Effective</b> is what the planners actually use: the
        capacity left after thermal derating and after existing reservations.
      </P>
      <DocTable
        head={['Node dyn field', 'Meaning']}
        mono={[0]}
        rows={[
          ['down', 'Node is out of service.'],
          ['thermal_derate', 'Fraction of compute lost to throttling (0 to 1).'],
          ['power_cap_w', 'Power cap in watts, or null.'],
          ['clock_skew_ms, packet_dup, packet_reorder', 'Injected clock and packet anomalies.'],
          ['used_cpu_cores, used_mem_gb, used_gpu_vram_gb', 'Resources currently in use.'],
          ['reliability, availability_window_sec', 'Health score (0 to 1) and predicted remaining uptime window.'],
          ['mtbf_hours, uptime_hours', 'Failure statistics.'],
          ['util_forecast, projected_derate, predicted_failure_window_sec', 'Outputs of the predictive analyser.'],
          ['reservations', 'Active reservations on the node, by id.'],
        ]}
      />

      <H2 id="snapshot">The snapshot</H2>
      <P>
        <Mono>GET /snapshot</Mono> returns the whole merged view:
      </P>
      <DocTable
        head={['Field', 'Contents']}
        mono={[0]}
        rows={[
          ['ts', 'Timestamp in milliseconds.'],
          ['nodes', 'Per node: name, class, arch, formats_supported, labels, caps, dyn, effective.'],
          ['links', 'Per link: key, a, b, base, dyn, effective metrics.'],
          ['federations', 'Per zone: node count, total and free CPU, memory and VRAM, down and hot nodes, load factor, trust, loss.'],
          ['federation_links', 'Cross-zone aggregates: link count, down links, minimum speed, worst loss, average RTT.'],
          ['node_federations', 'Map from node name to its federation.'],
          ['predictive', 'Per-node and per-link forecasts.'],
          ['economics', 'Currency, grid CO2 intensity and electricity price in force.'],
        ]}
      />

      <H2 id="events">Events</H2>
      <P>
        State changes are published as CloudEvents. Read recent ones with <Mono>GET /events</Mono> (<Mono>limit</Mono> up
        to 500, optional <Mono>since</Mono> id) or subscribe to <Mono>GET /stream</Mono>. The buffer holds 512 events by
        default (<Mono>FABRIC_DT_EVENT_BUFFER</Mono>, minimum 32).
      </P>
      <DocTable
        head={['Event type', 'Raised when']}
        mono={[0]}
        rows={[
          ['fabric.node.added / removed / update / observe', 'A node is created, deleted, changed, or observed.'],
          ['fabric.link.added / removed / update / updated / observe', 'A link is created, deleted, changed, or observed.'],
          ['fabric.reservation.created / released', 'Capacity is reserved or freed.'],
          ['fabric.plan.committed / cleared', 'A plan is produced (dry runs too; the event carries a dry_run flag), or plan history is cleared.'],
          ['fabric.overrides.reset', 'All injected faults are cleared.'],
          ['fabric.job.saved / deleted', 'A job descriptor is saved or deleted.'],
          ['fabric.chaos.started / stopped / finished', 'A chaos scenario starts, is stopped, or completes.'],
          ['fabric.selfheal.failover / promote / shadow', 'The self-healing controller acts on a plan.'],
          ['fabric.guardian.release', 'The resource guardian frees an expired reservation.'],
        ]}
      />

      <H2 id="controllers">Background controllers</H2>
      <UL
        items={[
          <><b>SelfHealingController</b> promotes fallback placements when a primary degrades or fails. A node counts as degraded when its reliability drops below a threshold (0.75 by default) or its predicted availability window falls under 90 seconds, for two consecutive checks.</>,
          <><b>ResourceGuardian</b> watches for potential deadlocks and releases stale reservations. By default it checks every 5 seconds, frees reservations older than 300 seconds, and treats 92% utilisation as the pressure threshold.</>,
          <><b>NoiseInjector</b> (off by default) adds small random jitter to nodes and links to emulate background variance.</>,
        ]}
      />
      <P>
        Their thresholds are environment variables; see <PageLink to="configuration">Configuration</PageLink>.
      </P>
      <Callout tone="note">
        Inject your own observations with <Mono>POST /observe</Mono>. Payload formats and the MQTT path are in{' '}
        <PageLink to="telemetry">Telemetry ingestion</PageLink>.
      </Callout>
    </DocPage>
  )
}

export function Nodes() {
  return (
    <DocPage
      title="Node descriptors"
      lead="A node is one YAML file in nodes/. The descriptor says what the machine is; the twin adds how it is behaving right now."
    >
      <H2 id="sections">Descriptor sections</H2>
      <DocTable
        head={['Section', 'Key fields']}
        mono={[0]}
        rows={[
          ['name, class, arch, role', 'Identity: for example grig-001, gaming_rig, amd64, worker.'],
          ['os', 'distro, version, kernel, container_runtime.'],
          ['power', 'supply_w, poe, battery_present, tdp_total_w.'],
          ['cpu', 'uarch, isa_ext, cores, base_ghz, turbo_ghz, tdp_w, numa_nodes.'],
          ['memory', 'ram_gb, ecc, channels, ddr_gen.'],
          ['storage', 'type, interface_gen, size_gb, tbw_pct_used, smart_health, qd_cap.'],
          ['gpu', 'type, vendor, model, vram_gb, cuda_cores, tensor_cores, compute_capability, nvlink, tdp_w, accel_score.'],
          ['accelerators', 'npu, npu_tops, jetson_cuda, fpga_*, asic_*.'],
          ['dpu, cxl, io', 'DPU and CXL type; USB, camera, PCIe lanes.'],
          ['network', 'fabric, speed_gbps, base_latency_ms, base_bandwidth_mbps, jitter_ms, loss_pct, ecn, mtu_bytes, rocev2.'],
          ['formats_supported', 'Execution formats the node can run: native, wasm, cuda, npu, asic.'],
          ['labels', 'zone, rack, trust (0 to 1), wasm, owner. The zone label defines the node’s federation.'],
          ['health', 'ram_errors_million_hours, last_week_crashes, thermal_derate, last_service_days, temperature_c, fan_fault.'],
          ['data_locality', 'Datasets held on the node.'],
        ]}
      />
      <H3>Trimmed example</H3>
      <Code label="nodes/grig-001.yaml">{`name: grig-001
class: gaming_rig
arch: amd64
cpu:    { cores: 16, base_ghz: 3.14, turbo_ghz: 4.67, tdp_w: 78.84 }
memory: { ram_gb: 16, ddr_gen: ddr5 }
gpu:    { type: none, vram_gb: 0 }
network: { fabric: ethernet, speed_gbps: 1, base_latency_ms: 0.32, loss_pct: 0.03 }
formats_supported: [native, wasm]
labels: { zone: edge, rack: B1, trust: '0.68', wasm: enabled, owner: dept }
health: { last_week_crashes: 1, thermal_derate: 0.1, temperature_c: 60.81 }`}</Code>

      <H2 id="how-used">How planners use it</H2>
      <UL
        items={[
          <><b>Fit.</b> A stage fits a node only if CPU, memory and VRAM headroom (the <i>effective</i> values) cover the request and one of the stage’s allowed formats is in <Mono>formats_supported</Mono>.</>,
          <><b>Speed.</b> Core count, clock speed and <Mono>gpu.accel_score</Mono> set compute time, reduced by thermal derating.</>,
          <><b>Risk.</b> Crashes, thermal state, trust and reliability feed the risk and failure-penalty terms.</>,
          <><b>Energy and cost.</b> TDP and power profile feed energy; hardware class feeds the hourly price.</>,
          <><b>Federation.</b> The <Mono>zone</Mono> label groups nodes into federations for spread and fallback.</>,
        ]}
      />

      <H2 id="manage">Creating and managing nodes</H2>
      <DocTable
        head={['How', 'Command or place']}
        rows={[
          ['Generate synthetic nodes', <Mono key="g">python -m sim.gen_nodes --count 50 --seed 1234 --outdir nodes/generated</Mono>],
          ['Validate against the schema', <Mono key="v">python -m tools.validate_nodes --dir nodes/ --apply-defaults</Mono>],
          ['Print an inventory', <Mono key="s">python -m tools.summarize_nodes --dir nodes/ --md reports/nodes.md</Mono>],
          ['Import from a cluster', <Mono key="i">kubectl get nodes -o json | python -m tools.import_cluster --out nodes/ --dry-run</Mono>],
          ['From the dashboard', 'Nodes tab: create, edit, delete. Saved to nodes/<name>.yaml and applied immediately.'],
          ['Over the API', 'POST /add_node, DELETE /nodes/<name> (API key when auth is on).'],
        ]}
      />
      <P>
        <Mono>gen_nodes</Mono> defaults to 100 nodes with seed 123. The schema is <Mono>schemas/node.schema.yaml</Mono>.
      </P>
      <Callout tone="note" title="GPU nodes in containers">
        When a descriptor declares a GPU (<Mono>gpu.type</Mono> other than none), the container launcher requests a Docker GPU
        device for that node so placements that assume a GPU can be exercised against real GPU access.
      </Callout>
    </DocPage>
  )
}

export function Topology() {
  return (
    <DocPage
      title="Topology and links"
      lead="sim/topology.yaml describes how nodes connect, what hardware costs, and which failures to replay."
    >
      <H2 id="sections">File sections</H2>
      <DocTable
        head={['Section', 'Purpose']}
        mono={[0]}
        rows={[
          ['metadata', 'Name, owner, description, tags.'],
          ['defaults', 'Default network, routing (QoS classes), security, pricing and energy.'],
          ['regions', 'Regions and their sites. The bundled fabric has two regions (campus, city_mesh) and four sites.'],
          ['link_profiles', 'Named link classes reused by links.'],
          ['links', 'Site-to-site and node-to-node links.'],
          ['placement_policies', 'Region preference, replication limit, format preferences per stage type.'],
          ['data_locality', 'Where datasets live and the cost of making them hot.'],
          ['trust_overrides', 'Per-site trust values.'],
          ['chaos', 'The default fault schedule.'],
          ['scenarios', 'Named, replayable chaos scenarios.'],
        ]}
      />

      <H2 id="profiles">Link profiles</H2>
      <DocTable
        head={['Profile', 'Fabric', 'Speed (Gbps)', 'RTT (ms)', 'Jitter (ms)', 'Loss (%)']}
        mono={[0]}
        rows={[
          ['LAN-10G', 'ethernet', '10', '0.8', '0.2', '0.03'],
          ['LAN-100G', 'ethernet', '100', '0.4', '0.08', '0.01'],
          ['IB-400G', 'infiniband', '400', '0.05', '0.01', '0.0'],
          ['WIFI-6E', 'wifi', '9.6', '10', '4', '0.8'],
          ['WIFI-7', 'wifi', '23', '7', '3', '0.5'],
          ['WAN-1G', 'ethernet', '1', '12', '3', '0.2'],
        ]}
      />

      <H2 id="links">Links</H2>
      <P>
        A link joins two endpoints, which can be <b>sites</b> (<Mono>site-lab</Mono>) or <b>nodes</b> (<Mono>ws-001</Mono>), and
        inherits a profile that individual fields can override. Its key is the two endpoints sorted and joined with{' '}
        <Mono>|</Mono>, for example <Mono>site-lab|site-datacenter</Mono>.
      </P>
      <Code label="sim/topology.yaml">{`links:
  - { a: site-lab,    b: site-datacenter, profile: IB-400G,  qos_class: urgent, scope: site }
  - { a: site-hostel, b: site-cloudlet,   profile: WIFI-7,   qos_class: normal, scope: site }
  - { a: ws-001,      b: srv-003,         profile: LAN-10G,  scope: node }`}</Code>
      <Callout tone="note" title="Why the topology graph draws extra edges">
        Declared links are mostly site-level, which rarely match a device name, so the real per-device link set is usually
        small. The dashboard graph derives connectivity from each node’s zone label (a ring inside each zone plus a
        backbone joining zones) and draws real and chaos-injected links on top.
      </Callout>

      <H2 id="pricing">Pricing and energy defaults</H2>
      <P>
        <Mono>defaults.pricing</Mono> sets hourly prices (CPU core, GPU, NPU, memory, storage, egress) in a currency, and{' '}
        <Mono>defaults.energy</Mono> sets grid carbon intensity and electricity price. The bundled fabric uses INR, 720 g
        CO2 per kWh and 8 per kWh. Per-zone values under <Mono>defaults.energy.zones.&lt;zone&gt;</Mono> let a solar site
        be charged differently from a coal grid. See <PageLink to="planning">Planning</PageLink> for how they enter plans.
      </P>

      <H2 id="scenarios">Chaos scenarios</H2>
      <DocTable
        head={['Scenario', 'What it does']}
        mono={[0]}
        rows={[
          ['wifi_brownout', 'Wi-Fi 7 cloudlet link congests and one workstation thermally derates.'],
          ['core_link_cut', 'Hard cut between lab and datacenter, a node kill, and a degraded hostel-to-datacenter link.'],
          ['campus_edge_failover', 'Edge zone blackout with a cross-zone partition.'],
          ['multi_federation_surge', 'rackB outage plus cross-federation congestion and a power cap.'],
        ]}
      />
      <P>
        Each scenario can also apply policy and link overrides before its events run. Event kinds and parameters are in{' '}
        <PageLink to="chaos">Chaos and resilience</PageLink>. The schema is <Mono>schemas/topology.schema.yaml</Mono>.
      </P>
    </DocPage>
  )
}

export function Jobs() {
  return (
    <DocPage
      title="Jobs"
      lead="A job is a small workflow of stages. Each stage states what it needs; the planner decides where it runs."
    >
      <H2 id="format">Format</H2>
      <P>
        Jobs are YAML or JSON, validated against <Mono>schemas/job.schema.yaml</Mono>. A file holds a <Mono>jobs</Mono> array
        and may add shared <Mono>defaults</Mono> and a <Mono>version</Mono> string.
      </P>
      <Code label="jobs/example.yaml">{`version: "0.1.0"
jobs:
  - id: job-vision-small
    deadline_ms: 4500
    stages:
      - id: s1_ingest
        type: io
        size_mb: 40
        resources: { cpu_cores: 1, mem_gb: 1 }
        allowed_formats: [native, wasm]
      - id: s3_cnn
        type: cv
        size_mb: 120
        resources: { cpu_cores: 4, mem_gb: 4, gpu_vram_gb: 2 }
        allowed_formats: [cuda, native]
    placement:
      prefer_region: [campus]
      min_trust: 0.7
    fault_tolerance: { replication_factor: 2 }`}</Code>

      <H2 id="fields">Fields</H2>
      <DocTable
        head={['Field', 'Meaning']}
        mono={[0]}
        rows={[
          ['id', 'Unique job name.'],
          ['deadline_ms', 'SLA: the plan meets it when predicted latency is at or below this.'],
          ['stages[]', 'At least one stage. Without edges they run in sequence.'],
          ['stages[].id, type', 'Stage name and kind (io, preproc, cv, mlp, ...).'],
          ['stages[].size_mb', 'Data size, used for transfer time.'],
          ['stages[].resources', 'cpu_cores, mem_gb, gpu_vram_gb and accelerator hints.'],
          ['stages[].allowed_formats / disallowed_formats', 'Execution formats the stage may or may not use.'],
          ['edges', 'Optional explicit DAG edges.'],
          ['datasets', 'Input names and locality metadata.'],
          ['placement', 'Site or region preference, required fabric, minimum trust, architecture limits.'],
          ['fault_tolerance', 'Replication factor, checkpointing style, retry and backoff limits.'],
          ['policy', 'Optimisation target: latency, cost, energy, carbon or balanced, with limits.'],
          ['redundancy', 'Number of redundant placements the resilient planners should make.'],
          ['defaults', 'File-level settings applied to every job (qos, deadline, retry, placement).'],
        ]}
      />

      <H2 id="catalogue">The bundled catalogue</H2>
      <P>
        <Mono>jobs/jobs_10.yaml</Mono> holds 11 demo jobs with 3 to 5 stages each:
      </P>
      <UL
        items={[
          <Mono key="1">job-vision-small, job-vision-large</Mono>,
          <Mono key="2">job-nlp-pipeline, job-analytics-batch, job-mixed-stream</Mono>,
          <Mono key="3">job-cv-no-gpu, job-audio-ml, job-tabular-boosting</Mono>,
          <Mono key="4">job-hpc-mixed, job-end2end-mlops, job-wasm-preferred</Mono>,
        ]}
      />
      <P>
        The API lists everything under the jobs root (<Mono>jobs/</Mono>, or <Mono>FABRIC_JOBS_ROOT</Mono>) at{' '}
        <Mono>GET /jobs</Mono>.
      </P>

      <H2 id="submit">Submitting and managing jobs</H2>
      <DocTable
        head={['How', 'Command or place']}
        rows={[
          ['Dashboard', 'Plan a Job on the Dashboard tab, or the Jobs tab to create, edit and delete library jobs.'],
          ['One job', <Mono key="a">POST /plan</Mono>],
          ['Several jobs', <Mono key="b">POST /plan_batch</Mono>],
          ['CLI', <Mono key="c">python -m planner.run_plan --job jobs/jobs_10.yaml --strategy resilient --dry-run</Mono>],
          ['Save a descriptor', <Mono key="d">POST /jobs, DELETE /jobs?id=</Mono>],
        ]}
      />
      <P>
        <Mono>planner.run_plan</Mono> flags: <Mono>--job</Mono> (required), <Mono>--dry-run</Mono>, <Mono>--remote URL</Mono>,{' '}
        <Mono>--strategy</Mono>, <Mono>--repeat N</Mono> (useful for the bandit learner), <Mono>--out PATH</Mono>.
      </P>
      <Callout tone="tip">
        Every stage needs at least one node whose <Mono>formats_supported</Mono> contains an allowed format, and enough
        headroom. If a plan comes back infeasible, check the stage’s <Mono>reason</Mono> field first; see{' '}
        <PageLink to="troubleshooting">Troubleshooting</PageLink>.
      </Callout>
    </DocPage>
  )
}
