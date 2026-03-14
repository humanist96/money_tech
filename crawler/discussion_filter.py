"""Spam and noise filter for Naver stock discussion board posts."""
from __future__ import annotations

import re
from collections import Counter
from typing import Optional

from naver_discussion import DiscussionPost

# Spam patterns to remove
SPAM_PATTERNS = [
    r"01[0-9]{1}-?\d{3,4}-?\d{4}",  # Phone numbers
    r"https?://\S+",  # URLs
    r"t\.me/\S+",  # Telegram links
    r"카[카톡|톡]",  # KakaoTalk
    r"리딩방",  # Leading room (scam)
    r"무료체험",  # Free trial
    r"수익인증",  # Profit proof (usually spam)
    r"VIP\s*(방|룸|입장)",  # VIP room
    r"선착순",  # First come first served
    r"(주식|코인)\s*방",  # Stock/coin rooms
    r"문의\s*(주|하)",  # Inquiry spam
    r"오픈채팅",  # Open chat
    r"단톡방",  # Group chat room
    r"텔레그램\s*문의",  # Telegram inquiry
    r"입금\s*안내",  # Deposit instructions
    r"추천\s*종목\s*제공",  # Stock recommendation spam
]

# Compile patterns for performance
_SPAM_REGEX = re.compile("|".join(SPAM_PATTERNS), re.IGNORECASE)

# Minimum title length
MIN_TITLE_LENGTH = 5

# Maximum posts per author in a 6-hour window
MAX_POSTS_PER_AUTHOR = 10


def is_spam(post: DiscussionPost) -> bool:
    """Check if a post is spam based on pattern matching.

    Args:
        post: Discussion post to check

    Returns:
        True if the post is likely spam
    """
    if _SPAM_REGEX.search(post.title):
        return True

    if post.body_text and _SPAM_REGEX.search(post.body_text):
        return True

    return False


def is_too_short(post: DiscussionPost) -> bool:
    """Check if title is too short to be meaningful."""
    return len(post.title.strip()) < MIN_TITLE_LENGTH


def filter_posts(posts: list[DiscussionPost]) -> list[DiscussionPost]:
    """Apply multi-layer filtering to discussion posts.

    Filters applied:
    1. Length filter: Remove titles < 5 chars
    2. Spam pattern filter: Remove phone numbers, URLs, spam keywords
    3. Duplicate filter: Keep only 1 of identical titles
    4. Author frequency filter: Cap at MAX_POSTS_PER_AUTHOR per author

    Args:
        posts: Raw list of discussion posts

    Returns:
        Filtered list of posts (targeting 40-60% noise removal)
    """
    original_count = len(posts)

    # Step 1: Length filter
    filtered = [p for p in posts if not is_too_short(p)]

    # Step 2: Spam pattern filter
    filtered = [p for p in filtered if not is_spam(p)]

    # Step 3: Duplicate title filter (keep first occurrence)
    seen_titles: set[str] = set()
    deduped: list[DiscussionPost] = []
    for post in filtered:
        normalized = post.title.strip().lower()
        if normalized not in seen_titles:
            seen_titles.add(normalized)
            deduped.append(post)
    filtered = deduped

    # Step 4: Author frequency filter
    author_counts: Counter[str] = Counter()
    author_filtered: list[DiscussionPost] = []
    for post in filtered:
        if not post.author:
            author_filtered.append(post)
            continue
        author_counts[post.author] += 1
        if author_counts[post.author] <= MAX_POSTS_PER_AUTHOR:
            author_filtered.append(post)
    filtered = author_filtered

    filtered_count = len(filtered)
    removal_rate = (1 - filtered_count / original_count) * 100 if original_count > 0 else 0
    print(f"    Filter: {original_count} → {filtered_count} posts ({removal_rate:.0f}% removed)")

    return filtered
