# Plan: YouTube 키워드 검색 기반 분석 요약 서비스

> **Feature**: youtube-keyword-search
> **Created**: 2026-03-07
> **Phase**: Plan
> **Status**: Draft

---

## 1. 목적 (Why)

현재 MoneyTech는 사전 등록된 49개 채널의 영상만 분석한다. 사용자가 특정 키워드(종목명, 이슈 등)를 검색하면 **등록되지 않은 채널의 영상까지 포함**하여 YouTube 전체에서 관련 영상을 찾고, 해당 영상들의 내용을 AI로 분석/요약하여 **실시간 투자 인사이트**를 제공한다.

### 핵심 가치
- 사전 등록 채널에 한정되지 않는 **유튜브 전체 탐색**
- 키워드 기반 **실시간 시장 여론 파악**
- AI 기반 **핵심 내용 요약 + 감성/예측 분석**

---

## 2. 요구사항 (What)

### 2.1 기능 요구사항 (FR)

| ID | 요구사항 | 우선순위 | 설명 |
|----|---------|---------|------|
| FR-01 | 키워드 검색 | P0 | 검색창에 키워드 입력 시 YouTube Search API로 검색 |
| FR-02 | 검색 필터 | P0 | 정렬 기준: relevance(정확도) / date(최신성) 토글 |
| FR-03 | 검색 결과 목록 | P0 | 썸네일, 제목, 채널명, 조회수, 업로드일 카드 형태 |
| FR-04 | 영상 분석 요약 | P0 | 선택한 영상의 자막 추출 → AI 요약 (핵심 내용 3줄) |
| FR-05 | 감성 분석 | P1 | 요약 결과에 긍정/부정/중립 감성 라벨 + 언급 종목 태그 |
| FR-06 | 예측 감지 | P1 | 매수/매도/관망 예측 발언 감지 + 근거 추출 |
| FR-07 | 종합 분석 리포트 | P1 | 검색 결과 상위 N개 영상을 종합 분석한 한 페이지 리포트 |
| FR-08 | 검색 히스토리 | P2 | 최근 검색어 저장 (로컬스토리지) |
| FR-09 | 인기 검색어 | P2 | 다른 사용자들이 많이 검색한 키워드 표시 |
| FR-10 | 기존 채널 연동 | P2 | 검색 결과 중 등록된 채널이면 채널 상세 링크 연결 |

### 2.2 비기능 요구사항 (NFR)

| ID | 요구사항 | 기준 |
|----|---------|------|
| NFR-01 | 검색 응답 시간 | YouTube Search API 호출 < 2초 |
| NFR-02 | AI 분석 응답 시간 | 자막 추출 + AI 요약 < 15초 |
| NFR-03 | API 비용 관리 | YouTube Search API 일일 쿼터 관리 (100 units/search) |
| NFR-04 | AI API 비용 | 요약 1건당 Claude Haiku 사용으로 비용 최소화 |
| NFR-05 | 에러 처리 | 자막 없는 영상은 제목+설명 기반 요약으로 폴백 |

---

## 3. 사용자 시나리오 (User Flow)

```
[검색 페이지 진입]
    │
    ├─ 검색창에 키워드 입력 (예: "삼성전자 실적")
    │
    ├─ 정렬 선택: [정확도순] [최신순]
    │
    ├─ [검색] 버튼 클릭
    │
    ├─ YouTube Search API → 상위 10~20개 결과 표시
    │   ├─ 카드: 썸네일 + 제목 + 채널 + 조회수 + 날짜
    │   └─ 등록된 채널이면 배지 표시 + 링크
    │
    ├─ [개별 분석] 버튼 클릭 → 특정 영상 분석
    │   ├─ 자막 추출 (yt-dlp or YouTube API)
    │   ├─ AI 요약 생성
    │   │   ├─ 핵심 내용 3줄 요약
    │   │   ├─ 언급된 종목/자산 태그
    │   │   ├─ 감성 분석 (긍정/부정/중립)
    │   │   └─ 매수/매도/관망 예측 감지
    │   └─ 분석 결과 카드 표시
    │
    └─ [종합 분석] 버튼 클릭 → 상위 5개 영상 일괄 분석
        ├─ 전체 요약 (유튜버들의 공통 의견)
        ├─ 의견 분포 (긍정/부정 비율)
        ├─ 주요 근거 목록
        └─ 의견 충돌 하이라이트
```

---

## 4. 기술 아키텍처

### 4.1 시스템 구성

