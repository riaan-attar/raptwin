# Graph Report - raptwin  (2026-10-26)

## Corpus Check
- 159 files · ~773,872 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 49 file(s) not represented in the graph (top: .tex 22, .zip 7, (none) 4)

## Summary
- 2335 nodes · 5789 edges · 128 communities (93 shown, 35 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 150 edges (avg confidence: 0.89)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `01c22c4a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- DTState
- Docs.tsx
- montecarlo.py
- MarkovPlanner
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
- test_mqtt_bridge.py
- Arch/microarchitecture mismatch (amd64 with ARM Neoverse uarch)
- summarize_nodes.py
- PredictiveAnalyzer
- 2.0 Overall Description
- Step 2: Multi-Strategy Workload Planning
- compilerOptions
- chaos.py
- compilerOptions
- GPU/accelerator: RTX-5060-Ti
- make_figures.py
- benchmark_paper_figures.py
- package.json
- App.tsx
- ._emit_event
- sys
- policy_benchmark.py
- puppeteer
- JobRunManager
- JobManager.tsx
- EventBus
- devDependencies
- FederationsPanel.tsx
- test_runs.py
- icons.svg (SVG symbol sprite)
- dependencies
- Mono
- .oxlintrc.json
- GPU/accelerator: RTX-3060
- CostModel
- BanditPolicy
- scripts
- RISC-V 64 (riscv64) architecture
- deploy.sh script
- test_api_auth.py
- tsconfig.json
- NoiseInjector
- CodeQL Advanced Workflow
- bulk.mjs
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
- dashboard.py
- primitives.tsx
- test_bundle.py
- hooks.ts
- Industry/Alumni Mentor Interaction Record
- update_srs_docx.py
- run.sh
- runs.mjs
- blast_radius.py
- test_whatif.py
- run_plan.py
- launch_fabric.py
- Clock
- SelfHealingController
- 2. New modules (in progress)
- run_experiments.py
- Future work — research validation backlog
- FederatedPlanner
- restart.mjs
- test_twin_restart.py
- safe_float
- pytest
- make_tables.py
- vite-env.d.ts
- TopologyGraph.tsx
- faults.ts
- tool
- GreedyPlanner
- _call
- Snapshot
- whatif.py
- server.py
- vite.seo.mjs
- test_json_safe.py
- _need
- release
- vite.config.ts
- ResourceGuardian
- realtime.mjs
- plan_job
- IEEEtran.cls
- README.md
- get_federations
- get_node
- get_topology
- health_cleanup
- list_jobs
- list_links
- list_nodes
- list_plans
- list_scenarios
- save_node
- save_job
- stop_chaos
- what_if
- recent_events

## God Nodes (most connected - your core abstractions)
1. `DTState` - 144 edges
2. `safe_float()` - 62 edges
3. `CostModel` - 54 edges
4. `_call()` - 42 edges
5. `react` - 39 edges
6. `_ok()` - 36 edges
7. `MarkovPlanner` - 33 edges
8. `cn()` - 31 edges
9. `JobRunManager` - 27 edges
10. `Workload format native` - 27 edges

## Surprising Connections (you probably didn't know these)
- `RAP twin Documentation README` --semantically_similar_to--> `RAP Twin Digital Twin Fabric Simulator`  [INFERRED] [semantically similar]
  documentation/README.md → README.md
- `Caddy Reverse Proxy` --semantically_similar_to--> `Vite /api Proxy`  [INFERRED] [semantically similar]
  deploy/README.md → web/README.md
- `test_json_safe_replaces_non_finite_floats()` --calls--> `_json_safe()`  [EXTRACTED]
  tests/test_json_safe.py → dt/api.py
- `take_sample()` --indirect_call--> `jobs()`  [INFERRED]
  tools/ci_gate.py → dt/api.py
- `whatif()` --uses--> `Fault`  [INFERRED]
  dt/api.py → sim/blast_radius.py

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **GPU/CUDA-capable worker nodes (cuda format)** — nodes_hpc_080_hpc_080, nodes_sbc_013_sbc_013, nodes_sbc_017_sbc_017, nodes_sbc_030_sbc_030 [EXTRACTED 1.00]
- **CUDA-capable worker nodes (GPU formats)** — nodes_sbc_069_sbc_069, nodes_sbc_070_sbc_070, nodes_sbc_094_sbc_094, nodes_srv_015_srv_015, nodes_srv_019_srv_019, nodes_srv_020_srv_020, nodes_srv_026_srv_026, nodes_srv_031_srv_031 [EXTRACTED 1.00]
- **Strategies implemented by FederatedPlanner** — documentation_fault_tolerance_algorithms_resilient_placement, documentation_fault_tolerance_algorithms_network_aware_placement, documentation_fault_tolerance_algorithms_federated_load_balancing, documentation_fault_tolerance_algorithms_adaptive_mode_cfg, documentation_fault_tolerance_algorithms_federatedplanner [EXTRACTED 1.00]
- **Nodes carrying H100-SXM accelerators** — nodes_grig_060_grig_060, nodes_grig_083_grig_083, nodes_grig_098_grig_098, nodes_hpc_053_hpc_053 [EXTRACTED 1.00]
- **RAP twin five-step simulation and planning pipeline** — kkwieer_riaan_state_management_telemetry_ingestion, kkwieer_riaan_multi_strategy_workload_planning, kkwieer_riaan_chaos_engineering_fault_injection, kkwieer_riaan_interactive_dashboard_preview, kkwieer_riaan_statistical_evaluation_exporting [EXTRACTED 1.00]
- **NPU-equipped worker nodes (npu format)** — nodes_laptop_011_laptop_011, nodes_laptop_012_laptop_012, nodes_laptop_035_laptop_035, nodes_laptop_051_laptop_051, nodes_phone_004_phone_004, nodes_phone_022_phone_022, nodes_sbc_007_sbc_007, nodes_sbc_027_sbc_027 [EXTRACTED 1.00]
- **Servers with specialized offload hardware (DPU, FPGA, CXL memory)** — nodes_srv_041_srv_041, nodes_srv_044_srv_044, nodes_srv_062_srv_062 [INFERRED 0.75]
- **Social/brand link icons (Vite starter footer)** — web_public_icons_bluesky_icon, web_public_icons_discord_icon, web_public_icons_github_icon, web_public_icons_x_icon [INFERRED 0.75]
- **Fabric Descriptor Schemas** — schemas_job_schema_fabric_job_dag_schema, schemas_node_schema_fabric_node_descriptor_schema, schemas_topology_schema_topology_schema [INFERRED 0.85]
- **Plan-test-adjust constraint iteration loop** — kkwieer_riaan_multi_strategy_workload_planning, kkwieer_riaan_chaos_engineering_fault_injection, kkwieer_riaan_strategy_adjustment, kkwieer_riaan_feedback_loop [INFERRED 0.85]
- **SSE Realtime Update Pipeline** — web_readme_cloudevent_bus, web_readme_sse_stream, web_readme_useeventstream, deploy_readme_caddy_reverse_proxy, web_readme_vite_proxy [INFERRED 0.85]

## Communities (128 total, 35 thin omitted)

### Community 0 - "DTState"
Cohesion: 0.06
Nodes (18): clamp(), DTState, Any, Return instantaneous capacity/free headroom metrics for a node., Return a copy of all reservations grouped by node., Register a live event listener; returns a Queue of CloudEvents., Public wrapper so API/controllers can publish without touching internals., Save predictive history so it can be rewound (see PredictiveAnalyzer). (+10 more)

### Community 1 - "Docs.tsx"
Cohesion: 0.09
Nodes (40): ArchitectureDiagram(), ClosedLoopDiagram(), LOOP, RequestFlowDiagram(), DocPageDef, Docs(), GROUPS, Heading (+32 more)

### Community 2 - "montecarlo.py"
Cohesion: 0.18
Nodes (28): accel_multiplier(), apply_perturbations(), build_link_db(), build_stage(), estimate_job_latency_ms(), generate_synthetic_catalog(), get_link_metrics(), greedy_place() (+20 more)

### Community 3 - "MarkovPlanner"
Cohesion: 0.22
Nodes (6): clamp01(), MarkovPlanner, recurse(), Any, Solve a sequential placement problem via dynamic programming., _Solution

### Community 4 - "RAP Twin Digital Twin Fabric Simulator"
Cohesion: 0.06
Nodes (51): Caddy Reverse Proxy, deploy.sh Redeploy Script, raptwin.seloraos.online Deployment, raptwin-api systemd Service, Single Gunicorn Worker with 24 Threads, Dry-Run Mode, Azure DTDL / Kubernetes CRD Export, DTState Digital Twin State Machine (+43 more)

### Community 5 - "submit_demo.py"
Cohesion: 0.16
Nodes (24): DemoResult, export_csv(), export_json(), main(), make_fixed_job(), make_random_job(), _pick_formats(), print_result() (+16 more)

### Community 6 - "test_import_cluster.py"
Cohesion: 0.11
Nodes (40): cluster(), k8s_node(), parametrize, test_arm_architecture_is_mapped(), test_cli_dry_run_writes_nothing(), test_cli_rejects_bad_json(), test_control_plane_becomes_a_manager(), test_converts_capacity_and_topology() (+32 more)

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
Cohesion: 0.11
Nodes (31): collections, copy, dataclasses, datetime, dt/chaos_runner.py — run sim/chaos.py scenarios inside the DT API process. The…, merge_stage_details(), Combine planner annotations with cost model metrics per stage. ``primary``…, dt/cost_model.py — Latency, transfer, energy, and risk estimators for Fabric… (+23 more)

### Community 11 - "api.py"
Cohesion: 0.06
Nodes (87): before_request, delete, add_node(), blast_radius(), bundle(), _catalog_filename(), chaos_start(), chaos_status() (+79 more)

### Community 12 - "format.ts"
Cohesion: 0.16
Nodes (27): useRelease(), useWhatIf(), PlanResult, ReservationsPanel(), Mode, MODES, WhatIfPanel(), buildChanges() (+19 more)

### Community 13 - "validators.py"
Cohesion: 0.08
Nodes (40): assert_instance(), assert_job(), assert_node(), assert_topology(), _CompiledSchema, DirReport, _extend_with_default(), _format_error() (+32 more)

### Community 14 - "types.ts"
Cohesion: 0.06
Nodes (51): api, ApiError, parseLenient(), request(), useSaveNode(), ApiEnvelope, ApiErr, ApiOk (+43 more)

### Community 15 - "test_management.py"
Cohesion: 0.13
Nodes (5): _job(), parametrize, test_catalogue_file_name_must_be_plain(), test_save_new_job_creates_a_new_catalogue_file(), test_save_new_job_into_existing_catalogue_file()

### Community 16 - "test_ci_gate.py"
Cohesion: 0.09
Nodes (38): Namespace, fabric(), fixture, parametrize, ci/gate.yaml and ci/baseline.json must stay in step, or CI compares apples to…, Latency is the sensitive signal when deadlines are generous., result(), test_absolute_ceilings() (+30 more)

### Community 17 - "gen_nodes.py"
Cohesion: 0.17
Nodes (26): accelerators_block(), battery_profile(), choice_weighted(), cpu_profile(), cxl_block(), dpu_block(), formats_supported(), gpu_block() (+18 more)

### Community 18 - "test_mqtt_bridge.py"
Cohesion: 0.10
Nodes (28): requests, build_argparser(), main(), MqttBridge, _on_message(), parse_telemetry_message(), Any, ArgumentParser (+20 more)

### Community 19 - "Arch/microarchitecture mismatch (amd64 with ARM Neoverse uarch)"
Cohesion: 0.15
Nodes (25): GPU/accelerator: MI300X, Network fabric: wifi, Node class: phone, Arch/microarchitecture mismatch (amd64 with ARM Neoverse uarch), grig-010 (gaming_rig node), grig-033 (gaming_rig node), grig-039 (gaming_rig node), grig-058 (gaming_rig node) (+17 more)

### Community 20 - "summarize_nodes.py"
Cohesion: 0.24
Nodes (18): accel_score(), agg_stats(), cpu_capacity(), export_csv(), export_json(), export_md(), _get_field(), load_nodes() (+10 more)

### Community 21 - "PredictiveAnalyzer"
Cohesion: 0.12
Nodes (13): _clamp(), _EWMA, LinkForecast, NodeForecast, _now_ms(), PredictiveAnalyzer, Any, Aggregate predictive telemetry for nodes and links. (+5 more)

### Community 22 - "2.0 Overall Description"
Cohesion: 0.04
Nodes (47): 1.0 Introduction, 1.1 Purpose, 1.2 Scope, 1.3 Definitions, Acronyms, and Abbreviations, 1.4 References, 1.5 Technologies to be used, 1.6 Overview, 2.0 Overall Description (+39 more)

### Community 23 - "Step 2: Multi-Strategy Workload Planning"
Cohesion: 0.14
Nodes (20): RAP twin Pipeline Flowchart (riaan.png), Adaptation & Rerouting (policy validation, workload rerouting), Step 3: Chaos Engineering & Fault Injection, Descriptor Parsing (YAML/JSON hardware & job descriptors, SLAs, resource hints), Deterministic Fault Injection (link outages, network noise, thermal throttling, physical-layer failures), Dry-run Evaluator (what-if placement, no resource commitment), Feedback Loop: Iterate Job Constraints, Step 4: Interactive Dashboard Preview (+12 more)

### Community 24 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+11 more)

### Community 25 - "chaos.py"
Cohesion: 0.07
Nodes (27): ChaosRunner, Any, Path, OverridesStore that applies straight to DTState instead of disk/HTTP., One chaos schedule at a time, started/stopped from the API., _StateStore, _TrackedEngine, signal (+19 more)

### Community 26 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 27 - "GPU/accelerator: RTX-5060-Ti"
Cohesion: 0.14
Nodes (16): AWS Inferentia2 ASIC, CXL Type-3 memory expansion, FPGA bitstream: regex_accel, FPGA card: agilex7, FPGA card: other, GPU/accelerator: RTX-5060-Ti, Network fabric: infiniband, Node class: hpc (+8 more)

### Community 28 - "make_figures.py"
Cohesion: 0.10
Nodes (38): arrow(), box(), canvas(), class_box(), class_top(), label(), message(), poly() (+30 more)

### Community 29 - "benchmark_paper_figures.py"
Cohesion: 0.10
Nodes (37): test_plot_jct_vs_load_writes_both_formats(), test_plot_sla_by_scenario_writes_both_formats(), full_inputs(), gate_row(), policy_row(), test_assemble_rows_covers_all_four_real_strategies_in_order(), test_energy_converted_kj_to_j(), test_latency_converted_ms_to_seconds() (+29 more)

### Community 30 - "package.json"
Cohesion: 0.15
Nodes (12): oxlint, react-dom, tailwindcss, @types/d3, @types/node, @types/react, @types/react-dom, typescript (+4 more)

### Community 31 - "App.tsx"
Cohesion: 0.12
Nodes (21): ref_react_dom_client, @tanstack/react-query, queryKeys, usePlans(), useSnapshot(), FabricEvent, keysFor(), StreamStatus (+13 more)

### Community 32 - "._emit_event"
Cohesion: 0.13
Nodes (15): LinkDyn, NodeDyn, Mutable, runtime-only fields for a node., Merge an observation (same shape chaos uses): { "action": "apply"|"revert",…, Mutable, runtime-only fields for a link., Try to reserve resources on a specific node or choose one automatically. req…, Load ./nodes/*.yaml into nodes_by_name with fresh dyn slots., Load topology (links + defaults) if present. (+7 more)

### Community 33 - "sys"
Cohesion: 0.10
Nodes (31): annotate_plan(), crosses_site(), Economics, _finite(), Any, True when the topology declares anything worth billing., Grid intensity at this node's zone, falling back to the fabric default. A…, Cost and carbon for one stage placed on one node. (+23 more)

### Community 34 - "policy_benchmark.py"
Cohesion: 0.33
Nodes (9): aggregate_metrics(), evaluate_strategy(), _greedy_planner(), load_jobs(), main(), plot_metrics(), Path, Generate comparison plots for DT planner policies. (+1 more)

### Community 35 - "puppeteer"
Cohesion: 0.25
Nodes (3): puppeteer, problems, problems

### Community 36 - "JobRunManager"
Cohesion: 0.11
Nodes (12): JobRun, JobRunManager, Any, Begin a run for a committed plan. Timer: argument, then job.duration_s, then…, End a running job now as completed, freeing its reservations., Set the time left from now, or add to it (a negative extend shortens it)., The twin was restarted: its reservations are gone, so just drop the records., End every run whose timer has elapsed. Returns the ids that ended. (+4 more)

### Community 37 - "JobManager.tsx"
Cohesion: 0.09
Nodes (35): useBlastRadius(), useDeleteJob(), useJobs(), usePlanBatch(), usePlanJob(), useRunSettings(), useSaveJob(), BlastRadiusReport (+27 more)

### Community 38 - "EventBus"
Cohesion: 0.20
Nodes (5): build_cloudevent(), EventBus, Any, Thread-safe in-memory event buffer with fan-out to live subscribers., Register a live listener (used by the SSE endpoint).

### Community 39 - "devDependencies"
Cohesion: 0.20
Nodes (10): devDependencies, oxlint, puppeteer, @types/d3, @types/node, @types/react, @types/react-dom, typescript (+2 more)

### Community 40 - "FederationsPanel.tsx"
Cohesion: 0.08
Nodes (51): useBulkObserve(), useDeleteNode(), useNodeDescriptor(), Federation, FederationLink, LinkFilterControls(), NodeBulkBar(), NodeFilterControls() (+43 more)

### Community 41 - "test_runs.py"
Cohesion: 0.16
Nodes (31): commit(), event_types(), held_count(), make_job(), parametrize, Reserve capacity for two stages and return a plan shaped like POST /plan's., test_a_down_node_marks_the_run_disrupted(), test_a_negative_extension_cannot_end_the_run_in_the_past() (+23 more)

### Community 42 - "icons.svg (SVG symbol sprite)"
Cohesion: 0.25
Nodes (8): icons.svg (SVG symbol sprite), bluesky-icon symbol, discord-icon symbol, documentation-icon symbol, github-icon symbol, social-icon symbol, SVG Symbol Sprite Pattern (Vite template boilerplate), x-icon symbol

### Community 43 - "dependencies"
Cohesion: 0.29
Nodes (7): dependencies, d3, react, react-dom, tailwindcss, @tailwindcss/vite, @tanstack/react-query

### Community 44 - "Mono"
Cohesion: 0.22
Nodes (13): useEvents(), eventFamily(), EventsExplorer(), summarise(), SUMMARY_KEYS, Tone, toneFor(), WINDOWS (+5 more)

### Community 45 - ".oxlintrc.json"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 46 - "GPU/accelerator: RTX-3060"
Cohesion: 0.40
Nodes (5): NVIDIA BlueField-3 DPU, GPU/accelerator: RTX-3060, grig-034 (gaming_rig node), srv-015 (server, amd64, RTX-3060), srv-026 (server, amd64, RTX-3060)

### Community 47 - "CostModel"
Cohesion: 0.25
Nodes (11): clamp(), CostModel, link_key(), Any, Boost compute if the node supports a preferred format requested by the stage., A rough scalar for 'how big' a stage is. You can later switch to FLOP/byte…, Very rough: (idle+active) power × time., Blend node trust inverse, SSD wear, crashiness, thermal issues, and link loss. (+3 more)

### Community 48 - "BanditPolicy"
Cohesion: 0.19
Nodes (10): ArmStats, _available_formats(), BanditPolicy, ContextStats, _now_ms(), Any, Update the bandit with an observed outcome. reward_mode: - "neg_latency":…, Compact signature to cluster learning by 'similar' stages. (+2 more)

### Community 49 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, lint, preview

### Community 50 - "RISC-V 64 (riscv64) architecture"
Cohesion: 0.50
Nodes (4): RISC-V 64 (riscv64) architecture, sbc-037 (sbc, riscv64), sbc-047 (sbc, riscv64), sbc-100 (sbc, riscv64)

### Community 51 - "deploy.sh script"
Cohesion: 0.47
Nodes (4): log(), deploy.sh script, log(), push.sh script

### Community 52 - "test_api_auth.py"
Cohesion: 0.14
Nodes (17): client(), fabric(), fixture, parametrize, The public dashboard must keep working with no key at all., Default deployment behaviour (and every pre-FR-31 test) must be untouched., state(), test_every_gated_route_rejects_without_key() (+9 more)

### Community 54 - "NoiseInjector"
Cohesion: 0.29
Nodes (3): maybe_start_noise(), NoiseInjector, Utility helper that honours FABRIC_ENABLE_NOISE.

### Community 56 - "bulk.mjs"
Cohesion: 0.16
Nodes (13): barText(), click(), downNames, failures, firstThree, inCard(), noticeText(), problems (+5 more)

### Community 71 - "RLPolicy"
Cohesion: 0.17
Nodes (10): PlannerWeights, _bucket(), Any, Return a *bonus* score you can subtract from greedy latency (negative is…, One TD(0) update. If next_stage/next_candidates is provided: - SARSA uses…, Return a small negative number for nodes with higher Q., RLConfig, RLPolicy (+2 more)

### Community 72 - "dashboard.py"
Cohesion: 0.17
Nodes (28): flask, api_health(), api_jobs(), api_observe(), api_plan(), api_plan_batch(), api_plan_demo(), api_plans() (+20 more)

### Community 73 - "primitives.tsx"
Cohesion: 0.08
Nodes (43): react, useRestartTwin(), useRuns(), useSaveLink(), JobRun, RestartResult, RunStage, SnapshotLink (+35 more)

### Community 74 - "test_bundle.py"
Cohesion: 0.14
Nodes (30): entries(), fabric(), make(), fixture, Bundles arrive from bug reports, so treat their paths as untrusted., test_a_zip_that_is_not_a_bundle_is_rejected(), test_bundle_carries_the_whole_fabric(), test_bundle_without_live_evidence_still_works() (+22 more)

### Community 75 - "hooks.ts"
Cohesion: 0.17
Nodes (17): BulkResult, LiveOptions, useCancelRun(), useChaos(), useClearPlans(), useFinishAllRuns(), useFinishRun(), useResetOverrides() (+9 more)

### Community 76 - "Industry/Alumni Mentor Interaction Record"
Cohesion: 0.12
Nodes (15): 10. Signatures, 1. Project Information, 2. Interaction Details, 3. Objectives of the Meeting:, 4. Key Discussion Points:, 5. Suggestions Given by Mentor, 6. Action Plan, 7. Status of Previous Suggestions (For Interaction II onwards) (+7 more)

### Community 77 - "update_srs_docx.py"
Cohesion: 0.24
Nodes (15): build_argparser(), convert_to_pdf(), find_benchmark_table(), insert_caption_after_table(), main(), Any, ArgumentParser, Path (+7 more)

### Community 79 - "runs.mjs"
Cohesion: 0.19
Nodes (11): api(), commit(), failures, ids, job(), post(), problems, runs() (+3 more)

### Community 80 - "blast_radius.py"
Cohesion: 0.09
Nodes (40): apply_fault(), BlastRadiusSearch, build_argparser(), candidate_faults(), Fault, load_job(), main(), _most_common() (+32 more)

### Community 81 - "test_whatif.py"
Cohesion: 0.14
Nodes (27): apply_changes(), ChangeError, compare(), Plan `jobs` on the fabric as-is and on a changed fork, then diff., A proposed change that cannot be applied (bad descriptor, unknown node…)., Apply a change set to a forked state. Returns human-readable descriptions., job(), node() (+19 more)

### Community 82 - "run_plan.py"
Cohesion: 0.18
Nodes (14): argparse, os, ensure_jobs(), load_yaml(), main(), plan_local(), plan_remote(), print_summary() (+6 more)

### Community 83 - "launch_fabric.py"
Cohesion: 0.13
Nodes (30): docker, apply_tc_rate(), binfmt_ready_for(), build_container_spec(), canonical_arch(), ensure_image(), ensure_network(), find_rate_gbps() (+22 more)

### Community 84 - "Clock"
Cohesion: 0.14
Nodes (7): api(), Clock, FakeHealer, healer(), fixture, Stands in for SelfHealingController: tracks what it 'currently holds' per job., runs()

### Community 85 - "SelfHealingController"
Cohesion: 0.13
Nodes (8): ManagedStage, Any, (node, reservation_id) for every reservation currently held for a job.…, stage id -> the node currently acting as that stage's primary., Drop every managed plan (used when the twin is restarted)., Promotes fallback placements when primaries degrade or fail., SelfHealingController, ShadowReservation

### Community 86 - "2. New modules (in progress)"
Cohesion: 0.13
Nodes (14): 1. Ship and deploy the management UI ✅, 2.1 Cost and carbon accounting ✅ — `dt/economics.py`, 2.2 Chaos-as-CI resilience gate ✅ — `tools/ci_gate.py`, 2.3 Blast-radius finder ✅ — `sim/blast_radius.py`, 2.4 Shared planner factory — `dt/planners.py`, 2.5 Incident bundles ✅ — `tools/bundle.py`, 2.6 Import a twin from a real cluster ✅ — `tools/import_cluster.py`, 2.7 What-if capacity planning ✅ — `dt/whatif.py` (+6 more)

### Community 87 - "run_experiments.py"
Cohesion: 0.35
Nodes (11): blast(), contention(), gate(), load_jobs(), main(), montecarlo(), pct(), per_strategy() (+3 more)

### Community 88 - "Future work — research validation backlog"
Cohesion: 0.22
Nodes (8): 1. Blocker: the paper's results are not produced by this codebase, 2.1 Validate the twin against real hardware (highest value), 2.2 Adversarial chaos search, 2.3 Counterfactual replay, 2. Three bets that would make the work genuinely unique, 3. Cheaper wins that raise credibility, 4. Known defects worth fixing before publishing, Future work — research validation backlog

### Community 89 - "FederatedPlanner"
Cohesion: 0.24
Nodes (8): Counter, build_planner(), canonical_strategy(), Return (planner, mode) for a strategy name. `mode` is only used by…, FederatedPlanner, _mode_key(), Any, ModeConfig

### Community 90 - "restart.mjs"
Cohesion: 0.19
Nodes (9): api(), events, failures, job, post(), problems, sleep(), state() (+1 more)

### Community 91 - "test_twin_restart.py"
Cohesion: 0.33
Nodes (7): dirty_the_twin(), job(), node_by_name(), Hold a reservation, inject a fault and an ad-hoc link so there is something to…, test_planning_works_after_a_restart(), test_restart_rebuilds_the_twin_from_disk(), test_restart_requires_the_confirmation_phrase()

### Community 92 - "safe_float"
Cohesion: 0.16
Nodes (8): _node_speed(), link_key(), Cheap read-only health of one node (None if unknown)., Precompute static capacities and store under node['caps']., safe_float(), evaluate_scenario(), take_sample(), Replay a fault schedule, planning every job at each checkpoint. Wall-clock is…

### Community 93 - "pytest"
Cohesion: 0.32
Nodes (6): pytest, client(), make_job(), fixture, test_plan_batch_reuses_plan_logic(), test_plan_returns_rich_stage_metrics()

### Community 94 - "make_tables.py"
Cohesion: 0.48
Nodes (6): contention(), gate(), Turn the JSON written by run_experiments.py (and ci/baseline.json) into LaTeX…, strategies(), thousands(), whatif()

### Community 96 - "TopologyGraph.tsx"
Cohesion: 0.15
Nodes (16): d3, endpointId(), Hover, LinkHover(), nodeFill(), SavedPosition, TopologyGraph(), buildGraphModel() (+8 more)

### Community 97 - "faults.ts"
Cohesion: 0.13
Nodes (20): LinkMetrics, ObservationPayload, applyLink(), applyNode(), BulkPlan, clamp(), LINK_LABELS, LINK_RESET_FIELDS (+12 more)

### Community 98 - "tool"
Cohesion: 0.12
Nodes (17): export_dtdl(), get_plan_detail(), get_snapshot(), inject_observation(), Plan Detail: per-stage cards (node, format, compute/xfer ms, cpu, reliability,…, Create/update a declared link: {a, b, profile?, speed_gbps?, rtt_ms?,…, Stop chaos and clear every injected fault., POST /observe. payload e.g.… (+9 more)

### Community 99 - "GreedyPlanner"
Cohesion: 0.26
Nodes (10): _fits(), GreedyPlanner, merge_stage_details(), Any, dt/policy/greedy.py — Baseline greedy planner for Fabric DT. What it does…, safe_float(), _supports_formats(), test_annotate_plan_fills_cost_for_any_planner() (+2 more)

### Community 100 - "_call"
Cohesion: 0.14
Nodes (15): blast_radius(), _call(), download_bundle(), export_crds(), plan_catalog(), Any, Plan the entire job catalogue ('Plan entire catalog'). Committed plans hold…, Start a chaos scenario inside the twin (speed 0.1-1000). (+7 more)

### Community 101 - "Snapshot"
Cohesion: 0.15
Nodes (11): useDeleteLink(), useObserve(), useTopology(), Snapshot, LinkManager(), coerce(), LINK_FIELDS, NODE_FIELDS (+3 more)

### Community 102 - "whatif.py"
Cohesion: 0.22
Nodes (12): plan_once(), Any, Plan one job. `dry_run=False` commits reservations, which models contention…, _deep_merge(), _delta(), _evaluate(), _percentile(), Any (+4 more)

### Community 103 - "server.py"
Cohesion: 0.17
Nodes (12): chaos_status(), diagnose_fabric(), get_economics(), get_health(), get_overview(), pick_strategy(), Pricing and carbon intensity in force., MCP server for RAP twin: every dashboard feature as a tool, over the REST API.… (+4 more)

### Community 104 - "vite.seo.mjs"
Cohesion: 0.31
Nodes (7): AUTHOR, DOCS, SITE, TABS, esc(), renderPage(), setMeta()

### Community 105 - "test_json_safe.py"
Cohesion: 0.25
Nodes (9): _strict(), test_infeasible_plan_is_strict_json(), test_json_safe_replaces_non_finite_floats(), test_plans_history_is_strict_json(), client(), fabric(), fixture, Isolated nodes/ + topology.yaml copies so tests never touch the repo files. (+1 more)

### Community 106 - "_need"
Cohesion: 0.22
Nodes (9): clear_plans(), delete_job(), delete_link(), delete_node(), _need(), Clear plan history (reservations are not released)., Delete a node, its file and reservations., Delete a declared link by key 'A|B'. (+1 more)

### Community 107 - "release"
Cohesion: 0.25
Nodes (9): list_reservations(), Capacity held by committed plans; filter by node or id substring., Release reservations: list of {node, reservation_id}., Release all reservations whose node/id contains the filter., Release every reservation, returning nodes to normal., release(), release_all(), release_matching() (+1 more)

### Community 108 - "vite.config.ts"
Cohesion: 0.29
Nodes (5): @tailwindcss/vite, vite, @vitejs/plugin-react, proxy, seoPages()

### Community 110 - "realtime.mjs"
Cohesion: 0.33
Nodes (3): problems, t0, t1

### Community 111 - "plan_job"
Cohesion: 0.40
Nodes (5): _job(), plan_job(), Plan one job (by library id or inline). dry_run=true reserves nothing; false…, Dry-run all 7 strategies on a job and rank them (default weights: latency 1,…, recommend_strategy()

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
- **287 isolated node(s):** `_Solution`, `insert`, `update`, `DemoResult`, `run.sh script` (+282 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 734 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **35 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

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