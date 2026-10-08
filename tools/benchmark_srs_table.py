#!/usr/bin/env python3
"""
tools/benchmark_srs_table.py — measure the real §3.2.4 SRS benchmark table.

The SRS's "Reliability and Accuracy" table used to cite a `DDQN-HTRCS` strategy
and a 35-edge-device/4-edge-server fabric that don't exist in this codebase —
copied from literature, not measured. This script replaces it with numbers
measured against the real fabric (`nodes/`, `jobs/jobs_10.yaml`) for the four
strategies that actually exist: greedy, cheapest-energy, resilient, rl-markov.

It combines two existing tools rather than reimplementing either:
  - tools/policy_benchmark.py → Mean JCT, Energy (normal operation, no chaos)
  - tools/ci_gate.py          → p95 JCT, SLA Hit Rate (under the core_link_cut
                                 chaos scenario, at ci/gate.yaml's established
                                 deadline_scale=0.28 margin-test setting)

These are two different operating conditions, not one unified benchmark run —
the output JSON and the printed table say so explicitly, so nobody mistakes a
"Mean JCT" column for having been measured under the same fault conditions as
"SLA Hit Rate". The old fabricated table presented all four as one run; this
one doesn't repeat that.

Usage:
    python -m tools.benchmark_srs_table --out reports/srs_benchmark_table.json

Runtime: ~1-2 minutes (rl-markov planning is the slow part; see WORKLOG.md's
"~75x more expensive than greedy" finding, which may resurface here).
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from collections.abc import Sequence
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

STRATEGIES = ["greedy", "cheapest-energy", "resilient", "rl-markov"]
STRATEGY_LABELS = {
    "greedy": "Greedy",
    "cheapest-energy": "Cheapest-Energy",
    "resilient": "Resilient",
    "rl-markov": "RL-Markov",
}
SCENARIO = "core_link_cut"
JOB_LIMIT = (
    6  # matches ci/gate.yaml's job_limit, so both tools see the same catalogue slice
)


def git_sha() -> str:
    try:
        return subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=True,
        ).stdout.strip()
    except Exception:
        return "unknown"


def run_ci_gate(json_out: Path, seed: int) -> dict[str, Any]:
    """p95 JCT + SLA Hit Rate under the core_link_cut chaos scenario."""
    cmd = [
        sys.executable,
        "-m",
        "tools.ci_gate",
        "--jobs",
        "jobs/jobs_10.yaml",
        "--job-limit",
        str(JOB_LIMIT),
        "--strategies",
        *STRATEGIES,
        "--scenarios",
        SCENARIO,
        "--seed",
        str(seed),
        "--deadline-scale",
        "0.28",  # ci/gate.yaml's established margin-test value
        "--min-sla",
        "0",  # this run measures, it doesn't gate — never fail the process
        "--json-out",
        str(json_out),
        "--quiet",
    ]
    subprocess.run(cmd, cwd=ROOT, check=True)
    data = json.loads(json_out.read_text(encoding="utf-8"))
    return {r["strategy"]: r for r in data["results"]}


def run_policy_benchmark(json_out: Path) -> dict[str, Any]:
    """Mean JCT + Energy under normal operation (no chaos)."""
    cmd = [
        sys.executable,
        "-m",
        "tools.policy_benchmark",
        "--jobs",
        "jobs/jobs_10.yaml",
        "--strategies",
        *STRATEGIES,
        "--limit",
        str(JOB_LIMIT),
        "--json-out",
        str(json_out),
    ]
    subprocess.run(cmd, cwd=ROOT, check=True)
    data = json.loads(json_out.read_text(encoding="utf-8"))
    return data["summary"]


def assemble_rows(gate: dict[str, Any], policy: dict[str, Any]) -> list[dict[str, Any]]:
    """Pure function: two tool outputs -> the 4 table rows. Unit-tested directly."""
    rows = []
    for strategy in STRATEGIES:
        g = gate[strategy]
        p = policy[strategy]
        rows.append(
            {
                "strategy": STRATEGY_LABELS[strategy],
                "mean_jct_s": round(p["latency_avg"] / 1000.0, 2),
                "p95_jct_s": (
                    round(g["worst_p95_ms"] / 1000.0, 2)
                    if g["worst_p95_ms"] is not None
                    else None
                ),
                "energy_j": round(p["energy_avg"] * 1000.0, 1),  # energy_avg is kJ
                "sla_hit_rate_pct": round(g["worst_sla_pct"], 1),
            }
        )
    return rows


def render_table(rows: list[dict[str, Any]]) -> str:
    lines = [
        "| Strategy | Mean JCT (s) | p95 JCT (s) | Energy (J) | SLA Hit Rate |",
        "| --- | --- | --- | --- | --- |",
    ]
    for r in rows:
        p95 = "—" if r["p95_jct_s"] is None else f"{r['p95_jct_s']}"
        lines.append(
            f"| {r['strategy']} | {r['mean_jct_s']} | {p95} | {r['energy_j']} | {r['sla_hit_rate_pct']}% |"
        )
    return "\n".join(lines)


def build_argparser() -> argparse.ArgumentParser:
    ap = argparse.ArgumentParser(
        description="Measure the real SRS §3.2.4 benchmark table."
    )
    ap.add_argument(
        "--seed",
        type=int,
        default=7,
        help="ci_gate RL/bandit seed (default: ci/gate.yaml's own seed)",
    )
    ap.add_argument("--out", default=str(ROOT / "reports" / "srs_benchmark_table.json"))
    return ap


def main(argv: Sequence[str] | None = None) -> int:
    args = build_argparser().parse_args(argv)
    started = time.time()
    reports_dir = ROOT / "reports"
    reports_dir.mkdir(parents=True, exist_ok=True)

    print(
        f"Running tools.ci_gate (scenario={SCENARIO}, job_limit={JOB_LIMIT}, seed={args.seed})...",
        flush=True,
    )
    gate = run_ci_gate(reports_dir / "_srs_table_gate.json", args.seed)

    print("Running tools.policy_benchmark (no chaos)...", flush=True)
    policy = run_policy_benchmark(reports_dir / "_srs_table_policy.json")

    rows = assemble_rows(gate, policy)

    result = {
        "strategies": STRATEGIES,
        "scenario": SCENARIO,
        "job_limit": JOB_LIMIT,
        "seed": args.seed,
        "deadline_scale": 0.28,
        "commit": git_sha(),
        "duration_s": round(time.time() - started, 1),
        "rows": rows,
        "note": (
            "Mean JCT and Energy measured under normal operation (tools/policy_benchmark.py); "
            "p95 JCT and SLA Hit Rate measured under the core_link_cut chaos scenario at "
            "deadline_scale=0.28, matching ci/gate.yaml (tools/ci_gate.py). These are two "
            "different operating conditions, not one unified run."
        ),
    }

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(result, indent=2), encoding="utf-8")

    print()
    print(render_table(rows))
    print()
    print(
        f"commit {result['commit']} · seed {result['seed']} · {result['duration_s']}s"
    )
    print(
        f"reproduce: python -m tools.ci_gate --jobs jobs/jobs_10.yaml --job-limit {JOB_LIMIT} "
        f"--strategies {' '.join(STRATEGIES)} --scenarios {SCENARIO} --seed {args.seed} "
        f"--deadline-scale 0.28 --min-sla 0"
    )
    print(
        f"           python -m tools.policy_benchmark --jobs jobs/jobs_10.yaml "
        f"--strategies {' '.join(STRATEGIES)} --limit {JOB_LIMIT}"
    )
    print(f"wrote {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
