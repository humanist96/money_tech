"""Picks which stocks get an explanation each day.

Deliberately not "the day's biggest movers". Anyone can list those, and for a
stock no creator ever mentioned we would have nothing to add beyond what a
portal already shows. Coverage of our own data is the differentiator, so
the candidate pool is the set of tickers our creators actually talked about.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta

import requests

from logger import logger
from price_history import today_kst

# Filters out illiquid and penny names where a large percentage move is noise.
MIN_CLOSE_PRICE = 1_000
MIN_TRADING_VALUE = 5_000_000_000  # 50억원

# A creator-mentioned stock qualifies on a smaller move than an anonymous one.
CREATOR_MOVE_THRESHOLD = 5.0
CREATOR_VALUE_RATIO = 3.0

MAX_CARDS = 12
MIN_CARDS = 6

# Weights (creator signals ~32% combined). crowd_sentiment was dropped in the
# cleanup, so its 0.05 was redistributed across the remaining terms.
W_CHANGE = 0.42
W_VALUE_RATIO = 0.26
W_MENTIONS = 0.21
W_CHANNEL_DIVERSITY = 0.11


@dataclass
class MoverCandidate:
    stock_code: str
    stock_name: str
    market: str
    close_price: float
    change_pct: float
    trading_value: int
    value_ratio: float
    mention_count: int = 0
    channel_count: int = 0
    score: float = 0.0
    selection_reason: str = "top_gainer"


def _mentioned_universe(cur, trade_date: date) -> dict[str, tuple[str, int, int]]:
    """Tickers our creators mentioned recently: code -> (name, mentions, channels).

    This is the whole candidate pool. KRX's whole-market snapshot now requires
    account credentials, and a market-wide top-movers list was the least
    differentiated half of the feature anyway — the stocks worth explaining are
    the ones we already have opinions about.
    """
    cur.execute(
        """
        SELECT ma.asset_code,
               MAX(ma.asset_name)                  AS asset_name,
               COUNT(*)::int                       AS mention_count,
               COUNT(DISTINCT v.channel_id)::int   AS channel_count
        FROM mentioned_assets ma
        JOIN videos v ON v.id = ma.video_id
        WHERE ma.asset_type = 'stock'
          AND ma.asset_code ~ '^[0-9]{6}$'
          AND v.published_at >= %s::date - INTERVAL '30 days'
          AND v.published_at < %s::date + INTERVAL '1 day'
        GROUP BY ma.asset_code
        ORDER BY COUNT(*) DESC
        LIMIT 250
        """,
        (trade_date, trade_date),
    )
    return {row[0]: (row[1], row[2], row[3]) for row in cur.fetchall()}


def _dictionary_meta(cur, codes: list[str]) -> dict[str, tuple[str | None, str | None]]:
    """Canonical name and listing market per ticker: code -> (name, market).

    Creator mentions supply slang names ("삼전"); the dictionary, when it has
    the ticker, supplies the official one.
    """
    cur.execute(
        "SELECT asset_code, asset_name, market FROM asset_dictionary WHERE asset_code = ANY(%s)",
        (codes,),
    )
    return {code: (name, market) for code, name, market in cur.fetchall()}


def _fetch_session_quotes(codes: list[str], markets: dict[str, str],
                          trade_date: date) -> dict[str, dict]:
    """Session close, change and turnover for each ticker, in one batch call."""
    try:
        import yfinance as yf
    except ImportError:
        logger.warning("yfinance not installed - session quotes unavailable")
        return {}

    # Unknown market: ask for both listings and keep whichever returns data.
    symbols: dict[str, str] = {}
    for code in codes:
        market = markets.get(code)
        if market == "KOSDAQ":
            symbols[f"{code}.KQ"] = code
        elif market == "KOSPI":
            symbols[f"{code}.KS"] = code
        else:
            symbols[f"{code}.KS"] = code
            symbols[f"{code}.KQ"] = code

    if not symbols:
        return {}

    try:
        data = yf.download(
            list(symbols),
            start=(trade_date - timedelta(days=10)).isoformat(),
            end=(trade_date + timedelta(days=1)).isoformat(),
            group_by="ticker",
            progress=False,
            threads=True,
            auto_adjust=False,
        )
    except Exception as e:
        logger.warning("Session quote download failed: %s", e)
        return {}

    out: dict[str, dict] = {}
    for symbol, code in symbols.items():
        # .KS is inserted before .KQ for unknown markets; keep the first symbol
        # that yields data instead of letting the later one overwrite it (that
        # overwrite is how 두산(KOSPI) got stored as KOSDAQ).
        if code in out:
            continue
        try:
            frame = data[symbol].dropna(subset=["Close"])
        except Exception:
            continue
        if frame is None or len(frame) < 2:
            continue

        session = frame[frame.index.date <= trade_date]
        # The last bar must be the session being explained. Without this, a
        # weekend or holiday run relabels the previous close as trade_date.
        if len(session) < 2 or session.index.date[-1] != trade_date:
            continue

        close = float(session["Close"].iloc[-1])
        prev_close = float(session["Close"].iloc[-2])
        volume = float(session["Volume"].iloc[-1] or 0)
        prev_volume = float(session["Volume"].iloc[-2] or 0)
        if close <= 0 or prev_close <= 0:
            continue

        turnover = int(close * volume)
        prev_turnover = close * prev_volume
        out[code] = {
            "market": "KOSDAQ" if symbol.endswith(".KQ") else "KOSPI",
            "close": close,
            "change_pct": (close / prev_close - 1) * 100,
            "trading_value": turnover,
            "value_ratio": (turnover / prev_turnover) if prev_turnover > 0 else 1.0,
        }

    logger.info("Session quotes resolved for %d/%d ticker(s)", len(out), len(codes))
    return out


def resolve_listing(stock_code: str) -> tuple[str | None, str | None]:
    """Official name and market from Naver's quote API.

    Yahoo serves the same price series under both .KS and .KQ — the suffix
    that happened to respond says nothing about where the stock is listed
    (that guess stored 두산/KOSPI as KOSDAQ). Naver actually knows.
    """
    try:
        resp = requests.get(
            f"https://m.stock.naver.com/api/stock/{stock_code}/basic",
            headers={"User-Agent": "Mozilla/5.0"},
            timeout=10,
        )
        resp.raise_for_status()
        body = resp.json()
        market = (body.get("stockExchangeType") or {}).get("name")
        name = body.get("stockName")
        return name, market if market in ("KOSPI", "KOSDAQ") else None
    except Exception as e:
        logger.warning("Listing lookup failed for %s: %s", stock_code, e)
        return None, None


def _score(c: MoverCandidate) -> float:
    change = min(abs(c.change_pct), 30) / 30
    value = min(c.value_ratio, 5) / 5
    mentions = min(c.mention_count, 20) / 20
    diversity = min(c.channel_count, 5) / 5
    return (
        change * W_CHANGE
        + value * W_VALUE_RATIO
        + mentions * W_MENTIONS
        + diversity * W_CHANNEL_DIVERSITY
    )


def select_movers(conn, trade_date: date | None = None) -> list[MoverCandidate]:
    """Choose the stocks to explain for one session."""
    trade_date = trade_date or today_kst()

    with conn.cursor() as cur:
        universe = _mentioned_universe(cur, trade_date)
        if not universe:
            logger.info("No creator-mentioned tickers for %s", trade_date)
            return []
        meta = _dictionary_meta(cur, list(universe))

    markets = {code: market for code, (_, market) in meta.items() if market}
    quotes = _fetch_session_quotes(list(universe), markets, trade_date)
    if not quotes:
        logger.info("No session quotes for %s (holiday or upstream failure)", trade_date)
        return []

    candidates: list[MoverCandidate] = []
    for code, (name, mention_count, channel_count) in universe.items():
        q = quotes.get(code)
        if not q:
            continue
        if q["close"] < MIN_CLOSE_PRICE or q["trading_value"] < MIN_TRADING_VALUE:
            continue
        official_name = meta.get(code, (None, None))[0]
        c = MoverCandidate(
            stock_code=code,
            stock_name=official_name or name,
            market=q["market"],
            close_price=q["close"],
            change_pct=q["change_pct"],
            trading_value=q["trading_value"],
            value_ratio=q["value_ratio"],
            mention_count=mention_count,
            channel_count=channel_count,
            selection_reason="creator_pick",
        )
        c.score = _score(c)
        candidates.append(c)

    # A stock only earns a card if it actually did something notable.
    notable = [
        c for c in candidates
        if abs(c.change_pct) >= CREATOR_MOVE_THRESHOLD or c.value_ratio >= CREATOR_VALUE_RATIO
    ]

    # Quiet session: fall back to the largest moves in our universe rather than
    # publishing nothing.
    if len(notable) < MIN_CARDS:
        notable_codes = {c.stock_code for c in notable}
        extra = sorted(
            (c for c in candidates if c.stock_code not in notable_codes),
            key=lambda c: abs(c.change_pct),
            reverse=True,
        )[: MIN_CARDS - len(notable)]
        for c in extra:
            c.selection_reason = "top_gainer" if c.change_pct >= 0 else "top_loser"
        notable.extend(extra)

    selected = sorted(notable, key=lambda c: c.score, reverse=True)[:MAX_CARDS]

    # Finalists the dictionary couldn't label get an authoritative lookup —
    # a dozen cheap calls at most, and only for the cards actually published.
    for c in selected:
        if c.stock_code in markets:
            continue
        official_name, market = resolve_listing(c.stock_code)
        if market:
            c.market = market
        if official_name and not meta.get(c.stock_code, (None, None))[0]:
            c.stock_name = official_name

    logger.info(
        "Selected %d mover(s) from %d creator-mentioned ticker(s)",
        len(selected), len(candidates),
    )
    return selected
