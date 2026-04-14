"""Standalone daily_stats computation.

Why this exists:
  The main YouTube crawler ('main.py') used to compute daily_stats at the very end
  of its 212-channel loop. The GitHub Actions youtube job times out at 45 min and
  has been getting cancelled for ~20 days, so compute_daily_stats() was never
  reached and daily_stats went stale (last successful write 2026-03-28).

  This script is intentionally tiny: it only needs DB access, runs in seconds,
  and lives in its own workflow job so it can never be blocked by the slow
  channel loop.

Usage:
  python compute_stats.py              # compute today (KST) only
  python compute_stats.py --backfill   # recompute the last 14 KST days (idempotent)
  python compute_stats.py 2026-04-10   # compute one explicit KST date
"""
from __future__ import annotations

import sys
from datetime import datetime, timedelta, timezone

from db import close_pool, get_conn
from logger import logger
from main import KST, compute_daily_stats


def _dates_to_compute(args: list[str]) -> list[str]:
    today = datetime.now(KST).date()
    if "--backfill" in args:
        return [(today - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(14, -1, -1)]
    explicit = [a for a in args if a.startswith("2") and len(a) == 10]
    if explicit:
        return explicit
    return [today.strftime("%Y-%m-%d")]


def main() -> None:
    dates = _dates_to_compute(sys.argv[1:])
    logger.info("Computing daily_stats for %d date(s): %s", len(dates), dates)

    with get_conn() as conn:
        with conn.cursor() as cur:
            for date_str in dates:
                try:
                    compute_daily_stats(cur, date_str)
                    conn.commit()
                except Exception:
                    logger.exception("Failed to compute daily_stats for %s", date_str)
                    conn.rollback()

    close_pool()
    logger.info("compute_stats done")


if __name__ == "__main__":
    main()
