import pathlib
import sys

import pytest

ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from dt import api as api_mod  # noqa: E402
from dt.runs import JobRunManager  # noqa: E402
from tests.test_management import client, fabric, state  # noqa: F401,E402


class Clock:
    def __init__(self, now=1_000_000.0):
        self.now = now

    def __call__(self):
        return self.now

    def advance(self, seconds):
        self.now += seconds


class FakeHealer:
    """Stands in for SelfHealingController: tracks what it 'currently holds' per job."""

    def __init__(self):
        self.held = {}
        self.primaries = {}
        self.forgotten = []

    def job_reservations(self, job_id):
        return list(self.held.get(job_id, []))

    def stage_nodes(self, job_id):
        return dict(self.primaries.get(job_id, {}))

    def forget_reservation(self, rid):
        self.forgotten.append(rid)


@pytest.fixture()
def clock():
    return Clock()


@pytest.fixture()
def healer():
    return FakeHealer()


@pytest.fixture()
def runs(state, clock, healer):
    mgr = JobRunManager(state, healer, clock=clock, autostart=False, default_duration_s=30)
    yield mgr
    mgr.stop()


def make_job(job_id="job-a", **extra):
    return {
        "id": job_id,
        "deadline_ms": 1000,
        "stages": [
            {"id": "s1", "resources": {"cpu_cores": 1, "mem_gb": 1}},
            {"id": "s2", "resources": {"cpu_cores": 1, "mem_gb": 1}},
        ],
        **extra,
    }


def commit(state, job_id="job-a"):
    """Reserve capacity for two stages and return a plan shaped like POST /plan's."""
    nodes = sorted(state.nodes_by_name)[:2]
    per_stage, reservations = [], []
    for sid, node, compute in zip(("s1", "s2"), nodes, (300.0, 100.0)):
        rid = state.reserve({"node": node, "cpu_cores": 1, "mem_gb": 1, "gpu_vram_gb": 0})
        assert rid
        per_stage.append(
            {"id": sid, "node": node, "format": "native", "compute_ms": compute, "xfer_ms": 0.0, "reservation_id": rid}
        )
        reservations.append({"node": node, "reservation_id": rid, "stage_id": sid, "role": "primary"})
    return {
        "job_id": job_id,
        "strategy": "greedy",
        "latency_ms": 400.0,
        "deadline_ms": 1000.0,
        "per_stage": per_stage,
        "reservations": reservations,
    }


def held_count(state):
    return sum(len(v) for v in state.reservations_view().values())


def event_types(state):
    return [e["type"] for e in state.recent_events(limit=200)]


# --------------------------------------------------------------------- start


def test_start_creates_a_running_job_with_the_default_timer(runs, state, clock):
    run = runs.start(make_job(), commit(state))
    assert run["state"] == "running"
    assert run["duration_s"] == 30
    assert run["remaining_s"] == 30
    assert run["progress"] == 0
    assert run["reservation_count"] == 2
    assert run["predicted"]["latency_ms"] == 400.0
    assert run["meets_deadline"] is True
    assert "fabric.run.started" in event_types(state)
    assert runs.reserved_by_running() == 2


def test_timer_source_is_argument_then_job_then_default(runs, state):
    assert runs.start(make_job("a"), commit(state, "a"), duration_s=5)["duration_s"] == 5
    assert runs.start(make_job("b", duration_s=12), commit(state, "b"))["duration_s"] == 12
    assert runs.start(make_job("c"), commit(state, "c"))["duration_s"] == 30
    assert runs.start(make_job("d", duration_s=12), commit(state, "d"), duration_s=7)["duration_s"] == 7


@pytest.mark.parametrize("bad", [0, 0.5, -3, "soon", 100_000])
def test_invalid_timers_are_rejected(runs, state, bad):
    with pytest.raises(ValueError):
        runs.start(make_job(), commit(state), duration_s=bad)


# ------------------------------------------------------------------ progress


