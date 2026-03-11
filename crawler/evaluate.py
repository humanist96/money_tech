"""Run price collection, prediction evaluation, comment analysis, and channel classification."""
from __future__ import annotations

import os
import psycopg2
from dotenv import load_dotenv

from price_collector import collect_prices_for_predictions, record_daily_prices
from prediction_evaluator import evaluate_predictions, update_channel_hit_rates
from comment_analyzer import analyze_video_comments, update_crowd_accuracy
from channel_classifier import update_stale_classifications

load_dotenv()
DATABASE_URL = os.environ["DATABASE_URL"]


def main():
    conn = psycopg2.connect(DATABASE_URL)
    try:
        print("=== Price Collection ===")
        try:
            collect_prices_for_predictions(conn)
            record_daily_prices(conn)
        except Exception as e:
            print(f"  Warning: price collection failed: {e}")

        print("\n=== Prediction Evaluation ===")
        try:
            evaluate_predictions(conn)
        except Exception as e:
            print(f"  Warning: prediction evaluation failed: {e}")

        print("\n=== Channel Hit Rate Update ===")
        try:
            update_channel_hit_rates(conn)
        except Exception as e:
            print(f"  Warning: hit rate update failed: {e}")

        print("\n=== Comment Analysis ===")
        try:
            comment_results = analyze_video_comments(conn, max_videos=30)
            print(f"  Comment analysis: {comment_results}")
            update_crowd_accuracy(conn)
        except Exception as e:
            print(f"  Warning: comment analysis failed: {e}")

        print("\n=== Channel Classification ===")
        try:
            updated = update_stale_classifications(conn, days=30, stale_days=7)
            print(f"  Re-classified {updated} channels")
        except Exception as e:
            print(f"  Warning: channel classification failed: {e}")

        print("\n=== Evaluation pipeline complete ===")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
