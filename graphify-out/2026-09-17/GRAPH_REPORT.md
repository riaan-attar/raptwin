# Graph Report - raptwin  (2026-09-17)

## Corpus Check
- 183 files · ~165,556 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 10 file(s) not represented in the graph (top: .zip 4, (none) 3, .reference 1)

## Summary
- 1249 nodes · 2802 edges · 71 communities (52 shown, 19 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 141 edges (avg confidence: 0.87)
- Token cost: 530,801 input · 0 output

## Community Hubs (Navigation)
- Noise Injection & Resource Guardian
- Chaos Engineering Literature
- Self-Healing Controller
- Cost Model
- Architecture & Deployment Docs
- Bandit Format Policy
- Chaos Engine
- Edge Hardware Fleet
- Markov Planner
- Server & Workstation Fleet
- Cost Merge & CloudEvents
- Flask DT API
- Dashboard Tables UI
- Schema Validators
- Frontend API Client
- Docker Fabric Launcher
- Monte-Carlo Simulator
- Node Spec Generator
- Legacy Flask Dashboard
- Mobile & Arch Mismatch Nodes
- Node Summary Reports
- Predictive Analyzer
- DT Enabling Technologies
- RAPtwin Pipeline Flowchart
- TS App Config
- Node YAML Validation CLI
- TS Node Config
- HPC & Accelerator Hardware
- Topology Graph View
- DT Engineering Review
- Web Package Manifest
- React App Shell & SSE
- Monte-Carlo CSV Export
- Greedy Planner
- Policy Benchmark
- Puppeteer E2E Scripts
- DT Smart Industries Review
- Job Composer
- Event Bus
- Web Dev Dependencies
- Observation Panel
- DT Standards & Milestones
- Icon Sprite Sheet
- Web Runtime Dependencies
- Events Feed
- Oxlint Config
- BlueField & RTX-3060 Nodes
- DT Lifecycle & Thread
- Vite Config
- NPM Scripts
- RISC-V SBCs
- Deploy Script
- Construction DTs
- TS Root Config
- Noise Toggle Helper
- CodeQL Workflow
- DT Limitations
- Favicon
- Graphify Rules
- sbc-054
- sbc-061
- sbc-066
- sbc-068
- sbc-074
- sbc-085
- sbc-088
- sbc-089
- sbc-090
- sbc-093
- sbc-099

## God Nodes (most connected - your core abstractions)
1. `DTState` - 86 edges
2. `safe_float()` - 40 edges
3. `CostModel` - 37 edges
4. `MarkovPlanner` - 31 edges
5. `Chaos experiments in microservice architectures: A systematic literature review (Esen, Akbulut, Catal, CSI 2026)` - 31 edges
6. `Digital Twin: Enabling Technologies, Challenges and Open Research (Fuller, Fan, Day, Barlow, IEEE Access 2020)` - 30 edges
7. `Chaos Engineering` - 28 edges
8. `Workload format native` - 27 edges
9. `Workload format wasm` - 27 edges
10. `Network fabric: ethernet` - 26 edges

## Surprising Connections (you probably didn't know these)
- `PredictiveAnalyzer` --references--> `PredictiveAnalyzer`  [INFERRED]
  kkwieer/riaan_v1.4.pdf → dt/predict.py
- `ResourceGuardian` --references--> `ResourceGuardian`  [INFERRED]
  kkwieer/riaan_v1.4.pdf → dt/self_heal.py
- `RAP twin Documentation README` --semantically_similar_to--> `RAP Twin Digital Twin Fabric Simulator`  [INFERRED] [semantically similar]
  documentation/README.md → README.md
- `SelfHealingController` --references--> `SelfHealingController`  [INFERRED]
  kkwieer/riaan_v1.4.pdf → dt/self_heal.py
- `Caddy Reverse Proxy` --semantically_similar_to--> `Vite /api Proxy`  [INFERRED] [semantically similar]
  deploy/README.md → web/README.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **SSE Realtime Update Pipeline** — web_readme_cloudevent_bus, web_readme_sse_stream, web_readme_useeventstream, deploy_readme_caddy_reverse_proxy, web_readme_vite_proxy [INFERRED 0.85]
- **Strategies implemented by FederatedPlanner** — documentation_fault_tolerance_algorithms_resilient_placement, documentation_fault_tolerance_algorithms_network_aware_placement, documentation_fault_tolerance_algorithms_federated_load_balancing, documentation_fault_tolerance_algorithms_adaptive_mode_cfg, documentation_fault_tolerance_algorithms_federatedplanner [EXTRACTED 1.00]
- **Fabric Descriptor Schemas** — schemas_job_schema_fabric_job_dag_schema, schemas_node_schema_fabric_node_descriptor_schema, schemas_topology_schema_topology_schema [INFERRED 0.85]
- **Nodes carrying H100-SXM accelerators** — nodes_grig_060_grig_060, nodes_grig_083_grig_083, nodes_grig_098_grig_098, nodes_hpc_053_hpc_053 [EXTRACTED 1.00]
- **GPU/CUDA-capable worker nodes (cuda format)** — nodes_hpc_080_hpc_080, nodes_sbc_013_sbc_013, nodes_sbc_017_sbc_017, nodes_sbc_030_sbc_030 [EXTRACTED 1.00]
- **NPU-equipped worker nodes (npu format)** — nodes_laptop_011_laptop_011, nodes_laptop_012_laptop_012, nodes_laptop_035_laptop_035, nodes_laptop_051_laptop_051, nodes_phone_004_phone_004, nodes_phone_022_phone_022, nodes_sbc_007_sbc_007, nodes_sbc_027_sbc_027 [EXTRACTED 1.00]
- **CUDA-capable worker nodes (GPU formats)** — nodes_sbc_069_sbc_069, nodes_sbc_070_sbc_070, nodes_sbc_094_sbc_094, nodes_srv_015_srv_015, nodes_srv_019_srv_019, nodes_srv_020_srv_020, nodes_srv_026_srv_026, nodes_srv_031_srv_031 [EXTRACTED 1.00]
- **Servers with specialized offload hardware (DPU, FPGA, CXL memory)** — nodes_srv_041_srv_041, nodes_srv_044_srv_044, nodes_srv_062_srv_062 [INFERRED 0.75]
- **DT enabling technology stack** — kkwieer_10_digital_twins_a_survey_on_enabling_technologies_challenges_trends_and_future_prospects__2__machine_learning, kkwieer_10_digital_twins_a_survey_on_enabling_technologies_challenges_trends_and_future_prospects__2__cloud_fog_edge_computing, kkwieer_10_digital_twins_a_survey_on_enabling_technologies_challenges_trends_and_future_prospects__2__internet_of_things, kkwieer_10_digital_twins_a_survey_on_enabling_technologies_challenges_trends_and_future_prospects__2__cyber_physical_systems, kkwieer_10_digital_twins_a_survey_on_enabling_technologies_challenges_trends_and_future_prospects__2__vr_ar, kkwieer_10_digital_twins_a_survey_on_enabling_technologies_challenges_trends_and_future_prospects__2__modeling_methodologies, kkwieer_10_digital_twins_a_survey_on_enabling_technologies_challenges_trends_and_future_prospects__2__5g_6g_urllc [EXTRACTED 1.00]
- **Digital model / shadow / twin data-flow hierarchy** — kkwieer_12_digital_twins_recent_advances_and_future_directions_in_engineering_fields_digital_model, kkwieer_12_digital_twins_recent_advances_and_future_directions_in_engineering_fields_digital_shadow, kkwieer_12_digital_twins_recent_advances_and_future_directions_in_engineering_fields_three_level_digital_twins, kkwieer_13_a_review_of_digital_twins_in_smart_industries_kritzinger_model_shadow_twin_classification, kkwieer_13_a_review_of_digital_twins_in_smart_industries_bidirectional_twinning [INFERRED 0.85]
- **DT standardization landscape** — kkwieer_10_digital_twins_a_survey_on_enabling_technologies_challenges_trends_and_future_prospects__2__iso_23247, kkwieer_13_a_review_of_digital_twins_in_smart_industries_iso_iec_30173, kkwieer_10_digital_twins_a_survey_on_enabling_technologies_challenges_trends_and_future_prospects__2__digital_twin_consortium, kkwieer_10_digital_twins_a_survey_on_enabling_technologies_challenges_trends_and_future_prospects__2__standardisation_efforts, kkwieer_12_digital_twins_recent_advances_and_future_directions_in_engineering_fields_standardization_interoperability [INFERRED 0.85]
- **Digital Model / Shadow / Twin integration levels** — kkwieer_9_digital_twin_enabling_technologies__digital_model, kkwieer_9_digital_twin_enabling_technologies__digital_shadow, kkwieer_9_digital_twin_enabling_technologies__digital_twin, kkwieer_9_digital_twin_enabling_technologies__figure1_model_shadow_twin [EXTRACTED 1.00]
- **Chaos engineering approaches for microservices (Table 6)** — kkwieer_11_chaos_experiments_in_microservice_architectures_fault_injection_testing, kkwieer_11_chaos_experiments_in_microservice_architectures_hypothesis_driven_experiments, kkwieer_11_chaos_experiments_in_microservice_architectures_blast_radius_management, kkwieer_11_chaos_experiments_in_microservice_architectures_chaos_engineering [EXTRACTED 1.00]
- **Kubernetes/cloud-native fault injection tools** — kkwieer_11_chaos_experiments_in_microservice_architectures_chaos_mesh, kkwieer_11_chaos_experiments_in_microservice_architectures_litmus_chaos, kkwieer_11_chaos_experiments_in_microservice_architectures_powerfulseal, kkwieer_11_chaos_experiments_in_microservice_architectures_gremlin [INFERRED 0.85]
- **RAPtwin Simulation and Planning Pipeline** — kkwieer_riaan_v1_4_observe_endpoint, kkwieer_riaan_v1_4_unified_state_machine, kkwieer_riaan_v1_4_predictive_analyzer, kkwieer_riaan_v1_4_multi_strategy_planning_engine, kkwieer_riaan_v1_4_chaos_engine, kkwieer_riaan_v1_4_monte_carlo_orchestrator, kkwieer_riaan_v1_4_web_dashboard [EXTRACTED 1.00]
- **RAPtwin Background Controllers** — kkwieer_riaan_v1_4_self_healing_controller, kkwieer_riaan_v1_4_resource_guardian, kkwieer_riaan_v1_4_chaos_engine [EXTRACTED 1.00]
- **Pluggable Scheduling Policies** — kkwieer_riaan_v1_4_greedy_cheapest_energy_policies, kkwieer_riaan_v1_4_rl_markov_policy, kkwieer_riaan_v1_4_federated_drl_policy [EXTRACTED 1.00]
- **RAP twin five-step simulation and planning pipeline** — kkwieer_riaan_state_management_telemetry_ingestion, kkwieer_riaan_multi_strategy_workload_planning, kkwieer_riaan_chaos_engineering_fault_injection, kkwieer_riaan_interactive_dashboard_preview, kkwieer_riaan_statistical_evaluation_exporting [EXTRACTED 1.00]
- **Plan-test-adjust constraint iteration loop** — kkwieer_riaan_multi_strategy_workload_planning, kkwieer_riaan_chaos_engineering_fault_injection, kkwieer_riaan_strategy_adjustment, kkwieer_riaan_feedback_loop [INFERRED 0.85]
- **Social/brand link icons (Vite starter footer)** — web_public_icons_bluesky_icon, web_public_icons_discord_icon, web_public_icons_github_icon, web_public_icons_x_icon [INFERRED 0.75]

## Communities (71 total, 19 thin omitted)

### Community 0 - "Noise Injection & Resource Guardian"
Cohesion: 0.06
Nodes (28): NoiseInjector, Watches for potential deadlocks and releases stale reservations., ResourceGuardian, clamp(), DTState, _node_speed(), LinkDyn, NodeDyn (+20 more)

### Community 1 - "Chaos Engineering Literature"
Cohesion: 0.06
Nodes (63): 3MileBeach, Blast Radius Management, Centralized Provision of Chaos Engineering, Chaos Engineering, Chaos Engineering Adoption Challenges, Chaos Mesh, Chaos Monkey (Netflix), The Chaos Toolkit (+55 more)

### Community 2 - "Self-Healing Controller"
Cohesion: 0.05
Nodes (48): ManagedStage, Any, Promotes fallback placements when primaries degrade or fail., SelfHealingController, ShadowReservation, RAPtwin Seminar Report v1.1, RAPtwin Seminar Report v1.3, Actor-Critic with epsilon-greedy (+40 more)

### Community 3 - "Cost Model"
Cohesion: 0.10
Nodes (26): Counter, clamp(), CostModel, link_key(), Any, Boost compute if the node supports a preferred format requested by the stage., A rough scalar for 'how big' a stage is. You can later switch to FLOP/byte…, Very rough: (idle+active) power × time. (+18 more)

### Community 4 - "Architecture & Deployment Docs"
Cohesion: 0.06
Nodes (51): Caddy Reverse Proxy, deploy.sh Redeploy Script, raptwin.seloraos.online Deployment, raptwin-api systemd Service, Single Gunicorn Worker with 24 Threads, Dry-Run Mode, Azure DTDL / Kubernetes CRD Export, DTState Digital Twin State Machine (+43 more)

### Community 5 - "Bandit Format Policy"
Cohesion: 0.08
Nodes (38): ArmStats, _available_formats(), BanditPolicy, ContextStats, _now_ms(), Any, Update the bandit with an observed outcome. reward_mode: - "neg_latency":…, Compact signature to cluster learning by 'similar' stages. (+30 more)

### Community 6 - "Chaos Engine"
Cohesion: 0.10
Nodes (21): requests, signal, build_argparser(), ChaosEngine, ChaosEvent, clamp01(), collect_chaos_events(), link_key() (+13 more)

### Community 7 - "Edge Hardware Fleet"
Cohesion: 0.10
Nodes (44): GPU/accelerator: H100-SXM, GPU/accelerator: Jetson Orin, GPU/accelerator: RTX-4060, GPU/accelerator: RX-6800, Network fabric: ethernet, Node class: gaming_rig, Node class: laptop, Node class: sbc (+36 more)

### Community 8 - "Markov Planner"
Cohesion: 0.10
Nodes (16): clamp01(), MarkovPlanner, recurse(), PlannerWeights, Any, Solve a sequential placement problem via dynamic programming., _Solution, _bucket() (+8 more)

### Community 9 - "Server & Workstation Fleet"
Cohesion: 0.16
Nodes (41): CPU microarchitecture GoldenCove, CPU microarchitecture NeoverseN2, CPU microarchitecture NeoverseV1, CPU microarchitecture P-core/E-core, CPU microarchitecture Zen3, CPU microarchitecture Zen4, GPU/accelerator: RTX-A2000, Device class server (+33 more)

### Community 10 - "Cost Merge & CloudEvents"
Cohesion: 0.10
Nodes (30): collections, copy, dataclasses, datetime, merge_stage_details(), Combine planner annotations with cost model metrics per stage. ``primary``…, dt/cost_model.py — Latency, transfer, energy, and risk estimators for Fabric…, build_cloudevent() (+22 more)

### Community 11 - "Flask DT API"
Cohesion: 0.11
Nodes (35): add_node(), _ensure_jobs(), _err(), events(), health(), jobs(), _jobs_root(), _load_job_catalog() (+27 more)

### Community 12 - "Dashboard Tables UI"
Cohesion: 0.14
Nodes (27): PlanResult, PlanStage, FederationLinksTable(), FederationsTable(), LinksTable(), NodesTable(), Overview(), PlanStages() (+19 more)

### Community 13 - "Schema Validators"
Cohesion: 0.13
Nodes (27): assert_instance(), assert_job(), assert_node(), assert_topology(), _CompiledSchema, DirReport, _extend_with_default(), _format_error() (+19 more)

### Community 14 - "Frontend API Client"
Cohesion: 0.09
Nodes (27): api, ApiError, request(), LiveOptions, queryKeys, ApiEnvelope, ApiErr, ApiOk (+19 more)

### Community 15 - "Docker Fabric Launcher"
Cohesion: 0.11
Nodes (27): docker, apply_tc_rate(), binfmt_ready_for(), build_container_spec(), canonical_arch(), ensure_image(), ensure_network(), find_rate_gbps() (+19 more)

### Community 16 - "Monte-Carlo Simulator"
Cohesion: 0.18
Nodes (28): accel_multiplier(), apply_perturbations(), build_link_db(), build_stage(), estimate_job_latency_ms(), generate_synthetic_catalog(), get_link_metrics(), greedy_place() (+20 more)

### Community 17 - "Node Spec Generator"
Cohesion: 0.17
Nodes (26): accelerators_block(), battery_profile(), choice_weighted(), cpu_profile(), cxl_block(), dpu_block(), formats_supported(), gpu_block() (+18 more)

### Community 18 - "Legacy Flask Dashboard"
Cohesion: 0.20
Nodes (25): api_health(), api_jobs(), api_observe(), api_plan(), api_plan_batch(), api_plan_demo(), api_plans(), api_snapshot() (+17 more)

### Community 19 - "Mobile & Arch Mismatch Nodes"
Cohesion: 0.15
Nodes (25): GPU/accelerator: MI300X, Network fabric: wifi, Node class: phone, Arch/microarchitecture mismatch (amd64 with ARM Neoverse uarch), grig-010 (gaming_rig node), grig-033 (gaming_rig node), grig-039 (gaming_rig node), grig-058 (gaming_rig node) (+17 more)

### Community 20 - "Node Summary Reports"
Cohesion: 0.22
Nodes (19): statistics, accel_score(), agg_stats(), cpu_capacity(), export_csv(), export_json(), export_md(), _get_field() (+11 more)

### Community 21 - "Predictive Analyzer"
Cohesion: 0.17
Nodes (10): _clamp(), _EWMA, LinkForecast, NodeForecast, _now_ms(), PredictiveAnalyzer, Aggregate predictive telemetry for nodes and links., Exponentially-weighted moving average. (+2 more)

### Community 22 - "DT Enabling Technologies"
Cohesion: 0.11
Nodes (21): 5G/6G and uRLLC communications, Artificial General Intelligence, Beyond Human, Cloud, Fog and Edge Computing, Cyber-Physical Systems, Data Ownership and Governance, Data Security challenge, Festo Cyber-Physical Factory (CP-Lab), Fidelity and Rate of Synchronization challenge (+13 more)

### Community 23 - "RAPtwin Pipeline Flowchart"
Cohesion: 0.14
Nodes (20): RAP twin Pipeline Flowchart (riaan.png), Adaptation & Rerouting (policy validation, workload rerouting), Step 3: Chaos Engineering & Fault Injection, Descriptor Parsing (YAML/JSON hardware & job descriptors, SLAs, resource hints), Deterministic Fault Injection (link outages, network noise, thermal throttling, physical-layer failures), Dry-run Evaluator (what-if placement, no resource commitment), Feedback Loop: Iterate Job Constraints, Step 4: Interactive Dashboard Preview (+12 more)

### Community 24 - "TS App Config"
Cohesion: 0.10
Nodes (19): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+11 more)

