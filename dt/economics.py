#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
dt/economics.py — money and carbon for a plan.

`sim/topology.yaml` already declares `defaults.pricing` (currency, per-core-hour,
GPU/NPU-hour, memory, egress) and `defaults.energy` (price per kWh, grid carbon
intensity). Nothing read them, so every planner optimised joules while an
operator actually budgets money and, increasingly, emissions.

This module turns a planner result into a bill:

    cost = compute rental + electricity + egress
    co2  = energy_kwh x grid_co2_g_per_kwh

Modelling note
--------------
Compute rental and electricity are reported separately and then summed. On a
cloud bill the core-hour price usually already includes power, so for a pure
cloud comparison read `cost_breakdown.compute` on its own; the total is the
right number for self-hosted fabrics, where the operator pays for hardware
amortisation and the electricity bill.

Used by dt/api.py (annotate every plan) and dt/policy/greedy.py (the
`cheapest-cost` and `greenest` strategies score candidates on it).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

try:
    from .state import safe_float
except ImportError:  # pragma: no cover - standalone use
    def safe_float(x: Any, default: float = 0.0) -> float:
        try:
            return float(x)
        except Exception:
            return default


DEFAULT_PRICING: Dict[str, Any] = {
    "currency": "USD",
    "cpu_core_hour": 0.0,
    "gpu_hour": 0.0,
    "npu_hour": 0.0,
    "memory_gb_hour": 0.0,
    "storage_gb_month": 0.0,
    "egress_gb": 0.0,
}

DEFAULT_ENERGY: Dict[str, Any] = {
    "grid_co2_g_per_kwh": 0.0,
    "price_per_kwh": 0.0,
}

MS_PER_HOUR = 3_600_000.0
KJ_PER_KWH = 3600.0


