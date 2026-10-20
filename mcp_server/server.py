#!/usr/bin/env python3
"""MCP server for RAP twin: every dashboard feature as a tool, over the REST API.

Env: RAPTWIN_URL (default http://127.0.0.1:8080; VPS: https://raptwin.seloraos.online/api)
     RAPTWIN_API_KEY (sent as X-API-Key for gated routes)
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Optional

import requests
from mcp.server.fastmcp import FastMCP

BASE = os.environ.get("RAPTWIN_URL", "http://127.0.0.1:8080").rstrip("/")
KEY = os.environ.get("RAPTWIN_API_KEY")
ROOT = Path(__file__).resolve().parents[1]
STRATEGIES = ["greedy", "cheapest-energy", "cheapest-cost", "greenest", "bandit", "resilient", "rl-markov"]

mcp = FastMCP("raptwin")


def _call(method: str, path: str, body: Any = None, params: Optional[dict] = None, raw: bool = False):
    headers = {"X-API-Key": KEY} if KEY else {}
    r = requests.request(method, BASE + path, json=body, params=params, headers=headers, timeout=120)
    if raw:
        r.raise_for_status()
        return r
    try:
        j = r.json()
    except Exception:
        r.raise_for_status()
        raise
    if not j.get("ok", False):
        raise RuntimeError(f"{r.status_code}: {j.get('error')}")
    return j["data"]


def _need(confirm: bool, what: str):
    if not confirm:
        raise ValueError(f"{what} is destructive; call again with confirm=true")


def _job(job: Optional[dict], job_id: Optional[str]) -> dict:
    if job:
        return job
    for e in _call("GET", "/jobs"):
        if e["id"] == job_id:
            return e["job"]
    raise ValueError(f"job '{job_id}' not found")


# ------------------------------ overview / state ------------------------------
@mcp.tool()
def get_health() -> dict:
    """Liveness check of the twin API."""
    return _call("GET", "/health")


@mcp.tool()
def get_snapshot() -> dict:
    """Full twin state: nodes, links, federations, predictive overview, economics."""
    return _call("GET", "/snapshot")


@mcp.tool()
def get_overview() -> dict:
    """Dashboard Overview KPIs (nodes, links, federations, down, reservations, CPU used, max federation load, last plan metrics)."""
    s = _call("GET", "/snapshot")
    nodes = s["nodes"]
    used = sum(max(0, n["effective"].get("max_cpu_cores", 0) - n["effective"].get("free_cpu_cores", 0)) for n in nodes)
    tot = sum(n["effective"].get("max_cpu_cores", 0) for n in nodes)
    plans = _call("GET", "/plans")
    last = plans[0] if plans else {}
    feds = s.get("federations", [])
    return {
        "nodes": len(nodes), "links": len(s["links"]), "federations": len(feds),
        "down": sum(1 for n in nodes if n["dyn"].get("down")),
        "reservations": sum(len(n["dyn"].get("reservations") or {}) for n in nodes),
        "cpu_used_pct": round(100 * used / tot, 2) if tot else None,
        "max_federation_load": max((f.get("load_factor", 0) for f in feds), default=None),
        "last_plan": {k: last.get(k) for k in ("job_id", "strategy", "dry_run", "latency_ms", "federation_spread",
                                                  "resilience_score", "cost_total", "co2_g", "currency")},
        "snapshot_ts": s["ts"],
    }


@mcp.tool()
def list_nodes(search: str = "", only_down: bool = False, limit: int = 200) -> list:
    """List nodes (name, class, zone, cpu, free cpu, down, reservations); filter by text in name/class/labels."""
    out = []
    for n in _call("GET", "/snapshot")["nodes"]:
        blob = json.dumps([n["name"], n.get("class"), n.get("labels")]).lower()
        if search.lower() in blob and (not only_down or n["dyn"].get("down")):
            out.append({"name": n["name"], "class": n.get("class"), "zone": (n.get("labels") or {}).get("zone"),
                        "cpu": n["effective"].get("max_cpu_cores"), "free_cpu": n["effective"].get("free_cpu_cores"),
                        "down": n["dyn"].get("down"), "reliability": n["dyn"].get("reliability"),
                        "reservations": len(n["dyn"].get("reservations") or {})})
    return out[:limit]


@mcp.tool()
def list_links(search: str = "") -> list:
    """List links (declared and chaos-injected) with effective metrics."""
    return [{"key": l["key"], **l["effective"]} for l in _call("GET", "/snapshot")["links"] if search.lower() in l["key"].lower()]


@mcp.tool()
def get_federations() -> dict:
    """Federations (zones) with load, down/hot nodes, trust, plus cross-federation link health."""
    s = _call("GET", "/snapshot")
    return {"federations": s["federations"], "federation_links": s["federation_links"]}


@mcp.tool()
def get_topology() -> dict:
    """Declared links, link profiles and sites."""
    return _call("GET", "/topology")


@mcp.tool()
def get_economics() -> dict:
    """Pricing and carbon intensity in force."""
    return _call("GET", "/economics")


# ------------------------------ planning ------------------------------
@mcp.tool()
def list_jobs() -> list:
    """Job library (jobs/*.yaml)."""
    return _call("GET", "/jobs")


@mcp.tool()
def plan_job(job_id: str = "", job: Optional[dict] = None, strategy: str = "greedy", dry_run: bool = True) -> dict:
    """Plan one job (by library id or inline). dry_run=true reserves nothing; false commits reservations."""
    return _call("POST", "/plan", {"job": _job(job, job_id), "strategy": strategy, "dry_run": dry_run})


@mcp.tool()
def plan_catalog(strategy: str = "greedy", dry_run: bool = True) -> dict:
    """Plan the entire job catalogue ('Plan entire catalog'). Committed plans hold capacity until released."""
    jobs = [e["job"] for e in _call("GET", "/jobs")]
    res = _call("POST", "/plan_batch", {"jobs": jobs, "strategy": strategy, "dry_run": dry_run})["results"]
    return {"planned": len(res), "infeasible": sum(1 for r in res if r.get("infeasible")),
            "results": [{k: r.get(k) for k in ("job_id", "latency_ms", "energy_kj", "cost_total", "co2_g", "infeasible", "assignments")} for r in res]}


@mcp.tool()
def recommend_strategy(job_id: str = "", job: Optional[dict] = None, weights: Optional[dict] = None) -> dict:
    """Dry-run all 7 strategies on a job and rank them (default weights: latency 1, cost 0.3, co2 0.2, risk 0.3 after min-max normalisation)."""
    j = _job(job, job_id)
    w = {"latency": 1.0, "cost": 0.3, "co2": 0.2, "risk": 0.3, **(weights or {})}
    rows = []
    for s in STRATEGIES:
        p = _call("POST", "/plan", {"job": j, "strategy": s, "dry_run": True})
        rows.append({"strategy": s, "infeasible": bool(p.get("infeasible")), "latency_ms": p.get("latency_ms"),
                     "cost": p.get("cost_total") or 0, "co2": p.get("co2_g") or 0, "risk": p.get("risk") or 0,
                     "nodes": sorted(set((p.get("assignments") or {}).values()))})
    ok = [r for r in rows if not r["infeasible"]]
    for k in ("latency_ms", "cost", "co2", "risk"):
        vals = [r[k] for r in ok]
        lo, hi = (min(vals), max(vals)) if vals else (0, 1)
        for r in ok:
            r[k + "_n"] = (r[k] - lo) / (hi - lo) if hi > lo else 0
    for r in ok:
        r["score"] = round(w["latency"] * r["latency_ms_n"] + w["cost"] * r["cost_n"] + w["co2"] * r["co2_n"] + w["risk"] * r["risk_n"], 4)
    ok.sort(key=lambda r: r["score"])
    return {"recommended": ok[0]["strategy"] if ok else None, "ranking": ok, "infeasible": [r["strategy"] for r in rows if r["infeasible"]]}


@mcp.tool()
def list_plans(limit: int = 20) -> list:
    """Recent plans (ring buffer of 200), newest first."""
    return [{k: p.get(k) for k in ("job_id", "strategy", "dry_run", "latency_ms", "energy_kj", "risk", "cost_total", "co2_g", "infeasible", "ts")}
            for p in _call("GET", "/plans")[:limit]]


@mcp.tool()
def get_plan_detail(index: int = 0) -> dict:
    """Plan Detail: per-stage cards (node, format, compute/xfer ms, cpu, reliability, fallbacks) and summary for plans[index]."""
    return _call("GET", "/plans")[index]


@mcp.tool()
def clear_plans(confirm: bool = False) -> dict:
    """Clear plan history (reservations are not released)."""
    _need(confirm, "clear_plans")
    return _call("DELETE", "/plans")


# ------------------------------ reservations ------------------------------
def _reservations() -> list:
    return [{"node": n["name"], "reservation_id": rid, **info}
            for n in _call("GET", "/snapshot")["nodes"] for rid, info in (n["dyn"].get("reservations") or {}).items()]


@mcp.tool()
def list_reservations(filter: str = "") -> list:
    """Capacity held by committed plans; filter by node or id substring."""
    return [r for r in _reservations() if filter.lower() in (r["node"] + r["reservation_id"]).lower()]


@mcp.tool()
def release(reservations: list) -> dict:
    """Release reservations: list of {node, reservation_id}."""
    return _call("POST", "/release", {"releases": reservations})


@mcp.tool()
def release_matching(filter: str, confirm: bool = False) -> dict:
    """Release all reservations whose node/id contains the filter."""
    _need(confirm, "release_matching")
    return release([{"node": r["node"], "reservation_id": r["reservation_id"]} for r in list_reservations(filter)])


@mcp.tool()
def release_all(confirm: bool = False) -> dict:
    """Release every reservation, returning nodes to normal."""
    _need(confirm, "release_all")
    return release([{"node": r["node"], "reservation_id": r["reservation_id"]} for r in _reservations()])


# ------------------------------ nodes / links / jobs ------------------------------
@mcp.tool()
def get_node(name: str) -> dict:
    """Full node descriptor (nodes/<name>.yaml)."""
    return _call("GET", f"/nodes/{name}")


@mcp.tool()
def save_node(node: dict) -> dict:
    """Create or update a node from a full descriptor (persisted to nodes/<name>.yaml)."""
    return _call("POST", "/add_node", {"node": node})


@mcp.tool()
def delete_node(name: str, confirm: bool = False) -> dict:
    """Delete a node, its file and reservations."""
    _need(confirm, "delete_node")
    return _call("DELETE", f"/nodes/{name}")


@mcp.tool()
def upsert_link(link: dict) -> dict:
    """Create/update a declared link: {a, b, profile?, speed_gbps?, rtt_ms?, jitter_ms?, loss_pct?, scope?, qos_class?, subnet?}."""
    return _call("POST", "/links", {"link": link})


@mcp.tool()
def delete_link(key: str, confirm: bool = False) -> dict:
    """Delete a declared link by key 'A|B'."""
    _need(confirm, "delete_link")
    return _call("DELETE", "/links", params={"key": key})


@mcp.tool()
def save_job(job: dict, original_id: Optional[str] = None) -> dict:
    """Create/edit a job in the library."""
    return _call("POST", "/jobs", {"job": job, "original_id": original_id})


@mcp.tool()
def delete_job(job_id: str, confirm: bool = False) -> dict:
    """Delete a job from the library."""
    _need(confirm, "delete_job")
    return _call("DELETE", "/jobs", params={"id": job_id})


# ------------------------------ chaos / resilience ------------------------------
@mcp.tool()
def list_scenarios() -> dict:
    """Chaos scenarios available plus current run status (progress and log)."""
    return _call("GET", "/chaos")


@mcp.tool()
def chaos_status() -> dict:
    """Current chaos run status (running, applied/total, log)."""
    return _call("GET", "/chaos")["status"]


@mcp.tool()
def start_chaos(scenario: Optional[str] = None, speed: float = 10) -> dict:
    """Start a chaos scenario inside the twin (speed 0.1-1000)."""
    return _call("POST", "/chaos/start", {"scenario": scenario, "speed": speed})


@mcp.tool()
def stop_chaos() -> dict:
    """Stop the running chaos scenario."""
    return _call("POST", "/chaos/stop")


@mcp.tool()
def reset_faults() -> dict:
    """Stop chaos and clear every injected fault."""
    return _call("POST", "/overrides/reset")


@mcp.tool()
def health_cleanup() -> dict:
    """Fault load: nodes down, nodes derated, links down."""
    s = _call("GET", "/snapshot")
    return {"nodes_down": sum(1 for n in s["nodes"] if n["dyn"].get("down")),
            "nodes_derated": sum(1 for n in s["nodes"] if (n["dyn"].get("thermal_derate") or 0) > 0),
            "links_down": sum(1 for l in s["links"] if l["effective"].get("down"))}


@mcp.tool()
def inject_observation(payload: dict, action: str = "apply") -> dict:
    """POST /observe. payload e.g. {"type":"node","node":"srv-015","changes":{"down":true}} or {"type":"link","key":"a|b","changes":{...}}."""
    return _call("POST", "/observe", {"action": action, "payload": payload})


@mcp.tool()
def blast_radius(job_id: str = "", job: Optional[dict] = None, strategy: str = "greedy", depth: int = 2,
                 branch: int = 10, deadline_ms: Optional[float] = None) -> dict:
    """Find the smallest fault sets that break a job."""
    body = {"strategy": strategy, "depth": depth, "branch": branch}
    if deadline_ms is not None:
        body["deadline_ms"] = deadline_ms
    body.update({"job": job} if job else {"job_id": job_id})
    return _call("POST", "/blast_radius", body)


@mcp.tool()
def what_if(mode: str = "custom", target: str = "", count: int = 2, cores: int = 64, changes: Optional[dict] = None,
            strategy: str = "greedy", fault_zone: str = "") -> dict:
    """Capacity what-if. mode: clone | remove | upgrade | custom (custom uses `changes`, e.g. {"add_nodes":[...]})."""
    ch = {"clone": {"clone_nodes": [{"from": target, "count": count}]},
          "remove": {"remove_nodes": [target]},
          "upgrade": {"patch_nodes": {target: {"cpu": {"cores": cores}}}}}.get(mode, changes)
    if not ch:
        raise ValueError("provide `changes` for custom mode")
    body = {"changes": ch, "strategy": strategy}
    if fault_zone:
        body["faults"] = [{"kind": "zone_blackout", "target": fault_zone}]
    return _call("POST", "/whatif", body)


# ------------------------------ events / export / docs ------------------------------
@mcp.tool()
def recent_events(limit: int = 50) -> list:
    """Recent CloudEvents (plan commits, overrides, self-heal, guardian)."""
    return _call("GET", "/events", params={"limit": limit})["events"]


@mcp.tool()
def watch_events(seconds: float = 5) -> list:
    """Listen to the live /stream SSE feed for a few seconds and return the events seen."""
    import time
    out, end = [], time.time() + min(seconds, 30)
    headers = {"X-API-Key": KEY} if KEY else {}
    with requests.get(BASE + "/stream", stream=True, headers=headers, timeout=(5, 35)) as r:
        for line in r.iter_lines(decode_unicode=True):
            if line and line.startswith("data:"):
                out.append(json.loads(line[5:]))
            if time.time() > end:
                break
    return out


@mcp.tool()
def download_bundle(path: str = "raptwin-incident.zip", note: str = "") -> str:
    """Download a reproducible incident bundle (ZIP) to a local path."""
    r = _call("GET", "/bundle", params={"note": note} if note else None, raw=True)
    Path(path).write_bytes(r.content)
    return f"saved {len(r.content)} bytes to {path}"


@mcp.tool()
def export_dtdl() -> dict:
    """Twin as Azure DTDL models."""
    return _call("GET", "/standards/dtdl")


@mcp.tool()
def export_crds() -> dict:
    """Twin as Kubernetes CRDs / custom resources."""
    return _call("GET", "/standards/crds")


@mcp.tool()
def read_docs(page: str = "") -> str:
    """Project documentation. Empty page lists available files; otherwise returns that file (README, WORKLOG, future, documentation/*)."""
    files = {p.stem.lower(): p for p in [ROOT / "README.md", ROOT / "WORKLOG.md", ROOT / "future.md", ROOT / "run.md",
                                          *(ROOT / "documentation").glob("*.md"), ROOT / "deploy" / "README.md"]}
    if not page:
        return "available: " + ", ".join(sorted(files))
    p = files.get(page.lower())
    if not p:
        raise ValueError("unknown page; call read_docs() to list")
    return p.read_text(encoding="utf-8")


# ------------------------------ resources / prompts ------------------------------
@mcp.resource("raptwin://snapshot")
def snapshot_resource() -> str:
    return json.dumps(_call("GET", "/snapshot"))


@mcp.resource("raptwin://topology")
def topology_resource() -> str:
    return json.dumps(_call("GET", "/topology"))


@mcp.prompt()
def diagnose_fabric() -> str:
    return "Call get_overview, health_cleanup, get_federations and recent_events, then summarise fabric health, faults and risks, and suggest actions."


@mcp.prompt()
def pick_strategy(job_id: str) -> str:
    return f"Call recommend_strategy for job '{job_id}', explain the trade-offs between the top strategies, and recommend one."


if __name__ == "__main__":
    mcp.run()
