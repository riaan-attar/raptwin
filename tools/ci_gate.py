#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
tools/ci_gate.py — fail a build when a scheduling change loses resilience.

Chaos tools test running infrastructure. This tests a *policy change* before it
merges: replay named fault schedules against the twin, plan the job catalogue at
every point on the timeline, and assert the worst case still clears your
thresholds.

    # local
    python -m tools.ci_gate --scenarios core_link_cut --min-sla 90

    # in CI, against a recorded baseline
    python -m tools.ci_gate --baseline reports/gate-main.json --max-regression 2

Exit codes: 0 pass, 1 gate failed, 2 bad usage.

Determinism
-----------
Chaos schedules are fixed in topology.yaml, planning runs with `dry_run=True`
(no reservations, no shared mutable state), and `--seed` seeds `random` for the
bandit/RL policies. The same commit and seed therefore produce the same verdict,
which is what makes a threshold meaningful in CI.

Nothing is written to nodes/ or topology.yaml: faults are applied in memory via
DTState.apply_observation, exactly as the dashboard's chaos runner does.
"""

from __future__ import annotations

import argparse
import json
import os
import random
import statistics
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import yaml  # noqa: E402

from dt.cost_model import CostModel  # noqa: E402
from dt.economics import annotate_plan  # noqa: E402
from dt.policy.bandit import BanditPolicy  # noqa: E402
from dt.policy.greedy import GreedyPlanner  # noqa: E402
from dt.policy.mdp import MarkovPlanner  # noqa: E402
from dt.policy.resilient import FederatedPlanner  # noqa: E402
from dt.policy.rl_stub import RLPolicy  # noqa: E402
from dt.state import DTState, safe_float  # noqa: E402
from sim.chaos import ChaosEngine, OverridesStore, collect_chaos_events  # noqa: E402

DEFAULT_STRATEGIES = ("greedy", "resilient")
DEFAULT_CONFIG = ROOT / "ci" / "gate.yaml"


# --------------------------------------------------------------------------
# planners
# --------------------------------------------------------------------------


def build_planner(name: str, state: DTState, cm: CostModel):
    """Same strategy names the API accepts, built against a throwaway state."""
    norm = (name or "greedy").strip().lower()
    base = {"risk_weight": 10.0, "energy_weight": 0.0, "prefer_locality_bonus_ms": 0.5,
            "require_format_match": False}
    if norm in {"resilient", "network-aware", "federated", "fault-tolerant", "balanced"}:
        return FederatedPlanner(state, cm), norm
    if norm in {"rl-markov", "mdp", "markov", "rl"}:
        return MarkovPlanner(state, cm, rl_policy=RLPolicy(persist_path=None), gamma=0.92,
                             failure_penalty=10.0, redundancy=3), None
    if norm in {"bandit", "bandit-greedy"}:
        return GreedyPlanner(state, cm, bandit=BanditPolicy(persist_path=None), cfg=base), None
    if norm in {"cheapest-energy", "energy"}:
        return GreedyPlanner(state, cm, cfg={**base, "energy_weight": 0.1}), None
    if norm in {"cheapest-cost", "cost"}:
        return GreedyPlanner(state, cm, cfg={**base, "cost_weight": 25.0}), None
    if norm in {"greenest", "low-carbon", "carbon"}:
        return GreedyPlanner(state, cm, cfg={**base, "carbon_weight": 25.0}), None
    return GreedyPlanner(state, cm, cfg=base), None


def plan_once(planner, mode: Optional[str], job: Dict[str, Any]) -> Dict[str, Any]:
    if mode is not None:  # FederatedPlanner takes the mode as an argument
        return planner.plan_job(job, dry_run=True, mode=mode)
    return planner.plan_job(job, dry_run=True)


# --------------------------------------------------------------------------
# timeline replay
# --------------------------------------------------------------------------


class _MemoryStore(OverridesStore):
    """Applies chaos to a DTState in memory — no overrides.json, no HTTP."""

    def __init__(self, state: DTState):
        self.path = Path()
        self.dt_endpoint = None
        self.state = {"links": {}, "nodes": {}}
        self._dt = state

    def _write(self):
        pass

    def _post_dt(self, payload: Dict[str, Any], action: str):
        self._dt.apply_observation({"action": action, "payload": payload})


def _silent_engine(state: DTState) -> ChaosEngine:
    engine = ChaosEngine(
        _MemoryStore(state),
        speed=1.0,
        verbose=False,
        nodes_index={n: {"labels": (v.get("labels") or {})} for n, v in state.nodes_by_name.items()},
    )
    return engine


def resolve_scenario(entry: Any, topology: Dict[str, Any]) -> Tuple[str, Dict[str, Any]]:
    """Accept either a scenario name from topology.yaml or an inline definition.

    Inline scenarios keep a gate self-contained: the bundled schedules were
    written to demo the dashboard and do not stress a 100-node fabric hard
    enough to move SLA, so a gate needs to bring its own.
    """
    if isinstance(entry, str):
        return entry, topology
    if isinstance(entry, dict) and entry.get("name"):
        name = str(entry["name"])
        merged = dict(topology)
        merged["scenarios"] = list(topology.get("scenarios") or []) + [
            {"name": name, "chaos": entry.get("chaos") or []}
        ]
        if entry.get("replace_base_chaos", True):
            merged["chaos"] = []
        return name, merged
    raise SystemExit(f"bad scenario entry: {entry!r}")


def evaluate_scenario(
    *,
    state: DTState,
    cm: CostModel,
    jobs: Sequence[Dict[str, Any]],
    strategy: str,
    scenario: Optional[str],
    topology: Dict[str, Any],
    checkpoints: int,
) -> Dict[str, Any]:
    """Replay a fault schedule, planning every job at each checkpoint.

    Wall-clock is skipped: events are applied in schedule order, so a 60 s
    scenario is evaluated in milliseconds and always in the same order.
    """
    try:
        schedule = collect_chaos_events(topology, scenario)
    except ValueError as exc:
        known = [sc.get("name") for sc in (topology.get("scenarios") or []) if sc.get("name")]
        raise SystemExit(
            f"{exc} Known scenarios: {', '.join(known) or 'none'}. "
            "Inline gate scenarios live in the config file, so passing one by "
            "name with --scenarios will not find it."
        ) from exc
    engine = _silent_engine(state)
    planner, mode = build_planner(strategy, state, cm)

    # Sample after damage, not after healing: a revert event undoes a fault, so
    # checkpointing on reverts measures recovery and hides the peak. Only the
    # apply events are sampled (plus the end state), capped for runtime.
    damage = [i for i, e in enumerate(schedule) if not e.kind.startswith("__revert__::")]
    if checkpoints > 0 and len(damage) > checkpoints:
        step = len(damage) / float(checkpoints)
        damage = sorted({damage[min(int(i * step), len(damage) - 1)] for i in range(checkpoints)})
    indices = set(damage) | ({len(schedule) - 1} if schedule else set())

    samples: List[Dict[str, Any]] = []

    def take_sample(label: str, at_s: float) -> None:
        met = 0
        latencies: List[float] = []
        costs: List[float] = []
        co2: List[float] = []
        infeasible = 0
        for job in jobs:
            plan = plan_once(planner, mode, job)
            annotate_plan(state, job, plan)
            latency = safe_float(plan.get("latency_ms"), float("inf"))
            deadline = safe_float(job.get("deadline_ms"), 0.0)
            ok = not plan.get("infeasible") and latency == latency and latency != float("inf")
            if ok and deadline > 0:
                ok = latency <= deadline
            if plan.get("infeasible"):
                infeasible += 1
            if ok:
                met += 1
            if latency == latency and latency != float("inf"):
                latencies.append(latency)
            if plan.get("cost_total") is not None:
                costs.append(float(plan["cost_total"]))
            if plan.get("co2_g") is not None:
                co2.append(float(plan["co2_g"]))
        samples.append(
            {
                "label": label,
                "at_s": round(at_s, 3),
                "jobs": len(jobs),
                "met": met,
                "infeasible": infeasible,
                "sla_pct": round(100.0 * met / max(1, len(jobs)), 2),
                "p95_ms": round(_percentile(latencies, 95), 2) if latencies else None,
                "mean_ms": round(statistics.fmean(latencies), 2) if latencies else None,
                "cost_total": round(sum(costs), 6) if costs else None,
                "co2_g": round(sum(co2), 4) if co2 else None,
            }
        )

    take_sample("baseline", 0.0)
    for i, event in enumerate(schedule):
        engine.apply_event(event)
        if i in indices:
            kind = event.kind.replace("__revert__::", "revert ")
            take_sample(f"after {kind}", event.at_s)

    sla_values = [s["sla_pct"] for s in samples]
    p95_values = [s["p95_ms"] for s in samples if s["p95_ms"] is not None]
    return {
        "scenario": scenario or "default",
        "strategy": strategy,
        "events": len(schedule),
        "samples": samples,
        "worst_sla_pct": min(sla_values) if sla_values else 0.0,
        "mean_sla_pct": round(statistics.fmean(sla_values), 2) if sla_values else 0.0,
        "worst_p95_ms": max(p95_values) if p95_values else None,
        "peak_cost": max((s["cost_total"] for s in samples if s["cost_total"] is not None), default=None),
        "peak_co2_g": max((s["co2_g"] for s in samples if s["co2_g"] is not None), default=None),
    }


def _percentile(values: Sequence[float], pct: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    if len(ordered) == 1:
        return ordered[0]
    k = (len(ordered) - 1) * (pct / 100.0)
    lo, hi = int(k), min(int(k) + 1, len(ordered) - 1)
    return ordered[lo] + (ordered[hi] - ordered[lo]) * (k - lo)


# --------------------------------------------------------------------------
# job catalogue
# --------------------------------------------------------------------------


def load_jobs(paths: Sequence[str], limit: int, deadline_scale: float = 1.0) -> List[Dict[str, Any]]:
    """Load job descriptors, optionally tightening their deadlines.

    `deadline_scale` is the gate's sensitivity knob. The bundled catalogue runs
    at roughly a third of its stated deadlines, so SLA compliance stays at 100%
    even with two thirds of the fabric blacked out; scaling deadlines down turns
    the gate into a margin test ("does it still hold at 35% of the budget?").
    """
    jobs: List[Dict[str, Any]] = []
    for raw in paths:
        path = Path(raw)
        if not path.is_absolute():
            path = ROOT / path
        if path.is_dir():
            files = sorted(path.glob("*.y*ml"))
        else:
            files = [path]
        for f in files:
            content = yaml.safe_load(f.read_text(encoding="utf-8"))
            if isinstance(content, dict) and isinstance(content.get("jobs"), list):
                jobs.extend([j for j in content["jobs"] if isinstance(j, dict)])
            elif isinstance(content, list):
                jobs.extend([j for j in content if isinstance(j, dict)])
            elif isinstance(content, dict):
                jobs.append(content)
    if limit > 0:
        jobs = jobs[:limit]
    if deadline_scale and deadline_scale != 1.0:
        scaled = []
        for job in jobs:
            ddl = safe_float(job.get("deadline_ms"), 0.0)
            scaled.append({**job, "deadline_ms": round(ddl * deadline_scale, 3)} if ddl > 0 else job)
        jobs = scaled
    return jobs


# --------------------------------------------------------------------------
# verdict
# --------------------------------------------------------------------------


def check_thresholds(
    results: List[Dict[str, Any]],
    *,
    min_sla: float,
    max_p95_ms: Optional[float],
    max_cost: Optional[float],
    max_co2: Optional[float],
    baseline: Optional[Dict[str, Any]],
    max_regression: float,
    max_p95_regression_pct: Optional[float] = None,
) -> List[str]:
    failures: List[str] = []
    base_index: Dict[Tuple[str, str], Dict[str, Any]] = {}
    if baseline:
        for entry in baseline.get("results", []):
            base_index[(entry.get("scenario"), entry.get("strategy"))] = entry

    for r in results:
        who = f"{r['strategy']} / {r['scenario']}"
        if r["worst_sla_pct"] < min_sla:
            failures.append(
                f"{who}: worst SLA {r['worst_sla_pct']:.1f}% < {min_sla:.1f}% "
                f"(at '{_worst_label(r)}')"
            )
        if max_p95_ms is not None and r["worst_p95_ms"] is not None and r["worst_p95_ms"] > max_p95_ms:
            failures.append(f"{who}: worst p95 {r['worst_p95_ms']:.0f} ms > {max_p95_ms:.0f} ms")
        if max_cost is not None and r["peak_cost"] is not None and r["peak_cost"] > max_cost:
            failures.append(f"{who}: peak cost {r['peak_cost']:.4f} > {max_cost:.4f}")
        if max_co2 is not None and r["peak_co2_g"] is not None and r["peak_co2_g"] > max_co2:
            failures.append(f"{who}: peak CO2 {r['peak_co2_g']:.3f} g > {max_co2:.3f} g")

        prior = base_index.get((r["scenario"], r["strategy"]))
        if prior:
            drop = float(prior.get("worst_sla_pct", 0.0)) - r["worst_sla_pct"]
            if drop > max_regression:
                failures.append(
                    f"{who}: worst SLA regressed {drop:.1f} points "
                    f"({prior.get('worst_sla_pct')}% → {r['worst_sla_pct']}%), "
                    f"limit {max_regression:.1f}"
                )
            # Latency is the sensitive signal on fabrics with generous deadlines,
            # so it gets its own regression budget.
            prior_p95 = prior.get("worst_p95_ms")
            if (
                max_p95_regression_pct is not None
                and prior_p95
                and r["worst_p95_ms"] is not None
            ):
                grew = 100.0 * (r["worst_p95_ms"] - float(prior_p95)) / float(prior_p95)
                if grew > max_p95_regression_pct:
                    failures.append(
                        f"{who}: worst p95 regressed {grew:.1f}% "
                        f"({float(prior_p95):.0f} → {r['worst_p95_ms']:.0f} ms), "
                        f"limit {max_p95_regression_pct:.1f}%"
                    )
    return failures


def _worst_label(result: Dict[str, Any]) -> str:
    worst = min(result["samples"], key=lambda s: s["sla_pct"], default=None)
    return worst["label"] if worst else "?"


def render_markdown(report: Dict[str, Any]) -> str:
    lines = [
        f"## RAP Twin resilience gate — {'PASS' if report['passed'] else 'FAIL'}",
        "",
        f"`{report['commit']}` · seed {report['seed']} · {report['jobs']} jobs · "
        f"deadline×{report['deadline_scale']} · {report['duration_s']:.1f}s",
        "",
        "| Strategy | Scenario | Worst SLA | Mean SLA | Worst p95 | Peak cost | Peak CO₂ |",
        "| --- | --- | --- | --- | --- | --- | --- |",
    ]
    for r in report["results"]:
        lines.append(
            f"| {r['strategy']} | {r['scenario']} | {r['worst_sla_pct']:.1f}% | "
            f"{r['mean_sla_pct']:.1f}% | "
            f"{'—' if r['worst_p95_ms'] is None else format(r['worst_p95_ms'], '.0f') + ' ms'} | "
            f"{'—' if r['peak_cost'] is None else format(r['peak_cost'], '.4f')} | "
            f"{'—' if r['peak_co2_g'] is None else format(r['peak_co2_g'], '.3f') + ' g'} |"
        )
    if report["failures"]:
        lines += ["", "### Failures", ""]
        lines += [f"- {f}" for f in report["failures"]]
    return "\n".join(lines) + "\n"


# --------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------


def build_argparser() -> argparse.ArgumentParser:
    ap = argparse.ArgumentParser(
        description="Fail the build when a scheduling change loses resilience."
    )
    ap.add_argument("--config", default=str(DEFAULT_CONFIG), help="YAML defaults (optional)")
    ap.add_argument("--jobs", nargs="*", help="job files or directories")
    ap.add_argument("--job-limit", type=int, help="cap the catalogue (0 = all)")
    ap.add_argument("--strategies", nargs="*", help="strategy names to gate")
    ap.add_argument(
        "--scenarios",
        nargs="*",
        help="scenario names from topology.yaml; 'default' means the top-level chaos list",
    )
    ap.add_argument("--nodes-dir", help="node descriptors (default: nodes/)")
    ap.add_argument("--topology", help="topology file (default: sim/topology.yaml)")
    ap.add_argument("--seed", type=int, help="seed for bandit/RL randomness")
    ap.add_argument("--checkpoints", type=int, help="max timeline samples per scenario")
    ap.add_argument("--min-sla", type=float, help="fail below this worst-case SLA %%")
    ap.add_argument("--max-p95-ms", type=float, help="fail above this worst p95 latency")
    ap.add_argument("--max-cost", type=float, help="fail above this peak catalogue cost")
    ap.add_argument("--max-co2", type=float, help="fail above this peak catalogue CO2 (g)")
    ap.add_argument("--baseline", help="previous report JSON to compare against")
    ap.add_argument("--max-regression", type=float, help="allowed worst-SLA drop, in points")
    ap.add_argument(
        "--max-p95-regression-pct", type=float, help="allowed worst-p95 growth vs --baseline, in %%"
    )
    ap.add_argument(
        "--deadline-scale",
        type=float,
        help="multiply every job deadline by this (0.35 = hold at a third of the budget)",
    )
    ap.add_argument("--json-out", help="write the full report here")
    ap.add_argument("--md-out", help="write a markdown summary here (CI job summary)")
    ap.add_argument("--quiet", action="store_true")
    return ap


DEFAULTS: Dict[str, Any] = {
    "jobs": ["jobs"],
    "job_limit": 6,
    "strategies": list(DEFAULT_STRATEGIES),
    "scenarios": ["default"],
    "seed": 7,
    "checkpoints": 6,
    "min_sla": 80.0,
    "max_p95_ms": None,
    "max_cost": None,
    "max_co2": None,
    "max_regression": 2.0,
    "max_p95_regression_pct": None,
    "deadline_scale": 1.0,
}


def resolve_settings(args: argparse.Namespace) -> Dict[str, Any]:
    settings = dict(DEFAULTS)
    config_path = Path(args.config)
    if config_path.exists():
        loaded = yaml.safe_load(config_path.read_text(encoding="utf-8")) or {}
        if not isinstance(loaded, dict):
            raise SystemExit(f"{config_path}: expected a mapping")
        settings.update({k: v for k, v in loaded.items() if k in settings})
    for key in settings:
        value = getattr(args, key, None)
        if value not in (None, [], ()):
            settings[key] = value
    return settings


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = build_argparser().parse_args(argv)
    cfg = resolve_settings(args)
    started = time.time()
    random.seed(int(cfg["seed"]))

    jobs = load_jobs(cfg["jobs"], int(cfg["job_limit"]), float(cfg["deadline_scale"]))
    if not jobs:
        print("no jobs found — nothing to gate", file=sys.stderr)
        return 2

    nodes_dir = args.nodes_dir or str(ROOT / "nodes")
    topology_path = args.topology or str(ROOT / "sim" / "topology.yaml")
    topology = yaml.safe_load(Path(topology_path).read_text(encoding="utf-8")) or {}

    baseline = None
    if args.baseline and Path(args.baseline).exists():
        baseline = json.loads(Path(args.baseline).read_text(encoding="utf-8"))

    results: List[Dict[str, Any]] = []
    for scenario_entry in cfg["scenarios"]:
        scenario, scenario_topology = resolve_scenario(scenario_entry, topology)
        for strategy in cfg["strategies"]:
            # A fresh state per combination: chaos from one run must not leak
            # into the next, and dry-run planning leaves nothing else behind.
            state = DTState(
                nodes_dir=nodes_dir,
                topology_path=topology_path,
                overrides_path=str(ROOT / "sim" / "_gate_overrides.json"),
                auto_start_watchers=False,
            )
            try:
                results.append(
                    evaluate_scenario(
                        state=state,
                        cm=CostModel(state),
                        jobs=jobs,
                        strategy=strategy,
                        scenario=None if scenario in ("default", None) else scenario,
                        topology=scenario_topology,
                        checkpoints=int(cfg["checkpoints"]),
                    )
                )
            finally:
                state.stop()
            if not args.quiet:
                r = results[-1]
                print(
                    f"  {r['strategy']:16s} {r['scenario']:22s} "
                    f"worst SLA {r['worst_sla_pct']:6.1f}%  mean {r['mean_sla_pct']:6.1f}%"
                )

    failures = check_thresholds(
        results,
        min_sla=float(cfg["min_sla"]),
        max_p95_ms=cfg["max_p95_ms"],
        max_cost=cfg["max_cost"],
        max_co2=cfg["max_co2"],
        baseline=baseline,
        max_regression=float(cfg["max_regression"]),
        max_p95_regression_pct=cfg["max_p95_regression_pct"],
    )

    report = {
        "passed": not failures,
        "commit": os.environ.get("GITHUB_SHA", _git_sha()),
        "seed": int(cfg["seed"]),
        "jobs": len(jobs),
        "job_ids": [j.get("id") for j in jobs],
        "strategies": list(cfg["strategies"]),
        "scenarios": list(cfg["scenarios"]),
        "deadline_scale": float(cfg["deadline_scale"]),
        "thresholds": {
            "min_sla": cfg["min_sla"],
            "max_p95_regression_pct": cfg["max_p95_regression_pct"],
            "max_p95_ms": cfg["max_p95_ms"],
            "max_cost": cfg["max_cost"],
            "max_co2": cfg["max_co2"],
            "max_regression": cfg["max_regression"],
        },
        "baseline": args.baseline if baseline else None,
        "duration_s": round(time.time() - started, 2),
        "results": results,
        "failures": failures,
    }

    if args.json_out:
        out = Path(args.json_out)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(report, indent=2), encoding="utf-8")
    if args.md_out:
        out = Path(args.md_out)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(render_markdown(report), encoding="utf-8")

    # GitHub renders this on the workflow run page.
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as fh:
            fh.write(render_markdown(report))

    if not args.quiet:
        print()
        if failures:
            print("Resilience gate FAILED:")
            for f in failures:
                print(f"  ✗ {f}")
        else:
            print(f"Resilience gate passed ({report['duration_s']:.1f}s)")
    return 1 if failures else 0


def _git_sha() -> str:
    head = ROOT / ".git" / "HEAD"
    try:
        ref = head.read_text(encoding="utf-8").strip()
        if ref.startswith("ref: "):
            return (ROOT / ".git" / ref[5:]).read_text(encoding="utf-8").strip()[:12]
        return ref[:12]
    except Exception:
        return "unknown"


if __name__ == "__main__":
    raise SystemExit(main())
