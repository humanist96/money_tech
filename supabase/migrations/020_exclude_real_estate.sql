-- ============================================================
-- 020: 부동산 자산군 스코프 제거 (핵심가치-재정비 §1.1, Phase A5)
-- ============================================================
-- 오너 결정(2026-08-01): 부동산 제외, 국내 주식 중심.
-- 기존 데이터(mentioned_assets/predictions/channels 행)는 보존하고
-- 노출과 신규 유입만 차단한다. DELETE 없음.
-- ============================================================

-- 1. 채널 활성 플래그 — 부동산 채널은 수집·노출 대상에서 제외
ALTER TABLE channels ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

UPDATE channels SET is_active = false WHERE category = 'real_estate';

-- 2. 자산 사전에서 부동산 항목 비활성화 (크롤러 DB 사전 로드는
--    asset_type IN ('stock','coin')으로도 이중 차단됨)
UPDATE asset_dictionary SET is_active = false WHERE asset_type = 'real_estate';

-- 3. MV 재생성 — 부동산 언급·비활성 채널 제외
DROP MATERIALIZED VIEW IF EXISTS mv_asset_consensus;

CREATE MATERIALIZED VIEW mv_asset_consensus AS
SELECT
  ma.asset_name,
  ma.asset_code,
  ma.asset_type,
  COUNT(CASE WHEN ma.sentiment = 'positive' THEN 1 END)::float
    / NULLIF(COUNT(*), 0) * 100                              AS positive_pct,
  COUNT(CASE WHEN ma.sentiment = 'negative' THEN 1 END)::float
    / NULLIF(COUNT(*), 0) * 100                              AS negative_pct,
  COUNT(CASE WHEN ma.sentiment = 'neutral' THEN 1 END)::float
    / NULLIF(COUNT(*), 0) * 100                              AS neutral_pct,
  COUNT(*)::int                                               AS total_mentions,
  COUNT(DISTINCT v.channel_id)::int                           AS channel_count,
  ARRAY_AGG(DISTINCT c.name)                                  AS channels,
  COUNT(CASE WHEN p.prediction_type = 'buy'  THEN 1 END)::int AS buy_count,
  COUNT(CASE WHEN p.prediction_type = 'sell' THEN 1 END)::int AS sell_count,
  COUNT(CASE WHEN p.prediction_type = 'hold' THEN 1 END)::int AS hold_count
FROM mentioned_assets ma
JOIN videos v ON ma.video_id = v.id
JOIN channels c ON v.channel_id = c.id
LEFT JOIN predictions p ON p.video_id = v.id AND p.mentioned_asset_id = ma.id
WHERE v.published_at >= NOW() - INTERVAL '30 days'
  AND ma.sentiment IS NOT NULL
  AND ma.asset_type IN ('stock', 'coin')
  AND c.is_active
GROUP BY ma.asset_name, ma.asset_code, ma.asset_type
HAVING COUNT(*) >= 2
ORDER BY COUNT(DISTINCT v.channel_id) DESC, COUNT(*) DESC
LIMIT 30;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_consensus_asset
  ON mv_asset_consensus(asset_name, asset_code);

DROP MATERIALIZED VIEW IF EXISTS mv_market_sentiment;

CREATE MATERIALIZED VIEW mv_market_sentiment AS
SELECT
  v.published_at::date AS date,
  ((COUNT(CASE WHEN ma.sentiment = 'positive' THEN 1 END)::float -
    COUNT(CASE WHEN ma.sentiment = 'negative' THEN 1 END)::float) /
    NULLIF(COUNT(*), 0) * 50 + 50)                           AS score
FROM mentioned_assets ma
JOIN videos v ON ma.video_id = v.id
WHERE v.published_at >= NOW() - INTERVAL '90 days'
  AND ma.sentiment IS NOT NULL
  AND ma.asset_type IN ('stock', 'coin')
GROUP BY v.published_at::date
HAVING COUNT(*) >= 5
ORDER BY date ASC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_sentiment_date
  ON mv_market_sentiment(date);