### Community 25 - "Node YAML Validation CLI"
Cohesion: 0.18
Nodes (15): argparse, extend_with_default(), format_error(), human_path(), load_yaml(), main(), Any, Path (+7 more)

### Community 26 - "TS Node Config"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 27 - "HPC & Accelerator Hardware"
Cohesion: 0.14
Nodes (16): AWS Inferentia2 ASIC, CXL Type-3 memory expansion, FPGA bitstream: regex_accel, FPGA card: agilex7, FPGA card: other, GPU/accelerator: RTX-5060-Ti, Network fabric: infiniband, Node class: hpc (+8 more)

### Community 28 - "Topology Graph View"
Cohesion: 0.15
Nodes (13): linkTooltip(), nodeFill(), nodeTooltip(), SavedPosition, TopologyGraph(), web_src_lib_topologymodel, web_src_lib_topologymodel_buildgraphmodel, web_src_lib_topologymodel_graphlink (+5 more)

### Community 29 - "DT Engineering Review"
Cohesion: 0.20
Nodes (14): Aerospace and defense DTs, Agriculture and food supply chain DTs, Digital Model, Digital Shadow, DT definition: personalized representation, real-time updates, decision-making support, Gartner Hype Cycle (DT Plateau of Productivity 2023-2028), Health and medicine DTs, Digital twins: Recent advances and future directions in engineering fields (Iranshahi et al., ISWA 2025) (+6 more)

