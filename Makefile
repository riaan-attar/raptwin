# Fabric DT — Makefile
# Quickstart:
#   make install           # create venv + install deps
#   make run-api           # start DT API (http://127.0.0.1:8080)
#   make run-ui            # start Dashboard (http://127.0.0.1:8090)
#   make gen-nodes         # synthesize 100 node YAMLs into nodes/
#   make validate-nodes    # schema-validate nodes/
#   make plan              # plan jobs/jobs_10.yaml (dry-run)
#   make demo              # fire random demo jobs (local)
#   make montecarlo        # run Monte Carlo simulator
#   make chaos             # apply chaos events from sim/topology.yaml
#   make docker-launch     # (optional) approximate container emulation
#   make docker-clean      # stop/remove launched containers

# ---------- OS detection ----------
ifeq ($(OS),Windows_NT)
    PY     ?= python
    PIP    ?= pip
    VENV   ?= .venv
    ACT    := $(VENV)\Scripts\activate.bat
    # Run commands via cmd.exe
    SHELL  := cmd.exe
    .SHELLFLAGS := /C
    # Separator for chaining commands on Windows
    SEP    := &&
    RM_CMD := rmdir /s /q
else
    PY     ?= python3
    PIP    ?= pip3
    VENV   ?= .venv
    ACT    := . $(VENV)/bin/activate
    SEP    := ;
    RM_CMD := rm -rf
endif

API_HOST ?= localhost
API_PORT ?= 8080
UI_HOST  ?= localhost
UI_PORT  ?= 8090

NODES_DIR ?= nodes
JOBS_FILE ?= jobs/jobs_10.yaml
TOPO_FILE ?= sim/topology.yaml
WEB_DIR   ?= web
NPM       ?= npm
POLICY_JOBS ?= $(JOBS_FILE)
POLICY_STRATEGIES ?= greedy bandit rl-markov
POLICY_PLOT ?= reports/policy_metrics.png
POLICY_JSON ?= reports/policy_metrics.json
POLICY_LIMIT ?= 6

# ---------- meta ----------
.PHONY: help install venv deps freeze clean format lint \
        run-api run-ui gen-nodes validate-nodes summarize-nodes export-csv \
        plan policy-benchmark demo montecarlo chaos gate gate-baseline blast-radius bundle \
        docker-launch docker-clean \
        web-install web-dev web-build web-preview web-check

