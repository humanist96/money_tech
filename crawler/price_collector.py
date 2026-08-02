"""Collect stock and coin prices for prediction evaluation."""
from __future__ import annotations

import time

import requests

from http_util import RateLimiter
from logger import logger

# ~500 tickers per evaluate run; keep the pace neighbourly.
_naver_limiter = RateLimiter(0.15)

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


NAVER_TREND_API = "https://m.stock.naver.com/api/stock/{code}/trend"


def get_stock_price(code: str, date_str: str | None = None) -> float | None:
    """Closing price for a Korean ticker on the given KST date.

    pykrx was dropped: its adjusted-price path fetches from Naver's legacy
    fchart host, which GitHub runners cannot reach — every call hung ~4.5
    minutes before failing, which is what was eating the evaluate job's
    timeout. The mobile API answers in milliseconds and already serves the
    movers pipeline from the same runners.

    US tickers return None immediately; fchart never served them either, so
    nothing regresses — their prices come from price_history's range fetch.
    """
    if not (code.isdigit() and len(code) == 6):
        return None

    # The recorded_date this pairs with is computed in KST; using the
    # runner's local date (UTC) here labelled yesterday's close as today
    # on early-morning-KST runs.
    from price_history import today_kst
    target = date_str.replace("-", "") if date_str else today_kst().strftime("%Y%m%d")

    _naver_limiter.wait()
    try:
        resp = requests.get(
            NAVER_TREND_API.format(code=code),
            headers={"User-Agent": "Mozilla/5.0"},
            timeout=15,
        )
        resp.raise_for_status()
        rows = resp.json()
    except Exception as e:
        logger.warning("Stock price fetch failed for %s: %s", code, e)
        return None

    # The API serves roughly the last ten sessions; a date outside that
    # window (or a non-trading day) records nothing rather than borrowing
    # a neighbouring session's close.
    row = next((r for r in rows if isinstance(r, dict) and r.get("bizdate") == target), None)
    if not row:
        return None
    try:
        price = float(str(row.get("closePrice") or "0").replace(",", ""))
    except ValueError:
        return None
    return price if price > 0 else None


def record_daily_prices(conn) -> int:
    """Record today's close for every asset still awaiting evaluation.

    Scoped by open evaluations rather than recent mentions: a 3-month horizon
    needs a price 90 days after the call, by which time the mention has long
    left any 30-day window. The old scope silently starved long horizons and
    they resolved as `no_price_at_horizon`.
    """
    from price_history import today_kst  # local: price_history imports this module

    recorded = 0
    today = today_kst().isoformat()

    with conn.cursor() as cur:
        # "Still awaiting evaluation" must be read from prediction_evaluations,
        # not approximated by a 120-day mention window: a prediction older than
        # the window whose 3m horizon is still open needs today's price too.
        # The date floor only trims predictions so old that every horizon
        # already resolved or expired past the slack window.
        cur.execute("""
            SELECT DISTINCT ma.asset_code, ma.asset_type
            FROM predictions p
            JOIN mentioned_assets ma ON ma.id = p.mentioned_asset_id
            WHERE ma.asset_code IS NOT NULL
              AND ma.asset_type IN ('stock', 'coin')
              AND NOT p.is_duplicate
              AND p.prediction_type IN ('buy', 'sell', 'hold')
              AND p.predicted_at >= NOW() - INTERVAL '100 days'
              AND EXISTS (
                  SELECT 1 FROM (SELECT unnest(ARRAY['1w','1m','3m']) AS h) hs
                  WHERE NOT EXISTS (
                      SELECT 1 FROM prediction_evaluations pe
                      WHERE pe.prediction_id = p.id
                        AND pe.horizon = hs.h
                        AND pe.evaluation_version = 2
                        AND pe.outcome IN ('hit', 'miss', 'push')
                  )
              )
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
