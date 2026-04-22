"""exa-mcp — external signals surface for the Primer data.

V1 reads from the seeded `external_signals` table. In production this wraps an
Exa API call with caching; the switch-over would be gated by USE_LIVE_EXA=1.
"""
from __future__ import annotations

import asyncio
from typing import Any

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import TextContent, Tool

from mcp_servers._db import as_json, connect, rows_to_list

app = Server("exa-mcp")


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
            name="search_account_signals",
            description="Returns external signals for the account (funding, executive changes, hiring, press, social posts, podcasts, competitive moves). Ordered newest first.",
            inputSchema=_account_id_schema("Primer account_id."),
        ),
        Tool(
            name="get_decision_maker_signals",
            description="Returns external signals focused on the account's decision maker — LinkedIn posts, podcast mentions, exec changes — by substring-matching the DM's name against signal title and snippet. Includes the resolved DM in the payload.",
            inputSchema=_account_id_schema("Primer account_id."),
        ),
    ]


def _resolve_decision_maker(conn, account_id: str) -> dict[str, Any] | None:
    row = conn.execute(
        "SELECT contact_id, name, title, role, tenure_months, linkedin_url "
        "FROM salesforce_contacts WHERE account_id = ? "
        "AND role IN ('Decision Maker', 'Champion') "
        "ORDER BY CASE role WHEN 'Decision Maker' THEN 0 ELSE 1 END LIMIT 1",
        (account_id,),
    ).fetchone()
    return dict(row) if row else None


@app.call_tool()
async def call_tool(name: str, arguments: dict[str, Any]) -> list[TextContent]:
    account_id = arguments.get("account_id")
    if not isinstance(account_id, str) or not account_id:
        raise ValueError("account_id (non-empty string) is required")

    conn = connect()
    try:
        if name == "search_account_signals":
            rows = conn.execute(
                "SELECT * FROM external_signals WHERE account_id = ? "
                "ORDER BY signal_date DESC",
                (account_id,),
            ).fetchall()
            payload: Any = rows_to_list(rows)
        elif name == "get_decision_maker_signals":
            dm = _resolve_decision_maker(conn, account_id)
            if dm is None:
                payload = {"decision_maker": None, "signals": []}
            else:
                like = f"%{dm['name']}%"
                rows = conn.execute(
                    "SELECT * FROM external_signals WHERE account_id = ? "
                    "AND (title LIKE ? OR snippet LIKE ?) "
                    "ORDER BY signal_date DESC",
                    (account_id, like, like),
                ).fetchall()
                payload = {"decision_maker": dm, "signals": rows_to_list(rows)}
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
