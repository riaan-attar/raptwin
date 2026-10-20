import json

import pytest

from dt import api
from tests.test_management import client, fabric, state  # noqa: F401  (fixtures)


def _strict(text):
    def boom(token):
        raise AssertionError(f"non-JSON token {token}")

    return json.loads(text, parse_constant=boom)


def test_json_safe_replaces_non_finite_floats():
    out = api._json_safe({"a": float("inf"), "b": [float("-inf"), float("nan"), 1.5], "c": (2, float("inf")), "d": "Infinity", "e": 3})
    assert out == {"a": None, "b": [None, None, 1.5], "c": [2, None], "d": "Infinity", "e": 3}


def test_infeasible_plan_is_strict_json(client):  # noqa: F811
    job = {
        "id": "too-big",
        "deadline_ms": 1000,
        "stages": [
            {"id": "s1", "type": "cv", "size_mb": 10, "resources": {"cpu_cores": 100000, "mem_gb": 1}, "allowed_formats": ["native"]}
        ],
    }
    resp = client.post("/plan", json={"job": job, "strategy": "greedy", "dry_run": True})
    body = _strict(resp.get_data(as_text=True))
    assert body["data"]["infeasible"] is True
    assert body["data"]["latency_ms"] is None


def test_plans_history_is_strict_json(client):  # noqa: F811
    resp = client.get("/plans")
    _strict(resp.get_data(as_text=True))