### Community 30 - "Web Package Manifest"
Cohesion: 0.14
Nodes (13): d3, oxlint, react-dom, tailwindcss, @types/d3, @types/node, @types/react, @types/react-dom (+5 more)

### Community 31 - "React App Shell & SSE"
Cohesion: 0.24
Nodes (11): react, ref_react_dom_client, @tanstack/react-query, usePlans(), useSnapshot(), keysFor(), StreamStatus, useEventStream() (+3 more)

### Community 32 - "Monte-Carlo CSV Export"
Cohesion: 0.27
Nodes (11): DataFrame, numpy, pandas, Series, empirical_cdf(), main(), percentile_series(), Path (+3 more)

### Community 33 - "Greedy Planner"
Cohesion: 0.36
Nodes (7): _fits(), GreedyPlanner, merge_stage_details(), Any, dt/policy/greedy.py — Baseline greedy planner for Fabric DT. What it does…, safe_float(), _supports_formats()

### Community 34 - "Policy Benchmark"
Cohesion: 0.26
Nodes (11): matplotlib, matplotlib_pyplot, aggregate_metrics(), evaluate_strategy(), _greedy_planner(), load_jobs(), main(), plot_metrics() (+3 more)

### Community 35 - "Puppeteer E2E Scripts"
Cohesion: 0.17
Nodes (6): puppeteer, problems, problems, t0, t1, problems

