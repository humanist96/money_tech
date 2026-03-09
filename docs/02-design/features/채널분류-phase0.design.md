# Phase 0: 채널 분류 인프라 - 상세 설계

> PDCA Phase: **Design**
> Feature: 추가컨텐츠 Phase 0 - 채널 분류
> Created: 2026-03-09
> Status: Draft

---

## 구현 대상 (6개 작업)

| 순서 | 작업 | 파일 | 신규/수정 |
|------|------|------|----------|
| 0-1 | DB 스키마 변경 | `supabase/migrations/005_channel_classification.sql` | 신규 |
| 0-2 | 목표가 패턴 추가 | `crawler/prediction_detector.py` | 수정 |
| 0-3 | 채널 분류기 | `crawler/channel_classifier.py` | 신규 |
| 0-4 | 일괄 분류 스크립트 | `crawler/classify_channels.py` | 신규 |
| 0-5 | 크롤러 통합 | `crawler/main.py` | 수정 |
| 0-6 | 프론트엔드 연동 | `frontend/` 다수 | 수정 |

---

## 0-1. DB 스키마 변경

### 마이그레이션 SQL

```sql
-- 005_channel_classification.sql

-- 채널 분류 필드 추가
ALTER TABLE channels ADD COLUMN IF NOT EXISTS channel_type VARCHAR(20) DEFAULT 'unknown';
ALTER TABLE channels ADD COLUMN IF NOT EXISTS prediction_intensity_score REAL DEFAULT 0;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS classification_updated_at TIMESTAMPTZ;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS classification_details JSONB;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_channels_type ON channels(channel_type);
CREATE INDEX IF NOT EXISTS idx_channels_pis ON channels(prediction_intensity_score DESC);

-- channel_type 체크
ALTER TABLE channels ADD CONSTRAINT chk_channel_type
  CHECK (channel_type IN ('predictor', 'leader', 'analyst', 'media', 'unknown'));

COMMENT ON COLUMN channels.channel_type IS '채널 유형: predictor(예측형), leader(리딩방), analyst(해설형), media(미디어), unknown(미분류)';
COMMENT ON COLUMN channels.prediction_intensity_score IS 'PIS 점수 0~100. 60+: predictor, 80+: leader, 25~60: analyst, <25: media';
```

### classification_details JSONB 스키마

```json
{
  "p1_density": 72.5,
  "p2_action_intensity": 85.0,
  "p3_concentration": 65.3,
  "p4_price_target": 45.0,
  "p5_sentiment_bias": 78.2,
  "total_videos_analyzed": 30,
  "total_predictions_found": 22,
  "period_start": "2026-02-08",
  "period_end": "2026-03-09",
  "top_action_keywords": ["사세요", "매수", "목표가", "들어가세요"],
  "top_assets": ["삼성전자", "SK하이닉스", "비트코인"]
}
```

---

## 0-2. 목표가 패턴 추가 (prediction_detector.py 확장)

### 현재 상태

```python
# 기존: BUY_PATTERNS (21개), SELL_PATTERNS (20개), HOLD_PATTERNS (12개)
# 문제: 목표가/가격 타겟 패턴이 없음
```

### 추가 패턴

