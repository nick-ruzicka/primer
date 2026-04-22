# netsuite-mcp

Read-only MCP server over the NetSuite-shaped billing table.

The `ap_policy_flags` signal is what the brief quotes when Finance has blocked
an account — for Northstar Beauty, that's the AP block set on 2026-04-18.

## Tools

| Tool | Returns |
| --- | --- |
| `get_billing_status` | `current_balance_cents`, `past_due_balance_cents`, `past_due_days`. |
| `get_ap_policy_flags` | `ap_blocked` (bool), `ap_blocked_date`, `ap_blocked_reason`. |
| `get_recent_invoices` | Up to 5 recent invoices `[ { invoice_number, amount_cents, invoice_date } ]`. V1 seed captures the most recent invoice only, so this currently returns ≤1 entry. |

## Run

```bash
uv run python -m mcp_servers.netsuite_mcp.server
uv run python -m mcp_servers.netsuite_mcp.test
```
