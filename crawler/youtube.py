"""YouTube Data API v3 wrapper for channel/video metadata extraction."""
from __future__ import annotations

import json
import os
import re
import subprocess
import time
import urllib.request
from typing import Any

# YouTube Data API v3 base URL
API_BASE = "https://www.googleapis.com/youtube/v3"
def _get_api_key() -> str:
    return os.environ.get("YOUTUBE_API_KEY", "")


def _api_get(endpoint: str, params: dict) -> dict | None:
    """Make a YouTube Data API v3 GET request."""
    api_key = _get_api_key()
    if not api_key:
        return None
    params["key"] = api_key
    query = "&".join(f"{k}={v}" for k, v in params.items())
    url = f"{API_BASE}/{endpoint}?{query}"
    try:
        req = urllib.request.Request(url, headers={"Accept": "application/json"})
        resp = urllib.request.urlopen(req, timeout=15)
        return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"  API error: {e}")
        return None


def get_channel_info(channel_id: str) -> dict | None:
    """Fetch channel metadata via API v3."""
    data = _api_get("channels", {
        "part": "snippet,statistics",
        "id": channel_id,
    })
    if not data or not data.get("items"):
        return _get_channel_info_fallback(channel_id)

    item = data["items"][0]
    snippet = item.get("snippet", {})
    stats = item.get("statistics", {})
    thumbnail = (snippet.get("thumbnails", {}).get("medium") or
                 snippet.get("thumbnails", {}).get("default") or {}).get("url")

    return {
        "subscriber_count": int(stats.get("subscriberCount", 0)) or None,
        "description": (snippet.get("description") or "")[:2000],
        "thumbnail_url": thumbnail,
        "video_count": int(stats.get("videoCount", 0)) or None,
        "total_view_count": int(stats.get("viewCount", 0)) or None,
    }


def get_channel_videos(channel_id: str, max_items: int = 30) -> list[dict[str, Any]]:
    """Fetch latest videos from a channel via API v3 search endpoint."""
    # First get the uploads playlist ID
    data = _api_get("channels", {
        "part": "contentDetails",
        "id": channel_id,
    })
    if not data or not data.get("items"):
        return _get_channel_videos_fallback(channel_id, max_items)

    uploads_id = (data["items"][0]
                  .get("contentDetails", {})
                  .get("relatedPlaylists", {})
                  .get("uploads"))
    if not uploads_id:
        return _get_channel_videos_fallback(channel_id, max_items)

    # Fetch playlist items (costs 1 quota unit vs 100 for search)
    videos = []
    next_page = None
    while len(videos) < max_items:
        params = {
            "part": "snippet",
            "playlistId": uploads_id,
            "maxResults": min(50, max_items - len(videos)),
        }
        if next_page:
            params["pageToken"] = next_page

        page = _api_get("playlistItems", params)
        if not page or not page.get("items"):
            break

        for item in page["items"]:
            snippet = item.get("snippet", {})
            vid_id = snippet.get("resourceId", {}).get("videoId")
            if vid_id:
                videos.append({
                    "id": vid_id,
                    "title": snippet.get("title", ""),
                    "description": (snippet.get("description") or "")[:2000],
                    "published_at": snippet.get("publishedAt"),
                    "thumbnail": (snippet.get("thumbnails", {}).get("medium") or
                                  snippet.get("thumbnails", {}).get("default") or {}).get("url"),
                })

        next_page = page.get("nextPageToken")
        if not next_page:
            break

    return videos


def get_video_details(video_id: str) -> dict[str, Any] | None:
    """Fetch video details (stats, duration, tags) via API v3."""
    data = _api_get("videos", {
        "part": "snippet,statistics,contentDetails",
        "id": video_id,
    })
    if not data or not data.get("items"):
        return None

    item = data["items"][0]
    snippet = item.get("snippet", {})
    stats = item.get("statistics", {})
    content = item.get("contentDetails", {})

    duration_iso = content.get("duration", "PT0S")
    duration_seconds = _parse_duration(duration_iso)

    upload_date = (snippet.get("publishedAt") or "")[:10].replace("-", "")

    return {
        "id": video_id,
        "title": snippet.get("title", ""),
        "description": (snippet.get("description") or "")[:2000],
        "view_count": int(stats.get("viewCount", 0)) or None,
        "like_count": int(stats.get("likeCount", 0)) or None,
        "comment_count": int(stats.get("commentCount", 0)) or None,
        "duration": duration_seconds,
        "upload_date": upload_date,
        "thumbnail": (snippet.get("thumbnails", {}).get("medium") or
                      snippet.get("thumbnails", {}).get("default") or {}).get("url"),
        "tags": (snippet.get("tags") or [])[:20],
    }


def get_video_details_batch(video_ids: list[str]) -> list[dict[str, Any]]:
    """Fetch details for up to 50 videos in a single API call."""
    if not video_ids:
        return []

    results = []
    # API allows max 50 IDs per request
    for i in range(0, len(video_ids), 50):
        batch = video_ids[i:i + 50]
        ids_str = ",".join(batch)

        data = _api_get("videos", {
            "part": "snippet,statistics,contentDetails",
            "id": ids_str,
        })
        if not data or not data.get("items"):
            continue

        for item in data["items"]:
            snippet = item.get("snippet", {})
            stats = item.get("statistics", {})
            content = item.get("contentDetails", {})
            duration_seconds = _parse_duration(content.get("duration", "PT0S"))
            upload_date = (snippet.get("publishedAt") or "")[:10].replace("-", "")

            results.append({
                "id": item["id"],
                "title": snippet.get("title", ""),
                "description": (snippet.get("description") or "")[:2000],
                "view_count": int(stats.get("viewCount", 0)) or None,
                "like_count": int(stats.get("likeCount", 0)) or None,
                "comment_count": int(stats.get("commentCount", 0)) or None,
                "duration": duration_seconds,
                "upload_date": upload_date,
                "thumbnail": (snippet.get("thumbnails", {}).get("medium") or
                              snippet.get("thumbnails", {}).get("default") or {}).get("url"),
                "tags": (snippet.get("tags") or [])[:20],
            })

    return results


