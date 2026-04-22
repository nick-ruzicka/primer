# catalyst-mcp

Read-only MCP server over the Catalyst-shaped relationship-health table.

Keeping `renewal_forecast` separate from Salesforce's `forecast_category` is
deliberate — when Catalyst says "Best Case" and Salesforce says "Commit", the
validation agent is meant to flag the mismatch.

## Tools

| Tool | Returns |
| --- | --- |
| `get_relationship_health` | `relationship_status`, `status_since`, `relationship_score` + prior + delta, `last_executive_touch`, `notes`. |
| `get_renewal_forecast` | `renewal_forecast` (Commit / Best Case / Pipeline / At Risk) + `notes`. |
| `get_expansion_readiness` | `expansion_readiness` (High / Medium / Low / None) + `notes`. |

## Run

```bash
uv run python -m mcp_servers.catalyst_mcp.server
uv run python -m mcp_servers.catalyst_mcp.test
```
