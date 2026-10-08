import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from tools.benchmark_srs_table import (
    STRATEGIES,
    assemble_rows,
    render_table,
)


def gate_row(strategy, worst_sla_pct=100.0, worst_p95_ms=1000.0):
    return {
        "strategy": strategy,
        "worst_sla_pct": worst_sla_pct,
        "worst_p95_ms": worst_p95_ms,
    }


def policy_row(latency_avg=1000.0, energy_avg=0.01):
    return {"latency_avg": latency_avg, "energy_avg": energy_avg}


def full_inputs(**overrides):
    gate = {s: gate_row(s) for s in STRATEGIES}
    policy = {s: policy_row() for s in STRATEGIES}
    for strategy, patch in overrides.items():
        gate[strategy].update(patch.get("gate", {}))
        policy[strategy].update(patch.get("policy", {}))
    return gate, policy


def test_assemble_rows_covers_all_four_real_strategies_in_order():
    gate, policy = full_inputs()
    rows = assemble_rows(gate, policy)
    assert [r["strategy"] for r in rows] == [
        "Greedy",
        "Cheapest-Energy",
        "Resilient",
        "RL-Markov",
    ]
    # No DDQN-HTRCS row — nothing in this codebase implements it.
    assert all("DDQN" not in r["strategy"] for r in rows)


def test_latency_converted_ms_to_seconds():
    gate, policy = full_inputs(greedy={"policy": {"latency_avg": 1050.3935}})
    rows = assemble_rows(gate, policy)
    assert rows[0]["mean_jct_s"] == 1.05


def test_p95_converted_ms_to_seconds():
    gate, policy = full_inputs(resilient={"gate": {"worst_p95_ms": 1720.62}})
    rows = assemble_rows(gate, policy)
    assert rows[2]["p95_jct_s"] == 1.72


def test_energy_converted_kj_to_j():
    gate, policy = full_inputs(**{"rl-markov": {"policy": {"energy_avg": 0.016233333}}})
    rows = assemble_rows(gate, policy)
    assert rows[3]["energy_j"] == 16.2


def test_sla_hit_rate_passed_through_as_percent():
    gate, policy = full_inputs(resilient={"gate": {"worst_sla_pct": 83.33}})
    rows = assemble_rows(gate, policy)
    assert rows[2]["sla_hit_rate_pct"] == 83.3


def test_missing_p95_renders_as_em_dash_not_crash():
    gate, policy = full_inputs(greedy={"gate": {"worst_p95_ms": None}})
    rows = assemble_rows(gate, policy)
    assert rows[0]["p95_jct_s"] is None
    assert "—" in render_table(rows)


def test_render_table_is_markdown_with_no_ddqn():
    gate, policy = full_inputs()
    text = render_table(assemble_rows(gate, policy))
    assert text.startswith("| Strategy |")
    assert "DDQN" not in text
    assert text.count("\n") == 5  # header + separator + 4 rows
