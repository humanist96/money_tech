export type ChannelType = 'predictor' | 'leader' | 'analyst' | 'media' | 'unknown'

export interface ClassificationDetails {
  p1_density: number
  p2_action_intensity: number
  p3_concentration: number
  p4_price_target: number
  p5_sentiment_bias: number
  total_videos_analyzed: number
  period_start: string | null
  period_end: string | null
  reason?: string
}

export type Platform = 'youtube' | 'naver_blog' | 'telegram' | 'analyst_report' | 'naver_discussion'

export interface Channel {
  id: string
  youtube_channel_id: string | null
  name: string
  category: 'stock' | 'coin' | 'real_estate' | 'economy'
  platform: Platform
  blog_id: string | null
  blog_url: string | null
  subscriber_count: number | null
  total_view_count: number | null
  video_count: number | null
  thumbnail_url: string | null
  description: string | null
  hit_rate: number | null
  channel_type: ChannelType
  prediction_intensity_score: number | null
  classification_details: ClassificationDetails | null
  classification_updated_at: string | null
  telegram_username: string | null
  telegram_channel_id: number | null
  firm_code: string | null
  created_at: string
  updated_at: string
}

export const PLATFORM_CONFIG: Record<Platform, { label: string; icon: string; color: string; badge: string }> = {
  youtube: { label: 'YouTube', icon: '▶', color: '#ff0000', badge: 'bg-red-500/20 text-red-400 border-red-500/30' },
  naver_blog: { label: '블로그', icon: '✎', color: '#03c75a', badge: 'bg-green-500/20 text-green-400 border-green-500/30' },
  telegram: { label: '텔레그램', icon: '✈', color: '#0088cc', badge: 'bg-sky-500/20 text-sky-400 border-sky-500/30' },
  analyst_report: { label: '애널리스트', icon: '📊', color: '#1a56db', badge: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' },
  naver_discussion: { label: '종목토론', icon: '💬', color: '#f59e0b', badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
}

export const CHANNEL_TYPE_CONFIG: Record<ChannelType, { label: string; color: string; badge: string }> = {
  predictor: { label: '예측형', color: '#f97316', badge: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  leader: { label: '리딩방', color: '#ef4444', badge: 'bg-red-500/20 text-red-400 border-red-500/30' },
  analyst: { label: '해설형', color: '#3b82f6', badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  media: { label: '미디어', color: '#6b7280', badge: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
  unknown: { label: '미분류', color: '#4b5563', badge: 'bg-gray-600/20 text-gray-500 border-gray-600/30' },
}

export interface Video {
  id: string
  channel_id: string
  youtube_video_id: string | null
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
  platform: Platform
  blog_post_url: string | null
  content_text: string | null
  telegram_message_id: number | null
  report_url: string | null
  analyst_name: string | null
  firm_name: string | null
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
  previous_target_price: number | null
  confidence: string | null
  reason: string | null
  predicted_at: string | null
  evaluation_date: string | null
  actual_price_after_1w: number | null
  actual_price_after_1m: number | null
  actual_price_after_3m: number | null
  is_accurate: boolean | null
  direction_1w: boolean | null
  direction_1m: boolean | null
  direction_3m: boolean | null
  direction_score: number | null
  created_at: string
}

export interface CrowdSentiment {
  id: string
  stock_code: string
  stock_name: string
  period_start: string
  period_end: string
  total_posts: number
  filtered_posts: number
  positive_count: number
  negative_count: number
  neutral_count: number
  bullish_ratio: number | null
  sentiment_score: number | null
  top_keywords: { keyword: string; count: number }[] | null
  sample_posts: { title: string; views: number; sentiment: string }[] | null
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
  stock: '#ff5757',
  coin: '#ffb84d',
  real_estate: '#22c997',
  economy: '#7c6cf0',
}

export interface MarketTemperature {
  category: string
  positive_count: number
  negative_count: number
  neutral_count: number
  total_count: number
  temperature: number
}

export interface ChannelAssetOpinion {
  channel_id: string
  channel_name: string
  asset_name: string
  asset_code: string
  sentiment: string
  mention_count: number
}

export interface AssetConsensus {
  asset_name: string
  asset_code: string
  asset_type: string
  positive_pct: number
  negative_pct: number
  neutral_pct: number
  total_mentions: number
  channel_count: number
  channels: string[]
  buy_count: number
  sell_count: number
  hold_count: number
  consensus_score: number
}

export interface SentimentTrendPoint {
  date: string
  category: string
  positive_pct: number
  negative_pct: number
  neutral_pct: number
}

export interface MentionSpikeData {
  date: string
  mention_count: number
  avg_count: number
  is_spike: boolean
}

export interface PredictionFeedItem {
  id: string
  channel_name: string
  channel_thumbnail: string | null
  channel_category: string
  asset_name: string
  asset_code: string | null
  prediction_type: 'buy' | 'sell' | 'hold' | null
  reason: string | null
  predicted_at: string | null
  is_accurate: boolean | null
  direction_1w: boolean | null
  direction_1m: boolean | null
  direction_3m: boolean | null
  direction_score: number | null
}

export interface ChannelActivityData {
  channel_id: string
  channel_name: string
  category: string
  date: string
  video_count: number
}

export interface TopAssetSentiment {
  asset_name: string
  asset_code: string
  asset_type: string
  positive_pct: number
  negative_pct: number
  neutral_pct: number
  total_mentions: number
}

export interface ChannelSpecialtyItem {
  asset_name: string
  asset_code: string | null
  mention_count: number
  sentiment: string
}

export interface HotKeyword {
  keyword: string
  count: number
  prev_count: number
  rank_change: number
}

export interface HitRateLeaderboardItem {
  channel_id: string
  channel_name: string
  channel_thumbnail: string | null
  category: string
  channel_type: ChannelType
  pis: number | null
  hit_rate: number
  total_predictions: number
  all_predictions: number
  accurate_count: number
  avg_crowd_accuracy: number | null
  crowd_evaluated: number
  recent_predictions: Array<{
    prediction_type: string
    is_accurate: boolean | null
    asset_name: string
    direction_score: number | null
  }>
}

// Channel Prediction Profile (dashboard)
export interface PredictionProfile {
  channel_id: string
  channel_name: string
  channel_thumbnail: string | null
  category: string
  buy_count: number
  sell_count: number
  hold_count: number
  total: number
}

// Asset YouTuber Timeline
export interface AssetTimelineEntry {
  channel_name: string
  channel_id: string
  channel_thumbnail: string | null
  category: string
  sentiment: string
  prediction_type: string | null
  video_title: string
  youtube_video_id: string
  blog_post_url: string | null
  published_at: string
}

// Buzz Alert
export interface BuzzAlert {
  asset_name: string
  asset_code: string
  asset_type: string
  channel_count: number
  mention_count: number
  channels: string[]
  dominant_sentiment: string
  latest_at: string
}

// Asset Correlation Network
export interface AssetCorrelation {
  source: string
  target: string
  source_code: string
  target_code: string
  co_occurrence: number
}

// YouTube Search types
export interface SearchResult {
  videoId: string
  title: string
  channelTitle: string
  channelId: string
  publishedAt: string
  viewCount: number
  duration: number
  thumbnailUrl: string
  isRegisteredChannel: boolean
  registeredChannelId?: string
}

export interface VideoAnalysis {
  youtube_video_id: string
  title: string | null
  channel_name: string | null
  channel_id: string | null
  summary: string | null
  sentiment: 'positive' | 'negative' | 'neutral' | null
  mentioned_assets: AnalysisMentionedAsset[]
  predictions: AnalysisPrediction[]
  key_points: string[]
  analyzed_at: string
}

export interface AnalysisMentionedAsset {
  name: string
  code: string | null
  type: 'stock' | 'coin' | 'real_estate'
  sentiment: 'positive' | 'negative' | 'neutral'
}

export interface AnalysisPrediction {
  type: 'buy' | 'sell' | 'hold'
  asset: string
  reason: string
}

// Feature 1: Contrarian Signal
// Analyst Consensus (cross-platform comparison)
export interface AnalystConsensus {
  asset_name: string
  asset_code: string
  avg_target_price: number | null
  median_target_price: number | null
  max_target_price: number | null
  min_target_price: number | null
  firm_count: number
  buy_count: number
  sell_count: number
  hold_count: number
  recommendations: {
    firm_name: string
    recommendation: string
    target_price: number | null
    published_at: string | null
  }[]
}

export interface ContrarianSignal {
  asset_name: string
  asset_code: string
  asset_type: string
  consensus_pct: number
  consensus_direction: 'buy' | 'sell'
  channel_count: number
  historical_avg_return_1w: number | null
  historical_avg_return_1m: number | null
  similar_cases: number
  rebound_probability: number | null
  warning_level: 'high' | 'medium' | 'low'
}

// Feature 2: Enhanced Buzz Alert (extends existing BuzzAlert)
export interface BuzzAlertEnhanced extends BuzzAlert {
  prev_week_mentions: number
  growth_rate: number
  weighted_score: number
}

// Feature 3: YouTuber Backtest Result
export interface BacktestResult {
  channel_id: string
  channel_name: string
  channel_thumbnail: string | null
  initial_amount: number
  final_amount: number
  total_return_pct: number
  benchmark_return_pct: number
  total_trades: number
  win_rate: number
  max_drawdown: number
  trades: BacktestTrade[]
}

export interface BacktestTrade {
  asset_name: string
  asset_code: string
  prediction_type: 'buy' | 'sell'
  entry_price: number | null
  exit_price_1w: number | null
  exit_price_1m: number | null
  return_1w: number | null
  return_1m: number | null
  predicted_at: string
}

// Feature 4: Consensus Timeline
export interface ConsensusTimelineEntry {
  channel_name: string
  channel_id: string
  channel_thumbnail: string | null
  prediction_type: string | null
  sentiment: string
  published_at: string
  video_title: string
}

// Feature 5: Daily Briefing
export interface DailyBriefing {
  date: string
  top_mentioned: AssetMention[]
  conflicting_assets: ConflictingAsset[]
  new_recommendations: PredictionFeedItem[]
  market_temperature: MarketTemperature[]
}

export interface ConflictingAsset {
  asset_name: string
  asset_code: string
  buy_channels: string[]
  sell_channels: string[]
}

// Feature 6: Hidden Gem Channel
export interface HiddenGemChannel {
  channel_id: string
  channel_name: string
  channel_thumbnail: string | null
  category: string
  subscriber_count: number | null
  hit_rate: number
  total_predictions: number
  accurate_count: number
  prediction_intensity_score: number | null
  radar: {
    aggressiveness: number
    conservatism: number
    diversity: number
    accuracy: number
    depth: number
  }
}

// Feature 8: Risk Scoreboard
export interface RiskScore {
  asset_name: string
  asset_code: string
  asset_type: string
  score: number
  consensus_ratio: number
  mention_trend: 'rising' | 'falling' | 'stable'
  mention_count: number
  weighted_opinion: number
  sentiment_shift: 'improving' | 'worsening' | 'stable'
  signal_color: 'green' | 'yellow' | 'red'
  details: {
    consensus_score: number
    frequency_score: number
    expert_score: number
    sentiment_score: number
  }
}

// Feature 9: Weekly Winner/Loser Report
export interface WeeklyReportItem {
  channel_id: string
  channel_name: string
  channel_thumbnail: string | null
  category: string
  accurate_count: number
  total_count: number
  accuracy_pct: number
  best_call: {
    asset_name: string
    prediction_type: string
    return_pct: number | null
  } | null
  worst_call: {
    asset_name: string
    prediction_type: string
    return_pct: number | null
  } | null
}

// Feature 10: Market Sentiment Gauge (enhanced)
export interface MarketSentimentGauge {
  overall_score: number
  category_scores: MarketTemperature[]
  historical_extremes: {
    date: string
    score: number
    actual_market_1m: number | null
  }[]
  current_warning: string | null
}

export interface PortfolioResponse {
  combinedHitRate: number | null
  totalPredictions: number
  accurateCount: number
  conflicts: ConflictingAsset[]
  recentPredictions: {
    id: string
    channel_name: string
    asset_name: string
    asset_code: string | null
    prediction_type: string
    direction_score: number | null
    predicted_at: string | null
  }[]
}

export interface BlogSearchResult {
  title: string
  link: string
  description: string
  bloggerName: string
  bloggerLink: string
  postDate: string
}

export interface SearchReport {
  overall_summary: string
  consensus: string
  sentiment_distribution: {
    positive: number
    negative: number
    neutral: number
  }
  key_arguments: string[]
  conflicts: string[]
}

// NotebookLM types
export interface NotebookItem {
  id: string
  title: string
}

export interface NotebookSource {
  id: string
  title: string
  type: string
  status: string
}

export interface NotebookDetail {
  id: string
  title: string
  sources: NotebookSource[]
}

export interface NotebookChatMessage {
  role: 'user' | 'assistant'
  content: string
  references?: Array<{ source_id?: string; text: string }>
}

export interface NotebookQuizQuestion {
  question: string
  options: string[]
  answer: string
  explanation: string
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
