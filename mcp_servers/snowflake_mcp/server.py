"""snowflake-mcp — product-usage surface of the Primer data."""
from __future__ import annotations

import asyncio
from typing import Any

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import TextContent, Tool

from mcp_servers._db import as_json, connect, row_to_dict, rows_to_list

app = Server("snowflake-mcp")


def _account_id_schema(desc: str) -> dict[str, Any]:
    return {
        "type": "object",
        "properties": {"account_id": {"type": "string", "description": desc}},
        "required": ["account_id"],
        "additionalProperties": False,
    }


def _pct_trend(curr: int | None, prior: int | None) -> float | None:
    if curr is None or prior is None or prior == 0:
        return None
    return round(100.0 * (curr - prior) / prior, 1)


def _with_trend(row: dict[str, Any] | None) -> dict[str, Any] | None:
    if row is None:
        return None
    row["sends_trend_pct"] = _pct_trend(row.get("sends_30d"), row.get("sends_prior_30d"))
    row["health_delta"] = (
        None
        if row.get("health_score") is None or row.get("health_score_prior") is None
        else row["health_score"] - row["health_score_prior"]
    )
    return row


@app.list_tools()
async def list_tools() -> list[Tool]:
    return [
        Tool(
            name="get_usage_metrics",
            description="Returns Snowflake-derived product usage for the account: sends (30d + prior 30d + trend %), flows active/provisioned/paused, health score (current + prior + delta), adoption score and group average, last send date.",
            inputSchema=_account_id_schema("Primer account_id."),
        ),
        Tool(
            name="get_portfolio_comparison",
            description="Returns this account's usage side-by-side with its parent-group siblings. For a child account, compares self to siblings under the same parent. For a parent group, returns all children. For a standalone account, returns self only with an explanatory note.",
            inputSchema=_account_id_schema("Primer account_id."),
        ),
    ]


def _fetch_usage(conn, account_id: str):
    return conn.execute(
        "SELECT u.*, a.account_name FROM snowflake_usage u "
        "JOIN accounts a ON a.account_id = u.account_id "
        "WHERE u.account_id = ?",
        (account_id,),
    ).fetchone()


@app.call_tool()
async def call_tool(name: str, arguments: dict[str, Any]) -> list[TextContent]:
    account_id = arguments.get("account_id")
    if not isinstance(account_id, str) or not account_id.strip():
        raise ValueError("account_id (non-empty string) is required")

    conn = connect()
    try:
        if name == "get_usage_metrics":
            row = _fetch_usage(conn, account_id)
            payload = _with_trend(row_to_dict(row))
        elif name == "get_portfolio_comparison":
            account = conn.execute(
                "SELECT account_id, account_name, parent_account_id "
                "FROM accounts WHERE account_id = ?",
                (account_id,),
            ).fetchone()
            if account is None:
                payload = {
                    "queried_account_id": account_id,
                    "self": None,
                    "siblings": [],
                    "note": "Account not found.",
                }
            else:
                self_row = _with_trend(row_to_dict(_fetch_usage(conn, account_id)))
                parent_id = account["parent_account_id"]
                if parent_id is not None:
                    sibling_rows = conn.execute(
                        "SELECT u.*, a.account_name FROM snowflake_usage u "
                        "JOIN accounts a ON a.account_id = u.account_id "
                        "WHERE a.parent_account_id = ? AND u.account_id != ? "
                        "ORDER BY a.account_name",
                        (parent_id, account_id),
                    ).fetchall()
                    siblings = [_with_trend(d) for d in rows_to_list(sibling_rows)]
                    payload = {
                        "queried_account_id": account_id,
                        "parent_account_id": parent_id,
                        "self": self_row,
                        "siblings": siblings,
                    }
                else:
                    # Parent group queried directly — compare all children.
                    child_rows = conn.execute(
                        "SELECT u.*, a.account_name FROM snowflake_usage u "
                        "JOIN accounts a ON a.account_id = u.account_id "
                        "WHERE a.parent_account_id = ? ORDER BY a.account_name",
                        (account_id,),
                    ).fetchall()
                    children = [_with_trend(d) for d in rows_to_list(child_rows)]
                    payload = {
                        "queried_account_id": account_id,
                        "parent_account_id": None,
                        "self": self_row,
                        "siblings": children,
                        "note": None if children else "Standalone account — no portfolio to compare against.",
                    }
        else:
            raise ValueError(f"Unknown tool: {name}")
    finally:
        conn.close()

    return [TextContent(type="text", text=as_json(payload))]


async def _main() -> None:
    async with stdio_server() as (read, write):
        await app.run(read, write, app.create_initialization_options())


if __name__ == "__main__":
    asyncio.run(_main())
