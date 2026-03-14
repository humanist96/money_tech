"""Naver Stock Discussion Board (종목토론방) HTML scraper."""
from __future__ import annotations

import re
import time
from dataclasses import dataclass
from datetime import datetime
from html import unescape
from typing import Optional

import requests

DISCUSSION_URL = "https://finance.naver.com/item/board.naver"

MIN_REQUEST_INTERVAL = 3.0  # Conservative: 3 seconds to avoid blocking
_last_request_time = 0.0

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)


@dataclass
class DiscussionPost:
    """A single post from a stock discussion board."""
    stock_code: str
    title: str
    author: str
    date: Optional[str]
    view_count: int
    agree_count: int
    disagree_count: int
    body_text: Optional[str]


def _rate_limit() -> None:
    """Enforce rate limiting between requests."""
    global _last_request_time
    elapsed = time.time() - _last_request_time
    if elapsed < MIN_REQUEST_INTERVAL:
        time.sleep(MIN_REQUEST_INTERVAL - elapsed)
    _last_request_time = time.time()


def _clean_html(html_text: str) -> str:
    """Strip HTML tags and unescape entities."""
    text = unescape(html_text)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _parse_int(value: str) -> int:
    """Parse integer from string, returning 0 on failure."""
    cleaned = re.sub(r"[^\d]", "", value)
    return int(cleaned) if cleaned else 0


def fetch_discussion_posts(stock_code: str, page: int = 1) -> list[DiscussionPost]:
    """Fetch discussion posts from a stock's discussion board.

    Uses title-only analysis strategy: titles are sufficiently emotional
    and this avoids excessive page fetches.

    Args:
        stock_code: Stock code (e.g., '005930')
        page: Page number (1-based)

    Returns:
        List of DiscussionPost objects
    """
    _rate_limit()

    try:
        resp = requests.get(
            DISCUSSION_URL,
            params={"code": stock_code, "page": page},
            headers={"User-Agent": USER_AGENT},
            timeout=15,
        )
        resp.raise_for_status()
        html = resp.text
    except requests.RequestException as e:
        print(f"  Discussion fetch failed for {stock_code} (page {page}): {e}")
        return []

    posts: list[DiscussionPost] = []

    # Parse table rows from the discussion board
    # Each row has: 날짜, 제목, 글쓴이, 조회, 공감, 비공감
    row_pattern = re.compile(
        r'<tr[^>]*onmouseover[^>]*>\s*'
        r'<td[^>]*>([^<]*)</td>\s*'  # date
        r'<td[^>]*class="title"[^>]*>\s*<a[^>]*>([^<]*)</a>.*?</td>\s*'  # title
        r'<td[^>]*>.*?</td>\s*'  # author (complex HTML)
        r'<td[^>]*>(\d*)</td>\s*'  # view count
        r'<td[^>]*>(\d*)</td>\s*'  # agree
        r'<td[^>]*>(\d*)</td>',  # disagree
        re.DOTALL,
    )

    for match in row_pattern.finditer(html):
        date_str = _clean_html(match.group(1))
        title = _clean_html(match.group(2))
        view_count = _parse_int(match.group(3))
        agree_count = _parse_int(match.group(4))
        disagree_count = _parse_int(match.group(5))

        if not title:
            continue

        # Extract author from the row (between title and view count cells)
        author = ""
        author_match = re.search(
            r'class="title".*?</td>\s*<td[^>]*>\s*(?:<a[^>]*>)?([^<]*)',
            match.group(0),
            re.DOTALL,
        )
        if author_match:
            author = _clean_html(author_match.group(1))

        posts.append(DiscussionPost(
            stock_code=stock_code,
            title=title,
            author=author,
            date=date_str if date_str else None,
            view_count=view_count,
            agree_count=agree_count,
            disagree_count=disagree_count,
            body_text=None,  # Title-only analysis
        ))

    # Fallback: try simpler parsing
    if not posts:
        posts = _parse_fallback(html, stock_code)

    return posts


def _parse_fallback(html: str, stock_code: str) -> list[DiscussionPost]:
    """Fallback parser for discussion board."""
    posts: list[DiscussionPost] = []

    # Find all title links in the discussion table
    title_pattern = re.compile(
        r'class="title"[^>]*>\s*<a[^>]*title="([^"]*)"',
        re.DOTALL,
    )

    for match in title_pattern.finditer(html):
        title = _clean_html(match.group(1))
        if not title or len(title) < 2:
            continue

        posts.append(DiscussionPost(
            stock_code=stock_code,
            title=title,
            author="",
            date=None,
            view_count=0,
            agree_count=0,
            disagree_count=0,
            body_text=None,
        ))

    return posts


def fetch_multiple_pages(stock_code: str, max_pages: int = 3) -> list[DiscussionPost]:
    """Fetch discussion posts from multiple pages.

    Args:
        stock_code: Stock code
        max_pages: Maximum pages to crawl

    Returns:
        Combined list of posts
    """
    all_posts: list[DiscussionPost] = []

    for page in range(1, max_pages + 1):
        posts = fetch_discussion_posts(stock_code, page)
        all_posts.extend(posts)

        if not posts:
            break

    return all_posts