```python
# prediction_detector.py에 추가

PRICE_TARGET_PATTERNS = [
    # 한국주식 목표가
    r'목표가\s*:?\s*[\d,]+\s*원?',
    r'[\d,]+\s*원\s*(돌파|이탈|지지|저항|도달|달성)',
    r'(TP|타겟|타깃|목표)\s*:?\s*[\d,]+',
    r'(1차|2차|3차)\s*목표\s*:?\s*[\d,]+',

    # 미국주식 목표가
    r'[\d.]+\s*(달러|불|dollar)\s*(돌파|이탈|도달)',
    r'\$\s*[\d,.]+\s*(target|돌파|이탈)',

    # 코인 목표가
    r'[\d,.]+K?\s*(돌파|이탈|지지|저항)',
    r'(저항|지지)선?\s*:?\s*[\d,.]+',

    # 손절/익절 라인
    r'손절\s*:?\s*[\d,]+',
    r'익절\s*:?\s*[\d,]+',
    r'(스탑로스|stop\s*loss)\s*:?\s*[\d,]+',

    # 비율 기반
    r'(수익률|목표|기대)\s*[\d]+\s*%',
]

# 직접적 행동 유도 키워드 (P2 가중치용)
DIRECT_ACTION_KEYWORDS = [
    # 2배 가중치 - 직접 명령형
    ("사세요", 2), ("팔으세요", 2), ("들어가세요", 2),
    ("빠지세요", 2), ("손절하세요", 2), ("담으세요", 2),
    ("지금 바로", 2), ("즉시 매수", 2), ("즉시 매도", 2),

    # 1.5배 가중치 - 강한 추천
    ("매수", 1.5), ("매도", 1.5), ("목표가", 1.5),
    ("진입", 1.5), ("탈출", 1.5), ("적극 추천", 1.5),
    ("강력 추천", 1.5), ("손절가", 1.5), ("익절가", 1.5),
]


def has_price_target(text: str) -> bool:
    """텍스트에 목표가/가격 타겟이 있는지 검사."""
    import re
    return any(re.search(p, text) for p in PRICE_TARGET_PATTERNS)


def count_price_targets(text: str) -> int:
    """텍스트 내 목표가 패턴 매칭 수."""
    import re
    return sum(1 for p in PRICE_TARGET_PATTERNS if re.search(p, text))


def count_action_keywords(text: str) -> float:
    """가중치 적용한 행동 키워드 점수."""
    score = 0.0
    for keyword, weight in DIRECT_ACTION_KEYWORDS:
        if keyword in text:
            score += weight
    return score
```

### 기존 함수 영향

`detect_predictions()` 함수는 변경 없음 — 새 함수들은 채널 분류기에서만 사용.

---

## 0-3. 채널 분류기 (channel_classifier.py)

### 클래스 설계

