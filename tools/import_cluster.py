#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
tools/import_cluster.py — build a twin from a real Kubernetes cluster.

dt/exporters.py already writes the twin *out* as DTDL and Kubernetes CRDs. This
is the other direction: point it at a cluster and get `nodes/*.yaml`, so nobody
has to hand-write a hundred descriptors before trying the simulator.

    # straight from a cluster
    kubectl get nodes -o json | python -m tools.import_cluster --out nodes/

    # or from a saved dump, which is also how the tests drive it
    python -m tools.import_cluster --from-file cluster.json --out /tmp/twin --dry-run

What maps to what
-----------------
    metadata.name                        -> name
    status.nodeInfo.architecture         -> arch        (amd64 / arm64 / riscv64)
    status.capacity.cpu                  -> cpu.cores
    status.capacity.memory (Ki)          -> memory.ram_gb
    status.capacity."nvidia.com/gpu"     -> gpu.*       (model/VRAM from labels)
    topology.kubernetes.io/zone          -> labels.zone
    node.kubernetes.io/instance-type     -> labels.instance_type
    node-role.kubernetes.io/control-plane-> role: manager
    status.conditions[Ready]             -> dyn.down when not Ready

What cannot be imported
-----------------------
A Kubernetes node object says nothing about power draw, thermal behaviour,
storage wear, link topology or trust. Those fields are written with explicit
defaults and listed in the summary, because the cost model reads them: an
imported fabric gives believable *placement*, but its energy, carbon and risk
numbers are only as good as the defaults you replace.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import yaml  # noqa: E402

from dt.state import valid_name  # noqa: E402

#: Defaults for everything Kubernetes cannot tell us. Surfaced in the summary.
ASSUMED = {
    "cpu.base_ghz": 2.5,
    "cpu.turbo_ghz": 3.5,
    "cpu.tdp_w": 65.0,
    "power.tdp_total_w": 120.0,
    "storage.type": "nvme",
    "storage.size_gb": 512,
    "network.fabric": "ethernet",
    "network.speed_gbps": 10.0,
    "network.base_latency_ms": 1.0,
    "health.reliability": 0.95,
    "labels.trust": "0.8",
}

_ARCH_MAP = {"amd64": "amd64", "x86_64": "amd64", "arm64": "arm64", "aarch64": "arm64",
             "riscv64": "riscv64"}

# 2 CPU cores per Ki of... no: Kubernetes quantities carry SI/binary suffixes.
_QUANTITY_RE = re.compile(r"^(?P<num>\d+(?:\.\d+)?)(?P<suffix>[a-zA-Z]*)$")
_SUFFIXES = {
    "": 1.0, "m": 0.001,
    "k": 1e3, "K": 1e3, "M": 1e6, "G": 1e9, "T": 1e12, "P": 1e15,
    "Ki": 1024.0, "Mi": 1024.0**2, "Gi": 1024.0**3, "Ti": 1024.0**4, "Pi": 1024.0**5,
}


def parse_quantity(value: Any) -> float:
    """Kubernetes resource quantity -> float ('4', '250m', '16Gi', '32768Ki')."""
    if value is None:
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    match = _QUANTITY_RE.match(str(value).strip())
    if not match:
        return 0.0
    return float(match.group("num")) * _SUFFIXES.get(match.group("suffix"), 1.0)


def sanitize_name(raw: str) -> str:
    """Kubernetes names allow dots and dashes; node names become file names."""
    name = re.sub(r"[^A-Za-z0-9._-]", "-", str(raw or "")).strip("-.")
    return name[:64] or "node"


def _role_of(labels: Dict[str, str]) -> str:
    for key in labels:
        if key.startswith("node-role.kubernetes.io/"):
            role = key.split("/", 1)[1]
            if role in {"control-plane", "master"}:
                return "manager"
            if role in {"worker", ""}:
                return "worker"
            if role in {"storage", "gateway", "accelerator"}:
                return role
    return "worker"


def _formats_for(gpu_count: float, labels: Dict[str, str]) -> List[str]:
    formats = ["native", "wasm"]
    if gpu_count > 0:
        formats.insert(0, "cuda")
    if any("npu" in k.lower() for k in labels):
        formats.append("npu")
    return formats