### Community 36 - "DT Smart Industries Review"
Cohesion: 0.22
Nodes (11): Michael Grieves 2002 PLM Digital Twin Concept, Tea Industry in India DT Case Study, Automotive, transportation and logistics DTs, Manufacturing and industrial processes DTs, Managerial insights: open standards, data access compatibility, extended operational functions, Manufacturing DTs, A review of digital twins in smart industries (Ding et al., Computers in Industry 2026), Predictive maintenance and health management (+3 more)

### Community 37 - "Job Composer"
Cohesion: 0.24
Nodes (8): useJobs(), usePlanBatch(), usePlanJob(), STRATEGIES, JobComposer(), web_src_lib_demojob, web_src_lib_demojob_makedemojob, web_src_lib_format_cn

### Community 38 - "Event Bus"
Cohesion: 0.22
Nodes (4): EventBus, Any, Thread-safe in-memory event buffer with fan-out to live subscribers., Register a live listener (used by the SSE endpoint).

### Community 39 - "Web Dev Dependencies"
Cohesion: 0.20
Nodes (10): devDependencies, oxlint, puppeteer, @types/d3, @types/node, @types/react, @types/react-dom, typescript (+2 more)

### Community 40 - "Observation Panel"
Cohesion: 0.24
Nodes (9): useObserve(), Snapshot, coerce(), LINK_FIELDS, NODE_FIELDS, ObservationPanel(), send(), Target (+1 more)

