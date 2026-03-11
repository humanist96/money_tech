"""MoneyTech YouTube Crawler - Collects channel and video metadata."""
from __future__ import annotations

import json
import os
import re
from collections import Counter
from datetime import datetime, timezone

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

from asset_dictionary import find_assets_in_text, analyze_sentiment, analyze_sentiment_for_asset, generate_simple_summary
from prediction_detector import detect_predictions
from youtube import (
    get_channel_info,
    get_channel_videos,
    get_video_details,
    get_video_details_batch,
    get_video_subtitle,
    rate_limit_wait,
)

load_dotenv()

DATABASE_URL = os.environ["DATABASE_URL"]


def get_conn():
    return psycopg2.connect(DATABASE_URL)


def load_channels() -> dict[str, list[dict]]:
    """Load target channels from channels.json."""
    with open(
        os.path.join(os.path.dirname(__file__), "channels.json"), encoding="utf-8"
    ) as f:
        return json.load(f)


def upsert_channel(cur, channel_data: dict, category: str) -> str:
    """Insert or update a channel, returns the channel UUID."""
    cur.execute(
        "SELECT id FROM channels WHERE youtube_channel_id = %s",
        (channel_data["channel_id"],),
    )
    existing = cur.fetchone()

    if existing:
        cur.execute(
            """UPDATE channels SET name = %s, category = %s, updated_at = NOW()
            WHERE youtube_channel_id = %s""",
            (channel_data["name"], category, channel_data["channel_id"]),
        )
        return str(existing[0])
    else:
        cur.execute(
            """INSERT INTO channels (youtube_channel_id, name, category)
            VALUES (%s, %s, %s) RETURNING id""",
            (channel_data["channel_id"], channel_data["name"], category),
        )
        return str(cur.fetchone()[0])