@dataclass
class Economics:
    """Prices and carbon intensity, as declared by the topology defaults."""

    currency: str = "USD"
    cpu_core_hour: float = 0.0
    gpu_hour: float = 0.0
    npu_hour: float = 0.0
    memory_gb_hour: float = 0.0
    egress_gb: float = 0.0
    price_per_kwh: float = 0.0
    grid_co2_g_per_kwh: float = 0.0
    #: per-zone overrides, e.g. {"cloudlet": {"price_per_kwh": 11.0}}
    zones: Dict[str, Dict[str, float]] = field(default_factory=dict)

    @classmethod
    def from_defaults(cls, defaults: Optional[Dict[str, Any]]) -> "Economics":
        defaults = defaults or {}
        pricing = {**DEFAULT_PRICING, **(defaults.get("pricing") or {})}
        energy = {**DEFAULT_ENERGY, **(defaults.get("energy") or {})}
        zones_raw = (defaults.get("energy") or {}).get("zones") or {}
        zones = {
            str(zone): {k: safe_float(v, 0.0) for k, v in (values or {}).items()}
            for zone, values in zones_raw.items()
            if isinstance(values, dict)
        }
        return cls(
            currency=str(pricing.get("currency") or "USD"),
            cpu_core_hour=safe_float(pricing.get("cpu_core_hour"), 0.0),
            gpu_hour=safe_float(pricing.get("gpu_hour"), 0.0),
            npu_hour=safe_float(pricing.get("npu_hour"), 0.0),
            memory_gb_hour=safe_float(pricing.get("memory_gb_hour"), 0.0),
            egress_gb=safe_float(pricing.get("egress_gb"), 0.0),
            price_per_kwh=safe_float(energy.get("price_per_kwh"), 0.0),
            grid_co2_g_per_kwh=safe_float(energy.get("grid_co2_g_per_kwh"), 0.0),
            zones=zones,
        )

    @classmethod
    def from_state(cls, state: Any) -> "Economics":
        return cls.from_defaults(getattr(state, "defaults", None) or {})

    @property
    def priced(self) -> bool:
        """True when the topology declares anything worth billing."""
        return any(
            v > 0
            for v in (
                self.cpu_core_hour,
                self.gpu_hour,
                self.npu_hour,
                self.memory_gb_hour,
                self.egress_gb,
                self.price_per_kwh,
                self.grid_co2_g_per_kwh,
            )
        )

    # ---- per-zone grid --------------------------------------------------

    def _zone_of(self, node: Optional[Dict[str, Any]]) -> Optional[str]:
        labels = (node or {}).get("labels") or {}
        for key in ("zone", "site", "region"):
            if labels.get(key):
                return str(labels[key])
        return None

    def carbon_intensity_for(self, node: Optional[Dict[str, Any]]) -> float:
        """Grid intensity at this node's zone, falling back to the fabric default.

        A solar-powered edge site and a coal-grid rack should not be charged the
        same carbon, so `defaults.energy.zones.<zone>.grid_co2_g_per_kwh` wins
        when present.
        """
        zone = self._zone_of(node)
        if zone and zone in self.zones:
            override = self.zones[zone].get("grid_co2_g_per_kwh")
            if override is not None:
                return safe_float(override, self.grid_co2_g_per_kwh)
        return self.grid_co2_g_per_kwh

    def power_price_for(self, node: Optional[Dict[str, Any]]) -> float:
        zone = self._zone_of(node)
        if zone and zone in self.zones:
            override = self.zones[zone].get("price_per_kwh")
            if override is not None:
                return safe_float(override, self.price_per_kwh)
        return self.price_per_kwh

    # ---- costing --------------------------------------------------------

    def stage_cost(
        self,
        *,
        node: Optional[Dict[str, Any]],
        stage: Dict[str, Any],
        compute_ms: float,
        energy_kj: float,
        transfer_mb: float = 0.0,
        crosses_site: bool = False,
        fmt: Optional[str] = None,
    ) -> Dict[str, float]:
        """Cost and carbon for one stage placed on one node."""
        hours = max(0.0, safe_float(compute_ms, 0.0)) / MS_PER_HOUR
        resources = stage.get("resources") or {}
        cores = safe_float(resources.get("cpu_cores"), 0.0)
        mem_gb = safe_float(resources.get("mem_gb"), 0.0)
        vram_gb = safe_float(resources.get("gpu_vram_gb"), 0.0)

        compute = cores * self.cpu_core_hour * hours
        compute += mem_gb * self.memory_gb_hour * hours
        # An accelerator is billed whenever the stage actually runs on one.
        accel = (fmt or "").lower()
        if accel in {"cuda", "asic"} or vram_gb > 0:
            compute += self.gpu_hour * hours
        elif accel == "npu":
            compute += self.npu_hour * hours

        kwh = max(0.0, safe_float(energy_kj, 0.0)) / KJ_PER_KWH
        electricity = kwh * self.power_price_for(node)
        egress = (max(0.0, safe_float(transfer_mb, 0.0)) / 1024.0) * self.egress_gb if crosses_site else 0.0
        co2_g = kwh * self.carbon_intensity_for(node)

        return {
            "compute": round(compute, 6),
            "energy": round(electricity, 6),
            "egress": round(egress, 6),
            "total": round(compute + electricity + egress, 6),
            "co2_g": round(co2_g, 4),
            "kwh": round(kwh, 8),
        }


    def stage_rate(
        self,
        *,
        node: Optional[Dict[str, Any]],
        stage: Dict[str, Any],
        compute_ms: float,
        energy_kj: float,
        fmt: Optional[str] = None,
    ) -> Dict[str, float]:
        """Spend and emissions *per hour* for this placement.

        Planners compare candidates, and a stage that runs for 300 ms rents
        hardware for 300 ms — absolute cost is then ~0 for every node, so an
        objective built on it cannot discriminate no matter how it is weighted.
        Rates are duration-independent (a node either is or is not expensive),
        which makes them the scoreable quantity. Absolute cost stays the number
        we report on the finished plan.
        """
        resources = stage.get("resources") or {}
        cores = safe_float(resources.get("cpu_cores"), 0.0)
        mem_gb = safe_float(resources.get("mem_gb"), 0.0)
        vram_gb = safe_float(resources.get("gpu_vram_gb"), 0.0)

        rental_per_hour = cores * self.cpu_core_hour + mem_gb * self.memory_gb_hour
        accel = (fmt or "").lower()
        if accel in {"cuda", "asic"} or vram_gb > 0:
            rental_per_hour += self.gpu_hour
        elif accel == "npu":
            rental_per_hour += self.npu_hour

        # energy_kj over compute_ms is kJ/s, i.e. kW — so power is recovered
        # without needing the node's TDP curve again.
        seconds = max(1e-9, safe_float(compute_ms, 0.0) / 1000.0)
        kw = max(0.0, safe_float(energy_kj, 0.0)) / seconds
        power_per_hour = kw * self.power_price_for(node)
        co2_per_hour = kw * self.carbon_intensity_for(node)

        return {
            "cost_per_hour": round(rental_per_hour + power_per_hour, 6),
            "rental_per_hour": round(rental_per_hour, 6),
            "co2_g_per_hour": round(co2_per_hour, 4),
            "kw": round(kw, 6),
        }