```python
"""
channel_classifier.py - 채널 PIS(Prediction Intensity Score) 산출 및 분류

사용법:
  classifier = ChannelClassifier(db_conn)
  result = classifier.classify_channel(channel_id, days=30)
  # result = {"channel_type": "predictor", "pis": 72.5, "details": {...}}
"""

import re
import psycopg2
from prediction_detector import (
    BUY_PATTERNS, SELL_PATTERNS, HOLD_PATTERNS,
    PRICE_TARGET_PATTERNS, DIRECT_ACTION_KEYWORDS,
    has_price_target, count_action_keywords,
)


# === 설정 ===

PIS_WEIGHTS = {
    "p1_density": 0.30,
    "p2_action_intensity": 0.25,
    "p3_concentration": 0.20,
    "p4_price_target": 0.15,
    "p5_sentiment_bias": 0.10,
}

THRESHOLDS = {
    "leader_min": 80,
    "predictor_min": 60,
    "analyst_min": 25,
    # media: < 25
}

# 리딩방 추가 조건
LEADER_TITLE_PATTERNS = [
    "실시간", "라이브", "리딩", "매매일지", "오늘의 종목",
    "종목 추천", "급등주", "단타", "데이트레이딩",
]


class ChannelClassifier:
    def __init__(self, conn):
        self.conn = conn

    def classify_channel(self, channel_id: str, days: int = 30) -> dict:
        """단일 채널 분류. channel_id는 UUID."""
        videos = self._get_recent_videos(channel_id, days)
        if not videos:
            return {"channel_type": "unknown", "pis": 0, "details": {}}

        p1 = self._calc_prediction_density(channel_id, videos)
        p2 = self._calc_action_intensity(videos)
        p3 = self._calc_asset_concentration(channel_id, days)
        p4 = self._calc_price_target_freq(videos)
        p5 = self._calc_sentiment_bias(channel_id, days)

        pis = (
            p1 * PIS_WEIGHTS["p1_density"]
            + p2 * PIS_WEIGHTS["p2_action_intensity"]
            + p3 * PIS_WEIGHTS["p3_concentration"]
            + p4 * PIS_WEIGHTS["p4_price_target"]
            + p5 * PIS_WEIGHTS["p5_sentiment_bias"]
        )

        channel_type = self._determine_type(pis, channel_id, videos)

        details = {
            "p1_density": round(p1, 1),
            "p2_action_intensity": round(p2, 1),
            "p3_concentration": round(p3, 1),
            "p4_price_target": round(p4, 1),
            "p5_sentiment_bias": round(p5, 1),
            "total_videos_analyzed": len(videos),
            "period_start": str(min(v["published_at"] for v in videos).date()) if videos else None,
            "period_end": str(max(v["published_at"] for v in videos).date()) if videos else None,
        }

        return {
            "channel_type": channel_type,
            "pis": round(pis, 1),
            "details": details,
        }

    # --- P1: 예측 밀도 ---

    def _calc_prediction_density(self, channel_id: str, videos: list) -> float:
        """예측이 1개+ 있는 영상 비율 (0~100)"""
        if not videos:
            return 0.0

        video_ids = [v["id"] for v in videos]
        placeholders = ",".join(["%s"] * len(video_ids))

        with self.conn.cursor() as cur:
            cur.execute(f"""
                SELECT COUNT(DISTINCT video_id)
                FROM predictions
                WHERE video_id IN ({placeholders})
                  AND channel_id = %s
            """, video_ids + [channel_id])
            videos_with_pred = cur.fetchone()[0]

        return min((videos_with_pred / len(videos)) * 100, 100)

    # --- P2: 행동 키워드 강도 ---

    def _calc_action_intensity(self, videos: list) -> float:
        """영상당 평균 행동 키워드 점수 (0~100, cap)"""
        if not videos:
            return 0.0

        scores = []
        for v in videos:
            text = (v.get("title") or "") + " " + (v.get("subtitle_text") or "")
            score = count_action_keywords(text)
            # 기본 BUY/SELL 패턴도 카운트 (가중치 1)
            score += sum(1 for p in BUY_PATTERNS if p in text)
            score += sum(1 for p in SELL_PATTERNS if p in text)
            scores.append(score)

        avg_score = sum(scores) / len(scores)
        # 정규화: 0~20 → 0~100
        return min(avg_score * 5, 100)

    # --- P3: 종목 집중도 ---

    def _calc_asset_concentration(self, channel_id: str, days: int) -> float:
        """상위 5개 종목 언급 비율 (0~100)"""
        with self.conn.cursor() as cur:
            cur.execute("""
                SELECT ma.asset_name, COUNT(*) as cnt
                FROM mentioned_assets ma
                JOIN videos v ON v.id = ma.video_id
                WHERE v.channel_id = %s
                  AND v.published_at >= NOW() - INTERVAL '%s days'
                GROUP BY ma.asset_name
                ORDER BY cnt DESC
            """, (channel_id, days))
            rows = cur.fetchall()

        if not rows:
            return 0.0

        total = sum(r[1] for r in rows)
        top5 = sum(r[1] for r in rows[:5])

        return min((top5 / total) * 100, 100) if total > 0 else 0.0

    # --- P4: 목표가 빈도 ---

    def _calc_price_target_freq(self, videos: list) -> float:
        """목표가 패턴이 있는 영상 비율 (0~100)"""
        if not videos:
            return 0.0

        count = 0
        for v in videos:
            text = (v.get("title") or "") + " " + (v.get("subtitle_text") or "")
            if has_price_target(text):
                count += 1

        return (count / len(videos)) * 100

    # --- P5: 감성 편향도 ---

    def _calc_sentiment_bias(self, channel_id: str, days: int) -> float:
        """|긍정% - 부정%| 평균 (0~100)"""
        with self.conn.cursor() as cur:
            cur.execute("""
                SELECT
                  COUNT(*) FILTER (WHERE ma.sentiment = 'positive') as pos,
                  COUNT(*) FILTER (WHERE ma.sentiment = 'negative') as neg,
                  COUNT(*) as total
                FROM mentioned_assets ma
                JOIN videos v ON v.id = ma.video_id
                WHERE v.channel_id = %s
                  AND v.published_at >= NOW() - INTERVAL '%s days'
            """, (channel_id, days))
            row = cur.fetchone()

        if not row or row[2] == 0:
            return 0.0

        pos_pct = (row[0] / row[2]) * 100
        neg_pct = (row[1] / row[2]) * 100

        return min(abs(pos_pct - neg_pct), 100)

    # --- 유형 결정 ---

    def _determine_type(self, pis: float, channel_id: str, videos: list) -> str:
        """PIS + 추가 조건으로 최종 유형 결정"""
        if pis >= THRESHOLDS["leader_min"]:
            # 리딩방 추가 검증: 제목에 리딩 패턴 + 높은 업로드 빈도
            if self._has_leader_signals(videos):
                return "leader"
            return "predictor"

        if pis >= THRESHOLDS["predictor_min"]:
            return "predictor"

        if pis >= THRESHOLDS["analyst_min"]:
            return "analyst"

        return "media"

    def _has_leader_signals(self, videos: list) -> bool:
        """리딩방 추가 시그널 검사"""
        if not videos:
            return False

        # 제목에 리딩 패턴이 30%+ 있으면 leader
        leader_count = 0
        for v in videos:
            title = v.get("title", "").lower()
            if any(p in title for p in LEADER_TITLE_PATTERNS):
                leader_count += 1

        return (leader_count / len(videos)) >= 0.3

    # --- 유틸리티 ---

    def _get_recent_videos(self, channel_id: str, days: int) -> list:
        """최근 N일간 영상 목록"""
        with self.conn.cursor() as cur:
            cur.execute("""
                SELECT id, title, subtitle_text, published_at, sentiment
                FROM videos
                WHERE channel_id = %s
                  AND published_at >= NOW() - INTERVAL '%s days'
                ORDER BY published_at DESC
            """, (channel_id, days))
            cols = [desc[0] for desc in cur.description]
            return [dict(zip(cols, row)) for row in cur.fetchall()]


def classify_all_channels(conn, days: int = 30) -> list:
    """전체 채널 일괄 분류"""
    classifier = ChannelClassifier(conn)
    results = []

    with conn.cursor() as cur:
        cur.execute("SELECT id, name, category FROM channels ORDER BY name")
        channels = cur.fetchall()

    for ch_id, ch_name, ch_category in channels:
        result = classifier.classify_channel(ch_id, days)

        # DB 업데이트
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE channels SET
                    channel_type = %s,
                    prediction_intensity_score = %s,
                    classification_details = %s,
                    classification_updated_at = NOW()
                WHERE id = %s
            """, (
                result["channel_type"],
                result["pis"],
                psycopg2.extras.Json(result["details"]),
                ch_id,
            ))

        results.append({
            "name": ch_name,
            "category": ch_category,
            **result,
        })

    conn.commit()
    return results
```

