# 03 — Orchestrator Spec

The FastAPI backend. One endpoint, streaming response, parallel MCP fan-out, agent orchestration.

## Location

`backend/main.py`, `backend/agent.py`, `backend/mcp_client.py`

## Endpoint

```
GET /briefing/{account_id}
```

Returns a Server-Sent Events stream. The event types are defined in `00_BUILD_PLAN.md`.

## Flow

1. **Request arrives** with `account_id` (e.g., `northstar_beauty`).
2. **Cache check** — if `brief:{account_id}` exists in Redis and is < 15 min old, stream the cached version event-by-event to match live feel (no "instant full response" — that breaks the streaming illusion). Still takes ~2 sec to replay but no Claude calls.
3. **Fan-out** — connect to all six MCP servers in parallel, call their primary tools for this account:
   - Salesforce: `get_account`, `get_contract`, `get_contacts`, `get_open_opportunities`, `get_recent_closed_opportunities`, `get_account_hierarchy`
   - Snowflake: `get_usage_metrics`, `get_portfolio_comparison` (if parent exists)
   - Catalyst: `get_relationship_health`, `get_renewal_forecast`, `get_expansion_readiness`
   - NetSuite: `get_billing_status`, `get_ap_policy_flags`, `get_recent_invoices`
   - Gong: `get_recent_calls`, `get_competitor_mentions`, `get_pricing_signals`
   - Exa: `search_account_signals`, `get_decision_maker_signals`
4. **Emit `intelligence` events** as each source returns — this populates the Account Intelligence panel while the brief is still generating.
5. **Bundle results** into a structured context blob.
6. **Call Claude** with tool_use + streaming + the context. The agent has access to the MCP tools in case it needs follow-up queries, but the pre-fetch covers ~95% of cases.
7. **Stream brief tokens** as `brief_chunk` events.
8. **Emit `source_cited` events** whenever the streamed text contains a citation marker (detect `·N` pattern in output).
9. **Validation pass** — after brief generation completes, kick off a second Claude call with the generated brief + raw tool outputs as input. Model: Haiku (faster, cheaper, sufficient for constraint checking). System prompt: "Flag contradictions between claims in the brief and source-of-record data."
10. **Emit `validation_warning` events** for each flag.
11. **Cache the full transcript** (intelligence + brief + warnings) in Redis keyed by account_id, TTL 15 min.
12. **Emit `done` event** with timing metadata.

## Parallel fan-out implementation

Use `asyncio.gather` to run all six MCP tool calls concurrently. Wrap each in a timeout (5 seconds per tool, fail individually rather than blocking the whole briefing).

```python
async def fetch_intelligence(account_id: str):
    tasks = {
        "salesforce": fetch_salesforce(account_id),
        "snowflake": fetch_snowflake(account_id),
        "catalyst": fetch_catalyst(account_id),
        "netsuite": fetch_netsuite(account_id),
        "gong": fetch_gong(account_id),
        "exa": fetch_exa(account_id),
    }
    results = {}
    for name, task in tasks.items():
        try:
            results[name] = await asyncio.wait_for(task, timeout=5.0)
        except asyncio.TimeoutError:
            results[name] = {"_error": "timeout", "_source": name}
    return results
```

Each `fetch_*` function is a sequence of MCP tool calls to that server's tools, grouped into a single dict.

## MCP client setup

`backend/mcp_client.py` manages stdio connections to all six servers. One connection per server, persisted for the life of the backend process (don't reconnect per request).

```python
class MCPPool:
    def __init__(self):
        self.clients = {}  # name -> (read, write) streams

    async def connect_all(self):
        # start each server subprocess, open stdio_client
        ...

    async def call(self, server: str, tool: str, arguments: dict):
        # dispatch to the right stdio connection
        ...
```

On FastAPI startup, instantiate and connect. On shutdown, cleanly close all.

## Redis caching

Two cache patterns:

1. **Brief cache** — `brief:{account_id}` → full JSON transcript (all events), TTL 900 (15 min). On hit, replay events at 50ms intervals to preserve streaming feel.
2. **Rate limit** — `ratelimit:{ip}` — max 20 briefings per hour per IP. Prevents abuse if demo link gets shared.

Refresh button on the frontend sends `?refresh=1` which bypasses brief cache.

## Environment config

```
ANTHROPIC_API_KEY=sk-...
EXA_API_KEY=...
REDIS_URL=redis://localhost:6379
DATABASE_PATH=/opt/primer/data/primer.db
ALLOWED_ORIGINS=https://primer.yourdomain.com,http://localhost:3000
LOG_LEVEL=INFO
```

## What's deliberately NOT in V1

- Auth — this is a demo, single-tenant, public read access (rate-limited)
- Multi-account briefings — one account at a time
- Scheduled/background brief generation — on-demand only
- Webhook notifications — no pub/sub
- Cost tracking — just log token counts in the `done` event; don't build a dashboard

## Observability

Log every tool call with account_id, tool name, duration, success/failure. Structured JSON logs. In the writeup, describe how this becomes the Pattern Analyst data source in V2.
