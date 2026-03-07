"""MoneyTech YouTube Crawler - Collects channel and video metadata."""

import json
import os
import re
from collections import Counter
from datetime import datetime, timezone

from dotenv import load_dotenv
from supabase import create_client

from youtube import (
    get_channel_videos,
    get_video_details,
    get_video_subtitle,
    rate_limit_wait,
)

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def load_channels() -> dict[str, list[dict]]:
    """Load target channels from channels.json."""
    with open(
        os.path.join(os.path.dirname(__file__), "channels.json"), encoding="utf-8"
    ) as f:
        return json.load(f)


def upsert_channel(channel_data: dict, category: str) -> str:
    """Insert or update a channel, returns the channel UUID."""
    existing = (
        supabase.table("channels")
        .select("id")
        .eq("youtube_channel_id", channel_data["channel_id"])
        .execute()
    )

    row = {
        "youtube_channel_id": channel_data["channel_id"],
        "name": channel_data["name"],
        "category": category,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    if existing.data:
        supabase.table("channels").update(row).eq(
            "youtube_channel_id", channel_data["channel_id"]
        ).execute()
        return existing.data[0]["id"]
    else:
        result = supabase.table("channels").insert(row).execute()
        return result.data[0]["id"]


def upsert_video(video: dict, channel_uuid: str) -> bool:
    """Insert or update a video. Returns True if new."""
    video_id = video.get("id") or video.get("url", "").split("v=")[-1]
    if not video_id:
        return False

    existing = (
        supabase.table("videos")
        .select("id")
        .eq("youtube_video_id", video_id)
        .execute()
    )

    published_at = None
    upload_date = video.get("upload_date")
    if upload_date and len(upload_date) == 8:
        published_at = f"{upload_date[:4]}-{upload_date[4:6]}-{upload_date[6:8]}T00:00:00Z"

    tags = video.get("tags") or []
    if isinstance(tags, str):
        tags = [tags]

    row = {
        "channel_id": channel_uuid,
        "youtube_video_id": video_id,
        "title": video.get("title", ""),
        "description": (video.get("description") or "")[:2000],
        "view_count": video.get("view_count"),
        "like_count": video.get("like_count"),
        "comment_count": video.get("comment_count"),
        "duration": video.get("duration"),
        "published_at": published_at,
        "thumbnail_url": video.get("thumbnail"),
        "tags": tags[:20],
    }

    if existing.data:
        supabase.table("videos").update(row).eq(
            "youtube_video_id", video_id
        ).execute()
        return False
    else:
        supabase.table("videos").insert(row).execute()
        return True


def fetch_subtitle_for_video(video_id: str, db_video_id: str) -> None:
    """Fetch and store subtitle for a video (Phase 2 prep)."""
    subtitle = get_video_subtitle(video_id)
    if subtitle:
        supabase.table("videos").update(
            {"subtitle_text": subtitle[:50000]}
        ).eq("id", db_video_id).execute()
        print(f"    Subtitle saved ({len(subtitle)} chars)")


def extract_keywords_from_title(title: str) -> list[str]:
    """Extract meaningful keywords from video title."""
    # Remove common patterns
    cleaned = re.sub(r"[#@\[\]【】\(\)（）「」『』]", " ", title)
    cleaned = re.sub(r"https?://\S+", "", cleaned)

    # Split and filter
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


def compute_daily_stats(date_str: str) -> None:
    """Compute and store daily statistics for each category."""
    categories = ["stock", "coin", "real_estate", "economy"]

    for category in categories:
        # Get channels in this category
        channels_res = (
            supabase.table("channels")
            .select("id, name")
            .eq("category", category)
            .execute()
        )
        channel_ids = {ch["id"]: ch["name"] for ch in (channels_res.data or [])}
        if not channel_ids:
            continue

        # Get today's videos for these channels
        videos_res = (
            supabase.table("videos")
            .select("channel_id, title, tags, view_count")
            .in_("channel_id", list(channel_ids.keys()))
            .gte("published_at", f"{date_str}T00:00:00Z")
            .lte("published_at", f"{date_str}T23:59:59Z")
            .execute()
        )
        videos = videos_res.data or []

        # Top channels by video count and views
        channel_stats: dict[str, dict] = {}
        for v in videos:
            cid = v["channel_id"]
            if cid not in channel_stats:
                channel_stats[cid] = {
                    "channel_id": cid,
                    "channel_name": channel_ids.get(cid, ""),
                    "video_count": 0,
                    "total_views": 0,
                }
            channel_stats[cid]["video_count"] += 1
            channel_stats[cid]["total_views"] += v.get("view_count") or 0

        top_channels = sorted(
            channel_stats.values(), key=lambda x: x["total_views"], reverse=True
        )[:10]

        # Keywords from titles and tags
        all_keywords: list[str] = []
        for v in videos:
            all_keywords.extend(extract_keywords_from_title(v.get("title", "")))
            for tag in v.get("tags") or []:
                if len(tag) >= 2:
                    all_keywords.append(tag)

        keyword_counts = Counter(all_keywords).most_common(30)
        top_keywords = [{"keyword": kw, "count": cnt} for kw, cnt in keyword_counts]

        # Upsert daily_stats
        row = {
            "date": date_str,
            "category": category,
            "total_videos": len(videos),
            "top_channels": top_channels,
            "top_keywords": top_keywords,
        }

        existing = (
            supabase.table("daily_stats")
            .select("id")
            .eq("date", date_str)
            .eq("category", category)
            .execute()
        )

        if existing.data:
            supabase.table("daily_stats").update(row).eq(
                "id", existing.data[0]["id"]
            ).execute()
        else:
            supabase.table("daily_stats").insert(row).execute()

    print(f"  Daily stats computed for {date_str}")


def crawl() -> None:
    """Main crawling function."""
    channels_config = load_channels()
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    total_new = 0
    total_updated = 0

    for category, channels in channels_config.items():
        print(f"\n=== Category: {category} ===")

        for ch in channels:
            print(f"\nProcessing: {ch['name']} ({ch['channel_id']})")

            # Upsert channel
            channel_uuid = upsert_channel(ch, category)
            print(f"  Channel UUID: {channel_uuid}")

            # Fetch videos
            videos = get_channel_videos(ch["channel_id"], max_items=20)
            print(f"  Found {len(videos)} videos")

            for video in videos:
                video_id = video.get("id") or video.get("url", "").split("v=")[-1]
                if not video_id:
                    continue

                # Get detailed info for video
                details = get_video_details(video_id)
                if details:
                    is_new = upsert_video(details, channel_uuid)
                else:
                    is_new = upsert_video(video, channel_uuid)

                if is_new:
                    total_new += 1
                    print(f"    NEW: {video.get('title', '')[:50]}")
                else:
                    total_updated += 1

                rate_limit_wait(2.0)

            # Update channel stats from latest data
            channel_videos = (
                supabase.table("videos")
                .select("view_count")
                .eq("channel_id", channel_uuid)
                .execute()
            )
            if channel_videos.data:
                total_views = sum(
                    v.get("view_count") or 0 for v in channel_videos.data
                )
                supabase.table("channels").update(
                    {
                        "video_count": len(channel_videos.data),
                        "total_view_count": total_views,
                    }
                ).eq("id", channel_uuid).execute()

            rate_limit_wait(3.0)

    # Compute daily stats
    print(f"\n=== Computing daily stats for {today} ===")
    compute_daily_stats(today)

    print(f"\n=== Crawl complete ===")
    print(f"New videos: {total_new}")
    print(f"Updated videos: {total_updated}")


if __name__ == "__main__":
    crawl()
