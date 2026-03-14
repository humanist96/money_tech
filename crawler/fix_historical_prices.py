"""Fix historical prices: replace wrong 'today' prices with actual prices at video publish date."""
from __future__ import annotations

import os
import time
from datetime import datetime, timedelta

import psycopg2
from dotenv import load_dotenv

load_dotenv()


def get_stock_price_on_date(code: str, target_date: str) -> float | None:
    """Get stock closing price on a specific date using pykrx.
    If exact date has no data (weekend/holiday), searches nearby dates.
    """
    try:
        from pykrx import stock
        dt = datetime.strptime(target_date, "%Y-%m-%d")
        # Search a 5-day window around target date
        start = (dt - timedelta(days=3)).strftime("%Y%m%d")
        end = (dt + timedelta(days=1)).strftime("%Y%m%d")
        df = stock.get_market_ohlcv(start, end, code)
        if df.empty:
            return None
        # Get closest date <= target
        target_ts = dt.strftime("%Y%m%d")
        valid = df[df.index.strftime("%Y%m%d") <= target_ts]
        if not valid.empty:
            return float(valid["종가"].iloc[-1])
        return float(df["종가"].iloc[0])
    except Exception as e:
        print(f"    pykrx error for {code} on {target_date}: {e}")
        return None


def get_coin_price_on_date(symbol: str, target_date: str) -> float | None:
    """Get coin price on a specific date from CoinGecko history API."""
    import requests
    COINGECKO_IDS = {
        "BTC": "bitcoin", "ETH": "ethereum", "XRP": "ripple",
        "SOL": "solana", "DOGE": "dogecoin", "ADA": "cardano",
        "DOT": "polkadot", "LINK": "chainlink", "AVAX": "avalanche-2",
        "MATIC": "matic-network", "SHIB": "shiba-inu",
        "TON": "the-open-network", "PI": "pi-network",
        "PEPE": "pepe", "BONK": "bonk",
    }
    coin_id = COINGECKO_IDS.get(symbol)
    if not coin_id:
        return None
    try:
        # CoinGecko history format: dd-mm-yyyy
        dt = datetime.strptime(target_date, "%Y-%m-%d")
        date_str = dt.strftime("%d-%m-%Y")
        url = f"https://api.coingecko.com/api/v3/coins/{coin_id}/history?date={date_str}"
        r = requests.get(url, timeout=10)
        if r.status_code == 429:
            time.sleep(5)
            return None
        r.raise_for_status()
        data = r.json()
        krw = data.get("market_data", {}).get("current_price", {}).get("krw")
        return krw
    except Exception as e:
        print(f"    CoinGecko history error for {symbol} on {target_date}: {e}")
        return None


def fix_all_prices(conn) -> dict:
    """Fix price_at_mention with historical prices and re-evaluate."""
    results = {"fixed_mention": 0, "fixed_1w": 0, "evaluated": 0, "errors": 0}

    with conn.cursor() as cur:
        # Get all predictions with video publish dates
        cur.execute("""
            SELECT p.id, p.prediction_type, p.predicted_at,
                   ma.id as ma_id, ma.asset_code, ma.asset_type, ma.asset_name,
                   v.published_at
            FROM predictions p
            JOIN mentioned_assets ma ON p.mentioned_asset_id = ma.id
            JOIN videos v ON p.video_id = v.id
            WHERE v.published_at IS NOT NULL
              AND ma.asset_code IS NOT NULL
              AND p.prediction_type IS NOT NULL
            ORDER BY v.published_at DESC
        """)
        predictions = cur.fetchall()

    print(f"Processing {len(predictions)} predictions...")

    # Cache prices to avoid redundant lookups
    price_cache: dict[str, float | None] = {}

    for pred_id, pred_type, predicted_at, ma_id, asset_code, asset_type, asset_name, published_at in predictions:
        pub_date = published_at.strftime("%Y-%m-%d") if published_at else None
        if not pub_date:
            continue

        # --- Fix price_at_mention ---
        cache_key = f"{asset_code}:{pub_date}"
        if cache_key not in price_cache:
            if asset_type == "stock":
                price_cache[cache_key] = get_stock_price_on_date(asset_code, pub_date)
            elif asset_type == "coin":
                price_cache[cache_key] = get_coin_price_on_date(asset_code, pub_date)
                time.sleep(0.3)  # Rate limit
            else:
                price_cache[cache_key] = None

        mention_price = price_cache[cache_key]
        if mention_price is not None:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE mentioned_assets SET price_at_mention = %s WHERE id = %s",
                    (mention_price, ma_id),
                )
            results["fixed_mention"] += 1

        # --- Get 1-week-after price ---
        one_week_later = (published_at + timedelta(days=7)).strftime("%Y-%m-%d")
        # Only if the date has passed
        if datetime.strptime(one_week_later, "%Y-%m-%d") <= datetime.now():
            cache_key_1w = f"{asset_code}:{one_week_later}"
            if cache_key_1w not in price_cache:
                if asset_type == "stock":
                    price_cache[cache_key_1w] = get_stock_price_on_date(asset_code, one_week_later)
                elif asset_type == "coin":
                    price_cache[cache_key_1w] = get_coin_price_on_date(asset_code, one_week_later)
                    time.sleep(0.3)
                else:
                    price_cache[cache_key_1w] = None

            price_1w = price_cache[cache_key_1w]
            if price_1w is not None:
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE predictions SET actual_price_after_1w = %s WHERE id = %s",
                        (price_1w, pred_id),
                    )
                results["fixed_1w"] += 1

                # --- Evaluate accuracy ---
                if mention_price and mention_price > 0:
                    change = (price_1w - mention_price) / mention_price
                    if pred_type == "buy":
                        accurate = change > 0.03
                    elif pred_type == "sell":
                        accurate = change < -0.03
                    else:
                        accurate = abs(change) < 0.03

                    with conn.cursor() as cur:
                        cur.execute(
                            "UPDATE predictions SET is_accurate = %s, evaluation_period = '1w' WHERE id = %s",
                            (accurate, pred_id),
                        )
                    results["evaluated"] += 1

    conn.commit()
    return results


if __name__ == "__main__":
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    try:
        # First reset wrong prices
        with conn.cursor() as cur:
            cur.execute("UPDATE predictions SET actual_price_after_1w = NULL, actual_price_after_1m = NULL, actual_price_after_3m = NULL, is_accurate = NULL")
            print(f"Reset {cur.rowcount} predictions")
            cur.execute("UPDATE mentioned_assets SET price_at_mention = NULL")
            print(f"Reset {cur.rowcount} mention prices")
        conn.commit()

        results = fix_all_prices(conn)
        print(f"\nResults: {results}")

        # Update channel hit rates
        from prediction_evaluator import update_channel_hit_rates
        update_channel_hit_rates(conn)
    finally:
        conn.close()
