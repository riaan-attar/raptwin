import json
import pathlib
import shutil
import sys

import pytest
import yaml

ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from tools import ci_gate  # noqa: E402


def result(strategy="greedy", scenario="default", sla=100.0, p95=1000.0, cost=1.0, co2=1.0):
    return {
        "strategy": strategy,
        "scenario": scenario,
        "worst_sla_pct": sla,
        "mean_sla_pct": sla,
        "worst_p95_ms": p95,
        "peak_cost": cost,
        "peak_co2_g": co2,
        "events": 1,
        "samples": [{"label": "baseline", "sla_pct": sla}],
    }


THRESHOLDS = dict(
    min_sla=80.0, max_p95_ms=None, max_cost=None, max_co2=None, baseline=None, max_regression=2.0
)


# ----------------------------- thresholds -----------------------------


def test_passing_run_has_no_failures():
    assert ci_gate.check_thresholds([result()], **THRESHOLDS) == []


def test_sla_below_threshold_fails_and_names_the_worst_moment():
    r = result(sla=55.0)
    r["samples"] = [
        {"label": "baseline", "sla_pct": 100.0},
        {"label": "after zone_blackout", "sla_pct": 55.0},
    ]
    failures = ci_gate.check_thresholds([r], **THRESHOLDS)
    assert len(failures) == 1
    assert "55.0%" in failures[0] and "after zone_blackout" in failures[0]


@pytest.mark.parametrize(
    "key,value,field",
    [("max_p95_ms", 500.0, "p95"), ("max_cost", 0.5, "cost"), ("max_co2", 0.5, "CO2")],
)
def test_absolute_ceilings(key, value, field):
    failures = ci_gate.check_thresholds([result()], **{**THRESHOLDS, key: value})
    assert len(failures) == 1 and field in failures[0]


def test_regression_against_baseline_is_reported():
    baseline = {"results": [result(sla=95.0)]}
    # A 4-point drop breaks the default 2-point budget...
    failures = ci_gate.check_thresholds(
        [result(sla=91.0)], **{**THRESHOLDS, "baseline": baseline}
    )
    assert any("regressed 4.0 points" in f for f in failures)
    # ...but stays quiet inside it.
    assert (
        ci_gate.check_thresholds([result(sla=94.0)], **{**THRESHOLDS, "baseline": baseline}) == []
    )


def test_p95_regression_budget_is_separate_from_sla():
    """Latency is the sensitive signal when deadlines are generous."""
    baseline = {"results": [result(p95=1000.0)]}
    failures = ci_gate.check_thresholds(
        [result(p95=1200.0)],
        **{**THRESHOLDS, "baseline": baseline},
        max_p95_regression_pct=10.0,
    )
    assert any("p95 regressed 20.0%" in f for f in failures)


def test_baseline_only_compares_matching_strategy_and_scenario():
    baseline = {"results": [result(strategy="resilient", sla=99.0)]}
    assert (
        ci_gate.check_thresholds(
            [result(strategy="greedy", sla=85.0)], **{**THRESHOLDS, "baseline": baseline}
        )
        == []
    )


# ----------------------------- jobs & scenarios -----------------------------


def test_deadline_scale_tightens_the_margin(tmp_path):
    jobs = tmp_path / "jobs.yaml"
    jobs.write_text(
        yaml.safe_dump({"jobs": [{"id": "a", "deadline_ms": 1000, "stages": []},
                                 {"id": "b", "stages": []}]}),
        encoding="utf-8",
    )
    loaded = ci_gate.load_jobs([str(jobs)], limit=0, deadline_scale=0.25)
    assert loaded[0]["deadline_ms"] == 250
    # A job without a deadline is left alone rather than given a fake one.
    assert "deadline_ms" not in loaded[1]


def test_job_limit_caps_the_catalogue():
    assert len(ci_gate.load_jobs(["jobs"], limit=2)) == 2


def test_inline_scenario_is_merged_into_the_topology():
    topo = {"chaos": [{"kind": "node_kill", "node": "x", "at_s": 1}], "scenarios": []}
    name, merged = ci_gate.resolve_scenario(
        {"name": "squeeze", "chaos": [{"kind": "zone_blackout", "label": "zone", "value": "lab", "at_s": 1}]},
        topo,
    )
    assert name == "squeeze"
    assert merged["scenarios"][-1]["name"] == "squeeze"
    # Inline scenarios replace the demo schedule by default.
    assert merged["chaos"] == []
    assert topo["chaos"], "the caller's topology must not be mutated"


def test_named_scenario_passes_through():
    topo = {"scenarios": [{"name": "core_link_cut"}]}
    assert ci_gate.resolve_scenario("core_link_cut", topo) == ("core_link_cut", topo)


def test_percentile_interpolates():
    assert ci_gate._percentile([10, 20, 30, 40], 95) == pytest.approx(38.5)
    assert ci_gate._percentile([7], 95) == 7
    assert ci_gate._percentile([], 95) == 0.0


# ----------------------------- end to end -----------------------------


