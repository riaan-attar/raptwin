import pathlib
import shutil
import sys

import pytest

ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from dt import api as api_mod
from dt.state import DTState
from tests.test_management import node_descriptor


@pytest.fixture()
def fabric(tmp_path):
    nodes = tmp_path / "nodes"
    nodes.mkdir()
    shutil.copy(ROOT / "nodes" / "srv-015.yaml", nodes / "srv-015.yaml")
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
    monkeypatch.delenv("FABRIC_API_KEY", raising=False)
    monkeypatch.setattr(api_mod, "STATE", state)
    monkeypatch.setattr(api_mod, "CHAOS", api_mod.ChaosRunner(state))
    with api_mod.app.test_client() as c:
        yield c
    api_mod.CHAOS.stop()


# ----------------------------- auth disabled (default) -----------------------------


def test_no_api_key_set_every_route_works_unauthenticated(client):
    """Default deployment behaviour (and every pre-FR-31 test) must be untouched."""
    assert client.get("/snapshot").status_code == 200
    res = client.post("/add_node", json={"node": node_descriptor("auth-none")})
    assert res.status_code == 200
    assert client.delete("/nodes/auth-none").status_code == 200
    assert client.post("/chaos/start", json={"speed": 1000}).status_code == 200
    client.post("/chaos/stop")


# ----------------------------- auth enabled -----------------------------


def test_mutating_route_without_header_is_rejected(client, monkeypatch):
    monkeypatch.setenv("FABRIC_API_KEY", "s3cret")
    res = client.post("/add_node", json={"node": node_descriptor("auth-a")})
    assert res.status_code == 401
    assert res.get_json() == {"ok": False, "error": "unauthorized"}


def test_mutating_route_with_wrong_key_is_rejected(client, monkeypatch):
    monkeypatch.setenv("FABRIC_API_KEY", "s3cret")
    res = client.post(
        "/add_node",
        json={"node": node_descriptor("auth-b")},
        headers={"X-API-Key": "wrong"},
    )
    assert res.status_code == 401


def test_mutating_route_with_correct_key_succeeds(client, monkeypatch):
    monkeypatch.setenv("FABRIC_API_KEY", "s3cret")
    res = client.post(
        "/add_node",
        json={"node": node_descriptor("auth-c")},
        headers={"X-API-Key": "s3cret"},
    )
    assert res.status_code == 200


@pytest.mark.parametrize(
    "method,path",
    [
        ("DELETE", "/nodes/srv-015"),
        ("POST", "/links"),
        ("DELETE", "/links"),
        ("POST", "/jobs"),
        ("DELETE", "/jobs"),
        ("DELETE", "/plans"),
        ("POST", "/chaos/start"),
        ("POST", "/chaos/stop"),
        ("POST", "/overrides/reset"),
        ("POST", "/add_node"),
    ],
)
def test_every_gated_route_rejects_without_key(client, monkeypatch, method, path):
    monkeypatch.setenv("FABRIC_API_KEY", "s3cret")
    res = client.open(path, method=method, json={})
    assert res.status_code == 401, f"{method} {path} should be gated"


def test_read_only_and_evaluation_routes_stay_open(client, monkeypatch):
    """The public dashboard must keep working with no key at all."""
    monkeypatch.setenv("FABRIC_API_KEY", "s3cret")
    assert client.get("/snapshot").status_code == 200
    assert client.get("/topology").status_code == 200
    assert client.get("/economics").status_code == 200
    assert client.get("/chaos").status_code == 200
    res = client.post(
        "/observe",
        json={
            "action": "apply",
            "payload": {"type": "node", "node": "srv-015", "changes": {"down": True}},
        },
    )
    assert res.status_code == 200


def test_stream_is_not_gated_and_resolves_promptly(client, monkeypatch):
    monkeypatch.setenv("FABRIC_API_KEY", "s3cret")
    # /stream is read-only, so it isn't in _GATED_ENDPOINTS and must stay open
    # with no key. This also guards that before_request runs before the SSE
    # generator is constructed, so a real 401 (on a gated route) would never
    # leave a hanging connection open.
    res = client.get("/stream")
    assert res.status_code == 200
    res.close()
