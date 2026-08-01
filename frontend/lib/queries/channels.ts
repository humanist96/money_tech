import { getDb } from '../db'
import type {
  Channel, ChannelType, Platform, ChannelAssetOpinion,
  ChannelSpecialtyItem, ChannelActivityData,
} from '../types'

export async function getChannels(category?: string, platform?: string): Promise<Channel[]> {
  const sql = getDb()
  if (category && platform) {
    return await sql`SELECT * FROM channels WHERE category = ${category} AND platform = ${platform} ORDER BY subscriber_count DESC NULLS LAST` as unknown as Channel[]
  }
  if (category) {
    return await sql`SELECT * FROM channels WHERE category = ${category} ORDER BY subscriber_count DESC NULLS LAST` as unknown as Channel[]
  }
  if (platform) {
    return await sql`SELECT * FROM channels WHERE platform = ${platform} ORDER BY subscriber_count DESC NULLS LAST` as unknown as Channel[]
  }
  return await sql`SELECT * FROM channels ORDER BY subscriber_count DESC NULLS LAST` as unknown as Channel[]
}

export async function getChannelById(id: string): Promise<Channel | null> {
  const sql = getDb()
  const rows = await sql`SELECT * FROM channels WHERE id = ${id} LIMIT 1` as unknown as Channel[]
  return rows[0] ?? null
}

export async function getChannelHitRate(channelId: string) {
  const sql = getDb()
  const rows = await sql`
    SELECT
      COUNT(CASE WHEN p.direction_score >= 0.5 THEN 1 END)::int AS accurate_count,
      COUNT(CASE WHEN p.direction_score IS NOT NULL THEN 1 END)::int AS total_predictions,
      CASE WHEN COUNT(CASE WHEN p.direction_score IS NOT NULL THEN 1 END) > 0
        THEN AVG(p.direction_score)::float
        ELSE NULL END AS hit_rate,
      COUNT(CASE WHEN p.direction_1w = true THEN 1 END)::int AS dir_1w_correct,
      COUNT(CASE WHEN p.direction_1w IS NOT NULL THEN 1 END)::int AS dir_1w_total,
      COUNT(CASE WHEN p.direction_1m = true THEN 1 END)::int AS dir_1m_correct,
      COUNT(CASE WHEN p.direction_1m IS NOT NULL THEN 1 END)::int AS dir_1m_total
    FROM predictions p
    WHERE p.channel_id = ${channelId}
      AND p.prediction_type IN ('buy', 'sell')
  `
  return rows[0] as {
    accurate_count: number; total_predictions: number; hit_rate: number | null;
    dir_1w_correct: number; dir_1w_total: number;
    dir_1m_correct: number; dir_1m_total: number;
  }
}

export async function getChannelPredictions(channelId: string, limit = 10) {
  const sql = getDb()
  const rows = await sql`
    SELECT p.prediction_type, p.predicted_at, p.is_accurate,
           p.actual_price_after_1w, p.actual_price_after_1m, p.actual_price_after_3m,
           p.direction_1w, p.direction_1m, p.direction_3m, p.direction_score::float AS direction_score,
           ma.asset_name, ma.asset_code, ma.asset_type, ma.price_at_mention
    FROM predictions p
    JOIN mentioned_assets ma ON p.mentioned_asset_id = ma.id
    WHERE p.channel_id = ${channelId}
      AND p.prediction_type IN ('buy', 'sell')
    ORDER BY p.predicted_at DESC NULLS LAST
    LIMIT ${limit}
  `
  return rows
}

export async function getChannelProfile(channelId: string) {
  const sql = getDb()
  const rows = await sql`
    SELECT
      COUNT(CASE WHEN ma.sentiment = 'positive' THEN 1 END)::float /
        NULLIF(COUNT(ma.id), 0) * 100 AS aggressiveness,
      COUNT(CASE WHEN ma.sentiment = 'neutral' THEN 1 END)::float /
        NULLIF(COUNT(ma.id), 0) * 100 AS conservatism,
      COUNT(DISTINCT ma.asset_code)::float /
        NULLIF(COUNT(ma.id), 0) * 100 AS diversity,
      AVG(v.duration)::float / 1800 * 100 AS depth
    FROM videos v
    LEFT JOIN mentioned_assets ma ON ma.video_id = v.id
    WHERE v.channel_id = ${channelId}
  `
  return rows[0] as { aggressiveness: number | null; conservatism: number | null; diversity: number | null; depth: number | null }
}

