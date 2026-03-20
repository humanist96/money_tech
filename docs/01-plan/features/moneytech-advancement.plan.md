# MoneyTech 고도화 전략 Plan

## 1. 프로젝트 현황 분석

### 1.1 코드베이스 구조

```
money_tech/
  frontend/          # Next.js 16 + React 19 + Tailwind + shadcn/ui + Recharts
    app/             # 12 pages (dashboard, channels, trends, search, leaderboard, etc.)
    components/      # ~50 components (dashboard/, charts/, features/, ui/)
    lib/             # db.ts, queries.ts(1465L), types.ts(653L), utils.ts
  crawler/           # Python 3.12 + psycopg2 + yt-dlp
    main.py          # YouTube crawler
    blog_crawler.py  # Naver Blog crawler
    telegram_crawler.py  # Telegram crawler
    report_crawler.py    # Analyst report crawler
    discussion_crawler.py  # Naver discussion crawler
    evaluate.py      # Price collection + prediction evaluation pipeline
    discover.py      # Creator auto-discovery pipeline
    asset_dictionary.py  # NLP: asset recognition + sentiment analysis
    prediction_detector.py  # NLP: buy/sell/hold detection
    ...20+ Python files
  supabase/migrations/  # 7 migration files (DDL)
  .github/workflows/    # crawl.yml (6h cron), discover.yml (weekly)
  extension/            # Chrome extension (cookie export)
```

### 1.2 데이터 파이프라인 현황

```
[5 Platforms]                    [NLP Pipeline]               [Evaluation]
YouTube (30 videos/ch)    -->    Asset Detection      -->     Price Collection
Naver Blog (15 posts/ch) -->    Sentiment Analysis   -->     Direction Evaluation (1w/1m/3m)
Telegram (50 msgs/ch)    -->    Prediction Detection -->     Channel Hit Rate
Analyst Reports (3 pages) -->   Summary Generation   -->     Channel Classification
Naver Discussion (3 pages)->    Crowd Sentiment      -->     Comment Analysis

[Scheduling]
- Crawl: Every 6 hours (GitHub Actions)
- Discovery: Every Monday (auto-register creators)
- Evaluate: Post-crawl (price + accuracy)
```

### 1.3 프론트엔드 페이지 맵

| Page | Description | Data Source |
|------|-------------|-------------|
| `/` | Dashboard (12 sections, drag-editable) | 12 parallel queries |
| `/channels` | Channel list + category/platform filter | getChannels() |
| `/channels/[id]` | Channel detail + video list + asset specialty | Multiple queries |
| `/trends` | Keyword cloud + trend charts + category detail | getDailyStats() |
| `/leaderboard` | Hit rate ranking | getHitRateLeaderboard() |
| `/backtest` | Creator backtesting simulator | getBacktestResult() |
| `/search` | YouTube/Blog search + AI analysis | YouTube/Naver API + OpenAI |
| `/consensus` | Asset consensus across platforms | getAssetConsensus() |
| `/crowd` | Crowd sentiment dashboard | getCrowdSentiment() |
| `/signals` | Risk scoreboard + contrarian signals | getRiskScores() |
| `/briefing` | Daily briefing | getDailyBriefing() |
| `/weekly-report` | Weekly winner/loser report | getWeeklyReport() |
| `/compare` | Channel comparison | getChannelComparison() |
| `/hidden-gems` | Undiscovered high-hit-rate creators | getHiddenGems() |
| `/portfolio` | My portfolio (watchlist) | getPortfolioAnalysis() |
| `/notebook` | NotebookLM integration | NotebookLM API |
| `/assets/[code]` | Asset detail page | getAssetTimeline() |

---

## 2. 강점 분석

### 2.1 아키텍처 강점

1. **5-플랫폼 크로스 데이터 수집**: YouTube, Blog, Telegram, Analyst Report, Discussion 5개 플랫폼에서 동시 수집하는 것은 국내 유일한 수준의 커버리지
2. **방향성 예측 적중률 시스템**: 1주/1개월/3개월 가중 평균 기반 direction_score는 독창적이고 실용적
3. **자동 크리에이터 발굴**: 주간 자동 발굴 + 점수 기반 자동 등록은 데이터 파이프라인의 자생력 확보
4. **채널 자동 분류**: predictor/leader/analyst/media 4-type 분류는 데이터 활용도 극대화
5. **대시보드 레이아웃 커스터마이징**: 사용자별 섹션 순서/숨김 설정은 좋은 UX
6. **Server Components 활용**: 대시보드 데이터를 서버에서 parallel fetch하여 성능 최적화

