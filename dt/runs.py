"""
dt/runs.py — timed job runs: a committed plan "executes" for a while, then frees itself.

A committed plan used to hold its reservations until someone released them. A *run* is
the execution of one committed plan with a timer: when it ends (the timer elapses, or
someone finishes or cancels it) every reservation it holds is released and an event is
published. The timer is simulated: a running job holds capacity for the chosen number of
seconds; it does not execute any code.

Design notes
------------
* Reservation ids are not stable. The self-healing controller swaps a stage's primary
  reservation on failover and adds shadow reservations, so finishing a run frees the ids
  recorded at start *and* whatever the healer currently holds for the job.
  ``DTState.release`` ignores ids that are already gone, so freeing twice is harmless.
* The clock is injectable and the background thread optional, so tests are deterministic.
* Everything is in memory. Settings reset when the API restarts (env vars seed them).
"""

from __future__ import annotations

import threading
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Any, Callable, Deque, Dict, List, Optional, Tuple

from dt.state import DTState, safe_float

MIN_DURATION_S = 1.0
MAX_DURATION_S = 86400.0
RUNNING = "running"
COMPLETED = "completed"
CANCELLED = "cancelled"


def validate_duration(value: Any, *, name: str = "duration_s") -> float:
    """Parse a timer length in seconds, rejecting anything outside 1 s to 24 h."""
    try:
        secs = float(value)
    except (TypeError, ValueError):
        raise ValueError(f"{name} must be a number of seconds") from None
    if not (MIN_DURATION_S <= secs <= MAX_DURATION_S):
        raise ValueError(f"{name} must be between {MIN_DURATION_S:g} and {MAX_DURATION_S:g} seconds")
    return secs


@dataclass
class RunStage:
    id: str
    node: str
    format: Optional[str]
    compute_ms: float
    xfer_ms: float
    resources: Dict[str, float]

    @property
    def weight(self) -> float:
        return max(1.0, self.compute_ms + self.xfer_ms)


@dataclass
class JobRun:
    run_id: str
    job_id: str
    strategy: str
    started: float
    duration_s: float
    stages: List[RunStage]
    reservations: List[Dict[str, Any]]
    predicted: Dict[str, Any]
    state: str = RUNNING
    finished: Optional[float] = None
    end_reason: Optional[str] = None
    released: Optional[int] = None
    timer_changes: int = 0
    events: List[Dict[str, Any]] = field(default_factory=list)

    @property
    def ends(self) -> float:
        return self.started + self.duration_s


