"""Evaluate prediction accuracy using directional prediction (up/down)."""
from __future__ import annotations

from datetime import datetime

import psycopg2

from price_collector import get_stock_price, get_coin_price


def evaluate_predictions(conn) -> dict:
    """
    Evaluate all unevaluated predictions using directional accuracy.
    - buy: price went up → correct
    - sell: price went down → correct
    - hold: excluded from directional evaluation
    Updates direction_1w, direction_1m, direction_3m and direction_score.
    """
    results = {"evaluated_1w": 0, "evaluated_1m": 0, "evaluated_3m": 0, "total": 0}
    now = datetime.now(tz=None)

    with conn.cursor() as cur:
        cur.execute("""
            SELECT p.id, p.prediction_type, p.predicted_at,
                   p.actual_price_after_1w, p.actual_price_after_1m, p.actual_price_after_3m,
                   p.direction_1w, p.direction_1m, p.direction_3m,
                   ma.asset_code, ma.asset_type, ma.price_at_mention
            FROM predictions p
            JOIN mentioned_assets ma ON p.mentioned_asset_id = ma.id
            WHERE p.prediction_type IN ('buy', 'sell')
            AND ma.price_at_mention IS NOT NULL
            AND (p.direction_1w IS NULL OR p.direction_1m IS NULL OR p.direction_3m IS NULL)
        """)
        predictions = cur.fetchall()
        results["total"] = len(predictions)

        for row in predictions:
            (pred_id, pred_type, predicted_at,
             price_1w, price_1m, price_3m,
             dir_1w, dir_1m, dir_3m,
             asset_code, asset_type, price_at_mention) = row

            if predicted_at is None:
                continue

            pa = predicted_at.replace(tzinfo=None) if hasattr(predicted_at, 'tzinfo') and predicted_at.tzinfo else predicted_at
            days_elapsed = (now - pa).days

            # Collect prices for each period
            if price_1w is None and days_elapsed >= 7:
                price = _get_current_price(asset_code, asset_type)
                if price is not None:
                    cur.execute(
                        "UPDATE predictions SET actual_price_after_1w = %s WHERE id = %s",
                        (price, pred_id),
                    )
                    price_1w = price
                    results["evaluated_1w"] += 1

            if price_1m is None and days_elapsed >= 30:
                price = _get_current_price(asset_code, asset_type)
                if price is not None:
                    cur.execute(
                        "UPDATE predictions SET actual_price_after_1m = %s WHERE id = %s",
                        (price, pred_id),
                    )
                    price_1m = price
                    results["evaluated_1m"] += 1

            if price_3m is None and days_elapsed >= 90:
                price = _get_current_price(asset_code, asset_type)
                if price is not None:
                    cur.execute(
                        "UPDATE predictions SET actual_price_after_3m = %s WHERE id = %s",
                        (price, pred_id),
                    )
                    price_3m = price
                    results["evaluated_3m"] += 1

            # Evaluate direction for each period
            new_dir_1w = dir_1w
            new_dir_1m = dir_1m
            new_dir_3m = dir_3m

            if dir_1w is None and price_1w is not None:
                new_dir_1w = _check_direction(pred_type, price_at_mention, price_1w)

            if dir_1m is None and price_1m is not None:
                new_dir_1m = _check_direction(pred_type, price_at_mention, price_1m)

            if dir_3m is None and price_3m is not None:
                new_dir_3m = _check_direction(pred_type, price_at_mention, price_3m)

            # Calculate direction_score (weighted: 1w=50%, 1m=30%, 3m=20%)
            direction_score = _calc_direction_score(new_dir_1w, new_dir_1m, new_dir_3m)

            # Also set is_accurate for backward compat (based on direction_score)
            is_accurate = None
            if direction_score is not None:
                is_accurate = direction_score >= 0.5

            cur.execute("""
                UPDATE predictions SET
                    direction_1w = %s,
                    direction_1m = %s,
                    direction_3m = %s,
                    direction_score = %s,
                    is_accurate = %s
                WHERE id = %s
            """, (new_dir_1w, new_dir_1m, new_dir_3m, direction_score, is_accurate, pred_id))

        conn.commit()

    print(f"  Evaluated predictions: {results}")
    return results


