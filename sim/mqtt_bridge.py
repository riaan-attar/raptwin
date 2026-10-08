#!/usr/bin/env python3
"""
sim/mqtt_bridge.py — event-driven telemetry ingestion via MQTT (FR-29).

DTState's file watcher polls nodes/, topology.yaml and overrides.json every
~0.5s (see dt/state.py). That's fine at this project's scale, but it isn't
event-driven. This module is the alternative path the SRS asks for: a sidecar
process that subscribes to an MQTT broker and forwards telemetry straight to
the twin, reusing the exact ingestion point sim/chaos.py's OverridesStore
already uses — POST /observe, same payload shape, same fire-and-forget
semantics. Nothing in dt/api.py or dt/state.py changes for this to work.

Why MQTT and not Kafka: Kafka needs a JVM broker; MQTT (via paho-mqtt) is a
lightweight pub/sub protocol with the same "either/or" standing in the SRS and
no infrastructure beyond a small broker like mosquitto.

Topic convention
-----------------
    fabric/<node_name>/telemetry        -> node override
    fabric/<a>__<b>/telemetry           -> link override (a, b: node names)

Payload (telemetry message body, JSON):
    {"changes": {"down": true}}                      # apply (default)
    {"action": "revert", "fields": ["down"]}          # revert

This gets translated into the same shape POST /observe already accepts:
    {"action": "apply"|"revert",
     "payload": {"type": "node"|"link", "node"|"key": ..., "changes"|"fields": ...}}

Usage
-----
    pip install -r requirements-mqtt.txt
    python -m sim.mqtt_bridge --broker-host localhost --broker-port 1883 \\
        --topic 'fabric/#' --dt http://127.0.0.1:8080/observe
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from collections.abc import Sequence
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

try:
    import requests
except (
    Exception
):  # pragma: no cover — requests is a core dependency, this mirrors chaos.py's guard
    requests = None  # type: ignore

logger = logging.getLogger("mqtt_bridge")

_TELEMETRY_SUFFIX = "/telemetry"


# --------------------------------------------------------------------------
# pure function — unit-tested directly, no broker/network needed
# --------------------------------------------------------------------------


def parse_telemetry_message(
    topic: str, payload_bytes: bytes
) -> dict[str, Any] | None:
    """MQTT (topic, payload) -> the exact dict POST /observe expects, or None.

    Never raises: a wire callback must not crash the subscribe loop on bad
    input, so every failure path logs and returns None instead.
    """
    if not topic.startswith("fabric/") or not topic.endswith(_TELEMETRY_SUFFIX):
        logger.warning("ignoring message on unrecognized topic %r", topic)
        return None

    target = topic[len("fabric/") : -len(_TELEMETRY_SUFFIX)]
    if not target:
        logger.warning("ignoring message with an empty target in topic %r", topic)
        return None

    try:
        body = json.loads(payload_bytes.decode("utf-8"))
    except Exception as exc:
        logger.warning("ignoring malformed JSON payload on %r: %s", topic, exc)
        return None
    if not isinstance(body, dict):
        logger.warning("ignoring non-object payload on %r", topic)
        return None

    action = str(body.get("action") or "apply").lower()
    if action not in ("apply", "revert"):
        logger.warning("ignoring unknown action %r on %r", action, topic)
        return None

    is_link = "__" in target
    if is_link:
        a, _, b = target.partition("__")
        if not a or not b:
            logger.warning("ignoring malformed link target %r on %r", target, topic)
            return None
        payload: dict[str, Any] = {"type": "link", "key": f"{a}|{b}"}
    else:
        payload = {"type": "node", "node": target}

    if action == "apply":
        changes = body.get("changes")
        if not isinstance(changes, dict) or not changes:
            logger.warning("ignoring apply with no 'changes' object on %r", topic)
            return None
        payload["changes"] = changes
    else:
        fields = body.get("fields")
        if not isinstance(fields, list) or not fields:
            logger.warning("ignoring revert with no 'fields' list on %r", topic)
            return None
        payload["fields"] = fields

    return {"action": action, "payload": payload}


# --------------------------------------------------------------------------
# thin transport wrapper — not unit-tested beyond its wiring (needs a broker
# for a real end-to-end check; see the module docstring / tests for the split)
# --------------------------------------------------------------------------


class MqttBridge:
    """Subscribes to `topic` on an MQTT broker, forwards parsed messages to `dt_endpoint`."""

    def __init__(
        self,
        broker_host: str,
        broker_port: int,
        topic: str = "fabric/#",
        dt_endpoint: str = "http://127.0.0.1:8080/observe",
    ):
        self.broker_host = broker_host
        self.broker_port = broker_port
        self.topic = topic
        self.dt_endpoint = dt_endpoint
        self._client = None  # built lazily in connect(), so importing this
        # module (and testing parse_telemetry_message / handle_message
        # directly) never requires paho-mqtt to be installed.

    def handle_message(self, topic: str, payload_bytes: bytes) -> None:
        """The callback body, independent of paho's message object shape —
        exercised directly in tests with a plain (topic, payload) pair."""
        parsed = parse_telemetry_message(topic, payload_bytes)
        if parsed is None:
            return
        self._post_dt(parsed)

    def _post_dt(self, body: dict[str, Any]) -> None:
        # Same fire-and-forget pattern as sim/chaos.py's OverridesStore._post_dt:
        # a flaky broker/API must not crash the subscribe loop.
        if not requests:
            logger.warning("'requests' is not available — dropping telemetry")
            return
        try:
            requests.post(self.dt_endpoint, json=body, timeout=2.0)
        except Exception as exc:
            logger.warning("failed to POST to %s: %s", self.dt_endpoint, exc)

    def connect(self) -> None:
        import paho.mqtt.client as mqtt

        client = mqtt.Client()

        def _on_connect(client, userdata, flags, rc, properties=None):
            logger.info(
                "connected to %s:%s (rc=%s), subscribing to %r",
                self.broker_host,
                self.broker_port,
                rc,
                self.topic,
            )
            client.subscribe(self.topic)

        def _on_message(client, userdata, msg):
            self.handle_message(msg.topic, msg.payload)

        client.on_connect = _on_connect
        client.on_message = _on_message
        client.connect(self.broker_host, self.broker_port)
        self._client = client

    def run_forever(self) -> None:
        self.connect()
        assert self._client is not None
        self._client.loop_forever()


# --------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------


def build_argparser() -> argparse.ArgumentParser:
    ap = argparse.ArgumentParser(
        description="MQTT -> POST /observe telemetry bridge (FR-29)."
    )
    ap.add_argument("--broker-host", default="localhost")
    ap.add_argument("--broker-port", type=int, default=1883)
    ap.add_argument("--topic", default="fabric/#")
    ap.add_argument(
        "--dt", default="http://127.0.0.1:8080/observe", help="DT /observe endpoint"
    )
    ap.add_argument("-v", "--verbose", action="store_true")
    return ap


def main(argv: Sequence[str] | None = None) -> int:
    args = build_argparser().parse_args(argv)
    logging.basicConfig(level=logging.INFO if args.verbose else logging.WARNING)

    try:
        import paho.mqtt.client  # noqa: F401
    except ImportError:
        print(
            "paho-mqtt is not installed. Run: pip install -r requirements-mqtt.txt",
            file=sys.stderr,
        )
        return 2

    bridge = MqttBridge(args.broker_host, args.broker_port, args.topic, args.dt)
    print(
        f"Subscribing to {args.topic!r} on {args.broker_host}:{args.broker_port}, "
        f"forwarding to {args.dt}"
    )
    bridge.run_forever()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
