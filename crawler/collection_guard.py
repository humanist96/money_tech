"""Collection volume guard.

Scrapers that rely on HTML structure fail silently: a markup change or a bot
block yields zero rows while the job still exits 0, so the pipeline looks
healthy for days. This guard makes an empty harvest a loud failure.

Thresholds are deliberately low — they catch "collected nothing at all", not
normal day-to-day variation (holidays, quiet channels).
"""
from __future__ import annotations

import os
import sys

from logger import logger

# Minimum records a source must produce per run before we treat it as broken.
MIN_COLLECTED = {
    "youtube": 1,
    "blog": 1,
    "telegram": 1,
    "analyst_report": 1,
}


def require_min_collected(source: str, collected: int) -> None:
    """Log the harvest and exit non-zero when a source collected nothing.

    Set SKIP_COLLECTION_GUARD=1 to bypass (useful for local one-off runs).
    """
    threshold = MIN_COLLECTED.get(source, 1)
    logger.info("[collection-guard] %s collected %d record(s)", source, collected)

    if collected >= threshold:
        return

    if os.environ.get("SKIP_COLLECTION_GUARD") == "1":
        logger.warning(
            "[collection-guard] %s below threshold (%d < %d) — bypassed by SKIP_COLLECTION_GUARD",
            source, collected, threshold,
        )
        return

    logger.error(
        "[collection-guard] %s collected %d record(s), expected at least %d. "
        "This usually means the source markup changed, credentials expired, or "
        "the request was blocked.",
        source, collected, threshold,
    )
    sys.exit(1)
