#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
dt/api.py — Flask API for the Fabric Digital Twin

Endpoints
---------
GET  /health
GET  /snapshot
POST /observe            { payload: {type: "node"|"link", ...} }
GET  /economics          pricing + carbon intensity in force
POST /plan               { job: {...}, dry_run?: bool, strategy?: "greedy"|"cheapest-energy" }
POST /plan_batch         { jobs: [ {...}, ... ], dry_run?: bool, strategy?: ... }
POST /release            { releases: [ {node: "...", reservation_id: "..."} ] }

Management (used by the web dashboard)
GET    /nodes/<name>              full descriptor as stored in nodes/<name>.yaml
POST   /add_node                  { node: {...} } create or update (persisted)
DELETE /nodes/<name>              remove node, its YAML and its reservations
GET    /topology                  declared links, link profiles, sites
POST   /links                     { link: {a, b, profile?, speed_gbps?, ...} }
DELETE /links?key=A|B
POST   /jobs                      { job: {...}, original_id?: "..." }
DELETE /jobs?id=...
DELETE /plans                     clear plan history
GET    /chaos                     scenarios + current run status
POST   /chaos/start               { scenario?: "...", speed?: 10 }
POST   /chaos/stop
POST   /overrides/reset           clear every injected fault

Run
---
export FLASK_APP=dt.api:app
flask run -h 0.0.0.0 -p 8080

or:

