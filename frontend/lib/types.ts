export interface Channel {
  id: string
  youtube_channel_id: string
  name: string
  category: 'stock' | 'coin' | 'real_estate' | 'economy'
  subscriber_count: number | null
  total_view_count: number | null
  video_count: number | null
  thumbnail_url: string | null
  description: string | null
  created_at: string
  updated_at: string
}

export interface Video {
  id: string
  channel_id: string
  youtube_video_id: string
  title: string
  description: string | null
  view_count: number | null
  like_count: number | null
  comment_count: number | null
  duration: number | null
  published_at: string | null
  thumbnail_url: string | null
  tags: string[] | null
  subtitle_text: string | null
  created_at: string
}

export interface VideoWithChannel extends Video {
  channels: Pick<Channel, 'name' | 'category' | 'thumbnail_url'>
}

export interface DailyStat {
  id: string
  date: string
  category: string
  total_videos: number | null
  top_channels: TopChannelEntry[] | null
  top_keywords: KeywordEntry[] | null
  created_at: string
}

export interface TopChannelEntry {
  channel_id: string
  channel_name: string
  video_count: number
  total_views: number
}

export interface KeywordEntry {
  keyword: string
  count: number
}

export const CATEGORY_LABELS: Record<string, string> = {
  stock: '주식',
  coin: '코인',
  real_estate: '부동산',
  economy: '경제',
}

export const CATEGORY_COLORS: Record<string, string> = {
  stock: '#ef4444',
  coin: '#f59e0b',
  real_estate: '#10b981',
  economy: '#3b82f6',
}

export type Database = {
  public: {
    Tables: {
      channels: {
        Row: Channel
        Insert: Omit<Channel, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Channel, 'id'>>
      }
      videos: {
        Row: Video
        Insert: Omit<Video, 'id' | 'created_at'>
        Update: Partial<Omit<Video, 'id'>>
      }
      daily_stats: {
        Row: DailyStat
        Insert: Omit<DailyStat, 'id' | 'created_at'>
        Update: Partial<Omit<DailyStat, 'id'>>
      }
    }
  }
}
