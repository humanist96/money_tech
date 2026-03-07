import { getDb } from './db'
import type { Channel, VideoWithChannel, DailyStat, AssetMention, MentionedAsset } from './types'

export async function getChannels(category?: string): Promise<Channel[]> {
  const sql = getDb()
  if (category) {
    return await sql`SELECT * FROM channels WHERE category = ${category} ORDER BY subscriber_count DESC NULLS LAST` as unknown as Channel[]
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
