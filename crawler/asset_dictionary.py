"""Asset dictionary for Korean stock/coin/real estate name recognition."""
from __future__ import annotations

import time

from logger import logger

# Major Korean stocks (종목명 → 종목코드)
STOCK_DICT: dict[str, str] = {
    # 대형주
    "삼성전자": "005930", "SK하이닉스": "000660", "LG에너지솔루션": "373220",
    "삼성바이오로직스": "207940", "현대차": "005380", "현대자동차": "005380",
    "기아": "000270", "셀트리온": "068270", "KB금융": "105560",
    "신한지주": "055550", "POSCO홀딩스": "005490", "포스코홀딩스": "005490",
    "NAVER": "035420", "네이버": "035420", "카카오": "035720",
    "삼성SDI": "006400", "LG화학": "051910", "현대모비스": "012330",
    "삼성물산": "028260", "SK이노베이션": "096770", "LG전자": "066570",
    "카카오뱅크": "323410", "크래프톤": "259960", "SK텔레콤": "017670",
    "하나금융지주": "086790", "우리금융지주": "316140", "삼성생명": "032830",
    "한국전력": "015760", "한전": "015760", "KT": "030200",
    "삼성화재": "000810", "HMM": "011200", "에코프로비엠": "247540",
    "에코프로": "086520", "두산에너빌리티": "034020", "한화에어로스페이스": "012450",
    "LG디스플레이": "034220", "한화오션": "042660",
    # 중형주
    "엔씨소프트": "036570", "넷마블": "251270", "카카오게임즈": "293490",
    "CJ제일제당": "097950", "아모레퍼시픽": "090430", "한미반도체": "042700",
    "리노공업": "058470", "HD현대중공업": "329180", "현대건설": "000720",
    "대한항공": "003490", "SK바이오팜": "326030",
    # 미국 주식 (자주 언급)
    "엔비디아": "NVDA", "테슬라": "TSLA", "애플": "AAPL",
    "마이크로소프트": "MSFT", "MS": "MSFT", "구글": "GOOGL",
    "알파벳": "GOOGL", "아마존": "AMZN", "메타": "META",
    "넷플릭스": "NFLX", "AMD": "AMD", "인텔": "INTC",
    "퀄컴": "QCOM", "브로드컴": "AVGO", "ASML": "ASML",
    "TSMC": "TSM", "팔란티어": "PLTR", "코인베이스": "COIN",
    "마이크론": "MU", "슈퍼마이크로": "SMCI",
    # 추가 한국 주식
    "두산밥캣": "241560", "CJ ENM": "035760", "롯데케미칼": "011170",
    "SK": "034730", "SK스퀘어": "402340", "LG": "003550",
    "한화솔루션": "009830", "금호석유": "011780", "S-Oil": "010950",
    "에스오일": "010950", "쌍용C&E": "003410",
    "삼성엔지니어링": "028050", "현대글로비스": "086280",
    "CJ대한통운": "000120", "NH투자증권": "005940", "미래에셋증권": "006800",
    "키움증권": "039490", "한국항공우주": "047810", "한화시스템": "272210",
    "현대로템": "064350", "한국조선해양": "009540", "HD한국조선해양": "009540",
    "삼성중공업": "010140", "대우조선": "042660",
    "포스코인터내셔널": "047050", "포스코퓨처엠": "003670",
    "LG이노텍": "011070", "삼성전기": "009150", "DB하이텍": "000990",
    "SK실트론": "SKS", "두산퓨얼셀": "336260",
    "한화투자증권": "003530", "고려아연": "010130",
    "영풍": "000670", "LS": "006260",
    # 추가 미국 주식/ETF
    "S&P500": "SPY", "에스앤피": "SPY", "나스닥": "QQQ",
    "다우존스": "DIA", "러셀2000": "IWM",
    "아크": "ARKK", "ARKK": "ARKK", "QQQ": "QQQ", "SPY": "SPY",
    "SCHD": "SCHD", "VOO": "VOO",
    "마이크로스트래티지": "MSTR", "코스트코": "COST",
    "리비안": "RIVN", "루시드": "LCID", "니오": "NIO",
    "ARM": "ARM", "스노우플레이크": "SNOW",
    "데이터독": "DDOG", "크라우드스트라이크": "CRWD",
    "줌비디오": "ZM", "디즈니": "DIS", "비자": "V",
    "JP모건": "JPM", "골드만삭스": "GS", "워렌버핏": "BRK.B",
    "버크셔해서웨이": "BRK.B",
}