### Community 41 - "DT Standards & Milestones"
Cohesion: 0.22
Nodes (9): Digital Twin Consortium, ISO 23247 Digital Twin Framework for Manufacturing, Standardisation Efforts, Collaborative standardization and interoperability efforts, AFRL fighter aircraft maintenance DT (2011), Milestones in DT research (2002 Grieves, 2010 Vickers term, 2011 AFRL, ISO/IEC 30173:2023), GE aviation engine predictive maintenance DT (2015), ISO/IEC 30173:2023 Digital Twin standard (+1 more)

### Community 42 - "Icon Sprite Sheet"
Cohesion: 0.25
Nodes (8): icons.svg (SVG symbol sprite), bluesky-icon symbol, discord-icon symbol, documentation-icon symbol, github-icon symbol, social-icon symbol, SVG Symbol Sprite Pattern (Vite template boilerplate), x-icon symbol

### Community 43 - "Web Runtime Dependencies"
Cohesion: 0.29
Nodes (7): dependencies, d3, react, react-dom, tailwindcss, @tailwindcss/vite, @tanstack/react-query

### Community 44 - "Events Feed"
Cohesion: 0.48
Nodes (6): useEvents(), FabricEvent, EventsFeed(), shortType(), summarise(), toneFor()

### Community 45 - "Oxlint Config"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 46 - "BlueField & RTX-3060 Nodes"
Cohesion: 0.40
Nodes (5): NVIDIA BlueField-3 DPU, GPU/accelerator: RTX-3060, grig-034 (gaming_rig node), srv-015 (server, amd64, RTX-3060), srv-026 (server, amd64, RTX-3060)

