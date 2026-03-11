"""Naver Blog discovery - search and validate new bloggers."""
from __future__ import annotations

import math
import os
import re
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
from typing import Any

import requests

NAVER_SEARCH_API = "https://openapi.naver.com/v1/search/blog.json"
NAVER_RSS_URL = "https://rss.blog.naver.com/{blog_id}.xml"

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

MIN_REQUEST_INTERVAL = 1.5
_last_request_time = 0.0


def _rate_limit() -> None:
    global _last_request_time
    elapsed = time.time() - _last_request_time
    if elapsed < MIN_REQUEST_INTERVAL:
        time.sleep(MIN_REQUEST_INTERVAL - elapsed)
    _last_request_time = time.time()


def _clean_html(html_text: str) -> str:
    from html import unescape
    text = unescape(html_text)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


SEARCH_KEYWORDS: dict[str, list[str]] = {
    "stock": [
        "주식 종목분석 블로그", "주식 리포트", "주식 차트분석",
        "가치투자 분석", "배당투자 종목", "미국주식 분석",
        "ETF 투자 분석", "퀀트투자 전략",
        "코스피 전망", "나스닥 분석", "주식 매매일지",
    ],
    "coin": [
        "비트코인 분석", "이더리움 전망", "알트코인 분석",
        "코인 시황", "크립토 투자", "가상화폐 전망",
        "디파이 투자", "코인 차트분석", "블록체인 투자",
    ],
    "real_estate": [
        "아파트 투자 분석", "아파트 시세 전망", "아파트 갭투자",
        "재건축 투자 분석", "재개발 사업 분석", "정비사업 현황",
        "상가 투자 수익률", "오피스텔 투자", "수익형 부동산",
        "토지 투자 분석", "임야 투자", "농지 투자",
        "부동산 경매 분석", "법원경매 낙찰", "공매 투자",
        "부동산 분양 분석", "청약 당첨", "분양권 투자",
        "부동산 세금 절세", "양도소득세", "종합부동산세",
        "서울 부동산 전망", "수도권 부동산", "GTX 호재",
        "전세 분석", "역전세 위험", "부동산 대출 금리",
    ],
    "economy": [
        "경제 전망 분석", "금리 인상 영향", "환율 전망",
        "인플레이션 분석", "재테크 전략", "자산관리",
        "절세 방법", "세테크 전략", "연금 투자",
        "경제 뉴스 해설", "거시경제 분석",
    ],
}

AD_INDICATORS = {"광고", "협찬", "체험단", "원고료", "제공받", "소정의", "sponsored"}


def _extract_blog_id(link: str) -> str | None:
    """Extract blog_id from Naver blog URL."""
    # blog.naver.com/{blog_id}/{post_no}
    match = re.search(r"blog\.naver\.com/([^/?#]+)", link)
    if match:
        blog_id = match.group(1)
        if blog_id not in ("PostView.naver", "PostList.naver"):
            return blog_id
    return None


def search_blogs(
    keyword: str,
    client_id: str,
    client_secret: str,
    display: int = 20,
) -> list[dict]:
    """Search Naver blogs and extract unique blog IDs."""
    _rate_limit()

    try:
        resp = requests.get(
            NAVER_SEARCH_API,
            params={"query": keyword, "display": display, "sort": "sim"},
            headers={
                "X-Naver-Client-Id": client_id,
                "X-Naver-Client-Secret": client_secret,
                "User-Agent": USER_AGENT,
            },
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
    except (requests.RequestException, ValueError) as e:
        print(f"  Blog search failed for '{keyword}': {e}")
        return []

    results = []
    seen_blogs = set()

    for item in data.get("items", []):
        blogger_link = item.get("bloggerlink", "")
        blog_id = _extract_blog_id(blogger_link)

        if not blog_id or blog_id in seen_blogs:
            continue
        seen_blogs.add(blog_id)

        results.append({
            "blog_id": blog_id,
            "name": item.get("bloggername", ""),
            "link": blogger_link,
            "post_title": _clean_html(item.get("title", "")),
            "post_date": item.get("postdate", ""),
        })

    return results


def get_blog_rss_info(blog_id: str) -> dict | None:
    """Get blog info and recent posts from RSS feed."""
    url = NAVER_RSS_URL.format(blog_id=blog_id)
    _rate_limit()

    try:
        resp = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=15)
        resp.raise_for_status()
        root = ET.fromstring(resp.content)
    except (requests.RequestException, ET.ParseError):
        return None

    channel = root.find("channel")
    if channel is None:
        return None

    # Blog title
    title = channel.findtext("title", "")

    # Posts
    posts = []
    for item in channel.findall("item")[:15]:
        pub_date = item.findtext("pubDate", "")
        posts.append({
            "title": _clean_html(item.findtext("title", "")),
            "pub_date": pub_date,
            "description": _clean_html(item.findtext("description", ""))[:200],
        })

    return {
        "blog_id": blog_id,
        "title": title,
        "post_count": len(posts),
        "posts": posts,
    }


