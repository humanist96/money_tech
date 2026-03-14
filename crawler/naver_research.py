"""Naver Finance Research (analyst reports) HTML scraper."""
from __future__ import annotations

import re
import time
from dataclasses import dataclass
from datetime import datetime
from html import unescape
from typing import Optional

import requests

# Correct URL: company_list.naver (not analyst_report_sub)
NAVER_RESEARCH_LIST_URL = "https://finance.naver.com/research/company_list.naver"
NAVER_RESEARCH_DETAIL_URL = "https://finance.naver.com/research/company_read.naver"

MIN_REQUEST_INTERVAL = 2.0
_last_request_time = 0.0

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)


@dataclass
class AnalystReport:
    """A single analyst report parsed from Naver Finance Research."""
    firm_name: str
    analyst_name: str
    title: str
    asset_name: str
    asset_code: str
    recommendation: Optional[str]
    target_price: Optional[float]
    previous_target: Optional[float]
    report_url: str
    published_at: Optional[str]


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


def _parse_price(price_str: str) -> Optional[float]:
    """Parse price string like '85,000' to float."""
    if not price_str:
        return None
    cleaned = re.sub(r"[^\d.]", "", price_str.replace(",", ""))
    if not cleaned:
        return None
    try:
        return float(cleaned)
    except ValueError:
        return None


def _fetch_report_detail(nid: str) -> tuple[Optional[str], Optional[float], Optional[str]]:
    """Fetch target price and recommendation from report detail page.

    Returns:
        (recommendation, target_price, analyst_name)
    """
    _rate_limit()

    try:
        resp = requests.get(
            NAVER_RESEARCH_DETAIL_URL,
            params={"nid": nid},
            headers={"User-Agent": USER_AGENT},
            timeout=15,
        )
        resp.raise_for_status()
        html = resp.text
    except requests.RequestException:
        return None, None, None

    recommendation = None
    target_price = None
    analyst_name = None

    # Extract from table cell: "목표가 193,000 | 투자의견 중립"
    # Require at least 3 digits to avoid matching stray numbers in HTML
    tp_match = re.search(r'목표가[^0-9]*([\d]{1,3}(?:,\d{3})+|[\d]{4,})', html)
    if tp_match:
        target_price = _parse_price(tp_match.group(1))

    rec_match = re.search(r'투자의견\s*([가-힣A-Za-z\s]+?)(?:\s*[<|,])', html)
    if rec_match:
        recommendation = rec_match.group(1).strip()

    # Fallback: extract from <em> tags (pattern: stock_name, recommendation)
    if not recommendation:
        em_tags = re.findall(r'<em[^>]*>([^<]+)</em>', html)
        if len(em_tags) >= 2:
            recommendation = em_tags[1].strip()

    # Try to find analyst name
    analyst_match = re.search(r'(?:애널리스트|작성자|연구원)\s*[:\s]*([가-힣]{2,4})', html)
    if analyst_match:
        analyst_name = analyst_match.group(1)

    return recommendation, target_price, analyst_name


def fetch_analyst_reports(page: int = 1) -> list[AnalystReport]:
    """Fetch analyst reports from Naver Finance Research list page.

    Parses the company_list.naver table, then fetches detail pages
    for target price and recommendation.

    Args:
        page: Page number (1-based)

    Returns:
        List of AnalystReport objects
    """
    _rate_limit()

    try:
        resp = requests.get(
            NAVER_RESEARCH_LIST_URL,
            params={"page": page},
            headers={"User-Agent": USER_AGENT},
            timeout=15,
        )
        resp.raise_for_status()
        html = resp.text
    except requests.RequestException as e:
        print(f"  Research page fetch failed (page {page}): {e}")
        return []

    reports: list[AnalystReport] = []

    # Find the main table
    table_match = re.search(
        r'<table[^>]*class="type_1"[^>]*>(.*?)</table>',
        html,
        re.DOTALL,
    )
    if not table_match:
        print(f"  No research table found on page {page}")
        return []

    table_html = table_match.group(1)
    rows = re.findall(r'<tr[^>]*>(.*?)</tr>', table_html, re.DOTALL)

    for row_html in rows:
        cells = re.findall(r'<td[^>]*>(.*?)</td>', row_html, re.DOTALL)
        if len(cells) < 5:
            continue

        # Cell 0: stock name + code
        stock_link = re.search(r'code=(\w+)"[^>]*title="([^"]*)"', cells[0])
        if not stock_link:
            stock_link = re.search(r'code=(\w+)"[^>]*>([^<]+)', cells[0])
        if not stock_link:
            continue

        stock_code = stock_link.group(1)
        asset_name = _clean_html(stock_link.group(2))

        # Cell 1: report title + link (nid)
        report_link = re.search(r'href="company_read\.naver\?nid=(\d+)[^"]*"[^>]*>([^<]+)', cells[1])
        if not report_link:
            continue

        nid = report_link.group(1)
        title = _clean_html(report_link.group(2))
        report_url = f"https://finance.naver.com/research/company_read.naver?nid={nid}"

        # Cell 2: firm name
        firm_name = _clean_html(cells[2])

        # Cell 3: PDF link (skip)

        # Cell 4: date
        date_str = _clean_html(cells[4])
        published_at = None
        if date_str:
            for fmt in ["%y.%m.%d", "%Y.%m.%d"]:
                try:
                    dt = datetime.strptime(date_str.strip(), fmt)
                    published_at = dt.strftime("%Y-%m-%dT00:00:00Z")
                    break
                except ValueError:
                    continue

        reports.append(AnalystReport(
            firm_name=firm_name,
            analyst_name="",
            title=title,
            asset_name=asset_name,
            asset_code=stock_code,
            recommendation=None,  # Will be filled from detail page
            target_price=None,
            previous_target=None,
            report_url=report_url,
            published_at=published_at,
        ))

    return reports


def enrich_reports_with_details(reports: list[AnalystReport], max_detail_fetches: int = 15) -> list[AnalystReport]:
    """Fetch detail pages to get target price and recommendation.

    Only fetches up to max_detail_fetches to respect rate limits.
    """
    for i, report in enumerate(reports[:max_detail_fetches]):
        nid_match = re.search(r'nid=(\d+)', report.report_url)
        if not nid_match:
            continue

        nid = nid_match.group(1)
        recommendation, target_price, analyst_name = _fetch_report_detail(nid)

        report.recommendation = recommendation
        report.target_price = target_price
        if analyst_name:
            report.analyst_name = analyst_name

        if recommendation or target_price:
            tp_str = f" 목표가={target_price:,.0f}" if target_price else ""
            print(f"    Detail: {report.asset_name} → {recommendation}{tp_str}")

    return reports


def fetch_multiple_pages(max_pages: int = 3) -> list[AnalystReport]:
    """Fetch analyst reports from multiple pages with detail enrichment.

    Args:
        max_pages: Maximum number of pages to fetch

    Returns:
        Combined list of AnalystReport objects (deduplicated by report_url)
    """
    all_reports: list[AnalystReport] = []
    seen_urls: set[str] = set()

    for page in range(1, max_pages + 1):
        reports = fetch_analyst_reports(page)
        print(f"  Page {page}: {len(reports)} reports")

        for report in reports:
            if report.report_url not in seen_urls:
                seen_urls.add(report.report_url)
                all_reports.append(report)

        if not reports:
            break

    # Enrich with detail pages (target price + recommendation)
    print(f"  Fetching details for up to {len(all_reports)} reports...")
    all_reports = enrich_reports_with_details(all_reports, max_detail_fetches=len(all_reports))

    return all_reports
