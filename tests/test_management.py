import pathlib
import shutil
import sys
import time

import pytest
import yaml

ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from dt import api as api_mod  # noqa: E402
from dt.state import DTState  # noqa: E402


def node_descriptor(name: str, **overrides):
    desc = {
        "name": name,
        "class": "server",
        "arch": "amd64",
        "role": "worker",
        "cpu": {"cores": 8, "base_ghz": 3.0},
        "memory": {"ram_gb": 32},
        "gpu": {"vram_gb": 0},
        "formats_supported": ["native"],
        "labels": {"zone": "lab"},
        "network": {"fabric": "ethernet", "speed_gbps": 10},
    }
    desc.update(overrides)
    return desc


@pytest.fixture()
def fabric(tmp_path):
    """Isolated nodes/ + topology.yaml copies so tests never touch the repo files."""
    nodes = tmp_path / "nodes"
    nodes.mkdir()
    for name in ("srv-015.yaml", "ws-014.yaml"):
        shutil.copy(ROOT / "nodes" / name, nodes / name)
    topo = tmp_path / "topology.yaml"
    shutil.copy(ROOT / "sim" / "topology.yaml", topo)
    return tmp_path


@pytest.fixture()
def state(fabric):
    st = DTState(
        nodes_dir=str(fabric / "nodes"),
        topology_path=str(fabric / "topology.yaml"),
        overrides_path=str(fabric / "overrides.json"),
        auto_start_watchers=False,
    )
    yield st
    st.stop()


@pytest.fixture()
def client(fabric, state, monkeypatch):
    jobs = fabric / "jobs"
    jobs.mkdir()
    shutil.copy(ROOT / "jobs" / "jobs_10.yaml", jobs / "jobs_10.yaml")
    monkeypatch.setenv("FABRIC_JOBS_ROOT", str(jobs))
    monkeypatch.setattr(api_mod, "STATE", state)
    monkeypatch.setattr(api_mod, "CHAOS", api_mod.ChaosRunner(state))
    with api_mod.app.test_client() as c:
        yield c
    api_mod.CHAOS.stop()


# ----------------------------- state -----------------------------


def test_add_node_rejects_path_traversal_names(state):
    with pytest.raises(ValueError):
        state.add_or_update_node(node_descriptor("../escape"))
    assert not (state.nodes_dir.parent / "escape.yaml").exists()


def test_remove_node_drops_file_and_reservations(state):
    rid = state.reserve({"node": "srv-015", "cpu_cores": 1, "mem_gb": 1})
    assert rid

    dropped = state.remove_node("srv-015")

    assert dropped == [rid]
    assert state.get_node("srv-015") is None
    assert not (state.nodes_dir / "srv-015.yaml").exists()
    assert "srv-015" not in {n["name"] for n in state.snapshot()["nodes"]}
    assert "srv-015" not in state.predictive_overview()["nodes"]
    assert state.remove_node("srv-015") is None


def test_remove_node_is_not_resurrected_by_watcher(state):
    state.remove_node("ws-014")
    changed = state._load_nodes_locked(preserve_dyn=True)
    assert not changed
    assert state.get_node("ws-014") is None


def test_upsert_link_persists_only_links_block(state, fabric):
    before = (fabric / "topology.yaml").read_text()

    saved = state.upsert_link({"a": "srv-015", "b": "ws-014", "profile": "LAN-10G", "rtt_ms": 2})

    after = (fabric / "topology.yaml").read_text()
    assert saved["key"] == "srv-015|ws-014"
    # Comments and every other section survive the rewrite.
    assert "# Default chaos (applies unless a scenario is chosen override)" in after
    assert after.split("links:")[0] == before.split("links:")[0]
    assert after.split("placement_policies:")[1] == before.split("placement_policies:")[1]

    reloaded = yaml.safe_load(after)
    assert {"a": "srv-015", "b": "ws-014", "profile": "LAN-10G", "rtt_ms": 2.0} in reloaded["links"]
    assert len(reloaded["links"]) == len(yaml.safe_load(before)["links"]) + 1
    link = next(l for l in state.snapshot()["links"] if l["key"] == "srv-015|ws-014")
    assert link["effective"]["rtt_ms"] == 2.0


def test_upsert_link_keeps_live_chaos_state(state):
    state.upsert_link({"a": "x1", "b": "x2", "rtt_ms": 1})
    state.apply_observation(
        {"action": "apply", "payload": {"type": "link", "key": "x1|x2", "changes": {"down": True}}}
    )
    state.upsert_link({"a": "x1", "b": "x2", "rtt_ms": 3})
    assert state.links_by_key["x1|x2"]["dyn"]["down"] is True


def test_remove_link_rewrites_topology(state, fabric):
    assert state.remove_link("site-hostel|site-lab")
    links = yaml.safe_load((fabric / "topology.yaml").read_text())["links"]
    assert not any({l["a"], l["b"]} == {"site-lab", "site-hostel"} for l in links)
    assert not state.remove_link("site-hostel|site-lab")


def test_upsert_link_validation(state):
    for bad in ({"a": "x"}, {"a": "x", "b": "x"}, {"a": "x", "b": "y", "loss_pct": 140}):
        with pytest.raises(ValueError):
            state.upsert_link(bad)


