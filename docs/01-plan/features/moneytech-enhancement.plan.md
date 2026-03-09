# [Plan] MoneyTech Enhancement - 사용자 흥미도 극대화

## 1. Feature Overview

| Item | Description |
|------|-------------|
| Feature Name | MoneyTech Enhancement - 재테크 유튜브 분석 흥미 기능 강화 |
| Target Users | 재테크 관심 개인투자자 (주식/코인/부동산) |
| Priority | HIGH |
| Complexity | Major Feature |
| Estimated Phases | 4 sub-features |

## 2. Problem Statement

현재 구현된 MVP는 기본 대시보드(채널 랭킹, 키워드 클라우드, 차트)와 자산 히트맵, 채널 비교까지 완료되었으나,
사용자가 **반복 방문하고 싶은 중독성 있는 기능**이 부족하다.

기획.md에서 정의한 핵심 차별점:
- "이 유튜버 말을 믿어도 되나?" -> **적중률 검증 시스템**
- "여러 채널 의견을 빠르게 비교" -> **크로스 채널 의견 비교**
- "재미있는 인사이트" -> **유튜버 성향 레이더 차트, 역발상 지표**

## 3. Current State (As-Is)

### 구현 완료
- [x] yt-dlp 크롤러 (메타데이터 + 자막 수집)
- [x] 종목/코인/부동산 NLP 추출 (사전 기반)
- [x] 감성 분석 (키워드 기반 긍정/부정/중립)
- [x] 종목 히트맵 시각화
- [x] 채널 비교 (구독자/조회수/영상수 지표)
- [x] 종목 상세 페이지 (언급 채널, 감성 분포)
- [x] 영상 피드 (언급종목 뱃지, 감성 표시, 요약)
- [x] DB: mentioned_assets, predictions 테이블

### 미구현 (기획.md 기반 핵심 기능)
- [ ] 적중률 검증 시스템 (킬러 피처)
- [ ] 크로스 채널 의견 비교 (동일 종목 매수/매도/관망)
- [ ] 유튜버 성향 레이더 차트
- [ ] 떡상 예감 알림 (급등 언급 종목 감지)
- [ ] 역발상 지표 ("모두가 매수라 할 때가 고점?")
- [ ] 주간 자동 리포트

## 4. Target State (To-Be)

### Enhancement A: 적중률 검증 대시보드
```
유튜버가 "삼성전자 매수" 발언
  → 해당 시점 주가 기록 (pykrx)
  → 1주/1개월/3개월 후 가격 추적
  → 적중률 산출 및 채널별 스코어카드 표시
```

**사용자 가치**: "이 유튜버의 추천 적중률 62%" - 신뢰도 판단 핵심 지표
**구현 범위**:
- predictions 테이블 활용 (이미 생성됨)
- 주가 데이터: pykrx (한국주식), CoinGecko API (코인)
- 채널 상세 페이지에 적중률 카드 추가
- 적중률 랭킹 위젯 (대시보드)

### Enhancement B: 크로스 채널 의견 매트릭스
```
삼성전자에 대해:
  삼프로TV  → 매수 (목표 85,000)
  슈카월드  → 관망
  신사임당  → 매수 (AI 수혜)
  합의도: 67% 매수 우세
```

**사용자 가치**: 동일 종목에 대한 복수 채널 의견을 한눈에 비교
**구현 범위**:
- 종목 상세 페이지 확장 (채널별 의견 매트릭스)
- 의견 합의도(Consensus Score) 자동 계산
- "의견 갈림 종목 TOP 5" 위젯

### Enhancement C: 유튜버 성향 프로파일
```
5축 레이더 차트:
  공격성(매수 빈도) | 보수성(관망 빈도) | 다양성(종목 범위)
  정확도(적중률) | 깊이(영상 평균 길이)
```

**사용자 가치**: 유튜버의 투자 성향을 직관적으로 파악
**구현 범위**:
- Recharts RadarChart 컴포넌트
- 채널 상세 페이지에 레이더 차트 추가
- mentioned_assets + predictions 데이터 기반 계산

