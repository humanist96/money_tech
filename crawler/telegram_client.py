"""Telegram API wrapper using Telethon for reading public channel messages."""
from __future__ import annotations

import os
import time
from dataclasses import dataclass
from datetime import datetime
from typing import Optional

from dotenv import load_dotenv

load_dotenv()

MIN_REQUEST_INTERVAL = 2.0
_last_request_time = 0.0


@dataclass
class TelegramMessage:
    """A single message from a Telegram channel."""
    channel_username: str
    message_id: int
    text: str
    date: Optional[datetime]
    views: Optional[int]
    forwards: Optional[int]
    caption: Optional[str]
    message_url: str


def _rate_limit() -> None:
    """Enforce rate limiting between requests."""
    global _last_request_time
    elapsed = time.time() - _last_request_time
    if elapsed < MIN_REQUEST_INTERVAL:
        time.sleep(MIN_REQUEST_INTERVAL - elapsed)
    _last_request_time = time.time()


def create_client():
    """Create and return a Telethon TelegramClient using StringSession.

    Requires environment variables:
        TELEGRAM_API_ID: Telegram API ID
        TELEGRAM_API_HASH: Telegram API Hash
        TELEGRAM_SESSION_STRING: StringSession string for headless operation

    Returns:
        TelegramClient instance (not yet connected)
    """
    try:
        from telethon import TelegramClient
        from telethon.sessions import StringSession
    except ImportError:
        print("Error: telethon is not installed. Run: pip install telethon")
        return None

    api_id = os.environ.get("TELEGRAM_API_ID")
    api_hash = os.environ.get("TELEGRAM_API_HASH")
    session_string = os.environ.get("TELEGRAM_SESSION_STRING", "")

    if not api_id or not api_hash:
        print("Error: TELEGRAM_API_ID and TELEGRAM_API_HASH must be set")
        return None

    return TelegramClient(
        StringSession(session_string),
        int(api_id),
        api_hash,
    )


async def get_channel_messages(
    client,
    username: str,
    limit: int = 50,
    min_id: int = 0,
) -> list[TelegramMessage]:
    """Fetch recent messages from a public Telegram channel.

    Args:
        client: Connected TelegramClient
        username: Channel username (without @)
        limit: Maximum number of messages to fetch
        min_id: Only fetch messages with ID > min_id (for incremental updates)

    Returns:
        List of TelegramMessage objects, newest first
    """
    _rate_limit()

    messages: list[TelegramMessage] = []

    try:
        entity = await client.get_entity(username)

        async for message in client.iter_messages(entity, limit=limit, min_id=min_id):
            text = message.text or message.message or ""
            if not text.strip():
                continue

            msg_url = f"https://t.me/{username}/{message.id}"

            messages.append(TelegramMessage(
                channel_username=username,
                message_id=message.id,
                text=text,
                date=message.date,
                views=message.views,
                forwards=getattr(message, 'forwards', None),
                caption=None,
                message_url=msg_url,
            ))

    except Exception as e:
        print(f"  Error fetching messages from @{username}: {e}")

    return messages


async def get_channel_info(client, username: str) -> Optional[dict]:
    """Fetch channel metadata.

    Args:
        client: Connected TelegramClient
        username: Channel username

    Returns:
        Dict with channel info or None
    """
    _rate_limit()

    try:
        entity = await client.get_entity(username)
        return {
            "id": entity.id,
            "title": getattr(entity, "title", username),
            "username": username,
            "participants_count": getattr(entity, "participants_count", None),
        }
    except Exception as e:
        print(f"  Error fetching channel info for @{username}: {e}")
        return None
