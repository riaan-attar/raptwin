# Worklog — overnight session, 18 Sep 2026

Running log of major tasks and changes. Newest section at the bottom.

## Baseline

- `3858de0` — VPS deployment tooling (last commit before this session)

## 1. Ship and deploy the management UI ✅

| Commit | What |
| --- | --- |
| `4229b01` | Manage nodes, links, jobs and chaos from the dashboard (API + state + frontend + 15 tests) |
| `2bd87a5` | `run.sh` — start API and dashboard together |
| `5b6805d` | Paper draft, graphify notes, `future.md` research backlog |

- Pushed to `github.com/riaan-attar/raptwin` (`main`).
- Deployed to the VPS with `./deploy/deploy.sh`; verified live:
  `/api/health`, `/api/topology`, `/api/chaos`, `/api/plans`, `/api/jobs` all 200,
  snapshot reports 100 nodes / 7 links / 7 federations, `raptwin-api` active.
- Also fixed: `.gitignore`'s Python `lib/` rule had been excluding `web/src/lib/`,
  so `format.ts`, `topologyModel.ts` and `demoJob.ts` were never pushed and a fresh
  clone could not build the frontend.

## 2. New modules (in progress)

Planned order, highest value first:

1. Cost and carbon accounting
2. Chaos-as-CI regression gate
3. Blast-radius finder
4. Incident bundles
5. What-if branches
6. Import a twin from a real cluster

Status is recorded below as each lands.

### 2.1 Cost and carbon accounting ✅ — `dt/economics.py`

Every plan now reports money and CO2, and two new strategies optimise for them.

- `GET /economics` exposes the prices in force; `/snapshot` carries currency and
  grid intensity; every `/plan` response gains `cost_total`, `cost_breakdown`
  (compute / energy / egress), `co2_g`, `energy_kwh` and per-stage `cost`.
- New strategies: **`cheapest-cost`** and **`greenest`** (also in the dashboard's
  strategy dropdown). Dashboard shows plan cost and CO2 in Overview, Recent Plans
  and the plan detail strip.
- Carbon intensity and electricity price can vary per zone via
  `defaults.energy.zones.<zone>`, so a solar site is not charged like a coal grid.
- 14 tests in `tests/test_economics.py`, including hand-calculated costs
  (1 core-hour, 1 kWh) so the arithmetic is pinned.

**Two things worth knowing, found while building this:**

1. **`rl-markov` plans cost ~75x more than `greedy` on the sample fabric**
   (₹0.894 vs ₹0.012 for the same job). It spreads stages across sites, and the
   egress bill dominates. Worth investigating — it may be a genuine defect in the
   MDP planner's network penalty, and it is exactly the kind of finding the paper
   could report.
2. **Cost barely discriminates between nodes, by construction.** Pricing is per
   *requested* resource (16 cores + 32 GB = ₹57.6/hr on every node), so
   `cheapest-cost` only bites on accelerator surcharge, cross-site egress and
   per-zone electricity. Carbon does discriminate well (12.6-18.4 gCO2/hr across
   candidates), because it follows each node's real power draw. If you want cost
   to drive placement harder, node-specific rates belong in the node descriptors.

Scoring uses per-hour *rates*, not absolute cost: a 300 ms stage rents hardware
for 300 ms, so absolute cost is ~0 for every candidate and cannot discriminate at
any weight. Weights (`FABRIC_COST_WEIGHT`, `FABRIC_CARBON_WEIGHT`, default 25)
read as "ms of latency traded per unit of currency, or per gram of CO2, per hour".

### 2.2 Chaos-as-CI resilience gate ✅ — `tools/ci_gate.py`

Tests a *scheduling change* before it merges, the way unit tests guard code.

```bash
python -m tools.ci_gate                                  # uses ci/gate.yaml
python -m tools.ci_gate --baseline ci/baseline.json      # regression mode
```

- Replays fault schedules against the twin, plans the job catalogue at each point
  on the timeline, and fails (exit 1) if worst-case SLA, p95 latency, cost or CO2
  breaches a threshold — or regresses against `ci/baseline.json`.
- Thresholds live in `ci/gate.yaml`; every one is also a CLI flag.
- `.github/workflows/resilience-gate.yml` runs it on PRs touching `dt/`, `sim/`,
  `planner/`, `nodes/`, `jobs/`, writes a markdown summary to the run page and
  uploads the report. CI needs only `pip install pyyaml` (verified in a clean venv,
  also on Python 3.14).
- Deterministic: fixed schedules, dry-run planning, `--seed` for bandit/RL. A test
  asserts two runs produce byte-identical results, and another asserts the gate
  leaves `nodes/` and `topology.yaml` untouched.
- 19 tests in `tests/test_ci_gate.py`, including one that keeps `ci/gate.yaml` and
  `ci/baseline.json` in step so CI never compares apples to oranges.

**Calibration was the real work here, and it exposed three things:**

1. **The bundled chaos scenarios barely dent this fabric.** With 100 nodes and
   deadlines ~3.5x actual latency, SLA compliance stayed at 100% even after
   blacking out 66 of 100 nodes. A gate that always passes is worthless, so the
   gate ships its own harsher inline scenario (`gate_capacity_squeeze`) and a
   `deadline_scale` knob (0.28) that turns it into a margin test. Latency, not
   SLA, is the sensitive signal here: greedy's p95 moves 1260 → 1457 ms under
   the squeeze while SLA never budges.
2. **`resilient` is materially slower than `greedy`** — p95 1720 vs 1260 ms, and
   at a tightened deadline it meets 83% of SLAs where greedy meets 100%. It buys
   fallback coverage with latency. That trade is worth stating explicitly in the
   paper rather than presenting Resilient as a strict improvement.
3. **My first sampling design measured the wrong thing.** Checkpointing evenly
   across the schedule landed mostly on *revert* events, which heal damage, so it
   reported recovery instead of peak damage. It now samples only after damage.
