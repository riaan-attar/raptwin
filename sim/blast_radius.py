#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
sim/blast_radius.py — find the smallest fault set that breaks a job.

Chaos replay answers "what happens if I inject the faults I thought of?".
This inverts it: search the fault space for the *minimal* combinations that
push a job past its deadline, and report them.

    python -m sim.blast_radius --job job-vision-large --strategy greedy
    python -m sim.blast_radius --job job-cv-no-gpu --depth 3 --json-out bl.json

Reads as: "survives every single fault; these 3 pairs miss the deadline; the
fault that appears in most breaking sets is a blackout of zone rackB."

How the search works
--------------------
Breadth-first over fault-set size, so any set reported is minimal by
construction — no subset of it already breaks the job (those are pruned).
Candidates are ranked by how much damage they do alone, and only the worst
`--branch` of them are combined, which keeps depth 2-3 tractable on a
100-node fabric.

Faults are applied to a live DTState with apply_observation and reverted the
same way, so nothing touches nodes/ or topology.yaml, and one state object
serves thousands of evaluations.
"""

from __future__ import annotations

import argparse
import itertools
import json
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Set, Tuple

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import yaml  # noqa: E402

from dt.cost_model import CostModel  # noqa: E402
from dt.economics import annotate_plan  # noqa: E402
from dt.planners import build_planner, plan_once  # noqa: E402
from dt.state import DTState, safe_float  # noqa: E402

INF = float("inf")


# --------------------------------------------------------------------------
# faults
# --------------------------------------------------------------------------


@dataclass(frozen=True)
class Fault:
    """One injectable failure, expressed the way /observe expects it."""

    kind: str          # node_down | link_down | zone_blackout | thermal_derate | link_degrade
    target: str        # node name, link key, or zone value
    value: float = 0.0

    @property
    def label(self) -> str:
        if self.kind == "zone_blackout":
            return f"zone {self.target} blacked out"
        if self.kind == "node_down":
            return f"node {self.target} down"
        if self.kind == "link_down":
            return f"link {self.target} down"
        if self.kind == "thermal_derate":
            return f"node {self.target} derated {self.value:.0%}"
        if self.kind == "link_degrade":
            return f"link {self.target} at {self.value:.0f}% loss"
        return f"{self.kind} {self.target}"

    def as_dict(self) -> Dict[str, Any]:
        return {"kind": self.kind, "target": self.target, "value": self.value, "label": self.label}


def _nodes_in_zone(state: DTState, zone: str) -> List[str]:
    return [
        name
        for name, node in state.nodes_by_name.items()
        if str((node.get("labels") or {}).get("zone")) == zone
    ]


def apply_fault(state: DTState, fault: Fault) -> None:
    if fault.kind == "zone_blackout":
        for name in _nodes_in_zone(state, fault.target):
            state.apply_observation(
                {"action": "apply", "payload": {"type": "node", "node": name, "changes": {"down": True}}}
            )
    elif fault.kind == "node_down":
        state.apply_observation(
            {"action": "apply", "payload": {"type": "node", "node": fault.target, "changes": {"down": True}}}
        )
    elif fault.kind == "thermal_derate":
        state.apply_observation(
            {
                "action": "apply",
                "payload": {"type": "node", "node": fault.target, "changes": {"thermal_derate": fault.value}},
            }
        )
    elif fault.kind == "link_down":
        state.apply_observation(
            {"action": "apply", "payload": {"type": "link", "key": fault.target, "changes": {"down": True}}}
        )
    elif fault.kind == "link_degrade":
        state.apply_observation(
            {
                "action": "apply",
                "payload": {"type": "link", "key": fault.target, "changes": {"loss_pct": fault.value}},
            }
        )


def revert_fault(state: DTState, fault: Fault) -> None:
    if fault.kind == "zone_blackout":
        for name in _nodes_in_zone(state, fault.target):
            state.apply_observation(
                {"action": "revert", "payload": {"type": "node", "node": name, "fields": ["down"]}}
            )
    elif fault.kind == "node_down":
        state.apply_observation(
            {"action": "revert", "payload": {"type": "node", "node": fault.target, "fields": ["down"]}}
        )
    elif fault.kind == "thermal_derate":
        state.apply_observation(
            {"action": "revert", "payload": {"type": "node", "node": fault.target, "fields": ["thermal_derate"]}}
        )
    elif fault.kind == "link_down":
        state.apply_observation(
            {"action": "revert", "payload": {"type": "link", "key": fault.target, "fields": ["down"]}}
        )
    elif fault.kind == "link_degrade":
        state.apply_observation(
            {"action": "revert", "payload": {"type": "link", "key": fault.target, "fields": ["loss_pct"]}}
        )


def candidate_faults(
    state: DTState,
    *,
    include: Sequence[str] = ("zone_blackout", "node_down", "link_down", "thermal_derate"),
    focus_nodes: Optional[Iterable[str]] = None,
    derate: float = 0.6,
) -> List[Fault]:
    """Build the fault space to search.

    Node-level faults are restricted to `focus_nodes` (the nodes the untouched
    plan actually uses) — killing a node the job never placed work on cannot
    break it, and searching all 100 would waste the pair budget.
    """
    faults: List[Fault] = []
    snapshot = state.snapshot()

    if "zone_blackout" in include:
        zones = sorted(
            {
                str((n.get("labels") or {}).get("zone"))
                for n in snapshot["nodes"]
                if (n.get("labels") or {}).get("zone")
            }
        )
        faults += [Fault("zone_blackout", z) for z in zones]

    focus = sorted(set(focus_nodes or []))
    if "node_down" in include:
        faults += [Fault("node_down", n) for n in focus]
    if "thermal_derate" in include:
        faults += [Fault("thermal_derate", n, derate) for n in focus]

    if "link_down" in include:
        faults += [Fault("link_down", l["key"]) for l in snapshot["links"]]

    return faults


# --------------------------------------------------------------------------
# search
# --------------------------------------------------------------------------


@dataclass
class Outcome:
    latency_ms: float
    deadline_ms: float
    infeasible: bool

    @property
    def broken(self) -> bool:
        if self.infeasible or self.latency_ms == INF or self.latency_ms != self.latency_ms:
            return True
        return self.deadline_ms > 0 and self.latency_ms > self.deadline_ms

    @property
    def headroom_pct(self) -> Optional[float]:
        if self.deadline_ms <= 0 or self.latency_ms == INF:
            return None
        return round(100.0 * (1.0 - self.latency_ms / self.deadline_ms), 2)


class BlastRadiusSearch:
    def __init__(
        self,
        state: DTState,
        job: Dict[str, Any],
        *,
        strategy: str = "greedy",
        deadline_ms: Optional[float] = None,
    ):
        self.state = state
        self.job = job
        self.strategy = strategy
        self.cm = CostModel(state)
        self.planner, self.mode = build_planner(strategy, state, self.cm)
        self.deadline_ms = (
            safe_float(deadline_ms, 0.0) if deadline_ms is not None
            else safe_float(job.get("deadline_ms"), 0.0)
        )
        self.evaluations = 0

    def evaluate(self, faults: Sequence[Fault] = ()) -> Outcome:
        # Predictive history is sticky by design, so without rewinding it a
        # thermal derate in one trial keeps depressing later trials — every
        # candidate after it would look worse than it is.
        checkpoint = self.state.predictive_checkpoint()
        for f in faults:
            apply_fault(self.state, f)
        try:
            plan = plan_once(self.planner, self.mode, self.job)
            self.evaluations += 1
            return Outcome(
                latency_ms=safe_float(plan.get("latency_ms"), INF),
                deadline_ms=self.deadline_ms,
                infeasible=bool(plan.get("infeasible")),
            )
        finally:
            for f in reversed(list(faults)):
                revert_fault(self.state, f)
            self.state.predictive_restore(checkpoint)

    def run(
        self,
        *,
        faults: Optional[Sequence[Fault]] = None,
        max_depth: int = 2,
        branch: int = 12,
        max_sets: int = 25,
    ) -> Dict[str, Any]:
        started = time.time()
        baseline = self.evaluate()
        plan = plan_once(self.planner, self.mode, self.job)
        annotate_plan(self.state, self.job, plan)
        used_nodes = sorted(set(plan.get("assignments", {}).values()))

        space = list(faults) if faults is not None else candidate_faults(
            self.state, focus_nodes=used_nodes
        )

        breaking: List[Dict[str, Any]] = []
        # Faults that alone break the job are removed from further combination:
        # any larger set containing them is not minimal.
        singles: List[Tuple[Fault, Outcome]] = []
        for fault in space:
            outcome = self.evaluate([fault])
            singles.append((fault, outcome))
            if outcome.broken and len(breaking) >= max_sets:
                continue  # cap applies to singles too, not just combinations
            if outcome.broken:
                breaking.append(
                    {
                        "size": 1,
                        "faults": [fault.as_dict()],
                        "latency_ms": None if outcome.latency_ms == INF else round(outcome.latency_ms, 2),
                        "infeasible": outcome.infeasible,
                    }
                )

        survivors = [(f, o) for f, o in singles if not o.broken]
        # Rank by damage done alone: the worst offenders are the likeliest halves
        # of a breaking pair, and the pair budget is quadratic.
        survivors.sort(key=lambda item: -item[1].latency_ms)
        ranked = [f for f, _ in survivors[: max(0, branch)]]

        depth = 2
        while depth <= max_depth and len(breaking) < max_sets:
            found_at_depth = 0
            for combo in itertools.combinations(ranked, depth):
                if len(breaking) >= max_sets:
                    break
                if self._contains_known_breaking(combo, breaking):
                    continue
                outcome = self.evaluate(combo)
                if outcome.broken:
                    breaking.append(
                        {
                            "size": depth,
                            "faults": [f.as_dict() for f in combo],
                            "latency_ms": None if outcome.latency_ms == INF else round(outcome.latency_ms, 2),
                            "infeasible": outcome.infeasible,
                        }
                    )
                    found_at_depth += 1
            depth += 1
            if found_at_depth == 0 and depth > max_depth:
                break

        return {
            "job_id": self.job.get("id"),
            "strategy": self.strategy,
            "deadline_ms": self.deadline_ms or None,
            "baseline": {
                "latency_ms": None if baseline.latency_ms == INF else round(baseline.latency_ms, 2),
                "headroom_pct": baseline.headroom_pct,
                "broken": baseline.broken,
                "nodes": used_nodes,
                "cost_total": plan.get("cost_total"),
                "co2_g": plan.get("co2_g"),
            },
            "search": {
                "fault_space": len(space),
                "combined": len(ranked),
                "max_depth": max_depth,
                "evaluations": self.evaluations,
                "duration_s": round(time.time() - started, 2),
                "truncated": len(breaking) >= max_sets,
            },
            "minimal_breaking_sets": breaking,
            "worst_single_faults": [
                {
                    **f.as_dict(),
                    "latency_ms": None if o.latency_ms == INF else round(o.latency_ms, 2),
                    "headroom_pct": o.headroom_pct,
                }
                for f, o in survivors[:5]
            ],
            "verdict": _verdict(breaking, baseline),
            "most_common_fault": _most_common(breaking),
        }

    @staticmethod
    def _contains_known_breaking(combo: Sequence[Fault], breaking: List[Dict[str, Any]]) -> bool:
        """Skip supersets of a set we already know breaks the job."""
        combo_keys = {(f.kind, f.target) for f in combo}
        for entry in breaking:
            keys = {(f["kind"], f["target"]) for f in entry["faults"]}
            if keys <= combo_keys:
                return True
        return False


def _verdict(breaking: List[Dict[str, Any]], baseline: Outcome) -> str:
    if baseline.broken:
        return "job already misses its deadline with no faults injected"
    singles = [b for b in breaking if b["size"] == 1]
    if singles:
        return f"fragile: {len(singles)} single fault(s) break this job"
    pairs = [b for b in breaking if b["size"] == 2]
    if pairs:
        return f"survives any single fault; {len(pairs)} pair(s) break it"
    if breaking:
        return f"survives singles and pairs; broken only by {breaking[0]['size']}-fault sets"
    return "survives every fault combination searched"


def _most_common(breaking: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """The fault implicated in the most breaking sets — the best thing to fix."""
    counts: Dict[Tuple[str, str], Dict[str, Any]] = {}
    for entry in breaking:
        for fault in entry["faults"]:
            key = (fault["kind"], fault["target"])
            row = counts.setdefault(key, {**fault, "sets": 0})
            row["sets"] += 1
    if not counts:
        return None
    return max(counts.values(), key=lambda r: r["sets"])


# --------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------


def load_job(job_id: Optional[str], jobs_dir: Path) -> Dict[str, Any]:
    jobs: List[Dict[str, Any]] = []
    for path in sorted(jobs_dir.glob("*.y*ml")):
        content = yaml.safe_load(path.read_text(encoding="utf-8"))
        if isinstance(content, dict) and isinstance(content.get("jobs"), list):
            jobs.extend([j for j in content["jobs"] if isinstance(j, dict)])
        elif isinstance(content, list):
            jobs.extend([j for j in content if isinstance(j, dict)])
        elif isinstance(content, dict):
            jobs.append(content)
    if not jobs:
        raise SystemExit(f"no jobs found under {jobs_dir}")
    if not job_id:
        return jobs[0]
    for job in jobs:
        if job.get("id") == job_id:
            return job
    raise SystemExit(f"job '{job_id}' not found. Available: {', '.join(str(j.get('id')) for j in jobs)}")


def render_text(report: Dict[str, Any]) -> str:
    b = report["baseline"]
    lines = [
        f"Blast radius — job {report['job_id']} · strategy {report['strategy']}",
        f"  baseline     {b['latency_ms']} ms"
        + (f" vs {report['deadline_ms']} ms deadline ({b['headroom_pct']}% headroom)"
           if report["deadline_ms"] else " (no deadline set)"),
        f"  nodes used   {', '.join(b['nodes']) or '—'}",
        f"  searched     {report['search']['fault_space']} faults, "
        f"{report['search']['evaluations']} evaluations in {report['search']['duration_s']}s",
        "",
        f"  {report['verdict']}",
    ]
    if report["minimal_breaking_sets"]:
        lines += ["", "  Minimal breaking sets:"]
        for entry in report["minimal_breaking_sets"][:10]:
            what = " + ".join(f["label"] for f in entry["faults"])
            why = "infeasible" if entry["infeasible"] else f"{entry['latency_ms']} ms"
            lines.append(f"    [{entry['size']}] {what}  →  {why}")
    if report["most_common_fault"]:
        f = report["most_common_fault"]
        lines += ["", f"  Most implicated fault: {f['label']} (in {f['sets']} set(s))"]
    if report["worst_single_faults"]:
        lines += ["", "  Worst survivable single faults:"]
        for f in report["worst_single_faults"]:
            lines.append(f"    {f['label']}  →  {f['latency_ms']} ms ({f['headroom_pct']}% headroom)")
    return "\n".join(lines) + "\n"


def build_argparser() -> argparse.ArgumentParser:
    ap = argparse.ArgumentParser(description="Find the smallest fault set that breaks a job.")
    ap.add_argument("--job", help="job id from jobs/ (default: the first one)")
    ap.add_argument("--jobs-dir", default=str(ROOT / "jobs"))
    ap.add_argument("--nodes-dir", default=str(ROOT / "nodes"))
    ap.add_argument("--topology", default=str(ROOT / "sim" / "topology.yaml"))
    ap.add_argument("--strategy", default="greedy")
    ap.add_argument("--deadline-ms", type=float, help="override the job's deadline")
    ap.add_argument("--depth", type=int, default=2, help="largest fault-set size to search")
    ap.add_argument("--branch", type=int, default=12, help="worst single faults to combine")
    ap.add_argument("--max-sets", type=int, default=25, help="stop after this many breaking sets")
    ap.add_argument("--json-out")
    return ap


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = build_argparser().parse_args(argv)
    job = load_job(args.job, Path(args.jobs_dir))
    state = DTState(
        nodes_dir=args.nodes_dir,
        topology_path=args.topology,
        overrides_path=str(ROOT / "sim" / "_blast_overrides.json"),
        auto_start_watchers=False,
    )
    try:
        search = BlastRadiusSearch(
            state, job, strategy=args.strategy, deadline_ms=args.deadline_ms
        )
        report = search.run(max_depth=args.depth, branch=args.branch, max_sets=args.max_sets)
    finally:
        state.stop()

    print(render_text(report))
    if args.json_out:
        out = Path(args.json_out)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(report, indent=2), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
