import pathlib
import sys

import pytest
import yaml

ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from dt.state import DTState  # noqa: E402
from sim.blast_radius import (  # noqa: E402
    BlastRadiusSearch,
    Fault,
    apply_fault,
    candidate_faults,
    load_job,
    render_text,
    revert_fault,
)


def node(name, zone, cores=16, ram=64, tdp=200.0):
    return {
        "name": name,
        "class": "server",
        "arch": "amd64",
        "role": "worker",
        "cpu": {"cores": cores, "base_ghz": 3.0},
        "memory": {"ram_gb": ram},
        "gpu": {"vram_gb": 0},
        "power": {"tdp_w": tdp},
        "network": {"fabric": "ethernet", "speed_gbps": 10},
        "labels": {"zone": zone},
        "formats_supported": ["native", "wasm"],
        "health": {},
    }


JOB = {
    "id": "search-me",
    "deadline_ms": 3000,
    "stages": [{"id": "s1", "size_mb": 50, "resources": {"cpu_cores": 4, "mem_gb": 8}}],
}


@pytest.fixture()
def fabric(tmp_path):
    """Three nodes: one fast, two slower fallbacks in a second zone."""
    nodes = tmp_path / "nodes"
    nodes.mkdir()
    (nodes / "fast.yaml").write_text(yaml.safe_dump(node("fast", "rackA", cores=64)), encoding="utf-8")
    (nodes / "mid.yaml").write_text(yaml.safe_dump(node("mid", "rackB", cores=8)), encoding="utf-8")
    (nodes / "slow.yaml").write_text(yaml.safe_dump(node("slow", "rackB", cores=4)), encoding="utf-8")
    topo = tmp_path / "topology.yaml"
    topo.write_text(yaml.safe_dump({"defaults": {}, "links": []}), encoding="utf-8")
    state = DTState(
        nodes_dir=str(nodes),
        topology_path=str(topo),
        overrides_path=str(tmp_path / "o.json"),
        auto_start_watchers=False,
    )
    yield state
    state.stop()


# ----------------------------- faults -----------------------------


def test_apply_and_revert_leave_no_trace(fabric):
    before = fabric.get_node("fast")["dyn"]["down"]
    f = Fault("node_down", "fast")

    apply_fault(fabric, f)
    assert fabric.get_node("fast")["dyn"]["down"] is True

    revert_fault(fabric, f)
    assert fabric.get_node("fast")["dyn"]["down"] == before


def test_zone_blackout_hits_every_node_in_the_zone(fabric):
    f = Fault("zone_blackout", "rackB")

    apply_fault(fabric, f)
    assert fabric.get_node("mid")["dyn"]["down"] is True
    assert fabric.get_node("slow")["dyn"]["down"] is True
    assert fabric.get_node("fast")["dyn"]["down"] is False

    revert_fault(fabric, f)
    assert fabric.get_node("mid")["dyn"]["down"] is False


def test_candidate_space_focuses_node_faults_on_the_nodes_in_use(fabric):
    faults = candidate_faults(fabric, focus_nodes=["fast"])
    kinds = {(f.kind, f.target) for f in faults}

    assert ("node_down", "fast") in kinds
    assert ("thermal_derate", "fast") in kinds
    # A node the plan never used cannot break the job, so it is not searched.
    assert ("node_down", "slow") not in kinds
    # Zones are always searched, since a blackout can remove unseen fallbacks.
    assert ("zone_blackout", "rackA") in kinds and ("zone_blackout", "rackB") in kinds


# ----------------------------- search -----------------------------


def test_trials_are_independent(fabric):
    """A derate leaves sticky predictive history; the search must rewind it."""
    search = BlastRadiusSearch(fabric, JOB)
    first = search.evaluate().latency_ms

    search.evaluate([Fault("thermal_derate", "fast", 0.6)])

    assert search.evaluate().latency_ms == pytest.approx(first)


