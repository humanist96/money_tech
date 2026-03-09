# [Design] MoneyTech Enhancement - 상세 설계

> Plan Reference: `docs/01-plan/features/moneytech-enhancement.plan.md`

## 1. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                    GitHub Actions (매 6시간)                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │ yt-dlp   │→│ NLP분석  │→│ 가격수집  │→│ 적중률 평가      │ │
│  │ 크롤러   │  │ 종목추출 │  │ pykrx    │  │ predictions 갱신 │ │
│  │          │  │ 감성분석 │  │ CoinGecko│  │                  │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘ │
└──────────────────────┬───────────────────────────────────────────┘
                       │ Neon PostgreSQL
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│                    Next.js 15 (Vercel)                            │
│                                                                   │
│  ┌─────────────┐ ┌─────────────┐ ┌────────────┐ ┌────────────┐ │
│  │ 적중률 카드  │ │ 의견 매트릭스│ │ 레이더 차트 │ │ 트렌드 알림│ │
│  │ HitRateCard │ │ OpinionMatrix│ │ProfileRadar│ │ TrendAlert │ │
│  └─────────────┘ └─────────────┘ └────────────┘ └────────────┘ │
│  ┌──────────────┐ ┌──────────────┐ ┌─────────────────────────┐ │
│  │ 적중률 랭킹   │ │ 역발상 지표   │ │ 의견 갈림 종목 TOP 5    │ │
│  │HitRateRanking│ │ContrarianIdx │ │ DividedOpinions         │ │
│  └──────────────┘ └──────────────┘ └─────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

## 2. Data Flow Design

### 2.1 적중률 데이터 흐름

```
영상 자막 분석
  → "삼성전자 매수" 감지 (asset_dictionary + sentiment)
  → mentioned_assets INSERT (sentiment='positive')
  → prediction 감지: prediction_type='buy'
  → predictions INSERT (predicted_at=영상 업로드일)
  → 가격 수집 스케줄 등록 (price_at_mention 기록)
  → 1주 후: actual_price_after_1w UPDATE
  → 1개월 후: actual_price_after_1m UPDATE
  → 3개월 후: actual_price_after_3m UPDATE
  → is_accurate 계산 → channels.hit_rate 갱신
```

### 2.2 역발상 지표 데이터 흐름

```
mentioned_assets 최근 7일 집계
  → 종목별 sentiment 분포 계산
  → positive_ratio >= 90% → "과열 경고" 플래그
  → negative_ratio >= 90% → "공포 과다" 플래그
  → 대시보드 ContrarianIndex 위젯에 표시
```

## 3. DB Schema Changes

### 3.1 기존 테이블 활용 (변경 없음)

```sql
-- mentioned_assets: 이미 생성됨 (sentiment 포함)
-- predictions: 이미 생성됨 (is_accurate, actual_price_after_* 포함)
-- channels: trust_score, hit_rate 컬럼 이미 추가됨
```

### 3.2 신규: 가격 이력 테이블

```sql
CREATE TABLE IF NOT EXISTS asset_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_code TEXT NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('stock', 'coin')),
  price REAL NOT NULL,
  recorded_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(asset_code, recorded_date)
);
CREATE INDEX idx_asset_prices_code ON asset_prices(asset_code);
```

## 4. Backend Module Design

### 4.1 crawler/price_collector.py

```
class PriceCollector:
  + get_stock_price(code: str, date: str) -> float | None
      # pykrx 활용, KOSPI/KOSDAQ 종가 조회
  + get_coin_price(symbol: str) -> float | None
      # CoinGecko API, KRW 기준 현재가 조회
  + collect_prices_for_predictions() -> None
      # predictions 테이블에서 가격 미수집 건 조회
      # 해당 asset_code의 현재가 수집 및 UPDATE
  + record_daily_prices(assets: list[str]) -> None
      # 활성 자산의 일별 가격 asset_prices에 기록
```

### 4.2 crawler/prediction_evaluator.py

```
class PredictionEvaluator:
  + evaluate_all() -> None
      # 1주/1개월/3개월 경과한 predictions 조회
      # actual_price_after_* 컬럼 업데이트
      # is_accurate 판정 (3% 기준)
  + update_channel_hit_rates() -> None
      # 채널별 적중률 집계
      # channels.hit_rate, trust_score UPDATE
  + _calculate_accuracy(pred) -> bool
      # buy: price_change > +3%
      # sell: price_change < -3%
      # hold: |price_change| < 3%
```

