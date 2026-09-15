# RAP twin: Project Analysis, Problem Statement, and Solution

## Project Overview
**RAP twin** is a high-fidelity digital-twin and planning sandbox designed for distributed computing fabrics. It enables researchers and engineers to experiment with job placement, scheduling policies, and performance analytics in a safe, simulated environment that mirrors real-world complexities.

---

## 1. Problem Statement
In the modern distributed computing landscape (e.g., Edge Computing, Multi-Cloud, Hybrid Fabrics), several critical challenges arise:

- **Complex Scheduling**: Traditional scheduling often fails to account for heterogeneous hardware, varying link reliability, and dynamic thermal conditions. Evaluating new policies on production infrastructure is risky and expensive.
- **Unpredictable Failures**: Systems must be resilient to link outages, node failures, and thermal throttling. There is a lack of tools to systematically inject these "chaos" scenarios to validate system resilience.
- **Performance Variability**: Telemetry from diverse sources (CPU cores, RAM, VRAM, network loss) is often siloed, making it difficult to create a unified "predictive" view of how a job will perform on a specific node.
- **Evaluation Difficulty**: Comparing multiple scheduling strategies (e.g., Greedy vs. Reinforcement Learning) across thousands of trials (Monte-Carlo) requires a specialized, reproducible testing framework.

---

## 2. The Solution: RAP twin
The **RAP twin** ecosystem provides an end-to-end solution for these problems by offering a "Digital Twin" of the entire fabric:

### A. Digital Twin State (The Core)
- **Unified State Machine**: Continuously merges static descriptors (YAML) with live telemetry via the `/observe` endpoint.
- **Predictive Analytics**: Computes real-time metrics like thermals, reliability, and network loss, allowing planners to make "informed" decisions.

### B. Multi-Strategy Planning Engine
- **Pluggable Policies**: Supports a wide array of strategies from simple `greedy` and `cheapest-energy` to advanced `resilient`, `federated`, and `RL-Markov` models.
- **Dry-Run Mode**: Allows users to evaluate plans without committing resources, facilitating "what-if" analysis.

### C. Chaos Engineering & Simulation
- **Deterministic Failure Injection**: A chaos engine that can replay failure schedules (e.g., link-fail, power-surge) to test how planners adapt.
- **Monte-Carlo Runner**: Enables large-scale benchmarking by running thousands of trials to quantify policy performance under uncertainty.

### D. Visual Dashboard & API
- **Real-time Monitoring**: A Flask-based UI for visualizing topology maps, node health, and job history.
- **Interoperability**: Exposes a standard REST API for submission and telemetry ingestion, and can export state to industry standards like Azure DTDL or Kubernetes CRDs.

---

## 5. In-Depth Analysis of Components

### A. Digital Twin API (`dt/`)
The heart of the system. It maintains the current state of the fabric, including node utilization and link health.
- **State Machine**: Handles transitions between node states (active, down, derated).
- **Scheduling Policies**: Implements the core logic for job placement.
- **Telemetry Ingestion**: Consumes live updates via the `/observe` endpoint to maintain "twin" parity with the physical world.

### B. Planner CLI (`planner/`)
The primary interface for users to submit workloads.
- **Batch Submission**: Supports JSON/YAML job documents with multiple stages.
- **Dry-Run Evaluator**: Predicts the impact of a plan without committing resources.
- **Strategy Selection**: Allows switching between different algorithms (e.g., `greedy`, `resilient`, `rl-markov`) on the fly.

### C. Simulation & Chaos Engine (`sim/`)
Provides the "sandbox" environment.
- **Synthetic Generator**: Creates realistic node and topology descriptors.
- **Chaos Engine**: Injects deterministic failures to test resilience.
- **Monte-Carlo Runner**: Orchestrates thousands of trials to produce statistically significant results.

### D. User Interface (`ui/`)
A monitoring dashboard for humans.
- **Topology Maps**: Visualizes the layout and health of the fabric.
- **Job History**: Tracks past planning decisions and their outcomes.
- **Strategy Comparison**: Side-by-side view of how different planners would handle the same job.

---

## 6. Development & Implementation Roadmap

1.  **Core Foundation**:
    - Build the `dt.state.DTState` to manage node/link metadata.
    - Implement the `/snapshot` and `/observe` REST endpoints.
2.  **Planning Engine**:
    - Develop the base `greedy` planner.
    - Add `resilient` and `network-aware` scoring models.
3.  **Simulation & Validation**:
    - Build the synthetic node generator (`sim.gen_nodes`).
    - Create the Monte-Carlo runner for policy evaluation.
4.  **User Experience**:
    - Develop the Flask-based dashboard (`ui/dashboard.py`).
    - Add visualization for topology and job analytics.
