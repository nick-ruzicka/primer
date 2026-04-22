# gong-mcp

Read-only MCP server over the Gong-shaped call summaries.

Pipe-delimited fields (`followups`, `risks_mentioned`) are parsed into JSON
arrays before the response leaves the server.

## Tools

| Tool | Returns |
| --- | --- |
| `get_recent_calls` | Up to 5 most-recent calls (newest first) with `summary`, `sentiment`, `followups[]`, `risks_mentioned[]`, `competitor_mentioned`, `pricing_pushback`. |
| `get_competitor_mentions` | Only calls where `competitor_mentioned=true`, newest first — includes `competitor_name` and `competitor_mention_count`. |
| `get_pricing_signals` | Only calls where `pricing_pushback=true`, newest first. |

## Run

```bash
uv run python -m mcp_servers.gong_mcp.server
uv run python -m mcp_servers.gong_mcp.test
```
