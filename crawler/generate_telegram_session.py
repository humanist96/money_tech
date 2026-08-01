"""Generate Telegram StringSession for headless operation.

Run this script ONCE interactively in your terminal:
    python3 generate_telegram_session.py

It will ask for:
1. Your phone number (e.g., +821012345678)
2. The verification code Telegram sends you
3. 2FA password (if enabled)

Then it prints the session string to paste into .env
"""
import os

from telethon.sync import TelegramClient
from telethon.sessions import StringSession

API_ID = os.environ.get("TELEGRAM_API_ID")
API_HASH = os.environ.get("TELEGRAM_API_HASH")

if not API_ID or not API_HASH:
    raise SystemExit(
        "TELEGRAM_API_ID / TELEGRAM_API_HASH 환경변수를 설정하세요 (my.telegram.org에서 발급)."
    )

with TelegramClient(StringSession(), int(API_ID), API_HASH) as client:
    session_string = client.session.save()
    print("\n" + "=" * 60)
    print("SESSION STRING (copy this to .env):")
    print("=" * 60)
    print(session_string)
    print("=" * 60)
    print("\nPaste into crawler/.env as:")
    print(f"TELEGRAM_SESSION_STRING={session_string}")
