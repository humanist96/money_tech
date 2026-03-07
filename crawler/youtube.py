"""yt-dlp wrapper for YouTube channel/video metadata extraction."""

import json
import subprocess
import time
from typing import Any


def get_channel_info(channel_id: str) -> dict[str, Any] | None:
    """Fetch channel metadata using yt-dlp."""
    try:
        result = subprocess.run(
            [
                "yt-dlp",
                "--dump-json",
                "--playlist-items", "0",
                "--no-download",
                f"https://www.youtube.com/channel/{channel_id}/about",
            ],
            capture_output=True,
            text=True,
            timeout=30,
        )
        if result.returncode != 0:
            return None
        return json.loads(result.stdout)
    except (subprocess.TimeoutExpired, json.JSONDecodeError):
        return None


def get_channel_videos(channel_id: str, max_items: int = 20) -> list[dict[str, Any]]:
    """Fetch latest videos from a channel using yt-dlp flat-playlist."""
    try:
        result = subprocess.run(
            [
                "yt-dlp",
                "--flat-playlist",
                "--dump-json",
                "--no-download",
                "--playlist-items", f"1:{max_items}",
                "--match-filter", "duration > 120",
                f"https://www.youtube.com/channel/{channel_id}/videos",
            ],
            capture_output=True,
            text=True,
            timeout=120,
        )
        if result.returncode != 0:
            print(f"  yt-dlp error: {result.stderr[:200]}")
            return []

        videos = []
        for line in result.stdout.strip().split("\n"):
            if line:
                try:
                    videos.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
        return videos
    except subprocess.TimeoutExpired:
        print(f"  Timeout fetching videos for channel {channel_id}")
        return []


def get_video_details(video_id: str) -> dict[str, Any] | None:
    """Fetch detailed video metadata including subtitles."""
    try:
        result = subprocess.run(
            [
                "yt-dlp",
                "--dump-json",
                "--no-download",
                "--write-auto-sub",
                "--sub-lang", "ko",
                "--skip-download",
                f"https://www.youtube.com/watch?v={video_id}",
            ],
            capture_output=True,
            text=True,
            timeout=60,
        )
        if result.returncode != 0:
            return None
        return json.loads(result.stdout)
    except (subprocess.TimeoutExpired, json.JSONDecodeError):
        return None


def get_video_subtitle(video_id: str) -> str | None:
    """Download auto-generated Korean subtitles for a video."""
    import tempfile
    import os

    with tempfile.TemporaryDirectory() as tmpdir:
        try:
            result = subprocess.run(
                [
                    "yt-dlp",
                    "--write-auto-sub",
                    "--sub-lang", "ko",
                    "--skip-download",
                    "--sub-format", "vtt",
                    "-o", os.path.join(tmpdir, "%(id)s.%(ext)s"),
                    f"https://www.youtube.com/watch?v={video_id}",
                ],
                capture_output=True,
                text=True,
                timeout=30,
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
        except (subprocess.TimeoutExpired, OSError):
            return None


def rate_limit_wait(seconds: float = 3.0) -> None:
    """Wait between API calls to avoid rate limiting."""
    time.sleep(seconds)