def test_stage_progress_follows_the_timer(runs, state, clock):
    run = runs.start(make_job(), commit(state))
    # s1 is 300 of 400 ms of the work, so it owns the first 75% of the 30 s timer.
    assert [s["status"] for s in run["stages"]] == ["active", "pending"]
    clock.advance(10)
    run = runs.get(run["run_id"])
    assert run["progress"] == pytest.approx(10 / 30, abs=1e-3)
    assert [s["status"] for s in run["stages"]] == ["active", "pending"]
    clock.advance(15)
    run = runs.get(run["run_id"])
    assert [s["status"] for s in run["stages"]] == ["done", "active"]
    assert run["stages"][0]["share"] == pytest.approx(0.75)


def test_a_down_node_marks_the_run_disrupted(runs, state):
    plan = commit(state)
    run = runs.start(make_job(), plan)
    assert run["disrupted"] is False
    node = plan["per_stage"][0]["node"]
    state.apply_observation({"action": "apply", "payload": {"type": "node", "node": node, "changes": {"down": True}}})
    run = runs.get(run["run_id"])
    assert run["disrupted"] is True
    assert run["stages"][0]["node_down"] is True


# --------------------------------------------------------------- the timer


def test_the_timer_frees_every_reservation(runs, state, clock):
    run = runs.start(make_job(), commit(state))
    assert held_count(state) == 2

    clock.advance(29)
    assert runs.tick() == []
    assert held_count(state) == 2

    clock.advance(2)
    assert runs.tick() == [run["run_id"]]
    assert held_count(state) == 0
    for node in state.nodes_by_name.values():
        assert node["dyn"]["used_cpu_cores"] == 0

    done = runs.get(run["run_id"])
    assert done["state"] == "completed"
    assert done["end_reason"] == "timer"
    assert done["released"] == 2
    assert done["progress"] == 1
    types = event_types(state)
    assert "fabric.run.completed" in types
    assert types.count("fabric.reservation.released") == 2


def test_extending_the_timer_delays_the_end(runs, state, clock):
    run = runs.start(make_job(), commit(state))
    clock.advance(20)
    updated = runs.set_timer(run["run_id"], extend_s=30)
    assert updated["remaining_s"] == pytest.approx(40)
    assert updated["timer_changes"] == 1
    clock.advance(35)
    assert runs.tick() == []
    clock.advance(10)
    assert runs.tick() == [run["run_id"]]
    assert "fabric.run.timer" in event_types(state)


def test_setting_the_remaining_time_shortens_or_lengthens(runs, state, clock):
    run = runs.start(make_job(), commit(state))
    clock.advance(5)
    assert runs.set_timer(run["run_id"], remaining_s=2)["remaining_s"] == pytest.approx(2)
    clock.advance(3)
    assert runs.tick() == [run["run_id"]]


def test_a_negative_extension_cannot_end_the_run_in_the_past(runs, state, clock):
    run = runs.start(make_job(), commit(state))
    clock.advance(10)
    updated = runs.set_timer(run["run_id"], extend_s=-1000)
    assert updated["remaining_s"] == 0
    assert runs.tick() == [run["run_id"]]


def test_timer_changes_need_a_value_and_a_running_job(runs, state):
    run = runs.start(make_job(), commit(state))
    with pytest.raises(ValueError):
        runs.set_timer(run["run_id"])
    with pytest.raises(ValueError):
        runs.set_timer(run["run_id"], remaining_s=0)
    with pytest.raises(ValueError):
        runs.set_timer(run["run_id"], extend_s="abc")
    runs.finish(run["run_id"])
    with pytest.raises(RuntimeError):
        runs.set_timer(run["run_id"], extend_s=5)
    with pytest.raises(KeyError):
        runs.set_timer("run-999999", extend_s=5)


# --------------------------------------------------------- finish and cancel


def test_finish_now_frees_and_marks_it_manual(runs, state):
    run = runs.start(make_job(), commit(state))
    done = runs.finish(run["run_id"])
    assert done["state"] == "completed" and done["end_reason"] == "manual"
    assert held_count(state) == 0


def test_cancel_frees_and_marks_cancelled(runs, state, clock):
    run = runs.start(make_job(), commit(state))
    clock.advance(10)
    done = runs.cancel(run["run_id"])
    assert done["state"] == "cancelled" and done["released"] == 2
    assert held_count(state) == 0
    assert "fabric.run.cancelled" in event_types(state)
    assert all(s["status"] in ("done", "cancelled") for s in done["stages"])


