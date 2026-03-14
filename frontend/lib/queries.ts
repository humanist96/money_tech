import { getDb } from './db'
import type {
  Channel, ChannelType, Platform, VideoWithChannel, DailyStat, AssetMention, MentionedAsset,
  MarketTemperature, ChannelAssetOpinion, AssetConsensus, SentimentTrendPoint,
  MentionSpikeData, PredictionFeedItem, ChannelActivityData, TopAssetSentiment,
  ChannelSpecialtyItem, HotKeyword, HitRateLeaderboardItem,
  AssetTimelineEntry, BuzzAlert, BuzzAlertEnhanced, AssetCorrelation,
  ContrarianSignal, BacktestResult, BacktestTrade,
  HiddenGemChannel, RiskScore, WeeklyReportItem,
  ConflictingAsset, MarketSentimentGauge, ConsensusTimelineEntry,
  CrowdSentiment, AnalystConsensus,
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
    SELECT v.*, json_build_object('name', c.name, 'category', c.category, 'thumbnail_url', c.thumbnail_url, 'telegram_username', c.telegram_username) AS channels
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
    SELECT v.*, json_build_object('name', c.name, 'category', c.category, 'thumbnail_url', c.thumbnail_url, 'telegram_username', c.telegram_username) AS channels
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

// #7 Hit Rate Leaderboard (direction-based)
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
      COUNT(CASE WHEN p.direction_score >= 0.5 THEN 1 END)::int AS accurate_count,
      COUNT(CASE WHEN p.direction_score IS NOT NULL THEN 1 END)::int AS total_predictions,
      COUNT(*)::int AS all_predictions,
      CASE WHEN COUNT(CASE WHEN p.direction_score IS NOT NULL THEN 1 END) > 0
        THEN AVG(p.direction_score)::float
        ELSE NULL END AS hit_rate,
      COALESCE(AVG(p.crowd_accuracy)::float, 0) AS avg_crowd_accuracy,
      COUNT(CASE WHEN p.crowd_accuracy IS NOT NULL THEN 1 END)::int AS crowd_evaluated
    FROM predictions p
    JOIN channels c ON p.channel_id = c.id
    WHERE p.prediction_type IN ('buy', 'sell')
    GROUP BY c.id, c.name, c.thumbnail_url, c.category, c.channel_type, c.prediction_intensity_score
    HAVING COUNT(*) >= 1
    ORDER BY COUNT(CASE WHEN p.direction_score IS NOT NULL THEN 1 END) DESC, AVG(p.direction_score) DESC NULLS LAST
  `

  const result: HitRateLeaderboardItem[] = []
  for (const r of rows as any[]) {
    const recentPreds = await sql`
      SELECT p.prediction_type, p.is_accurate, p.direction_1w, p.direction_1m, p.direction_3m,
             p.direction_score::float, ma.asset_name
      FROM predictions p
      LEFT JOIN mentioned_assets ma ON p.mentioned_asset_id = ma.id
      WHERE p.channel_id = ${r.channel_id}
        AND p.prediction_type IN ('buy', 'sell')
      ORDER BY p.predicted_at DESC NULLS LAST
      LIMIT 5
    `
    result.push({
      ...r,
      hit_rate: Number(r.hit_rate) || 0,
      avg_crowd_accuracy: Number(r.avg_crowd_accuracy) || 0,
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

// #10 Recent Predictions Feed (deduplicated, direction-based)
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
      p.is_accurate,
      p.direction_1w,
      p.direction_1m,
      p.direction_3m,
      p.direction_score::float AS direction_score
    FROM predictions p
    JOIN channels c ON p.channel_id = c.id
    LEFT JOIN mentioned_assets ma ON p.mentioned_asset_id = ma.id
    WHERE p.prediction_type IN ('buy', 'sell')
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

// ═══════════════════════════════════════════════════════════════
// Feature 1: Contrarian Signal - extreme consensus detection
// ═══════════════════════════════════════════════════════════════
export async function getContrarianSignals(days = 30, threshold = 75): Promise<ContrarianSignal[]> {
  const sql = getDb()
  const rows = await sql`
    WITH asset_consensus AS (
      SELECT
        ma.asset_name,
        ma.asset_code,
        ma.asset_type,
        COUNT(CASE WHEN p.prediction_type = 'buy' THEN 1 END)::int AS buy_count,
        COUNT(CASE WHEN p.prediction_type = 'sell' THEN 1 END)::int AS sell_count,
        COUNT(DISTINCT v.channel_id)::int AS channel_count,
        COUNT(*)::int AS total_preds
      FROM predictions p
      JOIN videos v ON p.video_id = v.id
      JOIN mentioned_assets ma ON p.mentioned_asset_id = ma.id
      WHERE v.published_at >= NOW() - INTERVAL '1 day' * ${days}
        AND p.prediction_type IN ('buy', 'sell')
        AND ma.asset_code IS NOT NULL
      GROUP BY ma.asset_name, ma.asset_code, ma.asset_type
      HAVING COUNT(*) >= 3 AND COUNT(DISTINCT v.channel_id) >= 2
    ),
    historical AS (
      SELECT
        ma.asset_code,
        AVG(CASE WHEN ap_1w.price IS NOT NULL AND ma.price_at_mention > 0
          THEN ((ap_1w.price - ma.price_at_mention) / ma.price_at_mention * 100)
          ELSE NULL END)::float AS avg_return_1w,
        AVG(CASE WHEN ap_1m.price IS NOT NULL AND ma.price_at_mention > 0
          THEN ((ap_1m.price - ma.price_at_mention) / ma.price_at_mention * 100)
          ELSE NULL END)::float AS avg_return_1m,
        COUNT(*)::int AS similar_cases,
        CASE WHEN COUNT(CASE WHEN ap_1m.price IS NOT NULL AND ma.price_at_mention > 0 THEN 1 END) > 0
          THEN (COUNT(CASE WHEN ap_1m.price > ma.price_at_mention THEN 1 END)::float /
                NULLIF(COUNT(CASE WHEN ap_1m.price IS NOT NULL AND ma.price_at_mention > 0 THEN 1 END), 0) * 100)
          ELSE NULL END AS rebound_pct
      FROM mentioned_assets ma
      JOIN videos v ON ma.video_id = v.id
      LEFT JOIN asset_prices ap_1w ON ap_1w.asset_code = ma.asset_code
        AND ap_1w.recorded_date = (v.published_at::date + INTERVAL '7 days')::date
      LEFT JOIN asset_prices ap_1m ON ap_1m.asset_code = ma.asset_code
        AND ap_1m.recorded_date = (v.published_at::date + INTERVAL '30 days')::date
      WHERE ma.asset_code IS NOT NULL AND ma.price_at_mention IS NOT NULL
      GROUP BY ma.asset_code
    )
    SELECT
      ac.asset_name, ac.asset_code, ac.asset_type,
      ac.channel_count,
      CASE WHEN ac.buy_count > ac.sell_count
        THEN ac.buy_count::float / ac.total_preds * 100
        ELSE ac.sell_count::float / ac.total_preds * 100
      END AS consensus_pct,
      CASE WHEN ac.buy_count > ac.sell_count THEN 'buy' ELSE 'sell' END AS consensus_direction,
      h.avg_return_1w AS historical_avg_return_1w,
      h.avg_return_1m AS historical_avg_return_1m,
      COALESCE(h.similar_cases, 0)::int AS similar_cases,
      h.rebound_pct AS rebound_probability
    FROM asset_consensus ac
    LEFT JOIN historical h ON h.asset_code = ac.asset_code
    WHERE CASE WHEN ac.buy_count > ac.sell_count
      THEN ac.buy_count::float / ac.total_preds * 100
      ELSE ac.sell_count::float / ac.total_preds * 100
    END >= ${threshold}
    ORDER BY CASE WHEN ac.buy_count > ac.sell_count
      THEN ac.buy_count::float / ac.total_preds * 100
      ELSE ac.sell_count::float / ac.total_preds * 100
    END DESC
    LIMIT 15
  `
  return (rows as any[]).map(r => ({
    ...r,
    consensus_pct: Number(r.consensus_pct) || 0,
    rebound_probability: r.rebound_probability != null ? Number(r.rebound_probability) : null,
    warning_level: r.consensus_pct >= 90 ? 'high' as const :
                   r.consensus_pct >= 80 ? 'medium' as const : 'low' as const,
  }))
}

// ═══════════════════════════════════════════════════════════════
// Feature 2: Enhanced Buzz Alert - with growth rate
// ═══════════════════════════════════════════════════════════════
export async function getEnhancedBuzzAlerts(hours = 48): Promise<BuzzAlertEnhanced[]> {
  const sql = getDb()
  const rows = await sql`
    WITH recent AS (
      SELECT
        ma.asset_name, ma.asset_code, ma.asset_type,
        COUNT(DISTINCT v.channel_id)::int AS channel_count,
        COUNT(*)::int AS mention_count,
        ARRAY_AGG(DISTINCT c.name) AS channels,
        MODE() WITHIN GROUP (ORDER BY ma.sentiment) AS dominant_sentiment,
        MAX(v.published_at) AS latest_at
      FROM mentioned_assets ma
      JOIN videos v ON ma.video_id = v.id
      JOIN channels c ON v.channel_id = c.id
      WHERE v.published_at >= NOW() - INTERVAL '1 hour' * ${hours}
        AND ma.asset_code IS NOT NULL AND ma.sentiment IS NOT NULL
      GROUP BY ma.asset_name, ma.asset_code, ma.asset_type
      HAVING COUNT(DISTINCT v.channel_id) >= 2
    ),
    prev_week AS (
      SELECT
        ma.asset_code,
        COUNT(*)::int AS prev_mentions
      FROM mentioned_assets ma
      JOIN videos v ON ma.video_id = v.id
      WHERE v.published_at >= NOW() - INTERVAL '9 days'
        AND v.published_at < NOW() - INTERVAL '2 days'
        AND ma.asset_code IS NOT NULL
      GROUP BY ma.asset_code
    )
    SELECT
      r.*,
      COALESCE(pw.prev_mentions, 0)::int AS prev_week_mentions,
      CASE WHEN COALESCE(pw.prev_mentions, 0) > 0
        THEN ((r.mention_count::float - pw.prev_mentions) / pw.prev_mentions * 100)
        ELSE 999 END AS growth_rate,
      (r.channel_count * 3 + r.mention_count +
        CASE WHEN COALESCE(pw.prev_mentions, 0) > 0
          THEN LEAST((r.mention_count::float / pw.prev_mentions - 1) * 10, 30)
          ELSE 15 END
      )::float AS weighted_score
    FROM recent r
    LEFT JOIN prev_week pw ON pw.asset_code = r.asset_code
    ORDER BY weighted_score DESC
    LIMIT 10
  `
  return rows as any[]
}

// ═══════════════════════════════════════════════════════════════
// Feature 3: YouTuber Backtesting Simulator
// ═══════════════════════════════════════════════════════════════
export async function getBacktestData(channelId: string): Promise<BacktestResult | null> {
  const sql = getDb()

  const channelRow = await sql`SELECT id, name, thumbnail_url FROM channels WHERE id = ${channelId} LIMIT 1`
  if (channelRow.length === 0) return null
  const channel = channelRow[0] as any

  const trades = await sql`
    SELECT
      ma.asset_name, ma.asset_code,
      p.prediction_type,
      ma.price_at_mention AS entry_price,
      p.actual_price_after_1w AS exit_price_1w,
      p.actual_price_after_1m AS exit_price_1m,
      CASE WHEN ma.price_at_mention > 0 AND p.actual_price_after_1w IS NOT NULL
        THEN ((p.actual_price_after_1w - ma.price_at_mention) / ma.price_at_mention * 100)
        ELSE NULL END AS return_1w,
      CASE WHEN ma.price_at_mention > 0 AND p.actual_price_after_1m IS NOT NULL
        THEN ((p.actual_price_after_1m - ma.price_at_mention) / ma.price_at_mention * 100)
        ELSE NULL END AS return_1m,
      p.predicted_at
    FROM predictions p
    JOIN mentioned_assets ma ON p.mentioned_asset_id = ma.id
    WHERE p.channel_id = ${channelId}
      AND p.prediction_type IN ('buy', 'sell')
      AND ma.price_at_mention IS NOT NULL
    ORDER BY p.predicted_at ASC
  `

  const tradeList: BacktestTrade[] = (trades as any[]).map(t => ({
    asset_name: t.asset_name,
    asset_code: t.asset_code,
    prediction_type: t.prediction_type,
    entry_price: t.entry_price ? Number(t.entry_price) : null,
    exit_price_1w: t.exit_price_1w ? Number(t.exit_price_1w) : null,
    exit_price_1m: t.exit_price_1m ? Number(t.exit_price_1m) : null,
    return_1w: t.return_1w ? Number(t.return_1w) : null,
    return_1m: t.return_1m ? Number(t.return_1m) : null,
    predicted_at: t.predicted_at,
  }))

  const initialAmount = 10000000
  let cumReturn = 0
  let wins = 0
  let total = 0
  let maxDrawdown = 0
  let peak = 0

  for (const trade of tradeList) {
    const ret = trade.return_1m ?? trade.return_1w
    if (ret === null) continue
    const adjustedReturn = trade.prediction_type === 'sell' ? -ret : ret
    cumReturn += adjustedReturn
    total++
    if (adjustedReturn > 0) wins++
    if (cumReturn > peak) peak = cumReturn
    const drawdown = peak - cumReturn
    if (drawdown > maxDrawdown) maxDrawdown = drawdown
  }

  return {
    channel_id: channelId,
    channel_name: channel.name,
    channel_thumbnail: channel.thumbnail_url,
    initial_amount: initialAmount,
    final_amount: Math.round(initialAmount * (1 + cumReturn / 100)),
    total_return_pct: Math.round(cumReturn * 100) / 100,
    benchmark_return_pct: 0,
    total_trades: total,
    win_rate: total > 0 ? Math.round((wins / total) * 10000) / 100 : 0,
    max_drawdown: Math.round(maxDrawdown * 100) / 100,
    trades: tradeList,
  }
}

// ═══════════════════════════════════════════════════════════════
// Feature 4: Consensus Timeline (per asset)
// ═══════════════════════════════════════════════════════════════
export async function getConsensusTimeline(assetCode: string, days = 60): Promise<ConsensusTimelineEntry[]> {
  const sql = getDb()
  const rows = await sql`
    SELECT
      c.name AS channel_name,
      c.id AS channel_id,
      c.thumbnail_url AS channel_thumbnail,
      p.prediction_type,
      ma.sentiment,
      v.published_at,
      v.title AS video_title
    FROM mentioned_assets ma
    JOIN videos v ON ma.video_id = v.id
    JOIN channels c ON v.channel_id = c.id
    LEFT JOIN predictions p ON p.video_id = v.id AND p.mentioned_asset_id = ma.id
    WHERE ma.asset_code = ${assetCode}
      AND v.published_at >= NOW() - INTERVAL '1 day' * ${days}
    ORDER BY v.published_at ASC
  `
  return rows as ConsensusTimelineEntry[]
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

// ═══════════════════════════════════════════════════════════════
// Feature 5: Daily Briefing data
// ═══════════════════════════════════════════════════════════════
export async function getDailyBriefingData(): Promise<{
  topMentioned: AssetMention[]
  conflicts: ConflictingAsset[]
  newRecommendations: PredictionFeedItem[]
  temperature: MarketTemperature[]
}> {
  const sql = getDb()

  const [topMentioned, temperature, newRecommendations] = await Promise.all([
    getAssetMentions(1),
    getMarketTemperature(1),
    getRecentPredictions(10),
  ])

  const conflictRows = await sql`
    SELECT
      ma.asset_name, ma.asset_code,
      ARRAY_AGG(DISTINCT CASE WHEN p.prediction_type = 'buy' THEN c.name END) FILTER (WHERE p.prediction_type = 'buy') AS buy_channels,
      ARRAY_AGG(DISTINCT CASE WHEN p.prediction_type = 'sell' THEN c.name END) FILTER (WHERE p.prediction_type = 'sell') AS sell_channels
    FROM predictions p
    JOIN videos v ON p.video_id = v.id
    JOIN channels c ON p.channel_id = c.id
    JOIN mentioned_assets ma ON p.mentioned_asset_id = ma.id
    WHERE v.published_at >= NOW() - INTERVAL '2 days'
      AND p.prediction_type IN ('buy', 'sell')
      AND ma.asset_code IS NOT NULL
    GROUP BY ma.asset_name, ma.asset_code
    HAVING COUNT(DISTINCT CASE WHEN p.prediction_type = 'buy' THEN c.id END) >= 1
       AND COUNT(DISTINCT CASE WHEN p.prediction_type = 'sell' THEN c.id END) >= 1
    ORDER BY COUNT(*) DESC
    LIMIT 5
  `

  const conflicts: ConflictingAsset[] = (conflictRows as any[]).map(r => ({
    asset_name: r.asset_name,
    asset_code: r.asset_code,
    buy_channels: (r.buy_channels || []).filter(Boolean),
    sell_channels: (r.sell_channels || []).filter(Boolean),
  }))

  return {
    topMentioned: topMentioned.slice(0, 5),
    conflicts,
    newRecommendations,
    temperature,
  }
}

// ═══════════════════════════════════════════════════════════════
// Feature 6: Hidden Gem Channel Discovery
// ═══════════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════════
// Feature 8: Risk Scoreboard
// ═══════════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════════
// Feature 9: Weekly Winner/Loser Report
// ═══════════════════════════════════════════════════════════════
export async function getWeeklyReport(): Promise<{ winners: WeeklyReportItem[]; losers: WeeklyReportItem[]; bestCall: any; worstCall: any }> {
  const sql = getDb()
  const rows = await sql`
    SELECT
      c.id AS channel_id,
      c.name AS channel_name,
      c.thumbnail_url AS channel_thumbnail,
      c.category,
      COUNT(CASE WHEN p.direction_score >= 0.5 THEN 1 END)::int AS accurate_count,
      COUNT(CASE WHEN p.direction_score IS NOT NULL THEN 1 END)::int AS total_count,
      CASE WHEN COUNT(CASE WHEN p.direction_score IS NOT NULL THEN 1 END) > 0
        THEN (COUNT(CASE WHEN p.direction_score >= 0.5 THEN 1 END)::float /
              COUNT(CASE WHEN p.direction_score IS NOT NULL THEN 1 END) * 100)
        ELSE 0 END AS accuracy_pct
    FROM predictions p
    JOIN channels c ON p.channel_id = c.id
    WHERE p.predicted_at >= NOW() - INTERVAL '7 days'
      AND p.prediction_type IN ('buy', 'sell')
      AND p.direction_score IS NOT NULL
    GROUP BY c.id, c.name, c.thumbnail_url, c.category
    HAVING COUNT(CASE WHEN p.direction_score IS NOT NULL THEN 1 END) >= 1
    ORDER BY accuracy_pct DESC, total_count DESC
  `

  const all = (rows as any[]).map(r => ({
    channel_id: r.channel_id,
    channel_name: r.channel_name,
    channel_thumbnail: r.channel_thumbnail,
    category: r.category,
    accurate_count: r.accurate_count,
    total_count: r.total_count,
    accuracy_pct: Math.round(Number(r.accuracy_pct) * 10) / 10,
    best_call: null,
    worst_call: null,
  }))

  const bestCallRows = await sql`
    SELECT
      c.name AS channel_name,
      ma.asset_name,
      p.prediction_type,
      CASE WHEN ma.price_at_mention > 0 AND p.actual_price_after_1w IS NOT NULL
        THEN ((p.actual_price_after_1w - ma.price_at_mention) / ma.price_at_mention * 100)
        ELSE NULL END AS return_pct
    FROM predictions p
    JOIN channels c ON p.channel_id = c.id
    JOIN mentioned_assets ma ON p.mentioned_asset_id = ma.id
    WHERE p.predicted_at >= NOW() - INTERVAL '7 days'
      AND p.prediction_type IN ('buy', 'sell')
      AND ma.price_at_mention > 0
      AND p.actual_price_after_1w IS NOT NULL
    ORDER BY CASE WHEN p.prediction_type = 'buy'
      THEN (p.actual_price_after_1w - ma.price_at_mention) / ma.price_at_mention
      ELSE (ma.price_at_mention - p.actual_price_after_1w) / ma.price_at_mention
    END DESC
    LIMIT 1
  `

  const worstCallRows = await sql`
    SELECT
      c.name AS channel_name,
      ma.asset_name,
      p.prediction_type,
      CASE WHEN ma.price_at_mention > 0 AND p.actual_price_after_1w IS NOT NULL
        THEN ((p.actual_price_after_1w - ma.price_at_mention) / ma.price_at_mention * 100)
        ELSE NULL END AS return_pct
    FROM predictions p
    JOIN channels c ON p.channel_id = c.id
    JOIN mentioned_assets ma ON p.mentioned_asset_id = ma.id
    WHERE p.predicted_at >= NOW() - INTERVAL '7 days'
      AND p.prediction_type IN ('buy', 'sell')
      AND ma.price_at_mention > 0
      AND p.actual_price_after_1w IS NOT NULL
    ORDER BY CASE WHEN p.prediction_type = 'buy'
      THEN (p.actual_price_after_1w - ma.price_at_mention) / ma.price_at_mention
      ELSE (ma.price_at_mention - p.actual_price_after_1w) / ma.price_at_mention
    END ASC
    LIMIT 1
  `

  return {
    winners: all.slice(0, 5),
    losers: all.slice(-5).reverse(),
    bestCall: bestCallRows[0] || null,
    worstCall: worstCallRows[0] || null,
  }
}

// ═══════════════════════════════════════════════════════════════
// Feature 10: Enhanced Market Sentiment Gauge
// ═══════════════════════════════════════════════════════════════
export async function getMarketSentimentGauge(): Promise<MarketSentimentGauge> {
  const sql = getDb()
  const categoryScores = await getMarketTemperature(7)
  const overallScore = categoryScores.length > 0
    ? categoryScores.reduce((sum, d) => sum + d.temperature * d.total_count, 0) /
      Math.max(categoryScores.reduce((sum, d) => sum + d.total_count, 0), 1)
    : 50

  const historicalRows = await sql`
    SELECT
      v.published_at::date AS date,
      ((COUNT(CASE WHEN ma.sentiment = 'positive' THEN 1 END)::float -
        COUNT(CASE WHEN ma.sentiment = 'negative' THEN 1 END)::float) /
        NULLIF(COUNT(*), 0) * 50 + 50) AS score
    FROM mentioned_assets ma
    JOIN videos v ON ma.video_id = v.id
    WHERE v.published_at >= NOW() - INTERVAL '90 days'
      AND ma.sentiment IS NOT NULL
    GROUP BY v.published_at::date
    HAVING COUNT(*) >= 5
    ORDER BY date ASC
  `

  const extremes = (historicalRows as any[])
    .filter(r => Number(r.score) >= 80 || Number(r.score) <= 20)
    .map(r => ({
      date: r.date,
      score: Math.round(Number(r.score)),
      actual_market_1m: null,
    }))

  const warning = overallScore >= 80
    ? `탐욕지수 ${Math.round(overallScore)} - 과열 주의`
    : overallScore <= 20
      ? `공포지수 ${Math.round(overallScore)} - 역발상 매수 시점?`
      : null

  return {
    overall_score: Math.round(overallScore),
    category_scores: categoryScores,
    historical_extremes: extremes.slice(-5),
    current_warning: warning,
  }
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

// ============================================================
// Crowd Sentiment (Naver Discussion Board)
// ============================================================

export async function getCrowdSentiment(stockCode: string, days: number = 7): Promise<CrowdSentiment[]> {
  const sql = getDb()
  const rows = await sql`
    SELECT * FROM crowd_sentiment
    WHERE stock_code = ${stockCode}
    AND period_start >= NOW() - (${days} || ' days')::interval
    ORDER BY period_start DESC
  `
  return rows as unknown as CrowdSentiment[]
}

export async function getCrowdSentimentLatest(limit: number = 20): Promise<CrowdSentiment[]> {
  const sql = getDb()
  const rows = await sql`
    SELECT DISTINCT ON (stock_code) *
    FROM crowd_sentiment
    ORDER BY stock_code, period_start DESC
    LIMIT ${limit}
  `
  return rows as unknown as CrowdSentiment[]
}

export async function getCrowdSentimentTrend(stockCode: string, days: number = 30): Promise<CrowdSentiment[]> {
  const sql = getDb()
  const rows = await sql`
    SELECT * FROM crowd_sentiment
    WHERE stock_code = ${stockCode}
    AND period_start >= NOW() - (${days} || ' days')::interval
    ORDER BY period_start ASC
  `
  return rows as unknown as CrowdSentiment[]
}

// ============================================================
// Analyst Consensus
// ============================================================

export async function getAnalystConsensus(assetCode: string): Promise<AnalystConsensus | null> {
  const sql = getDb()
  const rows = await sql`
    SELECT
      p.target_price,
      p.prediction_type,
      v.firm_name,
      p.predicted_at
    FROM predictions p
    JOIN videos v ON p.video_id = v.id
    JOIN mentioned_assets ma ON p.mentioned_asset_id = ma.id
    WHERE ma.asset_code = ${assetCode}
    AND v.platform = 'analyst_report'
    AND p.predicted_at >= NOW() - INTERVAL '90 days'
    ORDER BY p.predicted_at DESC
  ` as any[]

  if (rows.length === 0) return null

  const targetPrices = rows
    .map((r: any) => r.target_price)
    .filter((p: any): p is number => p != null && p > 0)

  const recommendations = rows.map((r: any) => ({
    firm_name: r.firm_name || '',
    recommendation: r.prediction_type || '',
    target_price: r.target_price,
    published_at: r.predicted_at,
  }))

  return {
    asset_name: '',
    asset_code: assetCode,
    avg_target_price: targetPrices.length > 0 ? targetPrices.reduce((a: number, b: number) => a + b, 0) / targetPrices.length : null,
    median_target_price: targetPrices.length > 0 ? targetPrices.sort((a: number, b: number) => a - b)[Math.floor(targetPrices.length / 2)] : null,
    max_target_price: targetPrices.length > 0 ? Math.max(...targetPrices) : null,
    min_target_price: targetPrices.length > 0 ? Math.min(...targetPrices) : null,
    firm_count: new Set(rows.map((r: any) => r.firm_name)).size,
    buy_count: rows.filter((r: any) => r.prediction_type === 'buy').length,
    sell_count: rows.filter((r: any) => r.prediction_type === 'sell').length,
    hold_count: rows.filter((r: any) => r.prediction_type === 'hold').length,
    recommendations,
  }
}

export async function getAnalystReports(limit: number = 20): Promise<VideoWithChannel[]> {
  const sql = getDb()
  const rows = await sql`
    SELECT v.*, json_build_object('name', c.name, 'category', c.category, 'thumbnail_url', c.thumbnail_url, 'telegram_username', c.telegram_username) AS channels
    FROM videos v
    JOIN channels c ON v.channel_id = c.id
    WHERE v.platform = 'analyst_report'
    ORDER BY v.published_at DESC NULLS LAST
    LIMIT ${limit}
  `
  return rows as unknown as VideoWithChannel[]
}

