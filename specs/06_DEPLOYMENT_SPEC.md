# 06 — Deployment Spec

Deploy to Hetzner. Same pattern as Chariot Signal Engine. Reuse existing infrastructure where possible.

## Target

- Hetzner CPX21 (either your existing `YOUR_VPS_IP` or a new VM — your call)
- nginx reverse proxy on port 80/443
- FastAPI backend on port 8000 (internal)
- Redis on port 6379 (internal, no external exposure)
- Static frontend served by nginx
- Six MCP servers managed by the backend process (stdio subprocesses)
- HTTPS via Let's Encrypt / certbot

## Directory layout on server

```
/opt/primer/
├── app/                    # git clone of primer-
│   ├── backend/
│   ├── frontend/
│   ├── mcp_servers/
│   ├── data/
│   │   └── primer.db       # gitignored, generated on deploy
│   └── .env                # gitignored
├── logs/
│   ├── backend.log
│   └── mcp-{name}.log
└── venv/                   # Python virtual environment
```

## Systemd service

`/etc/systemd/system/primer-backend.service`:

```ini
[Unit]
Description=Primer Backend (FastAPI + MCP orchestrator)
After=network.target redis.service

[Service]
Type=simple
User=primer
WorkingDirectory=/opt/primer/app
Environment="PATH=/opt/primer/venv/bin"
EnvironmentFile=/opt/primer/app/.env
ExecStart=/opt/primer/venv/bin/uvicorn backend.main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=3
StandardOutput=append:/opt/primer/logs/backend.log
StandardError=append:/opt/primer/logs/backend.log

[Install]
WantedBy=multi-user.target
```

MCP servers are started as subprocesses by the backend, not as separate systemd services. Simpler lifecycle, tied to the backend process.

## nginx config

`/etc/nginx/sites-available/primer`:

```nginx
server {
    server_name primer.yourdomain.com;

    # Static frontend
    location / {
        root /opt/primer/app/frontend;
        try_files $uri $uri/ /briefing.html;
    }

    # API endpoints
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # SSE endpoint needs special config
    location /briefing/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_buffering off;              # critical for SSE
        proxy_cache off;
        proxy_read_timeout 60s;
    }

    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/primer.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/primer.yourdomain.com/privkey.pem;
}

server {
    if ($host = primer.yourdomain.com) {
        return 301 https://$host$request_uri;
    }
    server_name primer.yourdomain.com;
    listen 80;
    return 404;
}
```

## Deploy script

`scripts/deploy.sh` — same pattern as Chariot:

```bash
#!/bin/bash
set -e

SERVER=${PRIMER_SERVER:-root@YOUR_VPS_IP}
BRANCH=${BRANCH:-main}

echo "→ Pushing latest"
git push origin $BRANCH

echo "→ Deploying to $SERVER"
ssh $SERVER bash -c "'
  set -e
  cd /opt/primer/app
  git fetch origin
  git reset --hard origin/$BRANCH
  /opt/primer/venv/bin/pip install -r backend/requirements.txt -q
  /opt/primer/venv/bin/python scripts/seed_db.py
  systemctl restart primer-backend
  echo \"Deploy complete\"
'"
```

## Initial server setup

One-time. Document in `scripts/setup_server.sh`:

```bash
#!/bin/bash
# Run on a fresh Hetzner CPX21 as root

apt update && apt upgrade -y
apt install -y python3 python3-venv python3-pip redis nginx certbot python3-certbot-nginx git sqlite3

useradd -m -s /bin/bash primer
mkdir -p /opt/primer/{logs,app}
chown -R primer:primer /opt/primer

sudo -u primer python3 -m venv /opt/primer/venv

# git clone goes here
# systemd service install goes here
# nginx config copy + enable
# certbot --nginx -d primer.yourdomain.com
# systemctl enable --now redis primer-backend nginx
```

## Environment variables

`.env` on server (never committed):

```
ANTHROPIC_API_KEY=sk-ant-...
EXA_API_KEY=...
REDIS_URL=redis://localhost:6379
DATABASE_PATH=/opt/primer/app/data/primer.db
ALLOWED_ORIGINS=https://primer.yourdomain.com
LOG_LEVEL=INFO
```

## Domain

Decide on a subdomain. Suggestions:
- `primer.yourdomain.com` (clean)
- `primer-.yourdomain.com` (explicit portfolio piece framing)
- Reuse existing Hetzner domain with a path prefix

Point DNS A record at the Hetzner IP. Wait 5-10 minutes for propagation. Then run certbot.

## Verification checklist

After deploy:
- [ ] `curl https://primer.yourdomain.com/api/accounts` returns JSON
- [ ] `curl -N https://primer.yourdomain.com/briefing/northstar_beauty` streams events
- [ ] Opening the URL in a browser renders the frontend
- [ ] Clicking Northstar Beauty triggers a brief generation end-to-end
- [ ] Redis is running: `redis-cli ping` returns PONG
- [ ] Systemd service is enabled: `systemctl status primer-backend`
- [ ] Logs are writing: `tail -f /opt/primer/logs/backend.log`
- [ ] SSL cert is valid: browser shows padlock, no warnings

## Cost estimate

- Hetzner CPX21: already paid for (Chariot uses it)
- Anthropic API: ~$0.10-0.30 per brief generation, cache reduces repeat cost
- Exa API: optional, skip for V1 (SQLite-backed external signals)
- Redis: free, in-process
- Total demo cost: $5-10 for the full portfolio piece evaluation window

## What's NOT in V1 deployment

- Load balancing — single instance is fine for demo
- Multi-region — one Hetzner VM
- Blue-green deployment — systemctl restart is fine
- Observability stack (Prometheus/Grafana) — tail the logs
- Database backups — it's seeded data, not user data; regenerate on deploy
- CDN — nginx serves the static files directly
