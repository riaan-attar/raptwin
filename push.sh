#!/usr/bin/env bash
# Commit everything, push to GitHub, and deploy to the VPS.
#
#   ./push.sh "my commit message"          # commit + push + full deploy
#   ./push.sh "my commit message" --web    # frontend-only deploy (UI changes)
#   ./push.sh "my commit message" --api    # backend-only deploy
#   ./push.sh "my commit message" --no-deploy
#
# The API key is read from the server's systemd drop-in into a shell variable and
# piped to deploy.sh. It is never printed, written to a file, or committed.
# Nothing to commit is fine: it still pushes and deploys.
set -euo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

MSG="${1:-}"
[[ -n "$MSG" ]] || { echo "usage: ./push.sh \"commit message\" [--web|--api|--no-deploy]" >&2; exit 2; }
MODE="${2:-}"
case "$MODE" in ""|--web|--api|--no-deploy) ;; *) echo "unknown option: $MODE" >&2; exit 2 ;; esac

HOST="${RAPTWIN_SSH_HOST:-oracle}"
log() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }

log "Committing"
git add -A
if git diff --cached --quiet; then
  echo "nothing new to commit"
else
  git commit -q -m "$MSG"
  git log --oneline -1
fi

log "Pushing"
git push

[[ "$MODE" == "--no-deploy" ]] && { log "Done (deploy skipped)"; exit 0; }

log "Reading the API key from ${HOST}"
KEY="$(ssh "$HOST" "sudo grep -h FABRIC_API_KEY /etc/systemd/system/raptwin-api.service.d/api-key.conf" | sed 's/.*FABRIC_API_KEY=//')"
[[ -n "$KEY" ]] || { echo "could not read the API key from ${HOST}; deploy aborted (code is already pushed)" >&2; exit 1; }

ARGS=()
[[ -n "$MODE" ]] && ARGS+=("$MODE")
RAPTWIN_API_KEY="$KEY" ./deploy/deploy.sh "${ARGS[@]}" 2>&1 | grep -vF "$KEY"

log "Done: pushed and deployed"
