# Primer Backend

FastAPI + Anthropic SDK + six long-lived MCP subprocesses + Redis. One SSE
endpoint generates a pre-call briefing from live "source system" tools and
streams intelligence → tokens → source citations → validation warnings back
to the browser.

## Layout

```
backend/
├── main.py             FastAPI app, lifespan wiring, SSE endpoint
├── mcp_client.py       MCPPool — persistent stdio sessions, per-server locks
├── intelligence.py     Parallel fan-out across 6 MCP servers + section shaping
├── agent.py            Context-blob builder, streaming briefing agent,
│                       Haiku validation pass, citation emitter
├── accounts.py         SQLite-backed /api/accounts (grouped + standalone)
├── cache.py            Redis wrapper — brief cache + per-IP rate limit
├── config.py           Settings from .env (Anthropic, Redis, models, anchor date)
├── logging_setup.py    Structured JSON logs, one event per line
├── prompts/
│   ├── briefing.md     Opus-tier system prompt, with {today} placeholder
│   └── validation.md   Haiku-tier validation system prompt
├── VERIFICATION_LOG.md  Phase-by-phase smoke results
└── sweep_output/       Per-account brief + metrics from `scripts/sweep_briefings.py`
```

## Running it

Install deps (from repo root):

```bash
uv sync
```

Seed the SQLite demo DB if it's missing:

```bash
uv run python data/seed.py
uv run python -m mcp_servers.smoke_all    # sanity check: 194 calls, 0 errors
```

Fill out `.env` (copy from `.env.example`). You need **one of**:

- `ANTHROPIC_API_KEY=sk-ant-api03-...` (standard console key), or
- `ANTHROPIC_AUTH_TOKEN=sk-ant-oat01-...` (Claude Code OAuth token)

OAuth mode auto-adds the `anthropic-beta: oauth-2025-04-20` header and
prepends the Claude Code system preamble.

Boot the server:

```bash
uv run uvicorn backend.main:app --reload --port 8000
```

On startup you'll see six `mcp_pool.connected` log lines. `/health` returns
`{"status":"ok","mcp_servers":[6],"cache_available":true}` when everything
is up.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | liveness + subsystem flags |
| GET | `/api/accounts` | left-rail payload (`groups[]` + `standalone[]`) |
| GET | `/briefing/{account_id}` | **SSE briefing stream** — see event types below |
| GET | `/briefing/{account_id}?refresh=1` | same, bypassing the 15-minute cache |
| GET | `/debug/mcp-smoke` | one tool call per server, returns the shapes |
| GET | `/debug/intelligence/{id}` | raw fan-out bundle + shaped sections, no agent |
| GET | `/debug/context/{id}` | the context blob + FactBook that would go to Claude |

### SSE event types

```
event: intelligence
data: { "section": "relationship" | "commercial" | "product_usage" |
        "conversations" | "portfolio" | "external",
        "items": [ { "label", "value", "sublabel"?, "tone"?, "source" } ] }

event: brief_chunk
data: { "delta": "...tokens..." }

event: source_cited
data: { "citation_number": N, "source": "salesforce|snowflake|catalyst|netsuite|gong|web",
        "fact": "...raw fact text...", "time_ago": "41d ago" | null }

event: validation_warning
data: { "severity": "watch" | "critical",
        "type": "source_contradiction" | "unsupported_claim" | "stale_data" | "missing_ground",
        "message": "...", "brief_excerpt": "...", "sources": ["..."] }

event: done
data: { "total_tokens": N, "duration_ms": N }
```

Events arrive in this order: the six `intelligence` sections fan out first
(~50 ms), then `brief_chunk` + interleaved `source_cited` events stream
while Opus/Sonnet is generating, then 1–N `validation_warning` events from
Haiku, then `done`.

## MCP pool lifecycle