def test_reset_overrides_clears_faults_and_synthetic_links(state):
    state.apply_observation(
        {"action": "apply", "payload": {"type": "node", "node": "srv-015", "changes": {"down": True}}}
    )
    state.apply_observation(
        {"action": "apply", "payload": {"type": "link", "key": "p|q", "changes": {"loss_pct": 9}}}
    )

    result = state.reset_overrides()

    assert result["nodes_reset"] == 1
    assert state.get_node("srv-015")["dyn"]["down"] is False
    assert "p|q" not in state.links_by_key


# ----------------------------- api -----------------------------


def test_node_crud_via_api(client, state):
    res = client.post("/add_node", json={"node": node_descriptor("edge-new")})
    assert res.status_code == 200, res.get_json()
    assert (state.nodes_dir / "edge-new.yaml").exists()

    desc = client.get("/nodes/edge-new").get_json()["data"]
    assert desc["cpu"]["cores"] == 8
    assert "dyn" not in desc and "caps" not in desc

    res = client.delete("/nodes/edge-new")
    assert res.status_code == 200
    assert client.get("/nodes/edge-new").status_code == 404


def test_add_node_validation(client):
    bad = node_descriptor("ok-name", cpu={"cores": 0})
    res = client.post("/add_node", json={"node": bad})
    assert res.status_code == 400
    assert "cpu.cores" in res.get_json()["error"]

    res = client.post("/add_node", json={"node": node_descriptor("a/b")})
    assert res.status_code == 400


def test_link_routes(client):
    topo = client.get("/topology").get_json()["data"]
    assert topo["link_profiles"] and "site-lab" in topo["sites"]

    res = client.post("/links", json={"link": {"a": "site-lab", "b": "srv-015", "profile": "IB-400G"}})
    assert res.status_code == 200
    key = res.get_json()["data"]["key"]

    # Re-pointing an edited link drops the old declaration.
    res = client.post(
        "/links",
        json={"link": {"a": "site-lab", "b": "ws-014"}, "original_key": key},
    )
    keys = {l["key"] for l in client.get("/topology").get_json()["data"]["links"]}
    assert "site-lab|ws-014" in keys and key not in keys

    assert client.delete("/links?key=site-lab|ws-014").status_code == 200
    assert client.delete("/links?key=site-lab|ws-014").status_code == 404


def test_job_save_edit_delete(client, fabric):
    job = {"id": "ui-job", "deadline_ms": 900, "stages": [{"id": "s1", "resources": {"cpu_cores": 1}}]}
    res = client.post("/jobs", json={"job": job})
    assert res.status_code == 200 and res.get_json()["data"]["created"]
    assert (fabric / "jobs" / "ui-job.yaml").exists()

    # Edit a job living inside the multi-job file; its header comment survives.
    catalog = client.get("/jobs").get_json()["data"]
    vision = next(e for e in catalog if e["id"] == "job-vision-small")
    edited = {**vision["job"], "deadline_ms": 1234}
    res = client.post("/jobs", json={"job": edited, "original_id": "job-vision-small"})
    assert res.status_code == 200
    text = (fabric / "jobs" / "jobs_10.yaml").read_text()
    assert text.startswith("# jobs/jobs_10.yaml")
    assert yaml.safe_load(text)["jobs"][0]["deadline_ms"] == 1234

    # Renaming onto an existing id is refused.
    res = client.post("/jobs", json={"job": {**job, "id": "job-vision-small"}, "original_id": "ui-job"})
    assert res.status_code == 409

    assert client.delete("/jobs?id=ui-job").status_code == 200
    assert not (fabric / "jobs" / "ui-job.yaml").exists()
    assert client.delete("/jobs?id=ui-job").status_code == 404


def test_job_validation(client):
    res = client.post("/jobs", json={"job": {"id": "x", "stages": []}})
    assert res.status_code == 400
    res = client.post("/jobs", json={"job": {"id": "x", "stages": [{"id": "a"}, {"id": "a"}]}})
    assert "duplicate" in res.get_json()["error"]


def test_clear_plans(client):
    job = {"id": "p1", "stages": [{"id": "s", "resources": {"cpu_cores": 1, "mem_gb": 1}}]}
    client.post("/plan", json={"job": job, "dry_run": True})
    assert client.get("/plans").get_json()["data"]
    assert client.delete("/plans").status_code == 200
    assert client.get("/plans").get_json()["data"] == []


def test_chaos_run_and_reset(client, state):
    catalog = client.get("/chaos").get_json()["data"]
    assert any(s["name"] == "core_link_cut" for s in catalog["scenarios"])

    res = client.post("/chaos/start", json={"scenario": "nope"})
    assert res.status_code == 400

    # Very fast speed so the default schedule's early events fire promptly.
    res = client.post("/chaos/start", json={"speed": 1000})
    assert res.status_code == 200
    assert client.post("/chaos/start", json={"speed": 1000}).status_code == 409

    deadline = time.time() + 5
    status = {}
    while time.time() < deadline:
        status = client.get("/chaos").get_json()["data"]["status"]
        if not status["running"]:
            break
        time.sleep(0.05)
    assert not status["running"]
    assert status["applied"] == status["total"] > 0
    assert status["log"]

    state.apply_observation(
        {"action": "apply", "payload": {"type": "node", "node": "ws-014", "changes": {"down": True}}}
    )
    res = client.post("/overrides/reset")
    assert res.status_code == 200
    assert state.get_node("ws-014")["dyn"]["down"] is False
