#!/usr/bin/env python3
"""One-off backfill that makes historical evaluation possible.

Three jobs, each independently resumable:

  market      Fill asset_dictionary.market so the evaluator knows whether a
              ticker belongs to KOSPI or KOSDAQ.
  history     Load daily closes for every asset that still has an unevaluated
              prediction, plus the benchmark indices.
  duplicates  Mark repeat calls (same channel, asset and direction inside a
              30-day window) so one opinion counts once.

The old price_at_mention values were written with today's quote and cannot be
trusted; they are copied to price_at_mention_v1 and then recomputed from
history. Assets with no recoverable history stay NULL rather than being given a
made-up number.

Usage:
    python crawler/backfill_prices.py --all
    python crawler/backfill_prices.py --history --limit 50
"""
from __future__ import annotations

import argparse
import sys
import time
from datetime import timedelta

from db import get_conn, close_pool
from logger import logger
from price_history import (
    fetch_coin_closes,
    fetch_stock_closes,
    load_benchmark_history,
    store_asset_prices,
    today_kst,
)

DUPLICATE_WINDOW_DAYS = 30


def backfill_market(conn) -> int:
    """Tag each stock in asset_dictionary with its listing market.

    KRX's bulk ticker-list endpoints now require account credentials, so the
    market is read per ticker from Yahoo, where Korean listings carry a .KS
    (KOSPI) or .KQ (KOSDAQ) suffix.
    """
    try:
        import yfinance as yf
    except ImportError:
        logger.warning("yfinance not installed — skipping market backfill")
        return 0

    updated = 0
    with conn.cursor() as cur:
        cur.execute(
            """SELECT asset_code FROM asset_dictionary
               WHERE asset_type = 'stock' AND asset_code IS NOT NULL AND market IS NULL"""
        )
        codes = [row[0] for row in cur.fetchall()]

    logger.info("Resolving market for %d ticker(s)", len(codes))
    for code in codes:
        market = None
        for suffix, name in ((".KS", "KOSPI"), (".KQ", "KOSDAQ")):
            try:
                hist = yf.Ticker(f"{code}{suffix}").history(period="5d")
                if hist is not None and not hist.empty:
                    market = name
                    break
            except Exception:
                continue

        if market:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE asset_dictionary SET market = %s WHERE asset_code = %s",
                    (market, code),
                )
            conn.commit()
            updated += 1

    logger.info("Market backfilled for %d ticker(s)", updated)
    return updated


def _assets_needing_history(cur, limit: int | None) -> list[tuple[str, str]]:
    """Assets with predictions that still lack a v2 evaluation."""
    sql = """
        SELECT DISTINCT ma.asset_code, ma.asset_type
        FROM predictions p
        JOIN mentioned_assets ma ON p.mentioned_asset_id = ma.id
        WHERE ma.asset_code IS NOT NULL
          AND ma.asset_type IN ('stock', 'coin')
          AND NOT p.is_duplicate
        ORDER BY 1
    """
    if limit:
        sql += f" LIMIT {int(limit)}"
    cur.execute(sql)
    return cur.fetchall()


def backfill_history(conn, limit: int | None = None, days: int = 400) -> int:
    """Load daily closes for evaluation targets and the benchmarks."""
    load_benchmark_history(conn, days=days)

    end = today_kst()
    start = end - timedelta(days=days)
    total = 0

    with conn.cursor() as cur:
        assets = _assets_needing_history(cur, limit)
    logger.info("Loading history for %d asset(s)", len(assets))

    for i, (code, asset_type) in enumerate(assets, 1):
        with conn.cursor() as cur:
            cur.execute(
                """SELECT COUNT(*) FROM asset_prices
                   WHERE asset_code = %s AND recorded_date >= %s""",
                (code, start),
            )
            have = cur.fetchone()[0]

        # Roughly one row per trading day; skip assets already loaded so the
        # job can be re-run after an interruption without redoing the work.
        if have > days * 0.5:
            continue

        if asset_type == "stock":
            closes = fetch_stock_closes(code, start, end)
        else:
            closes = fetch_coin_closes(code, days=min(days, 365))
            time.sleep(2.5)  # free CoinGecko tier is ~30 calls/min

        stored = store_asset_prices(conn, code, asset_type, closes)
        total += stored
        if stored:
            logger.info("[%d/%d] %s: %d close(s)", i, len(assets), code, stored)

    logger.info("Stored %d daily close(s)", total)
    return total