def upsert_video(cur, video: dict, channel_uuid: str) -> bool:
    """Insert or update a video. Returns True if new."""
    video_id = video.get("id") or video.get("url", "").split("v=")[-1]
    if not video_id:
        return False

    cur.execute(
        "SELECT id FROM videos WHERE youtube_video_id = %s", (video_id,)
    )
    existing = cur.fetchone()

    published_at = video.get("published_at")
    if not published_at:
        upload_date = video.get("upload_date")
        if upload_date and len(upload_date) == 8:
            published_at = f"{upload_date[:4]}-{upload_date[4:6]}-{upload_date[6:8]}T00:00:00Z"

    tags = video.get("tags") or []
    if isinstance(tags, str):
        tags = [tags]
    tags = tags[:20]

    if existing:
        cur.execute(
            """UPDATE videos SET title = %s, description = %s, view_count = %s,
            like_count = %s, comment_count = %s, duration = %s, published_at = %s,
            thumbnail_url = %s, tags = %s WHERE youtube_video_id = %s""",
            (
                video.get("title", ""),
                (video.get("description") or "")[:2000],
                video.get("view_count"),
                video.get("like_count"),
                video.get("comment_count"),
                video.get("duration"),
                published_at,
                video.get("thumbnail"),
                tags,
                video_id,
            ),
        )
        return False
    else:
        cur.execute(
            """INSERT INTO videos (channel_id, youtube_video_id, title, description,
            view_count, like_count, comment_count, duration, published_at, thumbnail_url, tags)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
            (
                channel_uuid,
                video_id,
                video.get("title", ""),
                (video.get("description") or "")[:2000],
                video.get("view_count"),
                video.get("like_count"),
                video.get("comment_count"),
                video.get("duration"),
                published_at,
                video.get("thumbnail"),
                tags,
            ),
        )
        return True


def extract_keywords_from_title(title: str) -> list[str]:
    """Extract meaningful keywords from video title."""
    cleaned = re.sub(r"[#@\[\]【】\(\)（）「」『』]", " ", title)
    cleaned = re.sub(r"https?://\S+", "", cleaned)

    words = cleaned.split()
    stop_words = {
        "의", "에", "을", "를", "이", "가", "은", "는", "와", "과",
        "로", "으로", "에서", "까지", "부터", "도", "만", "뿐",
        "더", "및", "그", "이번", "다시", "또", "vs", "ft",
        "EP", "ep", "vol", "VOL", "Part", "part",
    }

    keywords = []
    for word in words:
        word = word.strip(".,!?~-_=+|/\\\"'`")
        if len(word) >= 2 and word not in stop_words and not word.isdigit():
            keywords.append(word)

    return keywords


def compute_daily_stats(cur, date_str: str) -> None:
    """Compute and store daily statistics for each category."""
    categories = ["stock", "coin", "real_estate", "economy"]

    for category in categories:
        cur.execute(
            "SELECT id, name FROM channels WHERE category = %s", (category,)
        )
        channel_rows = cur.fetchall()
        channel_ids = {str(r[0]): r[1] for r in channel_rows}
        if not channel_ids:
            continue

        cur.execute(
            """SELECT channel_id, title, tags, view_count FROM videos
            WHERE channel_id = ANY(%s::uuid[])
            AND published_at >= %s AND published_at < %s::date + 1""",
            (
                list(channel_ids.keys()),
                f"{date_str}T00:00:00Z",
                date_str,
            ),
        )
        videos = cur.fetchall()

        channel_stats: dict[str, dict] = {}
        all_keywords: list[str] = []

        for channel_id, title, tags, view_count in videos:
            cid = str(channel_id)
            if cid not in channel_stats:
                channel_stats[cid] = {
                    "channel_id": cid,
                    "channel_name": channel_ids.get(cid, ""),
                    "video_count": 0,
                    "total_views": 0,
                }
            channel_stats[cid]["video_count"] += 1
            channel_stats[cid]["total_views"] += view_count or 0

            all_keywords.extend(extract_keywords_from_title(title or ""))
            for tag in tags or []:
                if len(tag) >= 2:
                    all_keywords.append(tag)

        top_channels = sorted(
            channel_stats.values(), key=lambda x: x["total_views"], reverse=True
        )[:10]

        keyword_counts = Counter(all_keywords).most_common(30)
        top_keywords = [{"keyword": kw, "count": cnt} for kw, cnt in keyword_counts]

        sentiment_distribution = {"positive": 0, "negative": 0, "neutral": 0}
        try:
            cur.execute(
                """SELECT ma.sentiment, COUNT(*) FROM mentioned_assets ma
                JOIN videos v ON ma.video_id = v.id
                JOIN channels c ON v.channel_id = c.id
                WHERE c.category = %s
                AND v.published_at >= %s AND v.published_at < %s::date + 1
                AND ma.sentiment IS NOT NULL
                GROUP BY ma.sentiment""",
                (category, f"{date_str}T00:00:00Z", date_str),
            )
            for sentiment_val, cnt in cur.fetchall():
                if sentiment_val in sentiment_distribution:
                    sentiment_distribution[sentiment_val] = cnt
        except Exception as e:
            print(f"  Warning: sentiment distribution query failed: {e}")

        cur.execute(
            """INSERT INTO daily_stats (date, category, total_videos, top_channels, top_keywords, sentiment_distribution)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (date, category) DO UPDATE SET
                total_videos = EXCLUDED.total_videos,
                top_channels = EXCLUDED.top_channels,
                top_keywords = EXCLUDED.top_keywords,
                sentiment_distribution = EXCLUDED.sentiment_distribution""",
            (
                date_str,
                category,
                len(videos),
                json.dumps(top_channels),
                json.dumps(top_keywords),
                json.dumps(sentiment_distribution),
            ),
        )

    print(f"  Daily stats computed for {date_str}")


def process_video_nlp(cur, conn, video_id: str, video: dict, channel_uuid: str, published_at: str | None, skip_subtitle: bool = False) -> None:
    """Run NLP analysis on a single video."""
    try:
        subtitle_text = None
        if not skip_subtitle:
            # Check if subtitle already exists
            cur.execute("SELECT subtitle_text FROM videos WHERE youtube_video_id = %s", (video_id,))
            row = cur.fetchone()
            existing_sub = row[0] if row else None

            if not existing_sub:
                try:
                    subtitle_text = get_video_subtitle(video_id)
                    if subtitle_text:
                        cur.execute(
                            "UPDATE videos SET subtitle_text = %s WHERE youtube_video_id = %s",
                            (subtitle_text, video_id),
                        )
                        conn.commit()
                except Exception:
                    pass
            else:
                subtitle_text = existing_sub

        title = video.get("title", "")
        description = video.get("description", "") or ""
        combined_text = f"{title} {description} {subtitle_text or ''}"

        found_assets = find_assets_in_text(combined_text)
        sentiment = analyze_sentiment(combined_text)

        if found_assets:
            cur.execute(
                "SELECT id FROM videos WHERE youtube_video_id = %s",
                (video_id,),
            )
            vid_row = cur.fetchone()
            if vid_row:
                vid_uuid = str(vid_row[0])
                for asset in found_assets:
                    asset_sentiment = analyze_sentiment_for_asset(combined_text, asset["asset_name"])
                    cur.execute(
                        """INSERT INTO mentioned_assets
                        (video_id, asset_type, asset_name, asset_code, sentiment)
                        VALUES (%s, %s, %s, %s, %s)
                        ON CONFLICT (video_id, asset_name) DO UPDATE SET
                            sentiment = EXCLUDED.sentiment""",
                        (
                            vid_uuid,
                            asset["asset_type"],
                            asset["asset_name"],
                            asset["asset_code"],
                            asset_sentiment,
                        ),
                    )

                # Detect and store predictions
                preds = detect_predictions(combined_text, found_assets)
                for pred in preds:
                    cur.execute(
                        "SELECT id FROM mentioned_assets WHERE video_id = %s AND asset_name = %s",
                        (vid_uuid, pred["asset_name"]),
                    )
                    ma_row = cur.fetchone()
                    if ma_row:
                        cur.execute(
                            """INSERT INTO predictions
                            (video_id, channel_id, mentioned_asset_id, prediction_type, reason, predicted_at)
                            VALUES (%s, %s, %s, %s, %s, %s)
                            ON CONFLICT DO NOTHING""",
                            (
                                vid_uuid,
                                channel_uuid,
                                str(ma_row[0]),
                                pred["prediction_type"],
                                pred.get("reason", ""),
                                published_at,
                            ),
                        )
                if preds:
                    print(f"    Detected {len(preds)} predictions")

            conn.commit()
            print(f"    Found {len(found_assets)} assets mentioned")

        summary = generate_simple_summary(title, found_assets, sentiment)
        cur.execute(
            """UPDATE videos SET summary = %s, sentiment = %s
            WHERE youtube_video_id = %s""",
            (summary, sentiment, video_id),
        )
        conn.commit()
    except Exception as e:
        print(f"    Warning: NLP analysis failed: {e}")
        conn.rollback()


def crawl() -> None:
    """Main crawling function - uses YouTube Data API v3 with batch requests."""
    channels_config = load_channels()
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    total_new = 0
    total_updated = 0

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            for category, channels in channels_config.items():
                print(f"\n=== Category: {category} ===")

                for ch in channels:
                    print(f"\nProcessing: {ch['name']} ({ch['channel_id']})")

                    channel_uuid = upsert_channel(cur, ch, category)
                    conn.commit()

                    # Fetch and update channel metadata (1 API call)
                    try:
                        ch_info = get_channel_info(ch["channel_id"])
                        if ch_info:
                            cur.execute(
                                """UPDATE channels SET
                                    subscriber_count = COALESCE(%s, subscriber_count),
                                    description = COALESCE(%s, description),
                                    thumbnail_url = COALESCE(%s, thumbnail_url),
                                    video_count = COALESCE(%s, video_count),
                                    total_view_count = COALESCE(%s, total_view_count)
                                WHERE id = %s""",
                                (
                                    ch_info.get("subscriber_count"),
                                    (ch_info.get("description") or "")[:2000] or None,
                                    ch_info.get("thumbnail_url"),
                                    ch_info.get("video_count"),
                                    ch_info.get("total_view_count"),
                                    channel_uuid,
                                ),
                            )
                            conn.commit()
                            print(f"  Subscribers: {ch_info.get('subscriber_count')}")
                    except Exception as e:
                        print(f"  Warning: could not update channel info: {e}")
                        conn.rollback()

                    # Fetch video list (1-2 API calls via playlist)
                    videos = get_channel_videos(ch["channel_id"], max_items=30)
                    print(f"  Found {len(videos)} videos")

                    if not videos:
                        continue

                    # Batch fetch video details (1 API call per 50 videos)
                    video_ids = [v.get("id") for v in videos if v.get("id")]
                    details_map = {}
                    if video_ids:
                        details_list = get_video_details_batch(video_ids)
                        details_map = {d["id"]: d for d in details_list}
                        print(f"  Fetched details for {len(details_map)} videos (batch)")

                    skip_sub = os.environ.get("SKIP_SUBTITLE", "").lower() in ("1", "true", "yes")

                    for video in videos:
                        video_id = video.get("id")
                        if not video_id:
                            continue

                        details = details_map.get(video_id)
                        source = details if details else video
                        is_new = upsert_video(cur, source, channel_uuid)
                        conn.commit()

                        if is_new:
                            total_new += 1
                            print(f"    NEW: {source.get('title', '')[:60]}")

                            # Determine published_at for predictions
                            published_at = video.get("published_at")
                            if not published_at and details:
                                ud = details.get("upload_date", "")
                                if len(ud) == 8:
                                    published_at = f"{ud[:4]}-{ud[4:6]}-{ud[6:8]}T00:00:00Z"

                            # NLP analysis only for NEW videos
                            process_video_nlp(cur, conn, video_id, source, channel_uuid, published_at, skip_subtitle=skip_sub)
                            rate_limit_wait(0.1)
                        else:
                            total_updated += 1

                    # Update channel video/view counts from DB
                    cur.execute(
                        """UPDATE channels SET
                            video_count = COALESCE((SELECT count(*) FROM videos WHERE channel_id = %s), video_count),
                            total_view_count = COALESCE((SELECT coalesce(sum(view_count), 0) FROM videos WHERE channel_id = %s), total_view_count)
                        WHERE id = %s""",
                        (channel_uuid, channel_uuid, channel_uuid),
                    )
                    conn.commit()
                    rate_limit_wait(0.2)

            print(f"\n=== Computing daily stats for {today} ===")
            compute_daily_stats(cur, today)
            conn.commit()

    finally:
        conn.close()

    print(f"\n=== Crawl complete ===")
    print(f"New videos: {total_new}")
    print(f"Updated videos: {total_updated}")


if __name__ == "__main__":
    crawl()
