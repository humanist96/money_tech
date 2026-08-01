"""Point-in-time price and benchmark history.

Evaluation must read the price *as of* a date, never "the price right now". The
previous collector wrote today's quote onto every past mention of an asset,
which contaminated the denominator of every return it later computed.

Rules enforced here:
  - All evaluation reads go through asset_prices / benchmark_prices by date.
  - External APIs are only called to *load* history, never during scoring.
  - Stock quotes use adjusted closes so splits and dividends do not fabricate
    returns.
"""
from __future__ import annotations

import time
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeout
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import requests

from logger import logger
from price_collector import COINGECKO_IDS

KST = ZoneInfo("Asia/Seoul")

# Index history comes from Yahoo rather than pykrx: the KRX index endpoints now
# require account credentials, while individual ticker OHLCV still works.
BENCHMARK_TICKERS = {"KOSPI": "^KS11", "KOSDAQ": "^KQ11"}

# How far past the target date a price may be borrowed when a market was closed
# (holidays, suspended trading) before the point is treated as missing.
MAX_DATE_SLACK_DAYS = 3

# pykrx wraps endpoints that can hang indefinitely; a stalled ticker must not
# stall the whole backfill.
FETCH_TIMEOUT_SECONDS = 30
_fetch_pool = ThreadPoolExecutor(max_workers=1)


def _with_timeout(fn, *args, label: str = "fetch"):
    """Run a blocking fetch, giving up rather than hanging the run."""
    future = _fetch_pool.submit(fn, *args)
    try:
        return future.result(timeout=FETCH_TIMEOUT_SECONDS)
    except FutureTimeout:
        logger.warning("%s timed out after %ds", label, FETCH_TIMEOUT_SECONDS)
        return {}
    except Exception as e:
        logger.warning("%s failed: %s", label, e)
        return {}


def today_kst() -> date:
    return datetime.now(KST).date()


def _pykrx():
    try:
        from pykrx import stock
        return stock
    except ImportError:
        logger.warning("pykrx not installed — stock history unavailable")
        return None


def fetch_stock_closes(code: str, start: date, end: date) -> dict[date, float]:
    """Adjusted daily closes for one ticker over a date range."""
    return _with_timeout(_fetch_stock_closes_blocking, code, start, end, label=f"stock {code}")


def _fetch_stock_closes_blocking(code: str, start: date, end: date) -> dict[date, float]:
    stock = _pykrx()
    if stock is None:
        return {}
    try:
        df = stock.get_market_ohlcv(
            start.strftime("%Y%m%d"), end.strftime("%Y%m%d"), code, adjusted=True
        )
        if df is None or df.empty:
            return {}
        return {idx.date(): float(row["종가"]) for idx, row in df.iterrows() if row["종가"]}
    except Exception as e:
        logger.warning("Stock history fetch failed for %s: %s", code, e)
        return {}


def fetch_index_closes(benchmark_code: str, start: date, end: date) -> dict[date, float]:
    """Daily closes for a Korean market index."""
    ticker = BENCHMARK_TICKERS.get(benchmark_code)
    if ticker is None:
        return {}
    try:
        import yfinance as yf
    except ImportError:
        logger.warning("yfinance not installed — benchmark history unavailable")
        return {}
    try:
        df = yf.Ticker(ticker).history(
            start=start.isoformat(), end=(end + timedelta(days=1)).isoformat()
        )
        if df is None or df.empty:
            return {}
        return {
            idx.date(): float(close)
            for idx, close in df["Close"].items()
            if close and close > 0
        }
    except Exception as e:
        logger.warning("Index history fetch failed for %s: %s", benchmark_code, e)
        return {}


