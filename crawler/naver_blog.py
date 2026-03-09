"""Naver Blog RSS parser and post crawler."""
from __future__ import annotations

import re
import time
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import datetime
from html import unescape
from typing import Optional

import requests

NAVER_RSS_URL = "https://rss.blog.naver.com/{blog_id}.xml"
NAVER_SEARCH_API = "https://openapi.naver.com/v1/search/blog.json"
NAVER_BLOG_POST_URL = "https://blog.naver.com/{blog_id}/{log_no}"

# Rate limiting: 1 request per 2 seconds
MIN_REQUEST_INTERVAL = 2.0
_last_request_time = 0.0

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)


@dataclass
class BlogPost:
    """A single blog post parsed from RSS or API."""
    blog_id: str
    title: str
    link: str
    description: str
    content_text: str
    published_at: Optional[str]
    log_no: Optional[str]


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


def _extract_log_no(link: str) -> Optional[str]:
    """Extract log number from Naver blog URL."""
    match = re.search(r"/(\d{10,})", link)
    if match:
        return match.group(1)
    match = re.search(r"logNo=(\d+)", link)
    if match:
        return match.group(1)
    return None


def _parse_rss_date(date_str: str) -> Optional[str]:
    """Parse RSS date formats to ISO 8601."""
    formats = [
        "%a, %d %b %Y %H:%M:%S %z",
        "%a, %d %b %Y %H:%M:%S %Z",
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%d %H:%M:%S",
    ]
    for fmt in formats:
        try:
            dt = datetime.strptime(date_str.strip(), fmt)
            return dt.strftime("%Y-%m-%dT%H:%M:%SZ")
        except ValueError:
            continue
    return None


def fetch_blog_profile_image(blog_id: str) -> Optional[str]:
    """Extract blog profile image URL from RSS feed.

    The RSS <channel><image><url> contains the blogger's profile image.
    URL is converted to HTTPS and resized to 204x204.
    """
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

    image_url_el = channel.find("image/url")
    if image_url_el is not None and image_url_el.text:
        img_url = image_url_el.text.replace(
            "http://blogpfthumb.phinf.naver.net",
            "https://blogpfthumb-phinf.pstatic.net",
        )
        # Replace size param for 204x204 avatar crop
        if "?type=" in img_url:
            img_url = re.sub(r"\?type=\w+", "?type=f204_204", img_url)
        else:
            img_url += "?type=f204_204"
        return img_url

    return None


def fetch_rss_posts(blog_id: str, max_posts: int = 20) -> list[BlogPost]:
    """Fetch recent posts from a Naver blog RSS feed.

    Args:
        blog_id: Naver blog ID
        max_posts: Maximum number of posts to return

    Returns:
        List of BlogPost objects
    """
    url = NAVER_RSS_URL.format(blog_id=blog_id)
    _rate_limit()

    try:
        resp = requests.get(
            url,
            headers={"User-Agent": USER_AGENT},
            timeout=15,
        )
        resp.raise_for_status()
    except requests.RequestException as e:
        print(f"  RSS fetch failed for {blog_id}: {e}")
        return []

    try:
        root = ET.fromstring(resp.content)
    except ET.ParseError as e:
        print(f"  RSS parse failed for {blog_id}: {e}")
        return []

    posts: list[BlogPost] = []
    channel = root.find("channel")
    if channel is None:
        return posts

    for item in channel.findall("item")[:max_posts]:
        title = _clean_html(item.findtext("title", ""))
        link = item.findtext("link", "")
        description = _clean_html(item.findtext("description", ""))
        pub_date = item.findtext("pubDate", "")

        log_no = _extract_log_no(link)
        published_at = _parse_rss_date(pub_date) if pub_date else None

        posts.append(BlogPost(
            blog_id=blog_id,
            title=title,
            link=link,
            description=description,
            content_text=description,  # RSS provides summary; full text via crawling
            published_at=published_at,
            log_no=log_no,
        ))

    return posts


def fetch_blog_post_content(blog_id: str, log_no: str) -> Optional[str]:
    """Fetch full text content of a blog post via mobile page.

    Naver blog mobile pages are simpler to parse than desktop.

    Args:
        blog_id: Naver blog ID
        log_no: Post log number

    Returns:
        Full text content or None
    """
    url = f"https://m.blog.naver.com/{blog_id}/{log_no}"
    _rate_limit()

    try:
        resp = requests.get(
            url,
            headers={"User-Agent": USER_AGENT},
            timeout=15,
        )
        resp.raise_for_status()
        html = resp.text
    except requests.RequestException as e:
        print(f"  Post fetch failed for {blog_id}/{log_no}: {e}")
        return None

    # Extract main content from mobile blog page
    # Try multiple selectors for different blog skins
    patterns = [
        r'<div class="se-main-container">(.*?)</div>\s*</div>\s*</div>',
        r'<div id="postViewArea">(.*?)</div>',
        r'<div class="post_ct">(.*?)</div>',
        r'<div class="se_component_wrap">(.*?)</div>',
    ]

    for pattern in patterns:
        match = re.search(pattern, html, re.DOTALL)
        if match:
            content = _clean_html(match.group(1))
            if len(content) > 50:
                return content[:10000]  # Limit to 10K chars

    # Fallback: extract text between post area markers
    post_match = re.search(
        r'class="se-main-container"[^>]*>(.*?)<div class="post_footer"',
        html,
        re.DOTALL,
    )
    if post_match:
        content = _clean_html(post_match.group(1))
        if len(content) > 50:
            return content[:10000]

    return None


def search_blog_posts(
    query: str,
    client_id: str,
    client_secret: str,
    display: int = 10,
    sort: str = "date",
) -> list[dict]:
    """Search Naver blogs via API.

    Args:
        query: Search keyword
        client_id: Naver API client ID
        client_secret: Naver API client secret
        display: Number of results (max 100)
        sort: Sort order - 'sim' (relevance) or 'date' (date)

    Returns:
        List of search result dicts
    """
    _rate_limit()

    try:
        resp = requests.get(
            NAVER_SEARCH_API,
            params={"query": query, "display": display, "sort": sort},
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
        print(f"  Blog search failed for '{query}': {e}")
        return []

    results = []
    for item in data.get("items", []):
        results.append({
            "title": _clean_html(item.get("title", "")),
            "link": item.get("link", ""),
            "description": _clean_html(item.get("description", "")),
            "bloggername": item.get("bloggername", ""),
            "bloggerlink": item.get("bloggerlink", ""),
            "postdate": item.get("postdate", ""),
        })

    return results
