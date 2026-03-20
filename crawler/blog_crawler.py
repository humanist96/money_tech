"""MoneyTech Naver Blog Crawler - Collects blogger posts and runs NLP analysis."""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

from asset_dictionary import find_assets_in_text, analyze_sentiment, analyze_sentiment_for_asset, generate_simple_summary
from db import get_conn, close_pool
from logger import logger
from naver_blog import fetch_rss_posts, fetch_blog_post_content, fetch_blog_profile_image
from prediction_detector import detect_predictions

load_dotenv()


def load_bloggers() -> dict[str, list[dict]]:
    """Load target bloggers from bloggers.json."""
    with open(
        os.path.join(os.path.dirname(__file__), "bloggers.json"), encoding="utf-8"
    ) as f:
        return json.load(f)


def upsert_blogger(cur, blogger: dict, category: str) -> str:
    """Insert or update a blogger in channels table, returns UUID."""
    cur.execute(
        "SELECT id FROM channels WHERE blog_id = %s",
        (blogger["blog_id"],),
    )
    existing = cur.fetchone()

    blog_url = f"https://blog.naver.com/{blogger['blog_id']}"

    if existing:
        cur.execute(
            """UPDATE channels SET name = %s, category = %s, blog_url = %s, updated_at = NOW()
            WHERE blog_id = %s""",
            (blogger["name"], category, blog_url, blogger["blog_id"]),
        )
        return str(existing[0])
    else:
        cur.execute(
            """INSERT INTO channels (name, category, platform, blog_id, blog_url)
            VALUES (%s, %s, 'naver_blog', %s, %s) RETURNING id""",
            (blogger["name"], category, blogger["blog_id"], blog_url),
        )
        return str(cur.fetchone()[0])


def upsert_blog_post(cur, post, channel_uuid: str) -> bool:
    """Insert or update a blog post in videos table. Returns True if new."""
    if not post.link:
        return False

    cur.execute(
        "SELECT id FROM videos WHERE blog_post_url = %s",
        (post.link,),
    )
    existing = cur.fetchone()

    if existing:
        cur.execute(
            """UPDATE videos SET title = %s, description = %s,
            content_text = %s, published_at = %s
            WHERE blog_post_url = %s""",
            (
                post.title,
                (post.description or "")[:2000],
                (post.content_text or "")[:10000],
                post.published_at,
                post.link,
            ),
        )
        return False
    else:
        cur.execute(
            """INSERT INTO videos (channel_id, title, description, published_at,
            platform, blog_post_url, content_text)
            VALUES (%s, %s, %s, %s, 'naver_blog', %s, %s)""",
            (
                channel_uuid,
                post.title,
                (post.description or "")[:2000],
                post.published_at,
                post.link,
                (post.content_text or "")[:10000],
            ),
        )
        return True


def process_blog_post_nlp(cur, conn, post, channel_uuid: str) -> None:
    """Run NLP analysis on a blog post (same pipeline as YouTube videos)."""
    try:
        combined_text = f"{post.title} {post.description} {post.content_text or ''}"

        found_assets = find_assets_in_text(combined_text)
        sentiment = analyze_sentiment(combined_text)

        if found_assets:
            cur.execute(
                "SELECT id FROM videos WHERE blog_post_url = %s",
                (post.link,),
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

                # Detect predictions
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
                                post.published_at,
                            ),
                        )
                if preds:
                    logger.info("Detected %d predictions", len(preds))

            conn.commit()
            logger.info("Found %d assets mentioned", len(found_assets))

        summary = generate_simple_summary(post.title, found_assets, sentiment)
        cur.execute(
            """UPDATE videos SET summary = %s, sentiment = %s
            WHERE blog_post_url = %s""",
            (summary, sentiment, post.link),
        )
        conn.commit()
    except Exception as e:
        logger.error("NLP analysis failed: %s", e, exc_info=True)
        conn.rollback()


def crawl_blogs() -> None:
    """Main blog crawling function."""
    bloggers_config = load_bloggers()

    total_new = 0
    total_updated = 0

    with get_conn() as conn:
        with conn.cursor() as cur:
            for category, bloggers in bloggers_config.items():
                logger.info("=== Blog Category: %s (%d bloggers) ===", category, len(bloggers))

                for blogger in bloggers:
                    blog_id = blogger["blog_id"]
                    logger.info("Processing blogger: %s (%s)", blogger["name"], blog_id)

                    channel_uuid = upsert_blogger(cur, blogger, category)
                    conn.commit()

                    # Fetch and store profile image
                    try:
                        profile_img = fetch_blog_profile_image(blog_id)
                        if profile_img:
                            cur.execute(
                                "UPDATE channels SET thumbnail_url = %s WHERE id = %s AND (thumbnail_url IS NULL OR thumbnail_url = '')",
                                (profile_img, channel_uuid),
                            )
                            conn.commit()
                            logger.info("Profile image: OK")
                    except Exception as e:
                        logger.error("Profile image fetch failed: %s", e, exc_info=True)
                        conn.rollback()

                    # Fetch RSS posts
                    posts = fetch_rss_posts(blog_id, max_posts=15)
                    logger.info("RSS: %d posts found", len(posts))

                    if not posts:
                        continue

                    for post in posts:
                        # Try to fetch full content if we have a log_no
                        if post.log_no:
                            full_text = fetch_blog_post_content(blog_id, post.log_no)
                            if full_text:
                                post.content_text = full_text

                        is_new = upsert_blog_post(cur, post, channel_uuid)
                        conn.commit()

                        if is_new:
                            total_new += 1
                            logger.info("NEW: %s", post.title[:60])

                            # NLP analysis only for NEW posts
                            process_blog_post_nlp(cur, conn, post, channel_uuid)
                        else:
                            total_updated += 1

                    # Update channel post count
                    cur.execute(
                        """UPDATE channels SET
                            video_count = COALESCE(
                                (SELECT count(*) FROM videos WHERE channel_id = %s), video_count
                            )
                        WHERE id = %s""",
                        (channel_uuid, channel_uuid),
                    )
                    conn.commit()

    close_pool()

    logger.info("=== Blog Crawl complete ===")
    logger.info("New posts: %d", total_new)
    logger.info("Updated posts: %d", total_updated)


if __name__ == "__main__":
    crawl_blogs()