def fetch_coin_closes(symbol: str, days: int = 365) -> dict[date, float]:
    """Daily KRW closes for one coin.

    The free CoinGecko tier only serves ~365 days of history, so predictions
    older than that stay unevaluable rather than being scored against a
    fabricated price.
    """
    coin_id = COINGECKO_IDS.get(symbol)
    if not coin_id:
        return {}
    try:
        resp = requests.get(
            f"https://api.coingecko.com/api/v3/coins/{coin_id}/market_chart",
            params={"vs_currency": "krw", "days": min(days, 365), "interval": "daily"},
            timeout=20,
        )
        if resp.status_code == 429:
            logger.warning("CoinGecko rate limited for %s", symbol)
            time.sleep(15)
            return {}
        resp.raise_for_status()
        prices = resp.json().get("prices", [])
        out: dict[date, float] = {}
        for ts_ms, price in prices:
            d = datetime.fromtimestamp(ts_ms / 1000, tz=KST).date()
            out[d] = float(price)
        return out
    except Exception as e:
        logger.warning("Coin history fetch failed for %s: %s", symbol, e)
        return {}


def store_asset_prices(conn, asset_code: str, asset_type: str, closes: dict[date, float]) -> int:
    """Persist daily closes, ignoring dates already stored."""
    if not closes:
        return 0
    rows = [(asset_code, asset_type, price, d) for d, price in closes.items()]
    with conn.cursor() as cur:
        cur.executemany(
            """INSERT INTO asset_prices (asset_code, asset_type, price, recorded_date)
               VALUES (%s, %s, %s, %s)
               ON CONFLICT (asset_code, recorded_date) DO UPDATE SET price = EXCLUDED.price""",
            rows,
        )
    conn.commit()
    return len(rows)


def store_benchmark_prices(conn, benchmark_code: str, closes: dict[date, float]) -> int:
    if not closes:
        return 0
    rows = [(benchmark_code, price, d) for d, price in closes.items()]
    with conn.cursor() as cur:
        cur.executemany(
            """INSERT INTO benchmark_prices (benchmark_code, close_price, recorded_date)
               VALUES (%s, %s, %s)
               ON CONFLICT (benchmark_code, recorded_date) DO UPDATE
               SET close_price = EXCLUDED.close_price""",
            rows,
        )
    conn.commit()
    return len(rows)


def get_price_asof(cur, asset_code: str, target: date) -> tuple[float, date] | None:
    """Closing price on `target`, or the nearest earlier close within the slack window.

    Looking backwards only — using a later price would leak information the
    predictor could not have had.
    """
    cur.execute(
        """SELECT price, recorded_date FROM asset_prices
           WHERE asset_code = %s
             AND recorded_date <= %s
             AND recorded_date >= %s
           ORDER BY recorded_date DESC
           LIMIT 1""",
        (asset_code, target, target - timedelta(days=MAX_DATE_SLACK_DAYS)),
    )
    row = cur.fetchone()
    return (float(row[0]), row[1]) if row else None


def get_benchmark_asof(cur, benchmark_code: str, target: date) -> tuple[float, date] | None:
    cur.execute(
        """SELECT close_price, recorded_date FROM benchmark_prices
           WHERE benchmark_code = %s
             AND recorded_date <= %s
             AND recorded_date >= %s
           ORDER BY recorded_date DESC
           LIMIT 1""",
        (benchmark_code, target, target - timedelta(days=MAX_DATE_SLACK_DAYS)),
    )
    row = cur.fetchone()
    return (float(row[0]), row[1]) if row else None


def load_benchmark_history(conn, days: int = 400) -> int:
    """Refresh index history so evaluations always have a benchmark to compare to."""
    end = today_kst()
    start = end - timedelta(days=days)
    total = 0
    for code in BENCHMARK_TICKERS:
        closes = fetch_index_closes(code, start, end)
        total += store_benchmark_prices(conn, code, closes)
        logger.info("Benchmark %s: %d daily closes", code, len(closes))

    btc = fetch_coin_closes("BTC", days=365)
    total += store_benchmark_prices(conn, "BTC", btc)
    logger.info("Benchmark BTC: %d daily closes", len(btc))
    return total
