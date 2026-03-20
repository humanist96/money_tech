"""Creator Discovery Pipeline - find and validate new YouTube channels and Naver bloggers.

Discovers new creators via keyword search, validates activity/quality,
and outputs candidates.json + auto-registers high-scoring ones.

Usage:
  python discover.py                    # Full discovery (YouTube + Blog)
  python discover.py --youtube-only     # YouTube only
  python discover.py --blog-only        # Blog only
  python discover.py --dry-run          # Don't modify JSON files
"""
from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone

from dotenv import load_dotenv

from discover_youtube import discover_youtube_channels
from discover_blog import discover_blog_channels
from logger import logger

load_dotenv()

CHANNELS_FILE = os.path.join(os.path.dirname(__file__), "channels.json")
BLOGGERS_FILE = os.path.join(os.path.dirname(__file__), "bloggers.json")
CANDIDATES_FILE = os.path.join(os.path.dirname(__file__), "candidates.json")

AUTO_REGISTER_THRESHOLD = 90
CANDIDATE_THRESHOLD = 60


def load_existing_youtube_ids() -> set[str]:
    """Load existing YouTube channel IDs."""
    with open(CHANNELS_FILE, encoding="utf-8") as f:
        data = json.load(f)
    ids = set()
    for channels in data.values():
        for ch in channels:
            ids.add(ch["channel_id"])
    return ids


def load_existing_blog_ids() -> set[str]:
    """Load existing blog IDs."""
    with open(BLOGGERS_FILE, encoding="utf-8") as f:
        data = json.load(f)
    ids = set()
    for bloggers in data.values():
        for b in bloggers:
            ids.add(b["blog_id"])
    return ids


