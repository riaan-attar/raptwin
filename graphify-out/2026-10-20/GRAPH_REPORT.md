# Graph Report - raptwin  (2026-09-18)

## Corpus Check
- 93 files · ~217,984 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 12 file(s) not represented in the graph (top: .zip 4, (none) 3, .reference 1)

## Summary
- 1748 nodes · 4270 edges · 91 communities (68 shown, 23 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 180 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `9ad6e7e8`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- safe_float
- Chaos experiments in microservice architectures: A systematic literature review (Esen, Akbulut, Catal, CSI 2026)
- montecarlo.py
- CostModel
- RAP Twin Digital Twin Fabric Simulator
- submit_demo.py
- test_import_cluster.py
- Network fabric: ethernet
- export_csv.py
- Workload format native
- state.py
- api.py
- format.ts
- validators.py
- types.ts
- test_management.py
- test_ci_gate.py
- gen_nodes.py
- _proxy_remote
- Arch/microarchitecture mismatch (amd64 with ARM Neoverse uarch)
- summarize_nodes.py
- PredictiveAnalyzer
- Digital Twins: A Survey on Enabling Technologies, Challenges, Trends and Future Prospects (Mihai et al., IEEE COMST 2022)
- Step 2: Multi-Strategy Workload Planning
- compilerOptions
- chaos.py
- compilerOptions
- GPU/accelerator: RTX-5060-Ti
- TopologyGraph.tsx
- Digital twins: Recent advances and future directions in engineering fields (Iranshahi et al., ISWA 2025)
- package.json
- App.tsx
- ._emit_event
- test_economics.py
- policy_benchmark.py
- realtime.mjs
- A review of digital twins in smart industries (Ding et al., Computers in Industry 2026)
- JobManager.tsx
- EventBus
- devDependencies
- hooks.ts
- Milestones in DT research (2002 Grieves, 2010 Vickers term, 2011 AFRL, ISO/IEC 30173:2023)
- icons.svg (SVG symbol sprite)
- dependencies
- DTState
- .oxlintrc.json
- GPU/accelerator: RTX-3060
- Digital Thread
- vite.config.ts
- scripts
- RISC-V 64 (riscv64) architecture
- deploy.sh
- Construction and building management DTs
- tsconfig.json
- NoiseInjector
- CodeQL Advanced Workflow
- Social and Ethical Challenges
- Vite Default Brand Logo
- Graphify Knowledge Graph Rules
- sbc-054 (sbc, arm64)
- sbc-061 (sbc, arm64)
- sbc-066 (sbc, arm64)
- sbc-068 (sbc, arm64)
- sbc-074 (sbc, arm64)
- sbc-085 (sbc, arm64)
- sbc-088 (sbc, arm64)
- sbc-089 (sbc, arm64)
- sbc-090 (sbc, arm64)
- sbc-093 (sbc, arm64)
- sbc-099 (sbc, arm64)
- RLPolicy
- NodeEditor.tsx
- primitives.tsx
- test_bundle.py
- ._load_nodes_locked
- ResourceGuardian
- .add_or_update_node
- run.sh
- whatif.py
- test_blast_radius.py
- test_whatif.py
- Fault
- launch_fabric.py
- validate_nodes.py
- SelfHealingController
- 2. New modules (in progress)
- evaluate_scenario
- Future work — research validation backlog
- exporters.py
- maybe_start_noise

## God Nodes (most connected - your core abstractions)
1. `DTState` - 133 edges
2. `safe_float()` - 59 edges
3. `CostModel` - 51 edges
4. `MarkovPlanner` - 33 edges
5. `Chaos experiments in microservice architectures: A systematic literature review (Esen, Akbulut, Catal, CSI 2026)` - 31 edges
6. `Digital Twin: Enabling Technologies, Challenges and Open Research (Fuller, Fan, Day, Barlow, IEEE Access 2020)` - 30 edges
7. `_ok()` - 29 edges
8. `Chaos Engineering` - 28 edges
9. `Workload format native` - 27 edges
10. `Workload format wasm` - 27 edges

## Surprising Connections (you probably didn't know these)
- `PredictiveAnalyzer` --references--> `PredictiveAnalyzer`  [INFERRED]
  kkwieer/riaan_v1.4.pdf → dt/predict.py
- `SelfHealingController` --references--> `SelfHealingController`  [INFERRED]
  kkwieer/riaan_v1.4.pdf → dt/self_heal.py
- `ResourceGuardian` --references--> `ResourceGuardian`  [INFERRED]
  kkwieer/riaan_v1.4.pdf → dt/self_heal.py
- `RAP twin Documentation README` --semantically_similar_to--> `RAP Twin Digital Twin Fabric Simulator`  [INFERRED] [semantically similar]
  documentation/README.md → README.md
- `Caddy Reverse Proxy` --semantically_similar_to--> `Vite /api Proxy`  [INFERRED] [semantically similar]
  deploy/README.md → web/README.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Chaos engineering approaches for microservices (Table 6)** — kkwieer_11_chaos_experiments_in_microservice_architectures_fault_injection_testing, kkwieer_11_chaos_experiments_in_microservice_architectures_hypothesis_driven_experiments, kkwieer_11_chaos_experiments_in_microservice_architectures_blast_radius_management, kkwieer_11_chaos_experiments_in_microservice_architectures_chaos_engineering [EXTRACTED 1.00]
- **GPU/CUDA-capable worker nodes (cuda format)** — nodes_hpc_080_hpc_080, nodes_sbc_013_sbc_013, nodes_sbc_017_sbc_017, nodes_sbc_030_sbc_030 [EXTRACTED 1.00]
- **CUDA-capable worker nodes (GPU formats)** — nodes_sbc_069_sbc_069, nodes_sbc_070_sbc_070, nodes_sbc_094_sbc_094, nodes_srv_015_srv_015, nodes_srv_019_srv_019, nodes_srv_020_srv_020, nodes_srv_026_srv_026, nodes_srv_031_srv_031 [EXTRACTED 1.00]
- **DT enabling technology stack** — kkwieer_10_digital_twins_a_survey_on_enabling_technologies_challenges_trends_and_future_prospects__2__machine_learning, kkwieer_10_digital_twins_a_survey_on_enabling_technologies_challenges_trends_and_future_prospects__2__cloud_fog_edge_computing, kkwieer_10_digital_twins_a_survey_on_enabling_technologies_challenges_trends_and_future_prospects__2__internet_of_things, kkwieer_10_digital_twins_a_survey_on_enabling_technologies_challenges_trends_and_future_prospects__2__cyber_physical_systems, kkwieer_10_digital_twins_a_survey_on_enabling_technologies_challenges_trends_and_future_prospects__2__vr_ar, kkwieer_10_digital_twins_a_survey_on_enabling_technologies_challenges_trends_and_future_prospects__2__modeling_methodologies, kkwieer_10_digital_twins_a_survey_on_enabling_technologies_challenges_trends_and_future_prospects__2__5g_6g_urllc [EXTRACTED 1.00]
- **Digital Model / Shadow / Twin integration levels** — kkwieer_9_digital_twin_enabling_technologies__digital_model, kkwieer_9_digital_twin_enabling_technologies__digital_shadow, kkwieer_9_digital_twin_enabling_technologies__digital_twin, kkwieer_9_digital_twin_enabling_technologies__figure1_model_shadow_twin [EXTRACTED 1.00]
- **Strategies implemented by FederatedPlanner** — documentation_fault_tolerance_algorithms_resilient_placement, documentation_fault_tolerance_algorithms_network_aware_placement, documentation_fault_tolerance_algorithms_federated_load_balancing, documentation_fault_tolerance_algorithms_adaptive_mode_cfg, documentation_fault_tolerance_algorithms_federatedplanner [EXTRACTED 1.00]
- **Nodes carrying H100-SXM accelerators** — nodes_grig_060_grig_060, nodes_grig_083_grig_083, nodes_grig_098_grig_098, nodes_hpc_053_hpc_053 [EXTRACTED 1.00]
- **RAP twin five-step simulation and planning pipeline** — kkwieer_riaan_state_management_telemetry_ingestion, kkwieer_riaan_multi_strategy_workload_planning, kkwieer_riaan_chaos_engineering_fault_injection, kkwieer_riaan_interactive_dashboard_preview, kkwieer_riaan_statistical_evaluation_exporting [EXTRACTED 1.00]
- **NPU-equipped worker nodes (npu format)** — nodes_laptop_011_laptop_011, nodes_laptop_012_laptop_012, nodes_laptop_035_laptop_035, nodes_laptop_051_laptop_051, nodes_phone_004_phone_004, nodes_phone_022_phone_022, nodes_sbc_007_sbc_007, nodes_sbc_027_sbc_027 [EXTRACTED 1.00]
- **RAPtwin Background Controllers** — kkwieer_riaan_v1_4_self_healing_controller, kkwieer_riaan_v1_4_resource_guardian, kkwieer_riaan_v1_4_chaos_engine [EXTRACTED 1.00]
- **RAPtwin Simulation and Planning Pipeline** — kkwieer_riaan_v1_4_observe_endpoint, kkwieer_riaan_v1_4_unified_state_machine, kkwieer_riaan_v1_4_predictive_analyzer, kkwieer_riaan_v1_4_multi_strategy_planning_engine, kkwieer_riaan_v1_4_chaos_engine, kkwieer_riaan_v1_4_monte_carlo_orchestrator, kkwieer_riaan_v1_4_web_dashboard [EXTRACTED 1.00]
- **Pluggable Scheduling Policies** — kkwieer_riaan_v1_4_greedy_cheapest_energy_policies, kkwieer_riaan_v1_4_rl_markov_policy, kkwieer_riaan_v1_4_federated_drl_policy [EXTRACTED 1.00]
- **Servers with specialized offload hardware (DPU, FPGA, CXL memory)** — nodes_srv_041_srv_041, nodes_srv_044_srv_044, nodes_srv_062_srv_062 [INFERRED 0.75]
- **Social/brand link icons (Vite starter footer)** — web_public_icons_bluesky_icon, web_public_icons_discord_icon, web_public_icons_github_icon, web_public_icons_x_icon [INFERRED 0.75]
- **DT standardization landscape** — kkwieer_10_digital_twins_a_survey_on_enabling_technologies_challenges_trends_and_future_prospects__2__iso_23247, kkwieer_13_a_review_of_digital_twins_in_smart_industries_iso_iec_30173, kkwieer_10_digital_twins_a_survey_on_enabling_technologies_challenges_trends_and_future_prospects__2__digital_twin_consortium, kkwieer_10_digital_twins_a_survey_on_enabling_technologies_challenges_trends_and_future_prospects__2__standardisation_efforts, kkwieer_12_digital_twins_recent_advances_and_future_directions_in_engineering_fields_standardization_interoperability [INFERRED 0.85]
- **Fabric Descriptor Schemas** — schemas_job_schema_fabric_job_dag_schema, schemas_node_schema_fabric_node_descriptor_schema, schemas_topology_schema_topology_schema [INFERRED 0.85]
- **Plan-test-adjust constraint iteration loop** — kkwieer_riaan_multi_strategy_workload_planning, kkwieer_riaan_chaos_engineering_fault_injection, kkwieer_riaan_strategy_adjustment, kkwieer_riaan_feedback_loop [INFERRED 0.85]
- **Kubernetes/cloud-native fault injection tools** — kkwieer_11_chaos_experiments_in_microservice_architectures_chaos_mesh, kkwieer_11_chaos_experiments_in_microservice_architectures_litmus_chaos, kkwieer_11_chaos_experiments_in_microservice_architectures_powerfulseal, kkwieer_11_chaos_experiments_in_microservice_architectures_gremlin [INFERRED 0.85]
- **Digital model / shadow / twin data-flow hierarchy** — kkwieer_12_digital_twins_recent_advances_and_future_directions_in_engineering_fields_digital_model, kkwieer_12_digital_twins_recent_advances_and_future_directions_in_engineering_fields_digital_shadow, kkwieer_12_digital_twins_recent_advances_and_future_directions_in_engineering_fields_three_level_digital_twins, kkwieer_13_a_review_of_digital_twins_in_smart_industries_kritzinger_model_shadow_twin_classification, kkwieer_13_a_review_of_digital_twins_in_smart_industries_bidirectional_twinning [INFERRED 0.85]
- **SSE Realtime Update Pipeline** — web_readme_cloudevent_bus, web_readme_sse_stream, web_readme_useeventstream, deploy_readme_caddy_reverse_proxy, web_readme_vite_proxy [INFERRED 0.85]

## Communities (91 total, 23 thin omitted)

### Community 0 - "safe_float"
Cohesion: 0.15
Nodes (7): clamp(), _node_speed(), Any, Lower is better. Very simple latency proxy: - Penalize 'down', thermal_derate,…, Return a thread-safe snapshot for UI/clients., safe_float(), utc_ms()

### Community 1 - "Chaos experiments in microservice architectures: A systematic literature review (Esen, Akbulut, Catal, CSI 2026)"
Cohesion: 0.06
Nodes (63): 3MileBeach, Blast Radius Management, Centralized Provision of Chaos Engineering, Chaos Engineering, Chaos Engineering Adoption Challenges, Chaos Mesh, Chaos Monkey (Netflix), The Chaos Toolkit (+55 more)

### Community 2 - "montecarlo.py"
Cohesion: 0.05
Nodes (71): RAPtwin Seminar Report v1.1, RAPtwin Seminar Report v1.3, Actor-Critic with epsilon-greedy, Chaos Engine (sim/chaos.py), Chaos Engineering, Digital Twin (bidirectional sync), Docker-based Fabric Emulation, Dry-Run Evaluator (+63 more)

### Community 3 - "CostModel"
Cohesion: 0.06
Nodes (34): Counter, clamp(), CostModel, link_key(), Any, Boost compute if the node supports a preferred format requested by the stage., A rough scalar for 'how big' a stage is. You can later switch to FLOP/byte…, Very rough: (idle+active) power × time. (+26 more)

### Community 4 - "RAP Twin Digital Twin Fabric Simulator"
Cohesion: 0.06
Nodes (51): Caddy Reverse Proxy, deploy.sh Redeploy Script, raptwin.seloraos.online Deployment, raptwin-api systemd Service, Single Gunicorn Worker with 24 Threads, Dry-Run Mode, Azure DTDL / Kubernetes CRD Export, DTState Digital Twin State Machine (+43 more)

### Community 5 - "submit_demo.py"
Cohesion: 0.08
Nodes (36): ArmStats, _available_formats(), BanditPolicy, ContextStats, _now_ms(), Any, Update the bandit with an observed outcome. reward_mode: - "neg_latency":…, Compact signature to cluster learning by 'similar' stages. (+28 more)

### Community 6 - "test_import_cluster.py"
Cohesion: 0.09
Nodes (46): pytest, client(), make_job(), fixture, test_plan_batch_reuses_plan_logic(), test_plan_returns_rich_stage_metrics(), cluster(), k8s_node() (+38 more)

### Community 7 - "Network fabric: ethernet"
Cohesion: 0.10
Nodes (44): GPU/accelerator: H100-SXM, GPU/accelerator: Jetson Orin, GPU/accelerator: RTX-4060, GPU/accelerator: RX-6800, Network fabric: ethernet, Node class: gaming_rig, Node class: laptop, Node class: sbc (+36 more)

### Community 8 - "export_csv.py"
Cohesion: 0.27
Nodes (11): DataFrame, numpy, pandas, Series, empirical_cdf(), main(), percentile_series(), Path (+3 more)

### Community 9 - "Workload format native"
Cohesion: 0.16
Nodes (41): CPU microarchitecture GoldenCove, CPU microarchitecture NeoverseN2, CPU microarchitecture NeoverseV1, CPU microarchitecture P-core/E-core, CPU microarchitecture Zen3, CPU microarchitecture Zen4, GPU/accelerator: RTX-A2000, Device class server (+33 more)

### Community 10 - "state.py"
Cohesion: 0.10
Nodes (37): argparse, collections, dataclasses, datetime, dt/chaos_runner.py — run sim/chaos.py scenarios inside the DT API process. The…, merge_stage_details(), Combine planner annotations with cost model metrics per stage. ``primary``…, dt/cost_model.py — Latency, transfer, energy, and risk estimators for Fabric… (+29 more)

### Community 11 - "api.py"
Cohesion: 0.09
Nodes (58): delete, add_node(), blast_radius(), bundle(), chaos_start(), chaos_status(), chaos_stop(), clear_plans() (+50 more)

### Community 12 - "format.ts"
Cohesion: 0.19
Nodes (20): useRelease(), useWhatIf(), PlanResult, FederationsTable(), ReservationsPanel(), WhatIfPanel(), buildChanges(), submit() (+12 more)

### Community 13 - "validators.py"
Cohesion: 0.13
Nodes (27): assert_instance(), assert_job(), assert_node(), assert_topology(), _CompiledSchema, DirReport, _extend_with_default(), _format_error() (+19 more)

### Community 14 - "types.ts"
Cohesion: 0.06
Nodes (37): api, ApiError, request(), ApiEnvelope, ApiErr, ApiOk, BlastFault, BlastRadiusReport (+29 more)

### Community 15 - "test_management.py"
Cohesion: 0.11
Nodes (9): client(), fabric(), node_descriptor(), fixture, Isolated nodes/ + topology.yaml copies so tests never touch the repo files., state(), test_add_node_rejects_path_traversal_names(), test_add_node_validation() (+1 more)

### Community 16 - "test_ci_gate.py"
Cohesion: 0.09
Nodes (36): Namespace, fabric(), fixture, parametrize, ci/gate.yaml and ci/baseline.json must stay in step, or CI compares apples to…, Latency is the sensitive signal when deadlines are generous., result(), test_absolute_ceilings() (+28 more)

### Community 17 - "gen_nodes.py"
Cohesion: 0.17
Nodes (26): accelerators_block(), battery_profile(), choice_weighted(), cpu_profile(), cxl_block(), dpu_block(), formats_supported(), gpu_block() (+18 more)

### Community 18 - "_proxy_remote"
Cohesion: 0.17
Nodes (24): api_health(), api_jobs(), api_observe(), api_plan(), api_plan_batch(), api_plan_demo(), api_plans(), api_snapshot() (+16 more)

### Community 19 - "Arch/microarchitecture mismatch (amd64 with ARM Neoverse uarch)"
Cohesion: 0.15
Nodes (25): GPU/accelerator: MI300X, Network fabric: wifi, Node class: phone, Arch/microarchitecture mismatch (amd64 with ARM Neoverse uarch), grig-010 (gaming_rig node), grig-033 (gaming_rig node), grig-039 (gaming_rig node), grig-058 (gaming_rig node) (+17 more)

### Community 20 - "summarize_nodes.py"
Cohesion: 0.24
Nodes (18): accel_score(), agg_stats(), cpu_capacity(), export_csv(), export_json(), export_md(), _get_field(), load_nodes() (+10 more)

### Community 21 - "PredictiveAnalyzer"
Cohesion: 0.11
Nodes (15): copy, _clamp(), _EWMA, LinkForecast, NodeForecast, _now_ms(), PredictiveAnalyzer, Any (+7 more)

### Community 22 - "Digital Twins: A Survey on Enabling Technologies, Challenges, Trends and Future Prospects (Mihai et al., IEEE COMST 2022)"
Cohesion: 0.11
Nodes (21): 5G/6G and uRLLC communications, Artificial General Intelligence, Beyond Human, Cloud, Fog and Edge Computing, Cyber-Physical Systems, Data Ownership and Governance, Data Security challenge, Festo Cyber-Physical Factory (CP-Lab), Fidelity and Rate of Synchronization challenge (+13 more)

### Community 23 - "Step 2: Multi-Strategy Workload Planning"
Cohesion: 0.14
Nodes (20): RAP twin Pipeline Flowchart (riaan.png), Adaptation & Rerouting (policy validation, workload rerouting), Step 3: Chaos Engineering & Fault Injection, Descriptor Parsing (YAML/JSON hardware & job descriptors, SLAs, resource hints), Deterministic Fault Injection (link outages, network noise, thermal throttling, physical-layer failures), Dry-run Evaluator (what-if placement, no resource commitment), Feedback Loop: Iterate Job Constraints, Step 4: Interactive Dashboard Preview (+12 more)

### Community 24 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+11 more)

### Community 25 - "chaos.py"
Cohesion: 0.06
Nodes (28): ChaosRunner, Any, Path, OverridesStore that applies straight to DTState instead of disk/HTTP., One chaos schedule at a time, started/stopped from the API., _StateStore, _TrackedEngine, requests (+20 more)

### Community 26 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 27 - "GPU/accelerator: RTX-5060-Ti"
Cohesion: 0.14
Nodes (16): AWS Inferentia2 ASIC, CXL Type-3 memory expansion, FPGA bitstream: regex_accel, FPGA card: agilex7, FPGA card: other, GPU/accelerator: RTX-5060-Ti, Network fabric: infiniband, Node class: hpc (+8 more)

### Community 28 - "TopologyGraph.tsx"
Cohesion: 0.20
Nodes (15): d3, linkTooltip(), nodeFill(), nodeTooltip(), SavedPosition, TopologyGraph(), buildGraphModel(), GraphLink (+7 more)

### Community 29 - "Digital twins: Recent advances and future directions in engineering fields (Iranshahi et al., ISWA 2025)"
Cohesion: 0.20
Nodes (14): Aerospace and defense DTs, Agriculture and food supply chain DTs, Digital Model, Digital Shadow, DT definition: personalized representation, real-time updates, decision-making support, Gartner Hype Cycle (DT Plateau of Productivity 2023-2028), Health and medicine DTs, Digital twins: Recent advances and future directions in engineering fields (Iranshahi et al., ISWA 2025) (+6 more)

### Community 30 - "package.json"
Cohesion: 0.15
Nodes (12): oxlint, react-dom, tailwindcss, @types/d3, @types/node, @types/react, @types/react-dom, typescript (+4 more)

### Community 31 - "App.tsx"
Cohesion: 0.11
Nodes (24): ref_react_dom_client, @tanstack/react-query, queryKeys, useEvents(), usePlans(), useSnapshot(), FabricEvent, keysFor() (+16 more)

### Community 32 - "._emit_event"
Cohesion: 0.15
Nodes (13): link_key(), LinkDyn, NodeDyn, Mutable, runtime-only fields for a node., Merge an observation (same shape chaos uses): { "action": "apply"|"revert",…, Mutable, runtime-only fields for a link., Try to reserve resources on a specific node or choose one automatically. req…, Load topology (links + defaults) if present. (+5 more)

### Community 33 - "test_economics.py"
Cohesion: 0.08
Nodes (37): annotate_plan(), crosses_site(), Economics, _finite(), Any, True when the topology declares anything worth billing., Grid intensity at this node's zone, falling back to the fabric default. A…, Cost and carbon for one stage placed on one node. (+29 more)

### Community 34 - "policy_benchmark.py"
Cohesion: 0.26
Nodes (11): matplotlib, matplotlib_pyplot, aggregate_metrics(), evaluate_strategy(), _greedy_planner(), load_jobs(), main(), plot_metrics() (+3 more)

### Community 35 - "realtime.mjs"
Cohesion: 0.17
Nodes (6): puppeteer, problems, problems, t0, t1, problems

### Community 36 - "A review of digital twins in smart industries (Ding et al., Computers in Industry 2026)"
Cohesion: 0.22
Nodes (11): Michael Grieves 2002 PLM Digital Twin Concept, Tea Industry in India DT Case Study, Automotive, transportation and logistics DTs, Manufacturing and industrial processes DTs, Managerial insights: open standards, data access compatibility, extended operational functions, Manufacturing DTs, A review of digital twins in smart industries (Ding et al., Computers in Industry 2026), Predictive maintenance and health management (+3 more)

### Community 37 - "JobManager.tsx"
Cohesion: 0.10
Nodes (27): useBlastRadius(), useDeleteJob(), useJobs(), usePlanBatch(), usePlanJob(), useSaveJob(), Job, JobCatalogEntry (+19 more)

### Community 38 - "EventBus"
Cohesion: 0.22
Nodes (4): EventBus, Any, Thread-safe in-memory event buffer with fan-out to live subscribers., Register a live listener (used by the SSE endpoint).

### Community 39 - "devDependencies"
Cohesion: 0.20
Nodes (10): devDependencies, oxlint, puppeteer, @types/d3, @types/node, @types/react, @types/react-dom, typescript (+2 more)

### Community 40 - "hooks.ts"
Cohesion: 0.08
Nodes (24): LiveOptions, useChaos(), useClearPlans(), useDeleteLink(), useDeleteNode(), useObserve(), useResetOverrides(), useSaveLink() (+16 more)

### Community 41 - "Milestones in DT research (2002 Grieves, 2010 Vickers term, 2011 AFRL, ISO/IEC 30173:2023)"
Cohesion: 0.22
Nodes (9): Digital Twin Consortium, ISO 23247 Digital Twin Framework for Manufacturing, Standardisation Efforts, Collaborative standardization and interoperability efforts, AFRL fighter aircraft maintenance DT (2011), Milestones in DT research (2002 Grieves, 2010 Vickers term, 2011 AFRL, ISO/IEC 30173:2023), GE aviation engine predictive maintenance DT (2015), ISO/IEC 30173:2023 Digital Twin standard (+1 more)

### Community 42 - "icons.svg (SVG symbol sprite)"
Cohesion: 0.25
Nodes (8): icons.svg (SVG symbol sprite), bluesky-icon symbol, discord-icon symbol, documentation-icon symbol, github-icon symbol, social-icon symbol, SVG Symbol Sprite Pattern (Vite template boilerplate), x-icon symbol

### Community 43 - "dependencies"
Cohesion: 0.29
Nodes (7): dependencies, d3, react, react-dom, tailwindcss, @tailwindcss/vite, @tanstack/react-query

### Community 44 - "DTState"
Cohesion: 0.08
Nodes (9): DTState, Register a live event listener; returns a Queue of CloudEvents., Public wrapper so API/controllers can publish without touching internals., Save predictive history so it can be rewound (see PredictiveAnalyzer)., Persist current dyn states to sim/overrides.json (lossy for unknown fields)., The node as declared (what nodes/<name>.yaml holds), without runtime state., Links declared in topology.yaml, with their live key., Return instantaneous capacity/free headroom metrics for a node. (+1 more)

### Community 45 - ".oxlintrc.json"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 46 - "GPU/accelerator: RTX-3060"
Cohesion: 0.40
Nodes (5): NVIDIA BlueField-3 DPU, GPU/accelerator: RTX-3060, grig-034 (gaming_rig node), srv-015 (server, amd64, RTX-3060), srv-026 (server, amd64, RTX-3060)

### Community 47 - "Digital Thread"
Cohesion: 0.40
Nodes (5): Digital Thread, Expert Panel TRL Assessment (DT TRL 4.8/9), DT Services across Product Lifecycle (BOL/MOL/EOL) / Servitization, Defence Acquisition University DT definition, Research opportunities: life-cycle management, cross-disciplinary integration, human-machine collaboration

### Community 48 - "vite.config.ts"
Cohesion: 0.40
Nodes (4): @tailwindcss/vite, vite, @vitejs/plugin-react, proxy

### Community 49 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, lint, preview

### Community 50 - "RISC-V 64 (riscv64) architecture"
Cohesion: 0.50
Nodes (4): RISC-V 64 (riscv64) architecture, sbc-037 (sbc, riscv64), sbc-047 (sbc, riscv64), sbc-100 (sbc, riscv64)

### Community 52 - "Construction and building management DTs"
Cohesion: 0.67
Nodes (3): Structural Health Monitoring for Vietnam Bridges, Construction and building management DTs, Construction DTs (monitoring, human-robot collaboration, modular integrated construction)

### Community 71 - "RLPolicy"
Cohesion: 0.19
Nodes (9): _bucket(), Any, Return a *bonus* score you can subtract from greedy latency (negative is…, One TD(0) update. If next_stage/next_candidates is provided: - SARSA uses…, Return a small negative number for nodes with higher Q., RLConfig, RLPolicy, safe_float() (+1 more)

### Community 72 - "NodeEditor.tsx"
Cohesion: 0.19
Nodes (15): useSaveNode(), NETWORK_FABRICS, NodeDescriptor, Mode, NodeEditor(), localProblem(), parseJson(), submit() (+7 more)

### Community 73 - "primitives.tsx"
Cohesion: 0.20
Nodes (28): react, useNodeDescriptor(), Snapshot, METRICS, Row, EditorHost(), EditorTarget, Mode (+20 more)

### Community 74 - "test_bundle.py"
Cohesion: 0.13
Nodes (31): sys, entries(), fabric(), make(), fixture, Bundles arrive from bug reports, so treat their paths as untrusted., test_a_zip_that_is_not_a_bundle_is_rejected(), test_bundle_carries_the_whole_fabric() (+23 more)

### Community 75 - "._load_nodes_locked"
Cohesion: 0.29
Nodes (3): Load ./nodes/*.yaml into nodes_by_name with fresh dyn slots., Load sim/overrides.json if present; optionally apply immediately., safe_int()

### Community 79 - "whatif.py"
Cohesion: 0.13
Nodes (21): build_planner(), canonical_strategy(), plan_once(), Any, Return (planner, mode) for a strategy name. `mode` is only used by…, Plan one job. `dry_run=False` commits reservations, which models contention…, ChangeError, compare() (+13 more)

### Community 80 - "test_blast_radius.py"
Cohesion: 0.13
Nodes (23): BlastRadiusSearch, build_argparser(), load_job(), main(), ArgumentParser, Path, render_text(), fabric() (+15 more)

### Community 81 - "test_whatif.py"
Cohesion: 0.17
Nodes (21): apply_changes(), Apply a change set to a forked state. Returns human-readable descriptions., job(), node(), paths(), fixture, parametrize, Three node-filling jobs on one node: two miss until capacity is added. (+13 more)

### Community 82 - "Fault"
Cohesion: 0.16
Nodes (16): apply_fault(), candidate_faults(), Fault, _most_common(), _nodes_in_zone(), Outcome, Any, Build the fault space to search. Node-level faults are restricted to… (+8 more)

### Community 83 - "launch_fabric.py"
Cohesion: 0.18
Nodes (20): docker, apply_tc_rate(), binfmt_ready_for(), build_container_spec(), canonical_arch(), ensure_image(), ensure_network(), find_rate_gbps() (+12 more)

### Community 84 - "validate_nodes.py"
Cohesion: 0.22
Nodes (13): extend_with_default(), format_error(), human_path(), load_yaml(), main(), Any, Path, Returns: (num_files, num_invalid, num_warn) (+5 more)

### Community 85 - "SelfHealingController"
Cohesion: 0.23
Nodes (5): ManagedStage, Any, Promotes fallback placements when primaries degrade or fail., SelfHealingController, ShadowReservation

### Community 86 - "2. New modules (in progress)"
Cohesion: 0.14
Nodes (13): 1. Ship and deploy the management UI ✅, 2.1 Cost and carbon accounting ✅ — `dt/economics.py`, 2.2 Chaos-as-CI resilience gate ✅ — `tools/ci_gate.py`, 2.3 Blast-radius finder ✅ — `sim/blast_radius.py`, 2.4 Shared planner factory — `dt/planners.py`, 2.5 Incident bundles ✅ — `tools/bundle.py`, 2.6 Import a twin from a real cluster ✅ — `tools/import_cluster.py`, 2.7 What-if capacity planning ✅ — `dt/whatif.py` (+5 more)

### Community 87 - "evaluate_scenario"
Cohesion: 0.20
Nodes (8): test_percentile_interpolates(), evaluate_scenario(), take_sample(), _MemoryStore, _percentile(), Replay a fault schedule, planning every job at each checkpoint. Wall-clock is…, Applies chaos to a DTState in memory — no overrides.json, no HTTP., _silent_engine()

### Community 88 - "Future work — research validation backlog"
Cohesion: 0.22
Nodes (8): 1. Blocker: the paper's results are not produced by this codebase, 2.1 Validate the twin against real hardware (highest value), 2.2 Adversarial chaos search, 2.3 Counterfactual replay, 2. Three bets that would make the work genuinely unique, 3. Cheaper wins that raise credibility, 4. Known defects worth fixing before publishing, Future work — research validation backlog

### Community 89 - "exporters.py"
Cohesion: 0.50
Nodes (4): as_dtdl(), as_k8s_crds(), Any, Export helpers for open standards (DTDL, Kubernetes CRDs).

## Ambiguous Edges - Review These
- `Arch/microarchitecture mismatch (amd64 with ARM Neoverse uarch)` → `grig-001 (gaming_rig node)`  [AMBIGUOUS]
  nodes/grig-001.yaml · relation: references
- `Arch/microarchitecture mismatch (amd64 with ARM Neoverse uarch)` → `grig-006 (gaming_rig node)`  [AMBIGUOUS]
  nodes/grig-006.yaml · relation: references
- `Arch/microarchitecture mismatch (amd64 with ARM Neoverse uarch)` → `grig-010 (gaming_rig node)`  [AMBIGUOUS]
  nodes/grig-010.yaml · relation: references
- `Arch/microarchitecture mismatch (amd64 with ARM Neoverse uarch)` → `grig-036 (gaming_rig node)`  [AMBIGUOUS]
  nodes/grig-036.yaml · relation: references
- `Arch/microarchitecture mismatch (amd64 with ARM Neoverse uarch)` → `grig-050 (gaming_rig node)`  [AMBIGUOUS]
  nodes/grig-050.yaml · relation: references
- `Arch/microarchitecture mismatch (amd64 with ARM Neoverse uarch)` → `grig-058 (gaming_rig node)`  [AMBIGUOUS]
  nodes/grig-058.yaml · relation: references
- `Arch/microarchitecture mismatch (amd64 with ARM Neoverse uarch)` → `grig-064 (gaming_rig node)`  [AMBIGUOUS]
  nodes/grig-064.yaml · relation: references
- `Arch/microarchitecture mismatch (amd64 with ARM Neoverse uarch)` → `grig-087 (gaming_rig node)`  [AMBIGUOUS]
  nodes/grig-087.yaml · relation: references
- `Arch/microarchitecture mismatch (amd64 with ARM Neoverse uarch)` → `grig-096 (gaming_rig node)`  [AMBIGUOUS]
  nodes/grig-096.yaml · relation: references
- `Arch/microarchitecture mismatch (amd64 with ARM Neoverse uarch)` → `grig-097 (gaming_rig node)`  [AMBIGUOUS]
  nodes/grig-097.yaml · relation: references
- `Arch/microarchitecture mismatch (amd64 with ARM Neoverse uarch)` → `hpc-053 (hpc node)`  [AMBIGUOUS]
  nodes/hpc-053.yaml · relation: references

## Knowledge Gaps
- **228 isolated node(s):** `_Solution`, `DemoResult`, `run.sh script`, `$schema`, `plugins` (+223 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 510 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **23 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Arch/microarchitecture mismatch (amd64 with ARM Neoverse uarch)` and `grig-001 (gaming_rig node)`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `Arch/microarchitecture mismatch (amd64 with ARM Neoverse uarch)` and `grig-006 (gaming_rig node)`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `Arch/microarchitecture mismatch (amd64 with ARM Neoverse uarch)` and `grig-010 (gaming_rig node)`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `Arch/microarchitecture mismatch (amd64 with ARM Neoverse uarch)` and `grig-036 (gaming_rig node)`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `Arch/microarchitecture mismatch (amd64 with ARM Neoverse uarch)` and `grig-050 (gaming_rig node)`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `Arch/microarchitecture mismatch (amd64 with ARM Neoverse uarch)` and `grig-058 (gaming_rig node)`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `Arch/microarchitecture mismatch (amd64 with ARM Neoverse uarch)` and `grig-064 (gaming_rig node)`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._