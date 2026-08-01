"""Shared HTTP helpers for the scraping crawlers.

Rate limiting is per-module: each caller creates its own RateLimiter so a slow
source cannot starve the others, while the throttling logic lives in one place.
"""
from __future__ import annotations

import re
import time
from html import unescape

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

DEFAULT_HEADERS = {"User-Agent": USER_AGENT}


class RateLimiter:
    """Enforces a minimum interval between successive requests."""

    def __init__(self, min_interval: float = 2.0):
        self.min_interval = min_interval
        self._last_request_time = 0.0

    def wait(self) -> None:
        elapsed = time.time() - self._last_request_time
        if elapsed < self.min_interval:
            time.sleep(self.min_interval - elapsed)
        self._last_request_time = time.time()


def clean_html(html_text: str) -> str:
    """Strip HTML tags and unescape entities."""
    text = unescape(html_text)
    text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", text).strip()