### 4.3 crawler/prediction_detector.py

```
class PredictionDetector:
  + detect_predictions(text: str, assets: list) -> list[dict]
      # 자막/제목에서 매수/매도/관망 추천 감지
      # 키워드 패턴: "사세요", "매수", "매도", "관망" 등
      # 반환: [{asset, prediction_type, reason_text}]
  + PREDICTION_PATTERNS: dict
      # buy: ["매수", "사세요", "담으세요", "적극 추천", ...]
      # sell: ["매도", "팔아", "빠지세요", "손절", ...]
      # hold: ["관망", "지켜봐", "기다려", ...]
```

## 5. Frontend Component Design

### 5.1 HitRateCard (채널 상세 페이지)

```
┌─────────────────────────────────────┐
│  적중률 스코어카드                     │
│  ┌─────┐                            │
│  │ 62% │  최근 3개월 적중률            │
│  └─────┘                            │
│  ✅ 적중 15건  ❌ 미적중 9건           │
│                                      │
│  최근 추천 종목                        │
│  삼성전자  01/15  72,000→78,000 +8.3% ✅│
│  LG에너지  01/20  380K→365K  -3.9%  ❌│
│  비트코인  02/01  62M→71M   +14.5% ✅│
└─────────────────────────────────────┘
```

**Props**: `channelId: string`
**Data**: `predictions` JOIN `mentioned_assets`
**File**: `frontend/components/dashboard/hit-rate-card.tsx`

### 5.2 HitRateRanking (대시보드)

```
┌─────────────────────────────────────┐
│  적중률 TOP 채널                      │
│  1. 슈카월드      ████████  72%      │
│  2. 삼프로TV      ██████    62%      │
│  3. 부읽남        █████     58%      │
│  4. 신사임당      ████      52%      │
└─────────────────────────────────────┘
```

**Props**: `channels: Channel[]` (hit_rate 정렬)
**File**: `frontend/components/dashboard/hit-rate-ranking.tsx`

### 5.3 OpinionMatrix (종목 상세 페이지 확장)

```
┌─────────────────────────────────────┐
│  삼성전자 - 채널별 의견                │
│                                      │
│  매수 ████████████  12채널  (55%)    │
│  관망 ███████       7채널   (32%)    │
│  매도 ███           3채널   (13%)    │
│                                      │
│  합의도: 55% (매수 우세)              │
│                                      │
│  채널      의견  근거          날짜   │
│  삼프로TV  매수  반도체 회복   03/01  │
│  슈카월드  관망  불확실성      03/03  │
│  신사임당  매수  AI 수혜       03/05  │
└─────────────────────────────────────┘
```

**위치**: 기존 `/assets/[code]/page.tsx` 확장
**Data**: `mentioned_assets` + `predictions` + `channels`

### 5.4 ProfileRadar (채널 상세 페이지)

```
┌─────────────────────────────────────┐
│  유튜버 성향 프로파일                  │
│                                      │
│         공격성                        │
│          ╱╲                          │
│    깊이 ╱  ╲ 보수성                  │
│        ╱ ▓▓ ╲                        │
│       ╱▓▓▓▓▓▓╲                      │
│  정확도 ──── 다양성                   │
│                                      │
│  공격성: 72  보수성: 35  다양성: 88   │
│  정확도: 62  깊이: 45                 │
└─────────────────────────────────────┘
```

**5축 계산 로직**:
| 축 | 계산 방법 | 범위 |
|----|---------|------|
| 공격성 | positive_sentiment_ratio * 100 | 0-100 |
| 보수성 | neutral_sentiment_ratio * 100 | 0-100 |
| 다양성 | unique_assets_mentioned / total_mentions * 100 (capped) | 0-100 |
| 정확도 | hit_rate * 100 | 0-100 |
| 깊이 | avg_video_duration / 1800 * 100 (capped at 100) | 0-100 |

**File**: `frontend/components/charts/profile-radar.tsx`
**Library**: Recharts `RadarChart`

### 5.5 TrendAlert (트렌드 페이지)

```
┌─────────────────────────────────────┐
│  🔥 급등 언급 종목 (24시간)           │
│                                      │
│  비트코인   8개 채널 동시 언급  +340% │
│  삼성전자   5개 채널 동시 언급  +120% │
│  엔비디아   4개 채널 동시 언급  +80%  │
│                                      │
│  * 전주 대비 언급 증가율               │
└─────────────────────────────────────┘
```

**File**: `frontend/components/dashboard/trend-alert.tsx`

