import pathlib
import sys

import pytest
import yaml

ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

docker = pytest.importorskip("docker")  # optional dependency (requirements.txt)

from fabric_docker.launch_fabric import (
    build_container_spec,
    node_from_yaml,
)


def gpu_node(**gpu_overrides):
    gpu = {"type": "none", "vendor": "none", "model": "none", "vram_gb": 0}
    gpu.update(gpu_overrides)
    return {
        "name": "test-node",
        "arch": "amd64",
        "class": "server",
        "resources": {"cpu_cores": 8, "mem_gb": 16},
        "formats_supported": ["native"],
        "labels": {"zone": "lab"},
        "gpu": gpu,
    }


# ----------------------------- node_from_yaml -----------------------------


def test_gpu_less_node_has_no_gpu_fields_set():
    ns = node_from_yaml(gpu_node())
    assert ns.gpu_present is False
    assert ns.gpu_vram_gb == 0


def test_real_gpu_node_populates_gpu_fields():
    obj = gpu_node(type="real", vendor="nvidia", model="RTX-A2000", vram_gb=12)
    ns = node_from_yaml(obj)
    assert ns.gpu_present is True
    assert ns.gpu_vram_gb == 12
    assert ns.gpu_vendor == "nvidia"
    assert ns.gpu_model == "RTX-A2000"


def test_missing_gpu_block_defaults_to_absent():
    obj = gpu_node()
    del obj["gpu"]
    ns = node_from_yaml(obj)
    assert ns.gpu_present is False


def test_real_descriptor_shapes_from_nodes_dir():
    """Cross-check against actual nodes/*.yaml, not just a hand-built fixture."""
    with_gpu = node_from_yaml(
        yaml.safe_load((ROOT / "nodes" / "grig-021.yaml").read_text())
    )
    assert with_gpu.gpu_present is True
    assert with_gpu.gpu_vram_gb == 12
    assert with_gpu.gpu_vendor == "nvidia"
    assert with_gpu.gpu_model == "RTX-A2000"

    without_gpu = node_from_yaml(
        yaml.safe_load((ROOT / "nodes" / "grig-001.yaml").read_text())
    )
    assert without_gpu.gpu_present is False


# ----------------------------- build_container_spec -----------------------------


def test_gpu_less_node_spec_is_unchanged_no_regression():
    ns = node_from_yaml(gpu_node())
    spec = build_container_spec(ns, "alpine:3.20", "fab-")
    assert "device_requests" not in spec
    assert not any(k.startswith("fabric.gpu.") for k in spec["labels"])
    # Everything else matches exactly what this function produced before FR-28.
    assert spec["name"] == "fab-test-node"
    assert spec["mem_limit"] == 16 * 1024**3
    assert spec["cpu_quota"] == 800000
    assert spec["labels"] == {
        "fabric.name": "test-node",
        "fabric.arch": "amd64",
        "fabric.class": "server",
        "fabric.formats": "native",
        "fabric.label.zone": "lab",
    }


def test_gpu_node_spec_requests_a_gpu_device():
    obj = gpu_node(type="real", vendor="nvidia", model="RTX-A2000", vram_gb=12)
    ns = node_from_yaml(obj)
    spec = build_container_spec(ns, "alpine:3.20", "fab-")

    assert len(spec["device_requests"]) == 1
    request = spec["device_requests"][0]
    assert request["Count"] == 1
    assert request["Capabilities"] == [["gpu"]]

    assert spec["labels"]["fabric.gpu.vendor"] == "nvidia"
    assert spec["labels"]["fabric.gpu.model"] == "RTX-A2000"
    assert spec["labels"]["fabric.gpu.vram_gb"] == "12.0"


def test_device_request_construction_has_no_side_effects():
    """DeviceRequest is a plain data object — no real daemon/GPU is needed to test it."""
    dr = docker.types.DeviceRequest(count=1, capabilities=[["gpu"]])
    assert dict(dr)["Count"] == 1
