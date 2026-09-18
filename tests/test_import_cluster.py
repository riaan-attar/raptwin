import json
import pathlib
import sys

import pytest
import yaml

ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from dt.state import DTState  # noqa: E402
from tools.import_cluster import (  # noqa: E402
    convert_cluster,
    convert_node,
    main,
    parse_quantity,
    sanitize_name,
    write_descriptors,
)


def k8s_node(
    name="ip-10-0-1-5.ec2.internal",
    cpu="16",
    memory="65851236Ki",
    arch="amd64",
    zone="us-east-1a",
    gpu=None,
    ready=True,
    labels=None,
):
    node_labels = {
        "kubernetes.io/arch": arch,
        "topology.kubernetes.io/zone": zone,
        "node.kubernetes.io/instance-type": "m5.4xlarge",
        **(labels or {}),
    }
    capacity = {"cpu": cpu, "memory": memory, "pods": "110"}
    if gpu:
        capacity["nvidia.com/gpu"] = str(gpu)
    return {
        "metadata": {"name": name, "labels": node_labels},
        "status": {
            "capacity": capacity,
            "nodeInfo": {
                "architecture": arch,
                "osImage": "Ubuntu 24.04.1 LTS",
                "kernelVersion": "6.8.0-45-generic",
                "containerRuntimeVersion": "containerd://1.7.22",
            },
            "conditions": [{"type": "Ready", "status": "True" if ready else "False"}],
        },
    }


def cluster(*nodes):
    return {"apiVersion": "v1", "kind": "List", "items": list(nodes)}


# ----------------------------- quantities -----------------------------


@pytest.mark.parametrize(
    "value,expected",
    [
        ("4", 4.0),
        (8, 8.0),
        ("250m", 0.25),
        ("16Gi", 16 * 1024**3),
        ("65851236Ki", 65851236 * 1024.0),
        ("2G", 2e9),
        (None, 0.0),
        ("garbage", 0.0),
    ],
)
def test_parse_quantity(value, expected):
    assert parse_quantity(value) == pytest.approx(expected)


def test_sanitize_name_keeps_dots_and_dashes():
    assert sanitize_name("ip-10-0-1-5.ec2.internal") == "ip-10-0-1-5.ec2.internal"
    assert sanitize_name("node/weird name!") == "node-weird-name"
    assert sanitize_name("") == "node"


# ----------------------------- conversion -----------------------------


def test_converts_capacity_and_topology():
    descriptor, notes = convert_node(k8s_node())

    assert descriptor["name"] == "ip-10-0-1-5.ec2.internal"
    assert descriptor["arch"] == "amd64"
    assert descriptor["cpu"]["cores"] == 16
    assert descriptor["memory"]["ram_gb"] == pytest.approx(62.8, abs=0.2)
    assert descriptor["labels"]["zone"] == "us-east-1a"
    assert descriptor["labels"]["instance_type"] == "m5.4xlarge"
    assert descriptor["labels"]["imported_from"] == "kubernetes"
    assert notes == []


def test_gpu_capacity_enables_cuda():
    descriptor, _ = convert_node(
        k8s_node(gpu=2, labels={"nvidia.com/gpu.product": "NVIDIA-A100", "nvidia.com/gpu.memory": "40960"})
    )
    assert descriptor["gpu"]["count"] == 2
    assert descriptor["gpu"]["model"] == "NVIDIA-A100"
    assert descriptor["gpu"]["vram_gb"] == pytest.approx(40.0)
    assert "cuda" in descriptor["formats_supported"]


def test_gpu_without_a_vram_label_is_flagged():
    descriptor, notes = convert_node(k8s_node(gpu=1))
    assert descriptor["gpu"]["vram_gb"] == 0
    assert any("VRAM" in n for n in notes)


def test_control_plane_becomes_a_manager():
    descriptor, _ = convert_node(k8s_node(labels={"node-role.kubernetes.io/control-plane": ""}))
    assert descriptor["role"] == "manager"


def test_not_ready_node_is_imported_as_down():
    descriptor, notes = convert_node(k8s_node(ready=False))
    assert descriptor["dyn"]["down"] is True
    assert any("not Ready" in n for n in notes)


