#!/usr/bin/env bash
# Start the DT API and the React/Vite dashboard together. Ctrl+C stops both.
#   ./run.sh                  API on :8080, UI on :5173 (next free port if taken)
#   API_PORT=9000 UI_PORT=3000 ./run.sh
set -euo pipefail

cd "$(dirname "$0")"

API_HOST="${API_HOST:-127.0.0.1}"
API_PORT="${API_PORT:-8080}"
UI_PORT="${UI_PORT:-5173}"

# Python env
if [ ! -d .venv ]; then
  echo "==> Creating .venv and installing requirements"
  python3 -m venv .venv
  .venv/bin/pip install -q -U pip
  .venv/bin/pip install -q -r requirements.txt
fi

# Frontend deps
if [ ! -d web/node_modules ]; then
  echo "==> Installing web dependencies"
  (cd web && npm install)
fi

PIDS=()
cleanup() {
  trap - INT TERM EXIT
  echo
  echo "==> Shutting down"
  for pid in "${PIDS[@]}"; do
    pkill -TERM -P "$pid" 2>/dev/null || true
    kill -TERM "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
}
trap cleanup INT TERM EXIT

echo "==> Starting DT API on http://$API_HOST:$API_PORT"
.venv/bin/python -m dt.api --host "$API_HOST" --port "$API_PORT" &
PIDS+=($!)

# Wait for the API before starting the UI
for _ in $(seq 1 30); do
  if curl -fs "http://$API_HOST:$API_PORT/health" >/dev/null; then
    break
  fi
  sleep 0.5
done
curl -fs "http://$API_HOST:$API_PORT/health" >/dev/null || {
  echo "!! API did not come up on :$API_PORT" >&2
  exit 1
}

echo "==> Starting web UI (Vite prints the URL below)"
(cd web && FABRIC_DT_REMOTE="http://$API_HOST:$API_PORT" exec npm run dev -- --port "$UI_PORT") &
PIDS+=($!)

wait
