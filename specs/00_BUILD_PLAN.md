# Primer — Build Plan

A pre-call briefing system for enterprise AEs. Live backend with real MCP servers, streaming brief generation via Claude, wired to the existing Claude Design frontend.

**Repo name:** `primer-`
**Target:** working live demo deployed to Hetzner, portfolio piece-ready within 4-5 days.

---

## What we're building

A V1 production-grade implementation of the pre-call briefing product. Not a prototype, not an MVP with shortcuts — the actual thing you'd ship if you worked at .

### Core stack

- **Frontend:** existing Claude Design HTML (Briefing.html), modified to call the backend via SSE
- **Orchestrator:** Python + FastAPI, one SSE endpoint: `/briefing/{account_id}`
- **Agent:** Anthropic SDK, Claude with tool_use + streaming, second validation pass
- **Tools:** six real MCP servers (stdio transport), one per source system
- **Data:** SQLite for demo (Postgres in production writeup), seeded with 8-10 accounts
- **Cache:** Redis for brief cache and rate limiting
- **Deployment:** Hetzner CPX21, nginx reverse proxy, systemd services

### Performance targets

- Account Intelligence panel visible in < 2 seconds (parallel MCP queries only, no Claude)
- Brief starts streaming in 3-4 seconds
- Full brief rendered in 8-12 seconds
- Validation warnings appear last, ~2 seconds after brief completes

---

## Parallelization strategy — four Claude Code terminals

The build has four independent surfaces. Each terminal owns one surface. They don't step on each other because the integration points are defined upfront (the MCP tool interfaces, the SSE payload shape, the SQLite schema).

### Terminal 1 — Data & MCP servers

**Owns:** `/data`, `/mcp_servers/*`
**Reads from the spec:** `01_DATASET_SPEC.md`, `02_MCP_SERVERS_SPEC.md`
**Deliverables:**
1. SQLite schema + seed data for 8-10 accounts
2. Six MCP servers (salesforce, snowflake, catalyst, netsuite, gong, exa)
3. Each server exposes its tools, reads from the shared SQLite DB
4. Manual test harness: can run `python -m mcp_servers.salesforce_mcp` and hit tools

### Terminal 2 — Backend orchestrator + agent

**Owns:** `/backend`
**Reads from the spec:** `03_ORCHESTRATOR_SPEC.md`, `04_AGENT_SPEC.md`
**Deliverables:**
1. FastAPI app with `/briefing/{account_id}` SSE endpoint
2. MCP client that connects to all six servers on startup
3. Parallel tool-call fan-out on account selection
4. Claude agent with streaming brief generation
5. Validation agent as second pass
6. Brief caching in Redis

**Depends on:** Terminal 1's MCP tool contracts (defined in spec, stable from day 1)

### Terminal 3 — Frontend (Next.js + Tailwind, from scratch)

**Owns:** `/frontend`
**Reads from the spec:** `05_FRONTEND_SPEC.md`
**Deliverables:**
1. Next.js 15 + Tailwind v4 + TypeScript scaffold
2. Design tokens mapped from Claude Design export into `globals.css`
3. All components rebuilt as proper React components (LeftRail, Topbar, AccountHeader, ConfidenceStrip, Brief, IntelligencePanel, TweaksPanel, Writeup)
4. `store.ts` + `sse.ts` for state management and SSE consumption
5. End-to-end wiring: `/api/accounts` fetch on load, SSE stream on account select
6. Streaming brief with citation chips, progressive intelligence population
7. Mode switching (Reading / Prep / Split / Writeup) with keyboard shortcuts
8. Validation warning rendering
9. Dark/light theme toggle via Tweaks panel

**Reference artifact:** the Claude Design HTML export is the *visual target*. Do not reuse its code. Match it pixel-for-pixel in a proper Next.js app.

**Time budget:** ~4 days of 30-min focused sessions, or 2-4 hours concentrated

**Depends on:** Terminal 2's SSE payload shape and `/api/accounts` response (both defined in specs from day one)

### Terminal 4 — Infra, deployment, writeup integration

**Owns:** `/scripts`, `/deploy`, repo-level config, writeup-as-Mode-4
**Reads from the spec:** `06_DEPLOYMENT_SPEC.md`, `07_WRITEUP_INTEGRATION_SPEC.md`
**Deliverables:**
1. Deploy script (Hetzner, nginx, systemd)
2. `.env` management, API key handling
3. README with architecture diagram and setup instructions
4. Writeup embedded as Mode 4 in the frontend
5. Final Loom fallback recording script

**Depends on:** nothing at start (infra work), Terminal 3 at end (writeup integration)

### Suggested run order

- **Day 1:** Terminals 1 + 2 start simultaneously. Terminal 3 drafts the SSE consumer shell. Terminal 4 sets up infra scaffolding.
- **Day 2:** Terminal 1 finishes; Terminal 2 consumes real MCP servers; Terminal 3 wires to real backend.
- **Day 3:** All four converge. Deployment. QA pass on every account.
- **Day 4:** Writeup finalization, Mode 4 integration, Loom recording.
- **Day 5:** Buffer / polish / submit.

---

## Integration contracts (the interfaces that don't change)

These are locked day one. Every terminal agrees to these shapes.

### MCP tool interface

Every MCP server exposes tools that take `account_id` (string) and return JSON matching its schema in `02_MCP_SERVERS_SPEC.md`. Tools are read-only. No tool takes filters beyond the account_id for V1.

### SSE payload shape

The `/briefing/{account_id}` SSE stream emits these event types:

```
event: intelligence
data: { "section": "relationship", "items": [...] }

event: brief_chunk
data: { "delta": "...token..." }

event: source_cited
data: { "citation_number": 4, "source": "catalyst", "time_ago": "5m" }

event: validation_warning
data: { "severity": "watch", "message": "Forecast conflicts with..." }

event: done
data: { "total_tokens": 1847, "duration_ms": 8234 }
```

### SQLite schema

Defined in `01_DATASET_SPEC.md`. Every MCP server reads from the same DB file. No writes from MCP servers — the DB is seeded once and read-only at runtime.

### Environment variables

```
ANTHROPIC_API_KEY=
EXA_API_KEY=
REDIS_URL=redis://localhost:6379
DATABASE_PATH=/data/primer.db
ALLOWED_ORIGINS=http://localhost:3000,https://primer.yourdomain.com
```

---

## Definition of done

- [ ] All 8-10 accounts have full deterministic data in SQLite
- [ ] Each account generates a distinct, grounded brief when selected
- [ ] Parallel MCP queries complete in < 2 seconds
- [ ] Brief starts streaming in < 4 seconds
- [ ] Validation agent flags contradictions (tested against Northstar Beauty forecast conflict)
- [ ] Frontend renders streamed brief with inline source citations
- [ ] Account switching works cleanly mid-stream
- [ ] Three display modes (Reading, Prep, Split) all functional
- [ ] Writeup embedded as Mode 4
- [ ] Deployed to Hetzner with HTTPS
- [ ] README covers architecture, setup, and "how I'd extend this"
- [ ] Loom fallback recording exists in case live demo fails
