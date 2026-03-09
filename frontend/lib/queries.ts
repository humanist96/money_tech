import { getDb } from './db'
import type {
  Channel, ChannelType, Platform, VideoWithChannel, DailyStat, AssetMention, MentionedAsset,
  MarketTemperature, ChannelAssetOpinion, AssetConsensus, SentimentTrendPoint,
  MentionSpikeData, PredictionFeedItem, ChannelActivityData, TopAssetSentiment,
  ChannelSpecialtyItem, HotKeyword, HitRateLeaderboardItem,
  AssetTimelineEntry, BuzzAlert, AssetCorrelation,
} from './types'

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

export async function getRecentVideos(limit = 20): Promise<VideoWithChannel[]> {
  const sql = getDb()
  const rows = await sql`
    SELECT v.*, json_build_object('name', c.name, 'category', c.category, 'thumbnail_url', c.thumbnail_url) AS channels
    FROM videos v
    JOIN channels c ON v.channel_id = c.id
    ORDER BY v.published_at DESC NULLS LAST
    LIMIT ${limit}
  `
  return rows as unknown as VideoWithChannel[]
}

export async function getVideosByChannelId(channelId: string, limit = 50): Promise<VideoWithChannel[]> {
  const sql = getDb()
  const rows = await sql`
    SELECT v.*, json_build_object('name', c.name, 'category', c.category, 'thumbnail_url', c.thumbnail_url) AS channels
    FROM videos v
    JOIN channels c ON v.channel_id = c.id
    WHERE v.channel_id = ${channelId}
    ORDER BY v.published_at DESC NULLS LAST
    LIMIT ${limit}
  `
  return rows as unknown as VideoWithChannel[]
}

export async function getDailyStats(days = 30): Promise<DailyStat[]> {
  const sql = getDb()
  const rows = await sql`
    SELECT * FROM daily_stats
    WHERE date >= CURRENT_DATE - ${days}::integer
    ORDER BY date ASC
  `
  return rows as unknown as DailyStat[]
}

export async function getTotalVideoCount(): Promise<number> {
  const sql = getDb()
  const rows = await sql`SELECT count(*)::integer AS count FROM videos`
  return (rows[0] as { count: number }).count
}

export function formatViewCount(count: number | null): string {
  if (count === null) return '-'
  if (count >= 10000) return `${(count / 10000).toFixed(1)}만`
  if (count >= 1000) return `${(count / 1000).toFixed(1)}천`
  return count.toLocaleString()
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null) return '-'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '-'
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 60) return `${minutes}분 전`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}시간 전`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}일 전`
  const months = Math.floor(days / 30)
  return `${months}개월 전`
}

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
    SELECT ma.*, v.title as video_title, v.youtube_video_id, v.published_at as video_published_at,
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