### 5.6 ContrarianIndex (대시보드)

```
┌─────────────────────────────────────┐
│  역발상 지표                          │
│                                      │
│  ⚠️ 과열 경고                        │
│  테슬라   매수 95% → 고점 주의!       │
│  솔라나   매수 92% → 과열 신호        │
│                                      │
│  💎 공포 과다                         │
│  LG에너지 매도 88% → 저점 기회?       │
│                                      │
│  "모두가 탐욕일 때 공포하라" - 워렌 버핏│
└─────────────────────────────────────┘
```

**File**: `frontend/components/dashboard/contrarian-index.tsx`

### 5.7 DividedOpinions (대시보드)

```
┌─────────────────────────────────────┐
│  의견 갈림 종목 TOP 5                 │
│                                      │
│  현대차   매수 48% | 매도 42%  ⚡갈림 │
│  카카오   매수 40% | 매도 38%  ⚡갈림 │
│  리플     매수 52% | 매도 45%  ⚡갈림 │
└─────────────────────────────────────┘
```

**File**: `frontend/components/dashboard/divided-opinions.tsx`

## 6. Query Design

### 6.1 적중률 관련

```sql
-- 채널별 적중률 계산
SELECT c.id, c.name,
  COUNT(CASE WHEN p.is_accurate = true THEN 1 END)::float /
  NULLIF(COUNT(p.id), 0) * 100 AS hit_rate,
  COUNT(p.id) AS total_predictions,
  COUNT(CASE WHEN p.is_accurate = true THEN 1 END) AS accurate_count
FROM channels c
LEFT JOIN predictions p ON p.channel_id = c.id
  AND p.is_accurate IS NOT NULL
GROUP BY c.id, c.name
ORDER BY hit_rate DESC NULLS LAST;

-- 채널의 최근 예측 이력
SELECT p.*, ma.asset_name, ma.asset_code, ma.asset_type
FROM predictions p
JOIN mentioned_assets ma ON p.mentioned_asset_id = ma.id
WHERE p.channel_id = $1
ORDER BY p.predicted_at DESC
LIMIT 20;
```

### 6.2 크로스 채널 의견

```sql
-- 종목별 채널 의견 집계 (매수/매도/관망)
SELECT ma.asset_name, ma.asset_code,
  c.name AS channel_name,
  ma.sentiment,
  v.published_at,
  v.title AS video_title
FROM mentioned_assets ma
JOIN videos v ON ma.video_id = v.id
JOIN channels c ON v.channel_id = c.id
WHERE ma.asset_code = $1
AND v.published_at >= NOW() - INTERVAL '30 days'
ORDER BY v.published_at DESC;
```

### 6.3 급등 언급 종목

```sql
-- 24시간 내 다수 채널에서 언급된 종목
SELECT ma.asset_name, ma.asset_code, ma.asset_type,
  COUNT(DISTINCT c.id) AS channel_count,
  COUNT(*) AS mention_count
FROM mentioned_assets ma
JOIN videos v ON ma.video_id = v.id
JOIN channels c ON v.channel_id = c.id
WHERE v.published_at >= NOW() - INTERVAL '24 hours'
GROUP BY ma.asset_name, ma.asset_code, ma.asset_type
HAVING COUNT(DISTINCT c.id) >= 3
ORDER BY channel_count DESC, mention_count DESC
LIMIT 10;
```

### 6.4 역발상 지표

```sql
-- 합의도 90% 이상 종목 (과열/공포)
SELECT ma.asset_name, ma.asset_code,
  COUNT(CASE WHEN ma.sentiment='positive' THEN 1 END)::float /
    NULLIF(COUNT(*), 0) * 100 AS positive_pct,
  COUNT(CASE WHEN ma.sentiment='negative' THEN 1 END)::float /
    NULLIF(COUNT(*), 0) * 100 AS negative_pct,
  COUNT(DISTINCT c.id) AS channel_count
FROM mentioned_assets ma
JOIN videos v ON ma.video_id = v.id
JOIN channels c ON v.channel_id = c.id
WHERE v.published_at >= NOW() - INTERVAL '7 days'
GROUP BY ma.asset_name, ma.asset_code
HAVING COUNT(*) >= 5
  AND (
    COUNT(CASE WHEN ma.sentiment='positive' THEN 1 END)::float / COUNT(*) >= 0.85
    OR COUNT(CASE WHEN ma.sentiment='negative' THEN 1 END)::float / COUNT(*) >= 0.85
  )
ORDER BY channel_count DESC;
```