class JobRunManager:
    def __init__(
        self,
        state: DTState,
        healer: Any = None,
        *,
        clock: Callable[[], float] = time.time,
        default_duration_s: float = 30.0,
        auto_release: bool = True,
        autostart: bool = True,
        tick_interval: float = 0.5,
        history: int = 200,
    ) -> None:
        self.state = state
        self.healer = healer
        self._clock = clock
        self._lock = threading.RLock()
        self._runs: Dict[str, JobRun] = {}
        self._finished: Deque[str] = deque(maxlen=max(10, history))
        self._seq = 1
        self._settings = {
            "auto_release": bool(auto_release),
            "default_duration_s": validate_duration(default_duration_s, name="default_duration_s"),
        }
        self._stop = threading.Event()
        self._interval = max(0.1, tick_interval)
        self._thread: Optional[threading.Thread] = None
        if autostart:
            self._thread = threading.Thread(target=self._loop, name="JobRuns", daemon=True)
            self._thread.start()

    # ------------------------------------------------------------ settings

    def settings(self) -> Dict[str, Any]:
        with self._lock:
            return dict(self._settings)

    def update_settings(
        self, auto_release: Optional[bool] = None, default_duration_s: Optional[Any] = None
    ) -> Dict[str, Any]:
        with self._lock:
            if auto_release is not None:
                self._settings["auto_release"] = bool(auto_release)
            if default_duration_s is not None:
                self._settings["default_duration_s"] = validate_duration(
                    default_duration_s, name="default_duration_s"
                )
            return dict(self._settings)

    # ----------------------------------------------------------- lifecycle

    def start(self, job: Dict[str, Any], plan: Dict[str, Any], duration_s: Optional[Any] = None) -> Dict[str, Any]:
        """Begin a run for a committed plan. Timer: argument, then job.duration_s, then default."""
        with self._lock:
            if duration_s is not None:
                secs = validate_duration(duration_s)
            elif job.get("duration_s") is not None:
                secs = validate_duration(job["duration_s"], name="job duration_s")
            else:
                secs = self._settings["default_duration_s"]

            stage_cfg = {s.get("id"): s for s in (job.get("stages") or []) if isinstance(s, dict)}
            stages: List[RunStage] = []
            reservations: List[Dict[str, Any]] = []
            seen = set()

            def add_res(node: Any, rid: Any, stage_id: Any, role: str) -> None:
                if node and rid and rid not in seen:
                    seen.add(rid)
                    reservations.append(
                        {"node": node, "reservation_id": rid, "stage_id": stage_id, "role": role}
                    )

            for entry in plan.get("per_stage") or []:
                if not isinstance(entry, dict):
                    continue
                res = (stage_cfg.get(entry.get("id")) or {}).get("resources") or {}
                stages.append(
                    RunStage(
                        id=str(entry.get("id")),
                        node=str(entry.get("node") or ""),
                        format=entry.get("format"),
                        compute_ms=safe_float(entry.get("compute_ms"), 0.0),
                        xfer_ms=safe_float(entry.get("xfer_ms"), 0.0),
                        resources={
                            "cpu_cores": safe_float(res.get("cpu_cores"), 0.0),
                            "mem_gb": safe_float(res.get("mem_gb"), 0.0),
                            "gpu_vram_gb": safe_float(res.get("gpu_vram_gb"), 0.0),
                        },
                    )
                )
                add_res(entry.get("node"), entry.get("reservation_id"), entry.get("id"), "primary")
                for sh in entry.get("shadow_reservations") or []:
                    add_res(sh.get("node"), sh.get("reservation_id"), entry.get("id"), "shadow")
            for r in plan.get("reservations") or []:
                add_res(r.get("node"), r.get("reservation_id"), r.get("stage_id"), r.get("role") or "primary")

            run = JobRun(
                run_id=f"run-{self._seq:06d}",
                job_id=str(plan.get("job_id") or job.get("id") or "job"),
                strategy=str(plan.get("strategy") or ""),
                started=self._clock(),
                duration_s=secs,
                stages=stages,
                reservations=reservations,
                predicted={
                    "latency_ms": plan.get("latency_ms"),
                    "deadline_ms": plan.get("deadline_ms") or job.get("deadline_ms"),
                    "energy_kj": plan.get("energy_kj"),
                    "risk": plan.get("risk"),
                    "cost_total": plan.get("cost_total"),
                    "currency": plan.get("currency"),
                    "co2_g": plan.get("co2_g"),
                },
            )
            self._seq += 1
            self._runs[run.run_id] = run
            self._emit(
                "fabric.run.started",
                run,
                {"duration_s": secs, "reservations": len(reservations), "strategy": run.strategy},
            )
            return self._view(run)

    def finish(self, run_id: str, reason: str = "manual") -> Dict[str, Any]:
        """End a running job now as completed, freeing its reservations."""
        return self._end(run_id, COMPLETED, reason)

    def cancel(self, run_id: str) -> Dict[str, Any]:
        return self._end(run_id, CANCELLED, "cancelled")

    def finish_all(self) -> List[Dict[str, Any]]:
        with self._lock:
            ids = [r.run_id for r in self._runs.values() if r.state == RUNNING]
        return [self._end(i, COMPLETED, "manual") for i in ids]

    def set_timer(
        self, run_id: str, remaining_s: Optional[Any] = None, extend_s: Optional[Any] = None
    ) -> Dict[str, Any]:
        """Set the time left from now, or add to it (a negative extend shortens it)."""
        with self._lock:
            run = self._need_running(run_id)
            now = self._clock()
            if remaining_s is not None:
                new_end = now + validate_duration(remaining_s, name="remaining_s")
            elif extend_s is not None:
                try:
                    delta = float(extend_s)
                except (TypeError, ValueError):
                    raise ValueError("extend_s must be a number of seconds") from None
                new_end = max(now, run.ends + delta)
            else:
                raise ValueError("give remaining_s or extend_s")
            total = new_end - run.started
            if total > MAX_DURATION_S:
                raise ValueError(f"a run cannot last longer than {MAX_DURATION_S:g} seconds")
            run.duration_s = max(total, 0.0)
            run.timer_changes += 1
            self._emit(
                "fabric.run.timer",
                run,
                {"remaining_s": round(max(0.0, new_end - now), 3), "duration_s": round(run.duration_s, 3)},
            )
            return self._view(run)

    def forget_all(self) -> int:
        """The twin was restarted: its reservations are gone, so just drop the records."""
        with self._lock:
            n = len(self._runs)
            self._runs.clear()
            self._finished.clear()
            return n

    # -------------------------------------------------------------- reads

    def list(self, state: str = "all", limit: int = 100) -> List[Dict[str, Any]]:
        with self._lock:
            running = sorted((r for r in self._runs.values() if r.state == RUNNING), key=lambda r: r.ends)
            done = [self._runs[i] for i in reversed(self._finished) if i in self._runs]
            if state == "running":
                chosen = running
            elif state == "finished":
                chosen = done
            else:
                chosen = running + done
            return [self._view(r) for r in chosen[: max(1, int(limit))]]

    def get(self, run_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            run = self._runs.get(run_id)
            return None if run is None else self._view(run)

    def now_ms(self) -> int:
        return int(self._clock() * 1000)

    def reserved_by_running(self) -> int:
        with self._lock:
            return sum(len(r.reservations) for r in self._runs.values() if r.state == RUNNING)

    # ---------------------------------------------------------- the timer

    def tick(self) -> List[str]:
        """End every run whose timer has elapsed. Returns the ids that ended."""
        with self._lock:
            now = self._clock()
            due = [r.run_id for r in self._runs.values() if r.state == RUNNING and now >= r.ends]
        for run_id in due:
            try:
                self._end(run_id, COMPLETED, "timer")
            except (KeyError, RuntimeError):
                pass
        return due

    def stop(self) -> None:
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=2.0)

    def _loop(self) -> None:
        while not self._stop.is_set():
            try:
                self.tick()
            except Exception:
                pass
            self._stop.wait(self._interval)

    # ----------------------------------------------------------- internals

    def _need_running(self, run_id: str) -> JobRun:
        run = self._runs.get(run_id)
        if run is None:
            raise KeyError(run_id)
        if run.state != RUNNING:
            raise RuntimeError(f"{run_id} is already {run.state}")
        return run

    def _held(self, run: JobRun) -> List[Tuple[str, str]]:
        """Every reservation to free: those recorded at start plus the healer's current ones."""
        held = [(r["node"], r["reservation_id"]) for r in run.reservations]
        shares_job = any(
            o.run_id != run.run_id and o.state == RUNNING and o.job_id == run.job_id for o in self._runs.values()
        )
        # The healer keys its plans by job id, so with two live runs of the same job its
        # reservations cannot be attributed to one of them; only free the recorded ids.
        if self.healer is not None and not shares_job:
            try:
                held.extend(self.healer.job_reservations(run.job_id))
            except Exception:
                pass
        return list(dict.fromkeys(held))

    def _end(self, run_id: str, state: str, reason: str) -> Dict[str, Any]:
        with self._lock:
            run = self._need_running(run_id)
            released = 0
            for node, rid in self._held(run):
                if self.state.release(node, rid):
                    released += 1
                if self.healer is not None:
                    try:
                        self.healer.forget_reservation(rid)
                    except Exception:
                        pass
            run.state = state
            run.finished = self._clock()
            run.end_reason = reason
            run.released = released
            self._finished.append(run.run_id)
            self._emit(
                "fabric.run.completed" if state == COMPLETED else "fabric.run.cancelled",
                run,
                {
                    "reason": reason,
                    "released": released,
                    "elapsed_s": round(run.finished - run.started, 3),
                },
            )
            return self._view(run)

    def _emit(self, event_type: str, run: JobRun, extra: Dict[str, Any]) -> None:
        try:
            self.state.emit_event(
                event_type,
                {"run_id": run.run_id, "job_id": run.job_id, **extra},
                subject=run.run_id,
            )
        except Exception:
            pass

    def _view(self, run: JobRun) -> Dict[str, Any]:
        now = self._clock()
        running = run.state == RUNNING
        end = now if running else (run.finished or now)
        elapsed = max(0.0, end - run.started)
        progress = 1.0 if not running and run.state == COMPLETED else min(1.0, elapsed / max(run.duration_s, 1e-9))
        total_w = sum(s.weight for s in run.stages) or 1.0
        healer_nodes: Dict[str, str] = {}
        if running and self.healer is not None:
            try:
                healer_nodes = self.healer.stage_nodes(run.job_id)
            except Exception:
                healer_nodes = {}

        stages_out = []
        cum = 0.0
        for s in run.stages:
            lo, hi = cum / total_w, (cum + s.weight) / total_w
            cum += s.weight
            if not running and run.state == CANCELLED:
                status = "done" if progress >= hi - 1e-12 else "cancelled"
            elif progress >= hi - 1e-12:
                status = "done"
            elif progress >= lo:
                status = "active"
            else:
                status = "pending"
            current = healer_nodes.get(s.id) or s.node
            info = self.state.node_status(current) if running else None
            stages_out.append(
                {
                    "id": s.id,
                    "node": s.node,
                    "current_node": current,
                    "failed_over": current != s.node,
                    "format": s.format,
                    "compute_ms": s.compute_ms,
                    "xfer_ms": s.xfer_ms,
                    "share": round(s.weight / total_w, 4),
                    "status": status,
                    "resources": s.resources,
                    "node_down": bool(info and info.get("down")),
                    "node_derate": (info or {}).get("thermal_derate", 0.0),
                }
            )

        latency = self.predicted_latency(run)
        deadline = run.predicted.get("deadline_ms")
        return {
            "run_id": run.run_id,
            "job_id": run.job_id,
            "strategy": run.strategy,
            "state": run.state,
            "end_reason": run.end_reason,
            "started_ms": int(run.started * 1000),
            "ends_ms": int(run.ends * 1000),
            "finished_ms": None if run.finished is None else int(run.finished * 1000),
            "duration_s": round(run.duration_s, 3),
            "elapsed_s": round(elapsed, 3),
            "remaining_s": round(max(0.0, run.ends - now), 3) if running else 0.0,
            "progress": round(progress, 4),
            "timer_changes": run.timer_changes,
            "predicted": run.predicted,
            "meets_deadline": None if not (deadline and latency is not None) else latency <= float(deadline),
            "stages": stages_out,
            "reservations": list(run.reservations),
            "reservation_count": len(run.reservations),
            "released": run.released,
            "disrupted": any(s["node_down"] for s in stages_out),
        }

    @staticmethod
    def predicted_latency(run: JobRun) -> Optional[float]:
        v = run.predicted.get("latency_ms")
        try:
            return None if v is None else float(v)
        except (TypeError, ValueError):
            return None