```
[Frontend: /search 페이지]
    │
    ├─ /api/search/youtube     ← YouTube Search API v3
    │   └─ 검색 결과 반환 (videoId, title, channelTitle, viewCount, publishedAt)
    │
    ├─ /api/search/analyze     ← 개별 영상 분석
    │   ├─ yt-dlp (자막 추출) or YouTube Captions API
    │   ├─ Claude Haiku API (요약 + 감성 + 예측 감지)
    │   └─ 분석 결과 반환
    │
    └─ /api/search/report      ← 종합 분석 리포트
        ├─ 상위 N개 영상 일괄 자막 추출
        ├─ Claude Haiku API (종합 분석)
        └─ 통합 리포트 반환
```

### 4.2 기술 스택

| 구분 | 기술 | 이유 |
|------|------|------|
| 검색 | YouTube Data API v3 (search.list) | 공식 API, 정확도/최신성 정렬 지원 |
| 자막 추출 | YouTube Captions API / yt-dlp 폴백 | API 우선, 불가시 yt-dlp |
| AI 요약 | Claude Haiku 4.5 | 빠른 응답 + 저비용 (Opus 대비 1/30 비용) |
| 캐싱 | Neon PostgreSQL (search_cache 테이블) | 동일 영상 재분석 방지 |
| 프론트엔드 | Next.js API Routes + React | 기존 스택 활용 |

### 4.3 API 쿼터 관리

YouTube Data API v3 일일 쿼터: **10,000 units**
- search.list: 100 units/call
- videos.list: 1 unit/call
- captions.list: 50 units/call
- 예상 일일 검색 가능 횟수: ~80회 (여유 포함)

**대책**:
- 검색 결과 캐싱 (같은 키워드 1시간 유효)
- AI 분석 결과 DB 캐싱 (동일 videoId 재분석 방지)
- Rate limit: 사용자당 분당 5회 검색 제한

---

## 5. 데이터 모델

### 5.1 신규 테이블

```sql
-- 검색 결과 캐시
CREATE TABLE search_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    keyword TEXT NOT NULL,
    sort_by TEXT NOT NULL DEFAULT 'relevance', -- 'relevance' | 'date'
    results JSONB NOT NULL, -- 검색 결과 배열
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 hour'
);

-- 영상 분석 캐시
CREATE TABLE video_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    youtube_video_id TEXT UNIQUE NOT NULL,
    title TEXT,
    channel_name TEXT,
    channel_id TEXT,
    summary TEXT, -- AI 요약 (3줄)
    sentiment TEXT, -- 'positive' | 'negative' | 'neutral'
    mentioned_assets JSONB, -- [{name, code, type, sentiment}]
    predictions JSONB, -- [{type, asset, reason}]
    key_points JSONB, -- ["핵심포인트1", "핵심포인트2", ...]
    subtitle_text TEXT, -- 원본 자막
    analyzed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인기 검색어 (P2)
CREATE TABLE search_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    keyword TEXT NOT NULL,
    searched_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 6. AI 프롬프트 설계

### 6.1 개별 영상 분석 프롬프트

```
당신은 재테크/투자 콘텐츠 분석 전문가입니다.
아래 유튜브 영상의 자막(또는 제목+설명)을 분석하여 JSON 형식으로 응답하세요.

영상 제목: {title}
채널명: {channel}
자막 내용: {subtitle}

응답 형식:
{
  "summary": "핵심 내용 3줄 요약 (한국어)",
  "sentiment": "positive | negative | neutral",
  "key_points": ["핵심 포인트 1", "핵심 포인트 2", ...],
  "mentioned_assets": [
    {"name": "종목명", "code": "종목코드", "type": "stock|coin|real_estate", "sentiment": "positive|negative|neutral"}
  ],
  "predictions": [
    {"type": "buy|sell|hold", "asset": "종목명", "reason": "근거 요약"}
  ]
}
```

### 6.2 종합 리포트 프롬프트

```
아래는 "{keyword}" 키워드로 검색한 유튜브 영상 {count}개의 분석 결과입니다.
이를 종합하여 투자자를 위한 인사이트 리포트를 작성하세요.

[각 영상 분석 결과 JSON 배열]