### Enhancement D: 실시간 트렌드 알림 + 역발상 지표
```
떡상 예감: "비트코인" - 지난 24시간 내 8개 채널에서 동시 언급!
역발상 지표: "삼성전자" - 모든 유튜버가 매수 의견 → 주의!
```

**사용자 가치**: 재미 + 실용 - 투자 타이밍 힌트 제공
**구현 범위**:
- 트렌드 페이지에 "급등 언급 종목" 섹션
- 역발상 지표 위젯 (합의도 90% 이상일 때 경고)
- 주간 자동 리포트 (daily_stats 기반)

## 5. Implementation Priority

| # | Enhancement | Impact | Effort | Priority |
|---|-------------|--------|--------|----------|
| A | 적중률 검증 | 최상 (킬러피처) | 높음 | P0 |
| B | 크로스 채널 의견 | 상 | 중간 | P1 |
| C | 유튜버 성향 레이더 | 중 | 낮음 | P2 |
| D | 트렌드 알림 + 역발상 | 상 | 중간 | P1 |

## 6. Technical Approach

### 주가/코인가 데이터 수집 (Enhancement A 전제조건)
```python
# crawler/stock_price.py
from pykrx import stock  # 한국 주식
import requests  # CoinGecko API

def get_stock_price(code: str, date: str) -> float:
    df = stock.get_market_ohlcv(date, date, code)
    return df['종가'].iloc[0] if not df.empty else None

def get_coin_price(symbol: str) -> float:
    r = requests.get(f"https://api.coingecko.com/api/v3/simple/price?ids={symbol}&vs_currencies=krw")
    return r.json().get(symbol, {}).get('krw')
```

### 적중률 계산 로직
```python
def evaluate_prediction(prediction):
    # 추천 시점 가격 vs 1주/1개월/3개월 후 가격
    price_change = (actual_price - predicted_price) / predicted_price
    if prediction_type == 'buy':
        return price_change > 0.03  # 3% 이상 상승 시 적중
    elif prediction_type == 'sell':
        return price_change < -0.03
    return abs(price_change) < 0.03  # 관망은 횡보 시 적중
```

### 프론트엔드 신규 컴포넌트
| 컴포넌트 | 위치 | 데이터 소스 |
|---------|------|------------|
| HitRateCard | 채널 상세 | predictions |
| HitRateRanking | 대시보드 | channels.hit_rate |
| OpinionMatrix | 종목 상세 | mentioned_assets + sentiment |
| ConsensusWidget | 대시보드 | mentioned_assets 집계 |
| ProfileRadar | 채널 상세 | 복합 계산 |
| TrendAlert | 트렌드 | mentioned_assets 24h 집계 |
| ContrarianIndex | 대시보드 | consensus 90%+ 필터 |

## 7. Dependencies

| Dependency | Purpose | Status |
|------------|---------|--------|
| pykrx | 한국 주식 가격 | 설치 필요 |
| CoinGecko API | 코인 가격 (무료) | API key 불필요 |
| mentioned_assets 테이블 | 종목 언급 데이터 | 구현 완료 |
| predictions 테이블 | 적중률 데이터 | 스키마 완료, 데이터 미수집 |

## 8. Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| pykrx GitHub Actions 실행 불가 | 높음 | 별도 가격 수집 스크립트, CoinGecko는 REST API로 가능 |
| 적중률 판정 기준 논란 | 중간 | 복수 기준 (1주/1월/3월) 투명 공개 |
| NLP 종목 추출 오탐 | 중간 | 사전 확장 + LLM 2차 검증 (Phase 2) |
| 자막 없는 영상 | 낮음 | 제목+태그 기반 분석으로 fallback |

## 9. Success Metrics

| Metric | Target |
|--------|--------|
| 적중률 데이터 보유 채널 수 | 10개+ |
| 종목 언급 히트맵 활성 자산 수 | 30개+ |
| 크로스 채널 비교 가능 종목 수 | 20개+ |
| 대시보드 위젯 수 | 10개+ (현재 7개) |

---

> PDCA Phase: **Plan** -> Design -> Do -> Check -> Act
> Next: `/pdca design moneytech-enhancement`
