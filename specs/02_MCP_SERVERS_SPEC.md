# 02 — MCP Servers Spec

Six real MCP servers, Python, stdio transport. Each wraps one source system and reads from the shared SQLite DB.

## Common shape

Every server:
- Lives in `mcp_servers/{system}_mcp/`
- Has a `server.py` entrypoint that registers tools via the MCP Python SDK
- Reads from `DATABASE_PATH` env var (`data/primer.db`)
- Returns JSON-serializable dicts
- Never writes
- Has a `README.md` with the tool list and example outputs

All tools accept `account_id: str` as their only argument for V1. Future versions can add filters; we're not building that yet.

Use the official `mcp` Python SDK:

```bash
pip install mcp
```

Minimal server template:

```python
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent
import sqlite3, json, os

app = Server("salesforce-mcp")

DB_PATH = os.getenv("DATABASE_PATH", "data/primer.db")

def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

@app.list_tools()
async def list_tools() -> list[Tool]:
    return [
        Tool(
            name="get_account",
            description="Returns core account record from Salesforce by account_id.",
            inputSchema={
                "type": "object",
                "properties": {"account_id": {"type": "string"}},
                "required": ["account_id"],
            },
        ),
        # ... more tools
    ]

@app.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    if name == "get_account":
        row = db().execute(
            "SELECT * FROM accounts WHERE account_id = ?",
            (arguments["account_id"],)
        ).fetchone()
        return [TextContent(type="text", text=json.dumps(dict(row)) if row else "null")]
    raise ValueError(f"Unknown tool: {name}")

if __name__ == "__main__":
    import asyncio
    asyncio.run(stdio_server(app))
```

## 1. salesforce-mcp

**Tools:**
- `get_account(account_id)` — account record (name, parent, industry, ARR, etc.)
- `get_contract(account_id)` — current plan, contract dates, auto-renew, seats
- `get_contacts(account_id)` — decision makers, exec sponsor, champions (all contacts for the account)
- `get_open_opportunities(account_id)` — open opps with stage, amount, forecast category
- `get_recent_closed_opportunities(account_id)` — closed won/lost in last 180 days
- `get_account_hierarchy(account_id)` — parent account + all sibling accounts with their ARR and stage (for portfolio context)

The hierarchy tool is the money move — returns the Northstar Group parent + Beauty/Active/Home siblings in one call when you query any of them.

## 2. snowflake-mcp

**Tools:**
- `get_usage_metrics(account_id)` — sends, flows, adoption, health — with trend data (30d vs prior 30d)
- `get_portfolio_comparison(account_id)` — this account's usage vs. parent-account siblings (only returns meaningful data if parent exists)

Portfolio comparison is how the brief says "Beauty lags Active and Home on adoption." One tool call, compare everything.

## 3. catalyst-mcp

**Tools:**
- `get_relationship_health(account_id)` — Catalyst status (Healthy/Watchlist/At Risk/Cold), relationship score, trend
- `get_renewal_forecast(account_id)` — Catalyst's forecast (may differ from Salesforce's forecast intentionally)
- `get_expansion_readiness(account_id)` — readiness tier + notes

Keeping forecast separated from Salesforce's forecast is important — the validation agent reads both and flags when they disagree.

## 4. netsuite-mcp

**Tools:**
- `get_billing_status(account_id)` — current balance, past-due balance, days overdue
- `get_ap_policy_flags(account_id)` — AP blocked yes/no, when, why
- `get_recent_invoices(account_id, limit=5)` — recent invoice history

AP policy flags tool is what gives the agent the signal to say "Finance marked this account as blocked for further invoicing pending resolution."

## 5. gong-mcp

**Tools:**
- `get_recent_calls(account_id, limit=5)` — recent call summaries with sentiment, risks, follow-ups
- `get_competitor_mentions(account_id)` — only calls where a competitor was named, with the competitor name and mention count
- `get_pricing_signals(account_id)` — calls where pricing pushback was detected

Splitting competitor mentions and pricing signals into their own tools lets the agent query them directly when it's reasoning about risk rather than always pulling full call summaries.

## 6. exa-mcp

**Tools:**
- `search_account_signals(account_id)` — returns the external_signals rows for this account (funding, exec changes, hiring, press, social posts)
- `get_decision_maker_signals(account_id)` — subset focused on the account's decision maker (their LinkedIn posts, podcast mentions, tenure inference)

In V1 this reads from the `external_signals` SQLite table (which is seeded with realistic-looking data). The writeup says: "In production, this is a live Exa API call with caching."

If we have time at the end, we can add a real Exa API call path gated by an env var `USE_LIVE_EXA=1`. For V1 demo, static data is fine and deterministic.

## Testing each server

Each server gets a small CLI smoke test at `mcp_servers/{system}_mcp/test.py`:

```python
import asyncio, json
from mcp.client.stdio import stdio_client, StdioServerParameters

async def main():
    async with stdio_client(StdioServerParameters(
        command="python", args=["-m", "mcp_servers.salesforce_mcp.server"]
    )) as (read, write):
        # list tools
        # call get_account with 'northstar_beauty'
        # print result
        pass

asyncio.run(main())
```

## What's deliberately NOT included in V1

- Write operations (no tool mutates state)
- Filters beyond account_id (no "get_calls_since_date")
- Auth (all servers read the same DB, no per-server credentials)
- Multi-account queries (no "get_all_watchlist_accounts" — that's a portfolio feature for V2)
- Live API calls (Exa is stubbed; everything else is SQLite-only)
