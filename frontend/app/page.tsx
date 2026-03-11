import {
  getChannels, getRecentVideosWithAssets, getDailyStats, getTotalVideoCount,
  getAssetConsensus, getAssetMentions,
  getRecentPredictions, getTopAssetSentiments,
  getBuzzAlerts, getChannelPredictionProfiles,
} from "@/lib/queries"
import type { Channel, DailyStat } from "@/lib/types"
import { CATEGORY_LABELS } from "@/lib/types"
import { StatsCards } from "@/components/dashboard/stats-cards"
import { VideoFeed } from "@/components/dashboard/video-feed"
import { TopMentionsChart } from "@/components/dashboard/top-mentions-chart"
import { ChannelPredictionProfile } from "@/components/dashboard/channel-prediction-profile"
import { ConsensusScore } from "@/components/dashboard/consensus-score"
import { PredictionFeed } from "@/components/dashboard/prediction-feed"
import { AssetSentimentGrid } from "@/components/dashboard/asset-sentiment-grid"
import { BuzzAlertBanner } from "@/components/dashboard/buzz-alert"
import { ChannelTicker } from "@/components/dashboard/asset-ticker"

export const dynamic = "force-dynamic"

async function getDashboardData() {
  try {
    const [channels, videos, stats, totalVideos, consensus, assetMentions, predictions, assetSentiments, buzzAlerts, predictionProfiles] = await Promise.all([
      getChannels(),
      getRecentVideosWithAssets(15),
      getDailyStats(30),
      getTotalVideoCount(),
      getAssetConsensus(30),
      getAssetMentions(30),
      getRecentPredictions(20),
      getTopAssetSentiments(10, 30),
      getBuzzAlerts(48),
      getChannelPredictionProfiles(),
    ])

    const today = new Date().toISOString().split("T")[0]
    const todayStats = stats.filter((s) => new Date(s.date).toISOString().split("T")[0] === today)
    const todayVideos = todayStats.reduce((sum, s) => sum + (s.total_videos ?? 0), 0)

    const last7 = stats.filter((s) => new Date(s.date) >= new Date(Date.now() - 7 * 86400000))
    const catCounts: Record<string, number> = {}
    for (const s of last7) {
      catCounts[s.category] = (catCounts[s.category] ?? 0) + (s.total_videos ?? 0)
    }
    const topCatEntry = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]
    const topCategory = topCatEntry ? CATEGORY_LABELS[topCatEntry[0]] ?? topCatEntry[0] : "-"

    return {
      channels, videos, totalVideos, todayVideos, topCategory,
      consensus, assetMentions, predictions, assetSentiments,
      buzzAlerts, predictionProfiles,
    }
  } catch {
    return {
      channels: [] as Channel[], videos: [] as any[],
      totalVideos: 0, todayVideos: 0, topCategory: "-",
      consensus: [], assetMentions: [], predictions: [],
      assetSentiments: [], buzzAlerts: [], predictionProfiles: [],
    }
  }
}

export default async function DashboardPage() {
  const {
    channels, videos, totalVideos, todayVideos, topCategory,
    consensus, assetMentions, predictions, assetSentiments, buzzAlerts, predictionProfiles,
  } = await getDashboardData()

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="relative flex items-end justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00e8b8]/20 to-[#00e8b8]/5 border border-[#00e8b8]/20 flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00e8b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-th-primary glow-text" style={{ fontFamily: 'var(--font-outfit)' }}>
              대시보드
            </h1>
          </div>
          <p className="text-th-dim text-sm">
            재테크 유튜브 채널 실시간 분석 현황
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-th-dim">
          <span className="w-2 h-2 rounded-full bg-[#00e8b8] pulse-dot" />
          Live
        </div>
      </div>

      {/* Channel Tickers */}
      <div className="space-y-2">
        <ChannelTicker
          channels={channels.filter(c => (c.platform ?? 'youtube') === 'youtube').slice(0, 12)}
          platform="youtube"
        />
        <ChannelTicker
          channels={channels
            .filter(c => c.platform === 'naver_blog')
            .sort((a, b) => (b.video_count ?? 0) - (a.video_count ?? 0))
            .slice(0, 12)
          }
          platform="naver_blog"
        />
      </div>

      {/* Buzz Alert */}
      <BuzzAlertBanner alerts={buzzAlerts} />

      {/* KPI Cards */}
      <StatsCards
        totalChannels={channels.length}
        totalVideos={totalVideos}
        todayVideos={todayVideos}
        topCategory={topCategory}
      />

      {/* Row: Top Mentions + Channel Prediction Profile */}
      <div className="grid gap-6 lg:grid-cols-2">
        <TopMentionsChart data={assetMentions} />
        <ChannelPredictionProfile data={predictionProfiles} />
      </div>

      {/* Consensus Score */}
      <ConsensusScore data={consensus} />

      {/* Prediction Feed */}
      <PredictionFeed predictions={predictions} />

      {/* Asset Sentiment Grid */}
      <AssetSentimentGrid data={assetSentiments} />

      {/* Video Feed */}
      <VideoFeed videos={videos} />
    </div>
  )
}