def auto_register_youtube(candidates: list[dict], dry_run: bool = False) -> int:
    """Add high-scoring YouTube channels to channels.json."""
    if dry_run:
        return 0

    with open(CHANNELS_FILE, encoding="utf-8") as f:
        data = json.load(f)

    existing_ids = set()
    for channels in data.values():
        for ch in channels:
            existing_ids.add(ch["channel_id"])

    added = 0
    for c in candidates:
        if c["score"]["total"] < AUTO_REGISTER_THRESHOLD:
            continue
        if c["channel_id"] in existing_ids:
            continue

        category = c["category"]
        if category not in data:
            data[category] = []

        data[category].append({
            "name": c["name"],
            "channel_id": c["channel_id"],
        })
        existing_ids.add(c["channel_id"])
        added += 1
        logger.info(f"  Auto-registered YouTube: {c['name']} ({category}, score={c['score']['total']})")

    if added > 0:
        with open(CHANNELS_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write("\n")

    return added


def auto_register_blog(candidates: list[dict], dry_run: bool = False) -> int:
    """Add high-scoring bloggers to bloggers.json."""
    if dry_run:
        return 0

    with open(BLOGGERS_FILE, encoding="utf-8") as f:
        data = json.load(f)

    existing_ids = set()
    for bloggers in data.values():
        for b in bloggers:
            existing_ids.add(b["blog_id"])

    added = 0
    for c in candidates:
        if c["score"]["total"] < AUTO_REGISTER_THRESHOLD:
            continue
        if c["blog_id"] in existing_ids:
            continue

        category = c["category"]
        if category not in data:
            data[category] = []

        data[category].append({
            "name": c["name"],
            "blog_id": c["blog_id"],
        })
        existing_ids.add(c["blog_id"])
        added += 1
        logger.info(f"  Auto-registered Blog: {c['name']} ({category}, score={c['score']['total']})")

    if added > 0:
        with open(BLOGGERS_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write("\n")

    return added


def check_existing_health() -> dict:
    """Check health of existing channels - flag inactive ones."""
    report = {"youtube_inactive": [], "blog_inactive": []}

    # Check YouTube channels
    try:
        from discover_youtube import get_channel_stats, get_recent_videos
        with open(CHANNELS_FILE, encoding="utf-8") as f:
            yt_data = json.load(f)

        logger.info("\n=== Checking YouTube channel health ===")
        for category, channels in yt_data.items():
            for ch in channels:
                stats = get_channel_stats(ch["channel_id"])
                if not stats:
                    report["youtube_inactive"].append({
                        "name": ch["name"],
                        "channel_id": ch["channel_id"],
                        "category": category,
                        "reason": "API error",
                    })
                    continue

                uploads = stats.get("uploads_playlist")
                if uploads:
                    recent = get_recent_videos(uploads, max_items=5)
                    from datetime import datetime, timezone, timedelta
                    cutoff = datetime.now(timezone.utc) - timedelta(days=60)
                    has_recent = False
                    for v in recent:
                        pub = v.get("published_at", "")
                        if pub:
                            try:
                                dt = datetime.fromisoformat(pub.replace("Z", "+00:00"))
                                if dt >= cutoff:
                                    has_recent = True
                                    break
                            except ValueError:
                                pass
                    if not has_recent:
                        report["youtube_inactive"].append({
                            "name": ch["name"],
                            "channel_id": ch["channel_id"],
                            "category": category,
                            "reason": "No uploads in 60 days",
                        })
                        logger.info(f"  INACTIVE: {ch['name']} ({category})")
    except Exception as e:
        logger.error("YouTube health check error: %s", e, exc_info=True)

    # Check Blog health
    try:
        from discover_blog import get_blog_rss_info, _parse_date
        with open(BLOGGERS_FILE, encoding="utf-8") as f:
            blog_data = json.load(f)

        logger.info("\n=== Checking Blog health ===")
        for category, bloggers in blog_data.items():
            for b in bloggers:
                rss = get_blog_rss_info(b["blog_id"])
                if not rss or rss["post_count"] == 0:
                    report["blog_inactive"].append({
                        "name": b["name"],
                        "blog_id": b["blog_id"],
                        "category": category,
                        "reason": "RSS unavailable or empty",
                    })
                    logger.info(f"  INACTIVE: {b['name']} ({category}) - no RSS")
                    continue

                cutoff = datetime.now(timezone.utc) - timedelta(days=60)
                has_recent = False
                for p in rss["posts"]:
                    dt = _parse_date(p.get("pub_date", ""))
                    if dt and dt >= cutoff:
                        has_recent = True
                        break
                if not has_recent:
                    report["blog_inactive"].append({
                        "name": b["name"],
                        "blog_id": b["blog_id"],
                        "category": category,
                        "reason": "No posts in 60 days",
                    })
                    logger.info(f"  INACTIVE: {b['name']} ({category})")
    except Exception as e:
        logger.error("Blog health check error: %s", e, exc_info=True)

    return report


def main():
    args = set(sys.argv[1:])
    dry_run = "--dry-run" in args
    youtube_only = "--youtube-only" in args
    blog_only = "--blog-only" in args
    skip_health = "--skip-health" in args

    if dry_run:
        logger.info("=== DRY RUN MODE - no files will be modified ===\n")

    now = datetime.now(timezone.utc).isoformat()
    report = {
        "discovered_at": now,
        "youtube_candidates": [],
        "blog_candidates": [],
        "youtube_auto_registered": 0,
        "blog_auto_registered": 0,
        "health": {},
    }

    # YouTube discovery
    if not blog_only:
        existing_yt = load_existing_youtube_ids()
        logger.info(f"Existing YouTube channels: {len(existing_yt)}")

        yt_candidates = discover_youtube_channels(existing_yt)
        qualified = [c for c in yt_candidates if c["score"]["total"] >= CANDIDATE_THRESHOLD]
        report["youtube_candidates"] = qualified

        logger.info(f"\n=== YouTube Results ===")
        logger.info(f"Total candidates found: {len(yt_candidates)}")
        logger.info(f"Qualified (score>={CANDIDATE_THRESHOLD}): {len(qualified)}")
        logger.info(f"Auto-register (score>={AUTO_REGISTER_THRESHOLD}): "
              f"{sum(1 for c in qualified if c['score']['total'] >= AUTO_REGISTER_THRESHOLD)}")

        added = auto_register_youtube(qualified, dry_run=dry_run)
        report["youtube_auto_registered"] = added
        if added:
            logger.info(f"  -> Auto-registered {added} new YouTube channels")

    # Blog discovery
    if not youtube_only:
        existing_blog = load_existing_blog_ids()
        logger.info(f"\nExisting bloggers: {len(existing_blog)}")

        blog_candidates = discover_blog_channels(existing_blog)
        qualified = [c for c in blog_candidates if c["score"]["total"] >= CANDIDATE_THRESHOLD]
        report["blog_candidates"] = qualified

        logger.info(f"\n=== Blog Results ===")
        logger.info(f"Total candidates found: {len(blog_candidates)}")
        logger.info(f"Qualified (score>={CANDIDATE_THRESHOLD}): {len(qualified)}")
        logger.info(f"Auto-register (score>={AUTO_REGISTER_THRESHOLD}): "
              f"{sum(1 for c in qualified if c['score']['total'] >= AUTO_REGISTER_THRESHOLD)}")

        added = auto_register_blog(qualified, dry_run=dry_run)
        report["blog_auto_registered"] = added
        if added:
            logger.info(f"  -> Auto-registered {added} new bloggers")

    # Health check
    if not skip_health:
        health = check_existing_health()
        report["health"] = health
        if health.get("youtube_inactive"):
            logger.info(f"\n  YouTube inactive: {len(health['youtube_inactive'])} channels")
        if health.get("blog_inactive"):
            logger.info(f"  Blog inactive: {len(health['blog_inactive'])} bloggers")

    # Save candidates report
    with open(CANDIDATES_FILE, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2, default=str)
        f.write("\n")
    logger.info(f"\nCandidates report saved to {CANDIDATES_FILE}")

    # Summary
    logger.info(f"\n{'='*50}")
    logger.info(f"DISCOVERY COMPLETE")
    logger.info(f"  YouTube auto-registered: {report['youtube_auto_registered']}")
    logger.info(f"  Blog auto-registered: {report['blog_auto_registered']}")
    logger.info(f"  YouTube candidates: {len(report['youtube_candidates'])}")
    logger.info(f"  Blog candidates: {len(report['blog_candidates'])}")
    logger.info(f"{'='*50}")


if __name__ == "__main__":
    main()