def backfill_price_at_mention(conn) -> int:
    """Recompute price_at_mention from history, preserving the old value."""
    updated = 0
    with conn.cursor() as cur:
        cur.execute(
            """UPDATE mentioned_assets
               SET price_at_mention_v1 = price_at_mention
               WHERE price_at_mention IS NOT NULL AND price_at_mention_v1 IS NULL"""
        )
        conn.commit()

        # One row per mention: the price must match that mention's own date,
        # which is exactly what the previous asset-wide UPDATE destroyed.
        cur.execute(
            """
            UPDATE mentioned_assets ma
            SET price_at_mention = sub.price
            FROM (
                SELECT ma2.id, ap.price
                FROM mentioned_assets ma2
                JOIN videos v ON v.id = ma2.video_id
                JOIN LATERAL (
                    SELECT price FROM asset_prices ap
                    WHERE ap.asset_code = ma2.asset_code
                      AND ap.recorded_date <= v.published_at::date
                      AND ap.recorded_date >= v.published_at::date - INTERVAL '3 days'
                    ORDER BY ap.recorded_date DESC
                    LIMIT 1
                ) ap ON TRUE
                WHERE ma2.asset_code IS NOT NULL
                  AND v.published_at IS NOT NULL
            ) sub
            WHERE ma.id = sub.id
              AND (ma.price_at_mention IS DISTINCT FROM sub.price)
            """
        )
        updated = cur.rowcount
        conn.commit()

    logger.info("Recomputed price_at_mention for %d mention(s)", updated)
    return updated


def mark_duplicates(conn) -> int:
    """Flag repeat calls so one opinion is counted once."""
    with conn.cursor() as cur:
        cur.execute(
            """
            WITH ordered AS (
                SELECT p.id,
                       p.channel_id,
                       ma.asset_code,
                       p.prediction_type,
                       p.predicted_at,
                       LAG(p.predicted_at) OVER (
                           PARTITION BY p.channel_id, ma.asset_code, p.prediction_type
                           ORDER BY p.predicted_at
                       ) AS prev_at
                FROM predictions p
                JOIN mentioned_assets ma ON p.mentioned_asset_id = ma.id
                WHERE p.predicted_at IS NOT NULL AND ma.asset_code IS NOT NULL
            )
            UPDATE predictions p
            SET is_duplicate = TRUE
            FROM ordered o
            WHERE p.id = o.id
              AND o.prev_at IS NOT NULL
              AND o.predicted_at - o.prev_at < INTERVAL '%s days'
              AND NOT p.is_duplicate
            """
            % DUPLICATE_WINDOW_DAYS
        )
        marked = cur.rowcount

        # A channel holding both directions on one asset in the same video is
        # hedging, not predicting; neither side should count.
        cur.execute(
            """
            UPDATE predictions p
            SET evaluation_status = 'contradictory', is_duplicate = TRUE
            WHERE p.id IN (
                SELECT p1.id
                FROM predictions p1
                JOIN predictions p2
                  ON p1.video_id = p2.video_id
                 AND p1.mentioned_asset_id = p2.mentioned_asset_id
                 AND p1.prediction_type = 'buy'
                 AND p2.prediction_type = 'sell'
            )
            AND p.evaluation_status <> 'contradictory'
            """
        )
        contradictory = cur.rowcount
        conn.commit()

    logger.info("Marked %d duplicate(s), %d contradictory prediction(s)", marked, contradictory)
    return marked


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--all", action="store_true", help="run every step")
    parser.add_argument("--market", action="store_true")
    parser.add_argument("--history", action="store_true")
    parser.add_argument("--mentions", action="store_true")
    parser.add_argument("--duplicates", action="store_true")
    parser.add_argument("--limit", type=int, help="cap assets processed by --history")
    parser.add_argument("--days", type=int, default=400)
    args = parser.parse_args()

    steps = {
        "market": args.all or args.market,
        "history": args.all or args.history,
        "mentions": args.all or args.mentions,
        "duplicates": args.all or args.duplicates,
    }
    if not any(steps.values()):
        parser.print_help()
        return 1

    with get_conn() as conn:
        if steps["market"]:
            logger.info("=== Market backfill ===")
            backfill_market(conn)
        if steps["history"]:
            logger.info("=== Price history backfill ===")
            backfill_history(conn, limit=args.limit, days=args.days)
        if steps["mentions"]:
            logger.info("=== price_at_mention recompute ===")
            backfill_price_at_mention(conn)
        if steps["duplicates"]:
            logger.info("=== Duplicate marking ===")
            mark_duplicates(conn)

    close_pool()
    return 0


if __name__ == "__main__":
    sys.exit(main())
