import { getDb } from '../db'
import type { RiskScore, HiddenGemChannel, ConflictingOpinion } from '../types'

// Risk Scoreboard
export async function getRiskScoreboard(days = 14): Promise<RiskScore[]> {
  const sql = getDb()
  const rows = await sql`
    WITH asset_data AS (
      SELECT
        ma.asset_name, ma.asset_code, ma.asset_type,
        COUNT(*)::int AS mention_count,
        COUNT(DISTINCT v.channel_id)::int AS channel_count,
        COUNT(CASE WHEN ma.sentiment = 'positive' THEN 1 END)::float / NULLIF(COUNT(*), 0) AS pos_ratio,
        COUNT(CASE WHEN ma.sentiment = 'negative' THEN 1 END)::float / NULLIF(COUNT(*), 0) AS neg_ratio,
        COUNT(CASE WHEN p.prediction_type = 'buy' THEN 1 END)::int AS buy_count,
        COUNT(CASE WHEN p.prediction_type = 'sell' THEN 1 END)::int AS sell_count
      FROM mentioned_assets ma
      JOIN videos v ON ma.video_id = v.id
      LEFT JOIN predictions p ON p.video_id = v.id AND p.mentioned_asset_id = ma.id
      WHERE v.published_at >= NOW() - INTERVAL '1 day' * ${days}
        AND ma.asset_code IS NOT NULL AND ma.sentiment IS NOT NULL
      GROUP BY ma.asset_name, ma.asset_code, ma.asset_type
      HAVING COUNT(*) >= 3
    ),
    prev_period AS (
      SELECT
        ma.asset_code,
        COUNT(*)::int AS prev_mentions,
        COUNT(CASE WHEN ma.sentiment = 'positive' THEN 1 END)::float / NULLIF(COUNT(*), 0) AS prev_pos_ratio
      FROM mentioned_assets ma
      JOIN videos v ON ma.video_id = v.id
      WHERE v.published_at >= NOW() - INTERVAL '1 day' * ${days * 2}
        AND v.published_at < NOW() - INTERVAL '1 day' * ${days}
        AND ma.asset_code IS NOT NULL AND ma.sentiment IS NOT NULL
      GROUP BY ma.asset_code
    ),
    expert_opinion AS (
      SELECT
        ma.asset_code,
        AVG(CASE WHEN p.prediction_type = 'buy' THEN 1 WHEN p.prediction_type = 'sell' THEN -1 ELSE 0 END)::float AS expert_avg
      FROM predictions p
      JOIN videos v ON p.video_id = v.id
      JOIN channels c ON v.channel_id = c.id
      JOIN mentioned_assets ma ON p.mentioned_asset_id = ma.id
      WHERE v.published_at >= NOW() - INTERVAL '1 day' * ${days}
        AND c.hit_rate > 0.5
        AND ma.asset_code IS NOT NULL
      GROUP BY ma.asset_code
    )
    SELECT
      ad.*,
      COALESCE(pp.prev_mentions, 0)::int AS prev_mentions,
      COALESCE(pp.prev_pos_ratio, 0.5)::float AS prev_pos_ratio,
      COALESCE(eo.expert_avg, 0)::float AS expert_avg
    FROM asset_data ad
    LEFT JOIN prev_period pp ON pp.asset_code = ad.asset_code
    LEFT JOIN expert_opinion eo ON eo.asset_code = ad.asset_code
    ORDER BY ad.mention_count DESC
    LIMIT 20
  `

  return (rows as any[]).map(r => {
    const consensusScore = Math.max(r.pos_ratio || 0, r.neg_ratio || 0, 0.5 - Math.abs((r.pos_ratio || 0) - (r.neg_ratio || 0))) * 100
    const prevMentions = Number(r.prev_mentions) || 1
    const mentionTrend = r.mention_count > prevMentions * 1.5 ? 'rising' as const :
                         r.mention_count < prevMentions * 0.7 ? 'falling' as const : 'stable' as const
    const frequencyScore = Math.min(r.mention_count / 5 * 25, 25)
    const expertScore = ((Number(r.expert_avg) || 0) + 1) / 2 * 25
    const sentimentShift = (r.pos_ratio || 0) > (Number(r.prev_pos_ratio) || 0) + 0.1 ? 'improving' as const :
                          (r.pos_ratio || 0) < (Number(r.prev_pos_ratio) || 0) - 0.1 ? 'worsening' as const : 'stable' as const
    const sentimentScore = (r.pos_ratio || 0.5) * 25
    const total = Math.round(consensusScore * 0.3 + frequencyScore + expertScore + sentimentScore)
    const clamped = Math.max(0, Math.min(100, total))

    return {
      asset_name: r.asset_name,
      asset_code: r.asset_code,
      asset_type: r.asset_type,
      score: clamped,
      consensus_ratio: Math.max(r.buy_count, r.sell_count) / Math.max(r.buy_count + r.sell_count, 1),
      mention_trend: mentionTrend,
      mention_count: r.mention_count,
      weighted_opinion: Number(r.expert_avg) || 0,
      sentiment_shift: sentimentShift,
      signal_color: clamped >= 65 ? 'green' as const : clamped >= 40 ? 'yellow' as const : 'red' as const,
      details: {
        consensus_score: Math.round(consensusScore * 0.3),
        frequency_score: Math.round(frequencyScore),
        expert_score: Math.round(expertScore),
        sentiment_score: Math.round(sentimentScore),
      },
    }
  }).sort((a: RiskScore, b: RiskScore) => b.score - a.score)
}

