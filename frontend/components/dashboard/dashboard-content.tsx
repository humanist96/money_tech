"use client"

import type { Channel } from "@/lib/types"
import type { AssetConsensus, PredictionFeedItem, TopAssetSentiment, MarketSentimentGauge } from "@/lib/types"
import { StatsCards } from "@/components/dashboard/stats-cards"
import { VideoFeed } from "@/components/dashboard/video-feed"
import { TopMentionsChart } from "@/components/dashboard/top-mentions-chart"
import { ChannelPredictionProfile } from "@/components/dashboard/channel-prediction-profile"
import { ConsensusScore } from "@/components/dashboard/consensus-score"
import { PredictionFeed } from "@/components/dashboard/prediction-feed"
import { AssetSentimentGrid } from "@/components/dashboard/asset-sentiment-grid"
import { BuzzAlertBanner } from "@/components/dashboard/buzz-alert"
import { ChannelTicker } from "@/components/dashboard/asset-ticker"
import { MarketGaugePanel } from "@/components/features/market-gauge"
import { ContrarianSignalPanel } from "@/components/features/contrarian-signal"
import { DashboardLayout, type DashboardSection } from "@/components/dashboard/dashboard-layout"

interface DashboardContentProps {
  channels: Channel[]
  videos: any[]
  totalVideos: number
  todayVideos: number
  topCategory: string
  consensus: AssetConsensus[]
  assetMentions: any[]
  predictions: PredictionFeedItem[]
  assetSentiments: TopAssetSentiment[]
  buzzAlerts: any[]
  predictionProfiles: any[]
  marketGauge: MarketSentimentGauge
  contrarianSignals: any[]
}

export function DashboardContent({
  channels, videos, totalVideos, todayVideos, topCategory,
  consensus, assetMentions, predictions, assetSentiments,
  buzzAlerts, predictionProfiles, marketGauge, contrarianSignals,
}: DashboardContentProps) {
  const sections: DashboardSection[] = [
    {
      id: "tickers",
      label: "채널 티커",
      content: (
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
      ),
    },
    {
      id: "buzz",
      label: "버즈 알림",
      content: <BuzzAlertBanner alerts={buzzAlerts} />,
    },
    {
      id: "stats",
      label: "주요 지표",
      content: (
        <StatsCards
          totalChannels={channels.length}
          totalVideos={totalVideos}
          todayVideos={todayVideos}
          topCategory={topCategory}
        />
      ),
    },
    {
      id: "market-gauge",
      label: "시장 온도계 & 역발상 시그널",
      content: (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <MarketGaugePanel data={marketGauge} />
          </div>
          <div className="lg:col-span-2">
            <ContrarianSignalPanel signals={contrarianSignals} />
          </div>
        </div>
      ),
    },
    {
      id: "mentions-profile",
      label: "인기 언급 & 채널 예측 프로필",
      content: (
        <div className="grid gap-6 lg:grid-cols-2">
          <TopMentionsChart data={assetMentions} />
          <ChannelPredictionProfile data={predictionProfiles} />
        </div>
      ),
    },
    {
      id: "consensus",
      label: "종목별 합의도",
      content: <ConsensusScore data={consensus} />,
    },
    {
      id: "predictions",
      label: "최근 예측",
      content: <PredictionFeed predictions={predictions} />,
    },
    {
      id: "sentiment",
      label: "인기 종목 감성 분포",
      content: <AssetSentimentGrid data={assetSentiments} />,
    },
    {
      id: "videos",
      label: "최신 콘텐츠",
      content: <VideoFeed videos={videos} />,
    },
  ]

  return (
    <>
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
            재테크 콘텐츠 실시간 분석 현황
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-th-dim">
          <span className="w-2 h-2 rounded-full bg-[#00e8b8] pulse-dot" />
          Live
        </div>
      </div>

      <DashboardLayout sections={sections} />
    </>
  )
}