def test_finds_the_single_fault_that_breaks_a_tight_job(fabric):
    search = BlastRadiusSearch(fabric, JOB, deadline_ms=1.0)  # nothing can meet 1 ms
    report = search.run(max_depth=1)

    assert report["verdict"].startswith("job already misses")
    assert report["baseline"]["broken"]


def test_reports_survival_when_nothing_breaks(fabric):
    search = BlastRadiusSearch(fabric, JOB, deadline_ms=10_000_000.0)
    # Faults that cannot strip the fabric of all capacity. (Blacking out every
    # zone leaves nowhere to place the job, which is correctly "broken" — so a
    # generous deadline alone does not guarantee survival.)
    report = search.run(
        faults=[Fault("node_down", "mid"), Fault("node_down", "slow")], max_depth=2, branch=4
    )

    assert report["minimal_breaking_sets"] == []
    assert report["verdict"] == "survives every fault combination searched"
    assert report["most_common_fault"] is None
    assert report["search"]["evaluations"] > 0


def test_breaking_sets_are_minimal(fabric):
    """No reported set may contain a smaller set that already breaks the job."""
    baseline = BlastRadiusSearch(fabric, JOB).evaluate().latency_ms
    # A deadline just above the untouched plan: losing the fast node breaks it.
    search = BlastRadiusSearch(fabric, JOB, deadline_ms=baseline * 1.05)
    report = search.run(max_depth=2, branch=6)

    sets = [{(f["kind"], f["target"]) for f in entry["faults"]} for entry in report["minimal_breaking_sets"]]
    assert sets, "expected at least one breaking set"
    for i, outer in enumerate(sets):
        for j, inner in enumerate(sets):
            if i != j:
                assert not inner < outer, f"{outer} contains the smaller breaking set {inner}"


def test_most_common_fault_points_at_the_shared_cause(fabric):
    baseline = BlastRadiusSearch(fabric, JOB).evaluate().latency_ms
    search = BlastRadiusSearch(fabric, JOB, deadline_ms=baseline * 1.05)
    report = search.run(max_depth=2, branch=6)

    common = report["most_common_fault"]
    assert common is not None
    # Everything hinges on the fast node, whether killed directly or by zone.
    assert common["target"] in {"fast", "rackA"}


def test_max_sets_truncates_and_says_so(fabric):
    baseline = BlastRadiusSearch(fabric, JOB).evaluate().latency_ms
    search = BlastRadiusSearch(fabric, JOB, deadline_ms=baseline * 1.05)
    report = search.run(max_depth=2, branch=6, max_sets=1)

    assert len(report["minimal_breaking_sets"]) == 1
    assert report["search"]["truncated"]


def test_search_restores_the_fabric_completely(fabric):
    before = {name: dict(n.get("dyn") or {}) for name, n in fabric.nodes_by_name.items()}

    BlastRadiusSearch(fabric, JOB).run(max_depth=2, branch=5)

    after = {name: dict(n.get("dyn") or {}) for name, n in fabric.nodes_by_name.items()}
    for name in before:
        for field in ("down", "thermal_derate"):
            assert after[name][field] == before[name][field], f"{name}.{field} left modified"


def test_report_renders_readable_text(fabric):
    report = BlastRadiusSearch(fabric, JOB).run(max_depth=1)
    text = render_text(report)

    assert "Blast radius — job search-me" in text
    assert "baseline" in text and "searched" in text


# ----------------------------- CLI helpers -----------------------------


def test_load_job_by_id(tmp_path):
    (tmp_path / "a.yaml").write_text(
        yaml.safe_dump({"jobs": [{"id": "one", "stages": []}, {"id": "two", "stages": []}]}),
        encoding="utf-8",
    )
    assert load_job("two", tmp_path)["id"] == "two"
    assert load_job(None, tmp_path)["id"] == "one"


def test_load_job_lists_options_when_missing(tmp_path):
    (tmp_path / "a.yaml").write_text(yaml.safe_dump({"jobs": [{"id": "one", "stages": []}]}), encoding="utf-8")
    with pytest.raises(SystemExit) as excinfo:
        load_job("nope", tmp_path)
    assert "one" in str(excinfo.value)
