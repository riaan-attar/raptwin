import importlib.util
import json
import pathlib
import sys
from unittest.mock import patch

import pytest

try:
    HAS_PAHO = importlib.util.find_spec("paho.mqtt.client") is not None
except ModuleNotFoundError:
    HAS_PAHO = False

ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sim.mqtt_bridge import MqttBridge, parse_telemetry_message


def payload(**body):
    return json.dumps(body).encode("utf-8")


# ----------------------------- parse_telemetry_message (pure, no broker) -----------------------------


def test_node_apply_message_parses_to_observe_shape():
    out = parse_telemetry_message(
        "fabric/srv-015/telemetry", payload(changes={"down": True})
    )
    assert out == {
        "action": "apply",
        "payload": {"type": "node", "node": "srv-015", "changes": {"down": True}},
    }


def test_node_revert_message_parses_to_observe_shape():
    out = parse_telemetry_message(
        "fabric/srv-015/telemetry", payload(action="revert", fields=["down"])
    )
    assert out == {
        "action": "revert",
        "payload": {"type": "node", "node": "srv-015", "fields": ["down"]},
    }


def test_link_apply_message_parses_with_pipe_key():
    out = parse_telemetry_message(
        "fabric/a__b/telemetry", payload(changes={"loss_pct": 5})
    )
    assert out == {
        "action": "apply",
        "payload": {"type": "link", "key": "a|b", "changes": {"loss_pct": 5}},
    }


def test_link_revert_message_parses_correctly():
    out = parse_telemetry_message(
        "fabric/a__b/telemetry", payload(action="revert", fields=["loss_pct"])
    )
    assert out == {
        "action": "revert",
        "payload": {"type": "link", "key": "a|b", "fields": ["loss_pct"]},
    }


def test_apply_defaults_when_action_omitted():
    out = parse_telemetry_message("fabric/x/telemetry", payload(changes={"down": True}))
    assert out["action"] == "apply"


@pytest.mark.parametrize(
    "topic,body",
    [
        ("not/a/fabric/topic", json.dumps({"changes": {"down": True}}).encode()),
        ("fabric/x/not-telemetry", json.dumps({"changes": {"down": True}}).encode()),
        ("fabric//telemetry", json.dumps({"changes": {"down": True}}).encode()),
        ("fabric/x/telemetry", b"{not valid json"),
        ("fabric/x/telemetry", b'"just a string"'),
        (
            "fabric/x/telemetry",
            json.dumps({"action": "sideways", "changes": {}}).encode(),
        ),
        ("fabric/x/telemetry", json.dumps({"changes": "not-a-dict"}).encode()),
        ("fabric/x/telemetry", json.dumps({"changes": {}}).encode()),  # empty changes
        (
            "fabric/x/telemetry",
            json.dumps({"action": "revert"}).encode(),
        ),  # missing fields
        (
            "fabric/a__/telemetry",
            json.dumps({"changes": {"down": True}}).encode(),
        ),  # malformed link target
    ],
)
def test_malformed_input_returns_none_never_raises(topic, body):
    assert parse_telemetry_message(topic, body) is None


# ----------------------------- MqttBridge wiring (mocked transport) -----------------------------


def test_handle_message_posts_parsed_payload_to_dt_endpoint():
    bridge = MqttBridge("localhost", 1883, dt_endpoint="http://127.0.0.1:8080/observe")
    with patch("sim.mqtt_bridge.requests") as mock_requests:
        bridge.handle_message(
            "fabric/srv-015/telemetry", payload(changes={"down": True})
        )
        mock_requests.post.assert_called_once_with(
            "http://127.0.0.1:8080/observe",
            json={
                "action": "apply",
                "payload": {
                    "type": "node",
                    "node": "srv-015",
                    "changes": {"down": True},
                },
            },
            timeout=2.0,
        )


def test_handle_message_on_malformed_input_never_posts():
    bridge = MqttBridge("localhost", 1883)
    with patch("sim.mqtt_bridge.requests") as mock_requests:
        bridge.handle_message("not/fabric", b"garbage")
        mock_requests.post.assert_not_called()


def test_post_failure_is_swallowed_not_raised():
    """A flaky broker/API must not crash the subscribe loop (mirrors OverridesStore._post_dt)."""
    bridge = MqttBridge("localhost", 1883)
    with patch("sim.mqtt_bridge.requests") as mock_requests:
        mock_requests.post.side_effect = Exception("connection refused")
        bridge.handle_message(
            "fabric/x/telemetry", payload(changes={"down": True})
        )  # must not raise


def test_bridge_construction_needs_no_paho_import():
    """Importing/constructing MqttBridge must work without paho-mqtt installed —
    only .connect()/.run_forever() need it, imported lazily."""
    MqttBridge("localhost", 1883, topic="fabric/#", dt_endpoint="http://x/observe")


# ----------------------------- transport layer (needs paho-mqtt) -----------------------------


@pytest.mark.skipif(
    not HAS_PAHO, reason="paho-mqtt not installed (requirements-mqtt.txt)"
)
def test_connect_subscribes_to_configured_topic():
    bridge = MqttBridge("localhost", 1883, topic="fabric/#")
    with patch("paho.mqtt.client.Client") as MockClient:
        instance = MockClient.return_value
        bridge.connect()
        instance.connect.assert_called_once_with("localhost", 1883)
        assert instance.on_connect is not None
        assert instance.on_message is not None
