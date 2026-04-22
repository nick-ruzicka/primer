# snowflake-mcp

Read-only MCP server over the product-usage surface in the Primer seed DB.

## Tools

| Tool | Returns |
| --- | --- |
| `get_usage_metrics` | Usage for one account: `sends_30d`, `sends_prior_30d`, `sends_trend_pct` (computed), `flows_active`/`flows_provisioned`/`flows_paused_this_period`, `health_score` + `health_score_prior` + `health_delta` (computed), `adoption_score`, `adoption_group_avg`, `last_send_date`. |
| `get_portfolio_comparison` | `{ queried_account_id, parent_account_id, self, siblings[], note? }`. For a child, compares self to siblings under the same parent. For a parent group, returns children. For a standalone account, returns self only with a `note` explaining there's no portfolio. |

## Run

```bash
uv run python -m mcp_servers.snowflake_mcp.server
uv run python -m mcp_servers.snowflake_mcp.test
```
