"""YouTube channel discovery - search and validate new channels."""
from __future__ import annotations

import json
import math
import os
import re
import urllib.request
from datetime import datetime, timezone, timedelta
from typing import Any

API_BASE = "https://www.googleapis.com/youtube/v3"


def _get_api_key() -> str:
    return os.environ.get("YOUTUBE_API_KEY", "")


def _api_get(endpoint: str, params: dict) -> dict | None:
    api_key = _get_api_key()
    if not api_key:
        return None
    params["key"] = api_key
    query = "&".join(f"{k}={urllib.request.quote(str(v))}" for k, v in params.items())
    url = f"{API_BASE}/{endpoint}?{query}"
    try:
        req = urllib.request.Request(url, headers={"Accept": "application/json"})
        resp = urllib.request.urlopen(req, timeout=15)
        return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"  YouTube API error: {e}")
        return None


SEARCH_KEYWORDS: dict[str, list[str]] = {
    "stock": [
        "주식 종목분석", "주식 리포트", "주식 차트분석",
        "가치투자 분석", "배당투자", "성장주 분석",
        "미국주식 분석", "해외주식 전망", "나스닥 분석",
        "코스피 전망", "코스닥 종목", "한국주식 분석",
        "ETF 추천", "퀀트투자", "주식 포트폴리오",
        "주식 매매일지", "주식 입문 강의",
    ],
    "coin": [
        "비트코인 분석", "이더리움 전망", "알트코인 분석",
        "크립토 시황", "코인 차트분석", "디파이 투자",
        "가상화폐 전망", "코인 매매", "블록체인 투자",
        "코인 시황 분석", "웹3 투자",
    ],
    "real_estate": [
        "아파트 투자 분석", "아파트 시세 전망",
        "재건축 투자", "재개발 투자", "정비사업 분석",
        "상가 투자", "오피스텔 투자", "수익형 부동산",
        "토지 투자", "임야 투자", "농지 투자",
        "부동산 경매 분석", "법원경매 강의",
        "부동산 분양 정보", "청약 분석",
        "부동산 세금", "양도세 절세",
        "서울 부동산 전망", "수도권 부동산",
        "갭투자", "전세 분석", "부동산 대출",
    ],
    "economy": [
        "경제 전망 분석", "금리 전망", "환율 분석",
        "인플레이션 분석", "한국은행 금리",
        "재테크 전략", "자산관리 방법",
        "절세 방법", "세테크", "연금 투자",
        "경제 뉴스 해설", "시사경제 분석",
    ],
}

# Words that indicate ad/sponsored content
AD_INDICATORS = {"광고", "협찬", "체험단", "제공", "sponsored", "ad", "PPL"}


def search_channels(keyword: str, max_results: int = 10) -> list[dict]:
    """Search YouTube for channels matching a keyword."""
    data = _api_get("search", {
        "part": "snippet",
        "q": keyword,
        "type": "channel",
        "maxResults": max_results,
        "regionCode": "KR",
        "relevanceLanguage": "ko",
    })
    if not data or not data.get("items"):
        return []

    channels = []
    for item in data["items"]:
        snippet = item.get("snippet", {})
        channel_id = item.get("id", {}).get("channelId")
        if channel_id:
            channels.append({
                "channel_id": channel_id,
                "name": snippet.get("channelTitle", ""),
                "description": snippet.get("description", ""),
            })
    return channels


def get_channel_stats(channel_id: str) -> dict | None:
    """Get channel statistics."""
    data = _api_get("channels", {
        "part": "snippet,statistics,contentDetails",
        "id": channel_id,
    })
    if not data or not data.get("items"):
        return None

    item = data["items"][0]
    stats = item.get("statistics", {})
    snippet = item.get("snippet", {})

    return {
        "channel_id": channel_id,
        "name": snippet.get("title", ""),
        "description": (snippet.get("description") or "")[:500],
        "subscriber_count": int(stats.get("subscriberCount", 0)),
        "video_count": int(stats.get("videoCount", 0)),
        "view_count": int(stats.get("viewCount", 0)),
        "published_at": snippet.get("publishedAt", ""),
        "uploads_playlist": (
            item.get("contentDetails", {})
            .get("relatedPlaylists", {})
            .get("uploads")
        ),
    }


def get_recent_videos(uploads_playlist: str, max_items: int = 10) -> list[dict]:
    """Get recent videos from uploads playlist."""
    data = _api_get("playlistItems", {
        "part": "snippet",
        "playlistId": uploads_playlist,
        "maxResults": max_items,
    })
    if not data or not data.get("items"):
        return []

    videos = []
    for item in data["items"]:
        snippet = item.get("snippet", {})
        videos.append({
            "title": snippet.get("title", ""),
            "published_at": snippet.get("publishedAt", ""),
            "description": (snippet.get("description") or "")[:300],
        })
    return videos


