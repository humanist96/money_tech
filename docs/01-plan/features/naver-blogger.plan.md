# Plan: 네이버 블로거 콘텐츠 소스 확장

> Feature: `naver-blogger`
> Created: 2026-03-09
> Status: Draft
> Phase: Plan

---

## 1. 배경 (Why)

현재 MoneyTech는 YouTube 채널만을 데이터 소스로 사용한다. 그러나 한국 투자 커뮤니티에서 네이버 블로그는 YouTube만큼 중요한 콘텐츠 플랫폼이다.

- **네이버 블로그**: 텍스트 기반 심층 분석, 차트 캡처, 종목 리포트 등 YouTube와 다른 형태의 콘텐츠
- **블로거 영향력**: 주식/부동산/코인 분야 인기 블로거들은 수만~수십만 구독자 보유
- **데이터 보완**: YouTube는 영상 중심(실시간, 감성), 블로그는 텍스트 중심(분석, 데이터) → 교차 분석 가능

### 핵심 목표
1. 네이버 인기 블로거 콘텐츠를 수집하여 기존 YouTube 데이터와 통합
2. 블로거/유튜버 구분을 유지하면서 동일한 분석 서비스 제공 (예측, 적중률, 컨센서스)
3. 크로스 플랫폼 인사이트 제공 (같은 종목에 대해 유튜버 vs 블로거 의견 비교)

---

## 2. 요구사항 (What)

### 2.1 기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| FR-01 | 네이버 블로그 포스트 수집 (RSS/크롤링) | P0 |
| FR-02 | 블로거 프로필 관리 (채널과 유사한 구조) | P0 |
| FR-03 | 포스트 NLP 분석 (종목 추출, 감성, 예측) | P0 |
| FR-04 | 프론트엔드 블로거 목록/상세 페이지 | P0 |
| FR-05 | 대시보드에 블로거 데이터 통합 | P1 |
| FR-06 | 리더보드에 블로거 적중률 포함 | P1 |
| FR-07 | 컨센서스에 블로거 의견 통합 | P1 |
| FR-08 | 유튜버 vs 블로거 교차 비교 뷰 | P2 |
| FR-09 | 블로거 포스트 댓글 감성분석 | P2 |

### 2.2 비기능 요구사항

| ID | 요구사항 |
|----|----------|
| NFR-01 | 네이버 크롤링 rate limiting (1req/2sec 이하) |
| NFR-02 | 기존 YouTube 파이프라인에 영향 없음 |
| NFR-03 | 플랫폼 구분 필드로 확장 가능한 설계 (향후 X/커뮤니티 등) |
| NFR-04 | 블로거 50명 이상 커버 가능한 스케일 |

---

## 3. 기술 분석 (How)

### 3.1 데이터 수집 방법

**Option A: 네이버 블로그 RSS (권장)**
- 각 블로거의 RSS 피드: `https://rss.blog.naver.com/{blogId}.xml`
- 장점: 안정적, rate limit 관대, 구조화된 데이터
- 단점: 본문 일부만 제공 (요약)

**Option B: 네이버 검색 API + 블로그 크롤링**
- 네이버 오픈 API로 블로그 검색 → 개별 포스트 크롤링
- 장점: 전문(full text) 수집 가능
- 단점: API 일일 호출 한도 (25,000건), 크롤링 차단 가능성

**Option C: RSS + 개별 포스트 크롤링 (하이브리드, 채택)**
- RSS로 신규 포스트 감지 → 개별 포스트 URL로 전문 크롤링
- BeautifulSoup으로 본문 텍스트 추출
- 장점: 전문 수집 + 안정적 감지
- 단점: 크롤링 로직 유지보수 필요

### 3.2 DB 스키마 확장

