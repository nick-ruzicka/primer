"""Integration smoke: every tool on every billable account.

Spins up each of the six MCP servers in turn and invokes every tool it
exposes against every billable account. Reports a summary; exits non-zero
on the first error returned by the MCP stack. Parent-group accounts are
exercised only through hierarchy- and portfolio-shaped tools since they
don't own their own usage/billing/calls.

Run from the repo root:

    uv run python -m mcp_servers.smoke_all
"""
from __future__ import annotations

import asyncio
import json
import sys

from mcp import ClientSession
from mcp.client.stdio import StdioServerParameters, stdio_client

from mcp_servers._db import connect

SERVERS = [
    "mcp_servers.salesforce_mcp.server",
    "mcp_servers.snowflake_mcp.server",
    "mcp_servers.catalyst_mcp.server",
    "mcp_servers.netsuite_mcp.server",
    "mcp_servers.gong_mcp.server",
    "mcp_servers.exa_mcp.server",
]


def _load_accounts() -> tuple[list[str], list[str]]:
    conn = connect()
    try:
        billable = [
            r["account_id"]
            for r in conn.execute(
                "SELECT account_id FROM accounts "
                "WHERE account_id IN ("
                "  SELECT account_id FROM accounts WHERE parent_account_id IS NOT NULL"
                ") OR account_id NOT IN ("
                "  SELECT DISTINCT parent_account_id FROM accounts WHERE parent_account_id IS NOT NULL"
                ") ORDER BY account_name"
            ).fetchall()
        ]
        groups = [
            r["account_id"]
            for r in conn.execute(
                "SELECT account_id FROM accounts WHERE parent_account_id IS NULL "
                "AND account_id IN (SELECT DISTINCT parent_account_id FROM accounts WHERE parent_account_id IS NOT NULL) "
                "ORDER BY account_name"
            ).fetchall()
        ]
    finally:
        conn.close()
    # Filter out any billable duplicates that are also groups.
    billable = [a for a in billable if a not in set(groups)]
    return billable, groups


def _classify(name: str, payload, account_id: str, is_group: bool) -> str:
    """Describe the shape succinctly: 'null', '[]', 'list(n)', 'dict', or a short summary."""
    if payload is None:
        return "null"
    if isinstance(payload, list):
        return f"list({len(payload)})"
    if isinstance(payload, dict):
        # Pick a couple of telling keys when present.
        keys = []
        for k in ("siblings", "signals", "ap_blocked", "relationship_status", "renewal_forecast", "expansion_readiness"):
            if k in payload:
                v = payload[k]
                if isinstance(v, list):
                    keys.append(f"{k}={len(v)}")
                else:
                    keys.append(f"{k}={v!r}")
                if len(keys) == 2:
                    break
        return "dict{" + ", ".join(keys) + "}" if keys else "dict"
    return type(payload).__name__


async def _sweep_server(module: str, billable: list[str], groups: list[str]) -> tuple[int, int, list[str]]:
    params = StdioServerParameters(command="uv", args=["run", "python", "-m", module])
    errors: list[str] = []
    calls = 0
    rows: list[str] = []
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            tools = await session.list_tools()
            tool_names = [t.name for t in tools.tools]

            rows.append(f"# {module}  tools={tool_names}")
            for tool_name in tool_names:
                tool_is_hierarchical = tool_name in {"get_account_hierarchy", "get_portfolio_comparison"}
                targets = billable + (groups if tool_is_hierarchical else [])
                shape_by_account: dict[str, str] = {}
                for account_id in targets:
                    calls += 1
                    try:
                        r = await session.call_tool(tool_name, {"account_id": account_id})
                        text = r.content[0].text if r.content else ""
                        payload = json.loads(text) if text not in ("", "null") else None
                        shape_by_account[account_id] = _classify(
                            tool_name, payload, account_id, account_id in groups
                        )
                    except Exception as e:
                        errors.append(f"{module}::{tool_name}({account_id}) -> {e}")
                        shape_by_account[account_id] = f"ERROR: {e}"
                rows.append(f"  {tool_name}:")
                for account_id in targets:
                    rows.append(f"    {account_id:<24} {shape_by_account[account_id]}")
    print("\n".join(rows))
    return calls, len(errors), errors


async def main() -> int:
    billable, groups = _load_accounts()
    print(f"Billable accounts ({len(billable)}): {billable}")
    print(f"Parent groups   ({len(groups)}): {groups}\n")

    total_calls = 0
    total_errors = 0
    all_errors: list[str] = []

    for module in SERVERS:
        calls, errs, errors = await _sweep_server(module, billable, groups)
        total_calls += calls
        total_errors += errs
        all_errors.extend(errors)
        print()

    print(f"=== summary: {total_calls} calls, {total_errors} errors ===")
    if all_errors:
        for e in all_errors:
            print(f"  ! {e}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
