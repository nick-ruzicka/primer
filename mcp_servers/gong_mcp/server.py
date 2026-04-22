"""gong-mcp — call summaries and extracted signals for the Primer data.

Splitting competitor and pricing signals into their own tools lets the agent
query them directly when reasoning about risk rather than always pulling full
call summaries.
"""
from __future__ import annotations

import asyncio
from typing import Any

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import TextContent, Tool

from mcp_servers._db import as_json, connect, rows_to_list

app = Server("gong-mcp")

RECENT_CALL_LIMIT = 5


def _account_id_schema(desc: str) -> dict[str, Any]:
    return {
        "type": "object",
        "properties": {"account_id": {"type": "string", "description": desc}},
        "required": ["account_id"],
        "additionalProperties": False,
    }


def _split_pipe(value: str | None) -> list[str]:
    if not value:
        return []
    return [part.strip() for part in value.split("|") if part.strip()]


def _shape_call(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "call_id": row["call_id"],
        "account_id": row["account_id"],
        "call_date": row["call_date"],
        "call_type": row["call_type"],
        "duration_minutes": row["duration_minutes"],
        "summary": row["summary"],
        "competitor_mentioned": bool(row["competitor_mentioned"]),
        "competitor_name": row["competitor_name"],
        "competitor_mention_count": row["competitor_mention_count"],
        "pricing_pushback": bool(row["pricing_pushback"]),
        "sentiment": row["sentiment"],
        "followups": _split_pipe(row["followups"]),
        "risks_mentioned": _split_pipe(row["risks_mentioned"]),
    }


@app.list_tools()
async def list_tools() -> list[Tool]:
    return [
        Tool(
            name="get_recent_calls",
            description=f"Returns up to {RECENT_CALL_LIMIT} most-recent call summaries for the account, ordered newest first. Each call includes sentiment, followups (list), and risks_mentioned (list).",
            inputSchema=_account_id_schema("Primer account_id."),
        ),
        Tool(
            name="get_competitor_mentions",
            description="Returns only calls where a competitor was named — competitor_name, competitor_mention_count, call date and summary.",
            inputSchema=_account_id_schema("Primer account_id."),
        ),
        Tool(
            name="get_pricing_signals",
            description="Returns only calls where pricing pushback was detected — call date, summary, sentiment.",
            inputSchema=_account_id_schema("Primer account_id."),
        ),
    ]


@app.call_tool()
async def call_tool(name: str, arguments: dict[str, Any]) -> list[TextContent]:
    account_id = arguments.get("account_id")
    if not isinstance(account_id, str) or not account_id:
        raise ValueError("account_id (non-empty string) is required")

    conn = connect()
    try:
        if name == "get_recent_calls":
            rows = conn.execute(
                "SELECT * FROM gong_calls WHERE account_id = ? "
                "ORDER BY call_date DESC LIMIT ?",
                (account_id, RECENT_CALL_LIMIT),
            ).fetchall()
            payload: Any = [_shape_call(r) for r in rows_to_list(rows)]
        elif name == "get_competitor_mentions":
            rows = conn.execute(
                "SELECT * FROM gong_calls WHERE account_id = ? "
                "AND competitor_mentioned = 1 "
                "ORDER BY call_date DESC",
                (account_id,),
            ).fetchall()
            payload = [_shape_call(r) for r in rows_to_list(rows)]
        elif name == "get_pricing_signals":
            rows = conn.execute(
                "SELECT * FROM gong_calls WHERE account_id = ? "
                "AND pricing_pushback = 1 "
                "ORDER BY call_date DESC",
                (account_id,),
            ).fetchall()
            payload = [_shape_call(r) for r in rows_to_list(rows)]
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