// Hidden Gem Channel Discovery
export async function getHiddenGemChannels(): Promise<HiddenGemChannel[]> {
  const sql = getDb()
  const rows = await sql`
    WITH channel_stats AS (
      SELECT
        c.id AS channel_id,
        c.name AS channel_name,
        c.thumbnail_url AS channel_thumbnail,
        c.category,
        c.subscriber_count,
        c.prediction_intensity_score,
        COUNT(CASE WHEN p.direction_score >= 0.5 THEN 1 END)::int AS accurate_count,
        COUNT(CASE WHEN p.direction_score IS NOT NULL THEN 1 END)::int AS total_predictions,
        CASE WHEN COUNT(CASE WHEN p.direction_score IS NOT NULL THEN 1 END) > 0
          THEN AVG(p.direction_score)::float
          ELSE NULL END AS hit_rate
      FROM channels c
      LEFT JOIN predictions p ON p.channel_id = c.id AND p.prediction_type IN ('buy', 'sell')
      GROUP BY c.id, c.name, c.thumbnail_url, c.category, c.subscriber_count, c.prediction_intensity_score
      HAVING COUNT(CASE WHEN p.direction_score IS NOT NULL THEN 1 END) >= 2
    ),
    channel_profile AS (
      SELECT
        v.channel_id,
        COUNT(CASE WHEN ma.sentiment = 'positive' THEN 1 END)::float /
          NULLIF(COUNT(ma.id), 0) * 100 AS aggressiveness,
        COUNT(CASE WHEN ma.sentiment = 'neutral' THEN 1 END)::float /
          NULLIF(COUNT(ma.id), 0) * 100 AS conservatism,
        COUNT(DISTINCT ma.asset_code)::float AS diversity_raw,
        AVG(v.duration)::float / 1800 * 100 AS depth
      FROM videos v
      LEFT JOIN mentioned_assets ma ON ma.video_id = v.id
      GROUP BY v.channel_id
    )
    SELECT
      cs.*,
      COALESCE(cp.aggressiveness, 0) AS aggressiveness,
      COALESCE(cp.conservatism, 0) AS conservatism,
      LEAST(COALESCE(cp.diversity_raw, 0) * 5, 100) AS diversity,
      COALESCE(cp.depth, 0) AS depth
    FROM channel_stats cs
    LEFT JOIN channel_profile cp ON cp.channel_id = cs.channel_id
    WHERE cs.hit_rate IS NOT NULL
    ORDER BY
      CASE WHEN cs.subscriber_count IS NOT NULL AND cs.subscriber_count < 100000 AND cs.hit_rate >= 0.5
        THEN cs.hit_rate * 2
        ELSE cs.hit_rate END DESC,
      cs.total_predictions DESC
    LIMIT 20
  `

  return (rows as any[]).map(r => ({
    channel_id: r.channel_id,
    channel_name: r.channel_name,
    channel_thumbnail: r.channel_thumbnail,
    category: r.category,
    subscriber_count: r.subscriber_count,
    hit_rate: Number(r.hit_rate) || 0,
    total_predictions: r.total_predictions,
    accurate_count: r.accurate_count,
    prediction_intensity_score: r.prediction_intensity_score,
    radar: {
      aggressiveness: Math.min(Number(r.aggressiveness) || 0, 100),
      conservatism: Math.min(Number(r.conservatism) || 0, 100),
      diversity: Math.min(Number(r.diversity) || 0, 100),
      accuracy: Math.min((Number(r.hit_rate) || 0) * 100, 100),
      depth: Math.min(Number(r.depth) || 0, 100),
    },
  }))
}