def convert_node(item: Dict[str, Any]) -> Tuple[Dict[str, Any], List[str]]:
    """One Kubernetes node object -> (descriptor, notes)."""
    notes: List[str] = []
    meta = item.get("metadata") or {}
    status = item.get("status") or {}
    labels: Dict[str, str] = {str(k): str(v) for k, v in (meta.get("labels") or {}).items()}
    capacity = status.get("capacity") or status.get("allocatable") or {}
    node_info = status.get("nodeInfo") or {}

    raw_name = meta.get("name") or ""
    name = sanitize_name(raw_name)
    if name != raw_name:
        notes.append(f"renamed '{raw_name}' -> '{name}' to be usable as a file name")

    arch_raw = str(node_info.get("architecture") or labels.get("kubernetes.io/arch") or "amd64")
    arch = _ARCH_MAP.get(arch_raw, "amd64")
    if arch_raw not in _ARCH_MAP:
        notes.append(f"{name}: unknown architecture '{arch_raw}', assumed amd64")

    cores = parse_quantity(capacity.get("cpu"))
    ram_gb = parse_quantity(capacity.get("memory")) / (1024.0**3)
    gpu_count = parse_quantity(capacity.get("nvidia.com/gpu")) or parse_quantity(
        capacity.get("amd.com/gpu")
    )
    if cores <= 0:
        notes.append(f"{name}: no CPU capacity reported, defaulted to 1 core")
        cores = 1.0
    if ram_gb <= 0:
        notes.append(f"{name}: no memory capacity reported, defaulted to 1 GB")
        ram_gb = 1.0

    zone = (
        labels.get("topology.kubernetes.io/zone")
        or labels.get("failure-domain.beta.kubernetes.io/zone")
        or labels.get("topology.kubernetes.io/region")
        or "imported"
    )
    ready = next(
        (c for c in (status.get("conditions") or []) if c.get("type") == "Ready"), {}
    )
    is_ready = str(ready.get("status", "True")).lower() == "true"
    if not is_ready:
        notes.append(f"{name}: not Ready in the cluster, imported as down")

    vram_mib = parse_quantity(labels.get("nvidia.com/gpu.memory"))
    gpu_model = labels.get("nvidia.com/gpu.product") or labels.get("gpu.model")
    if gpu_count > 0 and not vram_mib:
        notes.append(f"{name}: GPU present but no VRAM label, assumed 0 GB (set gpu.vram_gb)")

    descriptor: Dict[str, Any] = {
        "name": name,
        "class": _class_for(labels, cores, gpu_count),
        "arch": arch,
        "role": _role_of(labels),
        "os": {
            "distro": str(node_info.get("osImage") or "unknown"),
            "kernel": str(node_info.get("kernelVersion") or "unknown"),
            "container_runtime": str(node_info.get("containerRuntimeVersion") or "containerd"),
        },
        "cpu": {
            "cores": int(round(cores)),
            "base_ghz": ASSUMED["cpu.base_ghz"],
            "turbo_ghz": ASSUMED["cpu.turbo_ghz"],
            "tdp_w": ASSUMED["cpu.tdp_w"],
        },
        "memory": {"ram_gb": round(ram_gb, 2), "ecc": True},
        "storage": {"type": ASSUMED["storage.type"], "size_gb": ASSUMED["storage.size_gb"]},
        "power": {"tdp_total_w": ASSUMED["power.tdp_total_w"], "battery_present": False},
        "gpu": (
            {
                "type": "real",
                "vendor": "nvidia" if capacity.get("nvidia.com/gpu") else "amd",
                "model": gpu_model or "unknown",
                "vram_gb": round(vram_mib / 1024.0, 2) if vram_mib else 0,
                "count": int(gpu_count),
            }
            if gpu_count > 0
            else {"type": "none", "vram_gb": 0}
        ),
        "network": {
            "fabric": ASSUMED["network.fabric"],
            "speed_gbps": ASSUMED["network.speed_gbps"],
            "base_latency_ms": ASSUMED["network.base_latency_ms"],
        },
        "formats_supported": _formats_for(gpu_count, labels),
        "labels": {
            "zone": zone,
            "trust": ASSUMED["labels.trust"],
            "imported_from": "kubernetes",
            **(
                {"instance_type": labels["node.kubernetes.io/instance-type"]}
                if labels.get("node.kubernetes.io/instance-type")
                else {}
            ),
        },
        "health": {"reliability": ASSUMED["health.reliability"], "thermal_derate": 0.0},
        "data_locality": [],
    }
    if not is_ready:
        descriptor["dyn"] = {"down": True}
    return descriptor, notes


def _class_for(labels: Dict[str, str], cores: float, gpu_count: float) -> str:
    """Best-effort node class — it drives nothing but reads better in the UI."""
    instance = (labels.get("node.kubernetes.io/instance-type") or "").lower()
    if "raspberry" in instance or "rpi" in instance:
        return "sbc"
    if gpu_count > 0 and cores >= 32:
        return "hpc"
    if cores >= 16:
        return "server"
    if cores <= 4:
        return "sbc"
    return "workstation"