# Major cryptocurrencies (코인명 → 심볼)
COIN_DICT: dict[str, str] = {
    "비트코인": "BTC", "비코": "BTC", "BTC": "BTC",
    "이더리움": "ETH", "이더": "ETH", "ETH": "ETH",
    "리플": "XRP", "XRP": "XRP",
    "솔라나": "SOL", "SOL": "SOL",
    "도지코인": "DOGE", "도지": "DOGE",
    "에이다": "ADA", "카르다노": "ADA",
    "폴카닷": "DOT", "체인링크": "LINK",
    "아발란체": "AVAX", "폴리곤": "MATIC", "매틱": "MATIC",
    "시바이누": "SHIB", "유니스왑": "UNI",
    "앱토스": "APT", "아비트럼": "ARB", "옵티미즘": "OP",
    "수이": "SUI", "니어프로토콜": "NEAR", "니어": "NEAR",
    "코스모스": "ATOM", "아톰": "ATOM",
    "스텔라루멘": "XLM", "트론": "TRX",
    "라이트코인": "LTC", "이오스": "EOS",
    "비트코인캐시": "BCH", "헤데라": "HBAR",
    "파일코인": "FIL", "샌드박스": "SAND",
    "디센트럴랜드": "MANA", "엑시인피니티": "AXS",
    "루나": "LUNA", "테라": "LUNA",
    "알트코인": "ALT", "알트": "ALT",
    "스테이블코인": "STABLE", "테더": "USDT",
    # 추가 코인
    "피이코인": "PI", "파이코인": "PI",
    "월드코인": "WLD", "펫치AI": "FET", "렌더토큰": "RNDR",
    "인젝티브": "INJ", "세이": "SEI", "셀레스티아": "TIA",
    "주피터": "JUP", "본크": "BONK", "밈코인": "MEME",
    "페페": "PEPE", "플레어": "FLR", "스택스": "STX",
    "톤코인": "TON", "톤": "TON", "카스파": "KAS",
    "이뮤터블": "IMX", "매틱": "POL", "폴리곤": "POL",
}

# Major real estate areas (지역명)
REAL_ESTATE_DICT: dict[str, str] = {
    # 서울
    "강남": "서울/강남", "서초": "서울/서초", "송파": "서울/송파",
    "잠실": "서울/송파", "반포": "서울/서초", "압구정": "서울/강남",
    "대치": "서울/강남", "청담": "서울/강남", "논현": "서울/강남",
    "마포": "서울/마포", "용산": "서울/용산", "성수": "서울/성동",
    "여의도": "서울/영등포", "목동": "서울/양천", "노원": "서울/노원",
    "강동": "서울/강동", "강서": "서울/강서", "은평": "서울/은평",
    "동작": "서울/동작", "관악": "서울/관악",
    # 경기
    "판교": "경기/성남", "분당": "경기/성남", "일산": "경기/고양",
    "과천": "경기/과천", "광명": "경기/광명", "하남": "경기/하남",
    "위례": "경기/성남", "동탄": "경기/화성", "수원": "경기/수원",
    "용인": "경기/용인", "평택": "경기/평택", "김포": "경기/김포",
    "파주": "경기/파주", "의왕": "경기/의왕", "안양": "경기/안양",
    "인천": "인천", "송도": "인천/연수",
    # 기타 광역시
    "부산": "부산", "해운대": "부산/해운대", "대구": "대구",
    "대전": "대전", "세종": "세종", "광주": "광주",
    # 부동산 용어
    "아파트": "", "재건축": "", "재개발": "",
    "분양": "", "청약": "", "전세": "", "월세": "",
    "갭투자": "", "임대": "",
}