def test_an_ended_run_cannot_be_ended_again(runs, state):
    run = runs.start(make_job(), commit(state))
    runs.finish(run["run_id"])
    with pytest.raises(RuntimeError):
        runs.finish(run["run_id"])
    with pytest.raises(RuntimeError):
        runs.cancel(run["run_id"])
    with pytest.raises(KeyError):
        runs.finish("run-nope")


def test_finish_all_ends_every_running_job(runs, state):
    runs.start(make_job("a"), commit(state, "a"))
    runs.start(make_job("b"), commit(state, "b"))
    assert held_count(state) == 4
    assert len(runs.finish_all()) == 2
    assert held_count(state) == 0
    assert runs.list("running") == []
    assert len(runs.list("finished")) == 2


def test_list_orders_running_soonest_first_and_finished_newest_first(runs, state, clock):
    a = runs.start(make_job("a"), commit(state, "a"), duration_s=50)
    b = runs.start(make_job("b"), commit(state, "b"), duration_s=10)
    assert [r["run_id"] for r in runs.list("running")] == [b["run_id"], a["run_id"]]
    runs.finish(a["run_id"])
    clock.advance(1)
    runs.finish(b["run_id"])
    assert [r["run_id"] for r in runs.list("finished")] == [b["run_id"], a["run_id"]]


# ----------------------------------------------------- self-healing id swap


def test_reservations_added_by_self_healing_are_freed_too(runs, state, healer):
    plan = commit(state)
    run = runs.start(make_job(), plan)
    # After a failover the healer holds a different primary and a shadow the run never saw.
    node = sorted(state.nodes_by_name)[0]
    swapped = state.reserve({"node": node, "cpu_cores": 1, "mem_gb": 1, "gpu_vram_gb": 0})
    healer.held["job-a"] = [(node, swapped)]
    assert held_count(state) == 3

    runs.finish(run["run_id"])
    assert held_count(state) == 0
    assert swapped in healer.forgotten


def test_two_live_runs_of_one_job_only_free_their_own_ids(runs, state, healer):
    first = runs.start(make_job(), commit(state))
    runs.start(make_job(), commit(state))
    node = sorted(state.nodes_by_name)[0]
    shared = state.reserve({"node": node, "cpu_cores": 1, "mem_gb": 1, "gpu_vram_gb": 0})
    healer.held["job-a"] = [(node, shared)]

    runs.finish(first["run_id"])
    assert shared in {rid for res in state.reservations_view().values() for rid in res}
    assert held_count(state) == 3  # the other run's two plus the shared one


def test_failed_over_stage_is_reported(runs, state, healer):
    plan = commit(state)
    run = runs.start(make_job(), plan)
    other = sorted(state.nodes_by_name)[1]
    healer.primaries["job-a"] = {"s1": other}
    stage = runs.get(run["run_id"])["stages"][0]
    assert stage["current_node"] == other
    assert stage["failed_over"] is (other != plan["per_stage"][0]["node"])


# ----------------------------------------------------------------- settings


def test_settings_can_be_changed_and_are_validated(runs):
    assert runs.settings() == {"auto_release": True, "default_duration_s": 30.0}
    assert runs.update_settings(auto_release=False, default_duration_s=90) == {
        "auto_release": False,
        "default_duration_s": 90.0,
    }
    with pytest.raises(ValueError):
        runs.update_settings(default_duration_s=0)
    assert runs.settings()["default_duration_s"] == 90.0


def test_forget_all_drops_every_record(runs, state):
    runs.start(make_job(), commit(state))
    assert runs.forget_all() == 1
    assert runs.list() == []


# ---------------------------------------------------------------------- API


@pytest.fixture()
def api(client, runs, monkeypatch):
    monkeypatch.delenv("FABRIC_API_KEY", raising=False)
    monkeypatch.setattr(api_mod, "RUNS", runs)
    return client


