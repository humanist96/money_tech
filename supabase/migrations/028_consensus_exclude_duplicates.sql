-- ============================================================
-- 028: mv_asset_consensus에서 중복·모순 예측 제외 (027 부작용 차단)
-- ============================================================
-- 027이 014의 3컬럼 유니크를 지웠다. 그 인덱스는 회귀의 원인이었지만,
-- 동시에 (video, asset)당 예측 행 수의 **상한** 역할도 하고 있었다.
-- 021은 부분 인덱스(WHERE NOT is_duplicate)라 is_duplicate=TRUE 행들
-- 사이에는 유일성을 강제하지 않으므로, 상한이 사라진 자리가 남는다.
--
-- 평가·리더보드는 안전하다 — evaluator가 `NOT p.is_duplicate`로 표본을
-- 뽑기 때문이다. 그러나 이 MV는 predictions를 조인해 COUNT(*)로 buy/sell/
-- hold를 세면서 그 필터가 없다. 중복 행이 늘면 조인 팬아웃이 매수/매도
-- 집계뿐 아니라 **감성 비율의 분모까지** 부풀린다.
--
-- 중복·모순으로 평가에서 뺀 예측을 컨센서스에는 세는 것 자체가 원래
-- 일관성 없는 동작이었다. 상한이 사라진 김에 정의를 맞춘다.
-- ============================================================

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
-- 조인 조건에 둔다: WHERE로 올리면 예측이 없는 언급까지 탈락해
-- 감성 집계가 예측 보유 종목으로만 좁아진다.
LEFT JOIN predictions p
       ON p.video_id = v.id
      AND p.mentioned_asset_id = ma.id
      AND NOT p.is_duplicate
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
