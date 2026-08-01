#!/usr/bin/env python3
"""Daily "why did it move" pipeline.

Runs after the close: pick the stocks worth explaining, gather evidence, have
the model write the explanation, store one row per stock per session.

Upserts on (trade_date, stock_code), so re-running a day is safe.

Usage:
    python crawler/movers_main.py                    # most recent session
    python crawler/movers_main.py --date 20260731    # a specific session
    python crawler/movers_main.py --backfill-days 3  # fill recent gaps
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import date, datetime, timedelta

from dotenv import load_dotenv

from dart_client import refresh_corp_map
from db import get_conn, close_pool
from logger import logger
from movers_analyzer import MoversAnalyzer
from movers_evidence import build_evidence
from movers_selector import select_movers
from price_history import today_kst

load_dotenv()



def _index_moves(cur, trade_date: date) -> dict[str, float]:
    """Index percentage change for the session.

    Read from benchmark_prices, which the evaluation pipeline already keeps
    current — no extra upstream call, and the same numbers the scoring uses.
    """
    moves: dict[str, float] = {}
    for market in ("KOSPI", "KOSDAQ"):
        cur.execute(
            """SELECT close_price FROM benchmark_prices
               WHERE benchmark_code = %s AND recorded_date <= %s
               ORDER BY recorded_date DESC LIMIT 2""",
            (market, trade_date),
        )
        rows = cur.fetchall()
        if len(rows) == 2 and rows[1][0]:
            moves[market] = (float(rows[0][0]) / float(rows[1][0]) - 1) * 100
    return moves


def _store(cur, candidate, analysis: dict, evidence: list[dict],
           creator_context: dict, flow: dict, trade_date: date) -> None:
    if analysis.get("creator_context_text"):
        creator_context = {**creator_context, "text": analysis["creator_context_text"]}

    cur.execute(
        """
        INSERT INTO daily_movers (
            trade_date, stock_code, stock_name, market, close_price, change_pct,
            trading_value, value_ratio, selection_score, selection_reason,
            headline, cause_type, summary, confidence, factors, evidence,
            creator_context, investor_flow, llm_model
        ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        ON CONFLICT (trade_date, stock_code) DO UPDATE SET
            stock_name = EXCLUDED.stock_name,
            close_price = EXCLUDED.close_price,
            change_pct = EXCLUDED.change_pct,
            trading_value = EXCLUDED.trading_value,
            value_ratio = EXCLUDED.value_ratio,
            selection_score = EXCLUDED.selection_score,
            selection_reason = EXCLUDED.selection_reason,
            headline = EXCLUDED.headline,
            cause_type = EXCLUDED.cause_type,
            summary = EXCLUDED.summary,
            confidence = EXCLUDED.confidence,
            factors = EXCLUDED.factors,
            evidence = EXCLUDED.evidence,
            creator_context = EXCLUDED.creator_context,
            investor_flow = EXCLUDED.investor_flow,
            llm_model = EXCLUDED.llm_model
        """,
        (
            trade_date, candidate.stock_code, candidate.stock_name, candidate.market,
            candidate.close_price, candidate.change_pct, candidate.trading_value,
            candidate.value_ratio, candidate.score, candidate.selection_reason,
            analysis["headline"], analysis["cause_type"], analysis["summary"],
            analysis["confidence"], json.dumps(analysis["factors"], ensure_ascii=False),
            json.dumps(evidence, ensure_ascii=False),
            json.dumps(creator_context, ensure_ascii=False),
            json.dumps(flow, ensure_ascii=False),
            analysis["llm_model"],
        ),
    )


def run_for_date(conn, trade_date: date) -> int:
    logger.info("=== Daily movers for %s ===", trade_date)

    candidates = select_movers(conn, trade_date)
    if not candidates:
        logger.info("No movers for %s — market closed or snapshot empty", trade_date)
        return 0

    analyzer = MoversAnalyzer()
    stored = 0

    with conn.cursor() as cur:
        index_moves = _index_moves(cur, trade_date)
        for candidate in candidates:
            evidence, creator_context, flow = build_evidence(
                cur, candidate, trade_date, index_moves
            )
            analysis = analyzer.analyze(candidate, evidence, trade_date, index_moves)
            _store(cur, candidate, analysis, evidence, creator_context, flow, trade_date)
            conn.commit()
            stored += 1
            logger.info(
                "  %s %s (%+.1f%%) → %s [%s]",
                candidate.stock_code, candidate.stock_name, candidate.change_pct,
                analysis["headline"], analysis["confidence"],
            )

    with_creator = sum(
        1 for c in candidates if c.mention_count > 0
    )
    logger.info(
        "Stored %d mover(s); creator evidence on %d (%.0f%%)",
        stored, with_creator, with_creator / max(stored, 1) * 100,
    )
    return stored


def _pending_dates(cur, days: int) -> list[date]:
    """Recent weekdays with no stored movers."""
    today = today_kst()
    out = []
    for offset in range(days):
        d = today - timedelta(days=offset)
        if d.weekday() >= 5:
            continue
        cur.execute("SELECT 1 FROM daily_movers WHERE trade_date = %s LIMIT 1", (d,))
        if not cur.fetchone():
            out.append(d)
    return sorted(out)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--date", help="YYYYMMDD (default: most recent session)")
    parser.add_argument("--backfill-days", type=int, default=0,
                        help="also fill recent weekdays that have no rows")
    args = parser.parse_args()

    with get_conn() as conn:
        try:
            refresh_corp_map(conn)
        except Exception as e:
            logger.warning("DART corp map refresh skipped: %s", e)

        # The workflow passes an empty --date on scheduled runs.
        if args.date and args.date.strip():
            targets = [datetime.strptime(args.date.strip(), "%Y%m%d").date()]
        else:
            targets = [today_kst()]
            if args.backfill_days:
                with conn.cursor() as cur:
                    targets = sorted(set(targets) | set(_pending_dates(cur, args.backfill_days)))

        total = 0
        for target in targets:
            total += run_for_date(conn, target)

    close_pool()
    logger.info("Daily movers complete: %d row(s)", total)
    return 0


if __name__ == "__main__":
    sys.exit(main())
