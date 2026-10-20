# RAP twin MCP server
Install: `pip install -r requirements-mcp.txt`. Start the API (`./run.sh`) or point at the VPS.

Claude Code:
`claude mcp add raptwin -e RAPTWIN_URL=http://127.0.0.1:8080 -- .venv/bin/python mcp_server/server.py`

VPS: `RAPTWIN_URL=https://raptwin.seloraos.online/api RAPTWIN_API_KEY=<key>` (key only needed if auth is enabled).

Destructive tools need `confirm=true`; planning defaults to `dry_run=true`.
