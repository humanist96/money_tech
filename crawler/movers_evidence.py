"""Assembles the evidence behind one day's move for one stock.

Four sources, numbered so the LLM can only cite what it was given:
  disclosure  regulatory filings (DART)
  flow        foreign/institutional net buying (KRX)
  news        headlines from the session window
  creator     what our tracked creators said about this stock beforehand

The creator block is the part no portal can produce, and it reads from the v2
evaluation tables so a call is only labelled a hit once the evaluator has
actually scored it.
"""
from __future__ import annotations

import os
from datetime import date, timedelta

import requests

from dart_client import fetch_disclosures
from http_util import RateLimiter, clean_html
from logger import logger

NAVER_NEWS_API = "https://openapi.naver.com/v1/search/news.json"
_news_limiter = RateLimiter(0.5)

# Net buying below this is routine and explains nothing.
FLOW_THRESHOLD_KRW = 10_000_000_000  # 100억원

MAX_NEWS = 5
CREATOR_LOOKBACK_DAYS = 90

# A keyword search on a company name pulls in anything sharing that name — a
# search for 두산 returns its baseball club, and the model duly reported "KBO
# 리그 성과로 급등". Requiring a market term in the headline keeps only
# articles that are actually about the listed company.
FINANCE_TERMS = (
    "주가", "증권", "코스피", "코스닥", "실적", "영업이익", "매출", "공시",
    "목표가", "투자", "수주", "계약", "증자", "배당", "상장", "급등", "급락",
    "강세", "약세", "반등", "하락", "상승", "시총", "외국인", "기관", "수급",
    "인수", "합병", "지분", "리포트", "전망치", "가이던스",
)


def collect_flow(stock_code: str, trade_date: date) -> tuple[list[dict], dict]:
    """Foreign and institutional net buying for the session."""
    try:
        from pykrx import stock
    except ImportError:
        return [], {}

    day = trade_date.strftime("%Y%m%d")
    try:
        df = stock.get_market_trading_value_by_date(day, day, stock_code)
        if df is None or df.empty:
            return [], {}
        row = df.iloc[0]
    except Exception as e:
        logger.warning("Flow fetch failed for %s: %s", stock_code, e)
        return [], {}

    def val(col: str) -> float:
        try:
            return float(row.get(col) or 0)
        except Exception:
            return 0.0

    foreign = val("외국인합계")
    institution = val("기관합계")
    flow = {"foreign": foreign, "institution": institution}

    evidence = []
    for label, amount in (("외국인", foreign), ("기관", institution)):
        if abs(amount) >= FLOW_THRESHOLD_KRW:
            side = "순매수" if amount > 0 else "순매도"
            evidence.append({
                "type": "flow",
                "summary": f"{label}이 약 {abs(amount) / 1e8:,.0f}억원 {side}했습니다.",
                "source_url": f"https://finance.naver.com/item/frgn.naver?code={stock_code}",
                "source_date": trade_date.isoformat(),
            })
    return evidence, flow


def collect_news(stock_name: str, trade_date: date) -> list[dict]:
    """Headlines published in the session window.

    Titles and summaries only — no article scraping, which would be both
    fragile and unnecessary for naming a cause.
    """
    client_id = os.environ.get("NAVER_CLIENT_ID")
    client_secret = os.environ.get("NAVER_CLIENT_SECRET")
    if not (client_id and client_secret):
        return []

    _news_limiter.wait()
    try:
        resp = requests.get(
            NAVER_NEWS_API,
            params={"query": stock_name, "display": 20, "sort": "date"},
            headers={"X-Naver-Client-Id": client_id, "X-Naver-Client-Secret": client_secret},
            timeout=15,
        )
        resp.raise_for_status()
        items = resp.json().get("items", [])
    except Exception as e:
        logger.warning("News fetch failed for %s: %s", stock_name, e)
        return []

    window_start = trade_date - timedelta(days=1)
    out = []
    for item in items:
        pub = (item.get("pubDate") or "")[:16]
        title = clean_html(item.get("title", ""))
        desc = clean_html(item.get("description", ""))
        if not title:
            continue
        # pubDate is RFC-1123; a substring date check is enough to keep the
        # window roughly right without parsing every locale variant.
        if not any(d.strftime("%d %b") in pub for d in (window_start, trade_date)):
            continue
        # Drop same-name articles from unrelated domains (sports, entertainment).
        if not any(term in title for term in FINANCE_TERMS):
            continue
        out.append({
            "type": "news",
            "summary": f"{title} — {desc[:120]}" if desc else title,
            "source_url": item.get("originallink") or item.get("link", ""),
            "source_date": trade_date.isoformat(),
        })
        if len(out) >= MAX_NEWS:
            break
    return out


