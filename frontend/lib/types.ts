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
  summary: string | null
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

export interface MentionedAsset {
  id: string
  video_id: string
  asset_type: 'stock' | 'coin' | 'real_estate'
  asset_name: string
  asset_code: string | null
  sentiment: 'positive' | 'negative' | 'neutral' | null
  context_text: string | null
  mentioned_at: number | null
  price_at_mention: number | null
  created_at: string
}

export interface Prediction {
  id: string
  video_id: string
  channel_id: string
  mentioned_asset_id: string | null
  prediction_type: 'buy' | 'sell' | 'hold' | null
  target_price: number | null
  reason: string | null
  predicted_at: string | null
  evaluation_date: string | null
  actual_price_after_1w: number | null
  actual_price_after_1m: number | null
  actual_price_after_3m: number | null
  is_accurate: boolean | null
  created_at: string
}

export interface AssetMention {
  asset_name: string
  asset_code: string
  asset_type: 'stock' | 'coin' | 'real_estate'
  mention_count: number
  positive_count: number
  negative_count: number
  neutral_count: number
  channels: string[]
}

export interface VideoWithAssets extends VideoWithChannel {
  summary: string | null
  mentioned_assets: MentionedAsset[]
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
      mentioned_assets: {
        Row: MentionedAsset
        Insert: Omit<MentionedAsset, 'id' | 'created_at'>
        Update: Partial<Omit<MentionedAsset, 'id'>>
      }
      predictions: {
        Row: Prediction
        Insert: Omit<Prediction, 'id' | 'created_at'>
        Update: Partial<Omit<Prediction, 'id'>>
      }
    }
  }
}