### 2.2 기능 강점

1. 역발상 시그널 (Contrarian Signal): 과도한 합의시 경고
2. 크리에이터 백테스팅: 크리에이터의 과거 예측을 시뮬레이션
3. 버즈 알림: 급증하는 언급 감지
4. 군중 심리 분석: 네이버 종목토론방 감성 수집
5. 애널리스트 리포트 통합: 증권사 목표가/투자의견 자동 수집

---

## 3. 약점 및 기술 부채 분석

### 3.1 CRITICAL 이슈

| # | 문제 | 위치 | 영향 |
|---|------|------|------|
| C1 | **queries.ts 1465줄 단일 파일** | `frontend/lib/queries.ts` | 유지보수 불가, 함수 50개 이상 혼재 |
| C2 | **NLP 정확도 한계 (키워드 매칭 방식)** | `crawler/asset_dictionary.py`, `prediction_detector.py` | 감성분석/예측감지가 단순 키워드 카운팅, 문맥 무시, false positive 다수 |
| C3 | **DB 연결 매번 새로 생성** | `crawler/*.py` (모든 get_conn() 호출) | 커넥션 풀링 없음, 성능 저하 |
| C4 | **NLP 로직 중복** | `main.py`, `blog_crawler.py`, `telegram_crawler.py`, `report_crawler.py` | 4곳에서 동일한 NLP 파이프라인 복붙, DRY 위반 |
| C5 | **에러 핸들링 구멍** | 모든 크롤러 | except Exception + print로 에러 삼킴, 실패 추적 불가 |
| C6 | **테스트 코드 0%** | 전체 | 테스트 파일 없음 (test_full.py, test_notebooklm.py는 수동 스크립트) |
| C7 | **force-dynamic 남용** | `frontend/app/page.tsx` 등 | 모든 페이지가 SSR, 캐싱 전무 |

### 3.2 HIGH 이슈

| # | 문제 | 위치 | 영향 |
|---|------|------|------|
| H1 | **타입 안전성 부족** | `dashboard-content.tsx` | props에 `any[]` 다수, 런타임 에러 위험 |
| H2 | **API Rate Limit 취약** | `crawler/youtube.py` | YouTube API 할당량 초과시 전체 크롤 실패 |
| H3 | **실시간 업데이트 없음** | Frontend 전체 | 6시간마다 크롤, 사이 데이터 stale |
| H4 | **인증/권한 없음** | Frontend 전체 | 누구나 접근 가능, premium 기능 불가 |
| H5 | **모바일 대응 미흡** | UI 전반 | 대시보드 복잡한 레이아웃이 모바일에서 깨짐 가능 |
| H6 | **asset_dictionary.py 하드코딩** | `crawler/asset_dictionary.py` | 200+개 종목/코인을 소스코드에 직접 관리, 변경시 재배포 필요 |
| H7 | **Neon DB 단일 리전** | 인프라 | 싱가포르 단일 리전, 한국 사용자 latency |

### 3.3 MEDIUM 이슈

| # | 문제 | 영향 |
|---|------|------|
| M1 | DB migration 파일 중복 (006 두 개) | 스키마 관리 혼란 |
| M2 | `videos` 테이블에 모든 플랫폼 데이터 혼재 | YouTube/Blog/Telegram/Report가 같은 테이블, nullable 컬럼 과다 |
| M3 | Frontend 컴포넌트 크기 불균형 | 일부 컴포넌트 300줄 이상 |
| M4 | 환경변수 관리 분산 | .env, Vercel, GitHub Secrets 3곳 분산 |
| M5 | OpenAI API 직접 호출 | `search/analyze` 라우트에서 직접 호출, 추상화 없음 |

---

## 4. 고도화 로드맵

### Phase 1: 기술 부채 해소 (1-2주)

#### 1.1 queries.ts 분리 (C1)
```
frontend/lib/queries/
  index.ts          # re-export all
  channels.ts       # getChannels, getChannelById, etc.
  videos.ts         # getRecentVideos, getRecentVideosWithAssets
  predictions.ts    # getRecentPredictions, getHitRateLeaderboard
  assets.ts         # getAssetConsensus, getAssetMentions, getAssetTimeline
  dashboard.ts      # getMarketSentimentGauge, getBuzzAlerts, etc.
  analytics.ts      # getBacktestResult, getRiskScores, getWeeklyReport
  crowd.ts          # getCrowdSentiment
  search.ts         # search-related queries
```

