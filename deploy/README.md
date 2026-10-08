# Deployment

Live at **https://raptwin.seloraos.online** on the Oracle VPS (SSH alias `oracle`).

## Layout on the host

```
/srv/raptwin/              # repo (rsynced, no .git)
  .venv/                   # Python env for the API
  web/dist/                # built frontend, served by Caddy
/etc/systemd/system/raptwin-api.service
/etc/caddy/Caddyfile       # raptwin block appended; other sites untouched
```

## Request flow

```
https://raptwin.seloraos.online/         → Caddy → /srv/raptwin/web/dist (SPA)
https://raptwin.seloraos.online/api/*    → Caddy → 127.0.0.1:8080 (gunicorn)
                                            └ /api prefix stripped by handle_path
```

The API binds to loopback only — it is reachable solely through Caddy, which
terminates TLS (certificate issued automatically by Let's Encrypt).

## Redeploying

```bash
./deploy/deploy.sh          # code + frontend + restart API
./deploy/deploy.sh --web    # frontend only
./deploy/deploy.sh --api    # backend only
```

Override `RAPTWIN_SSH_HOST`, `RAPTWIN_REMOTE_DIR` or `RAPTWIN_DOMAIN` if any of
those change.

### API auth (FR-31)

Mutating routes (add/delete node, links, jobs, chaos start/stop, overrides
reset) can require an `X-API-Key` header — disabled by default, matching
every deployment before this was added. To enable it:

```bash
RAPTWIN_API_KEY=$(openssl rand -hex 32) ./deploy/deploy.sh
```

This does two things in one run: writes the key to a systemd drop-in on the
host (`/etc/systemd/system/raptwin-api.service.d/api-key.conf`, `chmod 600`,
never touches the rsynced copy of `deploy/raptwin-api.service` so it can't
leak back into the repo) and bakes the *same* value into the frontend build
as `VITE_API_KEY`, so the dashboard's own management buttons keep working.
That value ships in the public JS bundle — readable via any browser's dev
tools. It raises the bar against casual/scripted abuse of the live demo; it
is not secrecy against a motivated viewer.

Never hardcode the key in this script or commit it anywhere. Pass it as an
env var each time you redeploy with it enabled (`--web`-only or no-flag
redeploys after that need `RAPTWIN_API_KEY` passed again too, or the next
frontend rebuild will ship without it and the dashboard's mutations will
start 401ing against a server that still expects it).

To disable it again:

```bash
ssh oracle "sudo rm -f /etc/systemd/system/raptwin-api.service.d/api-key.conf && sudo systemctl daemon-reload && sudo systemctl restart raptwin-api"
./deploy/deploy.sh --web    # rebuild the frontend without the key too
```

## Service

```bash
ssh oracle sudo systemctl status raptwin-api
ssh oracle sudo journalctl -u raptwin-api -f
ssh oracle sudo systemctl restart raptwin-api
```

Enabled at boot, `Restart=always`.

### Why a single gunicorn worker

`DTState` (reservations, overrides, event bus) lives in process memory, so two
workers would serve two divergent twins — a reservation made on one would be
invisible to the other. Concurrency comes from 24 threads instead, and each open
SSE stream occupies one thread for its lifetime.

## Caddy notes

Two details in the site block matter:

- `handle_path /api/*` strips the prefix, mirroring the Vite dev proxy, so the
  same frontend build runs in development and production.
- `flush_interval -1` on the reverse proxy disables response buffering. Without
  it `/api/stream` (Server-Sent Events) would deliver events in batches instead
  of live.
- `encode` sits inside the static `handle` block rather than at site level, so
  compression never touches the event stream.

`deploy/Caddyfile.reference` is a copy of the deployed file. Edit the real one
at `/etc/caddy/Caddyfile`, then:

```bash
ssh oracle sudo caddy validate --config /etc/caddy/Caddyfile
ssh oracle sudo systemctl reload caddy      # reload, not restart
```

Backups of the pre-deploy config are kept as `/etc/caddy/Caddyfile.bak.*`.

## Other services on this host

`hermes.seloraos.online` (port 9119) and the static site on
`http://80.225.246.130` (`/srv/straredgex/dist`) share this Caddy instance. The
raptwin block was appended without modifying theirs; both were verified
responding after the reload.
