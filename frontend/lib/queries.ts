import { supabase } from './supabase'
import type { Channel, VideoWithChannel, DailyStat } from './types'

export async function getChannels(category?: string): Promise<Channel[]> {
  let query = supabase
    .from('channels')
    .select('*')
    .order('subscriber_count', { ascending: false })

  if (category) {
    query = query.eq('category', category)
  }

  const { data, error } = await query
  if (error) throw new Error(`Failed to fetch channels: ${error.message}`)
  return data ?? []
}

export async function getChannelById(id: string): Promise<Channel | null> {
  const { data, error } = await supabase
    .from('channels')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return null
  return data
}

export async function getVideosByChannelId(
  channelId: string,
  limit = 20
): Promise<VideoWithChannel[]> {
  const { data, error } = await supabase
    .from('videos')
    .select('*, channels(name, category, thumbnail_url)')
    .eq('channel_id', channelId)
    .order('published_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(`Failed to fetch videos: ${error.message}`)
  return (data as unknown as VideoWithChannel[]) ?? []
}

export async function getRecentVideos(
  limit = 20,
  category?: string
): Promise<VideoWithChannel[]> {
  let query = supabase
    .from('videos')
    .select('*, channels(name, category, thumbnail_url)')
    .order('published_at', { ascending: false })
    .limit(limit)

  if (category) {
    query = query.eq('channels.category', category)
  }

  const { data, error } = await query
  if (error) throw new Error(`Failed to fetch recent videos: ${error.message}`)
  return (data as unknown as VideoWithChannel[]) ?? []
}

export async function getDailyStats(days = 30): Promise<DailyStat[]> {
  const fromDate = new Date()
  fromDate.setDate(fromDate.getDate() - days)

  const { data, error } = await supabase
    .from('daily_stats')
    .select('*')
    .gte('date', fromDate.toISOString().split('T')[0])
    .order('date', { ascending: true })

  if (error) throw new Error(`Failed to fetch daily stats: ${error.message}`)
  return data ?? []
}

export async function getTopKeywords(
  days = 7
): Promise<{ keyword: string; count: number }[]> {
  const stats = await getDailyStats(days)

  const keywordMap = new Map<string, number>()
  for (const stat of stats) {
    if (stat.top_keywords) {
      for (const kw of stat.top_keywords) {
        keywordMap.set(kw.keyword, (keywordMap.get(kw.keyword) ?? 0) + kw.count)
      }
    }
  }

  return Array.from(keywordMap.entries())
    .map(([keyword, count]) => ({ keyword, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 50)
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
