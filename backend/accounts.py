"""`/api/accounts` payload builder.

Reads directly from the seeded SQLite (read-only) rather than fanning out to
Salesforce MCP for every request — /api/accounts hits on every page load and
we don't want to spawn N subprocess RPCs for it.
"""

from __future__ import annotations

import sqlite3
from typing import Any

from .config import SETTINGS


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(SETTINGS.database_path)
    conn.row_factory = sqlite3.Row
    return conn


# Reverse lookup for embedding the frontend alias in /api/accounts records.
_FRONTEND_ID_FOR: dict[str, str] = {
    "northstar_beauty": "ns-beauty",
    "northstar_active": "ns-active",
    "northstar_home": "ns-home",
    "northstar_group": "northstar-group",
    "quiver_group": "quiver-group",
    "quiver_rituals": "quiver-rituals",
    "quiver_supplements": "quiver-supplements",
    "mellow_mattress": "mellow",
    "hearth_home": "hearth",
    "kindred_pet": "kindred",
    "ember_coffee": "ember",
    "tidepool_swim": "tidepool",
}


def _row_to_account(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["account_id"],
        "frontend_id": _FRONTEND_ID_FOR.get(row["account_id"], row["account_id"]),
        "name": row["account_name"],
        "stage": row["stage"],
        "state": row["state"],
        "arr_cents": row["arr_cents"],
        "logo_color": row["logo_color"],
        "logo_initial": row["logo_initial"],
        "industry": row["industry"],
        "segment": row["segment"],
        "hq_city": row["hq_city"],
        "hq_state": row["hq_state"],
        "employees": row["employees"],
        "parent_id": row["parent_account_id"],
        "parent_name": row["parent_account_name"],
        "owner_name": row["owner_name"],
        "owner_role": row["owner_role"],
    }


def list_accounts() -> dict[str, Any]:
    """Return the accounts payload for the frontend left rail.

    Shape:
        {
          "groups": [
            {
              "parent_id": ..., "parent_name": ..., "combined_arr_cents": N,
              "accounts": [ {id, name, stage, state, arr_cents, ...}, ... ]
            }
          ],
          "standalone": [ {id, name, ...}, ... ]
        }
    """
    with _connect() as conn:
        rows = conn.execute(
            "SELECT * FROM accounts ORDER BY parent_account_id NULLS FIRST, account_name"
        ).fetchall()

    groups: dict[str, dict[str, Any]] = {}
    standalone: list[dict[str, Any]] = []
    parent_rows: dict[str, sqlite3.Row] = {}

    # First pass: identify parent rows (no parent themselves, have children)
    for row in rows:
        account = _row_to_account(row)
        if row["parent_account_id"] is None:
            # parent_row candidate — may or may not have children
            parent_rows[row["account_id"]] = row
        else:
            parent_id = row["parent_account_id"]
            parent_name = row["parent_account_name"]
            bucket = groups.setdefault(
                parent_id,
                {
                    "parent_id": parent_id,
                    "parent_name": parent_name,
                    "combined_arr_cents": 0,
                    "accounts": [],
                },
            )
            bucket["accounts"].append(account)
            bucket["combined_arr_cents"] += account["arr_cents"] or 0

    # Second pass: parents without children become standalone
    for parent_id, row in parent_rows.items():
        if parent_id in groups:
            continue
        standalone.append(_row_to_account(row))

    # Sort within groups by ARR desc
    for bucket in groups.values():
        bucket["accounts"].sort(
            key=lambda a: (a["arr_cents"] or 0, a["name"]), reverse=True
        )

    # Sort groups by combined ARR desc
    groups_sorted = sorted(
        groups.values(), key=lambda g: g["combined_arr_cents"], reverse=True
    )
    standalone.sort(key=lambda a: (a["arr_cents"] or 0, a["name"]), reverse=True)

    return {"groups": groups_sorted, "standalone": standalone}


# Terminal 3's left-rail fixtures use shortened IDs (``ns-beauty``). The DB
# uses canonical IDs (``northstar_beauty``). Accept either form so the live
# path works without requiring frontend changes.
_FRONTEND_ALIASES: dict[str, str] = {
    "ns-beauty": "northstar_beauty",
    "ns-active": "northstar_active",
    "ns-home": "northstar_home",
    "northstar-group": "northstar_group",
    "quiver-group": "quiver_group",
    "quiver-rituals": "quiver_rituals",
    "quiver-supplements": "quiver_supplements",
    "mellow": "mellow_mattress",
    "hearth": "hearth_home",
    "kindred": "kindred_pet",
    "ember": "ember_coffee",
    "tidepool": "tidepool_swim",
}


def resolve_account_id(account_id: str) -> str:
    """Accept either the DB id (``northstar_beauty``) or the frontend alias
    (``ns-beauty``) and return the canonical DB id."""
    return _FRONTEND_ALIASES.get(account_id, account_id)


def account_exists(account_id: str) -> bool:
    canonical = resolve_account_id(account_id)
    with _connect() as conn:
        row = conn.execute(
            "SELECT 1 FROM accounts WHERE account_id = ?", (canonical,)
        ).fetchone()
    return row is not None