# Sentiment keywords for Korean finance context
POSITIVE_KEYWORDS = [
    "매수", "사야", "오른다", "상승", "급등", "폭등", "반등", "돌파",
    "호재", "긍정", "추천", "유망", "성장", "상승장", "불장", "강세",
    "저점", "매집", "기회", "저평가", "실적개선", "턴어라운드",
    "사세요", "담으세요", "들어가세요", "올라갈", "좋아질",
]

NEGATIVE_KEYWORDS = [
    "매도", "팔아야", "내린다", "하락", "급락", "폭락", "붕괴", "이탈",
    "악재", "부정", "위험", "경고", "버블", "하락장", "약세",
    "고점", "과열", "고평가", "실적악화", "위기",
    "팔아", "빠지세요", "나오세요", "떨어질", "나빠질",
]

NEUTRAL_KEYWORDS = [
    "관망", "보합", "중립", "지켜봐", "횡보", "눈치",
    "주시", "대기", "기다려",
]


def find_assets_in_text(text: str) -> list[dict]:
    """Extract mentioned assets from text (title, description, or subtitle)."""
    results = []
    seen = set()

    for name, code in STOCK_DICT.items():
        if name in text and code not in seen:
            seen.add(code)
            results.append({
                "asset_type": "stock",
                "asset_name": name,
                "asset_code": code,
            })

    for name, code in COIN_DICT.items():
        if name in text and code not in seen:
            seen.add(code)
            results.append({
                "asset_type": "coin",
                "asset_name": name,
                "asset_code": code,
            })

    for name, region in REAL_ESTATE_DICT.items():
        if name in text and region and name not in seen:
            seen.add(name)
            results.append({
                "asset_type": "real_estate",
                "asset_name": name,
                "asset_code": region,
            })

    return results


def analyze_sentiment(text: str) -> str:
    """Analyze sentiment of text using weighted keyword scoring."""
    # Strong signals get higher weight
    strong_positive = ["급등", "폭등", "강력 추천", "적극 매수", "대박", "상승장"]
    strong_negative = ["급락", "폭락", "대폭 하락", "위기", "붕괴", "버블 붕괴"]

    pos_count = sum(1 for kw in POSITIVE_KEYWORDS if kw in text)
    neg_count = sum(1 for kw in NEGATIVE_KEYWORDS if kw in text)
    pos_count += sum(2 for kw in strong_positive if kw in text)
    neg_count += sum(2 for kw in strong_negative if kw in text)

    # Negation handling
    negation_patterns = ["아닌", "않", "못", "안 ", "없", "아니"]
    negation_count = sum(1 for p in negation_patterns if p in text)
    if negation_count >= 2:
        pos_count, neg_count = neg_count, pos_count

    if pos_count > neg_count and pos_count >= 2:
        return "positive"
    elif neg_count > pos_count and neg_count >= 2:
        return "negative"
    return "neutral"


def analyze_sentiment_for_asset(text: str, asset_name: str) -> str:
    """Analyze sentiment in text context around a specific asset mention."""
    idx = text.find(asset_name)
    if idx == -1:
        return analyze_sentiment(text)

    # Extract ~100 chars around the asset mention for context-specific analysis
    start = max(0, idx - 100)
    end = min(len(text), idx + len(asset_name) + 100)
    context = text[start:end]

    return analyze_sentiment(context)


def generate_simple_summary(title: str, assets: list[dict], sentiment: str) -> str:
    """Generate a simple summary based on title, assets, and sentiment."""
    sentiment_kr = {"positive": "긍정", "negative": "부정", "neutral": "중립"}
    asset_names = [a["asset_name"] for a in assets[:3]]

    if not asset_names:
        return f"{title}"

    return f"언급 자산: {', '.join(asset_names)} | 논조: {sentiment_kr.get(sentiment, '중립')}"


