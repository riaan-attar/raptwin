import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from dt import api as api_mod  # noqa: E402
from tests.test_management import (
    client,
    fabric,
    node_descriptor,
    state,
)  # noqa: F401,E402


def job():
    return {
        "id": "restart-job",
        "deadline_ms": 60000,
        "stages": [
            {
                "id": "s1",
                "type": "io",
                "size_mb": 10,
                "resources": {"cpu_cores": 1, "mem_gb": 1},
                "allowed_formats": ["native"],
            }
        ],
    }


def dirty_the_twin(client, state):
    """Hold a reservation, inject a fault and an ad-hoc link so there is something to wipe.

    The reservation goes straight onto the fixture's state: the API's planner objects
    are bound to the module-level twin, so committing through /plan would not touch it.
    """
    node = sorted(state.nodes_by_name)[0]
    assert state.reserve({"node": node, "cpu_cores": 1, "mem_gb": 1, "gpu_vram_gb": 0})
    api_mod.RECENT_PLANS.appendleft({"job_id": "stale"})
    client.post(
        "/observe",
        json={
            "action": "apply",
            "payload": {
                "type": "node",
                "node": node,
                "changes": {"down": True, "thermal_derate": 0.4},
            },
        },
    )
    client.post(
        "/observe",
        json={
            "action": "apply",
            "payload": {
                "type": "link",
                "key": "ghost-a|ghost-b",
                "changes": {"loss_pct": 9},
            },
        },
    )
    return node


def node_by_name(client, name):
    nodes = client.get("/snapshot").get_json()["data"]["nodes"]
    return next(n for n in nodes if n["name"] == name)


def test_restart_requires_the_confirmation_phrase(client, state):
    node = dirty_the_twin(client, state)
    for body in ({}, {"confirm": "yes"}, {"confirm": ""}):
        res = client.post("/twin/restart", json=body)
        assert res.status_code == 400
    assert node_by_name(client, node)["dyn"]["down"] is True
    assert api_mod.RECENT_PLANS


def test_restart_rebuilds_the_twin_from_disk(client, state):
    node = dirty_the_twin(client, state)
    assert node_by_name(client, node)["dyn"]["reservations"]

    res = client.post("/twin/restart", json={"confirm": "confirm"})
    assert res.status_code == 200
    data = res.get_json()["data"]
    assert data["reservations_dropped"] >= 1
    assert data["plans_cleared"] >= 1
    assert data["nodes"] >= 1

    after = node_by_name(client, node)
    assert not after["dyn"]["reservations"]
    assert after["dyn"]["down"] is False
    assert after["dyn"]["thermal_derate"] == 0
    assert after["dyn"]["used_cpu_cores"] == 0
    snap = client.get("/snapshot").get_json()["data"]
    assert all(l["key"] != "ghost-a|ghost-b" for l in snap["links"])
    assert len(api_mod.RECENT_PLANS) == 0
    types = [e["type"] for e in client.get("/events").get_json()["data"]["events"]]
    assert "fabric.twin.restarted" in types


def test_confirmation_is_case_insensitive_and_trimmed(client):
    assert (
        client.post("/twin/restart", json={"confirm": "  CONFIRM "}).status_code == 200
    )


def test_restart_is_gated_when_an_api_key_is_set(client, monkeypatch):
    monkeypatch.setenv("FABRIC_API_KEY", "s3cret")
    assert client.post("/twin/restart", json={"confirm": "confirm"}).status_code == 401
    ok = client.post(
        "/twin/restart", json={"confirm": "confirm"}, headers={"X-API-Key": "s3cret"}
    )
    assert ok.status_code == 200


def test_planning_works_after_a_restart(client, state):
    dirty_the_twin(client, state)
    client.post("/twin/restart", json={"confirm": "confirm"})
    plan = client.post("/plan", json={"job": job(), "dry_run": True}).get_json()["data"]
    assert not plan["infeasible"]
