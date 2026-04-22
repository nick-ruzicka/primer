# Architecture

End-to-end walkthrough of how Primer serves a single brief, where the
boundaries live, and how it scales past V1. This is the deeper-read
companion to the root README and the in-product Mode 4 writeup.

---

## Component map

```
┌───────────────────────────────────────────────────────────────────┐
│                           Hetzner CPX21                           │
│                                                                   │
│  ┌──────────┐    :80/:443     ┌──────────────────────────────┐    │
│  │  nginx   │ ◀─────────────▶ │                              │    │
│  └─────┬────┘                 │   /          → :3000 (Next)  │    │
│        │                      │   /api/*     → :8000 (FastAPI)│    │
│        │                      │   /briefing/*→ :8000 (SSE)    │    │
│        │                      │                               │    │
│   ┌────▼──────┐   ┌───────────┴─────────────┐                 │    │
│   │  Next.js  │   │       FastAPI           │                 │    │
│   │  :3000    │   │       :8000             │                 │    │
│   └───────────┘   │  ┌───────────────────┐  │                 │    │
│                   │  │ /briefing SSE     │  │                 │    │
│                   │  │ /api/accounts     │  │                 │    │
│                   │  └──────┬────────────┘  │                 │    │
│                   │         │ stdio         │                 │    │
│                   │  ┌──────▼─────────────┐ │                 │    │
│                   │  │ MCPPool            │ │                 │    │
│                   │  │  sfdc snowflake    │ │                 │    │
│                   │  │  catalyst netsuite │ │                 │    │
│                   │  │  gong exa          │ │                 │    │
│                   │  └──────┬─────────────┘ │                 │    │
│                   │         │               │                 │    │
│                   │   ┌─────▼───────────┐   │                 │    │
│                   │   │  SQLite         │   │                 │    │
│                   │   │  primer.db      │   │                 │    │
│                   │   └─────────────────┘   │                 │    │
│                   │                         │                 │    │
│                   │   ┌─────────────────┐   │                 │    │
│                   │   │  Redis          │   │                 │    │
│                   │   │  brief cache +  │   │                 │    │
│                   │   │  rate limit     │   │                 │    │
│                   │   └─────────────────┘   │                 │    │
│                   └─────────────────────────┘                 │    │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
                               │
                               │ HTTPS
                               ▼
                   ┌───────────────────────┐
                   │  api.anthropic.com    │
                   │  Claude (stream +     │
                   │  tool_use + validation)│
                   └───────────────────────┘
```

All services run on a single Hetzner CPX21 in one box. Frontend and backend
are separate systemd units (`primer-frontend.service`, `primer-backend.service`)
so either can be restarted without taking the other down. nginx fronts both
and is the only thing exposed on 80/443.

MCP servers are **not separate systemd units**. The backend process spawns
them as stdio subprocesses and holds the pipes open. Simpler lifecycle,
tied to the backend, kills cleanly when the backend restarts.

---

## Request lifecycle — a single `/briefing/{account_id}` call

This is the hottest path in the product. Understanding what happens during
it is understanding the architecture.

```
  t=0ms   Browser: user clicks "Northstar Beauty" in left rail
           │
           ▼
  t=5ms   Browser: opens SSE connection to /briefing/northstar_beauty
           │
           ▼
  t=50ms  nginx: proxies to 127.0.0.1:8000 with
           proxy_buffering off (SSE-critical)
           │
           ▼
  t=60ms  FastAPI: accept() + check Redis
           │   ├─ cache hit? → replay events from cache, emit slower than
           │   │               raw fetch so the streaming illusion holds,
           │   │               ~2s total, no Claude calls
           │   │
           │   └─ cache miss ▼
  t=100ms FastAPI: asyncio.gather over six MCP tool calls
           │   ├─ salesforce_mcp  (stdio)  → get_account + 5 more
           │   ├─ snowflake_mcp   (stdio)  → usage + portfolio
           │   ├─ catalyst_mcp    (stdio)  → health + renewal + readiness
           │   ├─ netsuite_mcp    (stdio)  → billing + invoices
           │   ├─ gong_mcp        (stdio)  → recent calls + signals
           │   └─ exa_mcp         (stdio)  → web signals
           │   (each wrapped in 5s timeout; individual failure ≠ brief failure)
           │
           ▼
  t=1200ms FastAPI: emit `intelligence` events per source as each returns.
           Browser: Account Intelligence panel populates live.
           │
           ▼
  t=1800ms FastAPI: bundle tool outputs into a structured context blob.
           │
           ▼
  t=2000ms FastAPI → Anthropic: Claude streaming call with
             - context blob
             - tool schemas for follow-up queries
             - system prompt: "write a three-paragraph briefing…"
             - structured output schema (brief + citations)
           │
           ▼
  t=3500ms Claude: first tokens arrive.
           FastAPI: emits `brief_chunk` events as tokens stream.
           Browser: brief composes in real time.
           On detecting "·N" citation markers, FastAPI also emits
           `source_cited` events with the source metadata.
           │
           ▼
  t=9000ms Claude: stream complete.
           │
           ▼
  t=9200ms FastAPI → Anthropic: second call, Haiku this time.
             - input: generated brief + raw tool outputs
             - system prompt: "flag contradictions between brief claims
               and source-of-record data"
           │
           ▼
  t=10500ms FastAPI: emits `validation_warning` events for each flag.
            Browser: amber banner renders at the end of the brief.
           │
           ▼
  t=10800ms FastAPI: writes full transcript (intelligence + brief + warnings)
            to Redis at `brief:northstar_beauty`, TTL 900s.
           │
           ▼
  t=10900ms FastAPI: emits `done` event with timing metadata.
            Connection closes.
```

