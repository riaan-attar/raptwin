#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Simple CloudEvents helpers for the Fabric Digital Twin."""
from __future__ import annotations

import datetime
import queue
import threading
import time
import uuid
from collections import deque
from typing import Any, Deque, Dict, Iterable, List, Optional


def build_cloudevent(
    event_type: str,
    source: str,
    data: Dict[str, Any],
    *,
    subject: Optional[str] = None,
    time_ms: Optional[float] = None,
    event_id: Optional[str] = None,
    extensions: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    ts = (time_ms if time_ms is not None else time.time() * 1000.0) / 1000.0
    evt: Dict[str, Any] = {
        "specversion": "1.0",
        "id": event_id or str(uuid.uuid4()),
        "type": event_type,
        "source": source,
        "time": datetime.datetime.utcfromtimestamp(ts).strftime("%Y-%m-%dT%H:%M:%S.%f") + "Z",
        "data": data,
    }
    if subject:
        evt["subject"] = subject
    if extensions:
        for key, value in extensions.items():
            evt[key] = value
    return evt


class EventBus:
    """Thread-safe in-memory event buffer with fan-out to live subscribers."""

    def __init__(self, maxlen: int = 256):
        self._events: Deque[Dict[str, Any]] = deque(maxlen=maxlen)
        self._lock = threading.Lock()
        self._subscribers: List["queue.Queue[Dict[str, Any]]"] = []

    def emit(self, event: Dict[str, Any]) -> None:
        with self._lock:
            self._events.append(event)
            subscribers = list(self._subscribers)
        # Fan out outside the lock; a slow consumer must not stall the twin.
        for q in subscribers:
            try:
                q.put_nowait(event)
            except queue.Full:
                pass

    def subscribe(self, maxsize: int = 512) -> "queue.Queue[Dict[str, Any]]":
        """Register a live listener (used by the SSE endpoint)."""
        q: "queue.Queue[Dict[str, Any]]" = queue.Queue(maxsize=maxsize)
        with self._lock:
            self._subscribers.append(q)
        return q

    def unsubscribe(self, q: "queue.Queue[Dict[str, Any]]") -> None:
        with self._lock:
            if q in self._subscribers:
                self._subscribers.remove(q)

    @property
    def subscriber_count(self) -> int:
        with self._lock:
            return len(self._subscribers)

    def recent(self, *, limit: int = 50, since_id: Optional[str] = None) -> Iterable[Dict[str, Any]]:
        with self._lock:
            items = list(self._events)[-limit:]
        if since_id is None:
            return items
        seen = False
        filtered = []
        for evt in items:
            if evt.get("id") == since_id:
                seen = True
                continue
            if not seen:
                continue
            filtered.append(evt)
        return filtered