### 6.5 유튜버 성향 프로파일

```sql
-- 5축 레이더 데이터
SELECT
  c.id, c.name,
  -- 공격성: positive 비율
  COUNT(CASE WHEN ma.sentiment='positive' THEN 1 END)::float /
    NULLIF(COUNT(ma.id), 0) * 100 AS aggressiveness,
  -- 보수성: neutral 비율
  COUNT(CASE WHEN ma.sentiment='neutral' THEN 1 END)::float /
    NULLIF(COUNT(ma.id), 0) * 100 AS conservatism,
  -- 다양성: unique assets / total mentions
  COUNT(DISTINCT ma.asset_code)::float /
    NULLIF(COUNT(ma.id), 0) * 100 AS diversity,
  -- 정확도
  c.hit_rate AS accuracy,
  -- 깊이: 평균 영상 길이 / 30분
  AVG(v.duration)::float / 1800 * 100 AS depth
FROM channels c
LEFT JOIN videos v ON v.channel_id = c.id
LEFT JOIN mentioned_assets ma ON ma.video_id = v.id
WHERE c.id = $1
GROUP BY c.id, c.name, c.hit_rate;
```

## 7. Implementation Order

```
Phase 1: Backend (가격 수집 + 예측 감지)
  ├── 1.1 crawler/price_collector.py
  ├── 1.2 crawler/prediction_detector.py
  ├── 1.3 crawler/prediction_evaluator.py
  └── 1.4 main.py 통합 + GitHub Actions 업데이트

Phase 2: 프론트엔드 쿼리 + 타입
  ├── 2.1 lib/queries.ts (신규 쿼리 6개 추가)
  └── 2.2 lib/types.ts (신규 타입 추가)

Phase 3: 프론트엔드 컴포넌트 (P0 + P1)
  ├── 3.1 HitRateCard + HitRateRanking
  ├── 3.2 OpinionMatrix (종목 상세 확장)
  ├── 3.3 TrendAlert
  ├── 3.4 ContrarianIndex
  └── 3.5 DividedOpinions

Phase 4: 프론트엔드 컴포넌트 (P2)
  ├── 4.1 ProfileRadar (Recharts RadarChart)
  └── 4.2 대시보드 레이아웃 통합

Phase 5: 페이지 통합 + 배포
  ├── 5.1 대시보드 page.tsx 업데이트
  ├── 5.2 채널 상세 [id]/page.tsx 업데이트
  ├── 5.3 종목 상세 assets/[code]/page.tsx 업데이트
  ├── 5.4 트렌드 trends/page.tsx 업데이트
  └── 5.5 Vercel 배포 + 검증
```

## 8. File Map

| New/Modified | File Path | Purpose |
|:---:|-----------|---------|
| NEW | `crawler/price_collector.py` | 주가/코인가 수집 |
| NEW | `crawler/prediction_detector.py` | 매수/매도 추천 감지 |
| NEW | `crawler/prediction_evaluator.py` | 적중률 평가 |
| MOD | `crawler/main.py` | 신규 모듈 통합 |
| MOD | `crawler/requirements.txt` | pykrx 추가 |
| NEW | `supabase/migrations/003_asset_prices.sql` | 가격 이력 테이블 |
| MOD | `frontend/lib/queries.ts` | 신규 쿼리 6개 |
| MOD | `frontend/lib/types.ts` | 신규 타입 |
| NEW | `frontend/components/dashboard/hit-rate-card.tsx` | 적중률 카드 |
| NEW | `frontend/components/dashboard/hit-rate-ranking.tsx` | 적중률 랭킹 |
| NEW | `frontend/components/dashboard/trend-alert.tsx` | 급등 언급 |
| NEW | `frontend/components/dashboard/contrarian-index.tsx` | 역발상 지표 |
| NEW | `frontend/components/dashboard/divided-opinions.tsx` | 의견 갈림 |
| NEW | `frontend/components/charts/profile-radar.tsx` | 성향 레이더 |
| MOD | `frontend/app/page.tsx` | 대시보드 통합 |
| MOD | `frontend/app/channels/[id]/page.tsx` | 적중률+레이더 추가 |
| MOD | `frontend/app/assets/[code]/page.tsx` | 의견 매트릭스 확장 |
| MOD | `frontend/app/trends/page.tsx` | 트렌드 알림 추가 |

---

> PDCA Phase: Plan ✅ → **Design** ✅ → Do → Check → Act
> Next: `/pdca do moneytech-enhancement`