### 핵심 SQL 쿼리 (5개)

**Q1: P1 예측 밀도**
```sql
-- 채널의 최근 30일 영상 중 예측이 1개+ 있는 비율
SELECT
  COUNT(DISTINCT v.id) as total_videos,
  COUNT(DISTINCT p.video_id) as videos_with_predictions,
  ROUND(100.0 * COUNT(DISTINCT p.video_id) / NULLIF(COUNT(DISTINCT v.id), 0), 1) as density
FROM videos v
LEFT JOIN predictions p ON p.video_id = v.id
WHERE v.channel_id = $1
  AND v.published_at >= NOW() - INTERVAL '30 days';
```

**Q2: P3 종목 집중도**
```sql
-- 상위 5개 종목의 전체 언급 비율
WITH asset_counts AS (
  SELECT ma.asset_name, COUNT(*) as cnt
  FROM mentioned_assets ma
  JOIN videos v ON v.id = ma.video_id
  WHERE v.channel_id = $1
    AND v.published_at >= NOW() - INTERVAL '30 days'
  GROUP BY ma.asset_name
  ORDER BY cnt DESC
),
totals AS (
  SELECT SUM(cnt) as total, SUM(cnt) FILTER (WHERE rn <= 5) as top5
  FROM (SELECT cnt, ROW_NUMBER() OVER (ORDER BY cnt DESC) as rn FROM asset_counts) sub
)
SELECT ROUND(100.0 * top5 / NULLIF(total, 0), 1) as concentration FROM totals;
```

