"""DART Open API client for disclosure evidence.

Only filing titles and types are used — enough to name the cause, and it avoids
downloading full documents for a dozen stocks a day. The ticker-to-corp_code
map is cached weekly because DART only ships it as a zipped XML of ~100k rows.
"""
from __future__ import annotations

import io
import os
import xml.etree.ElementTree as ET
import zipfile
from datetime import date, timedelta

import requests

from logger import logger

DART_LIST_URL = "https://opendart.fss.or.kr/api/list.json"
DART_CORP_CODE_URL = "https://opendart.fss.or.kr/api/corpCode.xml"

CORP_MAP_TTL_DAYS = 7
LOOKBACK_DAYS = 3

# Filing types that plausibly move a price. Everything else (routine reports,
# minor amendments) is noise for a daily explanation.
PRICE_RELEVANT_KEYWORDS = (
    "실적", "영업(잠정)", "공급계약", "단일판매", "유상증자", "무상증자",
    "전환사채", "신주인수권", "최대주주", "자기주식", "감자", "소송",
    "합병", "분할", "상장폐지", "관리종목", "배당",
)


def _api_key() -> str | None:
    return os.environ.get("DART_API_KEY")


def refresh_corp_map(conn) -> int:
    """Reload the ticker -> corp_code map if the cache is stale."""
    key = _api_key()
    if not key:
        logger.warning("DART_API_KEY not set — disclosure evidence disabled")
        return 0

    with conn.cursor() as cur:
        cur.execute("SELECT MAX(updated_at) FROM dart_corp_map")
        row = cur.fetchone()
        if row and row[0] and (date.today() - row[0].date()).days < CORP_MAP_TTL_DAYS:
            return 0

    try:
        resp = requests.get(DART_CORP_CODE_URL, params={"crtfc_key": key}, timeout=60)
        resp.raise_for_status()
        with zipfile.ZipFile(io.BytesIO(resp.content)) as zf:
            xml_bytes = zf.read(zf.namelist()[0])
    except Exception as e:
        logger.error("DART corp code download failed: %s", e)
        return 0

    rows = []
    for item in ET.fromstring(xml_bytes).iter("list"):
        stock_code = (item.findtext("stock_code") or "").strip()
        corp_code = (item.findtext("corp_code") or "").strip()
        if stock_code and corp_code:
            rows.append((stock_code, corp_code, (item.findtext("corp_name") or "").strip()))

    if not rows:
        return 0

    with conn.cursor() as cur:
        cur.executemany(
            """INSERT INTO dart_corp_map (stock_code, corp_code, corp_name, updated_at)
               VALUES (%s, %s, %s, NOW())
               ON CONFLICT (stock_code) DO UPDATE
               SET corp_code = EXCLUDED.corp_code,
                   corp_name = EXCLUDED.corp_name,
                   updated_at = NOW()""",
            rows,
        )
    conn.commit()
    logger.info("DART corp map refreshed: %d ticker(s)", len(rows))
    return len(rows)


def get_corp_code(cur, stock_code: str) -> str | None:
    cur.execute("SELECT corp_code FROM dart_corp_map WHERE stock_code = %s", (stock_code,))
    row = cur.fetchone()
    return row[0] if row else None


def fetch_disclosures(cur, stock_code: str, trade_date: date) -> list[dict]:
    """Price-relevant filings published shortly before the session."""
    key = _api_key()
    if not key:
        return []

    corp_code = get_corp_code(cur, stock_code)
    if not corp_code:
        return []

    begin = (trade_date - timedelta(days=LOOKBACK_DAYS)).strftime("%Y%m%d")
    end = trade_date.strftime("%Y%m%d")

    try:
        resp = requests.get(
            DART_LIST_URL,
            params={
                "crtfc_key": key,
                "corp_code": corp_code,
                "bgn_de": begin,
                "end_de": end,
                "page_count": 30,
            },
            timeout=20,
        )
        resp.raise_for_status()
        payload = resp.json()
    except Exception as e:
        logger.warning("DART list fetch failed for %s: %s", stock_code, e)
        return []

    if payload.get("status") != "000":
        # 013 = no matching filings, which is a normal outcome.
        if payload.get("status") != "013":
            logger.warning("DART returned %s for %s: %s",
                           payload.get("status"), stock_code, payload.get("message"))
        return []

    out = []
    for item in payload.get("list", []):
        title = (item.get("report_nm") or "").strip()
        if not any(k in title for k in PRICE_RELEVANT_KEYWORDS):
            continue
        rcept_no = item.get("rcept_no", "")
        out.append({
            "title": title,
            "date": item.get("rcept_dt", ""),
            "url": f"https://dart.fss.or.kr/dsaf001/main.do?rcpNo={rcept_no}",
        })
    return out[:5]
