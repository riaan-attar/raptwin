import io
import json
import pathlib
import sys
import zipfile

import pytest
import yaml

ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from dt.state import DTState  # noqa: E402
from tools.bundle import (  # noqa: E402
    BUNDLE_VERSION,
    build_bundle,
    describe,
    import_bundle,
    main,
    read_manifest,
)


@pytest.fixture()
def fabric(tmp_path):
    nodes = tmp_path / "nodes"
    nodes.mkdir()
    for name in ("srv-015.yaml", "ws-014.yaml"):
        (nodes / name).write_text((ROOT / "nodes" / name).read_text(encoding="utf-8"), encoding="utf-8")
    topo = tmp_path / "topology.yaml"
    topo.write_text((ROOT / "sim" / "topology.yaml").read_text(encoding="utf-8"), encoding="utf-8")
    jobs = tmp_path / "jobs"
    jobs.mkdir()
    (jobs / "j.yaml").write_text(
        yaml.safe_dump({"jobs": [{"id": "one", "stages": [{"id": "s1"}]}]}), encoding="utf-8"
    )
    overrides = tmp_path / "overrides.json"
    overrides.write_text(json.dumps({"nodes": {"srv-015": {"down": True}}, "links": {}}), encoding="utf-8")
    return tmp_path


def make(fabric, **kwargs):
    return build_bundle(
        nodes_dir=fabric / "nodes",
        topology_path=fabric / "topology.yaml",
        jobs_dir=fabric / "jobs",
        overrides_path=fabric / "overrides.json",
        **kwargs,
    )


def entries(data: bytes):
    return set(zipfile.ZipFile(io.BytesIO(data)).namelist())


# ----------------------------- export -----------------------------


def test_bundle_carries_the_whole_fabric(fabric):
    data = make(fabric, note="why I captured this")
    names = entries(data)

    assert {"nodes/srv-015.yaml", "nodes/ws-014.yaml", "topology.yaml", "jobs/j.yaml",
            "overrides.json", "manifest.json"} <= names

    manifest = json.loads(zipfile.ZipFile(io.BytesIO(data)).read("manifest.json"))
    assert manifest["bundle_version"] == BUNDLE_VERSION
    assert manifest["counts"]["nodes"] == 2
    assert manifest["note"] == "why I captured this"
    assert manifest["commit"]  # recorded so a replay can check out the same code


def test_live_evidence_is_included_when_given(fabric):
    data = make(
        fabric,
        snapshot={"nodes": [{"name": "srv-015"}], "links": [{"key": "a|b"}]},
        events=[{"id": "1", "type": "fabric.node.observe"}],
        plans=[{"job_id": "one"}],
    )
    names = entries(data)
    assert {"snapshot.json", "events.json", "plans.json"} <= names

    manifest = json.loads(zipfile.ZipFile(io.BytesIO(data)).read("manifest.json"))
    assert manifest["counts"] == {"nodes": 2, "jobs": 1, "links": 1, "events": 1, "plans": 1}


def test_bundle_without_live_evidence_still_works(fabric):
    names = entries(make(fabric))
    assert "snapshot.json" not in names
    assert "nodes/srv-015.yaml" in names


def test_missing_sources_are_skipped_not_fatal(tmp_path):
    data = build_bundle(nodes_dir=tmp_path / "gone", topology_path=tmp_path / "nope.yaml")
    manifest = json.loads(zipfile.ZipFile(io.BytesIO(data)).read("manifest.json"))
    assert manifest["counts"]["nodes"] == 0
    assert manifest["contents"] == []


# ----------------------------- import -----------------------------


def test_round_trip_replays_in_the_twin(fabric, tmp_path):
    bundle = tmp_path / "incident.zip"
    bundle.write_bytes(make(fabric, note="round trip"))
    dest = tmp_path / "replay"

    manifest = import_bundle(bundle, dest)

    assert manifest["note"] == "round trip"
    state = DTState(
        nodes_dir=str(dest / "nodes"),
        topology_path=str(dest / "topology.yaml"),
        overrides_path=str(dest / "overrides.json"),
        auto_start_watchers=False,
    )
    try:
        snapshot = state.snapshot()
        assert {n["name"] for n in snapshot["nodes"]} == {"srv-015", "ws-014"}
        assert snapshot["links"], "topology links should come back"
        # The captured fault is in force again — that is the point of a bundle.
        assert next(n for n in snapshot["nodes"] if n["name"] == "srv-015")["dyn"]["down"] is True
    finally:
        state.stop()


def test_import_refuses_to_clobber_a_non_empty_directory(fabric, tmp_path):
    bundle = tmp_path / "incident.zip"
    bundle.write_bytes(make(fabric))
    dest = tmp_path / "dest"
    dest.mkdir()
    (dest / "precious.txt").write_text("keep me", encoding="utf-8")

    with pytest.raises(SystemExit) as excinfo:
        import_bundle(bundle, dest)
    assert "not empty" in str(excinfo.value)
    assert (dest / "precious.txt").exists()

    import_bundle(bundle, dest, force=True)
    assert not (dest / "precious.txt").exists()


def test_a_zip_that_is_not_a_bundle_is_rejected(tmp_path):
    bogus = tmp_path / "random.zip"
    with zipfile.ZipFile(bogus, "w") as zf:
        zf.writestr("hello.txt", "hi")
    with pytest.raises(SystemExit) as excinfo:
        read_manifest(bogus)
    assert "not a RAP twin bundle" in str(excinfo.value)


def test_path_traversal_in_a_bundle_is_refused(tmp_path):
    """Bundles arrive from bug reports, so treat their paths as untrusted."""
    evil = tmp_path / "evil.zip"
    with zipfile.ZipFile(evil, "w") as zf:
        zf.writestr("manifest.json", json.dumps({"bundle_version": BUNDLE_VERSION}))
        zf.writestr("../escaped.yaml", "pwned")
    with pytest.raises(SystemExit) as excinfo:
        import_bundle(evil, tmp_path / "dest")
    assert "unsafe path" in str(excinfo.value)
    assert not (tmp_path / "escaped.yaml").exists()


def test_version_mismatch_is_flagged_not_fatal(tmp_path):
    odd = tmp_path / "future.zip"
    with zipfile.ZipFile(odd, "w") as zf:
        zf.writestr("manifest.json", json.dumps({"bundle_version": 99, "counts": {}}))
    manifest = read_manifest(odd)
    assert "bundle_version 99" in manifest["_warning"]
    assert "warning" in describe(manifest)


# ----------------------------- CLI -----------------------------


def test_cli_export_inspect_import(fabric, tmp_path, capsys):
    out = tmp_path / "out" / "incident.zip"
    code = main(
        [
            "export",
            "--out", str(out),
            "--nodes-dir", str(fabric / "nodes"),
            "--topology", str(fabric / "topology.yaml"),
            "--jobs-dir", str(fabric / "jobs"),
            "--overrides", str(fabric / "overrides.json"),
            "--note", "cli test",
        ]
    )
    assert code == 0 and out.exists()
    assert "wrote" in capsys.readouterr().out

    assert main(["inspect", str(out)]) == 0
    printed = capsys.readouterr().out
    assert "incident bundle" in printed and "cli test" in printed

    assert main(["import", str(out), "--into", str(tmp_path / "replay")]) == 0
    assert (tmp_path / "replay" / "nodes" / "srv-015.yaml").exists()
    assert "replay with:" in capsys.readouterr().out
