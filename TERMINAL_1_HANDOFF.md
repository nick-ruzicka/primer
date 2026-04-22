# Terminal 1 → Terminal 2 handoff

Terminal 1 built the data layer and six MCP servers (`01_DATASET_SPEC.md`,
`02_MCP_SERVERS_SPEC.md`). This doc is Terminal 2's orientation — read it
before wiring the orchestrator.

## What's ready

- `data/schema.sql` — 9 tables, applies clean.
- `data/seed.sql` — 12 account rows (2 parent groups + 10 billable),
  30 contacts, 12 opportunities, 19 Gong calls, 33 external signals.
- `data/seed.py` — idempotent rebuild. Honors `DATABASE_PATH`.
- `pyproject.toml` + `uv.lock` + `.python-version` — shared Python 3.12
  environment across `backend/` and `mcp_servers/`. Add backend deps
  with `uv add fastapi uvicorn anthropic redis sse-starlette python-dotenv`
  (or whatever you need) to the same project.
- `mcp_servers/_db.py` — shared read-only SQLite helper.
- `mcp_servers/{salesforce,snowflake,catalyst,netsuite,gong,exa}_mcp/` —
  six stdio-transport servers, each with a `server.py`, `test.py`, and
  `README.md` documenting every tool and return shape.
- `mcp_servers/smoke_all.py` — sweep that invokes every tool on every
  billable account. Currently **194 calls, 0 errors**.

Relevant commits: `e126e48` (specs), `9d9e766` (data + shared helper),
`88d60ef` (salesforce-mcp reference impl), `57adfd1` (remaining five
servers + smoke sweep).

## Six integration-critical things

These are the things that will break the brief if Terminal 2 gets them wrong.

### 1. The stdio client invocation pattern

Every MCP server is launched the same way. Replicate this in the
orchestrator's client setup:

```python
from mcp import ClientSession
from mcp.client.stdio import StdioServerParameters, stdio_client

params = StdioServerParameters(
    command="uv",
    args=["run", "python", "-m", "mcp_servers.salesforce_mcp.server"],
)
async with stdio_client(params) as (read, write):
    async with ClientSession(read, write) as session:
        await session.initialize()
        result = await session.call_tool(
            "get_account", {"account_id": "northstar_beauty"}
        )
```

The orchestrator wants to open all six sessions once on startup and keep
them alive — don't re-spawn per request.

### 2. Tool-response unwrapping

Every tool returns a single `TextContent` with JSON. Always:

```python
payload = json.loads(result.content[0].text)
```

`result.content[0].text` can be the literal string `"null"` (for a tool
that has no data) — `json.loads("null")` returns Python `None`, which is
what we want. Don't special-case an empty string; the servers won't send
one.

### 3. Null-semantics are meaningful — don't normalize

The three "no data" shapes are different by design, and the agent's
reasoning depends on the distinction:

- `null` → no row exists for this account (e.g. `get_billing_status` for
  the Tidepool prospect). The agent should treat this as "source system
  doesn't cover this account."
- `[]` → the row exists but has no matching items (e.g.
  `get_competitor_mentions` for a healthy account). "We looked and there
  were none."
- `dict` with some null fields (e.g. `get_relationship_health` for
  Tidepool returns `{relationship_status: null, relationship_score: null,
  notes: "Prospect — no relationship history yet."}`) → "row exists but
  the data isn't populated yet."

Don't collapse these in the orchestrator. The brief language is different
for each case.

### 4. Money is in cents — everywhere

All money columns are `*_cents INTEGER`. `arr_cents`, `amount_cents`,
`current_balance_cents`, `past_due_balance_cents`, `last_invoice_amount_cents`.
Convert to dollars (divide by 100) only at the UI/brief presentation
layer. If the orchestrator treats a cents value as dollars, every money
figure in the brief is off by 100x.

### 5. Anchor date is 2026-04-22

All "N days out," "N days ago," and "recent" language in the seed is
computed from 2026-04-22. Examples:

- Northstar Beauty `contract_end=2026-08-17` → exactly 117 days out.
- Northstar Beauty `ap_blocked_date=2026-04-18` → 4 days ago.
- Kindred Pet `catalyst_health.status_since=2026-03-01` → ~52 days on
  At Risk.

If the agent uses `date.today()` for relative phrasing, it will agree
with the seed as long as you test around this date. If you need to test
against a different "today," pin it via the agent prompt rather than
re-seeding.

### 6. Smoke-sweep as a first-boot sanity check

Before the orchestrator wires real traffic, run:

```bash
uv run python -m mcp_servers.smoke_all
```

It invokes every tool × every billable account (plus parent groups on
hierarchical tools) and fails loudly if anything breaks. If you add new
tools or change shapes, extend it.

## What's intentionally weird (don't "fix" these)

- Beauty's **Salesforce renewal forecast is `Commit`** while Catalyst's
  `renewal_forecast` is `Best Case`, `netsuite.ap_blocked=true`,
  `past_due_balance_cents=1850000` (41 days overdue), and the Apr 11 QBR
  has `competitor_mentioned=true` + `pricing_pushback=true`. This is the
  validation-agent hero scenario. Don't reconcile it in seed or in the
  orchestrator — let the agent surface it.
- Kindred's billing is **clean** (`past_due_balance_cents=0`), but usage
  is collapsing (sends -41%, flows 4/12, health 48 from 81) and the new
  VP's LinkedIn post talks about consolidation. Different failure mode
  from Beauty.
- Tidepool has **no contract row and no billing row**. Catalyst/Snowflake
  rows exist with mostly NULL fields + a `notes` value. Prospects aren't
  customers yet.
- Parent groups (`northstar_group`, `quiver_group`) have account rows but
  no usage/health/billing/calls/signals. They only matter for hierarchy
  and portfolio tools.

## Rebuild commands

```bash
# install uv if needed
curl -LsSf https://astral.sh/uv/install.sh | sh

# from repo root
uv sync                              # install pinned deps into .venv
uv run python data/seed.py           # (re)build data/primer.db
uv run python -m mcp_servers.smoke_all
```

## Open items left for Terminal 2

- `USE_LIVE_EXA=1` gate for real Exa calls in `exa-mcp` — stub noted in
  its README. V1 serves seeded signals only.
- NetSuite `get_recent_invoices` returns ≤1 row because the seed only
  captures the latest invoice. Good enough for V1; if the brief quotes
  multi-invoice history, extend the schema.

Ping Terminal 1 if anything returns an unexpected shape.
