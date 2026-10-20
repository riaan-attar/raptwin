import { Mono } from '../../ui/primitives'
import { Callout, Code, DocPage, DocTable, H2, H3, P, PageLink, UL } from '../ui'

export function Dashboard() {
  return (
    <DocPage
      title="Dashboard guide"
      lead="A tour of every tab: what it shows, what you can change, and the workflows that tie them together."
    >
      <H2 id="header">The header</H2>
      <DocTable
        head={['Control', 'What it does']}
        rows={[
          [<b key="a">Connection line</b>, 'Shows whether the API is reachable, and whether live updates arrive over the event stream or by polling (every 2 seconds) while the stream is down.'],
          [<b key="b">Live / Paused</b>, 'Pauses event-stream and polling updates so you can read a screen without it changing.'],
          [<b key="c">Refresh</b>, 'Refetches the snapshot and plan history immediately.'],
          [<b key="r">Restart</b>, 'Rebuilds the whole twin from the files on disk: drops every reservation, plan, injected fault and chaos run. You must type the word confirm before the button enables; the server checks the same phrase.'],
          [<b key="d">Theme toggle</b>, 'Switches between dark and light. The choice is remembered in the browser.'],
          [<b key="e">Tabs</b>, 'Each tab has its own address (#nodes, #chaos, #docs/api, ...), so reloads and the back button keep your place.'],
        ]}
      />

      <H2 id="dashboard-tab">Dashboard tab</H2>
      <DocTable
        head={['Panel', 'Shows', 'Use it to']}
        rows={[
          [<b key="1">Overview</b>, 'Total capacity, reservations, federation load and the last plan’s spread.', 'Get a one-glance health reading.'],
          [<b key="2">Fabric Topology</b>, 'A zone-clustered force graph of every node, with real and injected links on top.', 'Zoom and pan, go full screen, click a node for its descriptor, its links and the stages the current plan put on it.'],
          [<b key="3">Plan a Job</b>, 'Catalogue picker (choose a jobs/*.yaml file, tick the jobs to include; the choice is remembered in your browser), JSON editor, strategy picker, dry-run toggle.', 'Run a job with any strategy, try the demo job, or plan only the ticked jobs as a batch.'],
          [<b key="4">Recent Plans</b>, 'History of plans with strategy, latency and feasibility.', 'Compare strategies side by side by planning the same job repeatedly.'],
          [<b key="5">Plan Detail</b>, 'Per-stage placement, compute and transfer time, energy, risk, cost, carbon, fallbacks.', 'See why a stage landed where it did, and where it would fail over.'],
          [<b key="6">Nodes / Links</b>, 'Live inventory with dynamic and effective values.', 'Filter, tick rows and inject faults in bulk (see below); check reliability, derate and loss.'],
          [<b key="7">Federations / Federation Links</b>, 'Load blends CPU, memory and accelerator use per zone; cross-zone health.', 'Spot a hot or partitioned zone, then take a whole federation down or max it out.'],
          [<b key="8">Twin Events</b>, 'CloudEvents: plan commits, overrides, self-healing, guardian.', 'Audit what just happened.'],
        ]}
      />

      <H2 id="bulk">Filters, selection and bulk actions</H2>
      <P>
        The Nodes, Links, Federations and Federation Links tables on the Dashboard, and the tables on the Nodes and Links
        tabs, share the same controls: filters above the table, a checkbox column on the left, and an action bar that
        appears when you tick rows. Selection survives changing a filter; the bar tells you how many selected rows the
        current filter is hiding, and every action applies to all selected rows, hidden or not.
      </P>
      <DocTable
        head={['Table', 'Filters']}
        rows={[
          [<b key="n">Nodes</b>, 'Search (name, class, arch, labels), zone or federation, class, arch, format, GPU, status (up, down, derated, saturated at 90% CPU, has reservations), reliability up to, and sort (name, free CPU, utilisation, reliability, derate).'],
          [<b key="l">Links</b>, 'Search, status (OK, degraded at 2% loss, down), minimum loss, and sort (loss, RTT, slowest).'],
          [<b key="f">Federations</b>, 'Search, status (has down nodes, hot at 80% load, has reservations), and sort (name, load, most down).'],
          [<b key="fl">Federation Links</b>, 'Search, status (has down links, degraded), and sort (name, loss, RTT).'],
        ]}
      />
      <DocTable
        head={['Selected', 'Actions']}
        rows={[
          [<b key="n2">Nodes</b>, 'Take down, Bring up, Max out CPU, memory, VRAM or all three, Relieve, Thermal derate (0 to 1), Power cap (W), Lower reliability (0 to 1), Clear all faults. The Nodes tab adds Delete selected.'],
          [<b key="l2">Links</b>, 'Take down, Bring up, Degrade (loss %, RTT, jitter, speed; leave a field empty to keep it), Restore all fields. The Links tab adds Delete selected.'],
          [<b key="f2">Federations</b>, 'The same node actions, applied to every node in each selected federation. Each row also has one-click Take down, Bring up and Max out for that federation.'],
          [<b key="fl2">Federation Links</b>, 'The link actions, applied to the real links that make up each selected pair of federations.'],
        ]}
      />
      <UL
        items={[
          <>Large or whole-federation actions ask for confirmation. After any action a result line appears with an <b>Undo</b> that restores the exact previous values.</>,
          <><b>Max out</b> sets the used CPU, memory and VRAM to the node&apos;s full capacity, so its free capacity becomes zero and planners avoid it. <b>Relieve</b> sets usage back to what the node&apos;s real reservations hold (not zero), so live plans keep their accounting.</>,
          <>To wipe everything at once, use the header <b>Restart</b> button, which rebuilds the twin from disk (learned planner state is kept).</>,
          <>Releasing a real reservation after maxing a node out lowers its used capacity from the maxed value, so use Undo or Relieve to return to normal.</>,
          <>These actions use the same <Mono>/observe</Mono> route as Inject Observation, so they show up as <Mono>fabric.node.observe</Mono> and <Mono>fabric.link.observe</Mono> events and are cleared by <b>Reset faults</b> on the Chaos tab.</>,
        ]}
      />
      <Callout tone="warn" title="Open on the public demo">
        <Mono>/observe</Mono> needs no API key, so on the hosted demo any visitor can take nodes or whole federations down.
        Use Reset faults to restore everything.
      </Callout>

      <H2 id="nodes-tab">Nodes tab</H2>
      <P>
        Create, edit and delete nodes, or tick several and use the bulk bar (including Delete selected). The editor groups fields into Identity, Compute, and Network &amp; health. Saving
        writes <Mono>nodes/&lt;name&gt;.yaml</Mono> and applies it to the live twin immediately. Deleting also removes the
        node’s reservations.
      </P>
      <H2 id="links-tab">Links tab</H2>
      <P>
        Manage declared links. They are saved to the <Mono>links:</Mono> section of <Mono>sim/topology.yaml</Mono>, and the
        endpoints can be node names or topology sites. Pick a profile, then override individual metrics if needed.
      </P>
      <H2 id="jobs-tab">Job Library tab</H2>
      <P>
        The job library under <Mono>jobs/*.yaml</Mono>, used by the planner and the Dashboard composer. Create, edit, delete
        and plan jobs here. Pick a catalogue file in the dropdown to see only its jobs, tick the jobs you want, and use{' '}
        <b>Select all</b> / <b>Select none</b>; the batch button then plans just the ticked jobs. When you create a job, choose
        which catalogue file it is saved into (an existing one, or a new file name). Search and the catalogue filter work
        together, and <b>Reset filter</b> clears both.
      </P>
      <H2 id="events-tab">Events &amp; Jobs tab</H2>
      <P>
        Every committed plan (not a dry run) starts a <b>run</b> with a timer. When the timer reaches zero the run
        completes and its reservations are freed, so the capacity returns to the fabric. Everything is managed from this tab.
      </P>
      <DocTable
        head={['Panel', 'What it does']}
        rows={[
          [<b key="s">Summary</b>, 'Running count, soonest to finish, reservations held by runs, and the settings: an auto-release switch and the default run length in seconds.'],
          [<b key="r">Running jobs</b>, 'One card per run: live countdown and progress, a per-stage timeline (done, active, pending, with a warning if the stage\'s node went down or failed over), predicted latency against the deadline, cost and carbon. Buttons: Finish now, Cancel, +30 s, +1 min, Set timer. Tick several runs for bulk Finish, Cancel or extend.'],
          [<b key="h">Recent runs</b>, 'Completed and cancelled runs, with the reason, the duration and how many reservations were freed.'],
          [<b key="e">Twin events</b>, 'The full event feed with family chips, search, pause, a 100/250/500 window and a raw view of each CloudEvent. Click a subject to filter to it.'],
        ]}
      />
      <UL
        items={[
          <>Set the length per job in <b>Plan a Job</b> (&quot;Run for&quot; seconds), in the job&apos;s own <Mono>duration_s</Mono>, or leave both blank for the default (30 s).</>,
          <>The timer is <b>simulated</b>: a running job holds capacity for those seconds, it does not execute code. The plan&apos;s predicted latency (about a second) is shown separately.</>,
          <>With auto-release off, a committed plan holds its reservations until you release them, as before. The settings are held in memory and reset when the API restarts (<Mono>FABRIC_JOB_DEFAULT_SECONDS</Mono> and <Mono>FABRIC_JOB_AUTO_RELEASE</Mono> give the starting values).</>,
          <>The resource guardian can still free a reservation on a saturated node early (after 300 s), and Restart drops all runs.</>,
        ]}
      />
      <H2 id="chaos-tab">Chaos &amp; Faults tab</H2>
      <DocTable
        head={['Panel', 'What it does']}
        rows={[
          [<b key="1">Chaos scenarios</b>, 'Runs a schedule from sim/topology.yaml inside the twin, with a speed factor. No separate process is needed.'],
          [<b key="2">Health &amp; cleanup</b>, 'Counts down nodes, derated nodes and down links; resets every injected fault (and stops a running scenario); clears plan history without releasing reservations.'],
          [<b key="3">Inject Observation</b>, 'Applies or reverts a single observation through /observe, the same path the chaos engine and the MQTT bridge use.'],
          [<b key="4">Blast radius</b>, 'Searches fault combinations for the smallest set that breaks a chosen job.'],
          [<b key="5">Twin Events</b>, 'The live event feed.'],
        ]}
      />
      <H2 id="whatif-tab">What-if tab</H2>
      <P>
        Fork the twin, apply a hardware or topology change, optionally apply faults to both sides, and compare SLA, p95
        latency, cost, carbon and fabric size. Nothing is persisted. See <PageLink to="analysis">Analysis tools</PageLink>.
      </P>
      <H2 id="reservations-tab">Reservations tab</H2>
      <P>
        Every reservation held by a committed plan, per node. Filter by node or reservation id, release a single one, or
        release everything that matches the filter (or all of them when there is no filter).
      </P>
      <Callout tone="note" title="Actions that need an API key">
        If the server is configured with an API key, actions that change state (nodes, links, jobs, chaos, clearing plans,
        resetting faults, restarting the twin) need a key. The hosted dashboard sends it for you; planning, what-if and blast radius never need
        one. See <PageLink to="deployment">Deployment and security</PageLink>.
      </Callout>

      <H2 id="workflows">Worked workflows</H2>
      <H3>Compare strategies on one job</H3>
      <UL
        items={[
          <>Dashboard tab, <b>Plan a Job</b>: choose a job, tick <b>dry run</b>.</>,
          <>Run it once per strategy. Each result appears under <b>Recent Plans</b>.</>,
          <>Select two plans in turn and compare latency, energy, risk and cost in <b>Plan Detail</b>.</>,
        ]}
      />
      <H3>See how a failure changes placement</H3>
      <UL
        items={[
          <>Plan a job (dry run) and note the chosen nodes.</>,
          <>Chaos &amp; Faults tab: start <Mono>core_link_cut</Mono> at speed 10.</>,
          <>Plan the same job again while it runs, then reset faults under <b>Health &amp; cleanup</b>.</>,
        ]}
      />
      <H3>Find what would break a job</H3>
      <UL
        items={[
          <>Chaos &amp; Faults tab, <b>Blast radius</b>: pick the job, depth 2.</>,
          <>Read the smallest breaking fault sets and the most implicated fault.</>,
        ]}
      />
    </DocPage>
  )
}

export function Planning() {
  return (
    <DocPage
      title="Planning"
      lead="Strategies, what a plan contains, how cost and carbon are computed, and how the MDP planner scores placements."
    >
      <H2 id="strategies">Strategies</H2>
      <P>
        Send the strategy name in <Mono>POST /plan</Mono>. Names are case-insensitive. An unrecognised name falls back to
        the default greedy planner.
      </P>
      <DocTable
        head={['Strategy', 'Accepted names', 'Behaviour']}
        mono={[1]}
        rows={[
          [<b key="g">Greedy</b>, 'greedy (default)', 'First-fit placement on available CPU and VRAM, format and accelerator aware. Optimises latency.'],
          [<b key="e">Cheapest-Energy</b>, 'cheapest-energy, energy, energy-aware', 'Picks nodes that minimise power draw.'],
          [<b key="c">Cheapest-Cost</b>, 'cheapest-cost, cost, cost-aware, cheapest', 'Optimises money using hourly rates.'],
          [<b key="gr">Greenest</b>, 'greenest, low-carbon, carbon, carbon-aware', 'Optimises grams of CO2 using zone carbon intensity.'],
          [<b key="b">Bandit</b>, 'bandit, bandit-greedy, bandit-latency, bandit-format', 'Greedy planner with a learning layer that adapts from outcomes.'],
          [<b key="r">Resilient / Federated</b>, 'resilient, network-aware, federated, fault-tolerant, ft, failover, balanced, load-balance, load-balanced', 'Network-aware, risk-weighted placement with redundant fallback paths across federations.'],
          [<b key="m">RL-Markov</b>, 'rl-markov, rl, mdp, markov, mdp-rl, reinforcement', 'Finite-horizon MDP solved by dynamic programming, with an online Q-learning term.'],
        ]}
      />

      <H2 id="dry-run">Dry run versus commit</H2>
      <UL
        items={[
          <><b>Dry run</b> (<Mono>dry_run: true</Mono>) returns the full prediction and reserves nothing, so it is safe to repeat. It still appears in plan history (the last 200 plans are kept) and publishes a plan event marked <Mono>dry_run</Mono>.</>,
          <><b>Commit</b> reserves CPU, memory and VRAM on the chosen nodes and registers the plan with self-healing so fallbacks can be promoted. For the RL-Markov planner it also persists the updated Q-table.</>,
          <>Free reservations with <Mono>POST /release</Mono> or from the Reservations tab. The resource guardian also frees stale ones.</>,
        ]}
      />

      <H2 id="result">What a plan contains</H2>
      <DocTable
        head={['Field', 'Meaning']}
        mono={[0]}
        rows={[
          ['assignments', 'Map from stage id to node name.'],
          ['per_stage[]', 'Per stage: node, format, compute_ms, xfer_ms, energy_kj, risk, reliability, score, cost, co2_g, fallbacks, federation, and infeasible with a reason.'],
          ['reservations[]', 'Node and reservation id for each committed placement, with stage and role.'],
          ['shadow_assignments', 'Standby nodes per stage for the resilient planners.'],
          ['latency_ms, energy_kj, risk', 'Plan totals.'],
          ['deadline_ms, slo_penalty', 'The job’s deadline and the penalty if it is missed.'],
          ['infeasible, reason', 'True when some stage could not be placed, with why.'],
          ['avg_reliability', 'Mean reliability of the chosen nodes.'],
          ['cost_total, cost_breakdown, currency', 'Money for the plan, split into compute, energy and egress.'],
          ['co2_g, energy_kwh', 'Carbon and energy of the plan.'],
          ['federation_spread, federations_in_use, resilience_score, cross_federation_fallback_ratio', 'Resilient planner diagnostics.'],
          ['mdp_value', 'Expected value from the MDP planner.'],
          ['predictive', 'Per-node and per-link forecasts at planning time.'],
          ['strategy, dry_run, ts', 'Echoes of the request and the time.'],
        ]}
      />

      <H2 id="economics">Cost and carbon</H2>
      <P>
        Every plan carries money and carbon, computed in <Mono>dt/economics.py</Mono> from the topology’s{' '}
        <Mono>defaults.pricing</Mono> and <Mono>defaults.energy</Mono>. <Mono>GET /economics</Mono> shows the values in force.
      </P>
      <UL
        items={[
          <>Compute is rented per hour of CPU, GPU, NPU and memory; energy is kWh times the electricity price; egress is billed per GB moved between nodes.</>,
          <>Carbon is energy times the zone’s grid intensity, which can differ per zone.</>,
          <>Scoring uses per-hour <i>rates</i>, not absolute cost. A 300 ms stage rents hardware for 300 ms, so its absolute cost is close to zero for every candidate and could not tell them apart.</>,
          <>Tune the trade-off with <Mono>FABRIC_COST_WEIGHT</Mono> and <Mono>FABRIC_CARBON_WEIGHT</Mono> (default 25): milliseconds of latency traded per unit of currency, or per gram of CO2, per hour.</>,
        ]}
      />
      <Code>{`curl -s localhost:8080/economics
curl -s -X POST localhost:8080/plan -H 'Content-Type: application/json' \\
  -d '{"job": {...}, "strategy": "greenest", "dry_run": true}'`}</Code>

      <H2 id="mdp">The RL-Markov cost model</H2>
      <P>
        The planner treats a job as a finite-horizon decision problem: each stage is a step where it picks a node that
        satisfies the resource and format constraints. Each choice has an immediate cost combined with a weighted{' '}
        <b>Tchebycheff</b> aggregation, so it respects the shape of the trade-off instead of collapsing everything into one
        ad-hoc sum. A placement that is excellent on one term and poor on another is penalised more than one that is
        merely average on all of them.
      </P>
      <DocTable
        head={['Term', 'Default weight']}
        mono={[0]}
        rows={[
          ['latency', '0.34'],
          ['energy', '0.14'],
          ['risk', '0.16'],
          ['load', '0.10'],
          ['network', '0.08'],
          ['federation', '0.06'],
          ['rl (learned preference)', '0.04'],
          ['reliability', '0.04'],
          ['availability', '0.04'],
        ]}
      />
      <P>
        Dynamic programming backs up an expected value across stages, discounted by gamma (0.9), and adds a failure penalty
        derived from per-stage risk. The Q-learning component (<Mono>dt/policy/rl_stub.py</Mono>) turns learned values into
        one more objective and updates them from each committed plan; it persists to <Mono>sim/rl_state.json</Mono> (override
        with <Mono>FABRIC_RL_STATE</Mono>). It is an online learner, not a pretrained deep-RL agent.
      </P>
      <Callout tone="warn" title="Measured behaviour">
        On the bundled fabric the Resilient strategy currently trades deadline margin for redundancy. See{' '}
        <PageLink to="results">Measured results</PageLink>.
      </Callout>

      <H2 id="batch">Batches and the CLI</H2>
      <UL
        items={[
          <><Mono>POST /plan_batch</Mono> takes <Mono>{'{ jobs: [...], strategy, dry_run }'}</Mono> and returns one result per job.</>,
          <><Mono>python -m planner.run_plan</Mono> plans from the command line, locally or against <Mono>--remote</Mono>.</>,
        ]}
      />
    </DocPage>
  )
}

export function Chaos() {
  return (
    <DocPage
      title="Chaos and resilience"
      lead="Replay failures against the twin, watch the controllers respond, and gate changes on how the fabric holds up."
    >
      <H2 id="events">Fault events</H2>
      <P>
        A schedule is a list of events. Each has a <Mono>kind</Mono>, a start time <Mono>at_s</Mono> (seconds from the start
        of the run) and usually a <Mono>duration_s</Mono>, after which the engine reverts it automatically.
      </P>
      <DocTable
        head={['Kind', 'Targets', 'Parameters']}
        mono={[0]}
        rows={[
          ['link_degrade', 'a, b', 'speed_gbps, rtt_ms, jitter_ms, loss_pct'],
          ['link_loss_spike', 'a, b', 'loss_pct'],
          ['link_down / link_up', 'a, b', '-'],
          ['node_kill / node_recover', 'node', '-'],
          ['power_cap', 'node', 'power_cap_w'],
          ['thermal_derate', 'node', 'thermal_derate (0 to 1)'],
          ['clock_skew, packet_dup, packet_reorder', 'node', 'the matching value for the anomaly'],
          ['zone_blackout / zone_recover', 'label, value', 'every node whose label matches, for example zone: lab'],
          ['federation_partition', 'label, value, value_b', 'loss_pct, rtt_ms between the two groups'],
        ]}
      />
      <Code label="sim/topology.yaml">{`chaos:
  - { kind: link_down,      a: site-lab, b: site-datacenter, at_s: 12, duration_s: 25 }
  - { kind: node_kill,      node: srv-003,                   at_s: 18, duration_s: 12 }
  - { kind: zone_blackout,  label: zone, value: lab,         at_s: 34, duration_s: 18 }`}</Code>

      <H2 id="scenarios">Scenarios</H2>
      <P>
        A named scenario bundles a chaos list with optional <Mono>apply:</Mono> overrides to placement policies, data
        locality and links. Four ship with the repository: <Mono>wifi_brownout</Mono>, <Mono>core_link_cut</Mono>,{' '}
        <Mono>campus_edge_failover</Mono> and <Mono>multi_federation_surge</Mono> (described in{' '}
        <PageLink to="topology">Topology and links</PageLink>).
      </P>

      <H2 id="run">Running chaos</H2>
      <DocTable
        head={['Where', 'How']}
        rows={[
          ['Dashboard', 'Chaos & Faults tab, Chaos scenarios panel: pick a scenario and a speed.'],
          ['API', <Mono key="a">POST /chaos/start {'{ "scenario": "core_link_cut", "speed": 10 }'}</Mono>],
          ['CLI', <Mono key="b">python -m sim.chaos --topology sim/topology.yaml --scenario core_link_cut --speed 20 --run</Mono>],
        ]}
      />
      <DocTable
        head={['sim.chaos flag', 'Meaning']}
        mono={[0]}
        rows={[
          ['--topology', 'Topology YAML with the scenarios.'],
          ['--scenario', 'Scenario to run; omit for the default chaos list.'],
          ['--speed', 'Time compression: 20 runs the schedule twenty times faster.'],
          ['--dt', 'Post overrides straight to a running API, for example http://127.0.0.1:8080/observe.'],
          ['--overrides', 'Where to write sim/overrides.json when running offline.'],
          ['--nodes', 'Alternative node descriptor directory.'],
          ['--dry-run', 'Print the schedule without applying it.'],
          ['--run', 'Apply the events.'],
        ]}
      />
      <P>
        Over the API, <Mono>/chaos/start</Mono> returns 400 for an unknown scenario and 409 if one is already running.{' '}
        <Mono>POST /overrides/reset</Mono> stops any run and clears every injected fault.
      </P>

      <H2 id="controllers">Self-healing and the guardian</H2>
      <P>
        While chaos runs, the <b>SelfHealingController</b> promotes fallback placements for committed plans whose primary
        node degrades, emitting <Mono>fabric.selfheal.failover</Mono>, <Mono>promote</Mono> and <Mono>shadow</Mono> events.
        The <b>ResourceGuardian</b> releases stale reservations (<Mono>fabric.guardian.release</Mono>). Thresholds are in{' '}
        <PageLink to="configuration">Configuration</PageLink>.
      </P>
      <Callout tone="note" title="What is not yet measured">
        Both controllers run in every benchmark, but no ablation has isolated their individual effect on the SLA numbers.
      </Callout>

      <H2 id="gate">The resilience gate</H2>
      <P>
        <Mono>tools/ci_gate.py</Mono> chaos-tests a scheduling change before it merges. It replays fault schedules, plans the
        catalogue at several points on each timeline, and exits non-zero if worst-case SLA, p95 latency, cost or carbon
        breaches a threshold or regresses against a baseline.
      </P>
      <Code>{`python -m tools.ci_gate                              # thresholds from ci/gate.yaml
python -m tools.ci_gate --baseline ci/baseline.json  # also flag regressions
make gate-baseline                                   # record a new baseline`}</Code>
      <DocTable
        head={['ci/gate.yaml key', 'Default', 'Meaning']}
        mono={[0, 1]}
        rows={[
          ['jobs / job_limit', 'jobs / 6', 'Where to find jobs; how many to use (0 is all).'],
          ['strategies', 'greedy, resilient', 'Strategies to gate.'],
          ['scenarios', 'default, core_link_cut, gate_capacity_squeeze', 'Named scenarios plus an inline capacity-squeeze schedule.'],
          ['seed, checkpoints', '7, 6', 'Seed for learner randomness; timeline samples per scenario.'],
          ['deadline_scale', '0.28', 'Multiplies deadlines. The catalogue normally runs far inside them, so scaling turns the gate into a margin test.'],
          ['min_sla', '80.0', 'Fail if worst-case SLA drops below this percentage.'],
          ['max_regression', '2.0', 'Fail if worst SLA drops this many points against the baseline.'],
          ['max_p95_regression_pct', '10.0', 'Fail if worst p95 grows this much against the baseline.'],
          ['max_p95_ms, max_cost, max_co2', 'unset', 'Optional absolute ceilings.'],
        ]}
      />
      <P>
        Every key is also a command-line flag. <Mono>.github/workflows/resilience-gate.yml</Mono> runs the gate on pull
        requests that touch the twin, simulator, planners, nodes, jobs or gate config.
      </P>

      <H2 id="blast">Blast radius</H2>
      <P>
        The inverse of chaos replay: instead of running a known failure, it searches for the smallest set of faults that
        pushes a job past its deadline. The search is breadth-first by set size, so reported sets are minimal. It runs on a
        scratch copy of the twin loaded from disk, so the live view never flickers.
      </P>
      <Code>{`python -m sim.blast_radius --job job-vision-large --depth 2

  fragile: 3 single fault(s) break this job
    [1] zone cloudlet blacked out  ->  1455.63 ms
  Most implicated fault: zone cloudlet blacked out`}</Code>
      <DocTable
        head={['Setting', 'CLI default', 'API default and limit', 'Meaning']}
        mono={[0]}
        rows={[
          ['depth', '2', '2, at most 3', 'Largest fault-set size searched.'],
          ['branch', '12', '10, at most 20', 'Worst single faults combined into larger sets.'],
          ['max_sets', '25', '15, at most 50', 'Stop after this many breaking sets.'],
          ['strategy, deadline_ms', 'greedy, job’s own', 'same', 'Planner used and an optional deadline override.'],
        ]}
      />
      <P>
        Fault kinds it tries: <Mono>zone_blackout</Mono>, <Mono>node_down</Mono>, <Mono>link_down</Mono> and{' '}
        <Mono>thermal_derate</Mono>.
      </P>
    </DocPage>
  )
}

export function Analysis() {
  return (
    <DocPage
      title="Analysis tools"
      lead="Tools that answer questions around the twin: what if we buy hardware, how do strategies compare at scale, and what happened in that run."
    >
      <H2 id="whatif">What-if capacity planning</H2>
      <P>
        Forks the twin twice, applies a proposed change to one fork, replays the same jobs through both, and reports the
        difference in SLA, p95 latency, cost, carbon and fabric size. Planning commits reservations on the forks so jobs
        contend for capacity; without that, extra capacity would look worthless. Nothing is persisted.
      </P>
      <Code>{`curl -s -X POST localhost:8080/whatif -H 'Content-Type: application/json' \\
  -d '{"changes": {"clone_nodes": [{"from": "hpc-053", "count": 2}]}}'`}</Code>
      <DocTable
        head={['Request field', 'Meaning']}
        mono={[0]}
        rows={[
          ['changes (required)', 'Change set: clone_nodes, add_nodes, remove_nodes, patch_nodes, links, remove_links.'],
          ['faults', 'List of { kind, target, value } applied to both sides, answering "does this purchase hold up during an outage?".'],
          ['jobs', 'Job ids from the catalogue, or full job objects. Default: the catalogue.'],
          ['job_limit', 'Jobs to evaluate. Default 8, at most 25.'],
          ['strategy', 'Planner for both sides. Default greedy.'],
        ]}
      />

      <H2 id="montecarlo">Monte-Carlo sweeps</H2>
      <P>
        <Mono>sim/montecarlo.py</Mono> perturbs nodes and links randomly each trial (failures, derates, link degradation),
        plans the job, and records latency and whether the SLO was met, then prints the mean, p95 and hit rate.
      </P>
      <Code>{'python -m sim.montecarlo --nodes nodes/ --jobs jobs/jobs_10.yaml --trials 100 --seed 42 --out reports/montecarlo.csv'}</Code>
      <DocTable
        head={['Flag', 'Meaning']}
        mono={[0]}
        rows={[
          ['--nodes, --jobs, --topology', 'Inputs: node directory, job file, topology for link perturbations.'],
          ['--synthetic N', 'Generate N random jobs instead of reading a file (--synthetic-max-stages, --synthetic-profiles cpu,gpu,vision,edge,io).'],
          ['--trials, --seed', 'Number of runs and the random seed.'],
          ['--dt URL', 'Offload planning to an HTTP endpoint that returns an assignments map.'],
          ['--out', 'CSV with per-trial latency and SLO result.'],
        ]}
      />

      <H2 id="benchmark">Policy benchmark</H2>
      <Code>{'python -m tools.policy_benchmark --jobs jobs/jobs_10.yaml --strategies greedy resilient rl-markov --limit 10 --out reports/policy_metrics.png --json-out reports/policy_metrics.json'}</Code>
      <P>
        Samples up to <Mono>--limit</Mono> jobs, runs each strategy, and writes a plot plus optional JSON with mean latency,
        energy, risk, reliability and the infeasible ratio per strategy.
      </P>
      <DocTable
        head={['Helper', 'Purpose']}
        mono={[0]}
        rows={[
          ['python -m tools.export_csv --inputs a.csv b.csv --outdir reports/summary', 'Summarise Monte-Carlo CSVs: mean, p95, p99, hit rate.'],
          ['python -m tools.benchmark_srs_table', 'Reproduce the measured benchmark table used in the specification.'],
          ['python -m tools.benchmark_paper_figures', 'Regenerate the data and figures behind the Measured results page.'],
        ]}
      />

      <H2 id="bundle">Incident bundles</H2>
      <P>One zip that reproduces a run: the fabric, jobs and faults in force, plus the live snapshot, events and plans, with the commit recorded in the manifest.</P>
      <Code>{`python -m tools.bundle export --out incident.zip --note "planner picked a dead node"
python -m tools.bundle inspect incident.zip
python -m tools.bundle import incident.zip --into /tmp/replay
curl -sO -J localhost:8080/bundle        # the same, from a running API`}</Code>

      <H2 id="import">Import a twin from a cluster</H2>
      <Code>{'kubectl get nodes -o json | python -m tools.import_cluster --out nodes/ --dry-run'}</Code>
      <P>
        Maps capacity, architecture, zone labels, GPU resources and readiness into node descriptors. Kubernetes cannot
        describe power draw, thermal behaviour, storage wear or links, so those are written as documented defaults and listed
        in the summary. Flags: <Mono>--from-file</Mono>, <Mono>--out</Mono>, <Mono>--dry-run</Mono>, <Mono>--overwrite</Mono>.
      </P>
      <Callout tone="warn" title="Read the numbers accordingly">
        An imported fabric gives believable <i>placement</i>, but energy, carbon and risk figures are only as good as those
        defaults.
      </Callout>

      <H2 id="export">Standard exports</H2>
      <Code>{`curl -s localhost:8080/standards/dtdl   # Azure Digital Twins models
curl -s localhost:8080/standards/crds   # Kubernetes custom resources`}</Code>

      <H2 id="docker">Container fabric</H2>
      <P>Launch one container per node descriptor, with optional traffic shaping and GPU device requests.</P>
      <Code>{'python -m fabric_docker.launch_fabric --nodes nodes/ --topology sim/topology.yaml --network fabric-net --image ghcr.io/your-org/fabric-node:latest --prefix fabric'}</Code>
      <DocTable
        head={['Flag', 'Meaning']}
        mono={[0]}
        rows={[
          ['--image', 'Base container image.'],
          ['--image-arch ARCH=REF', 'Image override per architecture; repeatable.'],
          ['--network', 'Docker bridge network, created if missing.'],
          ['--tc', 'Traffic shaping mode: none or container.'],
          ['--force-arch', 'Ignore host versus node architecture mismatches.'],
          ['--out', 'Write the container mapping to JSON for teardown.'],
        ]}
      />
    </DocPage>
  )
}

export function Telemetry() {
  return (
    <DocPage
      title="Telemetry ingestion"
      lead="Four ways to get measurements and faults into the twin, and the exact payloads they accept."
    >
      <H2 id="paths">The four paths</H2>
      <DocTable
        head={['Path', 'Best for', 'Mechanism']}
        rows={[
          [<b key="1">Descriptor files</b>, 'Hardware that rarely changes.', 'Edit nodes/*.yaml or topology.yaml; picked up in about 0.5 s.'],
          [<b key="2">REST /observe</b>, 'Any system that can make an HTTP call.', 'POST a JSON observation.'],
          [<b key="3">MQTT bridge</b>, 'Sensors and agents that already publish to a broker.', 'sim/mqtt_bridge.py subscribes and forwards to /observe.'],
          [<b key="4">Chaos overrides</b>, 'Scripted incidents.', 'sim/chaos.py or the in-process runner writes the same payloads.'],
        ]}
      />

      <H2 id="observe">POST /observe</H2>
      <DocTable
        head={['Field', 'Meaning']}
        mono={[0]}
        rows={[
          ['action', 'apply (default) merges the changes; revert removes the named fields.'],
          ['payload.type', 'node or link.'],
          ['payload.node / payload.key', 'The node name, or the link key in the form nodeA|nodeB.'],
          ['payload.changes', 'Fields to set (apply).'],
          ['payload.fields', 'Field names to clear (revert).'],
        ]}
      />
      <H3>Apply a node observation</H3>
      <Code>{`curl -X POST http://127.0.0.1:8080/observe \\
  -H 'Content-Type: application/json' \\
  -d '{
    "action": "apply",
    "payload": {
      "type": "node",
      "node": "edge-node-3",
      "changes": { "down": false, "thermal_derate": 0.25,
                   "reliability": 0.82, "used_cpu_cores": 3.5 }
    }
  }'`}</Code>
      <H3>Degrade a link, then revert it</H3>
      <Code>{`# apply
-d '{"action":"apply","payload":{"type":"link","key":"node-a|node-b","changes":{"loss_pct":1.2}}}'
# revert
-d '{"action":"revert","payload":{"type":"link","key":"node-a|node-b","fields":["loss_pct"]}}'`}</Code>
      <DocTable
        head={['Target', 'Common fields']}
        mono={[0]}
        rows={[
          ['node', 'down, thermal_derate, power_cap_w, clock_skew_ms, packet_dup, packet_reorder, reliability, used_cpu_cores, used_mem_gb, used_gpu_vram_gb'],
          ['link', 'down, speed_gbps, rtt_ms, jitter_ms, loss_pct'],
        ]}
      />

      <H2 id="mqtt">MQTT bridge</H2>
      <P>
        A sidecar process subscribes to a broker and forwards messages to the twin’s <Mono>/observe</Mono> endpoint, so
        updates arrive the moment they are published instead of waiting for a file watcher. It uses the same payload shape
        and fire-and-forget behaviour as the chaos engine, so nothing in the API changes.
      </P>
      <Code>{`pip install -r requirements-mqtt.txt
python -m sim.mqtt_bridge --broker-host localhost --broker-port 1883 \\
    --topic 'fabric/#' --dt http://127.0.0.1:8080/observe`}</Code>
      <DocTable
        head={['Flag', 'Default', 'Meaning']}
        mono={[0, 1]}
        rows={[
          ['--broker-host', 'localhost', 'MQTT broker host.'],
          ['--broker-port', '1883', 'MQTT broker port.'],
          ['--topic', 'fabric/#', 'Subscription filter.'],
          ['--dt', 'http://127.0.0.1:8080/observe', 'Endpoint to forward to.'],
          ['-v, --verbose', 'off', 'Log every message.'],
        ]}
      />
      <H3>Topic and payload convention</H3>
      <DocTable
        head={['Topic', 'Becomes']}
        mono={[0]}
        rows={[
          ['fabric/<node_name>/telemetry', 'A node override.'],
          ['fabric/<a>__<b>/telemetry', 'A link override between nodes a and b.'],
        ]}
      />
      <Code label="messages">{`# apply (default)
mosquitto_pub -t fabric/edge-node-3/telemetry -m '{"changes": {"down": true}}'
# revert
mosquitto_pub -t fabric/edge-node-3/telemetry -m '{"action": "revert", "fields": ["down"]}'`}</Code>
      <P>
        Malformed JSON or a topic that does not match the convention is logged and ignored; it never stops the subscriber.
        The bridge needs <Mono>paho-mqtt</Mono>, which is an optional dependency listed in{' '}
        <Mono>requirements-mqtt.txt</Mono>. Why MQTT and not Kafka: it needs no JVM broker, only something small like
        mosquitto.
      </P>

      <H2 id="noise">Background noise</H2>
      <P>
        To emulate ordinary variance, set <Mono>FABRIC_ENABLE_NOISE=1</Mono> before starting the API. A
        background injector then jitters node and link values every <Mono>FABRIC_NOISE_INTERVAL</Mono> seconds (7.5 by
        default), scaled by <Mono>FABRIC_NOISE_NODE_JITTER</Mono> (0.12) and <Mono>FABRIC_NOISE_LINK_JITTER</Mono> (0.2).
        It is off by default, and off in the production service.
      </P>
      <Callout tone="note">
        Whichever path you use, the result is visible within moments in <PageLink to="dashboard">the dashboard</PageLink> and
        as <Mono>fabric.node.observe</Mono> or <Mono>fabric.link.observe</Mono> events.
      </Callout>
    </DocPage>
  )
}
