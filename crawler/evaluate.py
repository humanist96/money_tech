"""Run price collection and prediction evaluation pipeline."""
from __future__ import annotations

import os
import psycopg2
from dotenv import load_dotenv

from price_collector import collect_prices_for_predictions, record_daily_prices
from prediction_evaluator import evaluate_predictions, update_channel_hit_rates

load_dotenv()
DATABASE_URL = os.environ["DATABASE_URL"]


def main():
    conn = psycopg2.connect(DATABASE_URL)
    try:
        print("=== Price Collection ===")
        collect_prices_for_predictions(conn)
        record_daily_prices(conn)

        print("\n=== Prediction Evaluation ===")
        evaluate_predictions(conn)

        print("\n=== Channel Hit Rate Update ===")
        update_channel_hit_rates(conn)

        print("\n=== Evaluation pipeline complete ===")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