**Q3: P5 감성 편향도**
```sql
SELECT
  ROUND(ABS(
    100.0 * COUNT(*) FILTER (WHERE ma.sentiment = 'positive') / NULLIF(COUNT(*), 0)
    - 100.0 * COUNT(*) FILTER (WHERE ma.sentiment = 'negative') / NULLIF(COUNT(*), 0)
  ), 1) as bias
FROM mentioned_assets ma
JOIN videos v ON v.id = ma.video_id
WHERE v.channel_id = $1
  AND v.published_at >= NOW() - INTERVAL '30 days';
```

**Q4: 채널 유형별 조회 (프론트엔드)**
```sql
-- predictor/leader 채널만 조회
SELECT id, name, category, channel_type, prediction_intensity_score,
       hit_rate, trust_score, thumbnail_url
FROM channels
WHERE channel_type IN ('predictor', 'leader')
ORDER BY prediction_intensity_score DESC;
```

**Q5: 분류 요약 통계**
```sql
SELECT
  channel_type,
  COUNT(*) as count,
  ROUND(AVG(prediction_intensity_score), 1) as avg_pis,
  ROUND(AVG(hit_rate), 1) as avg_hit_rate
FROM channels
WHERE channel_type != 'unknown'
GROUP BY channel_type
ORDER BY avg_pis DESC;
```

---

## 0-4. 일괄 분류 스크립트 (classify_channels.py)

```python
"""
classify_channels.py - 기존 74개 채널 일괄 분류 + 결과 리포트

실행: python classify_channels.py
"""

import os
import json
import psycopg2
import psycopg2.extras
from channel_classifier import classify_all_channels


def main():
    conn = psycopg2.connect(os.environ["DATABASE_URL"])

    print("=== 채널 분류 시작 ===\n")
    results = classify_all_channels(conn, days=30)

    # 유형별 그룹핑
    groups = {}
    for r in results:
        t = r["channel_type"]
        if t not in groups:
            groups[t] = []
        groups[t].append(r)

    # 리포트 출력
    for ctype in ["leader", "predictor", "analyst", "media", "unknown"]:
        channels = groups.get(ctype, [])
        print(f"\n{'='*50}")
        print(f"  {ctype.upper()} ({len(channels)}개)")
        print(f"{'='*50}")
        for ch in sorted(channels, key=lambda x: -x["pis"]):
            print(f"  {ch['name']:20s}  PIS: {ch['pis']:5.1f}  [{ch['category']}]")
            d = ch["details"]
            print(f"    P1(밀도):{d.get('p1_density',0):5.1f}  "
                  f"P2(행동):{d.get('p2_action_intensity',0):5.1f}  "
                  f"P3(집중):{d.get('p3_concentration',0):5.1f}  "
                  f"P4(목표):{d.get('p4_price_target',0):5.1f}  "
                  f"P5(편향):{d.get('p5_sentiment_bias',0):5.1f}")

    # 요약
    print(f"\n{'='*50}")
    print("  요약")
    print(f"{'='*50}")
    for ctype in ["leader", "predictor", "analyst", "media", "unknown"]:
        count = len(groups.get(ctype, []))
        print(f"  {ctype:12s}: {count}개")

    predictor_count = len(groups.get("predictor", [])) + len(groups.get("leader", []))
    print(f"\n  → 예측형 채널 총: {predictor_count}개 (컨텐츠 대상)")

    conn.close()


if __name__ == "__main__":
    main()
```

---

## 0-5. 크롤러 통합 (main.py 수정)

### 변경 사항

`main.py`에 분류기 실행 단계 추가:

