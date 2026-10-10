#!/usr/bin/env python3
"""
tools/render_paper_architecture.py — regenerate kkwieer/paper/figures/arch.jpeg.

The original diagram (made in some external tool, source not in this repo) had
two real defects: a leftover "Type something" placeholder caption baked into
the image, and two different boxes both labeled "Self-Healing & Resource
Guardian" (the real controller, and the unrelated Dashboard/REST API/Exporters
layer). It also predated FR-28/29/31, so it never showed GPU-aware
provisioning, MQTT ingestion, or the API-key gate that the paper text now
describes. This script rebuilds the same five-module layout from scratch with
matplotlib so the figure can be regenerated from source instead of hand-edited
as a raster image.

Usage:
    python -m tools.render_paper_architecture
"""

from __future__ import annotations

from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.patches as mpatches
import matplotlib.pyplot as plt

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "kkwieer" / "paper" / "figures"

RED = "#c0392b"
GREEN = "#1e7a3e"
ORANGE = "#d4820a"
BLUE = "#2e6fb5"
PURPLE = "#6a3fa0"


def group_box(ax, xy, wh, title, color):
    x, y = xy
    w, h = wh
    ax.add_patch(
        mpatches.FancyBboxPatch(
            (x, y),
            w,
            h,
            boxstyle="round,pad=0.02,rounding_size=0.08",
            linewidth=1.4,
            edgecolor=color,
            facecolor=color,
            alpha=0.06,
        )
    )
    ax.text(
        x + 0.15, y + h - 0.28, title, fontsize=10.5, fontweight="bold", color=color
    )


def sub_box(ax, xy, wh, lines, color, fontsize=8.6):
    x, y = xy
    w, h = wh
    ax.add_patch(
        mpatches.FancyBboxPatch(
            (x, y),
            w,
            h,
            boxstyle="round,pad=0.015,rounding_size=0.06",
            linewidth=1.1,
            edgecolor=color,
            facecolor="white",
        )
    )
    n = len(lines)
    for i, (text, bold) in enumerate(lines):
        ty = y + h - (i + 0.75) * (h / (n + 0.3))
        ax.text(
            x + w / 2,
            ty,
            text,
            fontsize=fontsize,
            fontweight="bold" if bold else "normal",
            ha="center",
            va="center",
            color="#111111" if bold else "#333333",
        )


def elbow_arrow(ax, start, end, y_top, color, ls=(0, (4, 3)), lw=1.1):
    """Route start -> straight up -> across at y_top -> straight down -> end.

    Explicit waypoints (not an auto connectionstyle) so the line is
    guaranteed to clear every box in between, regardless of their positions.
    """
    sx, sy = start
    ex, ey = end
    ax.plot(
        [sx, sx, ex, ex],
        [sy, y_top, y_top, ey + 0.35],
        color=color,
        linewidth=lw,
        linestyle=ls,
        zorder=1,
    )
    ax.annotate(
        "",
        xy=(ex, ey),
        xytext=(ex, ey + 0.35),
        arrowprops={"arrowstyle": "-|>", "color": color, "linewidth": lw, "linestyle": ls},
    )


def arrow(
    ax,
    p1,
    p2,
    color="#222222",
    style="-|>",
    lw=1.2,
    ls="solid",
    connstyle="arc3,rad=0.0",
):
    ax.add_patch(
        mpatches.FancyArrowPatch(
            p1,
            p2,
            arrowstyle=style,
            mutation_scale=12,
            linewidth=lw,
            linestyle=ls,
            color=color,
            connectionstyle=connstyle,
        )
    )


