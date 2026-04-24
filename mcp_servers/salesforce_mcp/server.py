"""salesforce-mcp — Salesforce surface of the Primer data.

Exposes read-only tools over the seeded SQLite DB:
  get_account, get_contract, get_contacts,
  get_open_opportunities, get_recent_closed_opportunities,
  get_account_hierarchy.

All tools accept `account_id: str` as their only argument.
"""
from __future__ import annotations

import asyncio
from datetime import date, timedelta
from typing import Any

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import TextContent, Tool

from mcp_servers._db import as_json, connect, row_to_dict, rows_to_list

app = Server("salesforce-mcp")

CLOSED_WINDOW_DAYS = 180

ACCOUNT_SUMMARY_COLS = (
    "account_id, account_name, parent_account_id, parent_account_name, "
    "industry, segment, arr_cents, stage, state, logo_color, logo_initial"
)


def _account_id_schema(desc: str) -> dict[str, Any]:
    return {
        "type": "object",
        "properties": {"account_id": {"type": "string", "description": desc}},
        "required": ["account_id"],
        "additionalProperties": False,
    }


@app.list_tools()
async def list_tools() -> list[Tool]:
    return [
        Tool(
            name="get_account",
            description="Returns the core Salesforce account record (name, parent, industry, segment, ARR, stage, state, owner).",
            inputSchema=_account_id_schema("Primer account_id, e.g. 'northstar_beauty'."),
        ),
        Tool(
            name="get_contract",
            description="Returns the current contract for the account: plan name, start/end dates, auto-renew flag, seat usage.",
            inputSchema=_account_id_schema("Primer account_id."),
        ),
        Tool(
            name="get_contacts",
            description="Returns all Salesforce contacts on the account — decision makers, executive sponsors, champions, influencers, blockers.",
            inputSchema=_account_id_schema("Primer account_id."),
        ),
        Tool(
            name="get_open_opportunities",
            description="Returns open opportunities for the account with stage, amount, forecast category, and expected close date.",
            inputSchema=_account_id_schema("Primer account_id."),
        ),
        Tool(
            name="get_recent_closed_opportunities",
            description=f"Returns opportunities closed (won or lost) in the last {CLOSED_WINDOW_DAYS} days for the account.",
            inputSchema=_account_id_schema("Primer account_id."),
        ),
        Tool(
            name="get_account_hierarchy",
            description="Returns the parent account (if any) and all sibling accounts (ARR, stage, state). For a parent account queried directly, returns its children as siblings with parent=null.",
            inputSchema=_account_id_schema("Primer account_id."),
        ),
    ]


def _fetch_account(conn, account_id: str):
    return conn.execute(
        "SELECT * FROM accounts WHERE account_id = ?", (account_id,)
    ).fetchone()


def _hierarchy_payload(conn, account_id: str) -> dict[str, Any]:
    row = _fetch_account(conn, account_id)
    if row is None:
        return {"queried_account_id": account_id, "parent": None, "siblings": []}

    parent_id = row["parent_account_id"]
    if parent_id is not None:
        parent_row = conn.execute(
            f"SELECT {ACCOUNT_SUMMARY_COLS} FROM accounts WHERE account_id = ?",
            (parent_id,),
        ).fetchone()
        sibling_rows = conn.execute(
            f"SELECT {ACCOUNT_SUMMARY_COLS} FROM accounts "
            "WHERE parent_account_id = ? AND account_id != ? "
            "ORDER BY account_name",
            (parent_id, account_id),
        ).fetchall()
        return {
            "queried_account_id": account_id,
            "parent": row_to_dict(parent_row),
            "siblings": rows_to_list(sibling_rows),
        }

    # Is the queried account itself a parent group?
    children = conn.execute(
        f"SELECT {ACCOUNT_SUMMARY_COLS} FROM accounts "
        "WHERE parent_account_id = ? ORDER BY account_name",
        (account_id,),
    ).fetchall()
    return {
        "queried_account_id": account_id,
        "parent": None,
        "siblings": rows_to_list(children),
    }


@app.call_tool()
async def call_tool(name: str, arguments: dict[str, Any]) -> list[TextContent]:
    account_id = arguments.get("account_id")
    if not isinstance(account_id, str) or not account_id.strip():
        raise ValueError("account_id (non-empty string) is required")

    conn = connect()
    try:
        if name == "get_account":
            row = _fetch_account(conn, account_id)
            payload = row_to_dict(row)
        elif name == "get_contract":
            row = conn.execute(
                "SELECT * FROM salesforce_contracts WHERE account_id = ?",
                (account_id,),
            ).fetchone()
            payload = row_to_dict(row)
        elif name == "get_contacts":
            rows = conn.execute(
                "SELECT * FROM salesforce_contacts WHERE account_id = ? "
                "ORDER BY CASE role "
                "  WHEN 'Decision Maker' THEN 0 "
                "  WHEN 'Champion' THEN 1 "
                "  WHEN 'Executive Sponsor' THEN 2 "
                "  WHEN 'Influencer' THEN 3 "
                "  WHEN 'Blocker' THEN 4 "
                "  ELSE 5 END, name",
                (account_id,),
            ).fetchall()
            payload = rows_to_list(rows)
        elif name == "get_open_opportunities":
            rows = conn.execute(
                "SELECT * FROM salesforce_opportunities "
                "WHERE account_id = ? AND status = 'open' "
                "ORDER BY close_date",
                (account_id,),
            ).fetchall()
            payload = rows_to_list(rows)
        elif name == "get_recent_closed_opportunities":
            cutoff = (date.today() - timedelta(days=CLOSED_WINDOW_DAYS)).isoformat()
            rows = conn.execute(
                "SELECT * FROM salesforce_opportunities "
                "WHERE account_id = ? AND status IN ('closed_won', 'closed_lost') "
                "AND close_date >= ? "
                "ORDER BY close_date DESC",
                (account_id, cutoff),
            ).fetchall()
            payload = rows_to_list(rows)
        elif name == "get_account_hierarchy":
            payload = _hierarchy_payload(conn, account_id)
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