def test_arm_architecture_is_mapped():
    descriptor, _ = convert_node(k8s_node(arch="aarch64"))
    assert descriptor["arch"] == "arm64"


def test_unknown_architecture_defaults_and_warns():
    descriptor, notes = convert_node(k8s_node(arch="s390x"))
    assert descriptor["arch"] == "amd64"
    assert any("s390x" in n for n in notes)


def test_missing_capacity_gets_usable_defaults():
    node = k8s_node()
    node["status"]["capacity"] = {}
    descriptor, notes = convert_node(node)
    assert descriptor["cpu"]["cores"] == 1 and descriptor["memory"]["ram_gb"] == 1.0
    assert len(notes) == 2


def test_single_node_object_is_accepted():
    payload = {**k8s_node(), "kind": "Node"}
    descriptors, _ = convert_cluster(payload)
    assert len(descriptors) == 1


def test_duplicate_sanitised_names_are_disambiguated():
    descriptors, notes = convert_cluster(cluster(k8s_node(name="a/b"), k8s_node(name="a-b")))
    assert {d["name"] for d in descriptors} == {"a-b", "a-b-2"}
    assert any("duplicate" in n for n in notes)


def test_empty_or_wrong_payload_is_rejected():
    with pytest.raises(SystemExit):
        convert_cluster({"kind": "Pod"})
    with pytest.raises(SystemExit):
        convert_cluster(cluster())


# ----------------------------- writing & loading -----------------------------


def test_written_descriptors_load_into_the_twin(tmp_path):
    descriptors, _ = convert_cluster(
        cluster(k8s_node(name="worker-1"), k8s_node(name="gpu-1", gpu=1, zone="us-east-1b"))
    )
    written, skipped = write_descriptors(descriptors, tmp_path / "nodes", overwrite=False)
    assert written == 2 and skipped == []

    topo = tmp_path / "topology.yaml"
    topo.write_text(yaml.safe_dump({"defaults": {}, "links": []}), encoding="utf-8")
    state = DTState(
        nodes_dir=str(tmp_path / "nodes"),
        topology_path=str(topo),
        overrides_path=str(tmp_path / "o.json"),
        auto_start_watchers=False,
    )
    try:
        snapshot = state.snapshot()
        assert {n["name"] for n in snapshot["nodes"]} == {"worker-1", "gpu-1"}
        # Capacity survived the round trip, which is what the planner needs.
        worker = next(n for n in snapshot["nodes"] if n["name"] == "worker-1")
        assert worker["caps"]["max_cpu_cores"] == 16
        assert worker["caps"]["ram_gb"] > 60
    finally:
        state.stop()


def test_existing_files_are_kept_unless_overwrite(tmp_path):
    descriptors, _ = convert_cluster(cluster(k8s_node(name="keep-me")))
    write_descriptors(descriptors, tmp_path, overwrite=False)
    (tmp_path / "keep-me.yaml").write_text("hand edited", encoding="utf-8")

    written, skipped = write_descriptors(descriptors, tmp_path, overwrite=False)
    assert written == 0 and skipped == ["keep-me.yaml"]
    assert (tmp_path / "keep-me.yaml").read_text(encoding="utf-8") == "hand edited"

    written, _ = write_descriptors(descriptors, tmp_path, overwrite=True)
    assert written == 1 and "hand edited" not in (tmp_path / "keep-me.yaml").read_text(encoding="utf-8")


# ----------------------------- CLI -----------------------------


def test_cli_dry_run_writes_nothing(tmp_path, capsys):
    payload = tmp_path / "cluster.json"
    payload.write_text(json.dumps(cluster(k8s_node(gpu=1))), encoding="utf-8")
    out = tmp_path / "out"

    code = main(["--from-file", str(payload), "--out", str(out), "--dry-run"])

    assert code == 0
    assert not out.exists()
    printed = capsys.readouterr().out
    assert "Imported 1 node(s)" in printed
    # The summary must be explicit about what Kubernetes could not tell us.
    assert "cannot describe these" in printed and "cpu.base_ghz" in printed


def test_cli_rejects_bad_json(tmp_path, capsys):
    payload = tmp_path / "bad.json"
    payload.write_text("{not json", encoding="utf-8")
    assert main(["--from-file", str(payload)]) == 2
    assert "not valid JSON" in capsys.readouterr().err