export async function getRecentVideosWithAssets(limit: number = 15) {
  const sql = getDb()
  const videos = await sql`
    SELECT v.*, c.name as channel_name, c.category as channel_category, c.thumbnail_url as channel_thumbnail
    FROM videos v
    JOIN channels c ON v.channel_id = c.id
    ORDER BY v.published_at DESC NULLS LAST
    LIMIT ${limit}
  `

  if (videos.length === 0) return []

  const videoIds = videos.map((v: any) => v.id)
  const assets = await sql`
    SELECT * FROM mentioned_assets WHERE video_id = ANY(${videoIds})
  `

  const assetMap = new Map<string, any[]>()
  for (const a of assets) {
    const list = assetMap.get(a.video_id) || []
    list.push(a)
    assetMap.set(a.video_id, list)
  }

  return videos.map((v: any) => ({
    ...v,
    channels: { name: v.channel_name, category: v.channel_category, thumbnail_url: v.channel_thumbnail },
    mentioned_assets: assetMap.get(v.id) || [],
  }))
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
      COUNT(CASE WHEN p.is_accurate = true THEN 1 END)::int AS accurate_count,
      COUNT(CASE WHEN p.is_accurate IS NOT NULL THEN 1 END)::int AS total_predictions,
      CASE WHEN COUNT(CASE WHEN p.is_accurate IS NOT NULL THEN 1 END) > 0
        THEN COUNT(CASE WHEN p.is_accurate = true THEN 1 END)::float /
             COUNT(CASE WHEN p.is_accurate IS NOT NULL THEN 1 END)
        ELSE NULL END AS hit_rate
    FROM predictions p
    WHERE p.channel_id = ${channelId}
  `
  return rows[0] as { accurate_count: number; total_predictions: number; hit_rate: number | null }
}

export async function getChannelPredictions(channelId: string, limit = 10) {
  const sql = getDb()
  const rows = await sql`
    SELECT p.prediction_type, p.predicted_at, p.is_accurate,
           p.actual_price_after_1w, p.actual_price_after_1m, p.actual_price_after_3m,
           ma.asset_name, ma.asset_code, ma.asset_type, ma.price_at_mention
    FROM predictions p
    JOIN mentioned_assets ma ON p.mentioned_asset_id = ma.id
    WHERE p.channel_id = ${channelId}
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

// #1 Market Temperature - category sentiment aggregation
export async function getMarketTemperature(days = 7): Promise<MarketTemperature[]> {
  const sql = getDb()
  const rows = await sql`
    SELECT
      c.category,
      COUNT(CASE WHEN ma.sentiment = 'positive' THEN 1 END)::int AS positive_count,
      COUNT(CASE WHEN ma.sentiment = 'negative' THEN 1 END)::int AS negative_count,
      COUNT(CASE WHEN ma.sentiment = 'neutral' THEN 1 END)::int AS neutral_count,
      COUNT(*)::int AS total_count
    FROM mentioned_assets ma
    JOIN videos v ON ma.video_id = v.id
    JOIN channels c ON v.channel_id = c.id
    WHERE v.published_at >= NOW() - INTERVAL '1 day' * ${days}
      AND ma.sentiment IS NOT NULL
    GROUP BY c.category
  `
  return rows.map((r: any) => ({
    ...r,
    temperature: r.total_count > 0
      ? ((r.positive_count - r.negative_count) / r.total_count) * 50 + 50
      : 50,
  })) as MarketTemperature[]
}

// #2 Channel x Asset Opinion Matrix
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

// #3 Asset Consensus Score (all channels)
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

// #4 Sentiment Trend by Category
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

// #6 Mention Spike Timeline
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

// #7 Hit Rate Leaderboard (all channels with predictions)
export async function getHitRateLeaderboard(): Promise<HitRateLeaderboardItem[]> {
  const sql = getDb()
  const rows = await sql`
    SELECT
      c.id AS channel_id,
      c.name AS channel_name,
      c.thumbnail_url AS channel_thumbnail,
      c.category,
      c.channel_type,
      c.prediction_intensity_score AS pis,
      COUNT(CASE WHEN p.is_accurate = true THEN 1 END)::int AS accurate_count,
      COUNT(CASE WHEN p.is_accurate IS NOT NULL THEN 1 END)::int AS total_predictions,
      COUNT(*)::int AS all_predictions,
      CASE WHEN COUNT(CASE WHEN p.is_accurate IS NOT NULL THEN 1 END) > 0
        THEN COUNT(CASE WHEN p.is_accurate = true THEN 1 END)::float /
             COUNT(CASE WHEN p.is_accurate IS NOT NULL THEN 1 END)
        ELSE NULL END AS hit_rate,
      COALESCE(ROUND(AVG(p.crowd_accuracy)::numeric, 3), 0) AS avg_crowd_accuracy,
      COUNT(CASE WHEN p.crowd_accuracy IS NOT NULL THEN 1 END)::int AS crowd_evaluated
    FROM predictions p
    JOIN channels c ON p.channel_id = c.id
    GROUP BY c.id, c.name, c.thumbnail_url, c.category, c.channel_type, c.prediction_intensity_score
    HAVING COUNT(*) >= 1
    ORDER BY COUNT(*) DESC, hit_rate DESC NULLS LAST
  `

  const result: HitRateLeaderboardItem[] = []
  for (const r of rows as any[]) {
    const recentPreds = await sql`
      SELECT p.prediction_type, p.is_accurate, ma.asset_name
      FROM predictions p
      LEFT JOIN mentioned_assets ma ON p.mentioned_asset_id = ma.id
      WHERE p.channel_id = ${r.channel_id}
      ORDER BY p.predicted_at DESC NULLS LAST
      LIMIT 5
    `
    result.push({
      ...r,
      hit_rate: r.hit_rate ?? 0,
      recent_predictions: recentPreds as any[],
    })
  }
  return result
}

// #8 Channel Specialty (top mentioned assets)
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

// #9 Hot Keywords Ranking
export async function getHotKeywordsRanking(): Promise<HotKeyword[]> {
  const sql = getDb()
  const todayStats = await sql`
    SELECT top_keywords FROM daily_stats
    WHERE date >= CURRENT_DATE - 1
    ORDER BY date DESC
  `
  const yesterdayStats = await sql`
    SELECT top_keywords FROM daily_stats
    WHERE date >= CURRENT_DATE - 3 AND date < CURRENT_DATE - 1
    ORDER BY date DESC
  `

  const todayMap = new Map<string, number>()
  for (const s of todayStats as any[]) {
    if (s.top_keywords) {
      for (const kw of s.top_keywords) {
        todayMap.set(kw.keyword, (todayMap.get(kw.keyword) ?? 0) + kw.count)
      }
    }
  }

  const yesterdayMap = new Map<string, number>()
  for (const s of yesterdayStats as any[]) {
    if (s.top_keywords) {
      for (const kw of s.top_keywords) {
        yesterdayMap.set(kw.keyword, (yesterdayMap.get(kw.keyword) ?? 0) + kw.count)
      }
    }
  }

  const todayRanked = Array.from(todayMap.entries())
    .map(([keyword, count]) => ({ keyword, count }))
    .sort((a, b) => b.count - a.count)

  const yesterdayRanked = Array.from(yesterdayMap.entries())
    .map(([keyword, count]) => ({ keyword, count }))
    .sort((a, b) => b.count - a.count)

  const yesterdayRankMap = new Map<string, number>()
  yesterdayRanked.forEach((kw, i) => yesterdayRankMap.set(kw.keyword, i + 1))

  return todayRanked.slice(0, 15).map((kw, i) => {
    const prevRank = yesterdayRankMap.get(kw.keyword)
    const prevCount = yesterdayMap.get(kw.keyword) ?? 0
    return {
      keyword: kw.keyword,
      count: kw.count,
      prev_count: prevCount,
      rank_change: prevRank ? prevRank - (i + 1) : 99,
    }
  })
}

// #10 Recent Predictions Feed (deduplicated by channel + asset + type per day)
export async function getRecentPredictions(limit = 20): Promise<PredictionFeedItem[]> {
  const sql = getDb()
  const rows = await sql`
    SELECT DISTINCT ON (c.name, ma.asset_name, p.prediction_type, p.predicted_at::date)
      p.id,
      c.name AS channel_name,
      c.thumbnail_url AS channel_thumbnail,
      c.category AS channel_category,
      COALESCE(ma.asset_name, '(미지정)') AS asset_name,
      ma.asset_code,
      p.prediction_type,
      p.reason,
      p.predicted_at,
      p.is_accurate
    FROM predictions p
    JOIN channels c ON p.channel_id = c.id
    LEFT JOIN mentioned_assets ma ON p.mentioned_asset_id = ma.id
    ORDER BY c.name, ma.asset_name, p.prediction_type, p.predicted_at::date, p.predicted_at DESC
  `
  const sorted = (rows as PredictionFeedItem[])
    .sort((a, b) => new Date(b.predicted_at ?? 0).getTime() - new Date(a.predicted_at ?? 0).getTime())
    .slice(0, limit)
  return sorted
}

// #11 Channel Activity Heatmap
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

// #12 Top Asset Sentiments
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

// Buzz Alert - assets mentioned by 3+ channels in recent hours
export async function getBuzzAlerts(hours = 12): Promise<BuzzAlert[]> {
  const sql = getDb()
  const rows = await sql`
    SELECT
      ma.asset_name,
      ma.asset_code,
      ma.asset_type,
      COUNT(DISTINCT v.channel_id)::int AS channel_count,
      COUNT(*)::int AS mention_count,
      ARRAY_AGG(DISTINCT c.name) AS channels,
      MODE() WITHIN GROUP (ORDER BY ma.sentiment) AS dominant_sentiment,
      MAX(v.published_at) AS latest_at
    FROM mentioned_assets ma
    JOIN videos v ON ma.video_id = v.id
    JOIN channels c ON v.channel_id = c.id
    WHERE v.published_at >= NOW() - INTERVAL '1 hour' * ${hours}
      AND ma.asset_code IS NOT NULL
      AND ma.sentiment IS NOT NULL
    GROUP BY ma.asset_name, ma.asset_code, ma.asset_type
    HAVING COUNT(DISTINCT v.channel_id) >= 2
    ORDER BY channel_count DESC, mention_count DESC
    LIMIT 10
  `
  return rows as BuzzAlert[]
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

// Channel Type Stats - counts per type
export async function getChannelTypeStats() {
  const sql = getDb()
  const rows = await sql`
    SELECT
      channel_type,
      COUNT(*)::int as count,
      ROUND(AVG(prediction_intensity_score)::numeric, 1) as avg_pis,
      ROUND(AVG(hit_rate)::numeric, 3) as avg_hit_rate
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

// #8b Channel Specialties for all channels (used in channel list)
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

