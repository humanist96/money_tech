#!/usr/bin/env python3
"""Manual precision audit for the prediction detectors.

Hit rate only means something if the detected predictions are real. This walks
a stratified random sample of recent predictions, shows the surrounding text,
and records a human judgement per detection path so precision can be tracked
separately for keyword, LLM and report detection.

Usage:
    python crawler/audit_detections.py --sample 50
    python crawler/audit_detections.py --report
"""
from __future__ import annotations

import argparse
import sys

from db import get_conn, close_pool
from logger import logger

LABELS = {
    "1": "correct",
    "2": "wrong_direction",
    "3": "not_a_prediction",
    "4": "wrong_asset",
}

PROMPT = """
  [1] correct            예측이 맞게 감지됨
  [2] wrong_direction    예측은 맞으나 방향이 틀림
  [3] not_a_prediction   예측이 아닌데 감지됨
  [4] wrong_asset        다른 종목의 문맥이 잘못 붙음
  [s] skip   [q] quit
> """


def fetch_sample(cur, size: int) -> list[tuple]:
    """Stratified random sample across detection paths."""
    cur.execute(
        """
        WITH ranked AS (
            SELECT p.id, p.detection_method, p.prediction_type, p.reason,
                   ma.asset_name, ma.context_text, v.title, c.name AS channel_name,
                   ROW_NUMBER() OVER (
                       PARTITION BY COALESCE(p.detection_method, 'unknown')
                       ORDER BY RANDOM()
                   ) AS rn
            FROM predictions p
            JOIN mentioned_assets ma ON ma.id = p.mentioned_asset_id
            JOIN videos v ON v.id = p.video_id
            JOIN channels c ON c.id = p.channel_id
            WHERE p.predicted_at >= NOW() - INTERVAL '30 days'
              AND NOT EXISTS (SELECT 1 FROM detection_audit da WHERE da.prediction_id = p.id)
        )
        SELECT id, detection_method, prediction_type, reason,
               asset_name, context_text, title, channel_name
        FROM ranked
        WHERE rn <= %s
        ORDER BY detection_method, rn
        """,
        (max(1, size // 3),),
    )
    return cur.fetchall()


def run_audit(conn, size: int) -> int:
    with conn.cursor() as cur:
        sample = fetch_sample(cur, size)

    if not sample:
        logger.info("No unaudited predictions in the last 30 days.")
        return 0

    print(f"\n{len(sample)} prediction(s) to audit.\n")
    audited = 0

    for i, (pid, method, ptype, reason, asset, context, title, channel) in enumerate(sample, 1):
        print("=" * 72)
        print(f"[{i}/{len(sample)}] {channel} · {method or 'unknown'}")
        print(f"  영상: {(title or '')[:70]}")
        print(f"  종목: {asset}   감지: {ptype}   근거: {(reason or '')[:60]}")
        if context:
            print(f"  문맥: {context[:300]}")

        try:
            choice = input(PROMPT).strip().lower()
        except (EOFError, KeyboardInterrupt):
            print()
            break

        if choice == "q":
            break
        if choice not in LABELS:
            continue

        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO detection_audit (prediction_id, detection_method, label)
                   VALUES (%s, %s, %s)
                   ON CONFLICT (prediction_id) DO UPDATE SET
                       label = EXCLUDED.label, audited_at = NOW()""",
                (pid, method or "unknown", LABELS[choice]),
            )
        conn.commit()
        audited += 1

    print(f"\n{audited} prediction(s) audited.")
    return audited


def print_report(conn) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """SELECT detection_method,
                      COUNT(*)::int AS n,
                      COUNT(*) FILTER (WHERE label = 'correct')::int AS correct,
                      COUNT(*) FILTER (WHERE label = 'wrong_direction')::int AS wrong_dir,
                      COUNT(*) FILTER (WHERE label = 'not_a_prediction')::int AS not_pred,
                      COUNT(*) FILTER (WHERE label = 'wrong_asset')::int AS wrong_asset
               FROM detection_audit
               GROUP BY detection_method
               ORDER BY detection_method"""
        )
        rows = cur.fetchall()

    if not rows:
        print("No audit data yet. Run with --sample first.")
        return

    print(f"\n{'method':<12} {'n':>5} {'precision':>10}  {'wrong_dir':>9} {'not_pred':>9} {'wrong_asset':>11}")
    print("-" * 62)
    for method, n, correct, wrong_dir, not_pred, wrong_asset in rows:
        precision = correct / n if n else 0
        flag = "  <- below 70%" if precision < 0.7 else ""
        print(f"{method:<12} {n:>5} {precision:>9.1%}  {wrong_dir:>9} {not_pred:>9} {wrong_asset:>11}{flag}")
    print()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sample", type=int, default=50, help="predictions to review")
    parser.add_argument("--report", action="store_true", help="print precision per detector")
    args = parser.parse_args()

    with get_conn() as conn:
        if args.report:
            print_report(conn)
        else:
            run_audit(conn, args.sample)

    close_pool()
    return 0


if __name__ == "__main__":
    sys.exit(main())
