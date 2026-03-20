import {
  getDailyStats, getSentimentTrend, getMentionSpike,
  getChannelAssetMatrix, getChannelActivity, getAssetCorrelations,
} from "@/lib/queries"
import type { DailyStat } from "@/lib/types"
import { SentimentTrendChart } from "@/components/charts/sentiment-trend-chart"
import { MentionSpikeChart } from "@/components/charts/mention-spike-chart"
import { OpinionMatrix } from "@/components/dashboard/opinion-matrix"
import { ActivityHeatmap } from "@/components/charts/activity-heatmap"
import { CorrelationNetwork } from "@/components/charts/correlation-network"
import { CategoryBarChart } from "@/components/charts/category-bar-chart"
import { TrendDetails } from "./trend-details"

export const revalidate = 1800

async function getTrendData() {
  try {
    const [stats, sentimentTrend, mentionSpikes, opinionMatrix, channelActivity, correlations] = await Promise.all([
      getDailyStats(30),
      getSentimentTrend(30),
      getMentionSpike(30),
      getChannelAssetMatrix(30),
      getChannelActivity(30),
      getAssetCorrelations(30, 2),
    ])

    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000)
    const recentStats = stats.filter((s) => new Date(s.date) >= sevenDaysAgo)

    const catCounts: Record<string, number> = {}
    for (const s of recentStats) {
      catCounts[s.category] = (catCounts[s.category] ?? 0) + (s.total_videos ?? 0)
    }
    const categoryData = Object.entries(catCounts).map(([category, count]) => ({ category, count }))

    return { stats, sentimentTrend, mentionSpikes, opinionMatrix, channelActivity, correlations, categoryData }
  } catch {
    return {
      stats: [] as DailyStat[], sentimentTrend: [], mentionSpikes: [],
      opinionMatrix: [], channelActivity: [], correlations: [], categoryData: [],
    }
  }
}

export default async function TrendsPage() {
  const { stats, sentimentTrend, mentionSpikes, opinionMatrix, channelActivity, correlations, categoryData } = await getTrendData()

  return (
    <div className="space-y-8">
      <div className="relative">
        <div className="flex items-center gap-3 mb-1.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#7c6cf0]/20 to-[#7c6cf0]/5 border border-[#7c6cf0]/20 flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7c6cf0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
            </svg>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-th-primary glow-text" style={{ fontFamily: 'var(--font-outfit)' }}>
            트렌드
          </h1>
        </div>
        <p className="text-th-dim text-sm">카테고리별 감성 트렌드 및 종목 분석</p>
      </div>

      {/* Sentiment Trend Chart */}
      <SentimentTrendChart data={sentimentTrend} />

      {/* Row: Category Bar + Mention Spikes */}
      <div className="grid gap-6 lg:grid-cols-2">
        <CategoryBarChart data={categoryData} title="최근 7일 카테고리별 영상" />
        <MentionSpikeChart data={mentionSpikes} />
      </div>

      {/* Correlation Network */}
      <CorrelationNetwork data={correlations} />

      {/* Opinion Matrix */}
      <OpinionMatrix data={opinionMatrix} />

      {/* Activity Heatmap */}
      <ActivityHeatmap data={channelActivity} />

      {/* Category Details */}
      <TrendDetails stats={stats} />
    </div>
  )
}