def get_video_subtitle(video_id: str) -> str | None:
    """Download auto-generated Korean subtitles using yt-dlp (still needed for subtitles)."""
    import tempfile

    with tempfile.TemporaryDirectory() as tmpdir:
        try:
            result = subprocess.run(
                [
                    "yt-dlp",
                    "--write-auto-sub",
                    "--sub-lang", "ko",
                    "--skip-download",
                    "--sub-format", "vtt",
                    "--no-warnings",
                    "--quiet",
                    "-o", os.path.join(tmpdir, "%(id)s.%(ext)s"),
                    f"https://www.youtube.com/watch?v={video_id}",
                ],
                capture_output=True,
                text=True,
                timeout=20,
            )

            vtt_files = [f for f in os.listdir(tmpdir) if f.endswith(".vtt")]
            if not vtt_files:
                return None

            with open(os.path.join(tmpdir, vtt_files[0]), "r", encoding="utf-8") as f:
                content = f.read()

            lines = []
            for line in content.split("\n"):
                line = line.strip()
                if (
                    line
                    and not line.startswith("WEBVTT")
                    and not line.startswith("Kind:")
                    and not line.startswith("Language:")
                    and "-->" not in line
                    and not line[0].isdigit()
                ):
                    cleaned = line.replace("<c>", "").replace("</c>", "")
                    if cleaned and cleaned not in lines[-1:]:
                        lines.append(cleaned)

            return " ".join(lines) if lines else None
        except (subprocess.TimeoutExpired, OSError, FileNotFoundError):
            return None


def _parse_duration(iso_duration: str) -> int:
    """Parse ISO 8601 duration (PT1H2M3S) to seconds."""
    match = re.match(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", iso_duration)
    if not match:
        return 0
    hours = int(match.group(1) or 0)
    minutes = int(match.group(2) or 0)
    seconds = int(match.group(3) or 0)
    return hours * 3600 + minutes * 60 + seconds


def get_video_comments(video_id: str, max_results: int = 50) -> list[dict]:
    """Fetch top-level comments for a video via API v3 commentThreads."""
    comments = []
    next_page = None

    while len(comments) < max_results:
        params = {
            "part": "snippet",
            "videoId": video_id,
            "maxResults": min(100, max_results - len(comments)),
            "order": "relevance",
            "textFormat": "plainText",
        }
        if next_page:
            params["pageToken"] = next_page

        data = _api_get("commentThreads", params)
        if not data or not data.get("items"):
            break

        for item in data["items"]:
            snippet = item.get("snippet", {}).get("topLevelComment", {}).get("snippet", {})
            comments.append({
                "text": snippet.get("textDisplay", ""),
                "like_count": int(snippet.get("likeCount", 0)),
                "published_at": snippet.get("publishedAt"),
                "author": snippet.get("authorDisplayName", ""),
            })

        next_page = data.get("nextPageToken")
        if not next_page:
            break

    return comments


def rate_limit_wait(seconds: float = 0.1) -> None:
    """Minimal wait between API calls (API v3 has generous limits)."""
    time.sleep(seconds)


# ─── Fallbacks using yt-dlp (when API key not available) ───

def _get_channel_info_fallback(channel_id: str) -> dict | None:
    """Fallback: fetch channel info via yt-dlp."""
    url = f"https://www.youtube.com/channel/{channel_id}"
    try:
        result = subprocess.run(
            ["yt-dlp", "--dump-json", "--playlist-items", "1",
             "--no-warnings", "--quiet", url],
            capture_output=True, text=True, timeout=30,
        )
        if result.returncode != 0:
            return None
        data = json.loads(result.stdout.strip().split('\n')[0])
        return {
            "subscriber_count": data.get("channel_follower_count"),
            "description": data.get("channel_description") or data.get("description"),
            "thumbnail_url": _fetch_channel_avatar(channel_id),
        }
    except Exception:
        return None


def _get_channel_videos_fallback(channel_id: str, max_items: int = 30) -> list[dict]:
    """Fallback: fetch videos via yt-dlp."""
    try:
        result = subprocess.run(
            ["yt-dlp", "--flat-playlist", "--dump-json", "--no-download",
             "--playlist-items", f"1:{max_items}",
             f"https://www.youtube.com/channel/{channel_id}/videos"],
            capture_output=True, text=True, timeout=120,
        )
        if result.returncode != 0:
            return []
        videos = []
        for line in result.stdout.strip().split("\n"):
            if line:
                try:
                    videos.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
        return videos
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return []


def _fetch_channel_avatar(channel_id: str) -> str | None:
    """Extract channel avatar URL from YouTube channel page."""
    try:
        url = f"https://www.youtube.com/channel/{channel_id}"
        req = urllib.request.Request(url, headers={
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
            "Accept-Language": "ko-KR,ko",
        })
        resp = urllib.request.urlopen(req, timeout=10)
        html = resp.read().decode("utf-8")
        match = re.search(
            r'"avatar":\{"thumbnails":\[\{"url":"(https://yt3\.googleusercontent\.com/[^"]+)"',
            html,
        )
        if match:
            return match.group(1)
    except Exception:
        pass
    return None
