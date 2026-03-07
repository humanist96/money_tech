"""MoneyTech YouTube Crawler - Collects channel and video metadata."""

import json
import os
import re
from collections import Counter
from datetime import datetime, timezone

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

from youtube import (
    get_channel_videos,
    get_video_details,
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

    published_at = None
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
            WHERE channel_id = ANY(%s)
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

        cur.execute(
            """INSERT INTO daily_stats (date, category, total_videos, top_channels, top_keywords)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (date, category) DO UPDATE SET
                total_videos = EXCLUDED.total_videos,
                top_channels = EXCLUDED.top_channels,
                top_keywords = EXCLUDED.top_keywords""",
            (
                date_str,
                category,
                len(videos),
                json.dumps(top_channels),
                json.dumps(top_keywords),
            ),
        )

    print(f"  Daily stats computed for {date_str}")


def crawl() -> None:
    """Main crawling function."""
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
                    print(f"  Channel UUID: {channel_uuid}")

                    videos = get_channel_videos(ch["channel_id"], max_items=20)
                    print(f"  Found {len(videos)} videos")

                    for video in videos:
                        video_id = video.get("id") or video.get("url", "").split("v=")[-1]
                        if not video_id:
                            continue

                        details = get_video_details(video_id)
                        if details:
                            is_new = upsert_video(cur, details, channel_uuid)
                        else:
                            is_new = upsert_video(cur, video, channel_uuid)

                        conn.commit()

                        if is_new:
                            total_new += 1
                            print(f"    NEW: {video.get('title', '')[:50]}")
                        else:
                            total_updated += 1

                        rate_limit_wait(2.0)

                    # Update channel stats
                    cur.execute(
                        """UPDATE channels SET
                            video_count = (SELECT count(*) FROM videos WHERE channel_id = %s),
                            total_view_count = (SELECT coalesce(sum(view_count), 0) FROM videos WHERE channel_id = %s)
                        WHERE id = %s""",
                        (channel_uuid, channel_uuid, channel_uuid),
                    )
                    conn.commit()

                    rate_limit_wait(3.0)

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
