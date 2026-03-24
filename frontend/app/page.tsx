import { unstable_cache } from "next/cache"
import {
  getChannels, getRecentVideosWithAssets, getDailyStats, getTotalVideoCount,
  getAssetConsensus, getAssetMentions,
  getRecentPredictions, getTopAssetSentiments,
  getBuzzAlerts, getChannelPredictionProfiles,
  getMarketSentimentGauge, getContrarianSignals,
} from "@/lib/queries"
import type { Channel } from "@/lib/types"
import { CATEGORY_LABELS } from "@/lib/types"
import { DashboardContent } from "@/components/dashboard/dashboard-content"

export const dynamic = "force-dynamic"

const getCachedDashboardData = unstable_cache(
  async () => {
    try {
      const [channels, videos, stats, totalVideos, consensus, assetMentions, predictions, assetSentiments, buzzAlerts, predictionProfiles, marketGauge, contrarianSignals] = await Promise.all([
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
        getMarketSentimentGauge(),
        getContrarianSignals(30, 75),
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
        buzzAlerts, predictionProfiles, marketGauge, contrarianSignals,
      }
    } catch {
      return {
        channels: [] as Channel[], videos: [] as any[],
        totalVideos: 0, todayVideos: 0, topCategory: "-",
        consensus: [], assetMentions: [], predictions: [],
        assetSentiments: [], buzzAlerts: [], predictionProfiles: [],
        marketGauge: { overall_score: 50, category_scores: [], historical_extremes: [], current_warning: null },
        contrarianSignals: [],
      }
    }
  },
  ['dashboard-data'],
  { revalidate: 300 }
)

export default async function DashboardPage() {
  const data = await getCachedDashboardData()

  return (
    <div className="space-y-8">
      <DashboardContent {...data} />
    </div>
  )
}