def build() -> None:
    fig, ax = plt.subplots(figsize=(13.5, 9.0))
    ax.set_xlim(0, 16.6)
    ax.set_ylim(0, 11.2)
    ax.axis("off")

    # --- Module 1: Digital Twin Core State Engine -------------------------
    group_box(ax, (0.3, 3.2), (5.4, 6.4), "Digital Twin Core State Engine", RED)
    sub_box(
        ax,
        (1.0, 7.9),
        (4.0, 1.0),
        [("DTState Class", True), ("dt.state.DTState", False)],
        RED,
    )
    sub_box(
        ax,
        (0.7, 6.3),
        (2.1, 0.95),
        [("Static Asset", True), ("Ingestion", True)],
        RED,
        8.0,
    )
    sub_box(
        ax,
        (3.0, 6.3),
        (2.4, 0.95),
        [("Hot-Reloading", True), ("Watchers", True)],
        RED,
        8.0,
    )
    sub_box(
        ax,
        (0.7, 5.0),
        (2.1, 0.95),
        [("Live Telemetry", True), ("(/observe)", False)],
        RED,
        8.0,
    )
    sub_box(
        ax,
        (3.0, 5.0),
        (2.4, 0.95),
        [("MQTT Ingestion", True), ("(sim/mqtt_bridge.py)", False)],
        RED,
        7.6,
    )
    ax.text(
        0.7,
        3.55,
        "FR-29: event-driven alternative to REST polling",
        fontsize=7.3,
        color=RED,
        style="italic",
    )

    # --- Module 3: Pluggable Multi-Strategy Planner ------------------------
    group_box(ax, (6.0, 1.9), (5.1, 7.7), "Pluggable Multi-Strategy Planner", GREEN)
    sub_box(
        ax,
        (6.5, 8.3),
        (4.1, 0.95),
        [("Workload DAG Parser", True), ("schemas/job.schema.yaml", False)],
        GREEN,
        7.8,
    )
    sub_box(
        ax,
        (6.5, 7.0),
        (4.1, 0.9),
        [("Baseline Heuristics", True), ("Greedy / Cheapest-Energy", False)],
        GREEN,
        7.8,
    )
    sub_box(
        ax,
        (6.5, 5.9),
        (4.1, 0.9),
        [("Resilient & Federated", True), ("Network-aware placement", False)],
        GREEN,
        7.8,
    )
    sub_box(
        ax,
        (6.5, 4.8),
        (4.1, 0.9),
        [("RL-Markov Planner", True), ("dt/policy/mdp.py", False)],
        GREEN,
        7.8,
    )
    sub_box(
        ax,
        (6.5, 3.7),
        (4.1, 0.9),
        [("Dry-Run Evaluation", True), ("Simulate without commit", False)],
        GREEN,
        7.8,
    )
    sub_box(
        ax,
        (6.5, 2.1),
        (4.1, 1.2),
        [
            ("GPU-Aware Provisioning", True),
            ("fabric_docker/launch_fabric.py", False),
            ("FR-28: real GPU device requests", False),
        ],
        GREEN,
        7.4,
    )

    # --- Module 2: Predictive Analytics Engine ------------------------------
    group_box(ax, (11.6, 6.6), (4.6, 3.0), "Predictive Analytics Engine", ORANGE)
    sub_box(
        ax,
        (12.1, 8.0),
        (3.6, 0.95),
        [("PredictiveAnalyzer", True), ("dt.predict.PredictiveAnalyzer", False)],
        ORANGE,
        7.6,
    )
    sub_box(
        ax,
        (12.1, 6.85),
        (3.6, 0.9),
        [("Computed Metrics", True), ("Thermal derates, reliability, loss", False)],
        ORANGE,
        7.4,
    )

    # --- Module 4: Chaos Engine & Controllers -------------------------------
    group_box(ax, (11.6, 2.9), (4.6, 3.3), "Chaos Engine & Controllers", BLUE)
    sub_box(
        ax,
        (12.1, 4.55),
        (3.6, 1.1),
        [("Deterministic Chaos", True), ("Engine", True), ("sim/chaos.py", False)],
        BLUE,
        7.6,
    )
    sub_box(
        ax,
        (12.1, 3.1),
        (3.6, 1.1),
        [("Self-Healing &", True), ("Resource Guardian", True)],
        BLUE,
        7.6,
    )

    # --- Module 5: Interoperability & Dashboard Layer (renamed, fixed) -----
    group_box(
        ax, (0.3, 0.3), (15.9, 1.35), "Interoperability & Dashboard Layer", PURPLE
    )
    sub_box(
        ax,
        (0.6, 0.45),
        (4.9, 0.78),
        [("Interactive Dashboard", True), ("ui/dashboard.py", False)],
        PURPLE,
        7.6,
    )
    sub_box(
        ax,
        (5.8, 0.45),
        (4.9, 0.78),
        [("REST API", True), ("optional X-API-Key gate (FR-31)", False)],
        PURPLE,
        7.4,
    )
    sub_box(
        ax,
        (10.9, 0.45),
        (5.3, 0.78),
        [("Exporters", True), ("DTDL, Kubernetes CRDs", False)],
        PURPLE,
        7.6,
    )

    # --- Arrows: state <-> planner <-> predictive ---------------------------
    arrow(ax, (5.7, 8.4), (6.5, 8.75), color="#333333")
    ax.text(5.75, 8.85, "State Query", fontsize=7.2)
    arrow(ax, (10.6, 8.75), (12.1, 8.45), color="#333333")
    ax.text(10.65, 8.9, "Request Metrics", fontsize=7.2)

    # Chaos engine <-> state engine (dashed), routed in the margin above
    # every box so the line never cuts through the Planner module in between.
    elbow_arrow(ax, (15.7, 6.2), (2.6, 9.6), y_top=10.5, color=RED)
    ax.text(6.4, 10.65, "Inject Fault", fontsize=7.6, color=RED)
    elbow_arrow(ax, (16.0, 6.2), (2.2, 9.6), y_top=10.9, color=RED)
    ax.text(6.4, 10.98, "Heal / Clean", fontsize=7.6, color=RED)

    # State engine / planner down to interoperability layer
    arrow(ax, (1.2, 3.2), (3.0, 1.23), color=PURPLE, lw=1.0, connstyle="arc3,rad=-0.2")
    ax.text(0.4, 1.9, "Export\nSnapshot", fontsize=7.0, color=PURPLE)
    arrow(ax, (8.5, 2.1), (8.3, 1.23), color=PURPLE, lw=1.0)
    ax.text(8.55, 1.6, "API\nEndpoint", fontsize=7.0, color=PURPLE)
    arrow(ax, (13.9, 2.9), (13.3, 1.23), color=PURPLE, lw=1.0)

    plt.tight_layout()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    fig.savefig(OUT_DIR / "arch.jpeg", dpi=200)
    fig.savefig(OUT_DIR / "arch.pdf")
    plt.close(fig)
    print(f"wrote {OUT_DIR / 'arch.jpeg'} and arch.pdf")


if __name__ == "__main__":
    build()
