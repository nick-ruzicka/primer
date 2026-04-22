# exa-mcp

Read-only MCP server over the external-signals table.

V1 serves static, pre-seeded signals. In production this wraps a live Exa API
call with caching — the switch-over would be gated by `USE_LIVE_EXA=1` and add
outbound network calls. V1 is deterministic by design so the demo is
reproducible.

## Tools

| Tool | Returns |
| --- | --- |
| `search_account_signals` | All `external_signals` rows for the account (funding, exec changes, hiring, press, social posts, podcasts, competitive). Ordered newest first. |
| `get_decision_maker_signals` | `{ decision_maker, signals[] }`. Resolves the account's decision maker (or champion if no DM is tagged) and returns signals whose `title` or `snippet` substring-matches the DM's name. |

## Run

```bash
uv run python -m mcp_servers.exa_mcp.server
uv run python -m mcp_servers.exa_mcp.test
```
