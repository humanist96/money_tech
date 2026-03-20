"""Structured logging for all MoneyTech crawlers.

Provides a pre-configured logger that outputs structured messages
suitable for both local development and GitHub Actions logs.

Usage:
    from logger import logger

    logger.info("Processing channel %s", channel_name)
    logger.error("Failed to fetch %s: %s", url, err, exc_info=True)
"""
from __future__ import annotations

import logging
import sys


def setup_logger(name: str = "moneytech") -> logging.Logger:
    """Create (or return existing) structured logger."""
    log = logging.getLogger(name)
    if not log.handlers:
        handler = logging.StreamHandler(sys.stdout)
        formatter = logging.Formatter(
            "[%(asctime)s] %(levelname)s %(module)s: %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        handler.setFormatter(formatter)
        log.addHandler(handler)
        log.setLevel(logging.INFO)
    return log


logger = setup_logger()
