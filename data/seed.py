"""Seed the Primer SQLite DB from schema.sql + seed.sql.

Run from the repo root:

    python data/seed.py

Re-running is safe: it deletes the existing DB and rebuilds from scratch.
Honors DATABASE_PATH if set; otherwise writes to data/primer.db.
"""
from __future__ import annotations

import os
import sqlite3
import sys
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent
SCHEMA_PATH = DATA_DIR / "schema.sql"
SEED_PATH = DATA_DIR / "seed.sql"


def db_path() -> Path:
    env = os.getenv("DATABASE_PATH")
    return Path(env).resolve() if env else DATA_DIR / "primer.db"


def main() -> int:
    target = db_path()
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists():
        target.unlink()

    schema_sql = SCHEMA_PATH.read_text()
    seed_sql = SEED_PATH.read_text()

    conn = sqlite3.connect(target)
    try:
        conn.executescript(schema_sql)
        conn.executescript(seed_sql)
        conn.commit()
        total_accounts = conn.execute(
            "SELECT COUNT(*) FROM accounts WHERE parent_account_id IS NOT NULL"
        ).fetchone()[0]
        total_groups = conn.execute(
            "SELECT COUNT(*) FROM accounts WHERE parent_account_id IS NULL AND account_id IN "
            "(SELECT DISTINCT parent_account_id FROM accounts WHERE parent_account_id IS NOT NULL)"
        ).fetchone()[0]
        standalone = conn.execute(
            "SELECT COUNT(*) FROM accounts WHERE parent_account_id IS NULL AND account_id NOT IN "
            "(SELECT DISTINCT parent_account_id FROM accounts WHERE parent_account_id IS NOT NULL)"
        ).fetchone()[0]
    finally:
        conn.close()

    billable = total_accounts + standalone
    print(
        f"Seeded {billable} accounts across {total_groups} parent group(s) "
        f"({total_accounts} child, {standalone} standalone) → {target}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