def evaluate_target_price_accuracy(conn) -> dict:
    """Evaluate analyst target price accuracy.

    For predictions with target_price set, compare against actual prices
    and calculate deviation percentage.

    Returns:
        Dict with evaluation stats
    """
    results = {"evaluated": 0, "avg_deviation": None}

    with conn.cursor() as cur:
        cur.execute("""
            SELECT p.id, p.target_price, p.predicted_at,
                   ma.asset_code, ma.asset_type, ma.price_at_mention,
                   p.actual_price_after_1m
            FROM predictions p
            JOIN mentioned_assets ma ON p.mentioned_asset_id = ma.id
            WHERE p.target_price IS NOT NULL
            AND p.actual_price_after_1m IS NOT NULL
            AND p.confidence = 'high'
        """)
        rows = cur.fetchall()

        deviations = []
        for row in rows:
            pred_id, target_price, predicted_at, asset_code, asset_type, price_at_mention, actual_1m = row

            if target_price and actual_1m and target_price > 0:
                deviation = abs(actual_1m - target_price) / target_price
                deviations.append(deviation)

        if deviations:
            results["evaluated"] = len(deviations)
            results["avg_deviation"] = round(sum(deviations) / len(deviations), 4)

    print(f"  Target price accuracy: {results}")
    return results


def update_channel_hit_rates(conn) -> int:
    """Recalculate hit_rate using direction_score average."""
    updated = 0
    with conn.cursor() as cur:
        cur.execute("""
            SELECT c.id,
                AVG(p.direction_score) AS avg_direction_score,
                COUNT(CASE WHEN p.direction_score IS NOT NULL THEN 1 END) AS total_preds
            FROM channels c
            LEFT JOIN predictions p ON p.channel_id = c.id
                AND p.direction_score IS NOT NULL
            GROUP BY c.id
            HAVING COUNT(CASE WHEN p.direction_score IS NOT NULL THEN 1 END) > 0
        """)
        rows = cur.fetchall()

        for channel_id, avg_score, total_preds in rows:
            if avg_score is not None:
                hit_rate = float(avg_score)
                trust_score = min(hit_rate * min(total_preds / 10, 1.0), 1.0)
                cur.execute(
                    "UPDATE channels SET hit_rate = %s, trust_score = %s WHERE id = %s",
                    (hit_rate, trust_score, channel_id),
                )
                updated += 1

        conn.commit()
    print(f"  Updated hit rates for {updated} channels (direction-based)")
    return updated


def _get_current_price(asset_code: str, asset_type: str) -> float | None:
    """Get current price for an asset."""
    if asset_type == "coin":
        return get_coin_price(asset_code)
    elif asset_type == "stock":
        return get_stock_price(asset_code)
    return None


def _check_direction(prediction_type: str, price_at_mention: float, actual_price: float) -> bool:
    """Check if direction prediction was correct. Simple up/down check."""
    if price_at_mention <= 0:
        return False
    if prediction_type == "buy":
        return actual_price > price_at_mention
    elif prediction_type == "sell":
        return actual_price < price_at_mention
    return False


def _calc_direction_score(dir_1w, dir_1m, dir_3m) -> float | None:
    """Calculate weighted direction score. 1w=50%, 1m=30%, 3m=20%."""
    weights = []
    if dir_1w is not None:
        weights.append((0.5, 1.0 if dir_1w else 0.0))
    if dir_1m is not None:
        weights.append((0.3, 1.0 if dir_1m else 0.0))
    if dir_3m is not None:
        weights.append((0.2, 1.0 if dir_3m else 0.0))

    if not weights:
        return None

    total_weight = sum(w for w, _ in weights)
    score = sum(w * v for w, v in weights) / total_weight
    return round(score, 3)
