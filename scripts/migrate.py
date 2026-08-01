#!/usr/bin/env python3
"""Applies every migration in supabase/migrations/ in filename order.

Replaces the old scripts/setup-db.mjs, which had drifted to the 001 schema (and
seeded fake daily_stats), so it could no longer bootstrap a usable database.

Uses psycopg2 rather than the Neon HTTP driver so each migration runs inside a
real transaction — a failing statement rolls the whole file back instead of
leaving the schema half-applied. Applied files are recorded in
schema_migrations, making re-runs no-ops.

Usage:
    python scripts/migrate.py                # apply pending migrations
    python scripts/migrate.py --dry-run      # list pending migrations only
    python scripts/migrate.py --baseline 014 # mark files up to 014 as applied
                                             # (for a database predating this runner)
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

import psycopg2

MIGRATIONS_DIR = Path(__file__).resolve().parent.parent / "supabase" / "migrations"


def ensure_migrations_table(conn) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS schema_migrations (
                filename   TEXT PRIMARY KEY,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
    conn.commit()


def get_applied(conn) -> set[str]:
    with conn.cursor() as cur:
        cur.execute("SELECT filename FROM schema_migrations")
        return {row[0] for row in cur.fetchall()}


def apply_migration(conn, path: Path) -> None:
    """Run one migration file atomically."""
    sql = path.read_text(encoding="utf-8")
    try:
        with conn.cursor() as cur:
            cur.execute(sql)
            cur.execute(
                "INSERT INTO schema_migrations (filename) VALUES (%s)", (path.name,)
            )
        conn.commit()
    except Exception:
        conn.rollback()
        raise


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="list pending migrations only")
    parser.add_argument("--baseline", metavar="PREFIX", help="mark files up to PREFIX as applied")
    args = parser.parse_args()

    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print("DATABASE_URL is required", file=sys.stderr)
        return 1

    files = sorted(p for p in MIGRATIONS_DIR.glob("*.sql"))

    with psycopg2.connect(database_url) as conn:
        ensure_migrations_table(conn)

        if args.baseline:
            marked = [p for p in files if p.name[: len(args.baseline)] <= args.baseline]
            with conn.cursor() as cur:
                for path in marked:
                    cur.execute(
                        "INSERT INTO schema_migrations (filename) VALUES (%s) "
                        "ON CONFLICT (filename) DO NOTHING",
                        (path.name,),
                    )
            conn.commit()
            print(f"Baselined {len(marked)} migration(s): {', '.join(p.name for p in marked)}")
            return 0

        applied = get_applied(conn)
        pending = [p for p in files if p.name not in applied]

        if not pending:
            print(f"All {len(files)} migrations already applied.")
            return 0

        print(f"{len(pending)} pending migration(s): {', '.join(p.name for p in pending)}")
        if args.dry_run:
            return 0

        for path in pending:
            print(f"  applying {path.name} ... ", end="", flush=True)
            apply_migration(conn, path)
            print("OK")

        print(f"Done. {len(pending)} migration(s) applied.")
        return 0


if __name__ == "__main__":
    sys.exit(main())
