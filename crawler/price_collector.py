"""Collect stock and coin prices for prediction evaluation."""
from __future__ import annotations

import time
from datetime import datetime

import requests

from logger import logger

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

# Reverse mapping: coingecko_id -> symbol
_ID_TO_SYMBOL = {v: k for k, v in COINGECKO_IDS.items()}

# Cache for batch-fetched coin prices
_coin_price_cache: dict[str, float | None] = {}
_cache_time: float = 0


def get_coin_prices_batch(symbols: list[str]) -> dict[str, float | None]:
    """Fetch multiple coin prices in a single API call."""
    global _coin_price_cache, _cache_time

    # Use cache if less than 60 seconds old
    if time.time() - _cache_time < 60 and _coin_price_cache:
        return {s: _coin_price_cache.get(s) for s in symbols}

    coin_ids = []
    for s in set(symbols):
        cid = COINGECKO_IDS.get(s)
        if cid:
            coin_ids.append(cid)

    if not coin_ids:
        return {s: None for s in symbols}

    result: dict[str, float | None] = {}

    # CoinGecko allows up to ~250 ids per request
    for i in range(0, len(coin_ids), 50):
        batch = coin_ids[i:i + 50]
        try:
            url = f"https://api.coingecko.com/api/v3/simple/price?ids={','.join(batch)}&vs_currencies=krw"
            r = requests.get(url, timeout=15)
            r.raise_for_status()
            data = r.json()
            for cid, prices in data.items():
                sym = _ID_TO_SYMBOL.get(cid)
                if sym and "krw" in prices:
                    result[sym] = prices["krw"]
        except Exception as e:
            logger.warning("CoinGecko batch fetch failed: %s", e)

        if i + 50 < len(coin_ids):
            time.sleep(2)  # Rate limit between batches

    _coin_price_cache = result
    _cache_time = time.time()

    return {s: result.get(s) for s in symbols}


def get_coin_price(symbol: str) -> float | None:
    """Fetch current coin price in KRW from CoinGecko API (uses batch cache)."""
    prices = get_coin_prices_batch([symbol])
    return prices.get(symbol)


def get_stock_price(code: str, date_str: str | None = None) -> float | None:
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
        logger.warning("pykrx not installed, skipping stock price")
        return None
    except Exception as e:
        logger.warning("Stock price fetch failed for %s: %s", code, e)
        return None


def collect_prices_for_predictions(conn) -> int:
    """Fetch prices for predictions that don't have price_at_mention yet."""
    updated = 0
    with conn.cursor() as cur:
        cur.execute("""
            SELECT DISTINCT ma.asset_code, ma.asset_type
            FROM predictions p
            JOIN mentioned_assets ma ON p.mentioned_asset_id = ma.id
            WHERE p.prediction_type IS NOT NULL
            AND ma.price_at_mention IS NULL
            AND ma.asset_code IS NOT NULL
        """)
        needed = cur.fetchall()

        # Batch fetch all coin prices at once
        coin_symbols = [code for code, atype in needed if atype == "coin"]
        coin_prices = get_coin_prices_batch(coin_symbols) if coin_symbols else {}

        for asset_code, asset_type in needed:
            price = None
            if asset_type == "coin":
                price = coin_prices.get(asset_code)
            elif asset_type == "stock":
                price = get_stock_price(asset_code)

            if price is not None:
                cur.execute(
                    "UPDATE mentioned_assets SET price_at_mention = %s WHERE asset_code = %s AND price_at_mention IS NULL",
                    (price, asset_code),
                )
                updated += 1

        conn.commit()
    logger.info("Collected prices for %d assets", updated)
    return updated


def record_daily_prices(conn) -> int:
    """Record daily prices for all actively mentioned assets."""
    recorded = 0
    today = datetime.now().strftime("%Y-%m-%d")

    with conn.cursor() as cur:
        cur.execute("""
            SELECT DISTINCT ma.asset_code, ma.asset_type
            FROM mentioned_assets ma
            JOIN videos v ON ma.video_id = v.id
            WHERE v.published_at >= NOW() - INTERVAL '30 days'
            AND ma.asset_code IS NOT NULL
        """)
        assets = cur.fetchall()

        # Batch fetch all coin prices at once
        coin_symbols = [code for code, atype in assets if atype == "coin"]
        coin_prices = get_coin_prices_batch(coin_symbols) if coin_symbols else {}

        for asset_code, asset_type in assets:
            price = None
            if asset_type == "coin":
                price = coin_prices.get(asset_code)
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
                    logger.warning("Price record failed for %s: %s", asset_code, e)

        conn.commit()
    logger.info("Recorded %d daily prices", recorded)
    return recorded