```python
# main.py 끝부분, daily_stats 계산 후 추가

from channel_classifier import ChannelClassifier

def update_channel_classifications(conn, days=30):
    """6시간마다 크롤링 시 채널 분류도 갱신"""
    classifier = ChannelClassifier(conn)

    with conn.cursor() as cur:
        # 분류가 없거나 7일 이상 경과한 채널만 갱신
        cur.execute("""
            SELECT id FROM channels
            WHERE classification_updated_at IS NULL
               OR classification_updated_at < NOW() - INTERVAL '7 days'
        """)
        channel_ids = [r[0] for r in cur.fetchall()]

    if not channel_ids:
        print(f"  All channels classified recently, skipping.")
        return

    print(f"  Classifying {len(channel_ids)} channels...")
    for ch_id in channel_ids:
        result = classifier.classify_channel(ch_id, days)
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE channels SET
                    channel_type = %s,
                    prediction_intensity_score = %s,
                    classification_details = %s,
                    classification_updated_at = NOW()
                WHERE id = %s
            """, (
                result["channel_type"],
                result["pis"],
                psycopg2.extras.Json(result["details"]),
                ch_id,
            ))
    conn.commit()
    print(f"  Channel classification updated for {len(channel_ids)} channels.")
```

### 실행 타이밍

- 매 크롤링(1시간)마다 체크하되, 7일 이내 분류된 채널은 스킵
- 신규 채널 추가 시 즉시 분류
- `classify_channels.py`로 수동 전체 재분류 가능

---

## 0-6. 프론트엔드 연동

### TypeScript 타입 확장 (types.ts)

```typescript
// 추가할 타입
export type ChannelType = 'predictor' | 'leader' | 'analyst' | 'media' | 'unknown';

// Channel 인터페이스 확장
export interface Channel {
  // ... 기존 필드 ...
  channel_type: ChannelType;
  prediction_intensity_score: number | null;
  classification_details: {
    p1_density: number;
    p2_action_intensity: number;
    p3_concentration: number;
    p4_price_target: number;
    p5_sentiment_bias: number;
    total_videos_analyzed: number;
    period_start: string | null;
    period_end: string | null;
  } | null;
  classification_updated_at: string | null;
}

// 채널 유형 라벨/색상 매핑
export const CHANNEL_TYPE_CONFIG: Record<ChannelType, { label: string; color: string; badge: string }> = {
  predictor: { label: '예측형', color: '#f97316', badge: 'bg-orange-500/20 text-orange-400' },
  leader:    { label: '리딩방', color: '#ef4444', badge: 'bg-red-500/20 text-red-400' },
  analyst:   { label: '해설형', color: '#3b82f6', badge: 'bg-blue-500/20 text-blue-400' },
  media:     { label: '미디어', color: '#6b7280', badge: 'bg-gray-500/20 text-gray-400' },
  unknown:   { label: '미분류', color: '#4b5563', badge: 'bg-gray-600/20 text-gray-500' },
};
```

### 쿼리 함수 추가 (queries.ts)

```typescript
// 예측형 채널만 조회
export async function getPredictorChannels() {
  const result = await sql`
    SELECT id, name, category, channel_type, prediction_intensity_score,
           hit_rate, trust_score, thumbnail_url, subscriber_count,
           classification_details
    FROM channels
    WHERE channel_type IN ('predictor', 'leader')
    ORDER BY prediction_intensity_score DESC
  `;
  return result.rows;
}

// 채널 유형 통계
export async function getChannelTypeStats() {
  const result = await sql`
    SELECT
      channel_type,
      COUNT(*) as count,
      ROUND(AVG(prediction_intensity_score)::numeric, 1) as avg_pis,
      ROUND(AVG(hit_rate)::numeric, 1) as avg_hit_rate
    FROM channels
    WHERE channel_type != 'unknown'
    GROUP BY channel_type
    ORDER BY avg_pis DESC
  `;
  return result.rows;
}

// 기존 쿼리에 channel_type 필터 추가 예시
export async function getHitRateLeaderboard(channelTypes: string[] = ['predictor', 'leader']) {
  const result = await sql`
    SELECT
      c.id, c.name, c.thumbnail_url, c.category,
      c.channel_type, c.prediction_intensity_score,
      COUNT(p.id) as total_predictions,
      COUNT(p.id) FILTER (WHERE p.is_accurate = true) as accurate_count,
      ROUND(100.0 * COUNT(p.id) FILTER (WHERE p.is_accurate = true)
            / NULLIF(COUNT(p.id), 0)) as hit_rate
    FROM channels c
    JOIN predictions p ON p.channel_id = c.id
    WHERE p.is_accurate IS NOT NULL
      AND c.channel_type = ANY(${channelTypes})
    GROUP BY c.id
    HAVING COUNT(p.id) >= 5
    ORDER BY hit_rate DESC, total_predictions DESC
    LIMIT 30
  `;
  return result.rows;
}
```

