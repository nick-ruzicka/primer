"""catalyst-mcp — CS-side relationship posture for the Primer data.

Keeps Catalyst's renewal forecast separate from Salesforce's so the
validation agent can surface disagreements.
"""
from __future__ import annotations

import asyncio
from typing import Any

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import TextContent, Tool

from mcp_servers._db import as_json, connect, row_to_dict

app = Server("catalyst-mcp")


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
            name="get_relationship_health",
            description="Returns the Catalyst relationship status (Healthy/Watchlist/At Risk/Cold), status_since, relationship_score + prior + delta, last_executive_touch, and notes.",
            inputSchema=_account_id_schema("Primer account_id."),
        ),
        Tool(
            name="get_renewal_forecast",
            description="Returns Catalyst's renewal_forecast (Commit/Best Case/Pipeline/At Risk). May differ from the Salesforce forecast — intentional, for the validation agent to reconcile.",
            inputSchema=_account_id_schema("Primer account_id."),
        ),
        Tool(
            name="get_expansion_readiness",
            description="Returns expansion_readiness tier (High/Medium/Low/None) with the Catalyst notes field for context.",
            inputSchema=_account_id_schema("Primer account_id."),
        ),
    ]


def _fetch_health(conn, account_id: str):
    return conn.execute(
        "SELECT * FROM catalyst_health WHERE account_id = ?",
        (account_id,),
    ).fetchone()


@app.call_tool()
async def call_tool(name: str, arguments: dict[str, Any]) -> list[TextContent]:
    account_id = arguments.get("account_id")
    if not isinstance(account_id, str) or not account_id.strip():
        raise ValueError("account_id (non-empty string) is required")

    conn = connect()
    try:
        row = row_to_dict(_fetch_health(conn, account_id))
        if name == "get_relationship_health":
            if row is None:
                payload: Any = None
            else:
                delta = (
                    None
                    if row.get("relationship_score") is None
                    or row.get("relationship_score_prior") is None
                    else row["relationship_score"] - row["relationship_score_prior"]
                )
                payload = {
                    "account_id": row["account_id"],
                    "relationship_status": row["relationship_status"],
                    "status_since": row["status_since"],
                    "relationship_score": row["relationship_score"],
                    "relationship_score_prior": row["relationship_score_prior"],
                    "relationship_score_delta": delta,
                    "last_executive_touch": row["last_executive_touch"],
                    "notes": row["notes"],
                }
        elif name == "get_renewal_forecast":
            payload = (
                None
                if row is None
                else {
                    "account_id": row["account_id"],
                    "renewal_forecast": row["renewal_forecast"],
                    "notes": row["notes"],
                }
            )
        elif name == "get_expansion_readiness":
            payload = (
                None
                if row is None
                else {
                    "account_id": row["account_id"],
                    "expansion_readiness": row["expansion_readiness"],
                    "notes": row["notes"],
                }
            )
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