#### 1.2 크롤러 NLP 파이프라인 통합 (C4)
```python
# crawler/nlp_pipeline.py (신규)
class NLPPipeline:
    def process(self, content: ContentItem) -> NLPResult:
        assets = find_assets_in_text(content.text)
        sentiment = analyze_sentiment(content.text)
        predictions = detect_predictions(content.text, assets, content.platform)
        summary = generate_summary(content.title, assets, sentiment)
        return NLPResult(assets, sentiment, predictions, summary)

    def store_results(self, cur, conn, vid_uuid, channel_uuid, result, published_at):
        # 4곳에서 중복된 DB 저장 로직을 1곳으로
```

#### 1.3 DB 커넥션 풀링 (C3)
```python
# crawler/db.py (신규)
from psycopg2.pool import ThreadedConnectionPool

pool = ThreadedConnectionPool(minconn=2, maxconn=10, dsn=DATABASE_URL)

@contextmanager
def get_conn():
    conn = pool.getconn()
    try:
        yield conn
    finally:
        pool.putconn(conn)
```

#### 1.4 에러 핸들링 강화 (C5)
```python
# crawler/logger.py (신규)
import logging
import json

logger = logging.getLogger("moneytech")

class CrawlError:
    def __init__(self, platform, channel, error, severity):
        ...

# 크롤러 실패시 DB에 에러 로그 기록
# GitHub Actions에서 실패 알림 (Slack/Discord webhook)
```

#### 1.5 타입 안전성 강화 (H1)
- `dashboard-content.tsx`의 `any[]` 타입을 모두 명시적 타입으로 교체
- Zod 도입하여 API response validation

### Phase 2: NLP 고도화 (2-3주)

#### 2.1 LLM 기반 NLP로 전환 (C2)
현재 키워드 매칭 방식의 한계를 LLM으로 극복:

```python
# crawler/nlp/llm_analyzer.py
class LLMAnalyzer:
    """OpenAI/Claude API 기반 NLP 분석"""

    def analyze_content(self, text: str) -> dict:
        """
        Returns:
        {
            "assets": [{"name": "삼성전자", "code": "005930", "type": "stock"}],
            "sentiment": {"overall": "positive", "score": 0.8},
            "predictions": [{"asset": "삼성전자", "direction": "buy", "confidence": 0.7, "reason": "..."}],
            "key_points": ["...", "..."],
            "summary": "..."
        }
        """
```

**전환 전략**:
1. 기존 키워드 방식을 "fast path"로 유지 (비용 0)
2. 새 콘텐츠 중 중요도 높은 것만 LLM 분석 (비용 제어)
3. LLM 결과를 학습 데이터로 축적하여 향후 fine-tuned 모델 전환

**비용 추정**: GPT-4o-mini 기준 콘텐츠 1건 ~$0.002, 일 200건 = ~$0.4/day

#### 2.2 자산 사전 DB화 (H6)
```sql
CREATE TABLE asset_dictionary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_name TEXT NOT NULL,
    asset_code TEXT NOT NULL,
    asset_type TEXT NOT NULL,
    aliases TEXT[],  -- ["삼전", "삼성", "005930"]
    market TEXT,     -- "KOSPI", "KOSDAQ", "NYSE", "BINANCE"
    is_active BOOLEAN DEFAULT true,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```
- Admin UI에서 자산 사전 관리 가능
- 종목 상폐/신규상장 자동 반영

### Phase 3: 성능 최적화 (1-2주)

#### 3.1 캐싱 전략 (C7)
```typescript
// Next.js 16 cache + revalidation
// frontend/app/page.tsx
export const revalidate = 300 // 5분 캐시

// 또는 세밀한 제어:
import { unstable_cache } from 'next/cache'

const getCachedDashboardData = unstable_cache(
  getDashboardData,
  ['dashboard'],
  { revalidate: 300 }
)
```

#### 3.2 DB 쿼리 최적화
- queries.ts의 복잡한 서브쿼리를 Materialized View로 전환:
```sql
CREATE MATERIALIZED VIEW mv_asset_consensus AS
  SELECT ... (현재 getAssetConsensus의 SQL)
  ...;

-- 크롤 완료 후 자동 REFRESH
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_asset_consensus;
```