// Conflicting Opinions Detection
export async function getConflictingOpinions(days = 14): Promise<ConflictingOpinion[]> {
  const sql = getDb()
  const rows = await sql`
    WITH asset_predictions AS (
      SELECT
        ma.asset_name,
        ma.asset_code,
        c.name AS channel_name,
        p.prediction_type,
        MAX(v.published_at) AS latest_at
      FROM predictions p
      JOIN videos v ON p.video_id = v.id
      JOIN channels c ON p.channel_id = c.id
      JOIN mentioned_assets ma ON p.mentioned_asset_id = ma.id
      WHERE v.published_at >= NOW() - INTERVAL '1 day' * ${days}
        AND p.prediction_type IN ('buy', 'sell')
        AND ma.asset_code IS NOT NULL
      GROUP BY ma.asset_name, ma.asset_code, c.name, p.prediction_type
    ),
    conflict_data AS (
      SELECT
        asset_name,
        asset_code,
        ARRAY_AGG(DISTINCT channel_name) FILTER (WHERE prediction_type = 'buy') AS bullish_channels,
        ARRAY_AGG(DISTINCT channel_name) FILTER (WHERE prediction_type = 'sell') AS bearish_channels,
        COUNT(DISTINCT channel_name) FILTER (WHERE prediction_type = 'buy')::int AS buy_count,
        COUNT(DISTINCT channel_name) FILTER (WHERE prediction_type = 'sell')::int AS sell_count,
        MAX(latest_at) AS recent_date
      FROM asset_predictions
      GROUP BY asset_name, asset_code
      HAVING COUNT(DISTINCT channel_name) FILTER (WHERE prediction_type = 'buy') >= 1
        AND COUNT(DISTINCT channel_name) FILTER (WHERE prediction_type = 'sell') >= 1
    )
    SELECT
      asset_name,
      asset_code,
      bullish_channels,
      bearish_channels,
      buy_count,
      sell_count,
      (buy_count + sell_count)::int AS total_opinions,
      LEAST(buy_count, sell_count)::float / GREATEST(buy_count, sell_count)::float AS conflict_score,
      recent_date
    FROM conflict_data
    ORDER BY LEAST(buy_count, sell_count)::float / GREATEST(buy_count, sell_count)::float DESC,
             (buy_count + sell_count) DESC
    LIMIT 30
  `

  return (rows as any[]).map(r => ({
    asset_name: r.asset_name,
    asset_code: r.asset_code,
    bullish_channels: r.bullish_channels || [],
    bearish_channels: r.bearish_channels || [],
    conflict_score: Number(r.conflict_score) || 0,
    total_opinions: Number(r.total_opinions) || 0,
    recent_date: r.recent_date ? String(r.recent_date) : '',
  }))
}

// Channel Comparison (for analytics page)
export { getChannelsForComparison } from './channels'
