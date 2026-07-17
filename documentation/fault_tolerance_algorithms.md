# Fault Tolerance Algorithms in RAP twin

This document provides a detailed list and explanation of all the fault tolerance, resilience, and self-healing algorithms implemented in the **RAP twin** digital-twin and planning ecosystem.

---

## 1. Proactive Fault-Tolerant Planning Policies

These algorithms are executed during the job planning phase. They analyze the dynamic state of the fabric (retrieved from the digital twin) to produce placements that minimize risk and handle potential failures.

### A. Resilient Placement Strategy (`resilient` / `fault-tolerant` / `ft` / `failover`)
* **Implementation:** [FederatedPlanner](../dt/policy/resilient.py) in `dt/policy/resilient.py`
* **Mechanism:**
  * **Standby Shadow Assignments:** Rather than producing a single assignment per stage, it schedules multiple redundant assignments based on the job's `redundancy` factor (defaulting to 2). This results in one *primary* placement and `redundancy - 1` *shadow* (standby) placements.
  * **Disjoint Cross-Federation Standbys:** To guard against correlated infrastructure failures (such as power outages or backhaul link failures affecting an entire region), the planner prioritizes selecting shadow standby nodes located in different federations (zones/regions) from the primary node.
  * **Multi-Criteria Utility Scoring:** Nodes are evaluated based on a compound penalty function:
    $$\text{Score} = \text{compute\_ms} + \text{xfer\_ms} + \text{load\_penalty} + \text{spread\_penalty} + \text{network\_penalty} + \text{resilience\_penalty} + \text{risk\_penalty} + \text{reliability\_penalty} + \text{availability\_penalty}$$
  * **Pre-Warmed Reservations:** If `dry_run` is disabled, the planner actively reserves resources for both primary and shadow standby assignments via the `reserve` API, securing capacity in advance of potential failures.

### B. Network-Aware Placement Strategy (`network-aware` / `balanced` / `load-balanced`)
* **Implementation:** [FederatedPlanner](../dt/policy/resilient.py) in `dt/policy/resilient.py`
* **Mechanism:**
  * **Link Loss & Latency Constraints:** Evaluates network reliability between sequential stages of a job. It applies severe penalties (`network_penalty`) if a candidate node relies on a network link that is degraded (high `loss_pct`) or offline (`down` status), ensuring the job is scheduled across resilient paths.

### C. Federated Saturated-Load Balancing (`federated`)
* **Implementation:** [FederatedPlanner](../dt/policy/resilient.py) in `dt/policy/resilient.py`
* **Mechanism:**
  * **Federation Health Penalization:** Looks at aggregate metrics for federations, calculating how much of the federation is down (`down_fraction`) or overheated (`hot_fraction`). It steers new work away from unhealthy or saturated federated zones.

### D. Markov Decision Process (MDP) with Reinforcement Learning (`rl-markov` / `mdp` / `rl`)
* **Implementation:** [MarkovPlanner](../dt/policy/mdp.py) in `dt/policy/mdp.py` and [RLPolicy](../dt/policy/rl_stub.py) in `dt/policy/rl_stub.py`
* **Mechanism:**
  * **Finite-Horizon MDP formulation:** Formulates the scheduling of sequential job stages as an MDP.
  * **DP with Failure Discounting:** The dynamic programming solver backs up an expected value function ($V$-value / $Q$-value) that discounts future stages and incorporates failure penalties based on node risk and reliability metrics.
  * **Availability Window Forecasting:** Incorporates predictions of node availability windows. Nodes with a predicted failure window shorter than the defined horizon are heavily penalized in the DP backup, steering placements to nodes with higher expected lifespans.

---

## 2. Reactive Fault Tolerance & Self-Healing

These controllers run continuously in the background, monitoring active placements and dynamically reacting to live failure telemetry.

### A. Self-Healing Controller (`SelfHealingController`)
* **Implementation:** [SelfHealingController](../dt/self_heal.py) in `dt/self_heal.py`
* **Mechanism:**
  * **Daemon Monitoring:** Runs a background loop polling active job reservations at a configurable interval (default: 2.0s).
  * **Dynamic Standby Promotion:** Detects if a primary node degrades (reliability drops below `reliability_threshold`, default: 0.75, or the predicted failure window falls below `availability_threshold_sec`, default: 90s) or fails. It immediately:
    1. Releases the degraded primary node reservation.
    2. Promotes the freshest active shadow/standby reservation to be the new primary.
    3. Emits a `fabric.selfheal.promote` event.
  * **On-the-Fly Failover Recovery:** If no active standby reservations are available, the controller searches the pre-computed fallback nodes for the stage and reserves a new primary node on the fly (emitting a `fabric.selfheal.failover` event).
  * **Shadow Capacity Maintenance:** Regularly ensures that the desired level of redundancy is maintained by reserving additional standby nodes from the fallback list when a standby is promoted or lost.

---

## 3. Telemetry Integration & Predictive Risk Modelling

The fault tolerance algorithms rely on dynamic telemetry fed into the digital twin to make informed, resilient scheduling decisions.

### A. Predictive Risk Assessment
* **Implementation:** `risk_score` in [cost_model.py](../dt/cost_model.py)
* **Mechanism:** Calculates a node risk score (from `0.0` to `1.0`) by aggregating the following factors:
  * **Trust:** Based on labels (`R_W_TRUST` = 0.25).
  * **SSD Wear:** Based on TBW percentage (`R_W_SSD_WEAR` = 0.15).
  * **Crash Frequency:** Based on node crash history (`R_W_CRASH` = 0.15).
  * **Thermals:** Based on thermal throttling/derating (`R_W_THERMAL` = 0.15).
  * **Network Loss:** Based on packet loss of connected links (`R_W_LINK_LOSS` = 0.10).
  * **Reliability:** Based on calculated node reliability (`R_W_RELIABILITY` = 0.20).
  * **Availability Window:** Adds up to `0.15` penalty if node availability is predicted to be under 2 minutes.

### B. Adaptive Parameter Adjustment
* **Implementation:** `_adaptive_mode_cfg` in [resilient.py](../dt/policy/resilient.py)
* **Mechanism:** If average node reliability across the fabric drops below 85%, or if link losses/latencies spike, the system automatically inflates the weights for network and reliability penalties (e.g. scaling reliability weight by 1.2x) to automatically shift to a more conservative, risk-averse planning configuration.
wdaw