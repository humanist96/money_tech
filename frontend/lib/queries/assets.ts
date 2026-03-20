import { getDb } from '../db'
import type {
  AssetMention, AssetConsensus, AssetCorrelation,
  TopAssetSentiment, AssetTimelineEntry,
  SentimentTrendPoint, MentionSpikeData,
} from '../types'

export async function getAssetMentions(days: number = 7): Promise<AssetMention[]> {
  const sql = getDb()
  const rows = await sql`
    SELECT
      ma.asset_name,
      ma.asset_code,
      ma.asset_type,
      COUNT(*)::int as mention_count,
      COUNT(CASE WHEN ma.sentiment = 'positive' THEN 1 END)::int as positive_count,
      COUNT(CASE WHEN ma.sentiment = 'negative' THEN 1 END)::int as negative_count,
      COUNT(CASE WHEN ma.sentiment = 'neutral' THEN 1 END)::int as neutral_count,
      ARRAY_AGG(DISTINCT c.name) as channels
    FROM mentioned_assets ma
    JOIN videos v ON ma.video_id = v.id
    JOIN channels c ON v.channel_id = c.id
    WHERE v.published_at >= NOW() - INTERVAL '1 day' * ${days}
    GROUP BY ma.asset_name, ma.asset_code, ma.asset_type
    ORDER BY mention_count DESC
    LIMIT 50
  `
  return rows as AssetMention[]
}

export async function getAssetDetail(assetCode: string) {
  const sql = getDb()
  const mentions = await sql`
    SELECT ma.*, v.title as video_title, v.youtube_video_id, v.blog_post_url, v.platform as video_platform,
           v.published_at as video_published_at,
           v.view_count as video_view_count, v.thumbnail_url as video_thumbnail,
           c.name as channel_name, c.category as channel_category
    FROM mentioned_assets ma
    JOIN videos v ON ma.video_id = v.id
    JOIN channels c ON v.channel_id = c.id
    WHERE ma.asset_code = ${assetCode}
    ORDER BY v.published_at DESC
    LIMIT 50
  `
  return mentions
}

// Asset Consensus Score (all channels)
export async function getAssetConsensus(days = 30): Promise<AssetConsensus[]> {
  const sql = getDb()
  const rows = await sql`
    SELECT
      ma.asset_name,
      ma.asset_code,
      ma.asset_type,
      COUNT(CASE WHEN ma.sentiment = 'positive' THEN 1 END)::float / NULLIF(COUNT(*), 0) * 100 AS positive_pct,
      COUNT(CASE WHEN ma.sentiment = 'negative' THEN 1 END)::float / NULLIF(COUNT(*), 0) * 100 AS negative_pct,
      COUNT(CASE WHEN ma.sentiment = 'neutral' THEN 1 END)::float / NULLIF(COUNT(*), 0) * 100 AS neutral_pct,
      COUNT(*)::int AS total_mentions,
      COUNT(DISTINCT v.channel_id)::int AS channel_count,
      ARRAY_AGG(DISTINCT c.name) AS channels,
      COUNT(CASE WHEN p.prediction_type = 'buy' THEN 1 END)::int AS buy_count,
      COUNT(CASE WHEN p.prediction_type = 'sell' THEN 1 END)::int AS sell_count,
      COUNT(CASE WHEN p.prediction_type = 'hold' THEN 1 END)::int AS hold_count
    FROM mentioned_assets ma
    JOIN videos v ON ma.video_id = v.id
    JOIN channels c ON v.channel_id = c.id
    LEFT JOIN predictions p ON p.video_id = v.id AND p.mentioned_asset_id = ma.id
    WHERE v.published_at >= NOW() - INTERVAL '1 day' * ${days}
      AND ma.sentiment IS NOT NULL
    GROUP BY ma.asset_name, ma.asset_code, ma.asset_type
    HAVING COUNT(*) >= 2
    ORDER BY COUNT(DISTINCT v.channel_id) DESC, COUNT(*) DESC
    LIMIT 30
  `
  return rows.map((r: any) => {
    const maxPct = Math.max(r.positive_pct || 0, r.negative_pct || 0, r.neutral_pct || 0)
    return { ...r, consensus_score: Math.round(maxPct) }
  }) as AssetConsensus[]
}

// Asset YouTuber Timeline - shows which YouTubers mentioned an asset over time
export async function getAssetTimeline(assetCode: string, days = 30): Promise<AssetTimelineEntry[]> {
  const sql = getDb()
  const rows = await sql`
    SELECT
      c.name AS channel_name,
      c.id AS channel_id,
      c.thumbnail_url AS channel_thumbnail,
      c.category,
      ma.sentiment,
      p.prediction_type,
      v.title AS video_title,
      v.youtube_video_id,
      v.blog_post_url,
      v.published_at
    FROM mentioned_assets ma
    JOIN videos v ON ma.video_id = v.id
    JOIN channels c ON v.channel_id = c.id
    LEFT JOIN predictions p ON p.video_id = v.id AND p.mentioned_asset_id = ma.id
    WHERE ma.asset_code = ${assetCode}
      AND v.published_at >= NOW() - INTERVAL '1 day' * ${days}
    ORDER BY v.published_at DESC
    LIMIT 50
  `
  return rows as AssetTimelineEntry[]
}