### Community 47 - "DT Lifecycle & Thread"
Cohesion: 0.40
Nodes (5): Digital Thread, Expert Panel TRL Assessment (DT TRL 4.8/9), DT Services across Product Lifecycle (BOL/MOL/EOL) / Servitization, Defence Acquisition University DT definition, Research opportunities: life-cycle management, cross-disciplinary integration, human-machine collaboration

### Community 48 - "Vite Config"
Cohesion: 0.40
Nodes (4): @tailwindcss/vite, vite, @vitejs/plugin-react, proxy

### Community 49 - "NPM Scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, lint, preview

### Community 50 - "RISC-V SBCs"
Cohesion: 0.50
Nodes (4): RISC-V 64 (riscv64) architecture, sbc-037 (sbc, riscv64), sbc-047 (sbc, riscv64), sbc-100 (sbc, riscv64)

### Community 52 - "Construction DTs"
Cohesion: 0.67
Nodes (3): Structural Health Monitoring for Vietnam Bridges, Construction and building management DTs, Construction DTs (monitoring, human-robot collaboration, modular integrated construction)

## Ambiguous Edges - Review These
- `grig-001 (gaming_rig node)` → `Arch/microarchitecture mismatch (amd64 with ARM Neoverse uarch)`  [AMBIGUOUS]
  nodes/grig-001.yaml · relation: references
