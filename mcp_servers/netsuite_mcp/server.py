"""netsuite-mcp — billing + AP posture for the Primer data.

The seed only captures a single `last_invoice_*` per account. `get_recent_invoices`
therefore returns at most one entry — in production this would hit a full
invoices history table.
"""
from __future__ import annotations

import asyncio
from typing import Any

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import TextContent, Tool

from mcp_servers._db import as_json, connect, row_to_dict

app = Server("netsuite-mcp")

RECENT_INVOICE_LIMIT = 5


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
            name="get_billing_status",
            description="Returns current_balance_cents, past_due_balance_cents, and past_due_days for the account.",
            inputSchema=_account_id_schema("Primer account_id."),
        ),
        Tool(
            name="get_ap_policy_flags",
            description="Returns AP block state for the account: ap_blocked (bool), ap_blocked_date, ap_blocked_reason. When ap_blocked=true, the reason string is what the brief should quote.",
            inputSchema=_account_id_schema("Primer account_id."),
        ),
        Tool(
            name="get_recent_invoices",
            description=f"Returns up to {RECENT_INVOICE_LIMIT} most-recent invoices for the account (invoice number, amount in cents, date). V1 seed captures the latest invoice only.",
            inputSchema=_account_id_schema("Primer account_id."),
        ),
    ]


def _fetch_billing(conn, account_id: str):
    return conn.execute(
        "SELECT * FROM netsuite_billing WHERE account_id = ?", (account_id,)
    ).fetchone()


@app.call_tool()
async def call_tool(name: str, arguments: dict[str, Any]) -> list[TextContent]:
    account_id = arguments.get("account_id")
    if not isinstance(account_id, str) or not account_id.strip():
        raise ValueError("account_id (non-empty string) is required")

    conn = connect()
    try:
        row = row_to_dict(_fetch_billing(conn, account_id))
        if name == "get_billing_status":
            payload: Any = (
                None
                if row is None
                else {
                    "account_id": row["account_id"],
                    "current_balance_cents": row["current_balance_cents"],
                    "past_due_balance_cents": row["past_due_balance_cents"],
                    "past_due_days": row["past_due_days"],
                }
            )
        elif name == "get_ap_policy_flags":
            payload = (
                None
                if row is None
                else {
                    "account_id": row["account_id"],
                    "ap_blocked": bool(row["ap_blocked"]),
                    "ap_blocked_date": row["ap_blocked_date"],
                    "ap_blocked_reason": row["ap_blocked_reason"],
                }
            )
        elif name == "get_recent_invoices":
            if row is None or row.get("last_invoice_number") is None:
                payload = []
            else:
                payload = [
                    {
                        "invoice_number": row["last_invoice_number"],
                        "amount_cents": row["last_invoice_amount_cents"],
                        "invoice_date": row["last_invoice_date"],
                    }
                ]
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