def crosses_site(state: Any, a: Optional[str], b: Optional[str]) -> bool:
    """True when a transfer between two nodes leaves its site (egress is billed)."""
    if not a or not b or a == b:
        return False
    return _site_of(state, a) != _site_of(state, b)


def _site_of(state: Any, node_name: Optional[str]) -> Optional[str]:
    if not node_name:
        return None
    node = state.get_node(node_name) if hasattr(state, "get_node") else None
    labels = (node or {}).get("labels") or {}
    for key in ("site", "zone", "region"):
        if labels.get(key):
            return str(labels[key])
    return None


def annotate_plan(state: Any, job: Dict[str, Any], plan: Dict[str, Any]) -> Dict[str, Any]:
    """Add cost and carbon to a planner result, in place.

    Works off `plan["per_stage"]`, so every planner (greedy, federated, MDP)
    is costed identically instead of each one growing its own pricing code.
    """
    econ = Economics.from_state(state)
    stages_by_id = {s.get("id"): s for s in (job.get("stages") or []) if isinstance(s, dict)}
    per_stage: List[Dict[str, Any]] = plan.get("per_stage") or []

    totals = {"compute": 0.0, "energy": 0.0, "egress": 0.0, "total": 0.0, "co2_g": 0.0, "kwh": 0.0}
    prev_node: Optional[str] = None
    priced_any = False

    for entry in per_stage:
        if not isinstance(entry, dict):
            continue
        node_name = entry.get("node")
        stage = stages_by_id.get(entry.get("id")) or {}
        node = state.get_node(node_name) if node_name and hasattr(state, "get_node") else None
        compute_ms = safe_float(entry.get("compute_ms"), 0.0)
        energy_kj = safe_float(entry.get("energy_kj"), 0.0)
        if node is None or not _finite(compute_ms):
            entry["cost"] = None
            entry["co2_g"] = None
            prev_node = node_name
            continue

        crosses = bool(prev_node and prev_node != node_name and _site_of(state, prev_node) != _site_of(state, node_name))
        costs = econ.stage_cost(
            node=node,
            stage=stage,
            compute_ms=compute_ms,
            energy_kj=energy_kj,
            transfer_mb=safe_float(stage.get("size_mb"), 0.0),
            crosses_site=crosses,
            fmt=entry.get("format"),
        )
        entry["cost"] = costs["total"]
        entry["cost_breakdown"] = costs
        entry["co2_g"] = costs["co2_g"]
        for key in totals:
            totals[key] += costs[key]
        priced_any = True
        prev_node = node_name

    plan["currency"] = econ.currency
    plan["cost_total"] = round(totals["total"], 6) if priced_any else None
    plan["cost_breakdown"] = {k: round(v, 6) for k, v in totals.items()} if priced_any else None
    plan["co2_g"] = round(totals["co2_g"], 4) if priced_any else None
    plan["energy_kwh"] = round(totals["kwh"], 8) if priced_any else None
    return plan


def _finite(x: float) -> bool:
    return x == x and x not in (float("inf"), float("-inf"))