// Channel x Asset Opinion Matrix
// The matrix renders channels x assets, so both axes must stay bounded —
// an unbounded result set grows quadratically and blows up the rendered page.
export async function getChannelAssetMatrix(
  days = 7,
  assetLimit = 15,
  channelLimit = 20
): Promise<ChannelAssetOpinion[]> {
  const sql = getDb()
  const rows = await sql`
    WITH recent AS (
      SELECT ma.asset_name, ma.asset_code, ma.sentiment, v.channel_id
      FROM mentioned_assets ma
      JOIN videos v ON ma.video_id = v.id
      WHERE v.published_at >= NOW() - INTERVAL '1 day' * ${days}
        AND ma.sentiment IS NOT NULL
        AND ma.asset_code IS NOT NULL
    ),
    top_assets AS (
      SELECT asset_code
      FROM recent
      GROUP BY asset_code
      HAVING COUNT(DISTINCT channel_id) >= 2
      ORDER BY COUNT(*) DESC
      LIMIT ${assetLimit}
    ),
    top_channels AS (
      SELECT channel_id
      FROM recent
      WHERE asset_code IN (SELECT asset_code FROM top_assets)
      GROUP BY channel_id
      ORDER BY COUNT(*) DESC
      LIMIT ${channelLimit}
    )
    SELECT
      c.id AS channel_id,
      c.name AS channel_name,
      r.asset_name,
      r.asset_code,
      r.sentiment,
      COUNT(*)::int AS mention_count
    FROM recent r
    JOIN channels c ON r.channel_id = c.id
    WHERE r.asset_code IN (SELECT asset_code FROM top_assets)
      AND r.channel_id IN (SELECT channel_id FROM top_channels)
    GROUP BY c.id, c.name, r.asset_name, r.asset_code, r.sentiment
    ORDER BY r.asset_name, c.name
  `
  return rows as ChannelAssetOpinion[]
}

// Channel Specialty (top mentioned assets)
export async function getChannelSpecialty(channelId: string, limit = 5): Promise<ChannelSpecialtyItem[]> {
  const sql = getDb()
  const rows = await sql`
    SELECT
      ma.asset_name,
      ma.asset_code,
      COUNT(*)::int AS mention_count,
      (SELECT s.sentiment FROM mentioned_assets s
       JOIN videos sv ON s.video_id = sv.id
       WHERE sv.channel_id = ${channelId} AND s.asset_name = ma.asset_name AND s.sentiment IS NOT NULL
       GROUP BY s.sentiment ORDER BY COUNT(*) DESC LIMIT 1) AS sentiment
    FROM mentioned_assets ma
    JOIN videos v ON ma.video_id = v.id
    WHERE v.channel_id = ${channelId}
    GROUP BY ma.asset_name, ma.asset_code
    ORDER BY mention_count DESC
    LIMIT ${limit}
  `
  return rows as ChannelSpecialtyItem[]
}

// Channel Activity Heatmap
export async function getChannelActivity(days = 7): Promise<ChannelActivityData[]> {
  const sql = getDb()
  const rows = await sql`
    SELECT
      c.id AS channel_id,
      c.name AS channel_name,
      c.category,
      -- Cast to text: the driver returns Date objects for date columns, and the
      -- heatmap dedupes its date axis with a Set, which never matches on objects.
      v.published_at::date::text AS date,
      COUNT(*)::int AS video_count
    FROM videos v
    JOIN channels c ON v.channel_id = c.id
    WHERE v.published_at >= NOW() - INTERVAL '1 day' * ${days}
    GROUP BY c.id, c.name, c.category, v.published_at::date
    ORDER BY c.name, date
  `
  return rows as ChannelActivityData[]
}

// Channel Type Stats - counts per type
export async function getChannelTypeStats() {
  const sql = getDb()
  const rows = await sql`
    SELECT
      channel_type,
      COUNT(*)::int as count,
      ROUND(AVG(prediction_intensity_score)::numeric, 1) as avg_pis,
      AVG(hit_rate)::float as avg_hit_rate
    FROM channels
    WHERE channel_type IS NOT NULL AND channel_type != 'unknown'
    GROUP BY channel_type
    ORDER BY avg_pis DESC NULLS LAST
  `
  return rows as { channel_type: string; count: number; avg_pis: number | null; avg_hit_rate: number | null }[]
}

// Predictor Channels - only predictor/leader types
// Channel Prediction Profile - buy/sell/hold distribution per channel
export async function getChannelPredictionProfiles() {
  const sql = getDb()
  const rows = await sql`
    SELECT
      c.id AS channel_id,
      c.name AS channel_name,
      c.thumbnail_url AS channel_thumbnail,
      c.category,
      COUNT(CASE WHEN p.prediction_type = 'buy' THEN 1 END)::int AS buy_count,
      COUNT(CASE WHEN p.prediction_type = 'sell' THEN 1 END)::int AS sell_count,
      COUNT(CASE WHEN p.prediction_type = 'hold' THEN 1 END)::int AS hold_count,
      COUNT(*)::int AS total
    FROM predictions p
    JOIN channels c ON p.channel_id = c.id
    GROUP BY c.id, c.name, c.thumbnail_url, c.category
    HAVING COUNT(*) >= 3
    ORDER BY COUNT(*) DESC
    LIMIT 10
  `
  return rows as any[]
}

// Channel Specialties for all channels (used in channel list)