python3 -m dt.api --host 0.0.0.0 --port 8080
"""

from __future__ import annotations
import argparse
import json
import os
import threading
import time
from collections import deque
from pathlib import Path
from typing import Any, Deque, Dict, List, Optional, Tuple

from queue import Empty

from flask import Flask, Response, jsonify, request

from .chaos_runner import ChaosRunner
from .economics import Economics, annotate_plan
from .state import DTState, link_key, safe_float, safe_int, valid_name
from .cost_model import CostModel
from .exporters import as_dtdl, as_k8s_crds
from .policy.resilient import FederatedPlanner
from .policy.mdp import MarkovPlanner
from .policy.rl_stub import RLPolicy
from .policy.greedy import GreedyPlanner
from .self_heal import ResourceGuardian, SelfHealingController
from .noise import maybe_start_noise

try:
    from .policy.bandit import BanditPolicy
except Exception:  # pragma: no cover
    BanditPolicy = None  # type: ignore

import yaml

# -----------------------------------
# App singletons
# -----------------------------------

STATE = DTState()  # loads nodes/, topology, starts watcher
CM = CostModel(STATE)
FED_PLANNER = FederatedPlanner(STATE, CM)
RL_AGENT = RLPolicy(persist_path=os.environ.get("FABRIC_RL_STATE", "sim/rl_state.json"))
MDP_PLANNER = MarkovPlanner(
    STATE,
    CM,
    rl_policy=RL_AGENT,
    gamma=0.92,
    failure_penalty=10.0,
    redundancy=3,
)
BANDIT_POLICY = (
    BanditPolicy(persist_path=os.environ.get("FABRIC_BANDIT_STATE", "sim/bandit_state.json"))
    if BanditPolicy
    else None
)
GREEDY_LATENCY = GreedyPlanner(
    STATE,
    CM,
    bandit=None,
    cfg={
        "risk_weight": 10.0,
        "energy_weight": 0.0,
        "prefer_locality_bonus_ms": 0.5,
        "require_format_match": False,
    },
)
GREEDY_ENERGY = GreedyPlanner(
    STATE,
    CM,
    bandit=None,
    cfg={
        "risk_weight": 10.0,
        "energy_weight": 0.1,
        "prefer_locality_bonus_ms": 0.5,
        "require_format_match": False,
    },
)
GREEDY_BANDIT = GreedyPlanner(
    STATE,
    CM,
    bandit=BANDIT_POLICY,
    cfg={
        "risk_weight": 10.0,
        "energy_weight": 0.0,
        "prefer_locality_bonus_ms": 0.5,
        "require_format_match": False,
    },
)

# Money/carbon objectives. Weights are "ms of latency traded per unit of
# currency per hour" and "per gram of CO2 per hour"; 25 was calibrated against
# the sample fabric, where candidate nodes differ by ~2-6 gCO2/hr for ~25 ms of
# compute. See dt/economics.py.
GREEDY_COST = GreedyPlanner(
    STATE,
    CM,
    bandit=None,
    cfg={
        "risk_weight": 10.0,
        "energy_weight": 0.0,
        "cost_weight": safe_float(os.environ.get("FABRIC_COST_WEIGHT", 25.0), 25.0),
        "prefer_locality_bonus_ms": 0.5,
        "require_format_match": False,
    },
)
GREEDY_CARBON = GreedyPlanner(
    STATE,
    CM,
    bandit=None,
    cfg={
        "risk_weight": 10.0,
        "energy_weight": 0.0,
        "carbon_weight": safe_float(os.environ.get("FABRIC_CARBON_WEIGHT", 25.0), 25.0),
        "prefer_locality_bonus_ms": 0.5,
        "require_format_match": False,
    },
)

SELF_HEALER = SelfHealingController(
    STATE,
    poll_interval=safe_float(os.environ.get("FABRIC_SELF_HEAL_INTERVAL", 2.5), 2.5),
    reliability_threshold=safe_float(os.environ.get("FABRIC_SELF_HEAL_RELIABILITY", 0.75), 0.75),
    availability_threshold_sec=safe_float(os.environ.get("FABRIC_SELF_HEAL_AVAIL", 90.0), 90.0),
    stability_window=int(safe_float(os.environ.get("FABRIC_SELF_HEAL_STABILITY", 2), 2)),
)

RESOURCE_GUARDIAN = ResourceGuardian(
    STATE,
    poll_interval=safe_float(os.environ.get("FABRIC_GUARDIAN_INTERVAL", 5.0), 5.0),
    utilization_threshold=safe_float(os.environ.get("FABRIC_GUARDIAN_UTIL", 0.92), 0.92),
    reservation_ttl_sec=safe_float(os.environ.get("FABRIC_GUARDIAN_TTL", 300.0), 300.0),
)

NOISE_INJECTOR = maybe_start_noise(STATE)

CHAOS = ChaosRunner(STATE)

# Serialises edits to jobs/*.yaml so two saves can't interleave a rewrite.
_JOBS_LOCK = threading.Lock()

RECENT_PLANS: Deque[Dict[str, Any]] = deque(maxlen=200)

# How long an idle SSE connection waits before emitting a keepalive comment.
SSE_KEEPALIVE_SEC = safe_float(os.environ.get("FABRIC_SSE_KEEPALIVE", 15.0), 15.0)

app = Flask(__name__)


# -----------------------------------
# Helpers
# -----------------------------------


def _ok(data: Any, status: int = 200):
    return jsonify({"ok": True, "data": data}), status


def _err(msg: str, status: int = 400, **extra):
    return jsonify({"ok": False, "error": msg, **extra}), status


def _jobs_root() -> Path:
    base = os.environ.get("FABRIC_JOBS_ROOT", "jobs")
    return Path(base).resolve()


def _load_job_catalog() -> List[Dict[str, Any]]:
    root = _jobs_root()
    entries: List[Dict[str, Any]] = []
    if not root.exists():
        return entries
    for path in sorted(root.glob("*.y*ml")):
        try:
            content = yaml.safe_load(path.read_text(encoding="utf-8"))
        except Exception:
            continue
        jobs = _ensure_jobs(content)
        for idx, job in enumerate(jobs):
            job_id = job.get("id") or f"{path.name}#{idx + 1}"
            entries.append(
                {
                    "id": job_id,
                    "file": path.name,
                    "index": idx,
                    "path": str(path),
                    "job": job,
                }
            )
    return entries


def _node_problem(desc: Dict[str, Any]) -> Optional[str]:
    """Minimal sanity checks for a node descriptor coming from the UI.

    Full schema validation isn't enforced here: a quarter of the generated
    nodes/ files don't pass schemas/node.schema.yaml, and rejecting on it would
    make those nodes impossible to edit.
    """
    name = desc.get("name")
    if not valid_name(name):
        return "name may only contain letters, digits, '.', '_' and '-' (max 64 chars)"
    for key in ("class", "arch"):
        if not isinstance(desc.get(key), str) or not desc[key].strip():
            return f"'{key}' is required"
    cpu = desc.get("cpu")
    if not isinstance(cpu, dict) or safe_float(cpu.get("cores"), 0.0) <= 0:
        return "cpu.cores must be a positive number"
    mem = desc.get("memory")
    if not isinstance(mem, dict) or safe_float(mem.get("ram_gb"), 0.0) <= 0:
        return "memory.ram_gb must be a positive number"
    gpu = desc.get("gpu")
    if gpu is not None and not isinstance(gpu, dict):
        return "gpu must be an object"
    formats = desc.get("formats_supported")
    if formats is not None and not (
        isinstance(formats, list) and all(isinstance(f, str) for f in formats)
    ):
        return "formats_supported must be a list of strings"
    return None


def _job_problem(job: Dict[str, Any]) -> Optional[str]:
    if not valid_name(job.get("id")):
        return "job id may only contain letters, digits, '.', '_' and '-' (max 64 chars)"
    stages = job.get("stages")
    if not isinstance(stages, list) or not stages:
        return "a job needs at least one stage"
    seen = set()
    for i, stage in enumerate(stages):
        if not isinstance(stage, dict):
            return f"stage #{i + 1} must be an object"
        sid = stage.get("id")
        if not isinstance(sid, str) or not sid.strip():
            return f"stage #{i + 1} needs an id"
        if sid in seen:
            return f"duplicate stage id '{sid}'"
        seen.add(sid)
        res = stage.get("resources") or {}
        if not isinstance(res, dict):
            return f"stage '{sid}': resources must be an object"
        for key, val in res.items():
            if safe_float(val, -1.0) < 0:
                return f"stage '{sid}': resources.{key} must be a non-negative number"
    if job.get("deadline_ms") is not None and safe_float(job.get("deadline_ms"), -1.0) < 0:
        return "deadline_ms must be a non-negative number"
    return None


def _read_job_file(path: Path) -> Tuple[Any, List[Dict[str, Any]], str]:
    """(raw yaml, jobs in it, leading comment header) for a jobs/ file."""
    text = path.read_text(encoding="utf-8")
    header_lines = []
    for line in text.splitlines():
        if line.startswith("#") or (header_lines and not line.strip()):
            header_lines.append(line)
            continue
        break
    header = "\n".join(header_lines).rstrip()
    raw = yaml.safe_load(text)
    return raw, _ensure_jobs(raw), header


def _write_job_file(path: Path, raw: Any, jobs: List[Dict[str, Any]], header: str) -> None:
    if not jobs:
        path.unlink(missing_ok=True)
        return
    if isinstance(raw, dict) and isinstance(raw.get("jobs"), list):
        out: Any = {**raw, "jobs": jobs}
    elif isinstance(raw, list):
        out = jobs
    elif len(jobs) == 1:
        out = jobs[0]
    else:
        out = {"jobs": jobs}
    body = yaml.safe_dump(out, sort_keys=False, allow_unicode=True)
    path.write_text((header + "\n\n" if header else "") + body, encoding="utf-8")


def _locate_job(job_id: str) -> Optional[Tuple[Path, int]]:
    for entry in _load_job_catalog():
        if entry["id"] == job_id:
            return Path(entry["path"]), entry["index"]
    return None


def _slim_plan_for_history(plan: Dict[str, Any]) -> Dict[str, Any]:
    """Strip whole-fabric snapshots before a plan goes into RECENT_PLANS.

    ``predictive`` and ``federation_summary`` are point-in-time copies of the
    entire fabric (~70KB each), so keeping them on every one of the 200 plans
    in the ring buffer made GET /plans grow into the megabytes. Callers of
    POST /plan still get the full payload; the live values for those fields are
    available from /snapshot anyway. ``candidate_details`` is likewise a
    per-stage dump of every node the MDP planner scored.
    """

    slim = {k: v for k, v in plan.items() if k not in ("predictive", "federation_summary")}
    stages = slim.get("per_stage")
    if isinstance(stages, list):
        slim["per_stage"] = [
            {k: v for k, v in stage.items() if k != "candidate_details"}
            if isinstance(stage, dict)
            else stage
            for stage in stages
        ]
    return slim


def _ensure_jobs(obj: Any) -> List[Dict[str, Any]]:
    if isinstance(obj, list):
        return [item for item in obj if isinstance(item, dict)]
    if isinstance(obj, dict):
        if isinstance(obj.get("jobs"), list):
            return [item for item in obj["jobs"] if isinstance(item, dict)]
        return [obj]
    return []


# -----------------------------------
# Routes
# -----------------------------------


@app.get("/health")
def health():
    return _ok({"ts": STATE.snapshot()["ts"]})


@app.get("/snapshot")
def snapshot():
    return _ok(STATE.snapshot())


@app.post("/observe")
def observe():
    if not request.is_json:
        return _err("expected JSON body")
    try:
        payload = request.get_json()
        STATE.apply_observation(payload)
        return _ok({"applied": True})
    except Exception:
        app.logger.exception("/observe failed")
        return _err("observe failed", status=500)


@app.post("/plan")
def plan():
    """
    Plan a single job.
    Body:
    {
      "job": { id, deadline_ms?, stages:[ {id, size_mb?, resources{cpu_cores,mem_gb,gpu_vram_gb}, allowed_formats?, ...}, ...] },
      "strategy": "greedy"|"cheapest-energy",
      "dry_run": false
    }
    """
    if not request.is_json:
        return _err("expected JSON body")
    body = request.get_json() or {}
    job = body.get("job")
    if not job:
        return _err("missing 'job'")
    stages = job.get("stages") or []
    if not stages:
        return _err("job.stages is empty")

    try:
        strategy_raw = body.get("strategy") or "greedy"
        strategy = strategy_raw.lower().strip()
        dry_run = bool(body.get("dry_run", False))

        if strategy in {
            "resilient",
            "network-aware",
            "federated",
            "fault-tolerant",
            "ft",
            "failover",
            "balanced",
            "load-balance",
            "load-balanced",
        }:
            planner_result = FED_PLANNER.plan_job(job, dry_run=dry_run, mode=strategy)
        elif strategy in {"rl", "mdp", "rl-markov", "markov", "mdp-rl", "reinforcement"}:
            planner_result = MDP_PLANNER.plan_job(job, dry_run=dry_run)
        else:
            if strategy in {"cheapest-energy", "energy", "energy-aware"}:
                planner_obj = GREEDY_ENERGY
            elif strategy in {"cheapest-cost", "cost", "cost-aware", "cheapest"}:
                planner_obj = GREEDY_COST
            elif strategy in {"greenest", "low-carbon", "carbon", "carbon-aware"}:
                planner_obj = GREEDY_CARBON
            elif strategy in {"bandit", "bandit-greedy", "bandit-latency", "bandit-format"}:
                planner_obj = GREEDY_BANDIT if GREEDY_BANDIT is not None else GREEDY_LATENCY
            else:
                planner_obj = GREEDY_LATENCY
            planner_result = planner_obj.plan_job(job, dry_run=dry_run)

        ddl = safe_float(job.get("deadline_ms"), 0.0)
        penalty = CM.slo_penalty(ddl, planner_result.get("latency_ms", 0.0)) if ddl > 0 else 0.0

        planner_result["strategy"] = strategy_raw
        planner_result["dry_run"] = dry_run
        planner_result.setdefault("per_stage", [])
        planner_result.setdefault("reservations", [])
        planner_result.setdefault("assignments", {})
        planner_result.setdefault("federation_summary", STATE.federations_overview())
        planner_result["deadline_ms"] = ddl or None
        planner_result["slo_penalty"] = penalty
        planner_result["ts"] = int(time.time() * 1000)
        planner_result.setdefault("avg_reliability", planner_result.get("avg_reliability"))
        planner_result["predictive"] = STATE.predictive_overview()
        # Money and carbon for every strategy, not just the cost-aware ones.
        annotate_plan(STATE, job, planner_result)
        planner_result["self_healing_registered"] = False
        if not dry_run:
            try:
                SELF_HEALER.register_plan(job, planner_result)
                planner_result["self_healing_registered"] = True
            except Exception:
                app.logger.exception("failed to register plan with self-healer")
        RECENT_PLANS.appendleft(_slim_plan_for_history(planner_result))
        # Announce on the event bus so live clients refresh without polling.
        try:
            STATE.emit_event(
                "fabric.plan.committed",
                {
                    "job_id": planner_result.get("job_id"),
                    "strategy": strategy_raw,
                    "dry_run": dry_run,
                    "infeasible": bool(planner_result.get("infeasible")),
                    "latency_ms": planner_result.get("latency_ms"),
                },
                subject=str(planner_result.get("job_id") or "job"),
            )
        except Exception:
            app.logger.exception("failed to emit plan event")
        return _ok(planner_result)
    except Exception:
        app.logger.exception("/plan failed")
        return _err("planning failed", status=500)


@app.get("/plans")
def plans():
    return _ok(list(RECENT_PLANS))


@app.get("/jobs")
def jobs():
    return _ok(_load_job_catalog())


@app.get("/stream")
def stream():
    """Server-Sent Events feed of the twin's CloudEvent bus.

    Lets clients react the moment state changes instead of polling /snapshot.
    Each message carries the CloudEvent as JSON; clients decide what to refetch.
    """

    def generate():
        q = STATE.subscribe_events()
        try:
            # Prime the connection so the browser fires onopen immediately.
            yield "retry: 3000\n\n"
            yield ": connected\n\n"
            while True:
                try:
                    evt = q.get(timeout=SSE_KEEPALIVE_SEC)
                except Empty:
                    # Comment frame keeps proxies/browsers from timing out.
                    yield ": keepalive\n\n"
                    continue
                payload = json.dumps(evt, default=str)
                # Deliberately no "event:" line: named SSE events bypass
                # EventSource.onmessage, so a client would silently miss any
                # type it had not explicitly subscribed to. The CloudEvent
                # carries its own "type" field in the payload instead.
                yield f"id: {evt.get('id', '')}\ndata: {payload}\n\n"
        except GeneratorExit:
            raise
        finally:
            STATE.unsubscribe_events(q)

    return Response(
        generate(),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            # Disable proxy buffering (nginx and friends) so frames arrive live.
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/events")
def events():
    since = request.args.get("since")
    limit_int = safe_int(request.args.get("limit", 100), 100)
    limit_int = max(1, min(limit_int, 500))
    recent = STATE.recent_events(limit=limit_int, since_id=since)
    return _ok({"events": recent, "limit": limit_int, "since": since})


@app.get("/standards/dtdl")
def standards_dtdl():
    return _ok(as_dtdl(STATE))


@app.get("/standards/crds")
def standards_crds():
    return _ok(as_k8s_crds(STATE))


@app.post("/plan_batch")
def plan_batch():
    """
    Plan multiple jobs in one call.
    Body:
    {
      "jobs": [ { job }, ... ],
      "strategy": "...",
      "dry_run": false
    }
    """
    if not request.is_json:
        return _err("expected JSON body")
    body = request.get_json() or {}
    jobs = body.get("jobs") or []
    if not jobs:
        return _err("missing 'jobs'")

    strategy = (body.get("strategy") or "greedy").lower().strip()
    dry_run = bool(body.get("dry_run", False))

    results = []
    for j in jobs:
        # Reuse the logic by faking a request-local plan
        tmp_req = {"job": j, "strategy": strategy, "dry_run": dry_run}
        with app.test_request_context(json=tmp_req):
            plan_result = app.view_functions["plan"]()  # type: ignore
            if isinstance(plan_result, tuple):
                resp_obj, status = plan_result
            else:
                resp_obj = plan_result
                status = getattr(resp_obj, "status_code", 200)

            data = None
            if hasattr(resp_obj, "get_json"):
                data = resp_obj.get_json(silent=True)
            if data is None:
                try:
                    data = json.loads(resp_obj.get_data(as_text=True) or "{}")
                except Exception:
                    data = {}

            if status >= 400 or not data.get("ok", False):
                return resp_obj, status

            payload = data.get("data")
            if payload is None:
                return _err("plan returned no data", status=500)

            results.append(payload)
    return _ok({"results": results})


@app.post("/release")
def release():
    """
    Release reservations.
    Body: { releases: [ { node: "ws-001", reservation_id: "res-0000001" }, ... ] }
    """
    if not request.is_json:
        return _err("expected JSON body")
    body = request.get_json() or {}
    rels = body.get("releases") or []
    done = []
    for r in rels:
        node = r.get("node")
        rid = r.get("reservation_id")
        if node and rid:
            ok = STATE.release(node, rid)
            if ok:
                SELF_HEALER.forget_reservation(rid)
            done.append({"node": node, "reservation_id": rid, "released": bool(ok)})
    return _ok({"released": done})


@app.post("/add_node")
def add_node():
    if not request.is_json:
        return _err("expected JSON body")
    body = request.get_json() or {}
    descriptor = body.get("node")
    if not isinstance(descriptor, dict):
        return _err("missing 'node'")
    problem = _node_problem(descriptor)
    if problem:
        return _err(problem)
    persist = bool(body.get("persist", True))
    preserve_runtime = bool(body.get("preserve_runtime", True))
    try:
        node = STATE.add_or_update_node(descriptor, persist=persist, preserve_runtime=preserve_runtime)
        return _ok({"node": node.get("name"), "persisted": persist})
    except ValueError as exc:
        return _err(str(exc))
    except Exception:
        app.logger.exception("/add_node failed")
        return _err("add_node failed", status=500)


@app.get("/nodes/<name>")
def get_node_descriptor(name: str):
    desc = STATE.node_descriptor(name)
    if desc is None:
        return _err(f"node '{name}' not found", status=404)
    return _ok(desc)


@app.delete("/nodes/<name>")
def delete_node(name: str):
    dropped = STATE.remove_node(name)
    if dropped is None:
        return _err(f"node '{name}' not found", status=404)
    for rid in dropped:
        SELF_HEALER.forget_reservation(rid)
    return _ok({"node": name, "dropped_reservations": dropped})


@app.get("/economics")
def economics():
    econ = Economics.from_state(STATE)
    return _ok(
        {
            "currency": econ.currency,
            "priced": econ.priced,
            "pricing": {
                "cpu_core_hour": econ.cpu_core_hour,
                "gpu_hour": econ.gpu_hour,
                "npu_hour": econ.npu_hour,
                "memory_gb_hour": econ.memory_gb_hour,
                "egress_gb": econ.egress_gb,
            },
            "energy": {
                "price_per_kwh": econ.price_per_kwh,
                "grid_co2_g_per_kwh": econ.grid_co2_g_per_kwh,
            },
            "zones": econ.zones,
        }
    )


@app.get("/topology")
def topology():
    raw: Dict[str, Any] = {}
    try:
        if STATE.topology_path.exists():
            raw = yaml.safe_load(STATE.topology_path.read_text(encoding="utf-8")) or {}
    except Exception:
        app.logger.exception("failed to read topology file")
    sites = sorted(
        {
            site.get("name")
            for region in (raw.get("regions") or [])
            for site in (region.get("sites") or [])
            if site.get("name")
        }
    )
    qos = [q.get("name") for q in ((raw.get("defaults") or {}).get("routing") or {}).get("qos_classes") or []]
    return _ok(
        {
            "links": STATE.topology_link_specs(),
            "link_profiles": raw.get("link_profiles") or [],
            "sites": sites,
            "subnets": [s.get("name") for s in (raw.get("subnets") or []) if s.get("name")],
            "qos_classes": [q for q in qos if q],
            "default_network": (raw.get("defaults") or {}).get("network") or {},
        }
    )


@app.post("/links")
def upsert_link():
    if not request.is_json:
        return _err("expected JSON body")
    spec = (request.get_json() or {}).get("link")
    if not isinstance(spec, dict):
        return _err("missing 'link'")
    original_key = (request.get_json() or {}).get("original_key")
    try:
        saved = STATE.upsert_link(spec)
    except ValueError as exc:
        return _err(str(exc))
    except Exception:
        app.logger.exception("/links failed")
        return _err("saving link failed", status=500)
    # Endpoints changed while editing: drop the old declaration.
    if original_key and original_key != saved["key"]:
        STATE.remove_link(original_key)
    return _ok(saved)


@app.delete("/links")
def delete_link():
    key = request.args.get("key") or ""
    if "|" not in key:
        a, b = request.args.get("a"), request.args.get("b")
        if not a or not b:
            return _err("pass ?key=A|B (or ?a=&b=)")
        key = link_key(a, b)
    if not STATE.remove_link(key):
        return _err(f"link '{key}' not found", status=404)
    return _ok({"key": key})


@app.post("/jobs")
def save_job():
    if not request.is_json:
        return _err("expected JSON body")
    body = request.get_json() or {}
    job = body.get("job")
    if not isinstance(job, dict):
        return _err("missing 'job'")
    problem = _job_problem(job)
    if problem:
        return _err(problem)
    job_id = job["id"]
    original_id = body.get("original_id") or job_id

    with _JOBS_LOCK:
        if original_id != job_id and _locate_job(job_id):
            return _err(f"a job with id '{job_id}' already exists", status=409)
        found = _locate_job(original_id)
        try:
            if found:
                path, index = found
                raw, jobs, header = _read_job_file(path)
                jobs[index] = job
            else:
                root = _jobs_root()
                root.mkdir(parents=True, exist_ok=True)
                path = root / f"{job_id}.yaml"
                if path.exists():
                    return _err(f"jobs/{path.name} already exists", status=409)
                raw, jobs, header = job, [job], ""
            _write_job_file(path, raw, jobs, header)
        except Exception:
            app.logger.exception("/jobs save failed")
            return _err("saving job failed", status=500)

    STATE.emit_event("fabric.job.saved", {"job_id": job_id, "file": path.name}, subject=job_id)
    return _ok({"id": job_id, "file": path.name, "created": not found})


@app.delete("/jobs")
def delete_job():
    job_id = request.args.get("id") or ""
    with _JOBS_LOCK:
        found = _locate_job(job_id)
        if not found:
            return _err(f"job '{job_id}' not found", status=404)
        path, index = found
        try:
            raw, jobs, header = _read_job_file(path)
            jobs.pop(index)
            _write_job_file(path, raw, jobs, header)
        except Exception:
            app.logger.exception("/jobs delete failed")
            return _err("deleting job failed", status=500)
    STATE.emit_event("fabric.job.deleted", {"job_id": job_id, "file": path.name}, subject=job_id)
    return _ok({"id": job_id, "file": path.name})


@app.delete("/plans")
def clear_plans():
    cleared = len(RECENT_PLANS)
    RECENT_PLANS.clear()
    STATE.emit_event("fabric.plan.cleared", {"cleared": cleared})
    return _ok({"cleared": cleared})


@app.get("/chaos")
def chaos_status():
    try:
        catalog = CHAOS.scenarios()
    except Exception:
        app.logger.exception("failed to read chaos scenarios")
        catalog = {"base_events": 0, "scenarios": []}
    return _ok({**catalog, "status": CHAOS.status()})


@app.post("/chaos/start")
def chaos_start():
    body = request.get_json(silent=True) or {}
    scenario = body.get("scenario") or None
    speed = safe_float(body.get("speed"), 10.0)
    try:
        return _ok(CHAOS.start(scenario, speed))
    except (ValueError, RuntimeError) as exc:
        return _err(str(exc), status=409 if isinstance(exc, RuntimeError) else 400)
    except Exception:
        app.logger.exception("/chaos/start failed")
        return _err("starting chaos failed", status=500)


@app.post("/chaos/stop")
def chaos_stop():
    return _ok({"stopped": CHAOS.stop()})


@app.post("/overrides/reset")
def overrides_reset():
    # A running schedule would immediately re-inject what we clear.
    stopped = CHAOS.stop()
    result = STATE.reset_overrides()
    return _ok({**result, "chaos_stopped": stopped})


# -----------------------------------
# CLI entrypoint
# -----------------------------------


def main():
    ap = argparse.ArgumentParser(description="Fabric DT API")
    ap.add_argument("--host", default=os.environ.get("FABRIC_API_HOST", "127.0.0.1"))
    ap.add_argument(
        "--port", type=int, default=int(os.environ.get("FABRIC_API_PORT", "8080"))
    )
    ap.add_argument("--debug", action="store_true")
    args = ap.parse_args()
    # threaded=True is required: an open SSE stream holds a worker for its
    # lifetime, so a single-threaded server would stop answering everything else.
    app.run(host=args.host, port=args.port, debug=args.debug, threaded=True)


if __name__ == "__main__":
    main()