```sql
-- 기존 channels 테이블에 platform 필드 추가
ALTER TABLE channels ADD COLUMN platform VARCHAR(20) DEFAULT 'youtube';
-- 'youtube', 'naver_blog', 'x' 등

-- 블로거 전용 필드 (기존 channels 테이블 재사용)
-- youtube_channel_id → blog_id로 활용 (또는 별도 필드)
ALTER TABLE channels ADD COLUMN blog_id VARCHAR(100);
ALTER TABLE channels ADD COLUMN blog_url VARCHAR(500);

-- 기존 videos 테이블을 posts로 확장 (또는 재사용)
-- youtube_video_id → blog_post_id로 활용 (또는 별도 필드)
ALTER TABLE videos ADD COLUMN platform VARCHAR(20) DEFAULT 'youtube';
ALTER TABLE videos ADD COLUMN blog_post_url VARCHAR(500);
ALTER TABLE videos ADD COLUMN content_text TEXT; -- 블로그 본문 (자막 대신)
```

### 3.3 아키텍처

```
[기존 YouTube 파이프라인]          [새 블로그 파이프라인]
crawler/main.py                   crawler/blog_crawler.py
  ↓                                 ↓
crawler/youtube.py                crawler/naver_blog.py
  ↓                                 ↓
  └──────── 공유 ────────────────────┘
            ↓
    crawler/asset_dictionary.py  (종목 추출)
    crawler/prediction_detector.py (예측 감지)
    crawler/comment_analyzer.py   (감성분석)
            ↓
    Neon PostgreSQL (channels, videos, predictions...)
            ↓
    frontend/ (통합 UI)
```

### 3.4 프론트엔드 변경

1. **채널 목록 (`/channels`)**: 플랫폼 필터 추가 (전체 | YouTube | 블로그)
2. **채널 상세 (`/channels/[id]`)**: 블로거인 경우 포스트 목록 표시
3. **리더보드 (`/leaderboard`)**: 플랫폼 배지 추가 (YT/Blog)
4. **컨센서스 (`/consensus`)**: 레퍼런스에 블로그 포스트 포함
5. **대시보드 (`/`)**: 통합 피드에 블로그 포스트 혼합

---

## 4. 구현 범위 및 단계

### Phase 1: 인프라 (P0)
- [ ] DB 스키마 확장 (platform, blog_id 등)
- [ ] `crawler/naver_blog.py` - RSS 파싱 + 포스트 크롤링
- [ ] `crawler/bloggers.json` - 대상 블로거 목록
- [ ] `crawler/blog_crawler.py` - 메인 크롤링 엔트리포인트

### Phase 2: 분석 파이프라인 (P0)
- [ ] 블로그 포스트 NLP 분석 (기존 asset_dictionary, prediction_detector 재사용)
- [ ] 블로거 분류 (predictor, analyst 등)
- [ ] 적중률 평가 연동

### Phase 3: 프론트엔드 통합 (P0~P1)
- [ ] 채널 목록에 플랫폼 필터/배지
- [ ] 대시보드 통합 피드
- [ ] 리더보드/컨센서스 통합

### Phase 4: 고급 기능 (P2)
- [ ] 유튜버 vs 블로거 비교 뷰
- [ ] 블로그 댓글 감성분석
- [ ] 교차 플랫폼 인사이트

---

## 5. 리스크 및 제약

| 리스크 | 영향 | 대응 |
|--------|------|------|
| 네이버 크롤링 차단 | 데이터 수집 불가 | RSS 우선, User-Agent 로테이션, 속도 제한 |
| 블로그 본문 파싱 실패 | 분석 품질 저하 | 다중 파서 + fallback (RSS 요약 사용) |
| 기존 스키마 변경 충돌 | 서비스 중단 | 하위호환 유지 (DEFAULT 값, NULL 허용) |
| 블로거 콘텐츠 저작권 | 법적 이슈 | 요약만 표시, 원문 링크 제공, robots.txt 준수 |

---

## 6. 성공 지표

- [ ] 블로거 30명 이상 수집 및 분석
- [ ] 블로그 포스트 수집 성공률 > 90%
- [ ] 기존 YouTube 서비스 무중단
- [ ] 리더보드/컨센서스에 블로거 데이터 통합 완료
