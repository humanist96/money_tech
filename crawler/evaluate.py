"""Price history load, prediction scoring, and derived stats.

Order matters: history is loaded first so scoring only ever reads prices by
date. Nothing in the scoring path calls an external quote API — that is what
allowed the old pipeline to evaluate a one-week horizon using whatever the
price happened to be on the day the script ran.
"""
from __future__ import annotations

from dotenv import load_dotenv

from db import get_conn, close_pool
from logger import logger
from price_history import load_benchmark_history
from price_collector import record_daily_prices
from backfill_prices import mark_duplicates
from evaluator_v2 import evaluate_predictions, requeue_unevaluable, update_channel_stats
from channel_classifier import update_stale_classifications

load_dotenv()


def refresh_materialized_views(conn):
    """Refresh materialized views after data update."""
    logger.info("Refreshing materialized views...")
    cur = conn.cursor()
    try:
        cur.execute("SELECT refresh_materialized_views()")
        conn.commit()
        logger.info("Materialized views refreshed successfully")
    except Exception as e:
        logger.error("Failed to refresh materialized views: %s", e, exc_info=True)
        conn.rollback()
    finally:
        cur.close()


def prune_log_tables(conn):
    """Apply retention to append-only tables (api_usage_log, search_cache)."""
    logger.info("Pruning log tables...")
    cur = conn.cursor()
    try:
        cur.execute("SELECT prune_log_tables()")
        conn.commit()
    except Exception as e:
        logger.error("Log pruning failed: %s", e, exc_info=True)
        conn.rollback()
    finally:
        cur.close()


def main():
    with get_conn() as conn:
        logger.info("=== Benchmark History ===")
        try:
            load_benchmark_history(conn, days=120)
        except Exception as e:
            logger.error("Benchmark history load failed: %s", e, exc_info=True)

        logger.info("=== Daily Price Snapshot ===")
        try:
            record_daily_prices(conn)
        except Exception as e:
            logger.error("Price collection failed: %s", e, exc_info=True)

        logger.info("=== Duplicate / Contradiction Marking ===")
        try:
            mark_duplicates(conn)
        except Exception as e:
            logger.error("Duplicate marking failed: %s", e, exc_info=True)

        logger.info("=== Requeue Unevaluable (prices arrived since) ===")
        try:
            requeue_unevaluable(conn)
        except Exception as e:
            logger.error("Requeue failed: %s", e, exc_info=True)

        logger.info("=== Prediction Evaluation (v2) ===")
        try:
            evaluate_predictions(conn)
        except Exception as e:
            logger.error("Prediction evaluation failed: %s", e, exc_info=True)

        logger.info("=== Channel Stats ===")
        try:
            update_channel_stats(conn)
        except Exception as e:
            logger.error("Channel stats update failed: %s", e, exc_info=True)

        logger.info("=== Channel Classification ===")
        try:
            updated = update_stale_classifications(conn, days=30, stale_days=7)
            logger.info("Re-classified %d channels", updated)
        except Exception as e:
            logger.error("Channel classification failed: %s", e, exc_info=True)

        logger.info("=== Refresh Materialized Views ===")
        try:
            refresh_materialized_views(conn)
        except Exception as e:
            logger.error("Materialized view refresh failed: %s", e, exc_info=True)

        logger.info("=== Log Retention ===")
        try:
            prune_log_tables(conn)
        except Exception as e:
            logger.error("Log pruning failed: %s", e, exc_info=True)

        logger.info("=== Evaluation pipeline complete ===")

    close_pool()


if __name__ == "__main__":
    main()
