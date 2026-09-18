#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
tools/bundle.py — package a run so someone else can reproduce it exactly.

A bug report that says "the planner did something odd" is unreproducible: the
fabric, the job, the injected faults and the commit all matter. An incident
bundle is a single zip carrying all of them, plus the events and plans that were
in flight, so a colleague (or a paper reviewer) can load it and see the same
thing.

    python -m tools.bundle export --out incident.zip
    python -m tools.bundle inspect incident.zip
    python -m tools.bundle import incident.zip --into /tmp/replay

    # then, against the unpacked bundle
    FABRIC_JOBS_ROOT=/tmp/replay/jobs python -m dt.api

Layout inside the zip
---------------------
    manifest.json        commit, timestamp, tool version, contents, node/link counts
    nodes/*.yaml         every node descriptor, as loaded
    topology.yaml        the fabric
    jobs/*.yaml          the job catalogue
    overrides.json       faults in force at capture time
    snapshot.json        the twin's state at capture time (read-only evidence)
    events.json          recent CloudEvents
    plans.json           recent plan results

`import` never writes into the repo: it unpacks to a directory you name, and
refuses to overwrite a non-empty one unless you pass --force.
"""

from __future__ import annotations

import argparse
import io
import json
import shutil
import sys
import time
import zipfile
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

BUNDLE_VERSION = 1
MANIFEST_NAME = "manifest.json"


def git_sha() -> str:
    head = ROOT / ".git" / "HEAD"
    try:
        ref = head.read_text(encoding="utf-8").strip()
        if ref.startswith("ref: "):
            return (ROOT / ".git" / ref[5:]).read_text(encoding="utf-8").strip()[:12]
        return ref[:12]
    except Exception:
        return "unknown"


def build_bundle(
    *,
    nodes_dir: Path,
    topology_path: Path,
    jobs_dir: Optional[Path] = None,
    overrides_path: Optional[Path] = None,
    snapshot: Optional[Dict[str, Any]] = None,
    events: Optional[List[Dict[str, Any]]] = None,
    plans: Optional[List[Dict[str, Any]]] = None,
    note: Optional[str] = None,
    extra: Optional[Dict[str, Any]] = None,
) -> bytes:
    """Return the bundle as zip bytes, so callers can stream or save it."""
    buffer = io.BytesIO()
    contents: List[str] = []

    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        node_files = sorted(nodes_dir.glob("*.yaml")) if nodes_dir.exists() else []
        for path in node_files:
            zf.write(path, f"nodes/{path.name}")
        if node_files:
            contents.append(f"nodes/ ({len(node_files)} files)")

        if topology_path.exists():
            zf.write(topology_path, "topology.yaml")
            contents.append("topology.yaml")

        job_files = sorted(jobs_dir.glob("*.y*ml")) if jobs_dir and jobs_dir.exists() else []
        for path in job_files:
            zf.write(path, f"jobs/{path.name}")
        if job_files:
            contents.append(f"jobs/ ({len(job_files)} files)")

        if overrides_path and overrides_path.exists():
            zf.write(overrides_path, "overrides.json")
            contents.append("overrides.json")

        for name, payload in (
            ("snapshot.json", snapshot),
            ("events.json", events),
            ("plans.json", plans),
        ):
            if payload is not None:
                zf.writestr(name, json.dumps(payload, indent=2, default=str))
                contents.append(name)

        manifest = {
            "bundle_version": BUNDLE_VERSION,
            "created_ts": int(time.time() * 1000),
            "created_iso": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "commit": git_sha(),
            "note": note,
            "contents": contents,
            "counts": {
                "nodes": len(node_files),
                "jobs": len(job_files),
                "links": len((snapshot or {}).get("links") or []),
                "events": len(events or []),
                "plans": len(plans or []),
            },
            **(extra or {}),
        }
        zf.writestr(MANIFEST_NAME, json.dumps(manifest, indent=2))

    return buffer.getvalue()


def read_manifest(bundle_path: Path) -> Dict[str, Any]:
    with zipfile.ZipFile(bundle_path) as zf:
        if MANIFEST_NAME not in zf.namelist():
            raise SystemExit(f"{bundle_path}: not a RAP twin bundle (no {MANIFEST_NAME})")
        manifest = json.loads(zf.read(MANIFEST_NAME).decode("utf-8"))
    version = manifest.get("bundle_version")
    if version != BUNDLE_VERSION:
        manifest["_warning"] = (
            f"bundle_version {version} but this tool writes {BUNDLE_VERSION}"
        )
    return manifest


def import_bundle(bundle_path: Path, dest: Path, *, force: bool = False) -> Dict[str, Any]:
    """Unpack a bundle into `dest`. Never touches the repo's own nodes/ or jobs/."""
    manifest = read_manifest(bundle_path)
    if dest.exists() and any(dest.iterdir()) and not force:
        raise SystemExit(f"{dest} is not empty — pass --force to overwrite it")
    if dest.exists() and force:
        shutil.rmtree(dest)
    dest.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(bundle_path) as zf:
        for member in zf.namelist():
            # zipfile.extract() already blocks absolute paths and '..', but this
            # is untrusted input from a bug report, so be explicit.
            target = (dest / member).resolve()
            if not str(target).startswith(str(dest.resolve())):
                raise SystemExit(f"{bundle_path}: refusing unsafe path '{member}'")
        zf.extractall(dest)
    return manifest


def describe(manifest: Dict[str, Any]) -> str:
    counts = manifest.get("counts") or {}
    lines = [
        f"RAP twin incident bundle (v{manifest.get('bundle_version')})",
        f"  captured   {manifest.get('created_iso')} at commit {manifest.get('commit')}",
        f"  fabric     {counts.get('nodes', 0)} nodes, {counts.get('links', 0)} links",
        f"  catalogue  {counts.get('jobs', 0)} job file(s)",
        f"  evidence   {counts.get('events', 0)} events, {counts.get('plans', 0)} plans",
    ]
    if manifest.get("note"):
        lines.append(f"  note       {manifest['note']}")
    if manifest.get("_warning"):
        lines.append(f"  warning    {manifest['_warning']}")
    lines.append(f"  contents   {', '.join(manifest.get('contents') or []) or '(empty)'}")
    return "\n".join(lines) + "\n"


# --------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------


def build_argparser() -> argparse.ArgumentParser:
    ap = argparse.ArgumentParser(description="Package or replay a reproducible incident bundle.")
    sub = ap.add_subparsers(dest="command", required=True)

    export = sub.add_parser("export", help="write a bundle from the local fabric")
    export.add_argument("--out", default="incident.zip")
    export.add_argument("--nodes-dir", default=str(ROOT / "nodes"))
    export.add_argument("--topology", default=str(ROOT / "sim" / "topology.yaml"))
    export.add_argument("--jobs-dir", default=str(ROOT / "jobs"))
    export.add_argument("--overrides", default=str(ROOT / "sim" / "overrides.json"))
    export.add_argument("--note", help="why you captured this")
    export.add_argument(
        "--remote",
        help="capture snapshot/events/plans from a running API too, e.g. http://127.0.0.1:8080",
    )

    inspect = sub.add_parser("inspect", help="print a bundle's manifest")
    inspect.add_argument("bundle")

    imp = sub.add_parser("import", help="unpack a bundle for replay")
    imp.add_argument("bundle")
    imp.add_argument("--into", required=True)
    imp.add_argument("--force", action="store_true")
    return ap


def _fetch_live(base: str) -> Dict[str, Any]:
    """Best-effort capture from a running API; a bundle is still useful without it."""
    import urllib.request

    out: Dict[str, Any] = {}
    for name, path in (
        ("snapshot", "/snapshot"),
        ("events", "/events?limit=200"),
        ("plans", "/plans"),
    ):
        try:
            with urllib.request.urlopen(base.rstrip("/") + path, timeout=5) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
            data = payload.get("data")
            out[name] = data.get("events") if name == "events" and isinstance(data, dict) else data
        except Exception as exc:
            print(f"  ! could not fetch {path}: {exc}", file=sys.stderr)
    return out


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = build_argparser().parse_args(argv)

    if args.command == "export":
        live = _fetch_live(args.remote) if args.remote else {}
        data = build_bundle(
            nodes_dir=Path(args.nodes_dir),
            topology_path=Path(args.topology),
            jobs_dir=Path(args.jobs_dir),
            overrides_path=Path(args.overrides),
            snapshot=live.get("snapshot"),
            events=live.get("events"),
            plans=live.get("plans"),
            note=args.note,
        )
        out = Path(args.out)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_bytes(data)
        print(describe(read_manifest(out)))
        print(f"  wrote {out} ({len(data) / 1024:.0f} KB)")
        return 0

    if args.command == "inspect":
        print(describe(read_manifest(Path(args.bundle))))
        return 0

    manifest = import_bundle(Path(args.bundle), Path(args.into), force=args.force)
    print(describe(manifest))
    print(f"  unpacked into {args.into}")
    print(f"  replay with: FABRIC_JOBS_ROOT={args.into}/jobs python -m dt.api")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