// Top Asset Sentiments
export async function getTopAssetSentiments(limit = 10, days = 7): Promise<TopAssetSentiment[]> {
  const sql = getDb()
  const rows = await sql`
    SELECT
      ma.asset_name,
      ma.asset_code,
      ma.asset_type,
      COUNT(CASE WHEN ma.sentiment = 'positive' THEN 1 END)::float / NULLIF(COUNT(*), 0) * 100 AS positive_pct,
      COUNT(CASE WHEN ma.sentiment = 'negative' THEN 1 END)::float / NULLIF(COUNT(*), 0) * 100 AS negative_pct,
      COUNT(CASE WHEN ma.sentiment = 'neutral' THEN 1 END)::float / NULLIF(COUNT(*), 0) * 100 AS neutral_pct,
      COUNT(*)::int AS total_mentions
    FROM mentioned_assets ma
    JOIN videos v ON ma.video_id = v.id
    WHERE v.published_at >= NOW() - INTERVAL '1 day' * ${days}
      AND ma.sentiment IS NOT NULL
    GROUP BY ma.asset_name, ma.asset_code, ma.asset_type
    ORDER BY COUNT(*) DESC
    LIMIT ${limit}
  `
  return rows as TopAssetSentiment[]
}

// Sentiment Trend by Category
export async function getSentimentTrend(days = 30): Promise<SentimentTrendPoint[]> {
  const sql = getDb()
  const rows = await sql`
    SELECT
      v.published_at::date AS date,
      c.category,
      COUNT(CASE WHEN ma.sentiment = 'positive' THEN 1 END)::float / NULLIF(COUNT(*), 0) * 100 AS positive_pct,
      COUNT(CASE WHEN ma.sentiment = 'negative' THEN 1 END)::float / NULLIF(COUNT(*), 0) * 100 AS negative_pct,
      COUNT(CASE WHEN ma.sentiment = 'neutral' THEN 1 END)::float / NULLIF(COUNT(*), 0) * 100 AS neutral_pct
    FROM mentioned_assets ma
    JOIN videos v ON ma.video_id = v.id
    JOIN channels c ON v.channel_id = c.id
    WHERE v.published_at >= NOW() - INTERVAL '1 day' * ${days}
      AND ma.sentiment IS NOT NULL
    GROUP BY v.published_at::date, c.category
    ORDER BY date ASC
  `
  return rows as SentimentTrendPoint[]
}

// Mention Spike Timeline
export async function getMentionSpike(days = 30): Promise<{ asset_name: string; asset_code: string; data: MentionSpikeData[] }[]> {
  const sql = getDb()
  const rows = await sql`
    SELECT
      ma.asset_name,
      ma.asset_code,
      v.published_at::date AS date,
      COUNT(*)::int AS mention_count
    FROM mentioned_assets ma
    JOIN videos v ON ma.video_id = v.id
    WHERE v.published_at >= NOW() - INTERVAL '1 day' * ${days}
      AND ma.asset_code IS NOT NULL
    GROUP BY ma.asset_name, ma.asset_code, v.published_at::date
    ORDER BY ma.asset_name, date
  `
  const grouped = new Map<string, { asset_name: string; asset_code: string; data: any[] }>()
  for (const r of rows as any[]) {
    const key = r.asset_code || r.asset_name
    if (!grouped.has(key)) {
      grouped.set(key, { asset_name: r.asset_name, asset_code: r.asset_code, data: [] })
    }
    grouped.get(key)!.data.push({ date: r.date, mention_count: r.mention_count })
  }

  const result: { asset_name: string; asset_code: string; data: MentionSpikeData[] }[] = []
  for (const [, entry] of grouped) {
    const avg = entry.data.reduce((s: number, d: any) => s + d.mention_count, 0) / Math.max(entry.data.length, 1)
    if (avg < 1) continue
    const hasSpike = entry.data.some((d: any) => d.mention_count >= avg * 2)
    if (!hasSpike && entry.data.length < 3) continue
    entry.data = entry.data.map((d: any) => ({
      ...d,
      avg_count: Math.round(avg * 10) / 10,
      is_spike: d.mention_count >= avg * 2,
    }))
    result.push(entry)
  }
  return result.sort((a, b) => {
    const aMax = Math.max(...a.data.map(d => d.mention_count))
    const bMax = Math.max(...b.data.map(d => d.mention_count))
    return bMax - aMax
  }).slice(0, 8)
}

// Asset Correlation Network - co-occurrence of assets in same video
export async function getAssetCorrelations(days = 14, minOccurrence = 2): Promise<AssetCorrelation[]> {
  const sql = getDb()
  const rows = await sql`
    SELECT
      a1.asset_name AS source,
      a2.asset_name AS target,
      a1.asset_code AS source_code,
      a2.asset_code AS target_code,
      COUNT(DISTINCT a1.video_id)::int AS co_occurrence
    FROM mentioned_assets a1
    JOIN mentioned_assets a2 ON a1.video_id = a2.video_id AND a1.asset_name < a2.asset_name
    JOIN videos v ON a1.video_id = v.id
    WHERE v.published_at >= NOW() - INTERVAL '1 day' * ${days}
      AND a1.asset_code IS NOT NULL
      AND a2.asset_code IS NOT NULL
    GROUP BY a1.asset_name, a2.asset_name, a1.asset_code, a2.asset_code
    HAVING COUNT(DISTINCT a1.video_id) >= ${minOccurrence}
    ORDER BY co_occurrence DESC
    LIMIT 30
  `
  return rows as AssetCorrelation[]
}

export async function getAssetPriceHistory(assetCode: string, days = 60): Promise<{ date: string; price: number }[]> {
  const sql = getDb()
  const rows = await sql`
    SELECT recorded_date::text AS date, price
    FROM asset_prices
    WHERE asset_code = ${assetCode}
      AND recorded_date >= NOW() - INTERVAL '1 day' * ${days}
    ORDER BY recorded_date ASC
  `
  return rows as { date: string; price: number }[]
}
