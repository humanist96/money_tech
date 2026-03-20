"""MoneyTech Discussion Board Crawler - Collects crowd sentiment from Naver."""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone, timedelta

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

from asset_dictionary import STOCK_DICT
from db import get_conn, close_pool
from logger import logger
from naver_discussion import fetch_multiple_pages
from discussion_filter import filter_posts
from crowd_sentiment_analyzer import compute_crowd_sentiment

load_dotenv()

# Top 20 stocks by market cap -> crawl every 6 hours
TOP_STOCKS = [
    ("삼성전자", "005930"), ("SK하이닉스", "000660"), ("LG에너지솔루션", "373220"),
    ("삼성바이오로직스", "207940"), ("현대차", "005380"), ("기아", "000270"),
    ("셀트리온", "068270"), ("KB금융", "105560"), ("신한지주", "055550"),
    ("POSCO홀딩스", "005490"), ("NAVER", "035420"), ("카카오", "035720"),
    ("삼성SDI", "006400"), ("LG화학", "051910"), ("현대모비스", "012330"),
    ("삼성물산", "028260"), ("한화에어로스페이스", "012450"), ("SK텔레콤", "017670"),
    ("KT", "030200"), ("한국전력", "015760"),
]

# Remaining stocks from STOCK_DICT (Korean stocks only) -> crawl every 24 hours
def get_secondary_stocks() -> list[tuple[str, str]]:
    """Get non-top stocks for secondary crawling."""
    top_codes = {code for _, code in TOP_STOCKS}
    secondary = []
    seen_codes: set[str] = set()
    for name, code in STOCK_DICT.items():
        # Only Korean stocks (numeric codes)
        if code.isdigit() and code not in top_codes and code not in seen_codes:
            seen_codes.add(code)
            secondary.append((name, code))
    return secondary[:30]  # Cap at 30 additional stocks


def should_crawl(cur, stock_code: str, hours: int = 6) -> bool:
    """Check if we should crawl this stock (based on last crawl time)."""
    cur.execute(
        """SELECT crawled_at FROM crowd_crawl_log
        WHERE stock_code = %s AND status = 'success'
        ORDER BY crawled_at DESC LIMIT 1""",
        (stock_code,),
    )
    row = cur.fetchone()
    if not row:
        return True

    last_crawl = row[0]
    if last_crawl.tzinfo is None:
        last_crawl = last_crawl.replace(tzinfo=timezone.utc)
    threshold = datetime.now(timezone.utc) - timedelta(hours=hours)
    return last_crawl < threshold


def upsert_crowd_sentiment(cur, data: dict, period_start: datetime, period_end: datetime) -> None:
    """Insert or update crowd sentiment data."""
    cur.execute(
        """INSERT INTO crowd_sentiment
        (stock_code, stock_name, period_start, period_end,
         total_posts, filtered_posts, positive_count, negative_count, neutral_count,
         bullish_ratio, sentiment_score, top_keywords, sample_posts)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (stock_code, period_start) DO UPDATE SET
            stock_name = EXCLUDED.stock_name,
            period_end = EXCLUDED.period_end,
            total_posts = EXCLUDED.total_posts,
            filtered_posts = EXCLUDED.filtered_posts,
            positive_count = EXCLUDED.positive_count,
            negative_count = EXCLUDED.negative_count,
            neutral_count = EXCLUDED.neutral_count,
            bullish_ratio = EXCLUDED.bullish_ratio,
            sentiment_score = EXCLUDED.sentiment_score,
            top_keywords = EXCLUDED.top_keywords,
            sample_posts = EXCLUDED.sample_posts""",
        (
            data["stock_code"],
            data["stock_name"],
            period_start,
            period_end,
            data["total_posts"],
            data["filtered_posts"],
            data["positive_count"],
            data["negative_count"],
            data["neutral_count"],
            data["bullish_ratio"],
            data["sentiment_score"],
            json.dumps(data["top_keywords"], ensure_ascii=False),
            json.dumps(data["sample_posts"], ensure_ascii=False),
        ),
    )


def log_crawl(cur, stock_code: str, pages: int, found: int, filtered: int, status: str = "success") -> None:
    """Log crawl activity."""
    cur.execute(
        """INSERT INTO crowd_crawl_log
        (stock_code, pages_crawled, posts_found, posts_filtered, status)
        VALUES (%s, %s, %s, %s, %s)""",
        (stock_code, pages, found, filtered, status),
    )


def crawl_stock_discussion(cur, conn, stock_name: str, stock_code: str, max_pages: int = 3) -> bool:
    """Crawl discussion board for a single stock.

    Args:
        cur: Database cursor
        conn: Database connection
        stock_name: Stock name
        stock_code: Stock code
        max_pages: Pages to crawl

    Returns:
        True if successful
    """
    try:
        logger.info("Crawling %s (%s)...", stock_name, stock_code)

        # Fetch posts
        raw_posts = fetch_multiple_pages(stock_code, max_pages)
        if not raw_posts:
            logger.info("No posts found")
            log_crawl(cur, stock_code, max_pages, 0, 0)
            conn.commit()
            return True

        # Filter noise
        filtered_posts = filter_posts(raw_posts)

        # Compute sentiment
        now = datetime.now(timezone.utc)
        period_start = now - timedelta(hours=6)
        sentiment_data = compute_crowd_sentiment(filtered_posts, stock_code, stock_name)
        sentiment_data["total_posts"] = len(raw_posts)

        # Store results
        upsert_crowd_sentiment(cur, sentiment_data, period_start, now)
        log_crawl(cur, stock_code, max_pages, len(raw_posts), len(filtered_posts))
        conn.commit()

        bullish_str = f"{sentiment_data['bullish_ratio']:.0%}" if sentiment_data["bullish_ratio"] is not None else "N/A"
        logger.info("%d raw -> %d filtered | Bullish: %s", len(raw_posts), len(filtered_posts), bullish_str)
        return True

    except Exception as e:
        logger.error("Error crawling %s: %s", stock_name, e, exc_info=True)
        conn.rollback()
        try:
            log_crawl(cur, stock_code, max_pages, 0, 0, "error")
            conn.commit()
        except Exception:
            conn.rollback()
        return False


def crawl_discussions(top_only: bool = False) -> None:
    """Main discussion crawling function.

    Args:
        top_only: If True, only crawl TOP_STOCKS (for frequent runs)
    """
    total_crawled = 0
    total_skipped = 0

    with get_conn() as conn:
        with conn.cursor() as cur:
            # Top stocks (6-hour interval)
            logger.info("=== Top Stocks Discussion (%d stocks) ===", len(TOP_STOCKS))
            for stock_name, stock_code in TOP_STOCKS:
                if not should_crawl(cur, stock_code, hours=6):
                    total_skipped += 1
                    continue
                if crawl_stock_discussion(cur, conn, stock_name, stock_code):
                    total_crawled += 1

            # Secondary stocks (24-hour interval)
            if not top_only:
                secondary = get_secondary_stocks()
                logger.info("=== Secondary Stocks Discussion (%d stocks) ===", len(secondary))
                for stock_name, stock_code in secondary:
                    if not should_crawl(cur, stock_code, hours=24):
                        total_skipped += 1
                        continue
                    if crawl_stock_discussion(cur, conn, stock_name, stock_code, max_pages=2):
                        total_crawled += 1

    close_pool()

    logger.info("=== Discussion Crawl complete ===")
    logger.info("Crawled: %d", total_crawled)
    logger.info("Skipped (recent): %d", total_skipped)


if __name__ == "__main__":
    crawl_discussions()
