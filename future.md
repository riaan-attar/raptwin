# Future work — research validation backlog

Parked for later validation. Written 2026-09-18, against commit `3858de0` plus the
uncommitted management-UI work.

---

## 1. Blocker: the paper's results are not produced by this codebase

`paper/main.tex` reports experiments the repo cannot currently run. Verify each of
these before submitting anywhere.

| Claim in the paper | What the repo actually contains |
| --- | --- |
| RL-Markov planner as "MADRL-HTRCS", Actor-Critic, convergence over 4,000 episodes | `dt/policy/rl_stub.py` is a tabular Q-learning scaffold; its docstring says it "does NOT run an environment loop". No `DDQN`, `MADRL`, `actor-critic`, `episode` or `convergence` anywhere in the Python sources. |
| `figures/reward_convergence.pdf` — learning curves for 4 policies | Shows Greedy and Cheapest-Energy "learning" across 6,000 training episodes. Both are stateless heuristics and cannot have a learning curve. The figure also renders the "convergence 4000 iter." annotation underneath the legend box. |
| Table 1 (mean/p95 JCT, energy, SLA hit rate), DDQN-HTRCS baseline | `plans/montecarlo.json` is empty and not valid JSON. `tools/policy_benchmark.py` aggregates latency and `energy_avg` only — no SLA hit rate, no p95/p99, no DDQN baseline exists to compare against. |
| "1,000 automated Monte-Carlo trial sweeps", 94.2% SLA compliance under chaos | `sim/montecarlo.py` can run trials, but no stored run, seed, or report backs these figures. |
| JCT reductions of 58.3% / 64.1%, 31.4% degradation under negative Δf | No measurement pipeline produces these numbers. |

**Action:** either generate these numbers for real (sections 2–3 below) or rewrite the
claims around what is actually implemented — the bandit policy, the MDP planner, the
chaos engine, and the self-healing controllers, which are real and worth reporting.

---

## 2. Three bets that would make the work genuinely unique

### 2.1 Validate the twin against real hardware (highest value)

`fabric_docker/launch_fabric.py` already launches containers and shapes links with `tc`.
Run the same DAG twice — once as a twin prediction, once on real containers — and report
the error distribution (MAPE, p95 error) for JCT, energy and per-stage latency.

Why it is unique: none of the cited DT or chaos papers report fidelity validation for a
chaos-capable digital twin. "Our twin predicts job completion time within X%" is a
defensible headline claim, and it converts the paper's Δf narrative from an assertion
into a measurement.

### 2.2 Adversarial chaos search

Today chaos replays hand-written schedules. Invert it: search for the *minimal* fault set
that breaks a job's SLA under a given policy — a fuzzer for topologies. The pieces exist
(chaos injection, Monte-Carlo, dry-run evaluation). Output reads: "this fabric survives
any single link cut, but these two together miss the deadline."

### 2.3 Counterfactual replay

CloudEvents are already emitted for every state change. Record them durably, then replay a
past incident under a different policy: "what would the Resilient planner have done during
last Tuesday's outage?" Turns the event bus from a UI feed into a research instrument.
Needs a real recorder first — `dt/events.py` keeps only the last 256 events in memory.

---

## 3. Cheaper wins that raise credibility

- **One command regenerates every figure and table**, stamping seed, git SHA and config
  hash into the output. Reproducible artifacts are what make reviewers trust a tool paper.
- **Score the predictions.** `dt/predict.py` forecasts utilization and failure windows, but
  nothing ever checks them against outcomes. Log forecast-vs-realized and report calibration.
- **Implement the RL loop or drop the claim.** `RLPolicy.record_transition` exists and
  `sim/montecarlo.py` can act as the environment. Otherwise reframe honestly.
- **Publish the fabric as a benchmark.** 100 heterogeneous nodes plus named chaos scenarios
  is a reusable artifact others could cite.

---

## 4. Known defects worth fixing before publishing

- **Link profiles are ignored on load.** `dt/state.py::_load_topology_locked` never resolves
  a link's `profile:` into its metrics, so `IB-400G` is planned as a default 10 Gbps / 1 ms
  link. Every latency number the planner produces for profile-only links is wrong. Fixing it
  changes planner results, so re-run any benchmark afterwards.
- **`schemas/job.schema.yaml` does not parse** (YAML error at line 179), so job validation is
  silently unavailable.
- **25 of 100 `nodes/*.yaml` fail `schemas/node.schema.yaml`** — mostly
  `storage.interface_gen: null` and arch/microarchitecture mismatches (amd64 nodes with ARM
  Neoverse CPUs, an SBC with an H100). The generator in `sim/gen_nodes.py` produces
  implausible pairings.
- **Pricing and carbon data are dead config.** `sim/topology.yaml` defines `price_per_kwh`,
  `grid_co2_g_per_kwh` and an INR currency that `dt/cost_model.py` never reads.
