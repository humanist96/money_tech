"""Batch classify all channels and print report.

Usage: python classify_channels.py [--days 30]
"""
from __future__ import annotations

import os
import sys

import psycopg2
from dotenv import load_dotenv

from channel_classifier import classify_all_channels

load_dotenv()


def main():
    days = 30
    if "--days" in sys.argv:
        idx = sys.argv.index("--days")
        if idx + 1 < len(sys.argv):
            days = int(sys.argv[idx + 1])

    conn = psycopg2.connect(os.environ["DATABASE_URL"])

    print(f"=== Channel Classification (last {days} days) ===\n")
    results = classify_all_channels(conn, days=days)

    # Group by type
    groups: dict[str, list] = {}
    for r in results:
        groups.setdefault(r["channel_type"], []).append(r)

    # Print report
    type_order = ["leader", "predictor", "analyst", "media", "unknown"]
    type_labels = {
        "leader": "LEADER (리딩방)",
        "predictor": "PREDICTOR (예측형)",
        "analyst": "ANALYST (해설형)",
        "media": "MEDIA (미디어)",
        "unknown": "UNKNOWN (미분류)",
    }

    for ctype in type_order:
        channels = groups.get(ctype, [])
        if not channels:
            continue

        print(f"\n{'='*60}")
        print(f"  {type_labels[ctype]} ({len(channels)}개)")
        print(f"{'='*60}")

        for ch in sorted(channels, key=lambda x: -x["pis"]):
            d = ch["details"]
            vids = d.get("total_videos_analyzed", 0)
            print(f"  {ch['name']:24s}  PIS: {ch['pis']:5.1f}  [{ch['category']:12s}]  ({vids} videos)")
            if d.get("reason") != "insufficient_data":
                print(
                    f"    P1(밀도):{d.get('p1_density', 0):5.1f}  "
                    f"P2(행동):{d.get('p2_action_intensity', 0):5.1f}  "
                    f"P3(집중):{d.get('p3_concentration', 0):5.1f}  "
                    f"P4(목표):{d.get('p4_price_target', 0):5.1f}  "
                    f"P5(편향):{d.get('p5_sentiment_bias', 0):5.1f}"
                )

    # Summary
    print(f"\n{'='*60}")
    print("  SUMMARY")
    print(f"{'='*60}")
    for ctype in type_order:
        count = len(groups.get(ctype, []))
        if count > 0:
            print(f"  {type_labels[ctype]:30s}: {count}개")

    predictor_count = len(groups.get("predictor", [])) + len(groups.get("leader", []))
    total = len(results)
    print(f"\n  Total: {total}개")
    print(f"  Prediction channels (content target): {predictor_count}개")

    conn.close()


if __name__ == "__main__":
    main()
