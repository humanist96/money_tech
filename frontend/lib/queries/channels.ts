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

export async function getAllChannelsWithIds(): Promise<Channel[]> {
  const sql = getDb()
  const rows = await sql`SELECT * FROM channels ORDER BY subscriber_count DESC NULLS LAST`
  return rows as Channel[]
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
export async function getChannelAssetMatrix(days = 7): Promise<ChannelAssetOpinion[]> {
  const sql = getDb()
  const rows = await sql`
    SELECT
      c.id AS channel_id,
      c.name AS channel_name,
      ma.asset_name,
      ma.asset_code,
      ma.sentiment,
      COUNT(*)::int AS mention_count
    FROM mentioned_assets ma
    JOIN videos v ON ma.video_id = v.id
    JOIN channels c ON v.channel_id = c.id
    WHERE v.published_at >= NOW() - INTERVAL '1 day' * ${days}
      AND ma.sentiment IS NOT NULL
      AND ma.asset_code IN (
        SELECT ma2.asset_code FROM mentioned_assets ma2
        JOIN videos v2 ON ma2.video_id = v2.id
        WHERE v2.published_at >= NOW() - INTERVAL '1 day' * ${days}
          AND ma2.asset_code IS NOT NULL
        GROUP BY ma2.asset_code
        HAVING COUNT(DISTINCT v2.channel_id) >= 2
      )
    GROUP BY c.id, c.name, ma.asset_name, ma.asset_code, ma.sentiment
    ORDER BY ma.asset_name, c.name
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
      v.published_at::date AS date,
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
export async function getPredictorChannels(): Promise<Channel[]> {
  const sql = getDb()
  const rows = await sql`
    SELECT * FROM channels
    WHERE channel_type IN ('predictor', 'leader')
    ORDER BY prediction_intensity_score DESC NULLS LAST
  `
  return rows as unknown as Channel[]
}

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
export async function getAllChannelSpecialties(): Promise<Map<string, ChannelSpecialtyItem[]>> {
  const sql = getDb()
  const rows = await sql`
    SELECT
      v.channel_id,
      ma.asset_name,
      ma.asset_code,
      COUNT(*)::int AS mention_count
    FROM mentioned_assets ma
    JOIN videos v ON ma.video_id = v.id
    GROUP BY v.channel_id, ma.asset_name, ma.asset_code
    ORDER BY v.channel_id, mention_count DESC
  `
  const map = new Map<string, ChannelSpecialtyItem[]>()
  for (const r of rows as any[]) {
    const list = map.get(r.channel_id) || []
    if (list.length < 5) {
      list.push({ asset_name: r.asset_name, asset_code: r.asset_code, mention_count: r.mention_count, sentiment: 'neutral' })
    }
    map.set(r.channel_id, list)
  }
  return map
}

export async function getChannelsForComparison(ids: string[]) {
  const sql = getDb()
  const channels = await sql`
    SELECT c.*,
      (SELECT COUNT(*)::int FROM videos WHERE channel_id = c.id) as total_video_count,
      (SELECT COUNT(*)::int FROM mentioned_assets ma JOIN videos v ON ma.video_id = v.id WHERE v.channel_id = c.id AND ma.sentiment = 'positive') as positive_mentions,
      (SELECT COUNT(*)::int FROM mentioned_assets ma JOIN videos v ON ma.video_id = v.id WHERE v.channel_id = c.id AND ma.sentiment = 'negative') as negative_mentions,
      (SELECT COUNT(*)::int FROM mentioned_assets ma JOIN videos v ON ma.video_id = v.id WHERE v.channel_id = c.id AND ma.sentiment = 'neutral') as neutral_mentions
    FROM channels c
    WHERE c.id = ANY(${ids})
  `
  return channels
}
