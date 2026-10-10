#!/usr/bin/env python3
"""
tools/benchmark_paper_figures.py — real data for paper/main.tex's Results section.

The original paper draft (paper/main.tex) borrowed a benchmark table and three
figures from literature: a "DDQN-HTRCS" strategy that doesn't exist in this
codebase, an RL training-episode convergence curve this codebase has no
episodic trainer to produce, and JCT/SLA numbers that were never measured
against the real fabric. This script replaces the measurable parts with
numbers actually produced by this codebase's own tools, for the four
strategies that really exist: greedy, cheapest-energy, resilient, rl-markov.

It reuses two existing tools rather than reimplementing either:
  - tools/policy_benchmark.py → Mean JCT under normal operation, swept across
    job-catalogue sizes (replaces the "JCT vs edge devices M" figure, relabeled
    "JCT vs concurrent jobs" since this fabric has no edge-device-count knob).
  - tools/ci_gate.py          → SLA hit rate under two real chaos scenarios
    from sim/topology.yaml (wifi_brownout, core_link_cut), replacing the
    fabricated per-trial "Monte-Carlo survival" curve with a real resilience
    comparison across scenario severity.

Table 1 itself reuses tools/benchmark_srs_table.py's exact rows, so the paper
and the SRS cite the same measured numbers rather than two different "real"
tables.

Usage:
    python -m tools.benchmark_paper_figures --out-dir paper/figures

Runtime: a few minutes (several ci_gate/policy_benchmark subprocess runs).
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from tools.benchmark_srs_table import (
    STRATEGIES,
    STRATEGY_LABELS,
    assemble_rows,
    run_ci_gate,
    run_policy_benchmark,
)

JOB_LIMITS = [2, 4, 6, 8, 10]
SLA_SCENARIOS = ["wifi_brownout", "core_link_cut"]


def sweep_jct_vs_load(reports_dir: Path) -> dict[str, list[float]]:
    """Mean JCT (s) per strategy across increasing job-catalogue sizes."""
    series: dict[str, list[float]] = {s: [] for s in STRATEGIES}
    for limit in JOB_LIMITS:
        cmd = [
            sys.executable,
            "-m",
            "tools.policy_benchmark",
            "--jobs",
            "jobs/jobs_10.yaml",
            "--strategies",
            *STRATEGIES,
            "--limit",
            str(limit),
            "--json-out",
            str(reports_dir / f"_paper_jct_limit{limit}.json"),
        ]
        subprocess.run(cmd, cwd=ROOT, check=True)
        data = json.loads(
            (reports_dir / f"_paper_jct_limit{limit}.json").read_text(encoding="utf-8")
        )
        summary = data["summary"]
        for s in STRATEGIES:
            series[s].append(round(summary[s]["latency_avg"] / 1000.0, 3))
    return series


def sweep_sla_by_scenario(reports_dir: Path, seed: int) -> dict[str, dict[str, float]]:
    """SLA hit rate (%) per strategy, per chaos scenario."""
    result: dict[str, dict[str, float]] = {s: {} for s in STRATEGIES}
    for scenario in SLA_SCENARIOS:
        json_out = reports_dir / f"_paper_sla_{scenario}.json"
        cmd = [
            sys.executable,
            "-m",
            "tools.ci_gate",
            "--jobs",
            "jobs/jobs_10.yaml",
            "--job-limit",
            "6",
            "--strategies",
            *STRATEGIES,
            "--scenarios",
            scenario,
            "--seed",
            str(seed),
            "--deadline-scale",
            "0.28",
            "--min-sla",
            "0",
            "--json-out",
            str(json_out),
            "--quiet",
        ]
        subprocess.run(cmd, cwd=ROOT, check=True)
        data = json.loads(json_out.read_text(encoding="utf-8"))
        by_strategy = {r["strategy"]: r for r in data["results"]}
        for s in STRATEGIES:
            result[s][scenario] = round(by_strategy[s]["worst_sla_pct"], 1)
    return result


def plot_jct_vs_load(series: dict[str, list[float]], out_dir: Path) -> None:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    fig, ax = plt.subplots(figsize=(5.0, 3.4))
    markers = {
        "greedy": "o",
        "cheapest-energy": "s",
        "resilient": "D",
        "rl-markov": "^",
    }
    for s in STRATEGIES:
        ax.plot(JOB_LIMITS, series[s], marker=markers[s], label=STRATEGY_LABELS[s])
    ax.set_xlabel("Number of concurrent jobs")
    ax.set_ylabel("Mean Job Completion Time (s)")
    ax.legend(fontsize=8)
    ax.grid(alpha=0.3)
    fig.tight_layout()
    fig.savefig(out_dir / "jct_vs_nodes.pdf")
    fig.savefig(out_dir / "jct_vs_nodes.png", dpi=150)
    plt.close(fig)


def plot_sla_by_scenario(data: dict[str, dict[str, float]], out_dir: Path) -> None:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import numpy as np

    fig, ax = plt.subplots(figsize=(5.0, 3.4))
    x = np.arange(len(STRATEGIES))
    width = 0.35
    for i, scenario in enumerate(SLA_SCENARIOS):
        vals = [data[s][scenario] for s in STRATEGIES]
        ax.bar(x + (i - 0.5) * width, vals, width, label=scenario)
    ax.set_xticks(x)
    ax.set_xticklabels([STRATEGY_LABELS[s] for s in STRATEGIES], rotation=15)
    ax.set_ylabel("SLA hit rate (%)")
    ax.legend(fontsize=8)
    ax.grid(axis="y", alpha=0.3)
    fig.tight_layout()
    fig.savefig(out_dir / "chaos_survival.pdf")
    fig.savefig(out_dir / "chaos_survival.png", dpi=150)
    plt.close(fig)


def build_argparser() -> argparse.ArgumentParser:
    ap = argparse.ArgumentParser(
        description="Generate real data/figures for paper/main.tex."
    )
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--out-dir", default=str(ROOT / "paper" / "figures"))
    ap.add_argument(
        "--reports-out", default=str(ROOT / "reports" / "paper_figures.json")
    )
    return ap


def main(argv: list[str] | None = None) -> int:
    args = build_argparser().parse_args(argv)
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    reports_dir = ROOT / "reports"
    reports_dir.mkdir(parents=True, exist_ok=True)

    print("Table 1: reusing tools/benchmark_srs_table.py rows...", flush=True)
    gate = run_ci_gate(reports_dir / "_paper_table1_gate.json", args.seed)
    policy = run_policy_benchmark(reports_dir / "_paper_table1_policy.json")
    table1 = assemble_rows(gate, policy)

    print("JCT vs job-load sweep...", flush=True)
    jct_series = sweep_jct_vs_load(reports_dir)
    plot_jct_vs_load(jct_series, out_dir)

    print("SLA hit rate by chaos scenario...", flush=True)
    sla_data = sweep_sla_by_scenario(reports_dir, args.seed)
    plot_sla_by_scenario(sla_data, out_dir)

    result: dict[str, Any] = {
        "seed": args.seed,
        "table1": table1,
        "jct_vs_load": {"job_limits": JOB_LIMITS, "series": jct_series},
        "sla_by_scenario": sla_data,
    }
    Path(args.reports_out).write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
