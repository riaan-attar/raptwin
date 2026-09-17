"""
dt/chaos_runner.py — run sim/chaos.py scenarios inside the DT API process.

The CLI (``python -m sim.chaos``) drives faults by writing sim/overrides.json or
POSTing to /observe. From the dashboard we already live next to DTState, so the
engine's store applies observations directly: effects land immediately, emit
the usual fabric.node/link events, and a stop never races a file watcher.
"""

from __future__ import annotations

import threading
import time
from collections import deque
from pathlib import Path
from typing import Any, Deque, Dict, List, Optional

from sim.chaos import (
    ChaosEngine,
    ChaosEvent,
    OverridesStore,
    collect_chaos_events,
    load_topology,
)

from .state import DTState


class _StateStore(OverridesStore):
    """OverridesStore that applies straight to DTState instead of disk/HTTP."""

    def __init__(self, state: DTState):
        self.path = Path()
        self.dt_endpoint = None
        self.state = {"links": {}, "nodes": {}}
        self._dt = state

    def _write(self):
        pass

    def _post_dt(self, payload: Dict[str, Any], action: str):
        self._dt.apply_observation({"action": action, "payload": payload})


class _TrackedEngine(ChaosEngine):
    def __init__(self, *args, on_log, on_event, **kwargs):
        self._on_log = on_log
        self._on_event = on_event
        super().__init__(*args, **kwargs)

    def log(self, msg: str):
        self._on_log(msg)

    def apply_event(self, ev: ChaosEvent):
        try:
            return super().apply_event(ev)
        finally:
            self._on_event(ev)


class ChaosRunner:
    """One chaos schedule at a time, started/stopped from the API."""

    def __init__(self, state: DTState, topology_path: Optional[Path] = None):
        self.state = state
        self.topology_path = Path(topology_path or state.topology_path)
        self._lock = threading.Lock()
        self._engine: Optional[_TrackedEngine] = None
        self._thread: Optional[threading.Thread] = None
        self._log: Deque[Dict[str, Any]] = deque(maxlen=200)
        self._status: Dict[str, Any] = self._idle_status()

    @staticmethod
    def _idle_status() -> Dict[str, Any]:
        return {
            "running": False,
            "scenario": None,
            "speed": None,
            "started_ts": None,
            "finished_ts": None,
            "applied": 0,
            "total": 0,
            "stopped": False,
        }

    # ---- catalog --------------------------------------------------------

    def scenarios(self) -> Dict[str, Any]:
        topo = load_topology(self.topology_path) if self.topology_path.exists() else {}
        topo = topo or {}
        base = topo.get("chaos") or []
        return {
            "base_events": len(base),
            "scenarios": [
                {
                    "name": sc.get("name"),
                    "description": sc.get("description"),
                    "events": len(sc.get("chaos") or []),
                }
                for sc in (topo.get("scenarios") or [])
                if sc.get("name")
            ],
        }

    # ---- lifecycle ------------------------------------------------------

    def status(self) -> Dict[str, Any]:
        with self._lock:
            return {**self._status, "log": list(self._log)}

    def start(self, scenario: Optional[str], speed: float) -> Dict[str, Any]:
        with self._lock:
            if self._thread and self._thread.is_alive():
                raise RuntimeError("a chaos run is already in progress; stop it first")

            topo = load_topology(self.topology_path) or {}
            # Raises ValueError for an unknown scenario name.
            schedule: List[ChaosEvent] = collect_chaos_events(topo, scenario or None)
            if not schedule:
                raise ValueError("the selected scenario has no chaos events")

            nodes_index = {
                n["name"]: {"labels": n.get("labels") or {}}
                for n in self.state.snapshot()["nodes"]
            }
            speed = max(0.1, min(float(speed), 1000.0))
            engine = _TrackedEngine(
                _StateStore(self.state),
                speed=speed,
                nodes_index=nodes_index,
                on_log=self._record_log,
                on_event=self._record_event,
            )
            self._engine = engine
            self._log.clear()
            self._status = {
                **self._idle_status(),
                "running": True,
                "scenario": scenario or None,
                "speed": speed,
                "started_ts": int(time.time() * 1000),
                "total": len(schedule),
            }
            self._thread = threading.Thread(
                target=self._run, args=(engine, schedule), name="ChaosRunner", daemon=True
            )
            self._thread.start()
            status = dict(self._status)

        self.state.emit_event(
            "fabric.chaos.started",
            {"scenario": scenario or None, "speed": speed, "events": len(schedule)},
        )
        return status

    def stop(self) -> bool:
        with self._lock:
            engine, thread = self._engine, self._thread
            if not engine or not thread or not thread.is_alive():
                return False
            self._status["stopped"] = True
            engine.stop()
        thread.join(timeout=2.0)
        return True

    # ---- internals ------------------------------------------------------

    def _run(self, engine: _TrackedEngine, schedule: List[ChaosEvent]) -> None:
        try:
            engine.run(schedule)
        except Exception as exc:  # keep the API alive whatever a scenario does
            self._record_log(f"chaos run crashed: {exc}")
        finally:
            with self._lock:
                self._status["running"] = False
                self._status["finished_ts"] = int(time.time() * 1000)
                stopped = self._status["stopped"]
                applied = self._status["applied"]
            self.state.emit_event(
                "fabric.chaos.stopped" if stopped else "fabric.chaos.finished",
                {"applied": applied},
            )

    def _record_log(self, msg: str) -> None:
        with self._lock:
            self._log.append({"ts": int(time.time() * 1000), "msg": msg})

    def _record_event(self, ev: ChaosEvent) -> None:
        with self._lock:
            self._status["applied"] += 1