응답 형식:
{
  "overall_summary": "전체 요약 (5줄 이내)",
  "consensus": "유튜버들의 공통 의견",
  "sentiment_distribution": {"positive": N, "negative": N, "neutral": N},
  "key_arguments": ["주요 근거 1", "주요 근거 2", ...],
  "conflicts": ["의견 충돌 포인트 1", ...],
  "recommendation": "투자자 참고사항"
}
```

---

## 7. 페이지 레이아웃

```
/search 페이지
┌─────────────────────────────────────────────────────────┐
│  🔍 검색창 [키워드 입력]  [정확도순 | 최신순]  [검색]      │
│  최근 검색: 삼성전자 | 비트코인 | 강남 아파트              │
├─────────────────────────────────────────────────────────┤
│  [종합 분석 리포트 생성] 버튼 (상위 5개 영상 일괄 분석)     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────────────────────────────────────┐       │
│  │ 📹 썸네일  제목                     조회수    │       │
│  │            채널명 · 3일 전           [분석]    │       │
│  └──────────────────────────────────────────────┘       │
│                                                         │
│  ┌──────────────────────────────────────────────┐       │
│  │ 📹 썸네일  제목                     조회수    │       │
│  │            채널명 · 1일 전           [분석]    │       │
│  │  ┌─ 분석 결과 (펼침) ──────────────────────┐ │       │
│  │  │ 요약: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx   │ │       │
│  │  │ 감성: 🟢 긍정                           │ │       │
│  │  │ 종목: [삼성전자] [SK하이닉스]             │ │       │
│  │  │ 예측: 매수 - 삼성전자 (근거: ...)         │ │       │
│  │  └─────────────────────────────────────────┘ │       │
│  └──────────────────────────────────────────────┘       │
│  ...                                                    │
├─────────────────────────────────────────────────────────┤
│  📊 종합 분석 리포트 (종합 분석 클릭 시 표시)               │
│  ┌──────────────────────────────────────────────┐       │
│  │ 전체 요약: xxxxxxxxxxxxxxxxxxxxxxxxxxx        │       │
│  │ 공통 의견: xxxxxxxxxxxxxxxxxxxxxxxxxxx        │       │
│  │ 감성 분포: 🟢 긍정 60% / 🔴 부정 20% / ⚪ 중립 20% │  │
│  │ 주요 근거: 1. xxx  2. xxx  3. xxx             │       │
│  │ 의견 충돌: xxx vs xxx                         │       │
│  └──────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────┘
```

---

## 8. 구현 범위 및 단계

### Phase 1: MVP (P0) - 핵심 기능
- [ ] `/search` 페이지 생성
- [ ] `/api/search/youtube` API (YouTube Search API 연동)
- [ ] 검색 결과 카드 UI (썸네일, 제목, 채널, 조회수)
- [ ] 정렬 토글 (정확도/최신성)
- [ ] `/api/search/analyze` API (자막 추출 + Claude 요약)
- [ ] 개별 영상 분석 결과 표시 UI
- [ ] `video_analysis` 테이블 + 캐싱 로직

### Phase 2: 고도화 (P1)
- [ ] 감성 분석 라벨 + 종목 태그 UI
- [ ] 매수/매도/관망 예측 감지 표시
- [ ] `/api/search/report` API (종합 분석 리포트)
- [ ] 종합 리포트 UI (감성 분포 차트, 의견 충돌)
- [ ] `search_cache` 테이블 + 캐싱

### Phase 3: 부가 기능 (P2)
- [ ] 최근 검색어 (localStorage)
- [ ] 인기 검색어 (`search_log` 테이블)
- [ ] 기존 채널 연동 (등록 채널 배지)

---

## 9. 필요한 환경 변수

| 변수 | 용도 | 비고 |
|------|------|------|
| `YOUTUBE_API_KEY` | YouTube Search API | 이미 설정됨 |
| `ANTHROPIC_API_KEY` | Claude Haiku API 호출 | 신규 추가 필요 |

---

## 10. 리스크 및 대응

| 리스크 | 영향도 | 대응 방안 |
|--------|--------|----------|
| YouTube API 쿼터 초과 | 높음 | 캐싱 + 사용자별 rate limit |
| 자막 없는 영상 | 중간 | 제목+설명 기반 폴백 분석 |
| Claude API 비용 증가 | 중간 | Haiku 사용 + 결과 캐싱 |
| 자막 추출 지연 | 중간 | 비동기 처리 + 로딩 UI |
| 검색 결과 품질 낮음 | 낮음 | 재테크 관련 필터 (videoCategoryId) |

---

## 11. 성공 지표

| 지표 | 목표 |
|------|------|
| 검색 응답 시간 | < 2초 |
| 개별 분석 시간 | < 15초 |
| 분석 요약 정확도 | 사용자 체감 80%+ |
| 일일 검색 횟수 | 쿼터 내 안정적 운영 |
| 캐시 히트율 | 30%+ (반복 검색 절감) |
