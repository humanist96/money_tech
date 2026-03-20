-- ============================================================
-- 009: Materialized Views for expensive dashboard queries
-- ============================================================
-- Pre-computes the three most expensive queries:
--   1. Asset Consensus (getAssetConsensus) - 4-table join + aggregation
--   2. Hit Rate Leaderboard (getHitRateLeaderboard) - aggregation over all predictions
--   3. Market Sentiment Gauge historical (getMarketSentimentGauge) - 90-day daily scores
-- Refreshed after each evaluate pipeline run via refresh_materialized_views().
-- ============================================================

-- ---------- 1. Asset Consensus (last 30 days) ----------

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_asset_consensus AS
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
GROUP BY ma.asset_name, ma.asset_code, ma.asset_type
HAVING COUNT(*) >= 2
ORDER BY COUNT(DISTINCT v.channel_id) DESC, COUNT(*) DESC
LIMIT 30;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_consensus_asset
  ON mv_asset_consensus(asset_name, asset_code);


-- ---------- 2. Hit Rate Leaderboard ----------

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_hit_rate_leaderboard AS
SELECT
  c.id                                                        AS channel_id,
  c.name                                                      AS channel_name,
  c.thumbnail_url                                             AS channel_thumbnail,
  c.category,
  c.channel_type,
  c.prediction_intensity_score                                AS pis,
  COUNT(CASE WHEN p.direction_score >= 0.5 THEN 1 END)::int  AS accurate_count,
  COUNT(CASE WHEN p.direction_score IS NOT NULL THEN 1 END)::int AS total_predictions,
  COUNT(*)::int                                               AS all_predictions,
  CASE WHEN COUNT(CASE WHEN p.direction_score IS NOT NULL THEN 1 END) > 0
    THEN AVG(p.direction_score)::float
    ELSE NULL END                                             AS hit_rate,
  COALESCE(AVG(p.crowd_accuracy)::float, 0)                  AS avg_crowd_accuracy,
  COUNT(CASE WHEN p.crowd_accuracy IS NOT NULL THEN 1 END)::int AS crowd_evaluated
FROM predictions p
JOIN channels c ON p.channel_id = c.id
WHERE p.prediction_type IN ('buy', 'sell')
GROUP BY c.id, c.name, c.thumbnail_url, c.category, c.channel_type, c.prediction_intensity_score
HAVING COUNT(*) >= 1
ORDER BY COUNT(CASE WHEN p.direction_score IS NOT NULL THEN 1 END) DESC,
         AVG(p.direction_score) DESC NULLS LAST;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_leaderboard_channel
  ON mv_hit_rate_leaderboard(channel_id);


-- ---------- 3. Market Sentiment Historical (90-day daily scores) ----------

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_market_sentiment AS
SELECT
  v.published_at::date AS date,
  ((COUNT(CASE WHEN ma.sentiment = 'positive' THEN 1 END)::float -
    COUNT(CASE WHEN ma.sentiment = 'negative' THEN 1 END)::float) /
    NULLIF(COUNT(*), 0) * 50 + 50)                           AS score
FROM mentioned_assets ma
JOIN videos v ON ma.video_id = v.id
WHERE v.published_at >= NOW() - INTERVAL '90 days'
  AND ma.sentiment IS NOT NULL
GROUP BY v.published_at::date
HAVING COUNT(*) >= 5
ORDER BY date ASC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_sentiment_date
  ON mv_market_sentiment(date);


-- ---------- Refresh helper ----------

CREATE OR REPLACE FUNCTION refresh_materialized_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_asset_consensus;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_hit_rate_leaderboard;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_market_sentiment;
END;
$$ LANGUAGE plpgsql;
