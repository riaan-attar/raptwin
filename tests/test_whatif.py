import pathlib
import sys

import pytest
import yaml

ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from dt.state import DTState  # noqa: E402
from dt.whatif import ChangeError, apply_changes, compare  # noqa: E402
from sim.blast_radius import Fault  # noqa: E402


def node(name, zone="rackA", cores=4, ram=16):
    return {
        "name": name,
        "class": "server",
        "arch": "amd64",
        "role": "worker",
        "cpu": {"cores": cores, "base_ghz": 3.0},
        "memory": {"ram_gb": ram},
        "gpu": {"vram_gb": 0},
        "power": {"tdp_w": 150.0},
        "network": {"fabric": "ethernet", "speed_gbps": 10},
        "labels": {"zone": zone},
        "formats_supported": ["native", "wasm"],
        "health": {},
    }


def job(job_id, cores=4, mem=16, deadline=900):
    """Sized to fill a whole node, so several jobs must contend for capacity."""
    return {
        "id": job_id,
        "deadline_ms": deadline,
        "stages": [{"id": "s1", "size_mb": 20, "resources": {"cpu_cores": cores, "mem_gb": mem}}],
    }


@pytest.fixture()
def paths(tmp_path):
    nodes = tmp_path / "nodes"
    nodes.mkdir()
    (nodes / "n1.yaml").write_text(yaml.safe_dump(node("n1")), encoding="utf-8")
    topo = tmp_path / "topology.yaml"
    topo.write_text(yaml.safe_dump({"defaults": {}, "links": []}), encoding="utf-8")
    return {
        "nodes_dir": str(nodes),
        "topology_path": str(topo),
        "overrides_path": str(tmp_path / "o.json"),
    }


def state_from(paths):
    return DTState(
        nodes_dir=paths["nodes_dir"],
        topology_path=paths["topology_path"],
        overrides_path=paths["overrides_path"],
        auto_start_watchers=False,
    )


# ----------------------------- change sets -----------------------------


def test_clone_adds_capacity_without_touching_disk(paths, tmp_path):
    state = state_from(paths)
    try:
        applied = apply_changes(state, {"clone_nodes": [{"from": "n1", "count": 2}]})
        assert applied == ["cloned n1 x2"]
        assert {n["name"] for n in state.snapshot()["nodes"]} == {"n1", "n1-whatif1", "n1-whatif2"}
    finally:
        state.stop()
    # The fork must not have written the clones into nodes/.
    assert {p.name for p in pathlib.Path(paths["nodes_dir"]).glob("*.yaml")} == {"n1.yaml"}


def test_patch_merges_deeply(paths):
    state = state_from(paths)
    try:
        apply_changes(state, {"patch_nodes": {"n1": {"cpu": {"cores": 64}}}})
        descriptor = state.node_descriptor("n1")
        assert descriptor["cpu"]["cores"] == 64
        # Sibling keys survive the merge instead of being replaced wholesale.
        assert descriptor["cpu"]["base_ghz"] == 3.0
        assert state.get_node("n1")["caps"]["max_cpu_cores"] == 64
    finally:
        state.stop()


def test_link_changes_apply_without_persisting(paths):
    state = state_from(paths)
    try:
        apply_changes(state, {"links": [{"a": "n1", "b": "n2", "rtt_ms": 3}]})
        assert "n1|n2" in state.links_by_key
        apply_changes(state, {"remove_links": ["n1|n2"]})
        assert "n1|n2" not in state.links_by_key
    finally:
        state.stop()
    topo = yaml.safe_load(pathlib.Path(paths["topology_path"]).read_text(encoding="utf-8"))
    assert topo["links"] == []


