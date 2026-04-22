"""Shared SQLite helpers for Primer MCP servers.

All six servers connect to the same `primer.db` read-only. The helpers below
centralize connection handling, row serialization, and JSON encoding so each
server stays focused on its tool schemas.
"""
from __future__ import annotations

import json
import os
import sqlite3
from pathlib import Path
from typing import Any

DEFAULT_DB_PATH = Path(__file__).resolve().parent.parent / "data" / "primer.db"


def _db_path() -> Path:
    env = os.getenv("DATABASE_PATH")
    return Path(env).resolve() if env else DEFAULT_DB_PATH


def connect() -> sqlite3.Connection:
    """Open a read-only connection to the seeded DB.

    Uses SQLite's URI mode so concurrent servers can't mutate state even by
    accident. Each call opens a fresh connection — connections are cheap and
    we avoid any thread-safety surprises across async handlers.
    """
    path = _db_path()
    if not path.exists():
        raise FileNotFoundError(
            f"Primer DB not found at {path}. Run `python data/seed.py` first."
        )
    uri = f"file:{path}?mode=ro"
    conn = sqlite3.connect(uri, uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def row_to_dict(row: sqlite3.Row | None) -> dict[str, Any] | None:
    if row is None:
        return None
    return dict(row)


def rows_to_list(rows: list[sqlite3.Row]) -> list[dict[str, Any]]:
    return [dict(r) for r in rows]


def as_json(payload: Any) -> str:
    """JSON-encode a payload for return as MCP TextContent."""
    return json.dumps(payload, ensure_ascii=False, default=str)