def convert_cluster(payload: Dict[str, Any]) -> Tuple[List[Dict[str, Any]], List[str]]:
    """Accept `kubectl get nodes -o json` (a List) or a single Node object."""
    if not isinstance(payload, dict):
        raise SystemExit("expected a JSON object from kubectl")
    kind = str(payload.get("kind") or "")
    if kind == "Node":
        items = [payload]
    elif "items" in payload:
        items = [i for i in (payload.get("items") or []) if isinstance(i, dict)]
    else:
        raise SystemExit(
            "no nodes found: pass the output of `kubectl get nodes -o json` "
            f"(got kind={kind or 'unknown'})"
        )
    if not items:
        raise SystemExit("the cluster reported zero nodes")

    descriptors: List[Dict[str, Any]] = []
    notes: List[str] = []
    seen: Dict[str, int] = {}
    for item in items:
        descriptor, item_notes = convert_node(item)
        name = descriptor["name"]
        if name in seen:  # two cluster names that sanitise to the same file name
            seen[name] += 1
            descriptor["name"] = f"{name}-{seen[name]}"
            notes.append(f"duplicate name '{name}', stored as '{descriptor['name']}'")
        else:
            seen[name] = 1
        if not valid_name(descriptor["name"]):
            notes.append(f"skipped '{descriptor['name']}': unusable as a node name")
            continue
        descriptors.append(descriptor)
        notes.extend(item_notes)
    return descriptors, notes


def write_descriptors(descriptors: Sequence[Dict[str, Any]], out_dir: Path, overwrite: bool) -> Tuple[int, List[str]]:
    written = 0
    skipped: List[str] = []
    out_dir.mkdir(parents=True, exist_ok=True)
    for descriptor in descriptors:
        target = out_dir / f"{descriptor['name']}.yaml"
        if target.exists() and not overwrite:
            skipped.append(target.name)
            continue
        target.write_text(yaml.safe_dump(descriptor, sort_keys=False), encoding="utf-8")
        written += 1
    return written, skipped


def summarise(descriptors: Sequence[Dict[str, Any]], notes: Sequence[str]) -> str:
    zones: Dict[str, int] = {}
    total_cores = 0
    total_ram = 0.0
    gpus = 0
    for d in descriptors:
        zones[d["labels"]["zone"]] = zones.get(d["labels"]["zone"], 0) + 1
        total_cores += int(d["cpu"]["cores"])
        total_ram += float(d["memory"]["ram_gb"])
        gpus += int((d.get("gpu") or {}).get("count") or 0)

    lines = [
        f"Imported {len(descriptors)} node(s): {total_cores} cores, "
        f"{total_ram:.0f} GB RAM, {gpus} GPU(s)",
        f"  zones: {', '.join(f'{z} ({n})' for z, n in sorted(zones.items()))}",
        "",
        "  Kubernetes cannot describe these, so defaults were written:",
    ]
    lines += [f"    {key} = {value}" for key, value in ASSUMED.items()]
    lines.append(
        "  Placement will be believable; energy, carbon and risk numbers are only"
    )
    lines.append("  as good as those defaults, and no links were imported.")
    if notes:
        lines += ["", "  Notes:"] + [f"    - {n}" for n in notes[:20]]
        if len(notes) > 20:
            lines.append(f"    ... and {len(notes) - 20} more")
    return "\n".join(lines) + "\n"


def build_argparser() -> argparse.ArgumentParser:
    ap = argparse.ArgumentParser(
        description="Build nodes/*.yaml from a Kubernetes cluster (kubectl get nodes -o json)."
    )
    ap.add_argument("--from-file", help="read JSON from a file instead of stdin")
    ap.add_argument("--out", default="nodes", help="directory for the descriptors")
    ap.add_argument("--dry-run", action="store_true", help="print the summary, write nothing")
    ap.add_argument("--overwrite", action="store_true", help="replace existing descriptors")
    return ap


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = build_argparser().parse_args(argv)
    raw = Path(args.from_file).read_text(encoding="utf-8") if args.from_file else sys.stdin.read()
    if not raw.strip():
        print("no input — pipe `kubectl get nodes -o json` or pass --from-file", file=sys.stderr)
        return 2
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        print(f"input is not valid JSON: {exc}", file=sys.stderr)
        return 2

    descriptors, notes = convert_cluster(payload)
    print(summarise(descriptors, notes))

    if args.dry_run:
        print(f"  dry run: would write {len(descriptors)} file(s) to {args.out}/")
        return 0

    written, skipped = write_descriptors(descriptors, Path(args.out), args.overwrite)
    print(f"  wrote {written} descriptor(s) to {args.out}/")
    if skipped:
        print(f"  kept {len(skipped)} existing file(s) — pass --overwrite to replace: "
              f"{', '.join(skipped[:5])}{'...' if len(skipped) > 5 else ''}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
