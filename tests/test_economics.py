import pathlib
import sys

import pytest
import yaml

ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from dt.cost_model import CostModel  # noqa: E402
from dt.economics import Economics, annotate_plan, crosses_site  # noqa: E402
from dt.policy.greedy import GreedyPlanner  # noqa: E402
from dt.state import DTState  # noqa: E402

DEFAULTS = {
    "pricing": {
        "currency": "INR",
        "cpu_core_hour": 2.0,
        "gpu_hour": 30.0,
        "npu_hour": 6.0,
        "memory_gb_hour": 0.8,
        "egress_gb": 1.0,
    },
    "energy": {
        "price_per_kwh": 8.0,
        "grid_co2_g_per_kwh": 720.0,
        "zones": {
            "solar": {"grid_co2_g_per_kwh": 50.0, "price_per_kwh": 2.0},
        },
    },
}

STAGE = {"id": "s1", "size_mb": 1024, "resources": {"cpu_cores": 4, "mem_gb": 8}}


def node(name="n1", zone="rackA", tdp=200.0, cores=16, ram=64, vram=0):
    return {
        "name": name,
        "class": "server",
        "arch": "amd64",
        "role": "worker",
        "cpu": {"cores": cores, "base_ghz": 3.0},
        "memory": {"ram_gb": ram},
        "gpu": {"vram_gb": vram},
        "power": {"tdp_w": tdp},
        "network": {"fabric": "ethernet", "speed_gbps": 10},
        "labels": {"zone": zone},
        "formats_supported": ["native", "wasm", "cuda"],
        "health": {},
    }


@pytest.fixture()
def econ():
    return Economics.from_defaults(DEFAULTS)


# ----------------------------- pricing -----------------------------


def test_reads_topology_pricing_and_energy(econ):
    assert econ.currency == "INR"
    assert econ.cpu_core_hour == 2.0
    assert econ.grid_co2_g_per_kwh == 720.0
    assert econ.priced


def test_unpriced_topology_is_reported_as_such():
    bare = Economics.from_defaults({})
    assert not bare.priced
    costs = bare.stage_cost(node=node(), stage=STAGE, compute_ms=3600_000, energy_kj=3600)
    assert costs["total"] == 0.0 and costs["co2_g"] == 0.0


def test_stage_cost_matches_hand_calculation(econ):
    # One hour of 4 cores + 8 GB, and exactly 1 kWh of electricity.
    costs = econ.stage_cost(node=node(), stage=STAGE, compute_ms=3_600_000, energy_kj=3600.0)
    assert costs["compute"] == pytest.approx(4 * 2.0 + 8 * 0.8)  # 14.4
    assert costs["energy"] == pytest.approx(8.0)
    assert costs["co2_g"] == pytest.approx(720.0)
    assert costs["total"] == pytest.approx(14.4 + 8.0)


def test_gpu_hour_billed_only_for_accelerated_stages(econ):
    plain = econ.stage_cost(node=node(), stage=STAGE, compute_ms=3_600_000, energy_kj=0.0)
    cuda = econ.stage_cost(node=node(), stage=STAGE, compute_ms=3_600_000, energy_kj=0.0, fmt="cuda")
    npu = econ.stage_cost(node=node(), stage=STAGE, compute_ms=3_600_000, energy_kj=0.0, fmt="npu")
    assert cuda["compute"] - plain["compute"] == pytest.approx(30.0)
    assert npu["compute"] - plain["compute"] == pytest.approx(6.0)


def test_egress_charged_only_when_leaving_the_site(econ):
    local = econ.stage_cost(node=node(), stage=STAGE, compute_ms=1000, energy_kj=0.0)
    remote = econ.stage_cost(
        node=node(), stage=STAGE, compute_ms=1000, energy_kj=0.0, transfer_mb=1024, crosses_site=True
    )
    assert local["egress"] == 0.0
    assert remote["egress"] == pytest.approx(1.0)  # 1 GB at 1 INR/GB


