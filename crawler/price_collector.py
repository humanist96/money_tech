"""Collect stock and coin prices for prediction evaluation."""
from __future__ import annotations

import os
from datetime import datetime, timedelta

import requests
import psycopg2

# CoinGecko symbol mapping
COINGECKO_IDS = {
    "BTC": "bitcoin", "ETH": "ethereum", "XRP": "ripple",
    "SOL": "solana", "DOGE": "dogecoin", "ADA": "cardano",
    "DOT": "polkadot", "LINK": "chainlink", "AVAX": "avalanche-2",
    "MATIC": "matic-network", "SHIB": "shiba-inu", "UNI": "uniswap",
    "APT": "aptos", "ARB": "arbitrum", "OP": "optimism",
    "SUI": "sui", "NEAR": "near", "ATOM": "cosmos",
    "XLM": "stellar", "TRX": "tron", "LTC": "litecoin",
    "EOS": "eos", "BCH": "bitcoin-cash", "HBAR": "hedera-hashgraph",
    "FIL": "filecoin", "SAND": "the-sandbox", "MANA": "decentraland",
    "LUNA": "terra-luna-2",
    "TON": "the-open-network", "WLD": "worldcoin-wld",
    "FET": "fetch-ai", "RNDR": "render-token",
    "INJ": "injective-protocol", "SEI": "sei-network",
    "TIA": "celestia", "JUP": "jupiter-exchange-solana",
    "BONK": "bonk", "PEPE": "pepe",
    "STX": "blockstack", "KAS": "kaspa",
    "IMX": "immutable-x", "POL": "polygon-ecosystem-token",
    "PI": "pi-network",
}


def get_coin_price(symbol: str) -> float | None:
    """Fetch current coin price in KRW from CoinGecko API."""
    coin_id = COINGECKO_IDS.get(symbol)
    if not coin_id:
        return None
    try:
        url = f"https://api.coingecko.com/api/v3/simple/price?ids={coin_id}&vs_currencies=krw"
        r = requests.get(url, timeout=10)
        r.raise_for_status()
        return r.json().get(coin_id, {}).get("krw")
    except Exception as e:
        print(f"  Warning: CoinGecko price fetch failed for {symbol}: {e}")
        return None


def get_stock_price(code: str, date_str: str = None) -> float | None:
    """Fetch Korean stock closing price. Uses pykrx if available, else returns None."""
    try:
        from pykrx import stock
        if date_str is None:
            date_str = datetime.now().strftime("%Y%m%d")
        else:
            date_str = date_str.replace("-", "")
        df = stock.get_market_ohlcv(date_str, date_str, code)
        if df.empty:
            return None
        return float(df["종가"].iloc[0])
    except ImportError:
        print("  Warning: pykrx not installed, skipping stock price")
        return None
    except Exception as e:
        print(f"  Warning: stock price fetch failed for {code}: {e}")
        return None


def collect_prices_for_predictions(conn) -> int:
    """Fetch prices for predictions that don't have price_at_mention yet."""
    updated = 0
    with conn.cursor() as cur:
        cur.execute("""
            SELECT p.id, ma.asset_code, ma.asset_type
            FROM predictions p
            JOIN mentioned_assets ma ON p.mentioned_asset_id = ma.id
            WHERE p.prediction_type IS NOT NULL
            AND ma.price_at_mention IS NULL
            AND ma.asset_code IS NOT NULL
        """)
        rows = cur.fetchall()

        for pred_id, asset_code, asset_type in rows:
            price = None
            if asset_type == "coin":
                price = get_coin_price(asset_code)
            elif asset_type == "stock":
                price = get_stock_price(asset_code)

            if price is not None:
                cur.execute(
                    "UPDATE mentioned_assets SET price_at_mention = %s WHERE asset_code = %s AND price_at_mention IS NULL",
                    (price, asset_code),
                )
                updated += 1

        conn.commit()
    print(f"  Collected prices for {updated} predictions")
    return updated


def record_daily_prices(conn) -> int:
    """Record daily prices for all actively mentioned assets."""
    recorded = 0
    today = datetime.now().strftime("%Y-%m-%d")

    with conn.cursor() as cur:
        # Get unique asset codes mentioned in last 30 days
        cur.execute("""
            SELECT DISTINCT ma.asset_code, ma.asset_type
            FROM mentioned_assets ma
            JOIN videos v ON ma.video_id = v.id
            WHERE v.published_at >= NOW() - INTERVAL '30 days'
            AND ma.asset_code IS NOT NULL
        """)
        assets = cur.fetchall()

        for asset_code, asset_type in assets:
            price = None
            if asset_type == "coin":
                price = get_coin_price(asset_code)
            elif asset_type == "stock":
                price = get_stock_price(asset_code)

            if price is not None:
                try:
                    cur.execute(
                        """INSERT INTO asset_prices (asset_code, asset_type, price, recorded_date)
                        VALUES (%s, %s, %s, %s)
                        ON CONFLICT (asset_code, recorded_date) DO UPDATE SET price = EXCLUDED.price""",
                        (asset_code, asset_type, price, today),
                    )
                    recorded += 1
                except Exception as e:
                    print(f"  Warning: price record failed for {asset_code}: {e}")

        conn.commit()
    print(f"  Recorded {recorded} daily prices")
    return recorded
