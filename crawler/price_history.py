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
from bisect import bisect_right
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

# Upstream fetches can hang; a stalled ticker must not stall the whole
# backfill.
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


def fetch_stock_closes(code: str, start: date, end: date) -> dict[date, float]:
    """Adjusted daily closes for one ticker over a date range."""
    return _with_timeout(_fetch_stock_closes_blocking, code, start, end, label=f"stock {code}")


def _fetch_stock_closes_blocking(code: str, start: date, end: date) -> dict[date, float]:
    """pykrx was dropped here: its adjusted-price path reads Naver's legacy
    fchart host, which GitHub runners cannot reach. Yahoo serves Korean
    tickers under .KS regardless of actual listing (it aliases .KS/.KQ to the
    same series), and history() adjusts for splits/dividends by default —
    the property evaluation depends on."""
    try:
        import yfinance as yf
    except ImportError:
        logger.warning("yfinance not installed — stock history unavailable")
        return {}

    symbol = f"{code}.KS" if code.isdigit() and len(code) == 6 else code
    try:
        df = yf.Ticker(symbol).history(
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


# --- In-memory as-of lookup -------------------------------------------------
#
# Scoring a prediction needs a handful of as-of prices, and issuing each as its
# own statement against a remote database made evaluation latency-bound rather
# than work-bound. The whole price history is a few megabytes, so the evaluator
# loads it once and resolves lookups locally. The functions below must agree
# with get_price_asof / get_benchmark_asof exactly — same backward-only search,
# same slack window.

Series = list[tuple[date, float]]


def _index_rows(rows) -> dict[str, Series]:
    """Group (key, date, value) rows into per-key series sorted by date."""
    index: dict[str, Series] = {}
    for key, recorded_date, value in rows:
        index.setdefault(key, []).append((recorded_date, float(value)))
    for series in index.values():
        series.sort()
    return index


def load_price_index(cur, asset_codes: list[str]) -> dict[str, Series]:
    """Every stored close for the given assets, keyed by asset code."""
    if not asset_codes:
        return {}
    cur.execute(
        """SELECT asset_code, recorded_date, price FROM asset_prices
           WHERE asset_code = ANY(%s)""",
        (list(asset_codes),),
    )
    return _index_rows(cur.fetchall())


def load_benchmark_index(cur) -> dict[str, Series]:
    """Every stored benchmark close, keyed by benchmark code."""
    cur.execute("SELECT benchmark_code, recorded_date, close_price FROM benchmark_prices")
    return _index_rows(cur.fetchall())


def asof_from_index(series: Series | None, target: date) -> tuple[float, date] | None:
    """Closing price on `target`, or the nearest earlier one within the slack
    window — the in-memory equivalent of get_price_asof."""
    if not series:
        return None
    # Dates are unique per key, so an upper sentinel on the value component
    # places the split point directly after the last entry dated <= target.
    position = bisect_right(series, (target, float("inf"))) - 1
    if position < 0:
        return None
    found_date, price = series[position]
    if found_date < target - timedelta(days=MAX_DATE_SLACK_DAYS):
        return None
    return (price, found_date)


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
