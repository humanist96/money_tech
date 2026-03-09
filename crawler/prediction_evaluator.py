"""Evaluate prediction accuracy by comparing predicted vs actual prices."""
from __future__ import annotations

import json
from datetime import datetime, timedelta

import psycopg2

from price_collector import get_stock_price, get_coin_price


def evaluate_predictions(conn) -> dict:
    """
    Evaluate all unevaluated predictions where enough time has passed.
    Updates actual_price_after_1w, 1m, 3m and is_accurate.
    """
    results = {"evaluated_1w": 0, "evaluated_1m": 0, "evaluated_3m": 0, "total": 0}
    now = datetime.now(tz=None)  # naive UTC

    with conn.cursor() as cur:
        cur.execute("""
            SELECT p.id, p.prediction_type, p.predicted_at,
                   p.actual_price_after_1w, p.actual_price_after_1m, p.actual_price_after_3m,
                   ma.asset_code, ma.asset_type, ma.price_at_mention
            FROM predictions p
            JOIN mentioned_assets ma ON p.mentioned_asset_id = ma.id
            WHERE p.prediction_type IS NOT NULL
            AND ma.price_at_mention IS NOT NULL
            AND p.is_accurate IS NULL
        """)
        predictions = cur.fetchall()
        results["total"] = len(predictions)

        for row in predictions:
            pred_id, pred_type, predicted_at, price_1w, price_1m, price_3m, \
                asset_code, asset_type, price_at_mention = row

            if predicted_at is None:
                continue

            # Handle timezone-aware datetimes
            pa = predicted_at.replace(tzinfo=None) if hasattr(predicted_at, 'tzinfo') and predicted_at.tzinfo else predicted_at
            days_elapsed = (now - pa).days

            # 1 week evaluation
            if price_1w is None and days_elapsed >= 7:
                price = _get_current_price(asset_code, asset_type)
                if price is not None:
                    cur.execute(
                        "UPDATE predictions SET actual_price_after_1w = %s WHERE id = %s",
                        (price, pred_id),
                    )
                    price_1w = price
                    results["evaluated_1w"] += 1

            # 1 month evaluation
            if price_1m is None and days_elapsed >= 30:
                price = _get_current_price(asset_code, asset_type)
                if price is not None:
                    cur.execute(
                        "UPDATE predictions SET actual_price_after_1m = %s WHERE id = %s",
                        (price, pred_id),
                    )
                    price_1m = price
                    results["evaluated_1m"] += 1

            # 3 month evaluation
            if price_3m is None and days_elapsed >= 90:
                price = _get_current_price(asset_code, asset_type)
                if price is not None:
                    cur.execute(
                        "UPDATE predictions SET actual_price_after_3m = %s WHERE id = %s",
                        (price, pred_id),
                    )
                    price_3m = price
                    results["evaluated_3m"] += 1

            # Calculate accuracy using the latest available price comparison
            actual_price = price_3m or price_1m or price_1w
            if actual_price is not None and price_at_mention > 0:
                is_accurate = _check_accuracy(pred_type, price_at_mention, actual_price)
                cur.execute(
                    "UPDATE predictions SET is_accurate = %s WHERE id = %s",
                    (is_accurate, pred_id),
                )

        conn.commit()

    print(f"  Evaluated predictions: {results}")
    return results


def update_channel_hit_rates(conn) -> int:
    """Recalculate and update hit_rate for all channels."""
    updated = 0
    with conn.cursor() as cur:
        cur.execute("""
            SELECT c.id,
                COUNT(CASE WHEN p.is_accurate = true THEN 1 END)::float /
                    NULLIF(COUNT(p.id), 0) AS hit_rate,
                COUNT(p.id) AS total_preds
            FROM channels c
            LEFT JOIN predictions p ON p.channel_id = c.id
                AND p.is_accurate IS NOT NULL
            GROUP BY c.id
            HAVING COUNT(p.id) > 0
        """)
        rows = cur.fetchall()

        for channel_id, hit_rate, total_preds in rows:
            if hit_rate is not None:
                # trust_score: weighted by prediction count (more data = more trust)
                trust_score = min(hit_rate * min(total_preds / 10, 1.0), 1.0)
                cur.execute(
                    "UPDATE channels SET hit_rate = %s, trust_score = %s WHERE id = %s",
                    (hit_rate, trust_score, channel_id),
                )
                updated += 1

        conn.commit()
    print(f"  Updated hit rates for {updated} channels")
    return updated


def _get_current_price(asset_code: str, asset_type: str) -> float | None:
    """Get current price for an asset."""
    if asset_type == "coin":
        return get_coin_price(asset_code)
    elif asset_type == "stock":
        return get_stock_price(asset_code)
    return None


def _check_accuracy(prediction_type: str, price_at_mention: float, actual_price: float) -> bool:
    """Check if a prediction was accurate based on 3% threshold."""
    if price_at_mention <= 0:
        return False
    price_change = (actual_price - price_at_mention) / price_at_mention

    if prediction_type == "buy":
        return price_change > 0.03  # 3% gain = accurate
    elif prediction_type == "sell":
        return price_change < -0.03  # 3% drop = accurate
    else:  # hold
        return abs(price_change) < 0.03  # sideways = accurate
