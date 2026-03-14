"""MoneyTech Analyst Report Crawler - Collects analyst reports and stores predictions."""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

from naver_research import fetch_multiple_pages, AnalystReport
from report_prediction_detector import map_recommendation, determine_confidence
from asset_dictionary import find_assets_in_text, analyze_sentiment, generate_simple_summary

load_dotenv()

DATABASE_URL = os.environ["DATABASE_URL"]


def get_conn():
    return psycopg2.connect(DATABASE_URL)


def load_firms() -> list[dict]:
    """Load firms config from firms.json."""
    with open(
        os.path.join(os.path.dirname(__file__), "firms.json"), encoding="utf-8"
    ) as f:
        data = json.load(f)
        return data.get("firms", [])


def upsert_firm_channel(cur, firm: dict) -> str:
    """Insert or update a securities firm in channels table, returns UUID."""
    cur.execute(
        "SELECT id FROM channels WHERE firm_code = %s",
        (firm["code"],),
    )
    existing = cur.fetchone()

    if existing:
        cur.execute(
            """UPDATE channels SET name = %s, updated_at = NOW()
            WHERE firm_code = %s""",
            (firm["name"], firm["code"]),
        )
        return str(existing[0])
    else:
        cur.execute(
            """INSERT INTO channels (name, category, platform, firm_code)
            VALUES (%s, 'stock', 'analyst_report', %s) RETURNING id""",
            (firm["name"], firm["code"]),
        )
        return str(cur.fetchone()[0])


def upsert_report(cur, report: AnalystReport, channel_uuid: str) -> bool:
    """Insert or update an analyst report in videos table. Returns True if new."""
    if not report.report_url:
        return False

    cur.execute(
        "SELECT id FROM videos WHERE report_url = %s",
        (report.report_url,),
    )
    existing = cur.fetchone()

    title = f"[{report.firm_name}] {report.title}"

    # Build description with recommendation and target price
    desc_parts = [f"종목: {report.asset_name} ({report.asset_code})"]
    if report.recommendation:
        desc_parts.append(f"투자의견: {report.recommendation}")
    if report.target_price:
        desc_parts.append(f"목표가: {report.target_price:,.0f}원")
    if report.previous_target:
        desc_parts.append(f"이전목표가: {report.previous_target:,.0f}원")
    description = " | ".join(desc_parts)

    if existing:
        cur.execute(
            """UPDATE videos SET title = %s, description = %s,
            analyst_name = %s, firm_name = %s, published_at = %s
            WHERE report_url = %s""",
            (
                title,
                description,
                report.analyst_name or None,
                report.firm_name,
                report.published_at,
                report.report_url,
            ),
        )
        return False
    else:
        cur.execute(
            """INSERT INTO videos (channel_id, title, description, published_at,
            platform, report_url, analyst_name, firm_name, content_text)
            VALUES (%s, %s, %s, %s, 'analyst_report', %s, %s, %s, %s)""",
            (
                channel_uuid,
                title,
                description,
                report.published_at,
                report.report_url,
                report.analyst_name or None,
                report.firm_name,
                description,
            ),
        )
        return True