@pytest.fixture()
def fabric(tmp_path):
    nodes = tmp_path / "nodes"
    nodes.mkdir()
    for name in ("srv-015.yaml", "ws-014.yaml", "hpc-053.yaml"):
        shutil.copy(ROOT / "nodes" / name, nodes / name)
    topo = tmp_path / "topology.yaml"
    shutil.copy(ROOT / "sim" / "topology.yaml", topo)
    jobs = tmp_path / "jobs.yaml"
    jobs.write_text(
        yaml.safe_dump(
            {
                "jobs": [
                    {
                        "id": "tiny",
                        "deadline_ms": 9_000,
                        "stages": [{"id": "s1", "size_mb": 10, "resources": {"cpu_cores": 1, "mem_gb": 1}}],
                    }
                ]
            }
        ),
        encoding="utf-8",
    )
    return tmp_path


def test_gate_passes_and_writes_reports(fabric, tmp_path):
    out_json = tmp_path / "out" / "gate.json"
    out_md = tmp_path / "out" / "gate.md"
    code = ci_gate.main(
        [
            "--config", str(tmp_path / "missing.yaml"),
            "--jobs", str(fabric / "jobs.yaml"),
            "--nodes-dir", str(fabric / "nodes"),
            "--topology", str(fabric / "topology.yaml"),
            "--strategies", "greedy",
            "--scenarios", "default",
            "--min-sla", "80",
            "--json-out", str(out_json),
            "--md-out", str(out_md),
            "--quiet",
        ]
    )
    assert code == 0
    report = json.loads(out_json.read_text(encoding="utf-8"))
    assert report["passed"] and report["results"][0]["worst_sla_pct"] == 100.0
    assert report["seed"] == 7
    assert "PASS" in out_md.read_text(encoding="utf-8")


def test_gate_fails_when_the_bar_cannot_be_met(fabric, tmp_path):
    code = ci_gate.main(
        [
            "--config", str(tmp_path / "missing.yaml"),
            "--jobs", str(fabric / "jobs.yaml"),
            "--nodes-dir", str(fabric / "nodes"),
            "--topology", str(fabric / "topology.yaml"),
            "--strategies", "greedy",
            "--scenarios", "default",
            "--max-p95-ms", "1",
            "--quiet",
        ]
    )
    assert code == 1


def test_gate_is_deterministic_across_runs(fabric, tmp_path):
    args = [
        "--config", str(tmp_path / "missing.yaml"),
        "--jobs", str(fabric / "jobs.yaml"),
        "--nodes-dir", str(fabric / "nodes"),
        "--topology", str(fabric / "topology.yaml"),
        "--strategies", "bandit",
        "--scenarios", "default",
        "--quiet",
    ]
    first, second = tmp_path / "a.json", tmp_path / "b.json"
    ci_gate.main(args + ["--json-out", str(first)])
    ci_gate.main(args + ["--json-out", str(second)])
    a = json.loads(first.read_text(encoding="utf-8"))
    b = json.loads(second.read_text(encoding="utf-8"))
    assert a["results"] == b["results"]


def test_gate_leaves_the_fabric_untouched(fabric):
    before = {p.name: p.read_text(encoding="utf-8") for p in (fabric / "nodes").glob("*.yaml")}
    topo_before = (fabric / "topology.yaml").read_text(encoding="utf-8")

    ci_gate.main(
        [
            "--config", str(fabric / "missing.yaml"),
            "--jobs", str(fabric / "jobs.yaml"),
            "--nodes-dir", str(fabric / "nodes"),
            "--topology", str(fabric / "topology.yaml"),
            "--strategies", "greedy",
            "--scenarios", "default",
            "--quiet",
        ]
    )

    assert {p.name: p.read_text(encoding="utf-8") for p in (fabric / "nodes").glob("*.yaml")} == before
    assert (fabric / "topology.yaml").read_text(encoding="utf-8") == topo_before


def test_unknown_scenario_lists_the_known_ones(fabric, tmp_path):
    with pytest.raises(SystemExit) as excinfo:
        ci_gate.main(
            [
                "--config", str(tmp_path / "missing.yaml"),
                "--jobs", str(fabric / "jobs.yaml"),
                "--nodes-dir", str(fabric / "nodes"),
                "--topology", str(fabric / "topology.yaml"),
                "--scenarios", "does-not-exist",
                "--quiet",
            ]
        )
    assert "core_link_cut" in str(excinfo.value)


def test_shipped_config_is_valid_and_matches_the_baseline():
    """ci/gate.yaml and ci/baseline.json must stay in step, or CI compares apples to oranges."""
    cfg = yaml.safe_load((ROOT / "ci" / "gate.yaml").read_text(encoding="utf-8"))
    baseline = json.loads((ROOT / "ci" / "baseline.json").read_text(encoding="utf-8"))

    assert baseline["passed"], "the committed baseline should be a passing run"
    assert baseline["seed"] == cfg["seed"]
    assert baseline["deadline_scale"] == cfg["deadline_scale"]
    assert baseline["strategies"] == cfg["strategies"]
    assert len(baseline["results"]) == len(cfg["scenarios"]) * len(cfg["strategies"])