### UI 컴포넌트: 채널 유형 뱃지

```typescript
// frontend/components/ui/channel-type-badge.tsx (신규)

import { CHANNEL_TYPE_CONFIG, type ChannelType } from '@/lib/types';

interface Props {
  type: ChannelType;
  showPIS?: boolean;
  pis?: number | null;
}

export function ChannelTypeBadge({ type, showPIS, pis }: Props) {
  const config = CHANNEL_TYPE_CONFIG[type];

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${config.badge}`}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: config.color }} />
      {config.label}
      {showPIS && pis != null && (
        <span className="text-[10px] opacity-70">PIS:{pis}</span>
      )}
    </span>
  );
}
```

### 기존 페이지 수정 영향

| 페이지 | 변경 내용 |
|--------|----------|
| `/channels` | 채널 카드에 유형 뱃지 추가, 유형별 필터 탭 추가 |
| `/channels/[id]` | 채널 상세에 PIS 점수 + 분류 상세 표시 |
| `/compare` | 비교 시 채널 유형 표시 |
| 대시보드 (`/`) | 예측형 채널 수/비율 통계 카드 추가 |

---

## 데이터 흐름 다이어그램

```
[매시간 크롤링]
     │
     ▼
[main.py: 영상 수집 + NLP 분석]
     │
     ├── predictions 테이블에 예측 저장
     ├── mentioned_assets에 종목 언급 저장
     │
     ▼
[7일마다] update_channel_classifications()
     │
     ├── P1: predictions 조인하여 예측 밀도 계산
     ├── P2: 영상 텍스트에서 행동 키워드 카운트
     ├── P3: mentioned_assets에서 종목 집중도 계산
     ├── P4: 영상 텍스트에서 목표가 패턴 매칭
     ├── P5: mentioned_assets 감성 편향 계산
     │
     ▼
[PIS 가중 합산] → channel_type 결정
     │
     ▼
[channels 테이블 업데이트]
     │
     ▼
[프론트엔드: channel_type 기반 필터링]
```

---

## 검증 방법

### 1단계: 일괄 분류 실행 후 수동 검증

```bash
python classify_channels.py
```

기대 결과:
- 주식단테, 소수몽키 → predictor (PIS 60+)
- 슈카월드, 삼프로TV → analyst (PIS 25~60)
- 머니투데이, SBS비즈 → media (PIS < 25)

### 2단계: 경계값 채널 수동 확인

PIS 50~70 범위 채널을 수동으로 영상 3개 확인하여 분류가 적절한지 검증.
부적절한 경우 가중치(PIS_WEIGHTS) 또는 임계값(THRESHOLDS) 조정.

### 3단계: 프론트엔드 확인

- `/channels` 페이지에서 유형 뱃지 표시 확인
- predictor 필터로 조회 시 적절한 채널만 노출 확인

---

## 리스크 및 대응

| 리스크 | 대응 |
|--------|------|
| 자막 없는 영상이 많아 P2/P4 부정확 | 제목+설명만으로 간이 점수 산출, 자막 있는 영상만 가중 |
| 경계값(PIS 55~65) 오분류 | `unknown` 유지 + 수동 보정 UI 또는 threshold 미세조정 |
| 크롤링 데이터 30일 미만 신규 채널 | 최소 10영상 이상일 때만 분류, 미만은 unknown |
| 계절적 변동 (시장 급변 시 모든 채널이 예측적) | 최근 30일 + 90일 이동평균 비교하여 안정적 분류 |