@pytest.mark.parametrize(
    "changes,message",
    [
        ({}, "no changes"),
        ({"clone_nodes": [{"from": "ghost"}]}, "unknown node"),
        ({"remove_nodes": ["ghost"]}, "unknown node"),
        ({"patch_nodes": {"ghost": {"cpu": {}}}}, "unknown node"),
        ({"add_nodes": [{"cpu": {}}]}, "need a name"),
        ({"add_nodes": [{"name": "../escape"}]}, "may only contain"),
        ({"links": [{"a": "x"}]}, "endpoints"),
        ({"remove_links": ["nope|nope"]}, "unknown link"),
    ],
)
def test_bad_changes_are_rejected_clearly(paths, changes, message):
    state = state_from(paths)
    try:
        with pytest.raises(ChangeError) as excinfo:
            apply_changes(state, changes)
        assert message in str(excinfo.value)
    finally:
        state.stop()


# ----------------------------- comparison -----------------------------


def test_added_capacity_shows_up_when_jobs_contend(paths):
    """Three node-filling jobs on one node: two miss until capacity is added."""
    jobs = [job("a"), job("b"), job("c")]

    report = compare(**paths, jobs=jobs, changes={"clone_nodes": [{"from": "n1", "count": 2}]})

    assert report["contention"] is True
    assert report["baseline"]["met"] < report["variant"]["met"]
    assert report["deltas"]["nodes"]["diff"] == 2
    assert "more job(s) meet their deadline" in report["verdict"]


def test_without_contention_extra_capacity_looks_useless(paths):
    """Why contention defaults on: dry-run planning hides the whole effect."""
    jobs = [job("a"), job("b"), job("c")]

    report = compare(
        **paths, jobs=jobs, changes={"clone_nodes": [{"from": "n1", "count": 2}]}, contention=False
    )

    assert report["baseline"]["met"] == report["variant"]["met"]


def test_removing_capacity_is_reported_as_worse(paths):
    jobs = [job("a"), job("b")]
    state = state_from(paths)
    try:
        apply_changes(state, {"clone_nodes": [{"from": "n1", "count": 1}]})
    finally:
        state.stop()
    # Two nodes on disk, then take one away in the variant.
    pathlib.Path(paths["nodes_dir"], "n2.yaml").write_text(
        yaml.safe_dump(node("n2")), encoding="utf-8"
    )

    report = compare(**paths, jobs=jobs, changes={"remove_nodes": ["n2"]})

    assert report["variant"]["met"] < report["baseline"]["met"]
    assert "worse" in report["verdict"]


def test_faults_apply_to_both_sides(paths):
    jobs = [job("a", cores=1, mem=1, deadline=100_000)]

    report = compare(
        **paths,
        jobs=jobs,
        changes={"clone_nodes": [{"from": "n1", "count": 1}]},
        faults=[Fault("node_down", "n1")],
    )

    assert report["faults"] == ["node n1 down"]
    # n1 is down on both sides; only the variant has a surviving clone.
    assert report["baseline"]["met"] == 0
    assert report["variant"]["met"] == 1


def test_comparison_never_persists_anything(paths):
    before_nodes = {p.name for p in pathlib.Path(paths["nodes_dir"]).glob("*.yaml")}
    before_topo = pathlib.Path(paths["topology_path"]).read_text(encoding="utf-8")

    compare(
        **paths,
        jobs=[job("a")],
        changes={
            "clone_nodes": [{"from": "n1", "count": 1}],
            "links": [{"a": "n1", "b": "n1-whatif1", "rtt_ms": 1}],
        },
    )

    assert {p.name for p in pathlib.Path(paths["nodes_dir"]).glob("*.yaml")} == before_nodes
    assert pathlib.Path(paths["topology_path"]).read_text(encoding="utf-8") == before_topo


def test_report_carries_cost_and_carbon(paths):
    report = compare(
        **paths, jobs=[job("a")], changes={"patch_nodes": {"n1": {"cpu": {"cores": 32}}}}
    )
    for side in ("baseline", "variant"):
        assert report[side]["cost_total"] is not None
        assert report[side]["co2_g"] is not None
        assert report[side]["fabric"]["cpu_cores"] > 0


def test_no_jobs_is_an_error(paths):
    with pytest.raises(ChangeError):
        compare(**paths, jobs=[], changes={"clone_nodes": [{"from": "n1"}]})
