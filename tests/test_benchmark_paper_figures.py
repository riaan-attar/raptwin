import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from tools.benchmark_paper_figures import (
    JOB_LIMITS,
    SLA_SCENARIOS,
    STRATEGIES,
    plot_jct_vs_load,
    plot_sla_by_scenario,
)


def test_strategy_list_has_no_fabricated_ddqn_baseline():
    assert "ddqn-htrcs" not in [s.lower() for s in STRATEGIES]
    assert STRATEGIES == ["greedy", "cheapest-energy", "resilient", "rl-markov"]


def test_plot_jct_vs_load_writes_both_formats(tmp_path):
    series = {s: [1.0 + i * 0.1 for i in range(len(JOB_LIMITS))] for s in STRATEGIES}
    plot_jct_vs_load(series, tmp_path)
    assert (tmp_path / "jct_vs_nodes.pdf").exists()
    assert (tmp_path / "jct_vs_nodes.png").exists()


def test_plot_sla_by_scenario_writes_both_formats(tmp_path):
    data = {s: {sc: 90.0 for sc in SLA_SCENARIOS} for s in STRATEGIES}
    plot_sla_by_scenario(data, tmp_path)
    assert (tmp_path / "chaos_survival.pdf").exists()
    assert (tmp_path / "chaos_survival.png").exists()
