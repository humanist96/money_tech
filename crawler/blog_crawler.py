"""MoneyTech Naver Blog Crawler - Collects blogger posts and runs NLP analysis."""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

from db import get_conn, close_pool
from logger import logger
from naver_blog import fetch_rss_posts, fetch_blog_post_content, fetch_blog_profile_image
from nlp_pipeline import NLPPipeline

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


_nlp = NLPPipeline()
_use_llm = bool(os.environ.get("OPENAI_API_KEY"))


def process_blog_post_nlp(cur, conn, post, channel_uuid: str) -> None:
    """Run NLP analysis on a blog post using unified NLPPipeline."""
    try:
        combined_text = f"{post.title} {post.description} {post.content_text or ''}"

        result = _nlp.process(combined_text, post.title, use_llm=_use_llm)

        cur.execute(
            "SELECT id FROM videos WHERE blog_post_url = %s",
            (post.link,),
        )
        vid_row = cur.fetchone()
        if vid_row:
            vid_uuid = str(vid_row[0])
            _nlp.store_results(
                cur, conn, vid_uuid, channel_uuid, result, post.published_at
            )
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

                    # Pre-fetch which post URLs already exist so we only scrape
                    # full content for genuinely new posts. Cuts per-blogger time
                    # from ~30s to ~5s in the steady state where almost all RSS
                    # entries are already ingested.
                    post_links = [p.link for p in posts if p.link]
                    existing_links: set[str] = set()
                    if post_links:
                        cur.execute(
                            "SELECT blog_post_url FROM videos WHERE blog_post_url = ANY(%s)",
                            (post_links,),
                        )
                        existing_links = {row[0] for row in cur.fetchall()}

                    for post in posts:
                        is_existing = post.link in existing_links
                        if not is_existing and post.log_no:
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