def test_zone_overrides_beat_fabric_defaults(econ):
    dirty = econ.stage_cost(node=node(zone="rackA"), stage=STAGE, compute_ms=3_600_000, energy_kj=3600.0)
    clean = econ.stage_cost(node=node(zone="solar"), stage=STAGE, compute_ms=3_600_000, energy_kj=3600.0)
    assert clean["co2_g"] == pytest.approx(50.0)
    assert clean["energy"] == pytest.approx(2.0)
    assert clean["total"] < dirty["total"]


def test_rate_is_duration_independent(econ):
    """Rates are what planners can score on; absolute cost of a 300 ms stage is ~0."""
    short = econ.stage_rate(node=node(), stage=STAGE, compute_ms=300.0, energy_kj=60.0)
    long = econ.stage_rate(node=node(), stage=STAGE, compute_ms=3000.0, energy_kj=600.0)
    assert short["cost_per_hour"] == pytest.approx(long["cost_per_hour"])
    assert short["co2_g_per_hour"] == pytest.approx(long["co2_g_per_hour"])
    assert short["rental_per_hour"] == pytest.approx(4 * 2.0 + 8 * 0.8)


# ----------------------------- against a live twin -----------------------------


@pytest.fixture()
def fabric(tmp_path):
    """Two-node fabric: one fast but power-hungry, one slower and efficient."""
    nodes = tmp_path / "nodes"
    nodes.mkdir()
    (nodes / "fast.yaml").write_text(
        yaml.safe_dump(node("fast", zone="rackA", tdp=900.0, cores=64, ram=256)), encoding="utf-8"
    )
    (nodes / "green.yaml").write_text(
        yaml.safe_dump(node("green", zone="solar", tdp=120.0, cores=48, ram=256)), encoding="utf-8"
    )
    topo = tmp_path / "topology.yaml"
    topo.write_text(yaml.safe_dump({"defaults": DEFAULTS, "links": []}), encoding="utf-8")
    state = DTState(
        nodes_dir=str(nodes),
        topology_path=str(topo),
        overrides_path=str(tmp_path / "o.json"),
        auto_start_watchers=False,
    )
    yield state
    state.stop()


def test_annotate_plan_fills_cost_for_any_planner(fabric):
    job = {"id": "j", "stages": [dict(STAGE)]}
    plan = GreedyPlanner(fabric, CostModel(fabric)).plan_job(job, dry_run=True)

    annotate_plan(fabric, job, plan)

    assert plan["currency"] == "INR"
    assert plan["cost_total"] > 0
    assert plan["co2_g"] > 0
    assert plan["cost_breakdown"]["compute"] > 0
    stage = plan["per_stage"][0]
    assert stage["cost"] > 0 and stage["co2_g"] > 0


def test_carbon_objective_picks_the_cleaner_node(fabric):
    job = {"id": "j", "stages": [dict(STAGE)]}
    cm = CostModel(fabric)
    base = {"risk_weight": 10.0, "energy_weight": 0.0}

    latency_plan = GreedyPlanner(fabric, cm, cfg=base).plan_job(job, dry_run=True)
    green_plan = GreedyPlanner(fabric, cm, cfg={**base, "carbon_weight": 25.0}).plan_job(
        job, dry_run=True
    )
    annotate_plan(fabric, job, latency_plan)
    annotate_plan(fabric, job, green_plan)

    assert latency_plan["assignments"]["s1"] == "fast"
    assert green_plan["assignments"]["s1"] == "green"
    assert green_plan["co2_g"] < latency_plan["co2_g"]


def test_infeasible_stage_is_not_billed(fabric):
    job = {"id": "j", "stages": [{"id": "s1", "resources": {"cpu_cores": 10_000}}]}
    plan = GreedyPlanner(fabric, CostModel(fabric)).plan_job(job, dry_run=True)

    annotate_plan(fabric, job, plan)

    assert plan["infeasible"]
    assert plan["cost_total"] is None
    assert plan["per_stage"][0]["cost"] is None


def test_crosses_site_uses_labels_not_node_names(fabric):
    assert crosses_site(fabric, "fast", "green")
    assert not crosses_site(fabric, "fast", "fast")
    assert not crosses_site(fabric, None, "green")