- `grig-006 (gaming_rig node)` → `Arch/microarchitecture mismatch (amd64 with ARM Neoverse uarch)`  [AMBIGUOUS]
  nodes/grig-006.yaml · relation: references
- `grig-010 (gaming_rig node)` → `Arch/microarchitecture mismatch (amd64 with ARM Neoverse uarch)`  [AMBIGUOUS]
  nodes/grig-010.yaml · relation: references
- `grig-036 (gaming_rig node)` → `Arch/microarchitecture mismatch (amd64 with ARM Neoverse uarch)`  [AMBIGUOUS]
  nodes/grig-036.yaml · relation: references
- `grig-050 (gaming_rig node)` → `Arch/microarchitecture mismatch (amd64 with ARM Neoverse uarch)`  [AMBIGUOUS]
  nodes/grig-050.yaml · relation: references
- `grig-058 (gaming_rig node)` → `Arch/microarchitecture mismatch (amd64 with ARM Neoverse uarch)`  [AMBIGUOUS]
  nodes/grig-058.yaml · relation: references
- `grig-064 (gaming_rig node)` → `Arch/microarchitecture mismatch (amd64 with ARM Neoverse uarch)`  [AMBIGUOUS]
  nodes/grig-064.yaml · relation: references
- `grig-087 (gaming_rig node)` → `Arch/microarchitecture mismatch (amd64 with ARM Neoverse uarch)`  [AMBIGUOUS]
  nodes/grig-087.yaml · relation: references
- `grig-096 (gaming_rig node)` → `Arch/microarchitecture mismatch (amd64 with ARM Neoverse uarch)`  [AMBIGUOUS]
  nodes/grig-096.yaml · relation: references
- `grig-097 (gaming_rig node)` → `Arch/microarchitecture mismatch (amd64 with ARM Neoverse uarch)`  [AMBIGUOUS]
  nodes/grig-097.yaml · relation: references
- `hpc-053 (hpc node)` → `Arch/microarchitecture mismatch (amd64 with ARM Neoverse uarch)`  [AMBIGUOUS]
  nodes/hpc-053.yaml · relation: references

## Knowledge Gaps
- **194 isolated node(s):** `_Solution`, `DemoResult`, `$schema`, `plugins`, `react/rules-of-hooks` (+189 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 372 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **19 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `grig-001 (gaming_rig node)` and `Arch/microarchitecture mismatch (amd64 with ARM Neoverse uarch)`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `grig-006 (gaming_rig node)` and `Arch/microarchitecture mismatch (amd64 with ARM Neoverse uarch)`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `grig-010 (gaming_rig node)` and `Arch/microarchitecture mismatch (amd64 with ARM Neoverse uarch)`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `grig-036 (gaming_rig node)` and `Arch/microarchitecture mismatch (amd64 with ARM Neoverse uarch)`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `grig-050 (gaming_rig node)` and `Arch/microarchitecture mismatch (amd64 with ARM Neoverse uarch)`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `grig-058 (gaming_rig node)` and `Arch/microarchitecture mismatch (amd64 with ARM Neoverse uarch)`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `grig-064 (gaming_rig node)` and `Arch/microarchitecture mismatch (amd64 with ARM Neoverse uarch)`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._