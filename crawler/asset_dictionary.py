"""Asset dictionary for Korean stock/coin/real estate name recognition."""

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
    """Analyze sentiment of text: positive, negative, or neutral."""
    pos_count = sum(1 for kw in POSITIVE_KEYWORDS if kw in text)
    neg_count = sum(1 for kw in NEGATIVE_KEYWORDS if kw in text)

    if pos_count > neg_count and pos_count >= 2:
        return "positive"
    elif neg_count > pos_count and neg_count >= 2:
        return "negative"
    return "neutral"


def generate_simple_summary(title: str, assets: list[dict], sentiment: str) -> str:
    """Generate a simple summary based on title, assets, and sentiment."""
    sentiment_kr = {"positive": "긍정", "negative": "부정", "neutral": "중립"}
    asset_names = [a["asset_name"] for a in assets[:3]]

    if not asset_names:
        return f"{title}"

    return f"언급 자산: {', '.join(asset_names)} | 논조: {sentiment_kr.get(sentiment, '중립')}"
