"""Generate Telegram StringSession for headless operation.

Run this script ONCE interactively in your terminal:
    python3 generate_telegram_session.py

It will ask for:
1. Your phone number (e.g., +821012345678)
2. The verification code Telegram sends you
3. 2FA password (if enabled)

Then it prints the session string to paste into .env
"""
from telethon.sync import TelegramClient
from telethon.sessions import StringSession

API_ID = 38649499
API_HASH = "ba3bdc23bf16ae55b35ec012fb9b01b4"

with TelegramClient(StringSession(), API_ID, API_HASH) as client:
    session_string = client.session.save()
    print("\n" + "=" * 60)
    print("SESSION STRING (copy this to .env):")
    print("=" * 60)
    print(session_string)
    print("=" * 60)
    print("\nPaste into crawler/.env as:")
    print(f"TELEGRAM_SESSION_STRING={session_string}")
