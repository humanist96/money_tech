"""Run price collection, prediction evaluation, comment analysis, and channel classification."""
from __future__ import annotations

import os
from dotenv import load_dotenv

from db import get_conn, close_pool
from logger import logger
from price_collector import collect_prices_for_predictions, record_daily_prices
from prediction_evaluator import evaluate_predictions, update_channel_hit_rates
from comment_analyzer import analyze_video_comments, update_crowd_accuracy
from channel_classifier import update_stale_classifications

load_dotenv()


def main():
    with get_conn() as conn:
        logger.info("=== Price Collection ===")
        try:
            collect_prices_for_predictions(conn)
            record_daily_prices(conn)
        except Exception as e:
            logger.error("Price collection failed: %s", e, exc_info=True)

        logger.info("=== Prediction Evaluation ===")
        try:
            evaluate_predictions(conn)
        except Exception as e:
            logger.error("Prediction evaluation failed: %s", e, exc_info=True)

        logger.info("=== Channel Hit Rate Update ===")
        try:
            update_channel_hit_rates(conn)
        except Exception as e:
            logger.error("Hit rate update failed: %s", e, exc_info=True)

        logger.info("=== Comment Analysis ===")
        try:
            comment_results = analyze_video_comments(conn, max_videos=30)
            logger.info("Comment analysis: %s", comment_results)
            update_crowd_accuracy(conn)
        except Exception as e:
            logger.error("Comment analysis failed: %s", e, exc_info=True)

        logger.info("=== Channel Classification ===")
        try:
            updated = update_stale_classifications(conn, days=30, stale_days=7)
            logger.info("Re-classified %d channels", updated)
        except Exception as e:
            logger.error("Channel classification failed: %s", e, exc_info=True)

        logger.info("=== Evaluation pipeline complete ===")

    close_pool()


if __name__ == "__main__":
    main()