**Performance envelope** (per specs/00_BUILD_PLAN.md):
- Account Intelligence panel visible in < 2 s
- Brief starts streaming in 3–4 s
- Full brief rendered in 8–12 s
- Validation warnings ~2 s after brief completes

---

## Data flow

The SQLite `primer.db` is the seeded fixture for everything the MCP servers
return. It is **read-only at runtime**. Only `data/seed.py` writes to it, and
only at deploy time (or locally on first run).

```
data/seed.py         writes once
       │
       ▼
data/primer.db  ◀──  all six MCP servers read (SELECT only)
                     │
                     ▼
                FastAPI orchestrator receives JSON blobs
                     │
                     ▼
                Claude gets a structured context,
                  emits a structured brief
                     │
                     ▼
                Redis caches the transcript, 15-min TTL
                     │
                     ▼
                Browser renders
```

The "MCP wraps a real source system" shape is what matters — in production
each MCP server hits its real backend (Salesforce REST, Snowflake SQL,
Catalyst API, NetSuite SuiteTalk, Gong API, Exa search). For V1 they all
read from one SQLite DB so the demo is deterministic and self-contained.

---

## Scaling considerations (past V1)

**Per-box capacity.** A single CPX21 is sized for demo traffic. The cost
ceiling on this box is the Anthropic call, not CPU. One brief generation
is ~$0.10–$0.30 on Opus, ~$0.01–$0.03 on Haiku (validation).

**Scaling the read layer.** The MCP servers are stateless and stdio-scoped
to the backend process. If we outgrow one box:
- Split the backend onto its own VM; keep nginx + frontend co-located.
- Run multiple backend replicas behind nginx, sticky by account_id so the
  Redis cache is warm per replica.
- Replace SQLite with a pooled Postgres — schema stays intact.

**Scaling the write layer.** We don't have one. When RevTech ships their
unified data layer, MCP servers repoint from local SQLite to that layer.
Nothing above the MCP boundary changes.

**Claude call concurrency.** The Anthropic client streams, so the
orchestrator isn't CPU-bound on Claude calls — it's bound by the tool-call
fan-out (~1.2 s worst case) and then the Claude round-trip (~7 s). On
CPX21 we can comfortably keep ~20 concurrent streams open.

**Rate limiting.** Redis holds per-IP counters at 20 briefs/hour to keep
the demo survivable during evaluation. Production would move this to a
token-bucket per rep + global caps.

---

## What RevTech integration looks like

The key piece of the architecture story: the six MCP servers are the
seam. Right now each one wraps a source system directly. When
Attentive's internal RevTech team ships a unified data layer, the
adapter set collapses.

```
  Today                           After RevTech ships
  ─────                           ──────────────────

  SFDC ──▶ sfdc_mcp ─┐            SFDC ──┐
  Snow ──▶ snow_mcp ─┤            Snow ──┤
  Cat  ──▶ cat_mcp  ─┤            Cat  ──┼──▶ RevTech ──▶ unified_mcp ──▶ Primer
  NS   ──▶ ns_mcp   ─┼─▶ Primer   NS   ──┤      layer
  Gong ──▶ gong_mcp ─┤            Gong ──┤
  Exa  ──▶ exa_mcp  ─┘            Exa  ──┘
```

From Primer's perspective this is a pure simplification — six adapters to
one. No change to the agent, the validation pass, the UI, or the cache.
That's the payoff of being a read layer that never wrote.

---

## Observability

Minimal on purpose — this is a takehome, not a production system.

- **Structured logs** from both services to `/opt/primer/logs/`. JSON lines
  preferred for the backend; Next.js uses its default stdout format.
- **Log rotation** via systemd's `journal` for service-level rotation and
  logrotate for file-level (not yet configured; easy to add).
- **No metrics / Prometheus.** `journalctl -u primer-backend -f` and
  `tail -f /opt/primer/logs/backend.log` are enough for an evaluation
  window.
- **No distributed tracing.** The whole request is in-process + one Anthropic
  call; there's nothing to trace across boundaries.

---

## Deploy shape

See `specs/06_DEPLOYMENT_SPEC.md` for the spec and `scripts/deploy.sh`
for the live script. Short version:

1. `deploy/setup_server.sh` — one-time, on a fresh CPX21 as root.
   Installs packages, creates the `primer` user, clones the repo, seeds
   the DB, builds the frontend, installs the two systemd units, templates
   nginx, enables ufw.
2. `scripts/deploy.sh` — every subsequent push. SSH, git fetch, git reset,
   uv sync, reseed, npm ci + next build, reinstall systemd units, restart,
   reload nginx.
3. `certbot --nginx -d primer.<domain>` — one-time after DNS points at
   the box. Renewals happen automatically via the installed systemd timer.

The Chariot Signal Engine uses the same deploy shape. That's on purpose —
one pattern to learn, one place to break.