#### 3.3 Incremental Static Regeneration
- `/channels` 페이지: ISR 1시간
- `/trends` 페이지: ISR 30분
- `/leaderboard` 페이지: ISR 1시간

### Phase 4: 사용자 경험 개선 (2-3주)

#### 4.1 인증 시스템 (H4)
```
Auth Provider: NextAuth.js v5
  - Google OAuth
  - Kakao OAuth
  - Email/Password

User Tiers:
  Free:    Dashboard, Channels, Trends (기본)
  Pro:     Backtest, Signals, Briefing, Portfolio, API Access
  Premium: NotebookLM, Custom Alerts, Export
```

#### 4.2 실시간 알림 시스템 (H3)
```
[Crawler] --webhook--> [Next.js API Route] --SSE/WebSocket--> [Client]

알림 유형:
- 버즈 급증 (특정 자산 멘션 급증)
- 새 예측 (관심 채널의 새 예측)
- 적중률 변동 (관심 채널의 적중률 업데이트)
- 역발상 시그널 발생
```

#### 4.3 모바일 반응형 개선 (H5)
- 대시보드: 1열 스택 레이아웃 (모바일)
- 네비게이션: Bottom Tab Bar (모바일)
- 차트: 터치 친화적 인터랙션
- PWA 지원 (manifest.json + service worker)

#### 4.4 개인화
- 관심 종목 watchlist
- 관심 채널 팔로우
- 맞춤 대시보드 (관심 종목 중심)
- 포트폴리오 기반 알림

### Phase 5: 차별화 신규 기능 (3-4주)

#### 5.1 AI 투자 비서 (Chatbot)
```
사용자: "삼성전자 지금 사도 될까?"

AI 응답:
- 최근 30일 크리에이터 의견 종합 (매수 12, 매도 3, 관망 5)
- 적중률 상위 채널의 의견: A채널(78%) 매수, B채널(65%) 관망
- 증권사 리포트: 평균 목표가 87,000원 (현재가 대비 +15%)
- 군중 심리: 강세 63%, 약세 37%
- 리스크 점수: 45/100 (보통)
- 종합 의견: 적중률 상위 채널 대부분 매수 의견, 단 과열 구간 주의
```

구현:
- OpenAI Assistants API 또는 Claude API
- RAG: 자체 DB의 예측/감성/적중률 데이터를 context로 제공
- 자산별 pre-computed summary를 캐시하여 응답 속도 확보

#### 5.2 크리에이터 신뢰도 리포트 자동 생성
```
[채널명] 월간 신뢰도 리포트
- 이달 예측 15건: 적중 10건, 오류 3건, 미확정 2건
- 강점 자산: 반도체 (적중률 80%)
- 약점 자산: 코인 (적중률 30%)
- 예측 패턴: 강한 상승세에서 매수 추천 경향 (추세추종형)
- 과거 유사 시장에서의 적중률 비교
```

#### 5.3 크로스 플랫폼 의견 충돌 감지
```
"삼성전자" 의견 충돌 감지!
- YouTube 크리에이터: 매수 우세 (75%)
- 블로그 전문가: 관망 우세 (60%)
- 애널리스트 리포트: 매수 (목표가 상향)
- 네이버 토론방: 약세 (62%)

-> 크리에이터 vs 군중 심리 괴리 발생: 과거 이런 경우 1개월 후 +3.2% 상승
```

#### 5.4 예측 트래커 (Prediction Tracker)
- 사용자가 특정 예측을 "구독"
- 1주/1개월/3개월 후 결과 자동 알림
- "이 크리에이터가 삼성전자 매수 추천했는데, 지금 +5.2% 수익 중"

#### 5.5 시장 레짐 감지
```python
class MarketRegimeDetector:
    """감성 데이터 기반 시장 레짐 분류"""

    def detect(self) -> str:
        # 감성 극단값 + 멘션 급증 + 역발상 시그널 조합
        # Returns: "극도 낙관", "낙관", "중립", "비관", "극도 비관", "전환 구간"
```

### Phase 6: 수익화 (Phase 4-5와 병행)

