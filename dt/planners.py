#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
dt/planners.py — build a planner from a strategy name.

The API, the CI gate and the blast-radius search all need "give me the planner
called 'resilient'", and each had (or would have grown) its own copy of the
name-to-planner mapping. One factory keeps the strategy vocabulary identical
everywhere, so a gate verdict describes the same planner the dashboard runs.
"""

from __future__ import annotations

from typing import Any, Dict, Optional, Tuple

from .cost_model import CostModel
from .policy.bandit import BanditPolicy
from .policy.greedy import GreedyPlanner
from .policy.mdp import MarkovPlanner
from .policy.resilient import FederatedPlanner
from .policy.rl_stub import RLPolicy
from .state import DTState

#: Strategy names accepted anywhere a strategy can be named.
STRATEGY_ALIASES: Dict[str, Tuple[str, ...]] = {
    "greedy": ("greedy", "latency", "first-fit"),
    "cheapest-energy": ("cheapest-energy", "energy", "energy-aware"),
    "cheapest-cost": ("cheapest-cost", "cost", "cost-aware", "cheapest"),
    "greenest": ("greenest", "low-carbon", "carbon", "carbon-aware"),
    "bandit": ("bandit", "bandit-greedy", "bandit-latency", "bandit-format"),
    "resilient": (
        "resilient", "network-aware", "federated", "fault-tolerant", "ft",
        "failover", "balanced", "load-balance", "load-balanced",
    ),
    "rl-markov": ("rl-markov", "mdp", "markov", "mdp-rl", "rl", "reinforcement"),
}


def canonical_strategy(name: Optional[str]) -> str:
    norm = (name or "greedy").strip().lower()
    for canonical, aliases in STRATEGY_ALIASES.items():
        if norm == canonical or norm in aliases:
            return canonical
    return "greedy"


def build_planner(name: str, state: DTState, cm: CostModel) -> Tuple[Any, Optional[str]]:
    """Return (planner, mode) for a strategy name.

    `mode` is only used by FederatedPlanner, which takes its variant as an
    argument to plan_job rather than as constructor config. Bandit and RL
    policies are built without a persist_path so a throwaway planner cannot
    write learned state into sim/.
    """
    canonical = canonical_strategy(name)
    base: Dict[str, Any] = {
        "risk_weight": 10.0,
        "energy_weight": 0.0,
        "prefer_locality_bonus_ms": 0.5,
        "require_format_match": False,
    }
    if canonical == "resilient":
        return FederatedPlanner(state, cm), (name or "resilient").strip().lower()
    if canonical == "rl-markov":
        return (
            MarkovPlanner(
                state, cm, rl_policy=RLPolicy(persist_path=None),
                gamma=0.92, failure_penalty=10.0, redundancy=3,
            ),
            None,
        )
    if canonical == "bandit":
        return GreedyPlanner(state, cm, bandit=BanditPolicy(persist_path=None), cfg=base), None
    if canonical == "cheapest-energy":
        return GreedyPlanner(state, cm, cfg={**base, "energy_weight": 0.1}), None
    if canonical == "cheapest-cost":
        return GreedyPlanner(state, cm, cfg={**base, "cost_weight": 25.0}), None
    if canonical == "greenest":
        return GreedyPlanner(state, cm, cfg={**base, "carbon_weight": 25.0}), None
    return GreedyPlanner(state, cm, cfg=base), None


def plan_once(planner, mode: Optional[str], job: Dict[str, Any]) -> Dict[str, Any]:
    if mode is not None:  # FederatedPlanner takes the mode as an argument
        return planner.plan_job(job, dry_run=True, mode=mode)
    return planner.plan_job(job, dry_run=True)