`MCPPool.connect_all()` runs once inside FastAPI's lifespan. It uses a single
`AsyncExitStack` so startup is one atomic operation and shutdown closes every
stdio subprocess even on exception paths. Each server keeps a dedicated
`asyncio.Lock` — cross-server calls run fully parallel, same-server calls
serialize so the stdio pipe stays ordered.

A tool call goes:

```
MCPPool.call("salesforce", "get_account", {"account_id": "..."})
  → session.call_tool(...)
  → result.content[0].text      # always a JSON string
  → json.loads(...)              # "null" → None (prospect semantics)
```

Null-semantics are preserved: `null`, `[]`, and `dict-with-null-fields`
mean three different things in the seed (no row / no matching rows /
row exists but unpopulated) and the context blob reflects that
distinction.

## Briefing agent — what actually happens

1. **Fan-out** — `fetch_intelligence()` runs all six `fetch_*` coroutines
   under `asyncio.gather`. Each server's tools run in parallel within that
   server too. Per-tool 5 s timeout means one slow source can't wedge the
   brief.
2. **Shape sections** — `intelligence.shape_sections()` maps the raw dicts
   into the six panel sections the frontend renders.
3. **Emit `intelligence` events** — one per section, ~20 ms apart so the
   frontend panel can animate cards in.
4. **Build the context blob + FactBook** — `agent.build_context_blob()`
   walks the bundle and allocates monotonic `fact_id`s. Every fact the
   agent is allowed to cite has exactly one id, one source, and one
   timestamp (where available).
5. **Stream Opus/Sonnet** — system prompt loaded from
   `prompts/briefing.md`, `{today}` replaced with `ANCHOR_DATE`
   (default `2026-04-22`). Each text delta becomes a `brief_chunk`.
6. **Detect citations** — a running regex over the accumulated text
   catches `·N` markers. Each new, complete marker maps to its fact and
   emits a `source_cited` event with the fact text + source. Digits that
   might still be extending are deferred to the next chunk.
7. **Validate with Haiku** — `validate_brief()` posts the finished
   markdown + raw context blob to Haiku 4.5. It parses the JSON array
   defensively (strips code fences, finds first `[...]`).
8. **Cache the transcript** — the full event list goes into Redis at
   `brief:{account_id}` with a 900 s TTL. Subsequent unrefreshed hits
   replay at 40 ms intervals to preserve the streaming feel.

## Debugging tips

- **"Brief generation failed: credit balance too low"** — you're on an API
  key with no credits. Either top it up or switch to `ANTHROPIC_AUTH_TOKEN`.
- **Rate-limit errors during development** — Sonnet/Opus quotas tighten
  when the same OAuth account is doing interactive work elsewhere. The
  agent retries with exponential backoff (4 attempts, 1.5^n seconds).
  If it still fails, wait a minute or switch to `BRIEFING_MODEL=claude-haiku-4-5-20251001`
  for a cheaper test brief.
- **No `source_cited` events** — inspect the raw brief at
  `GET /debug/context/{id}`. If fact_ids aren't present, the agent had
  nothing to cite. If fact_ids are present but citations don't fire, the
  model likely used a different bullet glyph — the regex expects `·`
  (U+00B7). Add to the system prompt if a new model variant uses a
  different character.
- **MCP server not starting** — run
  `uv run python -m mcp_servers.smoke_all` directly. If it fails, the
  backend won't finish startup either.
- **Cache returning stale briefs** — `redis-cli DEL brief:{account_id}` or
  just pass `?refresh=1`. Redis TTL is 15 minutes.
- **CORS errors in the browser** — add your frontend origin to
  `ALLOWED_ORIGINS` in `.env` (comma-separated).

## Environment reference

See `../.env.example` — every variable the backend reads is listed there
with defaults.

## Tests

Phase smoke tests live in `backend/tests/`. Run with:

```bash
uv run pytest backend/tests -v
```

The smoke tests are not unit tests — they prove the end-to-end flow works
against the real Anthropic API and the real MCP pool.