#### 6.1 Freemium 모델
| 기능 | Free | Pro ($9.99/mo) | Premium ($29.99/mo) |
|------|------|-------|---------|
| 대시보드 | O | O | O |
| 채널/트렌드 | O | O | O |
| 리더보드 (Top 5) | O | O (전체) | O (전체) |
| 백테스팅 | X | O | O |
| AI 투자 비서 | X | 5회/일 | 무제한 |
| 실시간 알림 | X | 10개 | 무제한 |
| API Access | X | X | O |
| 맞춤 리포트 | X | X | O |
| NotebookLM 통합 | X | X | O |

#### 6.2 B2B 데이터 API
```
/api/v1/predictions?asset=005930&period=30d
/api/v1/consensus?asset=005930
/api/v1/sentiment/history?asset=005930
/api/v1/creators/{id}/accuracy

Rate Limit: 100 req/day (Basic), 10,000 req/day (Enterprise)
```

#### 6.3 제휴 수익
- 증권사 MTS 연동 (크리에이터 적중률 데이터 제공)
- 투자 교육 플랫폼 연계

---

## 5. 실행 우선순위 매트릭스

| Priority | Task | Impact | Effort | Phase |
|----------|------|--------|--------|-------|
| P0 | queries.ts 분리 | High | Low | 1 |
| P0 | NLP 파이프라인 통합 (DRY) | High | Medium | 1 |
| P0 | DB 커넥션 풀링 | High | Low | 1 |
| P1 | 캐싱 전략 (ISR/unstable_cache) | High | Low | 3 |
| P1 | 타입 안전성 강화 | Medium | Low | 1 |
| P1 | 에러 핸들링 + 모니터링 | High | Medium | 1 |
| P2 | LLM NLP 전환 | Very High | High | 2 |
| P2 | 자산 사전 DB화 | Medium | Medium | 2 |
| P2 | 인증 시스템 | High | High | 4 |
| P3 | AI 투자 비서 | Very High | High | 5 |
| P3 | 실시간 알림 | High | Medium | 4 |
| P3 | 크로스플랫폼 충돌 감지 | High | Medium | 5 |
| P4 | 수익화 (Freemium) | Very High | High | 6 |
| P4 | B2B API | High | Medium | 6 |

---

## 6. 기술 스택 고도화 제안

### 현재 -> 목표

| 영역 | 현재 | 목표 |
|------|------|------|
| NLP | 키워드 매칭 | LLM (GPT-4o-mini) + 키워드 fallback |
| Cache | 없음 | Next.js ISR + Redis (향후) |
| Auth | 없음 | NextAuth.js v5 + Kakao/Google OAuth |
| Monitoring | print() | Structured Logging + Sentry |
| DB Pool | 없음 (매번 connect) | psycopg2 ConnectionPool |
| DB Views | 없음 | Materialized Views (consensus, leaderboard) |
| Real-time | 없음 (6h poll) | SSE (Server-Sent Events) |
| Test | 0% | 50%+ (크롤러 단위테스트 + 프론트 E2E) |
| CI/CD | crawl only | crawl + test + lint + deploy |
| Asset Dict | 하드코딩 | DB 기반 + Admin UI |

---

## 7. 비기능 요구사항

### 7.1 성능 목표
- 대시보드 초기 로드: < 2초 (현재 3-5초 추정)
- API 응답 시간: < 500ms (P95)
- 크롤 파이프라인: < 30분/6시간 사이클

### 7.2 안정성 목표
- 크롤 실패율: < 5%
- 데이터 신선도: 최대 6시간 지연 (현재) -> 목표 15분 (Phase 4 이후)
- 에러 추적률: 100% (현재 0%)

### 7.3 확장성 목표
- 채널 수: 현재 ~50 -> 목표 500+
- 일 처리 콘텐츠: 현재 ~200 -> 목표 2,000+
- 동시 사용자: 현재 단일 -> 목표 1,000+

---

## 8. 리스크 및 대응

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| YouTube API 할당량 초과 | High | High | Batch API 활용, 캐시, 우선순위 크롤링 |
| LLM 비용 급증 | Medium | Medium | 비용 상한선 설정, fallback to keyword, 캐시 |
| Neon DB 무료 한도 | Medium | High | 데이터 보관 주기 정책, 유료 전환 계획 |
| Vercel Hobby 한도 | Medium | Medium | Edge Function 최적화, 유료 전환 |
| 네이버 크롤링 차단 | High | Medium | Rate limit 준수, 로테이션, 공식 API 우선 |

---

## Document Info
- Feature: moneytech-advancement
- Phase: Plan
- Created: 2026-03-20
- Author: CTO Lead Agent
