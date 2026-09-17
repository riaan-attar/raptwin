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