def collect_creator_context(cur, stock_code: str, trade_date: date) -> tuple[list[dict], dict]:
    """What our creators said about this stock, and how those calls scored.

    Reads prediction_evaluations / channel_stats (evaluation_version 2) so an
    unscored call is never presented as a correct one.
    """
    cur.execute(
        """
        SELECT c.name                AS channel_name,
               c.channel_type,
               cs.wilson_low,
               cs.n_effective,
               p.prediction_type,
               p.predicted_at::date  AS predicted_on,
               v.title               AS video_title,
               v.id                  AS video_id,
               c.id                  AS channel_id,
               pe.outcome,
               pe.excess_return,
               p.evaluation_status
        FROM predictions p
        JOIN channels c          ON c.id = p.channel_id
        JOIN videos v            ON v.id = p.video_id
        JOIN mentioned_assets ma ON ma.id = p.mentioned_asset_id
        LEFT JOIN prediction_evaluations pe
               ON pe.prediction_id = p.id
              AND pe.horizon = '1m'
              AND pe.evaluation_version = 2
        LEFT JOIN channel_stats cs
               ON cs.channel_id = c.id
              AND cs.horizon = '1m'
              AND cs.evaluation_version = 2
        WHERE ma.asset_code = %s
          AND NOT p.is_duplicate
          AND p.predicted_at >= %s::date - INTERVAL '%s days'
          AND p.predicted_at < %s::date
        ORDER BY cs.wilson_low DESC NULLS LAST, p.predicted_at DESC
        LIMIT 6
        """,
        (stock_code, trade_date, CREATOR_LOOKBACK_DAYS, trade_date),
    )
    rows = cur.fetchall()

    cur.execute(
        """
        SELECT ma.sentiment, COUNT(*)::int
        FROM mentioned_assets ma
        JOIN videos v ON v.id = ma.video_id
        WHERE ma.asset_code = %s
          AND v.published_at >= %s::date - INTERVAL '7 days'
          AND v.published_at < %s::date
        GROUP BY ma.sentiment
        """,
        (stock_code, trade_date, trade_date),
    )
    sentiment_7d = {row[0]: row[1] for row in cur.fetchall() if row[0]}

    if not rows:
        return [], {"predictions": [], "sentiment_7d": sentiment_7d}

    type_labels = {"buy": "매수", "sell": "매도", "hold": "보유"}
    evidence: list[dict] = []
    predictions: list[dict] = []

    for (channel_name, channel_type, wilson_low, n_effective, ptype,
         predicted_on, video_title, video_id, channel_id,
         outcome, excess_return, evaluation_status) in rows:
        days_ago = (trade_date - predicted_on).days if predicted_on else None
        label = type_labels.get(ptype, ptype)

        # Only an evaluated call gets a verdict; everything else says so.
        if outcome in ("hit", "miss"):
            verdict = "적중" if outcome == "hit" else "빗나감"
        elif outcome == "push":
            verdict = "판정보류"
        else:
            verdict = "평가 전"

        track_record = (
            f"1개월 신뢰하한 {wilson_low * 100:.0f}% / {n_effective}건"
            if wilson_low is not None and n_effective
            else "트랙레코드 평가 중"
        )

        evidence.append({
            "type": "creator",
            "summary": (
                f"{days_ago}일 전 {channel_name}이(가) {label} 예측 "
                f"({track_record}, 현재 판정: {verdict})"
            ),
            "source_url": f"/channels/{channel_id}",
            "source_date": predicted_on.isoformat() if predicted_on else None,
        })
        predictions.append({
            "channel_id": str(channel_id),
            "channel_name": channel_name,
            "channel_type": channel_type,
            "prediction_type": ptype,
            "days_ago": days_ago,
            "verdict": verdict,
            "excess_return": float(excess_return) if excess_return is not None else None,
            "wilson_low": float(wilson_low) if wilson_low is not None else None,
            "n_effective": n_effective,
            "video_title": video_title,
            "video_id": str(video_id),
            "evaluation_status": evaluation_status,
        })

    return evidence, {"predictions": predictions, "sentiment_7d": sentiment_7d}


def collect_market_context(index_moves: dict[str, float], market: str) -> list[dict]:
    """Injected by code, not the model: a broad index move explains a lot of
    single-stock moves, and the model tends to reach for company news instead."""
    move = index_moves.get(market)
    if move is None or abs(move) < 2.0:
        return []
    direction = "상승" if move > 0 else "하락"
    return [{
        "type": "market",
        "summary": f"{market} 지수 자체가 {move:+.1f}% {direction}했습니다. 시장 전체 흐름의 영향일 수 있습니다.",
        "source_url": "https://finance.naver.com/sise/",
        "source_date": None,
    }]


def build_evidence(cur, candidate, trade_date: date, index_moves: dict[str, float]):
    """All evidence for one stock, numbered for citation."""
    evidence: list[dict] = []

    for item in fetch_disclosures(cur, candidate.stock_code, trade_date):
        evidence.append({
            "type": "disclosure",
            "summary": f"[{item['date']}] {item['title']}",
            "source_url": item["url"],
            "source_date": item["date"],
        })

    flow_evidence, flow = collect_flow(candidate.stock_code, trade_date)
    evidence.extend(flow_evidence)
    evidence.extend(collect_news(candidate.stock_name, trade_date))

    creator_evidence, creator_context = collect_creator_context(
        cur, candidate.stock_code, trade_date
    )
    evidence.extend(creator_evidence)
    evidence.extend(collect_market_context(index_moves, candidate.market))

    for i, item in enumerate(evidence, 1):
        item["n"] = i

    return evidence, creator_context, flow
