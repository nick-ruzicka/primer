# salesforce-mcp

Read-only MCP server over the Salesforce-shaped tables in the Primer seed DB.
All tools take a single `account_id: string` argument.

## Tools

| Tool | Returns |
| --- | --- |
| `get_account` | Core account record (name, parent, industry, segment, ARR, stage, state, owner). |
| `get_contract` | Current contract: plan, start/end, auto-renew, seats used/licensed. |
| `get_contacts` | All contacts for the account, ordered Decision Maker → Champion → Executive Sponsor → Influencer → Blocker. |
| `get_open_opportunities` | Open opps with stage, amount (cents), forecast category, close date. Ordered by close date. |
| `get_recent_closed_opportunities` | Closed-won + closed-lost opps whose `close_date` is within the last 180 days. Most recent first. |
| `get_account_hierarchy` | `{ queried_account_id, parent, siblings }`. For a child account returns its parent and sibling summaries. For a parent account queried directly, returns `parent=null` and all its children as `siblings`. For a standalone account, both are empty/null. |

## Run directly

```bash
uv run python -m mcp_servers.salesforce_mcp.server
```

The server speaks MCP over stdio; pair with a client (backend orchestrator or the smoke test below).

## Smoke test

```bash
uv run python -m mcp_servers.salesforce_mcp.test
```

Lists tools, calls every one against `northstar_beauty`, prints trimmed previews, exits non-zero on failure.

## Example output

### `get_account("northstar_beauty")`

```json
{
  "account_id": "northstar_beauty",
  "account_name": "Northstar Beauty",
  "parent_account_id": "northstar_group",
  "arr_cents": 94000000,
  "stage": "Renewal",
  "state": "hot",
  "owner_name": "Morgan Yu"
}
```

### `get_account_hierarchy("northstar_beauty")` (excerpt)

```json
{
  "queried_account_id": "northstar_beauty",
  "parent": { "account_id": "northstar_group", "account_name": "Northstar Group", ... },
  "siblings": [
    { "account_id": "northstar_active", "arr_cents": 145000000, "stage": "Expansion" },
    { "account_id": "northstar_home",   "arr_cents": 68000000,  "stage": "Just live" }
  ]
}
```
