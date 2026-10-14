import { Mono } from '../../ui/primitives'
import { ClosedLoopDiagram } from '../diagrams'
import { Callout, Code, DocPage, DocTable, H2, H3, P, PageLink, UL } from '../ui'

export function Introduction() {
  return (
    <DocPage
      title="Introduction"
      lead="RAP Twin is a digital-twin sandbox for distributed compute fabrics. It lets you try a scheduling policy, a hardware change or a failure on a faithful model first, so mistakes happen in the twin and not on production hardware."
    >
      <H2 id="problem">The problem it addresses</H2>
      <P>
        Operators of edge, multi-cloud and hybrid fabrics have to decide where jobs run, but the fabric changes under
        them: links degrade, nodes overheat, capacity is reserved by other work. Trying a new placement policy on the
        live system risks missed deadlines or outages, telemetry is usually spread across separate tools, and rare
        failures (a core link cut, a zone blackout) are almost never rehearsed.
      </P>

      <H2 id="what">What RAP Twin gives you</H2>
      <UL
        items={[
          <><b>A live twin.</b> Hardware descriptors (YAML) and streaming telemetry are merged into one state model that is hot-reloaded without restarts.</>,
          <><b>Pluggable planners.</b> Greedy, cheapest-energy, resilient/federated and an MDP planner with online Q-learning, all with a dry-run mode that reserves nothing.</>,
          <><b>Deterministic chaos.</b> Replayable fault schedules (link cuts, thermal derating, zone blackouts, partitions) plus self-healing controllers that react to them.</>,
          <><b>Decision tools.</b> Money and carbon on every plan, a blast-radius finder, what-if capacity planning, incident bundles and cluster import.</>,
          <><b>A resilience gate for CI.</b> A command that fails a build when a scheduling change loses worst-case SLA or latency.</>,
          <><b>Standard exports.</b> The twin as Azure Digital Twins (DTDL) models and Kubernetes custom resources.</>,
        ]}
      />

      <H2 id="loop">The closed loop</H2>
      <P>
        Everything RAP Twin does follows one loop. Telemetry and descriptors are merged into the state, controllers and
        chaos change that state, analytics predict risk from it, planners place jobs against it, and the analysis tools
        and dashboard read the result. New observations then flow back in.
      </P>
      <ClosedLoopDiagram />
      <DocTable
        head={['Stage', 'What happens', 'Where it lives']}
        mono={[2]}
        rows={[
          ['1 Fabric & telemetry', 'Node and topology descriptors, live observations over REST or MQTT.', 'nodes/, sim/topology.yaml, sim/mqtt_bridge.py'],
          ['2 State merge', 'Static descriptors, runtime overrides and observations become one view.', 'dt/state.py'],
          ['3 Chaos & controllers', 'Fault schedules are injected; self-healing and the guardian react.', 'sim/chaos.py, dt/self_heal.py'],
          ['4 Predictive analytics', 'Utilisation forecasts, failure windows, link variability.', 'dt/predict.py'],
          ['5 Planning', 'Jobs are placed with the chosen strategy, with cost and carbon attached.', 'dt/planners.py, dt/policy/, dt/economics.py'],
          ['6 What-if & blast radius', 'Fork the twin, change something, compare; search for the smallest breaking fault.', 'dt/whatif.py, sim/blast_radius.py'],
          ['7 Visualise & export', 'Dashboard, bundles, DTDL and Kubernetes exports.', 'web/, dt/exporters.py, tools/bundle.py'],
        ]}
      />

      <H2 id="concepts">Key concepts</H2>
      <DocTable
        head={['Term', 'Meaning']}
        rows={[
          [<b key="t">Twin (DTState)</b>, 'The in-memory model of the fabric: nodes, links, federations, reservations and the event bus. One instance serves the API.'],
          [<b key="n">Node</b>, 'A machine described by a YAML descriptor: CPU, memory, GPU, accelerators, network, health and labels.'],
          [<b key="l">Link</b>, 'A connection between two nodes or two sites, with speed, round-trip time, jitter and loss.'],
          [<b key="f">Federation</b>, 'A group of nodes sharing a zone label (for example lab, cloudlet or rackB). Load and health are aggregated per federation.'],
          [<b key="j">Job</b>, 'A workload made of stages with resource needs, allowed formats and a deadline.'],
          [<b key="p">Plan</b>, 'The assignment of a job’s stages to nodes, with predicted latency, energy, risk, cost and carbon.'],
          [<b key="s">Strategy</b>, 'The placement policy used to produce a plan (greedy, resilient, rl-markov and so on).'],
          [<b key="d">Dry run</b>, 'Planning that returns predictions but reserves no resources.'],
          [<b key="r">Reservation</b>, 'Capacity held on a node by a committed plan until it is released or expires.'],
          [<b key="o">Override</b>, 'A runtime change to a node or link (a fault, a derate, a measurement) merged over the static descriptor.'],
          [<b key="sc">Scenario</b>, 'A named, replayable chaos schedule in sim/topology.yaml.'],
          [<b key="sla">SLA hit</b>, 'A job whose predicted latency meets its deadline. The SLA hit rate is the share of jobs that do.'],
          [<b key="jct">JCT</b>, 'Job completion time: the predicted end-to-end latency of a plan.'],
        ]}
      />

      <H2 id="next">Where to go next</H2>
      <UL
        items={[
          <>Run it locally: <PageLink to="quickstart">Quickstart</PageLink>.</>,
          <>See how the pieces fit: <PageLink to="architecture">Architecture</PageLink> and <PageLink to="state">Digital twin state</PageLink>.</>,
          <>Drive it from the browser: <PageLink to="dashboard">Dashboard guide</PageLink>.</>,
          <>Drive it from code: <PageLink to="api">API reference</PageLink>.</>,
          <>See the evidence: <PageLink to="results">Measured results</PageLink>.</>,
        ]}
      />
    </DocPage>
  )
}

