#!/usr/bin/env python3
"""Fill mentioned_assets.context_text for rows collected before it was written.

The column existed from the start but nothing ever populated it — all 194k rows
were NULL, which is why the first precision audit (2026-08-02) had to judge 50
detections from titles and keywords alone. The pipeline now writes it going
forward; this recovers what the stored source text still allows.

Source preference: content_text/subtitle_text (the actual transcript or post
body) over description, since a description rarely contains the sentence the
detector fired on. Rows whose source no longer exists stay NULL — a fabricated
context is worse than an empty one for an audit.

Usage:
    python crawler/backfill_context.py --days 30
    python crawler/backfill_context.py --days 30 --dry-run
"""
from __future__ import annotations

import argparse
import sys

from asset_dictionary import extract_asset_context
from db import get_conn, close_pool
from logger import logger

BATCH = 500


def backfill(conn, days: int, dry_run: bool = False) -> tuple[int, int]:
    filled = skipped = 0

    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT ma.id, ma.asset_name,
                   COALESCE(NULLIF(v.content_text, ''), NULLIF(v.subtitle_text, ''),
                            NULLIF(v.description, '')) AS source
            FROM mentioned_assets ma
            JOIN videos v ON v.id = ma.video_id
            WHERE ma.context_text IS NULL
              AND v.published_at >= NOW() - INTERVAL '1 day' * %s
            ORDER BY v.published_at DESC
            """,
            (days,),
        )
        rows = cur.fetchall()

    logger.info("Candidates: %d", len(rows))

    pending: list[tuple] = []
    for ma_id, asset_name, source in rows:
        context = extract_asset_context(source, asset_name) if source else None
        if not context:
            # 원문이 없거나 종목명이 원문에 등장하지 않는 경우. 후자는
            # 그 자체로 감사에 쓸모 있는 신호(제목에서만 잡힌 감지)지만,
            # 없는 문맥을 지어내지는 않는다.
            skipped += 1
            continue
        pending.append((context, ma_id))

        if len(pending) >= BATCH and not dry_run:
            with conn.cursor() as cur:
                cur.executemany(
                    "UPDATE mentioned_assets SET context_text = %s WHERE id = %s", pending
                )
            conn.commit()
            filled += len(pending)
            logger.info("  filled %d", filled)
            pending = []
        elif len(pending) >= BATCH:
            filled += len(pending)
            pending = []

    if pending:
        if not dry_run:
            with conn.cursor() as cur:
                cur.executemany(
                    "UPDATE mentioned_assets SET context_text = %s WHERE id = %s", pending
                )
            conn.commit()
        filled += len(pending)

    logger.info("Filled %d, skipped %d (no source or name absent)", filled, skipped)
    return filled, skipped


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--days", type=int, default=30)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    with get_conn() as conn:
        backfill(conn, args.days, args.dry_run)
    close_pool()
    return 0


if __name__ == "__main__":
    sys.exit(main())