def _parse_date(date_str: str) -> datetime | None:
    """Parse various date formats."""
    formats = [
        "%a, %d %b %Y %H:%M:%S %z",
        "%a, %d %b %Y %H:%M:%S %Z",
        "%Y%m%d",
        "%Y-%m-%dT%H:%M:%S%z",
    ]
    for fmt in formats:
        try:
            return datetime.strptime(date_str.strip(), fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return None


def calculate_blog_score(
    rss_info: dict,
    category: str,
) -> dict:
    """Calculate quality score for a blog candidate."""
    now = datetime.now(timezone.utc)
    cutoff_30d = now - timedelta(days=30)
    posts = rss_info.get("posts", [])

    # Activity: posts in last 30 days
    recent_count = 0
    for p in posts:
        pub = p.get("pub_date", "")
        if pub:
            dt = _parse_date(pub)
            if dt and dt >= cutoff_30d:
                recent_count += 1

    activity_score = min(recent_count / 4, 1.0) * 100

    # Scale: recent post frequency (need consistent posting, not just RSS fullness)
    # 10+ posts in RSS with recent activity gets high score
    total_posts = rss_info.get("post_count", 0)
    if recent_count >= 8:
        scale_score = 100
    elif recent_count >= 4:
        scale_score = 70
    elif total_posts >= 10 and recent_count >= 2:
        scale_score = 50
    else:
        scale_score = 20

    # Relevance: keyword matching in post titles
    category_keywords = _get_category_keywords(category)
    if posts:
        matching = sum(
            1 for p in posts
            if any(kw in p.get("title", "") or kw in p.get("description", "")
                   for kw in category_keywords)
        )
        relevance_score = (matching / len(posts)) * 100
    else:
        relevance_score = 0

    # Consistency
    consistency_score = relevance_score if len(posts) >= 5 else 50

    # Ad ratio
    ad_count = sum(
        1 for p in posts
        if any(ad in p.get("title", "") or ad in p.get("description", "")
               for ad in AD_INDICATORS)
    )
    ad_ratio = ad_count / max(len(posts), 1)

    total = (
        activity_score * 0.30
        + scale_score * 0.25
        + relevance_score * 0.25
        + consistency_score * 0.20
    )

    if ad_ratio > 0.3:
        total *= 0.5

    # Hard penalty: if less than 30% relevance, unlikely a specialist
    if relevance_score < 30:
        total *= 0.6

    return {
        "total": round(total, 1),
        "activity": round(activity_score, 1),
        "scale": round(scale_score, 1),
        "relevance": round(relevance_score, 1),
        "consistency": round(consistency_score, 1),
        "ad_ratio": round(ad_ratio, 2),
        "recent_30d_count": recent_count,
    }


def _get_category_keywords(category: str) -> list[str]:
    mapping = {
        "stock": ["주식", "종목", "배당", "투자", "코스피", "코스닥", "나스닥", "ETF", "매매", "차트", "증시", "리포트"],
        "coin": ["비트코인", "이더리움", "코인", "크립토", "가상화폐", "블록체인", "알트", "디파이"],
        "real_estate": ["부동산", "아파트", "재건축", "재개발", "전세", "월세", "분양", "청약", "경매", "토지", "상가", "오피스텔", "임대", "갭투자"],
        "economy": ["경제", "금리", "환율", "인플레", "재테크", "자산", "세금", "절세", "연금"],
    }
    return mapping.get(category, [])


def discover_blog_channels(
    existing_ids: set[str],
    categories: list[str] | None = None,
    max_per_keyword: int = 10,
) -> list[dict]:
    """Discover new Naver blog channels across all categories.

    Returns list of candidate dicts sorted by quality score.
    """
    client_id = os.environ.get("NAVER_CLIENT_ID", "")
    client_secret = os.environ.get("NAVER_CLIENT_SECRET", "")

    if not client_id or not client_secret:
        print("Warning: NAVER_CLIENT_ID/SECRET not set, skipping blog discovery")
        return []

    if categories is None:
        categories = list(SEARCH_KEYWORDS.keys())

    candidates: dict[str, dict] = {}

    for category in categories:
        keywords = SEARCH_KEYWORDS.get(category, [])
        print(f"\n=== Blog Discovery: {category} ({len(keywords)} keywords) ===")

        for keyword in keywords:
            print(f"  Searching: {keyword}")
            blogs = search_blogs(keyword, client_id, client_secret, display=max_per_keyword)

            for blog in blogs:
                bid = blog["blog_id"]

                if bid in existing_ids or bid in candidates:
                    continue

                # Get RSS info
                rss_info = get_blog_rss_info(bid)
                if not rss_info or rss_info["post_count"] == 0:
                    continue

                # Calculate score
                score = calculate_blog_score(rss_info, category)

                # Skip if no recent activity
                if score["recent_30d_count"] == 0:
                    continue

                candidates[bid] = {
                    "blog_id": bid,
                    "name": blog.get("name") or rss_info.get("title", bid),
                    "category": category,
                    "score": score,
                    "recent_titles": [
                        p.get("title", "") for p in rss_info.get("posts", [])[:5]
                    ],
                }

                print(f"    Candidate: {candidates[bid]['name']} "
                      f"(score={score['total']}, "
                      f"recent={score['recent_30d_count']})")

    result = sorted(candidates.values(), key=lambda x: x["score"]["total"], reverse=True)
    return result
