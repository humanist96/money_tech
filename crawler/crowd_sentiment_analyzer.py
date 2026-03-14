"""Crowd sentiment analyzer for Naver stock discussion board posts."""
from __future__ import annotations

from collections import Counter
from typing import Optional

from naver_discussion import DiscussionPost

# Crowd-specific positive keywords (informal Korean stock slang)
CROWD_POSITIVE = [
    "존버", "가즈아", "떡상", "매집", "바닥", "간다", "물타기",
    "반등", "올라간다", "상한가", "폭등", "급등", "돌파",
    "사자", "매수", "담아", "저점", "줍줍", "풀매수",
    "호재", "좋다", "대박", "화이팅", "기대",
]

# Crowd-specific negative keywords
CROWD_NEGATIVE = [
    "떡락", "폭락", "손절", "물렸다", "반토막", "망했다",
    "하한가", "급락", "빠진다", "내려간다", "팔자",
    "매도", "도망", "탈출", "위험", "버블", "거품",
    "악재", "망해라", "쓰레기", "사기", "폭망",
    "개미털기", "물타지마", "손실",
]


def analyze_post_sentiment(post: DiscussionPost) -> str:
    """Analyze sentiment of a single discussion post title.

    Args:
        post: Discussion post to analyze

    Returns:
        'positive', 'negative', or 'neutral'
    """
    text = post.title.lower()

    pos_score = sum(1 for kw in CROWD_POSITIVE if kw in text)
    neg_score = sum(1 for kw in CROWD_NEGATIVE if kw in text)

    if pos_score > neg_score and pos_score >= 1:
        return "positive"
    elif neg_score > pos_score and neg_score >= 1:
        return "negative"
    return "neutral"


def extract_keywords(posts: list[DiscussionPost], top_n: int = 10) -> list[dict]:
    """Extract top keywords from discussion posts.

    Args:
        posts: List of discussion posts
        top_n: Number of top keywords to return

    Returns:
        List of dicts with 'keyword' and 'count'
    """
    all_keywords = CROWD_POSITIVE + CROWD_NEGATIVE
    counter: Counter[str] = Counter()

    for post in posts:
        text = post.title.lower()
        for kw in all_keywords:
            if kw in text:
                counter[kw] += 1

    return [{"keyword": kw, "count": count} for kw, count in counter.most_common(top_n)]


def compute_crowd_sentiment(
    posts: list[DiscussionPost],
    stock_code: str,
    stock_name: str,
) -> dict:
    """Compute aggregated crowd sentiment from filtered posts.

    Applies view-count weighting: high-view posts have more influence.

    Args:
        posts: Filtered discussion posts
        stock_code: Stock code
        stock_name: Stock name

    Returns:
        Dict ready for crowd_sentiment table insertion
    """
    if not posts:
        return {
            "stock_code": stock_code,
            "stock_name": stock_name,
            "total_posts": 0,
            "filtered_posts": 0,
            "positive_count": 0,
            "negative_count": 0,
            "neutral_count": 0,
            "bullish_ratio": None,
            "sentiment_score": None,
            "top_keywords": [],
            "sample_posts": [],
        }

    positive_count = 0
    negative_count = 0
    neutral_count = 0

    weighted_pos = 0.0
    weighted_neg = 0.0
    total_weight = 0.0

    for post in posts:
        sentiment = analyze_post_sentiment(post)
        weight = max(1.0, (post.view_count or 0) ** 0.5)  # Square root weighting
        total_weight += weight

        if sentiment == "positive":
            positive_count += 1
            weighted_pos += weight
        elif sentiment == "negative":
            negative_count += 1
            weighted_neg += weight
        else:
            neutral_count += 1

    # Compute bullish ratio (positive / (positive + negative))
    opinion_count = positive_count + negative_count
    bullish_ratio = positive_count / opinion_count if opinion_count > 0 else None

    # Sentiment score: weighted, -1 (very bearish) to +1 (very bullish)
    sentiment_score = None
    if total_weight > 0:
        sentiment_score = (weighted_pos - weighted_neg) / total_weight

    # Top keywords
    top_keywords = extract_keywords(posts)

    # Sample posts (top 5 by view count, for display)
    sorted_posts = sorted(posts, key=lambda p: p.view_count or 0, reverse=True)
    sample_posts = [
        {
            "title": p.title[:100],
            "views": p.view_count,
            "sentiment": analyze_post_sentiment(p),
        }
        for p in sorted_posts[:5]
    ]

    return {
        "stock_code": stock_code,
        "stock_name": stock_name,
        "total_posts": len(posts),
        "filtered_posts": len(posts),
        "positive_count": positive_count,
        "negative_count": negative_count,
        "neutral_count": neutral_count,
        "bullish_ratio": round(bullish_ratio, 3) if bullish_ratio is not None else None,
        "sentiment_score": round(sentiment_score, 3) if sentiment_score is not None else None,
        "top_keywords": top_keywords,
        "sample_posts": sample_posts,
    }