def calculate_channel_score(
    stats: dict,
    recent_videos: list[dict],
    category: str,
) -> dict:
    """Calculate quality score for a channel candidate."""
    now = datetime.now(timezone.utc)
    cutoff_30d = now - timedelta(days=30)

    # Activity: videos in last 30 days
    recent_count = 0
    for v in recent_videos:
        pub = v.get("published_at", "")
        if pub:
            try:
                pub_dt = datetime.fromisoformat(pub.replace("Z", "+00:00"))
                if pub_dt >= cutoff_30d:
                    recent_count += 1
            except ValueError:
                pass

    activity_score = min(recent_count / 4, 1.0) * 100  # 4+ videos/month = 100

    # Scale: subscriber count (log scale)
    subs = stats.get("subscriber_count", 0)
    if subs >= 1000:
        scale_score = min(math.log10(subs) / 6, 1.0) * 100  # 1M subs = 100
    else:
        scale_score = 0

    # Relevance: keyword matching in titles
    category_keywords = _get_category_keywords(category)
    if recent_videos:
        matching = sum(
            1 for v in recent_videos
            if any(kw in v.get("title", "") for kw in category_keywords)
        )
        relevance_score = (matching / len(recent_videos)) * 100
    else:
        relevance_score = 0

    # Consistency: are recent videos mostly about the category?
    if len(recent_videos) >= 5:
        consistency_score = relevance_score  # same as relevance for simplicity
    else:
        consistency_score = 50  # neutral if not enough data

    # Ad ratio check
    ad_count = sum(
        1 for v in recent_videos
        if any(ad in v.get("title", "") for ad in AD_INDICATORS)
    )
    ad_ratio = ad_count / max(len(recent_videos), 1)

    total = (
        activity_score * 0.30
        + scale_score * 0.25
        + relevance_score * 0.25
        + consistency_score * 0.20
    )

    # Penalty for high ad ratio
    if ad_ratio > 0.3:
        total *= 0.5

    return {
        "total": round(total, 1),
        "activity": round(activity_score, 1),
        "scale": round(scale_score, 1),
        "relevance": round(relevance_score, 1),
        "consistency": round(consistency_score, 1),
        "ad_ratio": round(ad_ratio, 2),
        "recent_30d_count": recent_count,
        "subscriber_count": subs,
    }


def _get_category_keywords(category: str) -> list[str]:
    """Get matching keywords for a category."""
    mapping = {
        "stock": ["주식", "종목", "배당", "투자", "코스피", "코스닥", "나스닥", "ETF", "매매", "차트", "리포트", "증시"],
        "coin": ["비트코인", "이더리움", "코인", "크립토", "가상화폐", "블록체인", "알트", "디파이", "웹3"],
        "real_estate": ["부동산", "아파트", "재건축", "재개발", "전세", "월세", "분양", "청약", "경매", "토지", "상가", "오피스텔", "임대"],
        "economy": ["경제", "금리", "환율", "인플레", "재테크", "자산", "세금", "절세", "연금", "시황"],
    }
    return mapping.get(category, [])


def discover_youtube_channels(
    existing_ids: set[str],
    categories: list[str] | None = None,
    max_per_keyword: int = 5,
) -> list[dict]:
    """Discover new YouTube channels across all categories.

    Returns list of candidate dicts sorted by quality score.
    """
    if categories is None:
        categories = list(SEARCH_KEYWORDS.keys())

    candidates: dict[str, dict] = {}  # channel_id -> candidate

    for category in categories:
        keywords = SEARCH_KEYWORDS.get(category, [])
        print(f"\n=== YouTube Discovery: {category} ({len(keywords)} keywords) ===")

        for keyword in keywords:
            print(f"  Searching: {keyword}")
            channels = search_channels(keyword, max_results=max_per_keyword)

            for ch in channels:
                cid = ch["channel_id"]

                # Skip existing
                if cid in existing_ids:
                    continue
                # Skip already evaluated
                if cid in candidates:
                    continue

                # Get full stats
                stats = get_channel_stats(cid)
                if not stats:
                    continue

                # Minimum threshold: 1000 subscribers
                if stats.get("subscriber_count", 0) < 1000:
                    continue

                # Get recent videos
                uploads = stats.get("uploads_playlist")
                recent = get_recent_videos(uploads, max_items=10) if uploads else []

                # Calculate score
                score = calculate_channel_score(stats, recent, category)

                candidates[cid] = {
                    "channel_id": cid,
                    "name": stats.get("name", ch["name"]),
                    "category": category,
                    "subscriber_count": stats.get("subscriber_count", 0),
                    "video_count": stats.get("video_count", 0),
                    "score": score,
                    "recent_titles": [v.get("title", "") for v in recent[:5]],
                }

                print(f"    Candidate: {stats.get('name', '')} "
                      f"(subs={stats.get('subscriber_count', 0)}, "
                      f"score={score['total']})")

    # Sort by score descending
    result = sorted(candidates.values(), key=lambda x: x["score"]["total"], reverse=True)
    return result
