#!/usr/bin/env python3
"""Manual precision audit for the prediction detectors.

Hit rate only means something if the detected predictions are real. This walks
a stratified random sample of recent predictions, shows the surrounding text,
and records a human judgement per detection path so precision can be tracked
separately for keyword, LLM and report detection.

The audit itself stays manual — a human deciding whether a detection is real
is the whole point (plan 3.7). What is automated is everything around it:
--export writes the stratified sample to CSV, --import loads the labelled file
back, and --report prints precision per path. That way the monthly loop can be
scheduled (sample out, report published) without pretending a machine can
grade its own detections.

Usage:
    python crawler/audit_detections.py --sample 50            # interactive
    python crawler/audit_detections.py --export sample.csv    # for offline labelling
    python crawler/audit_detections.py --import labelled.csv
    python crawler/audit_detections.py --report
"""
from __future__ import annotations

import argparse
import csv
import sys

from psycopg2.extras import execute_values

from db import get_conn, close_pool
from logger import logger

# 계획 §3.7: 이 아래로 떨어진 감지 경로는 노출을 보류한다.
PRECISION_FLOOR = 0.70
# 그보다 표본이 적으면 판정 자체를 하지 않는다 — 3건 중 1건 틀렸다고
# 경로를 통째로 막으면 감사가 오히려 지표를 망친다.
MIN_AUDIT_SAMPLE = 20

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
              -- 중복·모순으로 평가에서 빠진 행을 감사해봐야 리더보드에
              -- 반영되지 않는다. 코퍼스의 79.9%가 여기 해당하므로 필터가
              -- 없으면 50건 중 대부분이 측정과 무관한 라벨이 된다.
              AND NOT p.is_duplicate
              AND NOT EXISTS (SELECT 1 FROM detection_audit da WHERE da.prediction_id = p.id)
        )
        SELECT id, detection_method, prediction_type, reason,
               asset_name, context_text, title, channel_name
        FROM ranked
        ORDER BY rn, detection_method
        """
    )
    pool = cur.fetchall()

    # 층별 균등 배분하되, 모집단이 얕은 층(keyword 10건·llm 72건 규모)의
    # 잔여 몫은 다른 층으로 넘긴다. `size // 3`을 4개 층에 적용하던 이전
    # 코드는 --sample 50에 최대 64행을 뽑았고, 그마저 얕은 층에서는
    # 채워지지 않아 실제 표본이 계획(50건)과 어긋났다.
    by_method: dict[str, list[tuple]] = {}
    for row in pool:
        by_method.setdefault(row[1] or "unknown", []).append(row)

    picked: list[tuple] = []
    remaining_strata = sorted(by_method, key=lambda m: len(by_method[m]))
    left = size
    for i, method in enumerate(remaining_strata):
        quota = max(1, left // (len(remaining_strata) - i))
        take = by_method[method][:quota]
        picked.extend(take)
        left -= len(take)

    return picked[:size]


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

        record_label(conn, pid, method, LABELS[choice])
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
        if n < MIN_AUDIT_SAMPLE:
            flag = f"  <- 표본 {n}/{MIN_AUDIT_SAMPLE}, 판정 유보"
        elif precision < PRECISION_FLOOR:
            flag = "  <- 노출 보류 (precision < 70%)"
        else:
            flag = ""
        print(f"{method:<12} {n:>5} {precision:>9.1%}  {wrong_dir:>9} {not_pred:>9} {wrong_asset:>11}{flag}")
    print()


def record_label(conn, prediction_id, method: str | None, label: str) -> None:
    """Persist one human judgement. Shared by the interactive and CSV paths."""
    with conn.cursor() as cur:
        cur.execute(
            """INSERT INTO detection_audit (prediction_id, detection_method, label)
               VALUES (%s, %s, %s)
               ON CONFLICT (prediction_id) DO UPDATE SET
                   label = EXCLUDED.label, audited_at = NOW()""",
            (prediction_id, method or "unknown", label),
        )
    conn.commit()


def export_sample(conn, size: int, path: str) -> int:
    """Write the stratified sample to CSV for offline labelling."""
    with conn.cursor() as cur:
        sample = fetch_sample(cur, size)

    with open(path, "w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow([
            "prediction_id", "detection_method", "prediction_type", "reason",
            "asset_name", "context_text", "video_title", "channel_name",
            "label",  # fill with: correct | wrong_direction | not_a_prediction | wrong_asset
        ])
        for row in sample:
            pid, method, ptype, reason, asset, context, title, channel = row
            writer.writerow([
                pid, method or "unknown", ptype, (reason or "")[:200], asset,
                (context or "")[:500], (title or "")[:200], channel, "",
            ])

    logger.info("Exported %d prediction(s) to %s", len(sample), path)
    return len(sample)


def import_labels(conn, path: str) -> int:
    """Load a labelled CSV back into detection_audit."""
    valid = set(LABELS.values())
    rows: list[tuple] = []

    with open(path, newline="", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            label = (row.get("label") or "").strip()
            if not label:
                continue
            if label not in valid:
                logger.warning("Skipping %s: unknown label %r", row.get("prediction_id"), label)
                continue
            rows.append((row["prediction_id"], row.get("detection_method") or "unknown", label))

    # 한 번에 적재한다 — 행마다 커밋하면 50건 감사가 왕복 50번이 되고,
    # 중간 실패 시 절반만 반영된 상태로 남는다.
    if rows:
        with conn.cursor() as cur:
            execute_values(
                cur,
                """INSERT INTO detection_audit (prediction_id, detection_method, label)
                   VALUES %s
                   ON CONFLICT (prediction_id) DO UPDATE SET
                       label = EXCLUDED.label, audited_at = NOW()""",
                rows,
            )
        conn.commit()
    imported = len(rows)

    logger.info("Imported %d label(s) from %s", imported, path)
    return imported


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sample", type=int, default=50, help="predictions to review")
    parser.add_argument("--report", action="store_true", help="print precision per detector")
    parser.add_argument("--export", metavar="CSV", help="write sample to CSV for offline labelling")
    parser.add_argument("--import", dest="import_path", metavar="CSV", help="load labelled CSV")
    args = parser.parse_args()

    with get_conn() as conn:
        if args.report:
            print_report(conn)
        elif args.export:
            export_sample(conn, args.sample, args.export)
        elif args.import_path:
            import_labels(conn, args.import_path)
        else:
            run_audit(conn, args.sample)

    close_pool()
    return 0


if __name__ == "__main__":
    sys.exit(main())
