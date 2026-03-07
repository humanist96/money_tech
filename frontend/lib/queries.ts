import { getDb } from './db'
import type { Channel, VideoWithChannel, DailyStat } from './types'

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