def process_report_prediction(cur, conn, report: AnalystReport, channel_uuid: str) -> None:
    """Store structured prediction from analyst report (no NLP needed)."""
    try:
        cur.execute(
            "SELECT id FROM videos WHERE report_url = %s",
            (report.report_url,),
        )
        vid_row = cur.fetchone()
        if not vid_row:
            return

        vid_uuid = str(vid_row[0])

        # Map recommendation to prediction type
        pred_type = map_recommendation(report.recommendation)
        confidence = determine_confidence(report.recommendation, report.target_price)

        # Upsert mentioned asset
        cur.execute(
            """INSERT INTO mentioned_assets
            (video_id, asset_type, asset_name, asset_code, sentiment)
            VALUES (%s, 'stock', %s, %s, %s)
            ON CONFLICT (video_id, asset_name) DO UPDATE SET
                sentiment = EXCLUDED.sentiment""",
            (
                vid_uuid,
                report.asset_name,
                report.asset_code,
                "positive" if pred_type == "buy" else "negative" if pred_type == "sell" else "neutral",
            ),
        )

        # Get mentioned_asset_id
        cur.execute(
            "SELECT id FROM mentioned_assets WHERE video_id = %s AND asset_name = %s",
            (vid_uuid, report.asset_name),
        )
        ma_row = cur.fetchone()
        if not ma_row:
            conn.commit()
            return

        # Insert prediction with target price and confidence
        if pred_type:
            cur.execute(
                """INSERT INTO predictions
                (video_id, channel_id, mentioned_asset_id, prediction_type,
                 target_price, previous_target_price, confidence, reason, predicted_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT DO NOTHING""",
                (
                    vid_uuid,
                    channel_uuid,
                    str(ma_row[0]),
                    pred_type,
                    report.target_price,
                    report.previous_target,
                    confidence,
                    report.recommendation or "",
                    report.published_at,
                ),
            )

        # Generate summary
        sentiment = "positive" if pred_type == "buy" else "negative" if pred_type == "sell" else "neutral"
        summary_parts = [f"{report.firm_name}: {report.asset_name}"]
        if report.recommendation:
            summary_parts.append(f"의견={report.recommendation}")
        if report.target_price:
            summary_parts.append(f"목표가={report.target_price:,.0f}원")
        summary = " | ".join(summary_parts)

        cur.execute(
            """UPDATE videos SET summary = %s, sentiment = %s
            WHERE id = %s""",
            (summary, sentiment, vid_uuid),
        )
        conn.commit()

        if pred_type:
            tp_str = f", 목표가={report.target_price:,.0f}원" if report.target_price else ""
            print(f"    Prediction: {pred_type}{tp_str}")

    except Exception as e:
        print(f"    Warning: Report prediction failed: {e}")
        conn.rollback()


def crawl_reports(max_pages: int = 3) -> None:
    """Main report crawling function."""
    firms_config = load_firms()
    firm_map = {f["name"]: f for f in firms_config}

    total_new = 0
    total_updated = 0

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            # Ensure firm channels exist
            firm_uuids: dict[str, str] = {}
            for firm in firms_config:
                uuid = upsert_firm_channel(cur, firm)
                firm_uuids[firm["name"]] = uuid
            conn.commit()
            print(f"Registered {len(firm_uuids)} securities firms")

            # Fetch reports from Naver Research
            print(f"\n=== Fetching Analyst Reports (max {max_pages} pages) ===")
            reports = fetch_multiple_pages(max_pages)
            print(f"Total reports fetched: {len(reports)}")

            for report in reports:
                # Find or create channel for this firm
                channel_uuid = firm_uuids.get(report.firm_name)
                if not channel_uuid:
                    # Create channel for unknown firm
                    firm_data = {"name": report.firm_name, "code": report.firm_name.lower().replace(" ", "_")}
                    channel_uuid = upsert_firm_channel(cur, firm_data)
                    firm_uuids[report.firm_name] = channel_uuid
                    conn.commit()

                is_new = upsert_report(cur, report, channel_uuid)
                conn.commit()

                if is_new:
                    total_new += 1
                    tp_str = f" 목표가={report.target_price:,.0f}" if report.target_price else ""
                    print(f"  NEW: [{report.firm_name}] {report.asset_name} {report.recommendation or ''}{tp_str}")

                    # Store structured prediction
                    process_report_prediction(cur, conn, report, channel_uuid)
                else:
                    total_updated += 1
                    # Update existing records with target price if newly extracted
                    if report.target_price or report.recommendation:
                        process_report_prediction(cur, conn, report, channel_uuid)

            # Update channel report counts
            for firm_name, uuid in firm_uuids.items():
                cur.execute(
                    """UPDATE channels SET
                        video_count = COALESCE(
                            (SELECT count(*) FROM videos WHERE channel_id = %s), video_count
                        )
                    WHERE id = %s""",
                    (uuid, uuid),
                )
            conn.commit()

    finally:
        conn.close()

    print(f"\n=== Report Crawl complete ===")
    print(f"New reports: {total_new}")
    print(f"Updated reports: {total_updated}")


if __name__ == "__main__":
    crawl_reports()