# ---------------------------------------------------------------------------
# DB-backed asset dictionary with fallback to hardcoded dicts
# ---------------------------------------------------------------------------


def load_assets_from_db(cur) -> tuple[dict, dict, dict]:
    """Load asset dictionaries from database.

    Returns (stock_dict, coin_dict, real_estate_dict) with same format
    as hardcoded dicts (name -> code mapping, including aliases).
    """
    cur.execute(
        """SELECT asset_name, asset_code, asset_type, aliases
           FROM asset_dictionary
           WHERE is_active = true"""
    )
    stock_dict: dict[str, str] = {}
    coin_dict: dict[str, str] = {}
    re_dict: dict[str, str] = {}

    for name, code, atype, aliases in cur.fetchall():
        target = (
            stock_dict
            if atype == "stock"
            else coin_dict
            if atype == "coin"
            else re_dict
        )
        target[name] = code
        if aliases:
            for alias in aliases:
                target[alias] = code

    return stock_dict, coin_dict, re_dict


class DynamicAssetDictionary:
    """Asset dictionary that loads from DB with hardcoded fallback.

    - Tries DB first via ``load_assets_from_db()``
    - Falls back to module-level hardcoded dicts if DB is unavailable
    - Caches for 1 hour (configurable via ``_cache_ttl``)
    """

    def __init__(self) -> None:
        self._stock: dict[str, str] = dict(STOCK_DICT)
        self._coin: dict[str, str] = dict(COIN_DICT)
        self._real_estate: dict[str, str] = dict(REAL_ESTATE_DICT)
        self._loaded_at: float = 0
        self._cache_ttl: int = 3600  # 1 hour

    def refresh(self, cur=None) -> None:
        """Reload from DB if available and cache expired.

        Wrapped in a SAVEPOINT so a query failure (e.g. table missing on a
        partially-migrated DB) is contained and does not leave the surrounding
        transaction in an aborted state. Without the savepoint the silent
        ``except: pass`` previously caused every subsequent INSERT in the same
        transaction to fail with InFailedSqlTransaction — see incident notes
        on 2026-04-14.
        """
        if time.time() - self._loaded_at < self._cache_ttl:
            return
        if cur is None:
            return
        try:
            cur.execute("SAVEPOINT load_assets_dict")
        except Exception:
            return
        try:
            s, c, r = load_assets_from_db(cur)
            cur.execute("RELEASE SAVEPOINT load_assets_dict")
            if s:
                self._stock = s
                self._coin = c
                self._real_estate = r
                self._loaded_at = time.time()
        except Exception as exc:
            try:
                cur.execute("ROLLBACK TO SAVEPOINT load_assets_dict")
            except Exception:
                pass
            logger.warning("asset_dictionary refresh failed, falling back: %s", exc)

    def find_assets_in_text(self, text: str) -> list[dict]:
        """Extract mentioned assets from *text*.

        Same return format as the module-level ``find_assets_in_text()``.
        """
        results: list[dict] = []
        seen: set[str] = set()

        for name, code in self._stock.items():
            if name in text and code not in seen:
                seen.add(code)
                results.append({
                    "asset_type": "stock",
                    "asset_name": name,
                    "asset_code": code,
                })

        for name, code in self._coin.items():
            if name in text and code not in seen:
                seen.add(code)
                results.append({
                    "asset_type": "coin",
                    "asset_name": name,
                    "asset_code": code,
                })

        for name, region in self._real_estate.items():
            if name in text and region and name not in seen:
                seen.add(name)
                results.append({
                    "asset_type": "real_estate",
                    "asset_name": name,
                    "asset_code": region,
                })

        return results


# Module-level singleton (uses hardcoded dicts until refresh() is called)
_asset_dict = DynamicAssetDictionary()