export function Quickstart() {
  return (
    <DocPage
      title="Quickstart"
      lead="Get the API and the dashboard running on your machine, then plan your first job. Allow about ten minutes."
    >
      <H2 id="prereqs">Prerequisites</H2>
      <UL
        items={[
          <>Python 3 with <Mono>venv</Mono> and <Mono>pip</Mono>, and <Mono>git</Mono>.</>,
          <>Node.js and npm for the React dashboard.</>,
          <>Optional: Docker, only for the container-based fabric launcher.</>,
        ]}
      />

      <H2 id="install">Install</H2>
      <Code>{`git clone https://github.com/riaan-attar/raptwin.git
cd raptwin
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt`}</Code>
      <P>
        <Mono>make install</Mono> does the same in one step. The repository already ships 100 sample node descriptors in{' '}
        <Mono>nodes/</Mono> and an 11-job catalogue in <Mono>jobs/jobs_10.yaml</Mono>, so nothing else is needed to get a
        working twin.
      </P>

      <H2 id="api">Start the API</H2>
      <Code>{'python -m dt.api --host 127.0.0.1 --port 8080'}</Code>
      <DocTable
        head={['Flag', 'Default', 'Meaning']}
        mono={[0, 1]}
        rows={[
          ['--host', '127.0.0.1', 'Bind address. Use 0.0.0.0 for LAN access.'],
          ['--port', '8080', 'HTTP port.'],
          ['--debug', 'off', 'Flask debug mode with auto-reload.'],
        ]}
      />
      <P>Check that it is alive:</P>
      <Code>{`curl -s http://127.0.0.1:8080/health
# {"data":{"ts":1791992334065},"ok":true}`}</Code>

      <H2 id="dashboard">Start the dashboard</H2>
      <Code>{`cd web
npm install     # once
npm run dev     # http://localhost:5173`}</Code>
      <P>
        Or use <Mono>make web-install</Mono> then <Mono>make web-dev</Mono> from the repository root. The dev server proxies{' '}
        <Mono>/api</Mono> to <Mono>$FABRIC_DT_REMOTE</Mono> (default <Mono>http://127.0.0.1:8080</Mono>), so the browser stays
        same-origin and the API needs no CORS setup.
      </P>

      <H2 id="first-plan">Plan your first job</H2>
      <P>
        Ask for a <b>dry run</b> first. It returns the full prediction without reserving anything, so you can repeat it
        freely.
      </P>
      <Code>{`curl -s -X POST http://127.0.0.1:8080/plan \\
  -H 'Content-Type: application/json' \\
  -d '{
    "strategy": "greedy",
    "dry_run": true,
    "job": {
      "id": "job-demo",
      "deadline_ms": 4500,
      "stages": [
        {"id": "ingest", "type": "io", "size_mb": 40,
         "resources": {"cpu_cores": 1, "mem_gb": 1},
         "allowed_formats": ["native", "wasm"]},
        {"id": "cnn", "type": "cv", "size_mb": 120,
         "resources": {"cpu_cores": 4, "mem_gb": 4, "gpu_vram_gb": 2},
         "allowed_formats": ["cuda", "native"]}
      ]
    }
  }'`}</Code>
      <P>
        The response carries <Mono>assignments</Mono> (stage to node), <Mono>latency_ms</Mono>, <Mono>energy_kj</Mono>,{' '}
        <Mono>risk</Mono>, <Mono>cost_total</Mono>, <Mono>co2_g</Mono> and a <Mono>per_stage</Mono> breakdown. See{' '}
        <PageLink to="planning">Planning</PageLink> for every field. In the dashboard, the same job can be run from{' '}
        <b>Plan a Job</b> on the Dashboard tab.
      </P>
      <Callout tone="tip" title="Try a failure">
        Open the <b>Chaos &amp; Faults</b> tab, start the <Mono>core_link_cut</Mono> scenario, then plan the same job again.
        Compare the latency and the chosen nodes with the earlier plan.
      </Callout>

      <H2 id="make">Make targets</H2>
      <DocTable
        head={['Target', 'What it does']}
        mono={[0]}
        rows={[
          ['make install', 'Create the virtual environment and install requirements.'],
          ['make run-api', 'Start the Digital Twin API.'],
          ['make run-ui', 'Start the legacy Flask dashboard on :8090.'],
          ['make web-install / web-dev', 'Install frontend dependencies / start the React dev server on :5173.'],
          ['make web-build / web-preview / web-check', 'Production bundle / build and serve it on :4173 / typecheck only.'],
          ['make gen-nodes', 'Synthesise 100 realistic node descriptors into nodes/.'],
          ['make validate-nodes / summarize-nodes', 'Validate nodes against the schema / print an inventory table.'],
          ['make plan', 'Dry-run the catalogue locally with the greedy planner.'],
          ['make policy-benchmark', 'Benchmark the planners and plot the metrics.'],
          ['make demo NUM=25', 'Fire random jobs at the API with configurable workers and rate.'],
          ['make chaos', 'Run the default chaos schedule.'],
          ['make gate / gate-baseline', 'Run the resilience gate / record ci/baseline.json.'],
          ['make blast-radius', 'Search for the smallest fault set that breaks a job.'],
          ['make bundle', 'Export a reproducible incident bundle.'],
          ['make mqtt-bridge', 'Run the MQTT telemetry bridge.'],
          ['make srs-table', 'Regenerate the measured benchmark table.'],
          ['make docker-launch / docker-clean', 'Start / remove the container fabric.'],
          ['make format / lint', 'Run black / ruff.'],
        ]}
      />

      <H2 id="tests">Run the tests</H2>
      <Code>{'pytest'}</Code>
      <P>
        The suite covers the API (planning, management and authentication), the resilience gate, blast radius, what-if,
        cost and carbon, incident bundles, cluster import, the MQTT parser, the container launcher and the benchmark
        scripts.
      </P>
      <Callout tone="note">
        Next: read <PageLink to="architecture">Architecture</PageLink> to see how the parts fit, or jump to the{' '}
        <PageLink to="dashboard">Dashboard guide</PageLink>.
      </Callout>
      <H3>Stuck?</H3>
      <P>
        <PageLink to="troubleshooting">Troubleshooting</PageLink> lists the common failures with their fixes.
      </P>
    </DocPage>
  )
}