def test_runs_routes_list_get_finish_and_cancel(api, runs, state):
    first = runs.start(make_job("a"), commit(state, "a"))
    second = runs.start(make_job("b"), commit(state, "b"))

    data = api.get("/runs").get_json()["data"]
    assert {r["run_id"] for r in data["runs"]} == {first["run_id"], second["run_id"]}
    assert data["settings"]["default_duration_s"] == 30.0
    assert data["reserved_by_running"] == 4
    assert isinstance(data["now_ms"], int)
    assert api.get("/runs?state=finished").get_json()["data"]["runs"] == []
    assert api.get("/runs?state=nonsense").status_code == 400

    assert api.get(f"/runs/{first['run_id']}").get_json()["data"]["job_id"] == "a"
    assert api.get("/runs/run-missing").status_code == 404

    done = api.post(f"/runs/{first['run_id']}/finish").get_json()["data"]
    assert done["state"] == "completed"
    assert api.post(f"/runs/{first['run_id']}/finish").status_code == 409
    assert api.post("/runs/run-missing/cancel").status_code == 404
    cancelled = api.post(f"/runs/{second['run_id']}/cancel").get_json()["data"]
    assert cancelled["state"] == "cancelled"
    assert held_count(state) == 0


def test_timer_route_validates_input(api, runs, state):
    run = runs.start(make_job(), commit(state))
    rid = run["run_id"]
    ok = api.post(f"/runs/{rid}/timer", json={"extend_s": 15})
    assert ok.status_code == 200 and ok.get_json()["data"]["remaining_s"] == pytest.approx(45)
    assert api.post(f"/runs/{rid}/timer", json={"remaining_s": 7}).get_json()["data"]["remaining_s"] == pytest.approx(7)
    assert api.post(f"/runs/{rid}/timer", json={}).status_code == 400
    assert api.post(f"/runs/{rid}/timer", json={"remaining_s": "x"}).status_code == 400
    assert api.post("/runs/run-missing/timer", json={"extend_s": 1}).status_code == 404


def test_settings_routes(api):
    assert api.get("/runs/settings").get_json()["data"]["auto_release"] is True
    res = api.post("/runs/settings", json={"auto_release": False, "default_duration_s": 45})
    assert res.get_json()["data"] == {"auto_release": False, "default_duration_s": 45.0}
    assert api.post("/runs/settings", json={"default_duration_s": -5}).status_code == 400


def test_finish_all_route(api, runs, state):
    runs.start(make_job("a"), commit(state, "a"))
    runs.start(make_job("b"), commit(state, "b"))
    data = api.post("/runs/finish_all").get_json()["data"]
    assert data["finished"] == 2
    assert held_count(state) == 0


def test_plan_rejects_a_bad_timer_before_reserving_anything(api):
    job = make_job()
    res = api.post("/plan", json={"job": job, "dry_run": False, "duration_s": 0})
    assert res.status_code == 400
    assert api.post("/plan", json={"job": {**job, "duration_s": "soon"}, "dry_run": False}).status_code == 400


def test_dry_runs_never_start_a_run(api):
    job = {"id": "dry", "stages": [{"id": "s1", "resources": {"cpu_cores": 1, "mem_gb": 1}, "allowed_formats": ["native"]}]}
    data = api.post("/plan", json={"job": job, "dry_run": True}).get_json()["data"]
    assert data["run"] is None


def test_twin_restart_drops_runs(api, runs, state):
    runs.start(make_job(), commit(state))
    data = api.post("/twin/restart", json={"confirm": "confirm"}).get_json()["data"]
    assert data["runs_dropped"] == 1
    assert api.get("/runs").get_json()["data"]["runs"] == []


def test_run_controls_are_gated_when_an_api_key_is_set(api, runs, state, monkeypatch):
    run = runs.start(make_job(), commit(state))
    rid = run["run_id"]
    monkeypatch.setenv("FABRIC_API_KEY", "s3cret")
    # Reads stay open.
    assert api.get("/runs").status_code == 200
    assert api.get(f"/runs/{rid}").status_code == 200
    assert api.get("/runs/settings").status_code == 200
    # Everything that changes a run needs the key.
    for path, body in (
        (f"/runs/{rid}/finish", None),
        (f"/runs/{rid}/cancel", None),
        (f"/runs/{rid}/timer", {"extend_s": 5}),
        ("/runs/finish_all", None),
        ("/runs/settings", {"auto_release": False}),
    ):
        assert api.post(path, json=body).status_code == 401, path
    assert api.get(f"/runs/{rid}").get_json()["data"]["state"] == "running"
    ok = api.post(f"/runs/{rid}/finish", headers={"X-API-Key": "s3cret"})
    assert ok.status_code == 200
