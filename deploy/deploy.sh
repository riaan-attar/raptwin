#!/usr/bin/env bash
# Deploy RAP Twin to the VPS behind Caddy.
#
#   ./deploy/deploy.sh          # sync code + rebuild frontend + restart API
#   ./deploy/deploy.sh --web    # frontend only (fast path for UI changes)
#   ./deploy/deploy.sh --api    # backend only
#
# Assumes an SSH alias (default "oracle") with passwordless sudo on the host.
set -euo pipefail

HOST="${RAPTWIN_SSH_HOST:-oracle}"
REMOTE_DIR="${RAPTWIN_REMOTE_DIR:-/srv/raptwin}"
DOMAIN="${RAPTWIN_DOMAIN:-raptwin.seloraos.online}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

do_api=1
do_web=1
case "${1:-}" in
  --web) do_api=0 ;;
  --api) do_web=0 ;;
  "") ;;
  *) echo "unknown flag: $1" >&2; exit 2 ;;
esac

log() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }

if [[ $do_api -eq 1 ]]; then
  log "Syncing backend to ${HOST}:${REMOTE_DIR}"
  rsync -az --delete \
    --exclude '.git/' --exclude '.venv/' --exclude 'node_modules/' \
    --exclude 'web/dist/' --exclude '__pycache__/' --exclude '*.pyc' \
    --exclude 'plans/' --exclude 'reports/' --exclude 'kkwieer/' \
    --exclude 'sim/overrides.json' --exclude 'sim/rl_state.json' \
    --exclude 'sim/bandit_state.json' \
    "${REPO_ROOT}/" "${HOST}:${REMOTE_DIR}/"

  log "Updating Python dependencies"
  ssh "$HOST" "cd ${REMOTE_DIR} && ./.venv/bin/pip install --quiet --upgrade \
    flask pyyaml requests jsonschema numpy gunicorn"

  log "Restarting raptwin-api"
  ssh "$HOST" "sudo systemctl restart raptwin-api && sleep 4 && systemctl is-active raptwin-api"
fi

if [[ $do_web -eq 1 ]]; then
  log "Building frontend"
  (cd "${REPO_ROOT}/web" && npm run build)

  log "Uploading dist"
  rsync -az --delete "${REPO_ROOT}/web/dist/" "${HOST}:${REMOTE_DIR}/web/dist/"
fi

log "Verifying https://${DOMAIN}"
curl -fsS -o /dev/null -w "  page        %{http_code}\n" "https://${DOMAIN}/"
curl -fsS -o /dev/null -w "  /api/health %{http_code}\n" "https://${DOMAIN}/api/health"
curl -fsS "https://${DOMAIN}/api/snapshot" \
  | python3 -c 'import json,sys
d = json.load(sys.stdin)["data"]
print("  snapshot    %d nodes, %d links, %d federations"
      % (len(d["nodes"]), len(d["links"]), len(d["federations"])))'

log "Deployed"
