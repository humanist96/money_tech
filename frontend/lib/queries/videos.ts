import { getDb } from '../db'
import type { VideoWithChannel } from '../types'

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

// Utility functions

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
