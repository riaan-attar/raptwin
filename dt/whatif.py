#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
dt/whatif.py — evaluate a change to the fabric before buying it.

"Would two more GPU nodes fix our deadline misses, or do we need a faster link?"
is a procurement question, and the twin can answer it without touching the real
fabric: fork the state twice, apply the proposed change to one fork, replay the
same job catalogue through both, and diff.

    baseline   6 jobs, 4 met, p95 1620 ms, 0.031 INR
    variant   +2 nodes, 6 met, p95 1190 ms (-27%), 0.028 INR

Both forks are loaded from disk and discarded afterwards, so a what-if never
mutates the live twin, and `persist=False` everywhere means nothing reaches
nodes/ or topology.yaml.

Faults can be applied to both forks (`faults=[...]`), which answers the more
useful version of the question: "does this purchase hold up *during* an outage?"
"""

from __future__ import annotations

import statistics
from typing import Any, Dict, List, Optional, Sequence, Tuple

from .cost_model import CostModel
from .economics import annotate_plan
from .planners import build_planner, plan_once
from .state import DTState, safe_float

INF = float("inf")


class ChangeError(ValueError):
    """A proposed change that cannot be applied (bad descriptor, unknown node…)."""


def apply_changes(state: DTState, changes: Dict[str, Any]) -> List[str]:
    """Apply a change set to a forked state. Returns human-readable descriptions."""
    applied: List[str] = []

    for descriptor in changes.get("add_nodes") or []:
        if not isinstance(descriptor, dict) or not descriptor.get("name"):
            raise ChangeError("add_nodes entries need a name")
        try:
            state.add_or_update_node(descriptor, persist=False, preserve_runtime=False)
        except ValueError as exc:
            raise ChangeError(str(exc)) from exc
        applied.append(f"added node {descriptor['name']}")

    # "Give me N more of what this node is" — the common capacity question.
    for spec in changes.get("clone_nodes") or []:
        source = spec.get("from") if isinstance(spec, dict) else None
        count = int(safe_float((spec or {}).get("count"), 1.0))
        original = state.node_descriptor(str(source)) if source else None
        if original is None:
            raise ChangeError(f"cannot clone unknown node '{source}'")
        for i in range(1, max(1, count) + 1):
            clone = dict(original)
            clone["name"] = f"{source}-whatif{i}"
            clone.setdefault("labels", {})
            clone["labels"] = {**(original.get("labels") or {}), "whatif": "clone"}
            state.add_or_update_node(clone, persist=False, preserve_runtime=False)
        applied.append(f"cloned {source} x{max(1, count)}")

    for name in changes.get("remove_nodes") or []:
        if state.remove_node(str(name), delete_file=False) is None:
            raise ChangeError(f"cannot remove unknown node '{name}'")
        applied.append(f"removed node {name}")

    for name, patch in (changes.get("patch_nodes") or {}).items():
        current = state.node_descriptor(str(name))
        if current is None:
            raise ChangeError(f"cannot patch unknown node '{name}'")
        if not isinstance(patch, dict):
            raise ChangeError(f"patch for '{name}' must be an object")
        merged = _deep_merge(current, patch)
        state.add_or_update_node(merged, persist=False, preserve_runtime=True)
        applied.append(f"patched node {name} ({', '.join(sorted(patch))})")

    for spec in changes.get("links") or []:
        if not isinstance(spec, dict):
            raise ChangeError("link entries must be objects")
        try:
            saved = state.upsert_link(spec, persist=False)
        except ValueError as exc:
            raise ChangeError(str(exc)) from exc
        applied.append(f"link {saved['key']}")

    for key in changes.get("remove_links") or []:
        if not state.remove_link(str(key), persist=False):
            raise ChangeError(f"cannot remove unknown link '{key}'")
        applied.append(f"removed link {key}")

    if not applied:
        raise ChangeError("no changes given")
    return applied


def _deep_merge(base: Dict[str, Any], patch: Dict[str, Any]) -> Dict[str, Any]:
    out = dict(base)
    for key, value in patch.items():
        if isinstance(value, dict) and isinstance(out.get(key), dict):
            out[key] = _deep_merge(out[key], value)
        else:
            out[key] = value
    return out


def _evaluate(
    state: DTState,
    jobs: Sequence[Dict[str, Any]],
    strategy: str,
    faults: Sequence[Any] = (),
    contention: bool = True,
) -> Dict[str, Any]:
    """Plan every job on this fork.

    `contention=True` commits reservations as it goes, so job 2 sees the
    capacity job 1 took. Without it every job independently picks the single
    best node and extra capacity looks worthless — which is exactly the
    question a what-if is asked. The fork is discarded afterwards, so
    committing here cannot affect the live twin.
    """
    from sim.blast_radius import apply_fault  # local: sim imports dt, not the reverse

    for fault in faults:
        apply_fault(state, fault)

    cm = CostModel(state)
    planner, mode = build_planner(strategy, state, cm)

    rows: List[Dict[str, Any]] = []
    for job in jobs:
        plan = plan_once(planner, mode, job, dry_run=not contention)
        annotate_plan(state, job, plan)
        latency = safe_float(plan.get("latency_ms"), INF)
        deadline = safe_float(job.get("deadline_ms"), 0.0)
        met = not plan.get("infeasible") and latency != INF and (deadline <= 0 or latency <= deadline)
        rows.append(
            {
                "job_id": job.get("id"),
                "latency_ms": None if latency == INF else round(latency, 2),
                "deadline_ms": deadline or None,
                "met": bool(met),
                "infeasible": bool(plan.get("infeasible")),
                "cost_total": plan.get("cost_total"),
                "co2_g": plan.get("co2_g"),
                "nodes": sorted(set(plan.get("assignments", {}).values())),
            }
        )

    latencies = [r["latency_ms"] for r in rows if r["latency_ms"] is not None]
    costs = [r["cost_total"] for r in rows if r["cost_total"] is not None]
    co2 = [r["co2_g"] for r in rows if r["co2_g"] is not None]
    snapshot = state.snapshot()
    return {
        "jobs": rows,
        "met": sum(1 for r in rows if r["met"]),
        "total": len(rows),
        "sla_pct": round(100.0 * sum(1 for r in rows if r["met"]) / max(1, len(rows)), 2),
        "mean_ms": round(statistics.fmean(latencies), 2) if latencies else None,
        "p95_ms": round(_percentile(latencies, 95), 2) if latencies else None,
        "cost_total": round(sum(costs), 6) if costs else None,
        "co2_g": round(sum(co2), 4) if co2 else None,
        "fabric": {
            "nodes": len(snapshot["nodes"]),
            "links": len(snapshot["links"]),
            "cpu_cores": round(sum(safe_float((n.get("caps") or {}).get("max_cpu_cores"), 0.0) for n in snapshot["nodes"])),
            "gpu_vram_gb": round(sum(safe_float((n.get("caps") or {}).get("gpu_vram_gb"), 0.0) for n in snapshot["nodes"])),
        },
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


def _delta(before: Optional[float], after: Optional[float]) -> Optional[Dict[str, Any]]:
    if before is None or after is None:
        return None
    diff = after - before
    pct = None if before == 0 else round(100.0 * diff / before, 2)
    return {"before": before, "after": after, "diff": round(diff, 6), "pct": pct}


def compare(
    *,
    nodes_dir: str,
    topology_path: str,
    overrides_path: str,
    jobs: Sequence[Dict[str, Any]],
    changes: Dict[str, Any],
    strategy: str = "greedy",
    faults: Sequence[Any] = (),
    contention: bool = True,
) -> Dict[str, Any]:
    """Plan `jobs` on the fabric as-is and on a changed fork, then diff."""
    if not jobs:
        raise ChangeError("no jobs to evaluate")

    def fork() -> DTState:
        return DTState(
            nodes_dir=nodes_dir,
            topology_path=topology_path,
            overrides_path=overrides_path,
            auto_start_watchers=False,
        )

    baseline_state = fork()
    try:
        baseline = _evaluate(baseline_state, jobs, strategy, faults, contention)
    finally:
        baseline_state.stop()

    variant_state = fork()
    try:
        applied = apply_changes(variant_state, changes)
        variant = _evaluate(variant_state, jobs, strategy, faults, contention)
    finally:
        variant_state.stop()

    return {
        "strategy": strategy,
        "contention": bool(contention),
        "changes": applied,
        "faults": [getattr(f, "label", str(f)) for f in faults],
        "baseline": baseline,
        "variant": variant,
        "deltas": {
            "sla_pct": _delta(baseline["sla_pct"], variant["sla_pct"]),
            "p95_ms": _delta(baseline["p95_ms"], variant["p95_ms"]),
            "mean_ms": _delta(baseline["mean_ms"], variant["mean_ms"]),
            "cost_total": _delta(baseline["cost_total"], variant["cost_total"]),
            "co2_g": _delta(baseline["co2_g"], variant["co2_g"]),
            "nodes": _delta(float(baseline["fabric"]["nodes"]), float(variant["fabric"]["nodes"])),
        },
        "verdict": _verdict(baseline, variant),
    }


def _verdict(baseline: Dict[str, Any], variant: Dict[str, Any]) -> str:
    gained = variant["met"] - baseline["met"]
    p95_before, p95_after = baseline["p95_ms"], variant["p95_ms"]
    if gained > 0:
        extra = ""
        if p95_before and p95_after:
            extra = f" and p95 improves {100.0 * (p95_before - p95_after) / p95_before:.0f}%"
        return f"{gained} more job(s) meet their deadline{extra}"
    if gained < 0:
        return f"{-gained} fewer job(s) meet their deadline — this change makes things worse"
    if p95_before and p95_after:
        change = 100.0 * (p95_after - p95_before) / p95_before
        if change <= -5:
            return f"same SLA, but p95 improves {-change:.0f}%"
        if change >= 5:
            return f"same SLA, and p95 worsens {change:.0f}%"
    return "no measurable difference for this catalogue"
