"""MoneyTech Telegram Crawler - Collects channel messages and runs NLP analysis."""
from __future__ import annotations

import asyncio
import json
import os
from datetime import datetime, timezone

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

from asset_dictionary import find_assets_in_text, analyze_sentiment, analyze_sentiment_for_asset, generate_simple_summary
from db import get_conn, close_pool
from logger import logger
from prediction_detector import detect_predictions
from telegram_client import create_client, get_channel_messages, get_channel_info, TelegramMessage

load_dotenv()


def load_telegram_channels() -> dict[str, list[dict]]:
    """Load target telegram channels from telegram_channels.json."""
    with open(
        os.path.join(os.path.dirname(__file__), "telegram_channels.json"), encoding="utf-8"
    ) as f:
        return json.load(f)


def upsert_telegram_channel(cur, channel_info: dict, config: dict, category: str) -> str:
    """Insert or update a Telegram channel in channels table, returns UUID."""
    username = config["username"]

    cur.execute(
        "SELECT id FROM channels WHERE telegram_username = %s",
        (username,),
    )
    existing = cur.fetchone()

    name = config.get("name") or (channel_info.get("title") if channel_info else username)
    tg_id = channel_info.get("id") if channel_info else None
    subscriber_count = channel_info.get("participants_count") if channel_info else None

    if existing:
        cur.execute(
            """UPDATE channels SET name = %s, category = %s,
            telegram_channel_id = COALESCE(%s, telegram_channel_id),
            subscriber_count = COALESCE(%s, subscriber_count),
            updated_at = NOW()
            WHERE telegram_username = %s""",
            (name, category, tg_id, subscriber_count, username),
        )
        return str(existing[0])
    else:
        cur.execute(
            """INSERT INTO channels (name, category, platform, telegram_username, telegram_channel_id, subscriber_count)
            VALUES (%s, %s, 'telegram', %s, %s, %s) RETURNING id""",
            (name, category, username, tg_id, subscriber_count),
        )
        return str(cur.fetchone()[0])


def upsert_telegram_message(cur, msg: TelegramMessage, channel_uuid: str) -> bool:
    """Insert or update a Telegram message in videos table. Returns True if new."""
    cur.execute(
        "SELECT id FROM videos WHERE channel_id = %s AND telegram_message_id = %s",
        (channel_uuid, msg.message_id),
    )
    existing = cur.fetchone()

    # Title = first line or first 100 chars
    first_line = msg.text.split("\n")[0][:100] if msg.text else ""
    title = first_line or f"Message #{msg.message_id}"

    published_at = msg.date.strftime("%Y-%m-%dT%H:%M:%SZ") if msg.date else None

    if existing:
        cur.execute(
            """UPDATE videos SET title = %s, content_text = %s,
            view_count = %s, published_at = %s
            WHERE channel_id = %s AND telegram_message_id = %s""",
            (
                title,
                (msg.text or "")[:10000],
                msg.views,
                published_at,
                channel_uuid,
                msg.message_id,
            ),
        )
        return False
    else:
        cur.execute(
            """INSERT INTO videos (channel_id, title, description, content_text,
            published_at, platform, telegram_message_id, view_count)
            VALUES (%s, %s, %s, %s, %s, 'telegram', %s, %s)""",
            (
                channel_uuid,
                title,
                (msg.text or "")[:2000],
                (msg.text or "")[:10000],
                published_at,
                msg.message_id,
                msg.views,
            ),
        )
        return True


def process_telegram_nlp(cur, conn, msg: TelegramMessage, channel_uuid: str) -> None:
    """Run NLP analysis on a Telegram message (same pipeline as YouTube/Blog)."""
    try:
        combined_text = msg.text or ""

        found_assets = find_assets_in_text(combined_text)
        sentiment = analyze_sentiment(combined_text)

        if found_assets:
            cur.execute(
                "SELECT id FROM videos WHERE channel_id = %s AND telegram_message_id = %s",
                (channel_uuid, msg.message_id),
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

                # Detect predictions (with telegram-adapted context window)
                preds = detect_predictions(combined_text, found_assets, platform="telegram")
                for pred in preds:
                    cur.execute(
                        "SELECT id FROM mentioned_assets WHERE video_id = %s AND asset_name = %s",
                        (vid_uuid, pred["asset_name"]),
                    )
                    ma_row = cur.fetchone()
                    if ma_row:
                        published_at = msg.date.strftime("%Y-%m-%dT%H:%M:%SZ") if msg.date else None
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
                    logger.info("Detected %d predictions", len(preds))

            conn.commit()
            logger.info("Found %d assets mentioned", len(found_assets))

        title = (msg.text or "").split("\n")[0][:100]
        summary = generate_simple_summary(title, found_assets, sentiment)
        cur.execute(
            """UPDATE videos SET summary = %s, sentiment = %s
            WHERE channel_id = %s AND telegram_message_id = %s""",
            (summary, sentiment, channel_uuid, msg.message_id),
        )
        conn.commit()
    except Exception as e:
        logger.error("NLP analysis failed: %s", e, exc_info=True)
        conn.rollback()


def get_max_message_id(cur, channel_uuid: str) -> int:
    """Get the maximum telegram_message_id for a channel for backfill."""
    cur.execute(
        "SELECT COALESCE(MAX(telegram_message_id), 0) FROM videos WHERE channel_id = %s AND telegram_message_id IS NOT NULL",
        (channel_uuid,),
    )
    row = cur.fetchone()
    return int(row[0]) if row and row[0] else 0


async def _crawl_telegram_async() -> None:
    """Async main crawling function."""
    channels_config = load_telegram_channels()
    client = create_client()

    if not client:
        logger.error("Failed to create Telegram client. Check env vars.")
        return

    total_new = 0
    total_updated = 0

    with get_conn() as conn:
        async with client:
            with conn.cursor() as cur:
                for category, channels in channels_config.items():
                    if not channels:
                        continue
                    logger.info("=== Telegram Category: %s (%d channels) ===", category, len(channels))

                    for ch_config in channels:
                        username = ch_config["username"]
                        logger.info("Processing channel: @%s", username)

                        # Fetch channel info
                        ch_info = await get_channel_info(client, username)

                        channel_uuid = upsert_telegram_channel(cur, ch_info, ch_config, category)
                        conn.commit()

                        # Get backfill marker
                        min_id = get_max_message_id(cur, channel_uuid)
                        if min_id > 0:
                            logger.info("Backfill: fetching messages after ID %d", min_id)

                        # Fetch messages
                        messages = await get_channel_messages(client, username, limit=50, min_id=min_id)
                        logger.info("Messages: %d fetched", len(messages))

                        for msg in messages:
                            is_new = upsert_telegram_message(cur, msg, channel_uuid)
                            conn.commit()

                            if is_new:
                                total_new += 1
                                logger.info("NEW: %s...", msg.text[:60])
                                process_telegram_nlp(cur, conn, msg, channel_uuid)
                            else:
                                total_updated += 1

                        # Update channel message count
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

    logger.info("=== Telegram Crawl complete ===")
    logger.info("New messages: %d", total_new)
    logger.info("Updated messages: %d", total_updated)


def crawl_telegram() -> None:
    """Main entry point for Telegram crawling."""
    asyncio.run(_crawl_telegram_async())


if __name__ == "__main__":
    crawl_telegram()