help:
	@echo Targets:
	@echo   install          - create venv and install requirements
	@echo   run-api          - start DT API at http://$(API_HOST):$(API_PORT)
	@echo   run-ui           - start legacy Flask dashboard at http://$(UI_HOST):$(UI_PORT)
	@echo   web-install      - install Node frontend deps in $(WEB_DIR)/
	@echo   web-dev          - start the React/Vite dashboard on :5173
	@echo   web-build        - production build into $(WEB_DIR)/dist
	@echo   web-preview      - build then serve the production bundle on :4173
	@echo   gen-nodes        - synthesize 100 realistic nodes into $(NODES_DIR)/
	@echo   validate-nodes   - validate nodes/*.yaml against schema
	@echo   summarize-nodes  - print inventory table
	@echo   export-csv       - export last plan(s) to CSV
	@echo   plan             - plan $(JOBS_FILE) locally dry-run
	@echo   policy-benchmark - benchmark planners and plot metrics
	@echo   gate             - run the resilience gate (ci/gate.yaml thresholds)
	@echo   gate-baseline    - record ci/baseline.json from the current code
	@echo   blast-radius     - smallest fault set that breaks JOB=<id>
	@echo   bundle           - export a reproducible incident bundle
	@echo   demo             - send demo jobs (local); see vars NUM, WORKERS
	@echo   montecarlo       - run Monte Carlo simulation
	@echo   chaos            - apply chaos schedule from $(TOPO_FILE)
	@echo   docker-launch    - launch approx containers for nodes/
	@echo   docker-clean     - stop and remove launched containers
	@echo   format           - black/isort format
	@echo   lint             - ruff lint
	@echo   clean            - remove caches and build artifacts

# ---------- env/deps ----------
venv:
	$(PY) -m venv $(VENV)

ifeq ($(OS),Windows_NT)
deps: requirements.txt
	$(ACT) $(SEP) $(PIP) install -U pip
	$(ACT) $(SEP) $(PIP) install -r requirements.txt

install: deps
	@echo Environment ready.

freeze:
	$(ACT) $(SEP) $(PIP) freeze > requirements.lock.txt

# ---------- run DT ----------
run-api:
	$(ACT) $(SEP) set FABRIC_API_HOST=$(API_HOST) $(SEP) set FABRIC_API_PORT=$(API_PORT) $(SEP) $(PY) -m dt.api

run-ui:
	$(ACT) $(SEP) set FABRIC_DT_REMOTE=http://$(API_HOST):$(API_PORT) $(SEP) set FABRIC_UI_HOST=$(UI_HOST) $(SEP) set FABRIC_UI_PORT=$(UI_PORT) $(SEP) $(PY) -m ui.dashboard

# ---------- data generation / validation ----------
gen-nodes:
	$(ACT) $(SEP) $(PY) -m sim.gen_nodes --out-dir $(NODES_DIR) --count 100

validate-nodes:
	$(ACT) $(SEP) $(PY) -m tools.validate_nodes

summarize-nodes:
	$(ACT) $(SEP) $(PY) -m tools.summarize_nodes

export-csv:
	$(ACT) $(SEP) $(PY) -m tools.export_csv --in plans/last.json --out plots/last.csv

# ---------- planning ----------
plan:
	$(ACT) $(SEP) $(PY) -m planner.run_plan --job $(JOBS_FILE) --dry-run

policy-benchmark:
	$(ACT) $(SEP) $(PY) -m tools.policy_benchmark --jobs $(POLICY_JOBS) --strategies $(POLICY_STRATEGIES) --out $(POLICY_PLOT) --json-out $(POLICY_JSON) --limit $(POLICY_LIMIT)

demo:
	$(ACT) $(SEP) $(PY) -m planner.submit_demo -n 10 -w 1 --qps 0.0 --out-json plans/demo.json --out-csv plans/demo.csv

montecarlo:
	$(ACT) $(SEP) $(PY) -m sim.montecarlo --jobs $(JOBS_FILE) --trials 200 --out plans/montecarlo.json

chaos:
	$(ACT) $(SEP) $(PY) -m sim.chaos --topology $(TOPO_FILE) --run

# ---------- docker (optional) ----------
docker-launch:
	$(ACT) $(SEP) $(PY) -m fabric_docker.launch_fabric --nodes $(NODES_DIR) --topology $(TOPO_FILE) --network fabric-net --image alpine:3.20 --prefix fab- --tc none

docker-clean:
	@echo Stopping and removing containers with prefix fab-
	- docker ps -a --format {{.Names}} | findstr /B fab- | xargs docker rm -f
	- docker network rm fabric-net
	@echo Docker clean done.

# ---------- dev hygiene ----------
format:
	$(ACT) $(SEP) black dt planner sim tools ui fabric_docker
	$(ACT) $(SEP) isort dt planner sim tools ui fabric_docker

lint:
	$(ACT) $(SEP) ruff check dt planner sim tools ui fabric_docker

clean:
	@if exist __pycache__ $(RM_CMD) __pycache__
	@if exist .pytest_cache $(RM_CMD) .pytest_cache
	@if exist .mypy_cache $(RM_CMD) .mypy_cache
	@if exist .ruff_cache $(RM_CMD) .ruff_cache
	@echo Cleaned.

else
# ---------- Unix targets ----------
deps: requirements.txt | venv
	$(ACT) $(SEP) $(PIP) install -U pip
	$(ACT) $(SEP) $(PIP) install -r requirements.txt

install: deps
	@echo "✔ Environment ready."

freeze:
	$(ACT) $(SEP) $(PIP) freeze > requirements.lock.txt

run-api:
	$(ACT) $(SEP) FABRIC_API_HOST=$(API_HOST) FABRIC_API_PORT=$(API_PORT) $(PY) -m dt.api

run-ui:
	$(ACT) $(SEP) FABRIC_DT_REMOTE=http://$(API_HOST):$(API_PORT) FABRIC_UI_HOST=$(UI_HOST) FABRIC_UI_PORT=$(UI_PORT) $(PY) -m ui.dashboard

# ---------- Node frontend (web/) ----------
web-install:
	cd $(WEB_DIR) && $(NPM) install

web-dev:
	cd $(WEB_DIR) && FABRIC_DT_REMOTE=http://$(API_HOST):$(API_PORT) $(NPM) run dev

web-build:
	cd $(WEB_DIR) && $(NPM) run build

web-preview: web-build
	cd $(WEB_DIR) && FABRIC_DT_REMOTE=http://$(API_HOST):$(API_PORT) $(NPM) run preview

web-check:
	cd $(WEB_DIR) && npx tsc -b

gen-nodes:
	$(ACT) $(SEP) $(PY) -m sim.gen_nodes --out-dir $(NODES_DIR) --count 100

validate-nodes:
	$(ACT) $(SEP) $(PY) -m tools.validate_nodes

summarize-nodes:
	$(ACT) $(SEP) $(PY) -m tools.summarize_nodes

export-csv:
	$(ACT) $(SEP) $(PY) -m tools.export_csv --in plans/last.json --out plots/last.csv

plan:
	$(ACT) $(SEP) $(PY) -m planner.run_plan --job $(JOBS_FILE) --dry-run

policy-benchmark:
	$(ACT) $(SEP) $(PY) -m tools.policy_benchmark --jobs $(POLICY_JOBS) --strategies $(POLICY_STRATEGIES) --out $(POLICY_PLOT) --json-out $(POLICY_JSON) --limit $(POLICY_LIMIT)

gate:
	$(ACT) $(SEP) $(PY) -m tools.ci_gate --json-out reports/gate.json --md-out reports/gate.md

gate-baseline:
	$(ACT) $(SEP) $(PY) -m tools.ci_gate --json-out ci/baseline.json --quiet

blast-radius:
	$(ACT) $(SEP) $(PY) -m sim.blast_radius --job $${JOB:-job-vision-large} --depth $${DEPTH:-2}

bundle:
	$(ACT) $(SEP) $(PY) -m tools.bundle export --out $${OUT:-incident.zip} --note "$${NOTE:-manual capture}"

demo:
	$(ACT) $(SEP) $(PY) -m planner.submit_demo \
		-n $${NUM:-10} -w $${WORKERS:-1} --qps $${QPS:-0.0} \
		$$( [ "$${DRY:-1}" = "1" ] && echo "" || echo "--no-dry-run") \
		$$( [ -z "$${REMOTE}" ] && echo "" || echo "--remote $${REMOTE}" ) \
		--out-json plans/demo.json --out-csv plans/demo.csv

montecarlo:
	$(ACT) $(SEP) $(PY) -m sim.montecarlo --jobs $(JOBS_FILE) --trials $${TRIALS:-200} --out plans/montecarlo.json

chaos:
	$(ACT) $(SEP) $(PY) -m sim.chaos --topology $(TOPO_FILE) $$( [ -z "$$SCENARIO" ] && echo "" || echo "--scenario $$SCENARIO" ) --run

docker-launch:
	$(ACT) $(SEP) $(PY) -m fabric_docker.launch_fabric --nodes $(NODES_DIR) --topology $(TOPO_FILE) --network fabric-net --image alpine:3.20 --prefix fab- --tc none

docker-clean:
	@echo "Stopping & removing containers with label/prefix 'fab-' on network fabric-net…"
	- docker ps -a --format '{{.Names}}' | grep '^fab-' | xargs -r docker rm -f
	- docker network rm fabric-net 2>/dev/null || true
	@echo "✔ Docker clean done."

format:
	$(ACT) $(SEP) black dt planner sim tools ui fabric_docker || true
	$(ACT) $(SEP) isort dt planner sim tools ui fabric_docker || true

lint:
	$(ACT) $(SEP) ruff check dt planner sim tools ui fabric_docker || true

clean:
	@find . -name '__pycache__' -type d -prune -exec rm -rf {} +
	@find . -name '*.pyc' -delete
	@rm -rf .pytest_cache .mypy_cache .ruff_cache build dist *.egg-info
	@echo "✔ Cleaned."
endif
