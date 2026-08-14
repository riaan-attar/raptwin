# Running the Fabric Digital Twin Simulator

This guide describes how to run and test the Fabric Digital Twin Simulator project locally.

---

## Step 1: Activate the Virtual Environment
An isolated environment `.venv` is already configured in the project root. Activate it based on your shell:

*   **PowerShell**:
    ```powershell
    .venv\Scripts\Activate.ps1
    ```
*   **Command Prompt (cmd)**:
    ```cmd
    .venv\Scripts\activate.bat
    ```
*   **Git Bash / WSL / Linux / macOS**:
    ```bash
    source .venv/bin/activate
    ```

---

## Step 2: Start the Digital Twin API
The backend API coordinates the digital twin state, path planning, and observation events:
```bash
python -m dt.api --host 127.0.0.1 --port 8080 --debug
```
*   **URL**: `http://127.0.0.1:8080`
*   **Health Check**: `http://127.0.0.1:8080/health`

---

## Step 3: Start the Dashboard UI
In a **new** terminal window, navigate to the project directory, activate the virtual environment (Step 1), and launch the Flask dashboard UI:
```bash
python -m ui.dashboard --host 127.0.0.1 --port 8090 --remote http://127.0.0.1:8080
```
*   **URL**: `http://127.0.0.1:8090`
*   This UI connects directly to the running API to visualize node capacities, links, strategies, and recent placements.

---

## Step 4: Run Planners & Clients
Submit jobs to evaluate scheduling policies locally or against the running API:

*   **Dry-run local planning**:
    ```bash
    python -m planner.run_plan --job jobs/jobs_10.yaml --strategy resilient --dry-run
    ```
*   **Commit a job reservation** to the remote Digital Twin API:
    ```bash
    python -m planner.run_plan --job jobs/jobs_10.yaml --strategy resilient --remote http://127.0.0.1:8080
    ```

---

## Step 5: Run Chaos and Monte Carlo Simulations
*   **Inject fault/chaos scenarios** (updates overrides dynamically):
    ```bash
    python -m sim.chaos --topology sim/topology.yaml --run --dt http://127.0.0.1:8080/observe
    ```
*   **Run a Monte Carlo evaluation sweep**:
    ```bash
    python -m sim.montecarlo --nodes nodes/ --jobs jobs/jobs_10.yaml --trials 100 --out reports/montecarlo.csv
    ```

---

## Alternative: Using the `Makefile`
If you have a `make` utility installed, you can use these shortcuts:
*   `make run-api` - Launch the Digital Twin API
*   `make run-ui` - Launch the Dashboard UI
*   `make plan` - Dry-runs the greedy planner
*   `make chaos` - Run the default chaos injection scenario
